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

- data/context-hub.sqlite：结构化数据库（运行时创建，不入库）；
- data/exports/：供定时任务读取的 compact memory（由数据库重新生成，不入库）；
- skills/context-hub/SKILL.md：供 Agent 使用的配套 Skill。

不要把 Context Hub 的数据库或导出文件写入 monorepo 根目录；最终 HTML 仍由 Agent 写入定时任务工作区。新机器上首次运行 `npm run serve`、`npm run dashboard` 或 `npm run import` 会自动创建空库，不需要手动 init。

## 快速开始

本项目使用 TypeScript 源码和 Node.js 原生 TypeScript type stripping 运行，要求 Node.js `>=22.6`；数据库使用内置 `node:sqlite`，不需要启动数据库服务或安装外部依赖。运行时仍然是 Node.js，不需要额外的 TypeScript runtime。

```bash
cd /Volumes/BillionSteps/GitHub/new_shit/context-hub
npm run import -- \
  --source "$HOME/Documents/优化是个好事" \
  --memory "$HOME/.codex/automations/ai/memory.md" \
  --workspace ai \
  --kind deepread
npm run import -- \
  --source "$HOME/Documents/优化是个好事" \
  --memory "$HOME/.codex/automations/ai-trending/memory.md" \
  --workspace ai-trending \
  --kind trending
npm run dashboard
```

然后打开 <http://127.0.0.1:4321>。

## MCP 服务

Context Hub 也可以作为本地 MCP 服务供 Agent 调用，默认监听 `127.0.0.1:7777`（与 Dashboard `127.0.0.1:4321` 及自动化调度器一起由 `npm run serve` / launchd 常驻托管）：

```bash
npm run serve   # 常驻启动 4321 + 7777 + 自动化调度（日常由 launchd 托管）
```

MCP endpoint 为 `http://127.0.0.1:7777/mcp`。服务提供工作区概览、压缩上下文、报告/来源检索、Trending 候选批量排重，以及将 Agent 新生成报告和记忆同步入库的工具。服务只绑定本机地址；**在常驻模式下，定时任务完成后不要停止 7777 或 4321**（仅在本地临时调试 `npm run mcp` 时才按需关闭自己拉起的进程）。

`serve` 启动时会依次读取 `~/.config/context-hub/env` 和仓库根 `.env`，只补未设置的键，真实环境变量优先；其他工具的密钥不会被载入。飞书告警复用 `FEISHU_AGENT_APP_ID` / `FEISHU_AGENT_APP_SECRET`，与 `dsh-feishu-agent` 命名一致（旧 `DSH_FEISHU_AGENT_*` 仍作为回退）。

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
node --experimental-strip-types /Volumes/BillionSteps/GitHub/new_shit/context-hub/src/cli.ts import \
  --source "$HOME/Documents/优化是个好事" \
  --memory "$HOME/.codex/automations/ai/memory.md" \
  --workspace ai --kind deepread

# AI Trending 每日推送
node --experimental-strip-types /Volumes/BillionSteps/GitHub/new_shit/context-hub/src/cli.ts import \
  --source "$HOME/Documents/优化是个好事" \
  --memory "$HOME/.codex/automations/ai-trending/memory.md" \
  --workspace ai-trending --kind trending
```

如果只需要给 Agent 提供上下文，也可以读取 `npm run prompt -- --workspace ai` 或 `GET /api/prompt?limit=20`，不需要打开数据库或历史报告正文。

Trending 任务在选择候选仓库后，应优先调用 `context_hub_check_sources`，传入候选仓库 URL/标题和 `windowDays: 60`。只有返回 `eligible: true` 的候选可以进入报告；不要依赖 memory 保存两个月排重清单。

## 给 automation 的迁移边界

调用 `context_hub_sync_workspace` 时应显式传入 `sourcePath`、`memoryPath`、`workspace`、`kind` 和 `dbPath: /Volumes/BillionSteps/GitHub/new_shit/context-hub/data/context-hub.sqlite`，不要让服务根据调度宿主的当前工作目录或旧服务进程推断数据库位置。

本项目不会自动修改 `$HOME/.codex/automations/ai/automation.toml` 或原始 `memory.md`。确认迁移后，把定时任务的去重输入改为：

```text
先调用 Context Hub MCP 的 `context_hub_get_compact_context` 获取工作区指针，再用 `context_hub_search_sources` 查询 URL/标题是否已经获取过；不要扫描工作区全部历史 HTML，也不要把完整历史正文写回 memory。
Agent 继续负责研究、内容生成、固定 HTML 模板和最终 HTML 文件。任务完成后调用 `context_hub_sync_workspace`，让 Context Hub 把来源 URL、标题、报告路径和结构化摘要写入 SQLite，并只更新 compact memory 指针。
```

这样做是为了把“是否切换 automation”留给你确认，避免项目初始化时改变现有定时任务行为。

## 常驻服务与自动化调度

除按需运行的 MCP/Dashboard 外，Context Hub 还提供一个常驻进程，同时托管 Dashboard、MCP 和 Wizz A/B/C 调度器（默认全部任务关闭，需人工启用）：

| 组件 | 地址 | 入口 |
| --- | --- | --- |
| Dashboard / 控制面 | `http://127.0.0.1:4321` | `npm run dashboard`（无调度） |
| 自动化看板 | `http://127.0.0.1:4321/automation` | 随 `serve` 提供，只读 |
| MCP | `http://127.0.0.1:7777/mcp` | `npm run mcp`（仅 MCP） |
| GitHub CLI MCP | `http://127.0.0.1:7777/github/mcp` | 同上 |
| 调度器 | 同 4321 进程 | `npm run serve` |

```bash
npm run serve        # 常驻：4321 + 7777 + 调度器
npm test             # 回归测试
```

`serve` 启动顺序：加载 env → 获取 `data/context-hub.pid` 单实例锁 → 初始化/打开 SQLite → 加载任务配置 → 崩溃恢复 → 绑端口 → 启动调度 tick。已有存活实例、端口被占用或单实例冲突都会发飞书 P1 告警并退出。收到 SIGINT/SIGTERM 时会停调度、关端口、关库并清理 pidfile。**常驻模式下不要杀 7777/4321**。

### launchd 部署

```bash
cp context-hub/deploy/env.example ~/.config/context-hub/env
chmod 600 ~/.config/context-hub/env
# 按本机填写 CONTEXT_HUB_REPO / CONTEXT_HUB_DB / WIZZ_REPO / WIZZ_MATERIALS / CONTEXT_HUB_AUTOMATION_TOKEN 等

bash context-hub/deploy/init-dsh-home.sh        # 初始化隔离的 ~/.dsh-context-hub 与 headless profile
cp context-hub/deploy/com.wizzz.context-hub.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.wizzz.context-hub.plist
```

`com.wizzz.context-hub.plist` 不写任何本机路径：它通过 `CONTEXT_HUB_REPO` 定位 `context-hub/src/serve.ts`，启动日志写入 `~/Library/Logs/context-hub/`。

plist 用 `/bin/zsh -lc` 启动，只为了拿到登录 shell 的 PATH。launchd 的环境几乎是空的，而 nvm/fnm 之类通常只在**交互式** shell 里改 PATH——如果 `command -v node` 还是找不到，就在 env 文件里给绝对路径：

```bash
CONTEXT_HUB_NODE_BIN=/Users/you/.local/share/fnm/aliases/default/bin/node
```

常用维护命令：

```bash
launchctl print gui/$(id -u)/com.wizzz.context-hub      # 状态/pid/上次退出码
launchctl kickstart -k gui/$(id -u)/com.wizzz.context-hub   # 重启（改完代码后）
tail -f ~/Library/Logs/context-hub/stdout.log
```

`bootstrap` 失败时先看 `last exit code`：`127` 表示 shell 里没找到 node，`1` 多半是 pidfile 冲突或端口占用。

### env 加载顺序

`serve`、`dashboard`、`mcp` 和 CLI 启动时都会读取：

1. `~/.config/context-hub/env`
2. 仓库根 `.env`

只补进程里**未设置**的键，真实环境变量始终优先；先读到的文件赢。可用 `CONTEXT_HUB_ENV_FILE` 指定单一文件。白名单前缀为 `CONTEXT_HUB_`、`WIZZ_`、`FEISHU_AGENT_`、`FEISHU_APP_` 与 `*_API_KEY`；`DSH_`/`XDG_`/`DYLD_`/`BASH_FUNC_` 会被拒绝。飞书通知优先读 `FEISHU_AGENT_APP_ID` / `FEISHU_AGENT_APP_SECRET`，旧 `DSH_FEISHU_AGENT_*` 作为回退。

### 任务定义

任务配置在 `automation/tasks/wizz-{a,b,c}.json`，首次入库时按 `enabled` 写入 `automation_tasks`；默认 `false`，因此部署后不会自动跑。要启用：

```bash
npm run automation -- resume wizz-a
npm run automation -- run wizz-a --dry-run   # 先看 preflight、队列与 prompt hash
npm run automation -- run wizz-a
```

调度器实际读取的字段：

| 字段 | 含义 |
| --- | --- |
| `id` / `name` / `enabled` | 任务标识与默认开关 |
| `promptDoc` | 工作区内任务书路径。**每次运行读全文**，不再按小节切片 |
| `workspaceEnv` / `workspaceDir` | 工作区来源：环境变量（如 `WIZZ_REPO`）优先，其次任务 `workspaceDir`（绝对路径或相对 `context-hub/` 根目录），两者都没有时报错，不猜路径 |
| `runtime` | 运行时偏好：`auto`（默认，桥可用走桌面、否则 headless）/ `headless`（一次性 CLI）/ `desktop`（必须走桌面宿主，桥不可用时尝试唤醒 App 后 fail-closed） |
| `permissionMode` / `approvalPolicy` | 传给宿主/CLI 的权限与审批策略 |
| `timeoutMinutes` | 整次运行的硬超时（A 60 / B 60 / C 120 分钟）。这是防跑飞的后备，不是预期时长 |
| `stalledMinutes` | 停滞阈值：只有「这一轮既没在跑、也没交出答案」才计；只要宿主说 `running` 就一直等 |
| `unitConcurrency` | 父会话允许同时运行的子会话数（写进运行信封，由父会话 `session_spawn` 自行滚动补位） |
| `trigger.kind` / `trigger.cron` / `trigger.misfireMinutes` | 触发方式与补跑窗口。cron 是五段表达式，支持 `*`、单值、`a-b`、列表、步进；时区固定 `Asia/Shanghai` |
| `retry.infra.max` / `backoffMinutes` | 基础设施失败的重试次数与退避 |
| `notify.success.images` / `maxImages` | 成功卡是否附图、最多几张（`wizz-c`） |

`preflight`、`trigger.after` / `trigger.readiness`、`retry.infra.beforeRetry` 仍是声明性字段：对应的行为写死在调度器里（预检总是全跑、级联顺序固定、B/C 重试前清理固定）。改这些字段不会改变行为。

### 一次运行 = 一个会话

每次运行只创建一个会话（desktop 下是宿主里的父会话），把任务书**全文**加运行信封一起投进去：

```
tick / manual / cascade
  └─ executeTaskRun（幂等 runKey → 租约 → 预检 → 落 run 行）
       └─ runTaskDoc → DshRunner.runUnit → 一个会话 + 任务书全文
            ├─ desktop：桥 submit → 轮询 → 完成/取消；会话出现在桌面侧栏
            └─ headless：dsh --profile headless 一次性进程
                 └─ 解析结果契约 → automation_units/runs → summary.json → 飞书 → 级联
```

并发所有权只有一处：**父会话**。A 用 `session_spawn` 并行派发研究子会话，B/C 按批次滚动补位（上限取 `unitConcurrency`）。调度器不再按批建会话，因此不会出现「调度器一份 + 父会话一份」两套并发。

运行信封还负责三件容易出错的事：

1. **物料根**：桌面宿主的环境在 App 启动时固定，`WIZZ_MATERIALS` 传不进去。信封把绝对路径写进 prompt，并要求所有 `wizz-*` 工具调用显式带前缀或 `--materials`，否则会静默写到仓库内的 `materials/`。
2. **时长语义**：写明硬超时与「运行时长本身不是失败条件」，避免模型自己缩短工作。
3. **单点落盘**：所有失败节点只通过结果契约 JSON 返回，由守护进程写 `_failures.log` / `_pending_issue.md`，禁止会话直接写这两个文件。

**工作区**：`workspaceEnv` 指向的环境变量（如 `WIZZ_REPO`）优先，其次是任务 JSON 的 `workspaceDir`；相对路径按 `context-hub/` 根目录解析，例如 `../../wizzzzz-skillhub`。两者都未配置时调度器直接报错，不再使用隐藏的路径兜底；`npm run automation -- status` 会为每个任务返回解析结果（`source` / `exists` / `error`）。

**运行时**：两条执行路径。

- `desktop`：把任务投给装在桌面宿主里的 `dsh-context-hub-bridge`（见下节）。会话由宿主创建，所以在侧栏可见、可实时点开、可中途插话或停止；context-hub 只负责触发、轮询和取消。
- `headless`：一次性 `dsh --profile headless`，可靠但没有会话、过程不可见。

`auto` 的判定只看桥：桥可用就走 `desktop`，否则回退 `headless`。显式 `desktop` 在桥不可用时会先尝试 `open -a` 唤醒桌面，等待发现文件重写；仍不通就 fail-closed，不静默降级。`headless` 永远不走桥。注意：`auto` 只在**发现文件不存在/进程已死**时回退；发现文件在但端口打不通会记为基础设施失败，不会偷偷换路径重跑。

**宿主执行（desktop）的前提**：桌面 profile 里装了 [dsh-context-hub-bridge](../dsh-context-hub-bridge/) 并配好共享密钥。桥的发现文件默认是 `~/.dsh/context-hub-bridge.json`（端口在每次启动时变，`origin` 也以文件为准），密钥默认是 `~/.dsh/context-hub-bridge.secret`，都可用 `CONTEXT_HUB_BRIDGE_STATE` / `CONTEXT_HUB_BRIDGE_SECRET` 覆盖。预检的 `bridge_health` 会真的打一次 `/context-hub/health`，所以「文件在但端口打不通」会在开跑前暴露。

无人值守任务需要 `approval: never` 的权限预设。桌面 profile 默认的 `workspace-write` 是 `ask`，会在等审批时挂住；`cordis.patch.yml` 里加一个 `unattended`（`workspace-write` + `never`）即可，桥会按 `sandbox` + `approval` 反查预设名。

**触发与级联**：`wizz-a` 按任务 JSON 的 `trigger.cron`（当前 `0 10 * * *`）在 Asia/Shanghai 触发，`misfireMinutes` 窗口内按 `runKey` 幂等补跑；A/B 结束后按 `wizz-a → wizz-b → wizz-c` 级联。

级联只由「下一环有没有活」决定：B 需要 `todo > 0`，C 需要 `c_pending > 0`。所以 B 因 `todo=0` 判 `skipped` 时链条不会断——只要 `c_pending` 还有积压（B 早先成功、C 失败过），C 仍会被拉起。

`enabled` 只决定「定时器自己会不会触发」，不决定一条已经开始流水线的走向：手动 `run` 默认会继续顺流走完 A→B→C，要只跑一环就 `--no-follow`（API 里 `follow: false`）。显式 `pause`（`paused_reason` 非空）是唯一例外——级联会停在被暂停的那一环。

**可靠性**：

- 基础设施失败（硬超时、停滞、宿主/桥不可达、非零退出且无结果契约）自动重试一次；B 重试前把 `doing` 卡退回 `todo`，C 重试前调用 `wizz-c-state release`。
- DB 租约带心跳。**只要持锁进程还活着就不会被抢**，`expires_at` 只用于崩溃恢复；任务跑多久都不会因为越过 TTL 而并发第二份。
- 宿主轮询失败会**先取消远端会话再判失败**，避免 30 分钟后重试时另起一个会话、而第一个还在写图。
- 守护进程重启时把残留 `running` 运行标记失败、回收死租约、恢复待重试定时器，并对每个崩溃的运行发一次 P1 通知。
- 停机（SIGTERM/SIGINT）会中止在飞运行并等待它们收尾，宿主里的轮次会被 cancel，不会留在桌面里继续跑。
- 越界写用**白名单**判定：只有 `ideas/`、`materials/`、`worlds/`、`works/` 可以在运行期间改动；其余路径（仓库根、`docs/`、`skills/`、`tools/`…）任何新增改动都会触发 P1。比较的是路径集合，rename 取新路径，中文/空格路径不会被转义成假路径。

**通知是旁路**：飞书凭据缺失、网络失败、SDK 抛错都只记日志，不改变运行状态、不阻断级联。失败卡的去重记录在发送成功后才算数，配置错了不会被当成「已通知过」。

**死手告警**（飞书，带去重窗口）：A 在 11:30 前没有 ok/partial/running；C 在 21:00 前未完成；A 完成后 30 分钟 B 仍未启动且队列有 todo。

### 控制面 API 与 CLI

```bash
npm run automation -- status
npm run automation -- runs --limit 20
npm run automation -- logs 'wizz-c@2026-11-26T10:00'
npm run automation -- run wizz-a [--dry-run] [--no-follow]
npm run automation -- pause wizz-a [--reason '...'] [--kill]
npm run automation -- resume wizz-a
npm run automation -- retry 'wizz-a@...'
npm run automation -- doctor [--live] [--feishu]
```

CLI 走 HTTP，默认目标 `http://127.0.0.1:${CONTEXT_HUB_PORT:-4321}`，可用 `CONTEXT_HUB_URL` 覆盖。POST 需要 `X-Automation-Token`，值取 `CONTEXT_HUB_AUTOMATION_TOKEN`，未配置时控制面返回 503。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/automation/status` | 任务、租约、队列、L2 预检、最近运行/告警 |
| GET | `/api/automation/runs?limit=N` | 运行账本，含会话/单元状态 |
| GET | `/api/automation/runs/:runKey/logs` | 运行日志与 `envelope/stdout/stderr/result` |
| POST | `/api/automation/run` | `{task, dryRun?, follow?}`（`follow` 默认 `true`） |
| POST | `/api/automation/pause` | `{task, reason?, kill?}` |
| POST | `/api/automation/resume` | `{task}` |
| POST | `/api/automation/retry` | `{runKey}` |
| POST | `/api/automation/doctor` | `{liveImageCheck?, feishuTest?}` |
| GET | `/healthz` | 存活探针，绕过「无工作区」限制 |

GET 接口只读且未鉴权（服务仅绑定 loopback）；POST 必须带 token。`doctor --live` 会消耗 1 次出图额度，只在手动排障时使用。

### 运行产物与日志

- 每个 run：`data/runs/<runKey>/summary.json`。
- 每个 run 一个单元目录（`a-run-xxxxxx` / `b-run-xxxxxx` / `c-run-xxxxxx`），里面有 `envelope.md`（完整 prompt）、`stdout.jsonl`（宿主轮询快照）、`stderr.log`、`result.json`。
- `data/runs/`、pidfile、SQLite `-shm/-wal` 已被 `.gitignore` 忽略。
- 失败汇总由守护进程单点写入工作区的 `materials/_failures.log` 与 `materials/_pending_issue.md`，Agent 不直接写这两个文件。

### 已知简化

- 调度器当前按 Wizz A/B/C 写死流水线（工具脚本名、`restraint/overload` 卡片、级联顺序），任务 JSON 不是通用的插件式任务 DSL；新增任务需要改代码。
- 宿主执行依赖桌面 App 在线。App 退出后任务不会开始（`desktop` 会尝试唤醒一次，`auto` 在发现文件不存在时回退 headless）。同一 `DSH_HOME` 不要同时跑桌面端和 `dsh web`，两边都会写会话库与工作区表。
- 桥的 `addDirs` 是**按会话的运行时授权**（`sandboxPolicy.registerWritableRoot`），宿主重启或会话恢复后不保留；`sandbox: workspace-write` 下不登记就写不了工作区外的 materials 目录。
- 桥只认共享密钥，不按调用方做目录白名单：拿到密钥的本机进程可以让无人值守会话写任意目录。同机同用户威胁模型下可接受，但不要把密钥放进共享脚本。
- 宿主执行的 `stdout.jsonl` 是轮询快照（`submitted` / `poll` / `answered`），不是逐 token 流；真正的过程在会话里。
- 硬超时只按任务级配置（A 60 / B 60 / C 120 分钟）。长任务不会被误杀，但真正挂死也只能等硬超时收尾。
- cron 只在 `misfireMinutes` 窗口内补跑；守护进程整个窗口都不在线时，当天 A 不会自动补，靠死手告警或人工 `run`。
- `getStatusSnapshot` 的本地预检（`df`、读 auth 文件）缓存 60 秒，看板高频刷新不会反复探测；真正开跑前仍会重新执行预检。

## 数据模型

`projects → workspaces → runs → documents` 是主链；`items` 是跨报告共享的来源/排重条目，`links` 保存文档级引用，`memory_snapshots` 记录原始 memory 与 compact memory 的体积和哈希。

`workspaces.slug` 是**全局唯一**（`UNIQUE(slug)`），不是 `(project_id, slug)`：workspace 是「一个定时任务/数据目录」的身份，import 按 slug upsert。同名 slug 会改挂到新 project 下，而不是在同一 project 里建第二条。

自动化调度使用 5 张独立表：`automation_tasks`（任务开关/暂停原因/配置快照）、`automation_runs`（运行账本、重试与日志目录）、`automation_units`（单元级状态、失败节点、产物）、`automation_alerts`（告警记录与去重键）、`automation_leases`（任务租约）。

所有导入记录带有 `source_path` 与 SHA-256。SQLite 文件是可备份、可查询的排重与档案数据源；HTML 是 Agent 负责的呈现层，Context Hub 不负责渲染。

### 数据库初始化与版本

数据库是运行时产物，默认不入库。启动时 `initDatabase()` 只做两件事：

1. **空库**：在一个事务里执行 `schema.sql`，并写入 `PRAGMA user_version = 1`；
2. **非空库**：`user_version` 必须严格等于代码里的 `SCHEMA_VERSION`，否则拒绝启动。

当前不保留旧 schema 兼容：版本不一致时请先导出需要的报告，再删除 `data/context-hub.sqlite` 重新初始化。等第一次需要保留数据的结构变更出现时，再把版本闸升级为按编号执行的迁移；现在不引入迁移表或迁移目录。

## 验证

```bash
npm test
```

真实 MarkItDown 归档集成测试默认跳过；在装有该 CLI 的宿主机上显式传入路径后运行：

```bash
CONTEXT_HUB_ARCHIVE_INTEGRATION=1 \
CONTEXT_HUB_ARCHIVE_PYTHON=/path/to/venv/bin/python \
CONTEXT_HUB_ARCHIVE_CLI=/path/to/markitdown-obsidian-importer/cli.py \
CONTEXT_HUB_ARCHIVE_PLUGIN_CONFIG="$HOME/Documents/Obsidian Vault/.obsidian/plugins/markitdown-importer/data.json" \
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
node --experimental-strip-types /Volumes/BillionSteps/GitHub/new_shit/context-hub/src/cli.ts validate-report \
  --file "$HOME/Documents/优化是个好事/ai-trending-YYYY-MM-DD.html" \
  --selection /private/tmp/ai-trending-current-selection.json
```

该命令检查选中仓库、顺序、证据链接/日期、段落与结构。通过后使用既有 MarkItDown Importer CLI 与 Vault 的默认 before Hook（排名规范化）转换；不绕过 Hook，不原地预处理源 HTML。该 CLI 会额外生成文件名 h1，归档验收允许它存在；项目保持 Markdown `###` 和五段加粗标签。

转换后沿用 automation 约定整理 `created`、`summary`、具体技术 tags，保留 `source_file`、`converted_at`、`converter`，再验收实际 Markdown：

```bash
node --experimental-strip-types /Volumes/BillionSteps/GitHub/new_shit/context-hub/src/cli.ts validate-report \
  --file "$HOME/Documents/优化是个好事/ai-trending-YYYY-MM-DD.html" \
  --selection /private/tmp/ai-trending-current-selection.json \
  --markdown "~/Documents/Obsidian Vault/项目卷/优化是个好事/AI Trending/ai-trending-YYYY-MM-DD.md"
```

校验器读取真实 Markdown，逐项目核对段落、链接、顺序及 source_file，失败不能声称归档完成。报告中间选项文件在完成后删除；通用校验器与回归测试保留用于后续每日运行。SQLite 中新版 `content_json` 同时保留 `archiveSchema`、项目身份及五段内容，便于稳定读取。
