# Context Hub

一个本地、可复用的个人项目数据层，用来管理定时任务工作区的运行记录、历史报告、来源排重和轻量上下文。

## 解决的问题

「优化是个好事」原本把历史去重信息同时放在 automation memory 和每一份 HTML 正文里。随着运行次数增加，下一次任务需要读取的上下文越来越大，而且数据服务与报告生成职责混在一起。

Context Hub 把它拆成三层：

1. SQLite：保存 workspace、run、document、source item、memory snapshot 的结构化记录。
2. Compact memory：只保留工作区指针、最近报告路径和读取规则；不复制完整来源列表或历史正文。
3. Agent-owned HTML：Agent 持有固定 HTML 模板并负责研究、写作和最终 HTML；Context Hub 不创建第二套模板。

## 包边界

本包独立维护 SQLite 数据服务产物：

- data/context-hub.sqlite：结构化数据库；
- data/exports/：供定时任务读取的 compact memory；
- skills/context-hub/SKILL.md：供 Agent 使用的配套 Skill。

不要把 Context Hub 的数据库或导出文件写入 monorepo 根目录；最终 HTML 仍由 Agent 写入定时任务工作区。

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

MCP endpoint 为 `http://127.0.0.1:7777/mcp`。服务提供工作区概览、压缩上下文、报告/来源检索、Trending 候选批量排重，以及将 Agent 新生成报告和记忆同步入库的工具。服务只绑定本机地址；一次性任务完成后应停止服务。

### GitHub CLI 数据 MCP（独立入口）

为了保持 Context Hub 的 SQLite/排重核心与 GitHub 数据能力解耦，GitHub CLI 数据 MCP 是同一 7777 进程下的独立路径：

```bash
npm run mcp
```

GitHub CLI MCP endpoint 为 `http://127.0.0.1:7777/github/mcp`，仅包装固定、只读的 `gh api` 路径，提供 CLI 登录状态、仓库证据、star history、按月聚合的单仓库新增 stars、上一个完整自然月的可见 GitHub Trending 等价排名快照、当实时周榜不可用时的可见周榜快照，以及由 MCP 服务端执行的 Trending 候选综合排序。它不访问 Context Hub SQLite。若宿主没有把 `/github/mcp` 注册为命名工具，Agent 应直接通过本机 HTTP JSON-RPC 的 `tools/list`/`tools/call` 调用，不得据此判断 GitHub MCP 不存在。服务不会调用 `gh auth token`，不会读取 GitHub Desktop 或 Keychain，也不会将 token 写入 SQLite、日志、HTML 或 memory。首次使用前由用户自行执行 `gh auth login`；未登录或 endpoint 无权访问时，工具返回不可核验状态。

`github_monthly_trending_snapshot` 读取公开的版本化月榜快照，返回实际 `period`、可见 `count` 和项目的 `period_stars`。它可以满足“等价月度星标增长排名”分支，但不是全局 stars Top 500；报告必须披露来源和可见数量，不得改写成 Top 500。

`github_weekly_trending_snapshot` 读取同一数据集的 ISO 周快照，仅作为实时 GitHub Trending 页面不可访问或明显过期时的有界兜底；报告必须披露 `capturedAt`、实际 `period` 和可见 `count`，不得声称已经验证完整 Top 30。

Trending 选择由 `github_rank_trending_candidates` 在 MCP 服务端执行“两层”确定性算法：先只硬过滤 AI 相关性、仓库证据、60 天排重和最低事实证据；所有通过硬过滤的可见候选都进入排序。服务端返回 `ranking`、`excluded`、`selected`、分项 `scores`、`weights` 和 `shortfall`，Agent 不得在提示词或写作阶段重新计算、增加门槛或覆盖排序结果。算法的权重与归一化规则以 `src/github-cli.ts` 的 `trending-ranking-v1` 实现为准；该分数只负责综合排序，不是入选门槛。排序后周榜取前 3 个、月榜取前 2 个，并跨榜去重；候选池不足时报告缺口，不通过收紧条件或外推不可见项目凑数。

Trending 的解释分为两个维度：`近期热门`看短窗口排名和 `period_stars`，`主流`看总 stars、forks、项目成熟度、发布/文档、社区或采用信号；跨快照重复出现才能标记为 `持续热门`。报告必须把“近期热度依据”和“主流度依据”分开，不能用一次增长高峰直接推断主流。

这些维度不构成额外筛选门槛：通过 AI 相关性、来源可核验、最低证据和 60 天排重的候选，不会因为主流度未知而被删除。权重算法由 MCP 服务端执行，只能让多个信号参与综合排序，不能把综合分数变成过滤条件；缺失指标由服务端按未知/中性信号处理，不当作 0 分。固定权重的目的只是保证结果可复现，不是提高筛选严格度。

配套 Skill 位于 [`skills/context-hub/SKILL.md`](skills/context-hub/SKILL.md)，其中包含 Agent 的工作区路由、上下文读取顺序和同步约束。

导入会生成：

- `data/context-hub.sqlite`：本地数据库；
- `data/exports/ai-memory.compact.md`：供定时任务读取的短索引；
- 定时任务工作区中的原始 HTML：由 Agent 使用既有模板直接生成，Context Hub 只读取并建立索引。

查看定时任务应读取的最小上下文：

```bash
npm run prompt -- --workspace ai --limit 20
```

## 每次定时任务完成后的同步命令

把下面的命令加入对应 automation 的收尾步骤即可。它会重新扫描 Agent 已生成的 HTML、用 SHA-256 做幂等更新，再重写 compact memory 指针；不会改写或重新渲染 HTML：

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

如果只需要给 Agent 提供上下文，也可以读取 `npm run prompt -- --workspace ai` 或 `GET /api/prompt?limit=20`，不需要打开数据库或历史报告正文。

Trending 任务在选择候选仓库后，应优先调用 `context_hub_check_sources`，传入候选仓库 URL/标题和 `windowDays: 60`。只有返回 `eligible: true` 的候选可以进入报告；不要依赖 memory 保存两个月排重清单。

## 给 automation 的迁移边界

调用 `context_hub_sync_workspace` 时应显式传入 `sourcePath`、`memoryPath`、`workspace`、`kind` 和 `dbPath: /Volumes/Project/new_shit/context-hub/data/context-hub.sqlite`，不要让服务根据调度宿主的当前工作目录或旧服务进程推断数据库位置。

本项目不会自动修改 `/Users/byur/.codex/automations/ai/automation.toml` 或原始 `memory.md`。确认迁移后，把定时任务的去重输入改为：

```text
先调用 Context Hub MCP 的 `context_hub_get_compact_context` 获取工作区指针，再用 `context_hub_search_sources` 查询 URL/标题是否已经获取过；不要扫描工作区全部历史 HTML，也不要把完整历史正文写回 memory。
Agent 继续负责研究、内容生成、固定 HTML 模板和最终 HTML 文件。任务完成后调用 `context_hub_sync_workspace`，让 Context Hub 把来源 URL、标题、报告路径和结构化摘要写入 SQLite，并只更新 compact memory 指针。
```

这样做是为了把“是否切换 automation”留给你确认，避免项目初始化时改变现有定时任务行为。

## 数据模型

`projects → workspaces → runs → documents` 是主链；`items` 是跨报告共享的来源/排重条目，`links` 保存文档级引用，`memory_snapshots` 记录原始 memory 与 compact memory 的体积和哈希。

所有导入记录带有 `source_path` 与 SHA-256。SQLite 文件是可备份、可查询的排重与档案数据源；HTML 是 Agent 负责的呈现层，Context Hub 不负责渲染。

## 验证

```bash
npm test
```

当前实现只对本地文件做解析和入库，不访问网络、不执行 automation，也不会删除或覆盖「优化是个好事」原有文件。
