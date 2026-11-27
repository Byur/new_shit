# dsh-feishu-agent

把私人 Agent 接进飞书**私聊**的 DSH 宿主内插件：飞书长连接把消息投进 **DSH Desktop 宿主里的一条会话**（按 Workspace 归属），回答以卡片回到原消息，Agent 的反问与工具审批可以在飞书里作答，定时任务可以主动联系你。

对应方案：`personal-agent-feishu-dsh-v0.4.md`（仓库外，随聊天交付）。

## 它解决什么

- **会话归属**：每条飞书私聊绑定到自己配置的 Workspace 下的一条 DSH Session，Desktop 侧边栏里出现在对应分组——工作会话和私人会话不会混在「未分组」里。
- **回答就在飞书里**：回答卡回复在你那条消息上，状态从「排队中 → 处理中 → 已完成/已停止/失败」；带「停止」「撤回」按钮。
- **图文混排**：回答里写 `![说明](/绝对路径.png)`（或相对工作区的路径），卡片会把图片上传并内嵌在对应位置，前后文字照常排版；单图 ≤10MB，发不出去时退回一行文字说明原因。
- **引用回复**：你引用一条消息（文本、富文本或卡片）再提问时，插件会用 `parent_id` 拉回被引用的那条消息，把它的正文作为 `[引用消息] …` 补进这一轮，模型因此知道你在说哪张图/哪条回答；读不到就照常回答。
- **反问与审批**：Agent 调 `ask_user_question` 时飞书弹选项卡；工具要授权时飞书弹「允许一次 / 拒绝」。**只接管飞书发起的那一轮**，桌面端发起的轮次照旧弹在桌面。这条只在**宿主轮次**生效（见「一轮由谁执行」）：CLI 子进程是独立 DSH 进程，它内部的问与审批到不了宿主。
- **主动联系**：配置里写定时任务，到点投喂一条消息，回答作为新卡片发出。
- **不需要公网**：飞书长连接是出站连接，不要公网 IP、域名、证书、反向代理。

## 边界（先读这段）

- **Agent 在线 = DSH Desktop 在跑**。合盖休眠、退出 App、升级期间都不可用；飞书事件在约 7.5 小时内会重推，恢复后能补，但不保证实时。
- **私聊只服务 owner 一个人**；**群聊默认不接管**：owner 在群里 @ 一次机器人，它会私聊你一张确认卡，点「允许」才接入（可选只读/可写），整个群用一条独立会话。也可以在 `chats` 里预先写 `chatType: group` 跳过确认。默认只有 @ 机器人 才响应，成员白名单用 `allowSenders`（不写就只认 owner）。
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
   - 群聊再加 `im:message.group_at_msg:readonly`（只收 @ 机器人 的消息，配合默认的 `requireMention`）或 `im:message.group_msg:readonly`（收群里所有消息）
   - `im:message:send_as_bot` —— 以机器人身份发消息
   - 想在消息里带图片/文件再加 `im:message:readonly`；**引用回复**也要它（读被引用的那条消息）
4. **可用范围**：只勾自己（个人 Agent）。给某人发消息要求他在可用范围内，否则报 `230013`；用户关闭机器人消息则 `230053`。
5. **创建版本并发布**。事件、回调、权限的改动都要重新发布才生效。
6. 抄下「凭证与基础信息」里的 **App ID** 与 **App Secret**。

> 长连接是集群模式、不广播：同一 App 开两条连接，事件会被随机分给其中一条。开发时请另建一个应用。

## 第二步：装进 Desktop profile

```bash
cd <repo>/dsh-feishu-agent
npm install                     # 装 @larksuiteoapi/node-sdk
dsh plugin --profile desktop add link:<repo>/dsh-feishu-agent
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

真实配置放本机、不进版本库：**仓库根目录的 `.env`**（推荐，和别的工具共用一份）或 **`~/.dsh/feishu-agent/local-config.json`**。插件包目录里的 `.env` 也行，作为独立安装时的兜底。仓库里的 `cordis.patch.yml` 只有通用默认值，没有任何本机路径或 chat_id。

优先级：环境变量（含 `.env`）→ `local-config.json` → bundle 默认值。`local-config.json` 的改动**不用重启**（每条消息前按 mtime 热加载）；`.env` 仍只在启动时读一次。

`.env` 的读取顺序是 **项目根（上游第一个有 `.git` 的目录）→ 插件包目录**，先读到的键赢；真实进程环境变量（launchctl）永远最高。变量名一律用 `FEISHU_AGENT_` 前缀——**不能用 `DSH_`**：dsh 自己禁止项目 `.env` 设置任何 `DSH_*`，会让它启动的 CLI 子进程直接报错退出。插件只接纳 `FEISHU_AGENT_*` 与 `*_API_KEY`（`DEEPSEEK_API_KEY` 这类 provider key 会传给 CLI 子进程），所以根 `.env` 里别的工具密钥（比如 Cloudflare token）不会被带进来。

### 会话归属

最小 `.env`：

```bash
FEISHU_AGENT_OWNER_OPEN_ID=ou_xxxxxxxxxxxxxxxxxxxx
FEISHU_AGENT_DEFAULT_WORKSPACE=/Volumes/BillionSteps/GitHub/new_shit
```

| 变量 | 作用 |
|---|---|
| `FEISHU_AGENT_DEFAULT_WORKSPACE` | 没单独配置的私聊落到的目录，等价 `chats['*'].workspacePath` |
| `FEISHU_AGENT_DEFAULT_TITLE_PREFIX` | 会话标题前缀，默认 `[飞书]` |
| `FEISHU_AGENT_DEFAULT_PERMISSION_PRESET` | `read-only` / `workspace-write` / `danger-full-access` |
| `FEISHU_AGENT_DEFAULT_AGENT_PRESET` | agent 预设，默认 `standard` |
| `FEISHU_AGENT_OWNER_OPEN_ID` | 只认这个账号；留空则由第一条私聊自举 |
| `FEISHU_AGENT_CHATS` | 一行 JSON：`{"oc_xxx":{...}}`，按 chat_id 覆盖默认值 |
| `FEISHU_AGENT_ANSWER_CONCURRENCY` | 同时最多跑几条会话，≥1 的整数，默认 3 |

给某个 chat 单独指到别的目录：

```bash
FEISHU_AGENT_CHATS={"oc_工作私聊":{"workspacePath":"/Volumes/Ksproject/xxx","titlePrefix":"[工作]","permissionPreset":"read-only"}}
```

群聊也可以显式预配置（比确认卡优先，通配项 `'*'` 只给私聊），每条群一个独立会话：

```bash
FEISHU_AGENT_CHATS={"oc_群聊":{"chatType":"group","workspacePath":"/Volumes/Ksproject/xxx","titlePrefix":"[群]","permissionPreset":"read-only","allowSenders":["ou_群友_open_id"]}}
```

- 没预配置的群走动态接入：owner @ 一次 → 私聊收确认卡 → 点「允许」建绑定（存在 `state.json`，不用改文件也不用重启）；目标目录取 `FEISHU_AGENT_GROUP_WORKSPACE`（或本机配置的 `groupWorkspace`）。`FEISHU_AGENT_GROUP_REGISTRATION=off` 可关掉这条路。
- `requireMention` 默认 `true`：群里只有 @ 机器人 才响应，写 `false` 表示群里每条消息都接；
- `allowSenders` 是除 owner 外还允许提问的人；不写就只认 owner；
- 群里 `/new`、`/stop` 这类命令仍然只给 owner；
- 群回答对所有成员可见，`permissionPreset` 建议 `read-only`。

> 一行 JSON；精确 `chat_id` 优先于默认值，写坏了只告警并退回默认值。`chat_id` 在日志里能看到：`收到事件 im.message.receive_v1 ... chat=oc_xxx`。

### 凭据

按优先级从三处取，命中即止：

1. **凭据存储**：引用名 `FEISHU_AGENT_APP_ID` / `FEISHU_AGENT_APP_SECRET`（`$DSH_HOME/.credentials.yaml`）；
2. **环境变量**：`FEISHU_AGENT_APP_ID` / `FEISHU_AGENT_APP_SECRET`；
3. **`.env`**：`cp dsh-feishu-agent/.env.example .env`（放在仓库根），填两行即可。

插件在 `apply()` 开头把项目根与插件包目录的 `.env` 依次读进 `process.env`，**只补没设置的键**，所以 launchctl 注入的真实环境变量永远压得住它；留空的键按「没写」处理。想只读某一个文件，用 `FEISHU_AGENT_ENV_FILE` 指过去。`.env` 已在 `.gitignore` 里，`git status` 看不到。

### 一轮由谁执行

`FEISHU_AGENT_TURN_MODE` 决定这一轮由 **Desktop 宿主**跑还是由 **CLI 子进程**跑：

| 值 | 行为 |
|---|---|
| `auto`（默认） | 先让宿主接：新会话由宿主建、宿主跑；已存在会话由宿主续。宿主在超时内没认领这一轮（说明这个宿主驱动不了），插件会**记住**并改用 CLI，不再每条消息都白等一次 |
| `cli` | 只走 CLI。**桌面端打开同一条会话时会撞写句柄**（`already owned by an active write handle`），界面上打开那条会话也会报错，直到这一轮跑完 |
| `host` | 只走宿主，接不住直接失败（不静默退化；用来确认宿主到底能不能驱动） |

`FEISHU_AGENT_HOST_TURN_TIMEOUT_MS` 是等宿主认领这一轮的时长，默认 8000ms。

**反问与审批只在宿主轮次生效**：插件在宿主的 `user-questions/request` 与 `approval/request` waterfall 上挂应答，只接管「飞书发起且还在跑」的那一轮（`turns.activeTurnOfSession`）。CLI 子进程在自己的进程里问，插件看不到，那一轮会按 CLI 自己的策略处理。

- 反问支持两种形态：**有选项**的题发按钮（每题最多 5 个），**单题自由文本**发一张「需要你回复」的卡，你在这个会话里的下一条普通消息就是答案；多题且含自由文本的批次仍让给桌面端；
- 群聊里的反问/审批卡片一律发到 **owner 私聊**（卡片里带群/工具信息，不摊在群里）；owner 点完结果照常回到群里那条回答卡；
- 审批只有「允许一次 / 拒绝」；
- 这一轮结束或被 `/stop` 时，还挂着的卡片会被标成「已作废」，不会永远吊着。

为什么会有这个开关：一条会话同时只允许一个写者。CLI 子进程跑的时候独占 `session.lock`，你在桌面端点开这条会话就会报错；反过来，桌面端开着时 CLI 也拿不到句柄。让宿主跑就没有这个问题，而且审批/反问天然走桌面端的 seam。

### 意图路由（可选：本地 Qwen 三路由）

接一个本地 Qwen3 分类器，把每条消息先分到三条路由之一，再交给对应执行体。默认关闭，`local-config.json` 里 `router.enabled: true` 即开启（热加载，不用重启）。

**判定顺序是固定的**，越靠前越先命中：

1. **显式命令**：`/note`、`/loc`、`/dsh` 跳过规则与分类器（即使 `enabled: false` 也生效）；
2. **速记模式**：`/note on` 或卡片按钮开启后，窗口内的每条消息直接写入待整理（同样不受 `enabled: false` 影响）；
3. **记事规则（纯规则，不调模型）**：以触发词开头就是「写入待整理」；
4. **本地分类器**：只区分 `dsh` 与 `local`，`obsidian` 不再由分类器产生；
5. **降级**：分类器不可用时直接走 `dsh`，不再等分类超时。

| 路由 | 执行体 | 适合什么 |
|---|---|---|
| `dsh` | DSH 宿主 → `zenmux` / `deepseek/deepseek-v4.1-flash` | 复杂任务：联网检索、读写代码/文件、跑命令、多步分析、整理已有笔记 |
| `local` | DSH 宿主 → `ollama` / `qwen3:8b`（只读） | 简单应答：闲聊、短句翻译、基础概念、简单计算、文字润色 |
| `obsidian` | 直接写入 `obsidian.inboxDir` 下 `YYYY-MM-DD.md` | 速记：明确的「记一下 / 备忘 / 灵感」类碎片记录 |

**记事规则**（命中即写入，不经过分类器）：

触发词分动词型与名词型两类（都可前置「请 / 帮我 / 麻烦」，也支持「突然想到一个点子」式开场）：

| 类型 | 触发词 | 分隔符要求 | 例子 |
|---|---|---|---|
| 动词型 | `收进待整理`、`放到待整理`、`写进待整理`、`加入待整理`、`存待整理`、`记录一下`、`记一下`、`记下来`、`记一笔`、`记住` | 可无分隔符，直接跟正文（也可带冒号、逗号或空白） | `记一下周五交房租` → 写入待整理 |
| 名词型 | `备忘`、`待整理`、`灵感`、`想法`、`点子` | **必须**后接冒号（`:` / `：`）、逗号（`,` / `，`）或换行 | `备忘：交房租`、`想法` 后换行接正文 → 写入；`想法很好`、`待整理里昨天记了什么` → 不写入 |

没有分隔符的名词短语会被当作查询或陈述，不写入待整理。

- **句尾触发词**：也支持把触发词放在句尾，如「这个方法不错，记一下」「明天要交房租，记一下。」——`记一下 / 记下来 / 记一笔 / 记录一下 / 记住 / 备忘 / 备忘一下` 出现在句尾时（可前置「帮我 / 麻烦 / 请」，可后接「吧 / 啊 / 哦 / 呀」与句末标点），触发词之前的正文即为条目；
- **「执行尾巴」例外**：`顺便 / 另外 / 再帮我 / 同时 / 然后 / 顺手` 之后 8 个字内出现动作字（如「顺便查一下」）时，说明你要的是「记完去做」，这条消息按普通任务交给分类器（句尾触发词同样要过这道检查）；
- **「读/查/整理笔记」永远走 `dsh`**：「我待整理里昨天记了什么」「把笔记归档一下」这类请求要读写文件、要远端模型，规则只负责识别，执行体固定是 `dsh`。

**速记模式（连续口述）**：说一句 `/note on`（默认 10 分钟），或在 `/help`、`/status`、写入确认卡上点「开启速记 10 分钟」。窗口内**每条消息**都直接写进待整理，不用再带触发词，也不经过分类器；清噪照常执行。

- 开启后的卡片会显示剩余时间与本次已写入条数，并带「结束速记 / 延长 10 分钟」按钮；`/note status` 随时看状态，`/note off` 提前结束。
- 时长默认 10 分钟，`/note on 30` 可指定 1~120 分钟；「延长」在剩余时间上叠加，总剩余不超过 120 分钟。
- `on`、`off`、`status` 是保留子命令；要记这两个词本身，写成完整句子即可（如 `/note on 这个改动` 会被当成正文）。
- **群聊不启用**：群里的 `/note on` 会被拒绝，确认卡也不放这个入口，避免把群聊全部写进笔记。
- 窗口只存在内存里：**进程重启即失效**，不会在升级后半夜继续往笔记里写。
- 窗口内显式命令仍然优先：`/dsh`、`/loc`、`/note <内容>` 照常按命令执行；引用别条消息时，只有正文为空才用被引用内容当条目（与 `/note` 一致）。
- 速记模式只接管「记」，不接管「查」：窗口内说「待整理里昨天记了什么」「把笔记归档一下」仍按查询走 `dsh`，不会被写进笔记。

**写入前的本地清噪 + 断句（可选）**：`polish.enabled` 打开时，规则拆分后的条目会在写入前过两道处理——先由**确定性规则清噪**，再**只在需要时**让本地 Qwen3 插标点。**不是分点提取，也不是整理**。

- **为什么不再叫「润色」**：实测 `qwen3:8b` 自由删噪声时，8 条真实噪声句只清干净 3 条；提示词里只要写上「含数字 / URL / 英文就只加标点」，整句立刻变保守，清干净率跌到 3/6。更糟的是 `呃 feishu 的卡片标题改成飞书兜底那个方案我觉得还行` 这种句子——模型真删了噪声，却因为改动了字符被判「不忠实」整条退回原文。删噪声是确定性的事，交给不确定的模型两条路都通向「噪声保留」，所以：**规则负责删，模型只负责断句，一个字符都不许改。**
- **第一步：规则清噪（确定性）**：按固定词表从长到短全量删除口头语，再合并重复代词（`我我` → `我`）、修掉删词后留下的空标点、去掉紧邻的重复子句，最后只折叠连续空白（单个半角空格保留）。同输入永远同输出，可逐条单测，误删也能 review。
  - 词表全文（顺序有意义，长词在前，避免 `就是说那个` 被 `就是说` 截断）：`嗯就是那个`、`呃那个就是`、`就是说那个`、`然后那个`、`那个啥`、`就是那个`、`嗯就是`、`呃就是`、`嗯那个`、`呃那个`、`就是说呢`、`就是说`、`因为呢`、`然后呢`、`之类的`、`哼哼`、`嗯嗯`、`呃呃`、`唔唔`、`呃`、`嗯`、`唔`。
  - **空标点清理**：删掉 `嗯` 会让 `嗯，可是` 变成 `，可是`、`不然的话，嗯，不然的话` 变成 `不然的话，，不然的话`，所以删词后依次修四个位置：紧贴其它标点的逗号、重复标点、句末标点之后的逗号、句首标点。
  - **紧邻重复子句**：语音重启会造成 `最近那个GPT，最近那个GPT，` / `不然的话，嗯，不然的话，` 这样的相邻重复，规则会丢掉后一个（连同它的后缀标点）。只处理**紧邻**重复：`我开了那个暖气` 与 `把那个暖气关了` 语义相关但不同，两者都保留。
  - **明确不删**四种：裸 `那个`（`那个报错` / `最近那个GPT` / `把那个暖气关了` 里是指示词）、裸 `然后`（`先跑测试然后提交` / `然后现在就感觉` 里是顺序连接）、`对呀`（可能是真实回答，不是接话语气词）、`啊`（`好啊` 是语气，不是填充）。
- **触发条件只有两条**，与「规则真的删得掉东西」严格对齐：命中上面的噪声词表，或原文 24 字以上却完全没有标点。干净笔记直接写文件，**0ms**、不碰模型；`先跑测试然后提交` 这类删不动的句子也不会被误触发。
- **第二步：模型只插标点**：去噪后整段仍然没有任何标点时，才把文本交给本地 `qwen3:8b`，提示词只允许插入标点、调整空白。去噪后原文本来就有标点（如 `呃明天上午十点开会，记得带合同。`）就直接落盘，不花那一次 1 秒级推理。
- **校验（两道都过才采用模型输出）**：
  1. **字符全等**：输出与输入去掉标点与空白后必须完全相同；多一个字、少一个字、换一个字、换顺序都拒绝；
  2. **事实 token 逐字逐序**：`qwen3:8b` 的冒号、URL 的 `://` 与 `-` 都算事实本身。字符全等看不出 `qwen3:8b` → `qwen3 8b` 这类改动，所以必须额外比 token。
- **长度与条数上限只限制模型**：`maxChars` / `maxItems` 超限时跳过的是**模型断句**，规则清噪照做——一条 300 字以上的语音笔记仍会删掉全部口头语，只是不再请模型插标点（`reason: 'too-long'`）。规则是 O(n) 的纯字符串操作，没有理由被模型的成本上限挡住。
- **两级兜底**：模型不可用、超时、报错、条目数不对、输出被改字——任一失败都落盘**去噪后的文本**，绝不退回带噪原文。最差情况下用户拿到的也只是一份没断句的干净文本。
- **模型固定 `qwen3:8b` + few-shot**：提示词带两条「只插标点」的真实示例。不用 1.7B 是因为实测它会把 few-shot 示例的答案直接抄成输出，属于灾难性替换。
- **已知限制**：不做错别字纠正（`很行` 不会变成 `银行`）。实测 8B 在「一个字都不许改」的明确要求下 6/6 一字未改；即使改了也会被字符全等校验拒绝。错字原样落盘，靠卡片上的「撤销写入」或手工修。

**本地模型健康（失败安全）**：分类前先嗅探 Ollama（`/api/tags`，结果按 `health.ttlMs` 缓存，默认 30s）。连接失败累计到 `health.failureThreshold`（默认 2 次）就打开熔断 `health.cooldownMs`（默认 60s），期间**0 延迟**直接降级走 `dsh`；冷却结束后的下一次请求重新探测（半开）。模型缺失（`/api/tags` 里没有匹配的 `classifierModel`，按 tag 归一化匹配，如 `qwen3` 命中 `qwen3:8b`；一个模型都没装也算缺失）单独标记为 `model-missing`，不打开熔断。分类超时、报错或 `local` 置信度低于阈值时同样降级走 `dsh`，绝不因为本地模型不可用而丢消息。

- **一个飞书 appId，两条 DSH 会话**：绑定里分别记 `dshSessionId` 与 `localSessionId`，简单问题在本地会话里聊，复杂任务在 DSH 会话里跑，上下文互不污染。
- **零摩擦纠错**：回答卡上带按钮——本地答的可以「改用 4.1 Flash 重答」，写进待整理的可以「撤销写入」，分错路由的可以「改交 4.1 Flash 处理」；点一下立即改道，不用重发消息。
- **手动直达**：`/dsh`、`/loc`、`/note` 前缀跳过分类器；`/router on|off|status` 看状态（`/router status` 里能看到记事规则与本地模型熔断状态）。

**降级与规则结果在卡片上可见**（正常分类路径不加前缀）：

- 兜底：标题前缀 `[飞书·兜底]` 保持不变，正文按真实原因给中文说明——分类器熔断 / 缺模型 / 不可达 / 探测失败 / 分类失败，以及记事规则写不了时的待整理目录未配置、条目为空、置信度不足等；不再把 `circuit-open` 这类英文机读码印到卡片上（机读码只进日志与 `/router status`）；
- 读笔记：标题前缀 `[飞书·读笔记]`，正文注明「读取/整理笔记需要远端模型」；
- 写入待整理（append）：保持「已记入待整理」确认卡；私聊的确认卡多一个速记入口（未开启时「开启速记 10 分钟」，窗口内「结束速记」），速记模式下标题变为「速记中 · 已记入待整理」，正文显示剩余时间与本次第几条。

**`/router status` 输出**：逐行给出 `开关`（含运行时覆盖与群聊是否启用）、`Ollama` 在线状态与已装模型、`分类模型` 与超时/保活、`记事规则`（路由关闭或未配置待整理目录时直接说明未生效原因）、`本地模型`（熔断状态 `open`/`closed`、连续失败次数、剩余冷却秒数）、`路由配置`（dsh / local / obsidian 三条），以及命中统计 `dsh / local / obsidian / fallback / note / override`。

配置分三层，推荐只在本机写：

1. **DSH 全局 provider**（`~/.dsh/profiles/desktop/cordis.patch.yml`）：在 `llm-pi-ai.config.providers` 下加 `ollama`（`baseURL: http://127.0.0.1:11434/v1`，模型 `qwen3:8b`），DSH 才能原生跑本地模型；
2. **热加载 JSON**（`~/.dsh/feishu-agent/local-config.json`）：整个 `router` 块写这里，含本机 `inboxDir`、各路由 provider/model，按 mtime 每条消息热加载，不进 git；
3. **可选平铺 `.env`**：`FEISHU_AGENT_ROUTER_ENABLED` / `FEISHU_AGENT_OLLAMA_URL` / `FEISHU_AGENT_ROUTER_MODEL` / `FEISHU_AGENT_OBSIDIAN_INBOX_DIR`，优先级最高但改完要重启。

清噪断句与健康两项默认值就在 `router` 块里，按需覆盖：

| 配置项 | 默认值 | 环境变量 | 作用 |
|---|---|---|---|
| `polish.enabled` | `true` | `FEISHU_AGENT_POLISH_ENABLED` | 写入前是否做规则清噪 + 按需断句 |
| `polish.timeoutMs` | `6000` | `FEISHU_AGENT_POLISH_TIMEOUT_MS` | 单次断句超时（300~30000） |
| `polish.maxChars` | `300` | `FEISHU_AGENT_POLISH_MAX_CHARS` | 超过这个长度只跳过模型断句，仍做规则清噪（100~2000） |
| `polish.maxItems` | `6` | `FEISHU_AGENT_POLISH_MAX_ITEMS` | 超过这个条目数只跳过模型断句，仍做规则清噪（1~20） |
| `health.enabled` | `true` | `FEISHU_AGENT_HEALTH_ENABLED` | 分类前是否嗅探本地模型 |
| `health.ttlMs` | `30000` | `FEISHU_AGENT_HEALTH_TTL_MS` | 嗅探结果复用窗口 |
| `health.cooldownMs` | `60000` | `FEISHU_AGENT_HEALTH_COOLDOWN_MS` | 熔断冷却时长 |
| `health.failureThreshold` | `2` | — | 连续失败多少次打开熔断 |
| `health.probeTimeoutMs` | `400` | — | 单次健康探测超时（毫秒，200~5000） |

仓库里的 `cordis.patch.yml` 只留通用默认值：`enabled: false`、空 `inboxDir`、不含任何本机路径。

### 定时任务（可选）

定时任务不走环境变量，写在 bundle patch（`dsh-feishu-agent/cordis.patch.yml` 的 `schedules`）或 `local-config.json` 里：

```yaml
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

### 本机私有配置（可选，JSON 版）

不用 `.env`、或要覆盖 CLI 相关字段时，改用仓库外这个文件：

```
~/.dsh/feishu-agent/local-config.json
```

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

它覆盖 bundle 配置里的同名字段：`chats`（按 chat_id 逐键合并，精确键优先，未命中用 `'*'`）、`ownerOpenId`、`answerConcurrency`、`cliHome`、`cliPath`、`cliProfile`、`cliEnvRefs`、`runTimeoutMs`、`appId`、`appSecret`；环境变量压过它。文件缺失或 JSON 解析失败只记日志，插件照常加载；定时任务存在 `state.json`，不从本文件读。

状态目录默认 `$DSH_HOME/feishu-agent/`，可以用 `FEISHU_AGENT_STATE_DIR` 覆盖。里面有两个文件：`state.json`（owner、绑定、定时任务）与 `cards.json`（回答卡记账）。

## 第四步：验证

1. 重启 Desktop，日志里应出现：`已订阅 user-questions/request`、`已订阅 approval/request`、`飞书长连接已建立`、`插件已加载（… owner …）`。
2. 飞书里私聊机器人发 `/help`，应收到「可用命令」卡（这一步不建会话）。
3. 发一句普通的话：会先回一张「排队中」卡，然后变成「处理中 → 已完成」；Desktop 的侧边栏对应 Workspace 分组下出现这条会话。
4. 让 Agent 问你一个问题（例如「问我一个问题再继续」），飞书里应弹出选项卡，选完点「提交」，会话继续。
5. 触发一次需要授权的操作，飞书里应弹「允许一次 / 拒绝」。

## 命令

只对 owner 生效（群聊里成员白名单的人可以提问，但命令只给 owner），由插件拦截，不消耗模型调用：

| 命令 | 作用 |
|---|---|
| `/new` | 在当前 Workspace 下新建会话并切换绑定 |
| `/new local` | 只重建本地 Qwen 会话（`localSessionId`） |
| `/new all` | 两条会话（dsh / local）一起重建 |
| `/note <内容>` | 强制走 obsidian 路由，直接记进待整理 |
| `/note on [分钟] \| off \| status` | 速记模式：窗口内每条消息直接写入待整理（默认 10 分钟，仅私聊） |
| `/loc <内容>` | 强制走 local 路由（本地 Qwen3） |
| `/dsh <内容>` | 强制走 dsh 路由（4.1 Flash），跳过分类器 |
| `/router [on\|off\|status]` | 开关意图路由 / 看当前路由与命中统计 |
| `/switch <会话ID前缀>` | 切到同一 Workspace 里的另一条会话 |
| `/stop` | 停止正在跑的这一轮 |
| `/status` | 看 owner、绑定、工作区、连接状态 |
| `/help` | 命令清单 |

## 故障排查

| 现象 | 先看哪里 |
|---|---|
| 消息没反应 | 日志里有没有 `飞书长连接已建立`；飞书后台的事件订阅是否已发布；是不是另一个进程共用同一个 App |
| 一直「排队中」 | Desktop 端那条会话是否在跑别的轮次；日志里 `已投喂` 之后有没有 `turn` 相关 |
| 一直「处理中」但会话已经结束 | 已修：宿主 `user/message` 事件不带 turn，插件改为从 `turn/start` 补轮次号；插件重启遗留的半截卡会在启动时自动标成「已中断」 |
| 群聊每次 @ 都重复发授权卡 | 已修：真实卡片回调不带 `app_id`/`tenant_key`，绑定键算成 `::oc_xxx:-`，消息事件算出来的键对不上。现在按钮里带 appId/tenantKey，并会按 chatId 认回旧键、修正成规范键 |
| 群聊会话没进工作区 | 已修：绑定键修好后群会话才会真建出来；创建前还会 `mkdir -p` 工作区目录（目录缺失会让 CLI 的 chdir 直接 ENOENT） |
| 第二轮报 `already owned by an active write handle` | 这条会话正在桌面端打开：宿主握着写句柄，CLI 抢不到。插件会自动改由宿主投喂（日志 `改由宿主投喂这一轮`）；旧版本请先切走/关掉桌面端那条会话 |
| 回答卡不动 | 日志里 `回答卡更新没发到飞书`；卡片是否超过 30KB（会改成「内容过长」） |
| 反问/审批不弹飞书 | 日志 `这一轮不是飞书发起的，让给桌面端`——只接管飞书发起的轮次 |
| 提示「这个会话没有配置工作区」 | 设 `FEISHU_AGENT_DEFAULT_WORKSPACE`（或给该 chat 在 `FEISHU_AGENT_CHATS` / `local-config.json` 里配一条） |
| 写进 `.env` 的凭据没生效 | 改完要重启 Desktop；键名拼错或不是 `FEISHU_AGENT_*` 会被跳过（日志里会写跳过了几个）；真实环境变量会盖住它；文件不在项目根/插件包目录时用 `FEISHU_AGENT_ENV_FILE` 指过去 |
| 重启后绑定消失 | 状态目录是否可写；`state.json` 是否被杀掉（插件卸载时会 flush） |
| 在桌面端删掉会话后再发消息 | 入队前会检查会话目录，不在就自动新起一条、更新绑定里的会话 ID（日志 `已经不在了，改用新会话`） |

## 开发

```bash
npm run check   # 语法检查每个模块
npm test        # 276 个离线用例：纯逻辑 + 假宿主/假飞书跑通 apply()
```

测试用 `globalThis.__dshFeishuAgentSdk` 注入飞书 SDK 替身（见 `test/fake-sdk.mjs`），不联网、不要真实凭据。

代码结构：

```
lib/
  index.js                 装配：配置、状态、连接、消息分派、调度、卡片回调
  common/constants.js      常量与文案上限
  common/env-file.js       项目 .env 读取：只补未设置的键，真实环境变量优先
  core/env-config.js       环境变量配置：owner / chat→工作区 / 并发，压过配置层
  core/router.js           意图路由：配置归一化、分类提示词、置信度、降级、跨路由短期记忆
  core/note-mode.js        速记模式窗口：按 chatId 计时、延长、计数（只存内存）
  core/text.js             用户文本清洗、图片语法切段、命令解析、回答截断
  core/cards.js            卡片 JSON 2.0（回答卡/文字卡/图片元素/按钮）
  core/store.js            状态 JSON 原子写（tmp+rename），事件去重只在内存
  core/binding.js          chat → Workspace → Session 的绑定、/new /switch、群注册
  core/turns.js            轮次注册表：哪一轮是飞书发起的（turn/start 补轮次号）
  core/turn-mode.js        TURN_MODE / 宿主认领超时
  core/scheduler.js        定时任务（at / everySeconds），错过补一次
  local/ollama.js          本地 Ollama 客户端：结构化 chatJson、healthCheck
  local/ollama-health.js   健康嗅探：TTL 缓存 + 连续失败熔断（半开恢复）
  local/polish.js          写入前清噪 + 断句：规则删口头语，模型只插标点（失败落盘去噪结果）
  local/obsidian-inbox.js  待整理写入：按天 YYYY-MM-DD.md 追加、撤销
  feishu/events.js         飞书事件归一化（消息 / 卡片回调 / 被引用消息摘要）
  feishu/connection.js     长连接（pingTimeout 看门狗、握手超时、重连回调）
  feishu/outbound.js       发消息 / 回复 / 换卡 / 传图 / 读消息 / 机器人身份
  host/session.js          宿主 sessionController / workspaceRegistry 封装
  host/turn-runner.js      跑一轮：宿主优先、CLI 回退、会话归属、卡片收尾
  host/answer-cards.js     回答卡生命周期、工具汇总、图文混排、重启收尾
  host/session-events.js   宿主会话事件 → 轮次认领 / 工具计数 / 收尾
  host/group-gate.js       群聊门禁：@ 检测、白名单、确认卡接入、绑定键迁移
  host/quoted-context.js   引用回复：取被引用消息补上下文
  host/commands.js         /new /switch /stop /status /help（帮助与状态卡带速记入口）
  host/interactive-target.js 交互卡片发本会话还是 owner 私聊
  host/answerer-question.js  user-questions/request 应答（选项 + 自由文本）
  host/answerer-approval.js  approval/request 应答
  host/services.js         宿主服务取用与错误文案
```

## 已知限制

- 群聊按「群」一条会话（忽略话题 ID）；首次接入要求 owner 已经私聊过机器人（群聊不自举 owner）。接收附件/多模态输入未实现；发送图片只支持回答内嵌与 `outbound.sendImage()`，还没有独立的发图工具。
- 反问支持选项与「单题自由文本」两种；多题且含自由文本的批次让给桌面。
- **插件重启 = 在跑的轮次作废**：启动时会把上次遗留的「排队中/处理中」卡片标成「已中断」，CLI 子进程也会随父进程一起结束。
- 速记模式窗口只存内存：插件重启即失效；窗口内每条消息都会写一条，误开时用 `/note off` 或逐条「撤销写入」。
- 卡片更新走 `PATCH /im/v1/messages/:id`（14 天窗口），没有用 cardkit 实体流式更新。
- 插件随 Desktop 生命周期运行；DSH 升级后请先跑一遍 `npm test` 与第四节的验证清单。
