# dsh-feishu-agent

把私人 Agent 接进飞书**私聊**的 DSH 宿主内插件：飞书长连接把消息投进 **DSH Desktop 宿主里的一条会话**（按 Workspace 归属），回答以卡片回到原消息，Agent 的反问与工具审批可以在飞书里作答，定时任务可以主动联系你。

对应方案：`personal-agent-feishu-dsh-v0.4.md`（仓库外，随聊天交付）。

## 它解决什么

- **会话归属**：每条飞书私聊绑定到自己配置的 Workspace 下的一条 DSH Session，Desktop 侧边栏里出现在对应分组——工作会话和私人会话不会混在「未分组」里。
- **回答就在飞书里**：回答卡回复在你那条消息上，状态从「排队中 → 处理中 → 已完成/已停止/失败」；带「停止」「撤回」按钮。
- **反问与审批**：Agent 调 `ask_user_question` 时飞书弹选项卡；工具要授权时飞书弹「允许一次 / 拒绝」。**只接管飞书发起的那一轮**，桌面端发起的轮次照旧弹在桌面。
- **主动联系**：配置里写定时任务，到点投喂一条消息，回答作为新卡片发出。
- **不需要公网**：飞书长连接是出站连接，不要公网 IP、域名、证书、反向代理。

## 边界（先读这段）

- **Agent 在线 = DSH Desktop 在跑**。合盖休眠、退出 App、升级期间都不可用；飞书事件在约 7.5 小时内会重推，恢复后能补，但不保证实时。
- **只处理私聊**，且只服务 owner 一个人；群聊消息目前直接忽略。
- **一个飞书自建应用只连一条长连接**。不要和别的飞书插件共用同一个 App，也不要在两台机器上同时跑。
- **同一 `DSH_HOME` 只能有一个 host**：不要同时开 Desktop 和 `dsh web`。
- 飞书卡片上限 30KB、回答正文超过 8000 字会被截断并提示去 Desktop 看；发送限频 5 QPS/人，插件已经做了节流。

## 前置条件

- DSH `0.2.2-rc.1`（与 Desktop 一致）。插件只依赖 `sessionController`、`workspaceRegistry`、`agents` 三个宿主服务。
- 一个**企业自建应用**（飞书 / Lark），开启机器人能力。
- 想控制的那些目录已经是 DSH 的 Workspace（或让插件自动注册：它会调 `workspaceRegistry.create`）。

## 第一步：飞书开发者后台

在 <https://open.feishu.cn/app> 建一个**企业自建应用**，然后：

1. **添加应用能力**：开启「机器人」。
2. **事件与回调**：
   - 订阅方式选「**使用长连接接收事件**」；
   - 添加事件 `im.message.receive_v1`（只加 v2，不要同时加 v1）；
   - 「**回调配置**」的订阅方式也选「使用长连接接收回调」，添加 `card.action.trigger`（只加新版，不要加 `card.action.trigger_v1`）。
3. **权限管理**（最小集）：
   - `im:message.p2p_msg:readonly` —— 接收私聊消息
   - `im:message:send_as_bot` —— 以机器人身份发消息
   - 想在消息里带图片/文件再加 `im:message:readonly`
4. **可用范围**：只勾自己（个人 Agent）。给某人发消息要求他在可用范围内，否则报 `230013`；用户关闭机器人消息则 `230053`。
5. **创建版本并发布**。事件、回调、权限的改动都要重新发布才生效。
6. 抄下「凭证与基础信息」里的 **App ID** 与 **App Secret**。

> 长连接是集群模式、不广播：同一 App 开两条连接，事件会被随机分给其中一条。开发时请另建一个应用。

## 第二步：装进 Desktop profile

```bash
cd /Volumes/Project/new_shit/dsh-feishu-agent
npm install                     # 装 @larksuiteoapi/node-sdk
dsh plugin --profile desktop add link:/Volumes/Project/new_shit/dsh-feishu-agent
```

装完检查 `~/.dsh/profiles/desktop/package.json`：

- `dependencies` 里有 `"dsh-feishu-agent": "link:..."`；
- `dsh.profile.bundles` 里有 `"dsh-feishu-agent"`。

如果 pnpm 报 `ERR_PNPM_IGNORED_BUILDS: protobufjs`（lark SDK 的传递依赖带 postinstall），在 `~/.dsh/profiles/desktop/pnpm-workspace.yaml` 加：

```yaml
allowBuilds:
  protobufjs: true
```

然后重启 DSH Desktop。

## 第三步：配置

配置写在 `~/.dsh/profiles/desktop/cordis.patch.yml`（**按 id 打补丁**，不要重复 insert 同一个 id）：

```yaml
- id: feishu-agent
  config:
    # 可选：预置 owner（open_id）。留空则第一条私聊的发送者自动成为 owner。
    ownerOpenId: 'ou_xxxxxxxxxxxxxxxxxxxx'
    # 每个飞书私聊（chat_id）落到哪个 Workspace；没在这里列出的 chat 一律拒绝。
    chats:
      'oc_你的私聊_chat_id':
        workspacePath: /Volumes/Project/new_shit
        titlePrefix: '[私人]'
        permissionPreset: workspace-write   # read-only / workspace-write / danger-full-access
        agentPreset: standard
      'oc_工作私聊_chat_id':
        workspacePath: /Volumes/Ksproject/xxx
        titlePrefix: '[工作]'
        permissionPreset: read-only
    # 可选：定时任务（at 或 everySeconds 二选一，everySeconds ≥ 60）
    schedules:
      - id: morning
        chatId: 'oc_你的私聊_chat_id'
        prompt: 汇总今天的待办，按优先级列出来
        at: '2026-11-15T09:00:00+08:00'
      - id: hourly
        chatId: 'oc_你的私聊_chat_id'
        prompt: 看一眼构建队列，有失败就说
        everySeconds: 3600
```

凭据（App ID / Secret）二选一：

- **环境变量**：`DSH_FEISHU_AGENT_APP_ID` / `DSH_FEISHU_AGENT_APP_SECRET`（Desktop 从登录项启动时，用 launchctl 或 `~/.zprofile` 注入）；
- **插件 config**：`appId` / `appSecret` 两个字段（会写进 profile 的插件配置，注意别提交到仓库）。

> 怎么拿 `chat_id`：先给机器人发一条消息，插件日志里会打印 `收到事件 im.message.receive_v1 ... chat=oc_xxx`；或者暂不配置 owner，让插件把第一条私聊的 open_id 和 chat_id 记进状态文件（`~/.dsh/feishu-agent/state.json`）。

状态目录默认 `$DSH_HOME/feishu-agent/`，可以用 `DSH_FEISHU_AGENT_STATE_DIR` 覆盖。里面有两个文件：`state.json`（owner、绑定、定时任务）与 `cards.json`（回答卡记账）。

### 本机私有配置

`cordis.patch.yml` 里的 `chats` 只放通用默认值（含 `'*'` 通配工作区），个人 chat_id 与实际目录放在仓库外：

```
~/.dsh/feishu-agent/local-config.json
```

JSON 结构：

```json
{
  "chats": {
    "oc_xxx": {
      "workspacePath": "/path/to/workspace",
      "titlePrefix": "[私人]",
      "permissionPreset": "workspace-write",
      "chatType": "p2p",
      "provider": "codeplan",
      "model": "deepseek/deepseek-v4.1-flash"
    }
  },
  "ownerOpenId": "",
  "cliHome": "/path/to/cli-home",
  "answerConcurrency": 3
}
```

插件启动时用这个文件覆盖 bundle 配置里的同名字段：`chats`（按 chat_id 逐键合并，精确键优先，未命中用 `'*'`）、`ownerOpenId`、`answerConcurrency`、`cliHome`、`cliPath`、`cliProfile`、`cliEnvRefs`、`runTimeoutMs`、`appId`、`appSecret`。飞书凭据的取值顺序是 凭据服务 → 环境变量 → 本机配置 → bundle；`cliHome` 依次取 本机配置 → bundle → `DSH_FEISHU_AGENT_CLI_HOME`。文件缺失或 JSON 解析失败只记日志，插件照常加载；定时任务存在 `state.json`，不从本文件读。改完直接重启 Desktop 生效，不需要同步 profile。

## 第四步：验证

1. 重启 Desktop，日志里应出现：`已订阅 user-questions/request`、`已订阅 approval/request`、`飞书长连接已建立`、`插件已加载（… owner …）`。
2. 飞书里私聊机器人发 `/help`，应收到「可用命令」卡（这一步不建会话）。
3. 发一句普通的话：会先回一张「排队中」卡，然后变成「处理中 → 已完成」；Desktop 的侧边栏对应 Workspace 分组下出现这条会话。
4. 让 Agent 问你一个问题（例如「问我一个问题再继续」），飞书里应弹出选项卡，选完点「提交」，会话继续。
5. 触发一次需要授权的操作，飞书里应弹「允许一次 / 拒绝」。

## 命令

只对 owner 生效，由插件拦截，不消耗模型调用：

| 命令 | 作用 |
|---|---|
| `/new` | 在当前 Workspace 下新建会话并切换绑定 |
| `/switch <会话ID前缀>` | 切到同一 Workspace 里的另一条会话 |
| `/stop` | 停止正在跑的这一轮 |
| `/status` | 看 owner、绑定、工作区、连接状态 |
| `/help` | 命令清单 |

## 故障排查

| 现象 | 先看哪里 |
|---|---|
| 消息没反应 | 日志里有没有 `飞书长连接已建立`；飞书后台的事件订阅是否已发布；是不是另一个进程共用同一个 App |
| 一直「排队中」 | Desktop 端那条会话是否在跑别的轮次；日志里 `已投喂` 之后有没有 `turn` 相关 |
| 回答卡不动 | 日志里 `回答卡更新没发到飞书`；卡片是否超过 30KB（会改成「内容过长」） |
| 反问/审批不弹飞书 | 日志 `这一轮不是飞书发起的，让给桌面端`——只接管飞书发起的轮次 |
| 提示「这个会话没有配置工作区」 | 把该 chat_id 加进配置的 `chats` |
| 重启后绑定消失 | 状态目录是否可写；`state.json` 是否被杀掉（插件卸载时会 flush） |

## 开发

```bash
npm run check   # 语法检查每个模块
npm test        # 36 个离线用例：纯逻辑 + 假宿主/假飞书跑通 apply()
```

测试用 `globalThis.__dshFeishuAgentSdk` 注入飞书 SDK 替身（见 `test/fake-sdk.mjs`），不联网、不要真实凭据。

代码结构：

```
lib/
  index.js                 装配：配置、状态、绑定、长连接、宿主流、waterfall、调度
  common/constants.js      常量与文案上限
  core/text.js             用户文本清洗、命令解析、回答截断
  core/cards.js            卡片 JSON 2.0（回答卡/文字卡/按钮）
  core/store.js            状态 JSON 原子写（tmp+rename），事件去重只在内存
  core/binding.js          chat → Workspace → Session 的绑定与 /new /switch
  core/turns.js            轮次注册表：哪一轮是飞书发起的
  core/scheduler.js        定时任务（at / everySeconds），错过补一次
  feishu/events.js         飞书事件归一化（消息 / 卡片回调）
  feishu/connection.js     长连接（pingTimeout 看门狗、握手超时、重连回调）
  feishu/outbound.js       发消息 / 回复 / 换卡，重试 + 每 chat 串行节流 + uuid 去重
  host/session.js          宿主 sessionController / workspaceRegistry 封装
  host/answer-cards.js     回答卡生命周期与记账
  host/answerer-question.js  user-questions/request 应答
  host/answerer-approval.js  approval/request 应答
  host/services.js         宿主服务取用与错误文案
```

## 已知限制

- 群聊、附件、多模态输入未实现（设计里留了位置）。
- 反问只接「有选项」的题；纯自由文本题让给桌面。
- 卡片更新走 `PATCH /im/v1/messages/:id`（14 天窗口），没有用 cardkit 实体流式更新。
- 插件随 Desktop 生命周期运行；DSH 升级后请先跑一遍 `npm test` 与第四节的验证清单。
