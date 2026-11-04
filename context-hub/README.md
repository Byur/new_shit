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

### 每日发现（discovery-v1）

AI Trending 的目标是每日拓展视野，范围包括 AI 应用、开发工具、重要产品的开源插件/集成和工作流生态。`github_select_discoveries` 是新任务的唯一选择入口；`github_rank_trending_candidates` 保留为旧榜单调用的兼容接口，新任务不调用它。没有周/月配额，也没有最低总 stars、仓库年龄或成熟度门槛。

1. Agent 先声明细分主题或产品生态，再通过 `github_search_repositories`、Trending、官方目录/发布资料发现候选。搜索返回的是有界结果，不是完整领域排名；不得根据候选表现事后定制比较范围。每个 scope 声明查询、原始来源、观察日期、指标、窗口与完整的观察名单。跨 scope 可以重叠，同一仓库最终只选一次。
2. Agent 阅读原文，核验用途/生态关系、仓库身份和事实证据；Context Hub 提供60天去重。项目不必直接实现 AI，但要说明它支持的重要产品/工作流及来源。早期、小众、非生产成熟项目可以入围，采用限制写进正文。
3. 每个项目必须有近期趋势依据：最多30个连续UTC日的完整窗口内正关注增量（stars、下载或独立参与者），或该窗口内发生的独立官方收录、集成、实际采用事件。窗口结束距报告日少于30天，来源检查距报告日最多7天且不早于证据日期。已有官方关系、作者自己的发布、commit、总 stars 和单次排名均不能替代趋势依据。
4. `github_attention_window` 提供 stars 当前窗口及相邻等长基线的覆盖检查。没有完整基线时只能说“新增关注”，不能说“加速”；有基线时由服务计算增量变化。Agent 不手算替代服务。事件需给出事件日期、独立主体、原始链接及具体事实。服务拒绝未知、零增量、未来、过期、覆盖不完整或不等长基线，不给缺失趋势补中性分。
5. 在同一 scope/指标/窗口内，先按绝对增量排序，再比较等长基线的增量变化、证据日期与规范仓库名；不直接奖励百分比，避免小基数暴涨压过实质关注。局部位置在去重前计算，明确只覆盖有可比证据的观察，不能写成全领域前列。认可事件每个候选只计一个，按日期与名称解决并列；不是主观认可度打分。
6. 跨 scope 选择依次偏向已收录较少的生态、较少的 scope、局部位置、较新证据、稳定 scope ID、仓库名。多样性用于组合，不是硬剔除；没有其他生态时可继续从同组补齐。默认5个，少于5个返回 `shortfall`。跨来源不比较 stars 与下载等绝对值，不生成伪全局热门分。
7. Agent 使用服务返回的 `selected` 顺序写作；服务返回 `ranking`、`excluded`、`evidence`、`filterReasons` 便于复盘。没有来源或没有趋势不等于冷门，不得编造。服务保证输入检查、时间窗口、计算与选择确定性；链接真实性、页面内容、独立认可及范围语义仍由 Agent 核验，`verifiedFields` 不是机器认证网页的证明。

`github_search_repositories` 按 query 返回至多100条；`incompleteResults` 与 `complete` 披露截断，只用于发现，不能将按总 stars/updatedAt 排序当成趋势。跨批候选应分批调用 Context Hub 的来源检查（每批最多50个）。来源之一不可用时可继续其他已核验来源；选中项目证据不足就排除，全部来源失效或去重不可用时停止运行。

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

## AI Trending HTML 归档契约 v1

本节由每日 Agent 回读，`src/report-contract.ts` 在 CLI 校验和 SQLite 导入时执行。这里只固定局部语义结构；Agent 沿用原有 CSS/视觉模板，Context Hub 不生成 HTML，不维护另一套视觉模板。历史无版本报告继续按旧解析器读取，不自动重写。

- 文件名保持 `ai-trending-YYYY-MM-DD.html`。`head` 包含 `meta name="report-schema" content="ai-trending/1"` 与 `meta name="report-date" content="YYYY-MM-DD"`，日期必须与文件名一致。UTF-8、doctype、唯一非空 title/h1、静态 HTML；不放 script/iframe/template。
- 唯一正文容器标记 `data-report="ai-trending"`。其内部按顺序保留四个 `section`：`report-summary`、`report-projects`、`report-synthesis`、`report-sources`，每节一个非空 h2。标题文案可变化，ID 不变。hero 可作为 summary section，原 class/CSS 可继续使用。footer 不额外制造 h1。
- 摘要为 `p data-field="summary"`。正文完整存在 HTML 文本节点中，不通过 CSS 伪元素、脚本、图片或隐藏 JSON 承载必要内容。
- 项目按服务选中顺序放入 `report-projects`；每个是 `article class="exhibit" id="project-owner-repo" data-project="owner/repo"`，id 使用小写安全字符且唯一。保留视觉 class，内部 div 排版自由。
- 每个项目唯一 h3 内含 `a data-role="repository" href="https://github.com/owner/repo"`；仓库链接无 fragment/query，显示名称可附编辑副标题。
- 每个项目按顺序具有五个 `p`，`data-field` 分别为 `positioning`、`capabilities`、`use-cases`、`trend`、`limitations`。每段用可见 strong 标签写“项目定位”“核心能力”“适用场景”“关注依据”“局限与采用条件”等标签，正文自由写作，不新增五个小标题。趋势日期用 `<time datetime="YYYY-MM-DD">YYYY-MM-DD</time>`，正文区分新增关注、加速与新认可事件。
- 来源是 `p` 或 `ul data-field="sources"`，至少两个有可见标题的原始 HTTP(S) 链接，包含项目资料与服务返回的趋势证据 `sourceUrl`。`trend` 段显示对应 `evidenceDate`。所有链接使用真实 a href，禁止空链接和 javascript URL。
- 0项目时用 `p data-field="empty-state"` 说明无合格新增；1项目只写个案观察，不硬凑跨项目趋势。来源章节保留观察窗口和必要出处。排名正文用 `No. 1` 或“第1名”，不写 `#1`；代码和 URL fragment 可保留。

每次生成后先校验（selection 是本次服务返回对象的原样临时保存，非手抄名单）：

```bash
node --experimental-strip-types /Volumes/Project/new_shit/context-hub/src/cli.ts validate-report \
  --file "/Users/byur/Documents/优化是个好事/ai-trending-YYYY-MM-DD.html" \
  --selection /private/tmp/ai-trending-current-selection.json
```

该命令检查选中仓库、顺序、证据链接/日期、段落与结构。通过后使用既有 MarkItDown Importer CLI 与 Vault 的默认 before Hook（排名规范化）转换；不绕过 Hook，不原地预处理源 HTML。该 CLI 会额外生成文件名 h1，归档验收允许它存在；项目保持 Markdown `###` 和五段加粗标签。

转换后沿用 automation 约定整理 `created`、`summary`、具体技术 tags，保留 `source_file`、`converted_at`、`converter`，再验收实际 Markdown：

```bash
node --experimental-strip-types /Volumes/Project/new_shit/context-hub/src/cli.ts validate-report \
  --file "/Users/byur/Documents/优化是个好事/ai-trending-YYYY-MM-DD.html" \
  --selection /private/tmp/ai-trending-current-selection.json \
  --markdown "/Users/byur/Documents/Obsidian Vault/项目卷/优化是个好事/AI Trending/ai-trending-YYYY-MM-DD.md"
```

校验器读取真实 Markdown，逐项目核对段落、链接、顺序及 source_file，失败不能声称归档完成。报告中间选项文件在完成后删除；通用校验器与回归测试保留用于后续每日运行。SQLite 中新版 `content_json` 同时保留 `archiveSchema`、项目身份及五段内容，便于稳定读取。
