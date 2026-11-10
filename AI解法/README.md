# AI解法

| 序列 | 官方 JS 回放分数 | 合法性 | 块数 | 每块最多步数 |
|---|---|---|---|---|
| **result-1403060.txt** | **1,403,060** | **legal** | **10000** | **24** |

**由纯 AI 独立完成**（C++ 束搜索、高底地构造、窗口重规划与官方 JS 核验）。  
路线：约 11 层稳定底地 + 束搜索（曾用宽度 768 / 1536）+ 虚拟信用推迟便宜单消 + 窗口 / 长尾重规划（按块索引与全部 20 行盘面精确拼接）。

小白向图文说明 → [../docs/AI解法.md](../docs/AI解法.md)

## 验证

在仓库根目录执行：

```bash
node "AI解法/verify.js" "AI解法/result-1403060.txt"
```

验证器会加载本仓库未改动的官方脚本 `js/tetris.config.js`、`js/tetris.core.js`，从空盘回放整条序列。应得到：

```text
score=1403060
legal=true
bricks=10000
complete10000=true
maxBrickMoves=24
aboveBoardLockCount=0
strictlyExceeds1395326=true
clearHistogram=[8734, 56, 190, 522, 497]
meanOccupancyAtClear≈160.098
recordSha256=50596d4537b56a3f48e98efd1acda1c1ec32f2da7338d33370811c6ae13f640a
```

对照已核验结果见 [verified.json](verified.json)。
