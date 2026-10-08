# Context Hub

一个本地、可复用的个人项目数据层，用来管理定时任务工作区的运行记录、历史报告、来源排重和轻量上下文。

## 解决的问题

「优化是个好事」原本把历史去重信息同时放在 automation memory 和每一份 HTML 正文里。随着运行次数增加，下一次任务需要读取的上下文越来越大，而且报告样式由每次运行临时决定。

Context Hub 把它拆成三层：

1. SQLite：保存 workspace、run、document、source item、memory snapshot 的结构化记录。
2. Compact memory：只保留报告索引、URL/标题排重指纹和最近运行指针；定时任务默认读取它。
3. Fixed report template：所有新报告用同一套自包含 HTML 模板输出；历史 HTML 只作为 source_path 归档，不会被自动整份回读。

## 包边界

本包独立维护 SQLite 数据和报告产物：

- data/context-hub.sqlite：结构化数据库；
- data/exports/：供定时任务读取的 compact memory；
- data/reports/：固定模板生成的 HTML 报告；
- skills/context-hub/SKILL.md：供 Agent 使用的配套 Skill。

不要把 Context Hub 的数据库、报告或导出文件写入 monorepo 根目录。

## 快速开始

本项目使用 TypeScript 源码和 Node.js 原生 TypeScript type stripping 运行，要求 Node.js `>=22.6`；数据库使用内置 `node:sqlite`，不需要启动数据库服务或安装外部依赖。运行时仍然是 Node.js，不需要额外的 TypeScript runtime。

```bash
cd /Volumes/Project/new_shit/context-hub
npm run import -- \
  --source "/Users/byur/Documents/优化是个好事" \
  --memory "/Users/byur/.codex/automations/ai/memory.md" \
  --workspace ai \
  --kind deepread
npm run import -- \
  --source "/Users/byur/Documents/优化是个好事" \
  --memory "/Users/byur/.codex/automations/ai-trending/memory.md" \
  --workspace ai-trending \
  --kind trending
npm run dashboard
```

然后打开 <http://127.0.0.1:4321>。

## MCP 服务

Context Hub 也可以作为本地 MCP 服务供 Agent 调用，默认监听 `127.0.0.1:7777`：

```bash
npm run mcp
```

MCP endpoint 为 `http://127.0.0.1:7777/mcp`。服务提供工作区概览、压缩上下文、报告/来源检索、固定模板报告导出，以及将新增记忆同步入库的工具。服务只绑定本机地址；一次性任务完成后应停止服务。

配套 Skill 位于 [`skills/context-hub/SKILL.md`](skills/context-hub/SKILL.md)，其中包含 Agent 的工作区路由、上下文读取顺序和同步约束。

导入会生成：

- `data/context-hub.sqlite`：本地数据库；
- `data/exports/ai-memory.compact.md`：供定时任务读取的短索引；
- `data/reports/*.fixed.html`：以固定模板生成的规范化报告样本。

查看定时任务应读取的最小上下文：

```bash
npm run prompt -- --workspace ai --limit 80
```

## 每次定时任务完成后的同步命令

把下面的命令加入对应 automation 的收尾步骤即可。它会重新扫描新增 HTML、用 SHA-256 做幂等更新，再重写对应 compact memory 和最新固定模板样本：

```bash
# AI 技术博客精读
node --experimental-strip-types /Volumes/Project/new_shit/context-hub/src/cli.ts import \
  --source "/Users/byur/Documents/优化是个好事" \
  --memory "/Users/byur/.codex/automations/ai/memory.md" \
  --workspace ai --kind deepread

# AI Trending 每日推送
node --experimental-strip-types /Volumes/Project/new_shit/context-hub/src/cli.ts import \
  --source "/Users/byur/Documents/优化是个好事" \
  --memory "/Users/byur/.codex/automations/ai-trending/memory.md" \
  --workspace ai-trending --kind trending
```

如果只需要给 Agent 提供上下文，也可以读取 `npm run prompt -- --workspace ai` 或 `GET /api/prompt?limit=80`，不需要打开数据库或历史报告正文。

## 给 automation 的迁移边界

本项目不会自动修改 `/Users/byur/.codex/automations/ai/automation.toml` 或原始 `memory.md`。确认迁移后，把定时任务的去重输入改为：

```text
只读取 /Volumes/Project/new_shit/context-hub/data/exports/ai-memory.compact.md（GitHub 趋势任务读取 ai-trending-memory.compact.md）。
需要复盘正文时，只按 source_path 打开一份具体 HTML；不要扫描工作区全部历史 HTML，也不要把完整历史正文写回 memory。
任务完成后，将本次新增的来源 URL、标题、报告路径和一句话摘要写入 Context Hub 数据库/compact index。
```

这样做是为了把“是否切换 automation”留给你确认，避免项目初始化时改变现有定时任务行为。

## 数据模型

`projects → workspaces → runs → documents` 是主链；`items` 是跨报告共享的来源/排重条目，`links` 保存文档级引用，`memory_snapshots` 记录原始 memory 与 compact memory 的体积和哈希。

所有导入记录带有 `source_path` 与 SHA-256。SQLite 文件是可备份、可查询的单一数据源；HTML 是可移交的呈现层。

## 验证

```bash
npm test
```

当前实现只对本地文件做解析和入库，不访问网络、不执行 automation，也不会删除或覆盖「优化是个好事」原有文件。
