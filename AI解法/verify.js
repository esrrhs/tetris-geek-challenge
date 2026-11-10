'use strict';
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');
const jsDir = path.join(__dirname, '..', 'js');

function engine() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['tetris.config.js', 'tetris.core.js']) {
    vm.runInContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), ctx, { filename: f });
  }
  const t = new ctx.window.Tetris();
  t.initGrids();
  t.status = 'paused';
  return t;
}

function replay(file, dump, returnState = false) {
  const data = fs.readFileSync(file);
  const text = data.toString('utf8').trim().split(/\r?\n/);
  if (text.length > 2) throw Error('Expected a record line and optional score line');
  const claimedScore = text.length > 1 ? Number(text[1]) : null;
  if (claimedScore !== null && !Number.isSafeInteger(claimedScore)) {
    throw Error('Invalid claimed score');
  }
  const record = text[0].split(',');
  const t = engine();
  let active = false, ended = false, locked = 0, moves = 0;
  const clears = [0, 0, 0, 0, 0];
  let overground = 0, occupancySum = 0, clearEvents = 0;
  const snapshots = [];
  let brickMoves = 0, maxBrickMoves = 0;

  function lock() {
    maxBrickMoves = Math.max(maxBrickMoves, brickMoves);
    if (brickMoves > 100) throw Error('More than 100 unit operations per brick');
    brickMoves = 0;
    if (!active) throw Error('No active brick');
    const down = { pos: t.curBrickInfo.pos.map(([x, y]) => [x, y + 1]) };
    if (t.isBrickPosValid(down)) throw Error(`Floating lock at brick ${t.brickCount}`);
    if (t.curBrickInfo.pos.some(([x, y]) => y < 0)) overground++;
    let b = t.grids.map(r => r.slice());
    for (const [x, y] of t.curBrickInfo.pos) if (y >= 0) b[y][x] = 'x';
    let n = b.filter(r => r.every(Boolean)).length;
    let occ = b.flat().filter(Boolean).length;
    const r = t.update();
    locked++;
    active = false;
    ended = r.topTouched || r.isRoundLimited;
    if (!ended) {
      clears[n]++;
      if (n) {
        occupancySum += occ;
        clearEvents++;
      }
    }
    if (dump) snapshots.push({
      brick: locked,
      score: t.score,
      rows: t.grids.map(r => r.reduce((a, v, x) => a | (v ? 1 << x : 0), 0))
    });
  }

  for (let i = 0; i < record.length; i++) {
    const op = record[i];
    if (!/^(N|[LRDC][1-9][0-9]*)$/.test(op)) throw Error(`Bad token ${i}: ${op}`);
    if (op === 'N') {
      if (active) lock();
      if (ended) throw Error(`Commands after terminal at token ${i}`);
      if (!t.initBrick().isValid) throw Error(`Invalid spawn ${t.brickCount}`);
      active = true;
      continue;
    }
    if (!active || ended) throw Error('Action without active game');
    const type = op[0], n = +op.slice(1);
    if (n > 1000) throw Error('Excess count');
    for (let j = 0; j < n; j++) {
      const before = t.curBrickCenterPos.slice(), state = t.stateIndex;
      if (type === 'C') {
        t.rotate();
        if (t.stateIndex == state) throw Error(`Illegal rotation brick ${t.brickCount}`);
      } else {
        t.move({ L: 'left', R: 'right', D: 'down' }[type], 1);
        if (before[0] === t.curBrickCenterPos[0] && before[1] === t.curBrickCenterPos[1]) {
          throw Error(`Illegal ${op}, brick ${t.brickCount}, token ${i}`);
        }
      }
      moves++;
      brickMoves++;
    }
  }
  if (active) lock();
  if (claimedScore !== null && claimedScore !== t.score) {
    throw Error(`Claimed score ${claimedScore} differs from official replay ${t.score}`);
  }
  const out = {
    file,
    score: t.score,
    claimedScore,
    bricks: locked,
    terminal: ended,
    complete10000: ended && locked === 10000,
    maxBrickMoves,
    strictlyExceeds1395326: t.score > 1395326,
    legal: true,
    aboveBoardLockCount: overground,
    unitMoves: moves,
    clearHistogram: clears,
    meanOccupancyAtClear: occupancySum / clearEvents,
    fileSha256: crypto.createHash('sha256').update(data).digest('hex'),
    recordSha256: crypto.createHash('sha256').update(text[0]).digest('hex')
  };
  if (dump) fs.writeFileSync(dump, JSON.stringify(snapshots));
  return returnState ? { report: out, t } : out;
}

if (require.main === module) {
  try {
    if (!process.argv[2]) throw Error('Usage: node verify.js <result.txt> [snapshots.json]');
    console.log(JSON.stringify(replay(process.argv[2], process.argv[3]), null, 2));
  } catch (e) {
    console.error(e.stack);
    process.exitCode = 1;
  }
}

module.exports = { engine, replay };
