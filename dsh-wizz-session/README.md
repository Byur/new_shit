# dsh-wizz-session

在 DeepSeek Harness 里给自动化任务一个"开研究会话"的工具：新建一个**独立会话**，把它**挂到调用方会话所在的工作区**（对齐 GUI New Session 的第一选择），让它在侧边栏里出现在该工作区分组下，然后立刻投递第一条任务；可选地给这个会话指定**仅可查看 / 工作区内修改 / 完全权限**三档权限。

## 为什么需要它

- `dsh headless` 创建的会话没有工作区归属，只会落在侧边栏的「未分组」；
- App 的 HTTP API 由每进程随机生成的 launch token 保护，外部进程拿不到；
- 插件运行在 App 进程内，可以直接调用 GUI 用的 `sessionController.create({ workspaceId })`，从而得到一个真正的工作区成员。

## 工作区可见性：与 GUI New Session 对齐

GUI 的"新建会话"只有一条 Host 路径：客户端 `session.create({ workspaceId })` → `SessionCommandController.create` → `agents.createSession`（在 `agent/created` 上先把权限默认值写进日志）→ `workspace.attachSession`（校验会话 header 的 cwd realpath 等于工作区路径，并把 id 前插进 `sessionIds`）。侧边栏随后 join 两个 Host 投影：

1. `workspaceController.follow()`：工作区存储变更（`domain/changed`）推 `upsert`，`attachSession` 一写存储就推；
2. `session.list` + `api-session/added|status` 增量：行里的 `blank`、`running`、`title` 等。

所以进程内插件调 `sessionController.create({ workspaceId })` 与 GUI 走的是**同一个 Host 方法**，不需要重启、不需要额外广播；GUI 独有的只有客户端本地状态（乐观 placeholder、把新会话 retain 成主视图），Host 侧既做不到也不需要。

实现上因此对齐了三点：

- **默认继承工作区**：省略 `workspacePath` 时按 `workspaceRegistry.list().find(w => w.sessionIds.includes(调用方 sessionId))` 找调用方工作区（Host 自己也是这个写法），找不到再按调用方 cwd 的 `resolveByPath` 回退——后者覆盖了"会话在项目目录里跑、但还没被记账进该工作区"的情况（例如 `dsh headless` 建的会话）。GUI 的选择顺序其实是"显式工作区 → 当前会话工作区 → 最近活跃工作区"，后两者是客户端本地状态，Host 插件读不到，所以插件用调用方工作区 + cwd 这一条宿主侧可得的最接近规则；两者都没有时才落「未分组」。`ungrouped: true` 强制未分组。
- **权限先校验后建会话**：非法档位在创建之前就报错，不会留下默认档的会话。
- **失败可回收**：建好之后任何一步失败，都会**尝试**归档（宿主有 `workspaceController` 时）并从工作区摘除，尽量不留下半成品行；两步都是 best-effort。

两个**客户端本地限制**（Host 无法改变）：目标工作区分组若被用户折叠，行在组内但不渲染，需要展开分组；新会话不会被自动切到主视图，需要点一下打开。另外空白会话在被打开前本来就只在"当前那一行"显示，本插件在创建后立刻投递首条消息，所以这段空白窗口基本不可见。

## 提供的工具

### `session_spawn`

| 参数 | 必填 | 说明 |
|---|---|---|
| `prompt` | ✅ | 新会话的第一条任务，必须自包含（新会话看不到当前对话） |
| `workspacePath` | | 已注册工作区的绝对路径。省略时**继承调用方工作区**（GUI New Session 的第一选择）；路径写错直接报错，不会建会话 |
| `ungrouped` | | `true` 时强制不归属任何工作区（落在侧边栏「未分组」）。宿主只在**从未初始化过**的 profile 首次启动时按 cwd 做一次历史分组；已初始化的 profile 不会在运行中把未归属会话自动塞进工作区，所以 `ungrouped` 是持久的 |
| `permission` | | 新会话权限：`read-only`（仅可查看）、`workspace-write`（工作区内修改）、`danger-full-access`（完全权限）；省略则用宿主新会话默认档 |
| `title` | | 固定标题；省略时取 prompt 的前 6 个词、最多 40 字节 |
| `preset` | | 新会话使用的 **agent preset**；省略时继承调用方会话的 preset（与上面的 `permission` 是两件事） |

返回 `sessionId`、`title`、`workspacePath`/`workspaceId`/`workspaceTitle`、`cwd`、`preset`、`permission`/`permissionLabel`（实际生效档位）、`sinceSeq`。调用**不等待**新会话跑完。

### 权限：三档 preset

DSH 的"权限"是 **sandbox mode + approval policy** 两个执行旋钮的具名组合，桌面 profile 已配好三档，与 GUI 权限选择器一一对应：

| `permission` | sandbox | approval | GUI 文案 |
|---|---|---|---|
| `read-only` | read-only | ask | 仅可查看 |
| `workspace-write` | workspace-write | ask | 工作区内修改 |
| `danger-full-access` | danger-full-access | never | 完全权限 |

机制上有两个必须知道的事实：

- **没有创建期参数**。`session.create` 只接受 `workspaceId` / `cwd` / `sessionId` / `agentPreset`，wire schema 还是 `additionalProperties: false`；新会话的权限默认值由宿主在 `agent/created` 上先写进日志。
- **覆盖只能走权限预设服务**。本插件在 create 之后、首条消息之前调用 `permissionPresets.set()`（GUI 的 `/permission` 命令走的是同一个服务的 `apply()`）：追加 `permission/preset`，再按差值追加 `sandbox/mode`、`approval/policy`。投影按类型 last-wins，重启 replay 后仍然生效，GUI 的权限控件也会显示新档位。`dsh headless --permission-mode` 用的就是同一条路径。

另外：

- 档位名在 `ctx.get('permissionPresets').names` 之外会**硬报错并列出可用档位**，不会退化成直接追加 knob 事件——那样没有 preset 身份，GUI 会显示成 `custom`，等于绕过部署的权限目录。
- `read-only` / `workspace-write` 的 approval 是 `ask`：**审批没有 answerer 时直接失败（fail closed），有桌面 answerer 但没人点时会一直等**——两种情况都会让无人值守的扇出卡住或中止。真正全自动的扇出请用 `danger-full-access`（approval=never，审批请求被立即拒绝而不是排队）。
- 用 `danger-full-access` 时**没有** GUI 选它时那道风险确认弹窗——这对本机受信自动化是有意的（插件本来就不弹审批），但意味着调用方必须自己确认任务来源可信。
- `permission` 接受中文别名（仅可查看 / 工作区内修改 / 完全权限）和短别名（view / write / full）并规范化。

### `session_send`

| 参数 | 必填 | 说明 |
|---|---|---|
| `sessionId` | ✅ | 目标会话 id（`session_spawn` 的返回值） |
| `message` | ✅ | 追加的消息，必须自包含 |

给已有会话追加消息；会话若已休眠（跑完首轮后 agent 被回收），会先经 `sessionController.resolveAgent` **唤醒并挂回它记录的 preset / 模型**，再投递消息。不能发给调用方自己。返回 `delivered` 与 `resumed`。

### `session_wait`

| 参数 | 必填 | 说明 |
|---|---|---|
| `sessionId` | ✅ | 目标会话 id |
| `sinceSeq` | | `session_spawn` / `session_send` 返回的日志偏移；省略则等待「本次调用之后开始的下一轮」 |
| `timeoutMs` | | 等待预算，默认 60s、上限 300s |

**只读**：不会唤醒、重发或打断目标会话。它等待「`turn/start` 的 seq ≥ sinceSeq 且已 `turn/end`」的那一轮，返回该轮最后一条 `assistant/message` 的文本。

- 发送时已经在跑的那一轮会被**跳过**——那条消息不可能在它里面，跳过才能答对；
- 超时不算失败：返回 `status: "timeout"`、`running: true`、`lastSeq`，用同一个 `sinceSeq` 再查即可；
- 目标休眠（进程里没有 live agent）时走只读持久化句柄，读到已结束的轮次就直接返回，否则返回 `status: "idle"`；
- 返回结构：`{sessionId, status: answered|timeout|idle, answer?, turn?, turnEndKind?, seq?, lastSeq?, running, elapsedMs}`。

`session_spawn` / `session_send` 现在都会返回 `sinceSeq`（投递前的日志偏移），可直接传给 `session_wait`：

```
spawn  → { sessionId: "session-…", sinceSeq: 4 }
wait   → session_wait({ sessionId, sinceSeq: 4, timeoutMs: 120000 })
       → "答案：140  推导：12 × 12 = 144，144 − 4 = 140"
```

### `session_archive`

| 参数 | 必填 | 说明 |
|---|---|---|
| `sessionIds` | ✅ | 要归档的会话 id 列表（去重） |
| `stopActivity` | | 归档前是否停止正在跑的轮次，默认 `true` |

把会话收进宿主全局归档集：**从侧边栏工作区分组里消失，日志/投影/物料一律不删**，可在 App 的归档筛选里恢复。拒绝归档调用方自己；单条失败不影响其余条目，逐条返回 `archived` / `failed`。

> 为什么是归档而不是删除：DSH 的持久化层**没有删除 API**（其 README 明确写 *"Nothing deletes session files … the seam has no deletion API"*）。真删除只能外部删文件 + 清投影缓存 + 改工作区记账，属于不受支持的操作；归档是唯一安全且可逆的“回收”。

行为细节：

- 工作区路径、权限档位都先校验、后建会话：写错路径或非法权限时不会留下任何会话。
- 首条消息投递失败，或权限切换失败时，会**尝试**归档（宿主有 `workspaceController` 时）并从工作区摘除刚创建的会话（归档可逆、日志保留），错误信息里带上 sessionId，尽量不在侧边栏留下半成品。创建本身在 attach 阶段失败时，也会尝试回收错误里点名的新会话。
- 标题写入失败不影响建会话（标题只是可读性）。注意：显式写入标题会 pin 住标题，从而**阻止**宿主在首条消息后自动生成标题；这是为确定性做的有意取舍。
- 不弹审批：这是给本机受信自动化用的工具。

## 安装

插件是零依赖的纯 ESM 包，不需要构建。装进正在使用的 profile（桌面版由 App 内的插件管理器管理）：

```
plugin_manager install_bundle target=/Volumes/Project/new_shit/dsh-wizz-session
```

也可以手动安装：把本目录放进 `~/.dsh/profiles/<profile>/node_modules/dsh-wizz-session`，并把包名加入该 profile `package.json` 的 `dsh.profile.bundles` 数组，重启 App。

## 测试

```
node --test test/index.test.mjs
```

单测使用假 ctx（44 个用例），覆盖：注册、带工作区创建、省略 workspacePath 继承调用方工作区、cwd 回退、未分组与 `ungrouped:true` 覆盖、错误类型参数拒绝、未知路径拒绝、空 prompt 拒绝、标题失败不影响建会话、投递/权限失败回滚（归档 + detach，含无 workspaceController 的宿主与未分组会话）、attach 失败后的会话回收、标题与 preset 解析、三档权限与中文/短别名规范化、非法档位与宿主缺 `permissionPresets` 时在创建前失败、权限切换在首条消息与 sinceSeq 之前、生效档位如实上报，以及 `session_send` 的投递/唤醒/自指拒绝/不可达/空消息、`session_wait` 的取答案/跳过在跑轮次/超时/休眠会话/省略 sinceSeq/自指拒绝、`session_archive` 的批量归档/逐条失败/自指拒绝。

## 实测记录

### 2026-11-20：工作区继承 + 三档权限（v0.5.0，DSH 0.2.2-rc.1）

现场在运行中的桌面 App 里（通过插件管理器触发一次 profile 重组加载新代码）做了三次真实 spawn，证据都来自会话日志与 `workspace.json`，不是手抄的结论：

**A. 省略 workspacePath → 继承调用方工作区 + `permission: read-only`**

- 返回 `session-310e123b…`、`workspacePath=/Volumes/Project/new_shit`、`workspaceTitle=new_shit`、`permission=read-only`、`sinceSeq=6`；
- `~/.dsh/storages/workspace.json` 中该工作区 `sessionIds[0]` 就是它；
- 会话日志（zstd jsonl 解帧后）事件序列：`seq0 permission/preset workspace-write`、`seq1 sandbox/mode workspace-write`、`seq2 approval/policy ask`（宿主创建时先 pin 新会话默认档）→ `seq3 session/title` → `seq4 permission/preset read-only`、`seq5 sandbox/mode read-only`（approval 未变化，因此没有多余事件）→ `seq6` 首条消息 → `seq7 turn/start`；
- 该会话第一轮请求的 runtime context 明确写着 `Current DSH file policy: read-only`，`turn 1 completed`，`session_wait(sinceSeq=6)` 拿回 `READ-ONLY-OK`。

**B. `ungrouped: true` + `permission: 完全权限`（中文别名）**

- 返回 `session-895ce3e5…`、无 workspace 字段、`permission=danger-full-access`、`sinceSeq=7`；
- 遍历 `workspace.json` 全部工作区，确认它没有被记入任何 `sessionIds`；
- 日志：`seq4 permission/preset danger-full-access`、`seq5 sandbox/mode danger-full-access`、`seq6 approval/policy never`；runtime context 为 `Current DSH file policy: danger-full-access`；`turn 1 completed`，答案为 `FULL-OK`。

**C. 既有行为回归**：显式 `workspacePath` 的 spawn（`session-9519644b…`）仍按原路径进工作区、默认权限事件为 `workspace-write / ask`、`turn 1 completed`。

验证完成后三个测试会话都用 `session_archive` 归档（日志保留、可在 App 归档筛选里恢复）。

### 2026-11-06：基础能力

在 DSH `0.2.2-rc.1` 桌面 profile 上完成两次真实冒烟：

**session_spawn**

1. 返回 `session-f9b1d505-…`；
2. `~/.dsh/storages/workspace.json` 中该工作区的 `sessionIds` 从 15 条变为 16 条，且新会话排在首位；
3. 投影缓存里标题为「【验证】session_spawn 冒烟3」、preset 继承 `standard`、`turnBoundary.lastTurn = 1`（新会话确实跑完了一轮）。

**session_send**

对上面同一个会话追加一条消息后，投影缓存的 `turnBoundary.lastTurn` 从 1 变为 2，`lastStepBoundary` 推进到新的 `seq` —— 消息被接受并触发了新一轮。

**session_wait**

2026-11-06 22:3x 现场验证：`session_spawn` 建会话 `session-ac81ff52…` 并返回 `sinceSeq=4`；`session_wait({sessionId, sinceSeq:4, timeoutMs:120000})` 返回 `turn 1, completed`，答案为「140 / 12 × 12 = 144，144 − 4 = 140」——即该 spawn 那条消息的真实回答。

## 兼容性

- 只用 `node:` 内建模块，没有依赖、没有 `peerDependencies`，因此不受插件市场的 DSH 版本兼容闸门限制；
- 依赖的宿主服务：`tools`、`agents`、`sessionController`、`workspaceRegistry`、`sessionTitle`（可选 `sessionProjections`）；`session_spawn` 额外用 `permissionPresets` 设置权限（可选——省略 `permission` 时不需要它，显式指定但宿主没有该服务会明确报错）；`session_send` 额外用到 `sessionController.resolveAgent` 来唤醒休眠会话；`session_wait` 用 `sessionPersistence` 读冷日志；`session_archive` 与失败回滚用 `workspaceController.archiveSession`；
- 一个已经踩过的坑：宿主 `sessionController.prompt(request, signal)` 的**第二个参数是调用方取消信号**，消息来源由服务层自己构造；把它当成消息 source 传入会报 `signal.throwIfAborted is not a function`，且新会话已经建好、只会投递失败。本插件按正确签名实现，并在投递失败时回滚工作区归属。
- 已验证 DSH `0.2.2-rc.1` 桌面 profile。
