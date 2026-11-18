# dsh-wizz-session

在 DeepSeek Harness 里给自动化任务一个"开研究会话"的工具：新建一个**独立会话**，把它**挂到指定工作区**，让它在侧边栏里出现在该工作区分组下，然后立刻投递第一条任务。

## 为什么需要它

- `dsh headless` 创建的会话没有工作区归属，只会落在侧边栏的「未分组」；
- App 的 HTTP API 由每进程随机生成的 launch token 保护，外部进程拿不到；
- 插件运行在 App 进程内，可以直接调用 GUI 用的 `sessionController.create({ workspaceId })`，从而得到一个真正的工作区成员。

## 提供的工具

### `session_spawn`

| 参数 | 必填 | 说明 |
|---|---|---|
| `prompt` | ✅ | 新会话的第一条任务，必须自包含（新会话看不到当前对话） |
| `workspacePath` | | 已注册工作区的绝对路径。传入则会话归属该工作区；省略则为「未分组」 |
| `title` | | 固定标题；省略时取 prompt 的前 6 个词、最多 40 字节 |
| `preset` | | 新会话使用的 agent preset；省略时继承调用方会话的 preset |

返回 `sessionId`、`title`、`workspacePath`/`workspaceId`、`cwd`、`preset`。调用**不等待**新会话跑完。

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

- 工作区路径先解析、后建会话：路径写错时不会留下任何会话。
- 首条消息投递失败时，会把刚创建的空会话从工作区摘除，错误信息里带上 sessionId。
- 标题写入失败不影响建会话（标题只是可读性）。
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

单测使用假 ctx（27 个用例），覆盖：注册、带工作区创建、无工作区创建、未知路径拒绝、空 prompt 拒绝、投递失败回滚、标题与 preset 解析、`session_send` 的投递/唤醒/自指拒绝/不可达/空消息、`session_wait` 的取答案/跳过在跑轮次/超时/休眠会话/省略 sinceSeq/自指拒绝，以及 `session_archive` 的批量归档、逐条失败与自指拒绝。

## 实测记录

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
- 依赖的宿主服务：`tools`、`agents`、`sessionController`、`workspaceRegistry`、`sessionTitle`（可选 `sessionProjections`）；`session_send` 额外用到 `sessionController.resolveAgent` 来唤醒休眠会话；`session_wait` 用 `sessionPersistence` 读冷日志；`session_archive` 用 `workspaceController.archiveSession`；
- 一个已经踩过的坑：宿主 `sessionController.prompt(request, signal)` 的**第二个参数是调用方取消信号**，消息来源由服务层自己构造；把它当成消息 source 传入会报 `signal.throwIfAborted is not a function`，且新会话已经建好、只会投递失败。本插件按正确签名实现，并在投递失败时回滚工作区归属。
- 已验证 DSH `0.2.2-rc.1` 桌面 profile。
