# dsh-context-hub-bridge

把 context-hub 的定时触发接进 **DSH 宿主进程**，让任务跑成一条真实会话：侧栏可见、可以实时点开看过程、可以手动插话或停止。

## 它解决什么

context-hub 原本用一次性 `dsh --profile headless "…"` 跑任务：可靠，但执行过程是个黑盒——没有会话、看不到中间步骤、不能中途干预。

这个插件装在宿主里，注册四条本地 HTTP 路由。context-hub 定时到点调用它，宿主自己创建会话并投递任务。于是：

- 会话出现在宿主侧栏（按 workspace 分组），不是「未分组」；
- 运行中的工具调用、思考、输出，在界面里实时可见；
- 超时或跑偏时，context-hub 调 `cancel`，等价于你在界面上点停止；
- 跑完的答案由桥回读，不需要再去解析会话日志。

## 为什么不用宿主的 `/api`

`/api` 需要每次启动随机生成的 token，且只出现在 `dsh web` 打印的 URL 里；桌面端既不打印也不落盘。

`@deepseek-ai/dsh-host-webserver` 的鉴权是**按路由**的（README 明说本包「不提供服务器级认证」）。本插件注册的路由只认自己的共享密钥，因此不需要 token、不需要逆向 Electron，也不需要开调试端口。

## 路由

所有路由都在 `/context-hub` 前缀下，必须带 `x-context-hub-secret` 头。

| 方法与路径 | 作用 |
|---|---|
| `GET /context-hub/health` | 存活探测，返回 `{ ok, pid, port? }`（端口取不到时省略，不编造） |
| `POST /context-hub/run` | 创建会话并投递第一条消息 |
| `GET /context-hub/run/<sessionId>?sinceSeq=N` | 读任务状态 |
| `POST /context-hub/run/<sessionId>/cancel` | 取消当前轮次 |

`POST /run` 的请求体：

```json
{
  "prompt": "任务全文",
  "workspacePath": "/Volumes/BillionSteps/GitHub/wizzzzz-skillhub",
  "title": "Wizz A · 全流程",
  "sandbox": "workspace-write",
  "approval": "never",
  "addDirs": ["/Volumes/BillionsBrilliance/materials"]
}
```

- `workspacePath` 与 `cwd` 二选一。前者会先在工作区注册表里按目录查找，找到就把会话挂进该分组；找不到才退回 `cwd`（未分组）。
- `sandbox` + `approval` 是**独立开关**，桥按值在宿主的预设表里反查名字（`workspace-write` + `ask`、`workspace-write` + `never`、`danger-full-access` + `never` …）。找不到匹配组合时返回 400 并列出本机可用组合，不猜。
- `permission` 也可以直接给预设名，跳过反查。
- `addDirs` 里的每个目录按会话注册成 sandbox 的额外可写根（`sandboxPolicy.registerWritableRoot`），轮次结束或取消时释放。`workspace-write` 的默认边界只有会话 cwd，**不登记就写不了工作区外**。宿主没有 `sandboxPolicy` 服务时会直接失败，而不是少给权限。
- 返回 `{ sessionId, sinceSeq, title, workspacePath … }`。`sinceSeq` 是投递前的日志偏移，**必须保存**：状态查询靠它区分「这条消息的答案」和「上一轮的答案」。它总有值（最差是 `0`），调用方不需要兜底。

状态响应：

```json
{ "sessionId": "session-…", "status": "answered", "answer": "…", "turn": 1, "turnEndKind": "completed", "lastSeq": 19 }
```

`status` 取 `answered` / `running` / `idle`。停滞判定以 `status` 为准：`running` 就说明这一轮还活着，长任务不会因为暂时没有新事件被杀。`lastSeq` 变化只用于日志与进度展示。取消后 `turnEndKind` 为 `aborted`。

## 安装

### 1. 装进 profile

和别的宿主插件一样，在 profile 的 `package.json` 里加链接依赖并挂进 bundles：

```json
"dependencies": {
  "dsh-context-hub-bridge": "link:/Volumes/BillionSteps/GitHub/new_shit/dsh-context-hub-bridge"
},
"dsh": {
  "profile": {
    "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-context-hub-bridge"]
  }
}
```

然后 `cd <profile 目录> && pnpm install`。

### 2. 配密钥与发现文件

在 profile 的 `cordis.patch.yml` 末尾追加：

```yaml
- id: context-hub-bridge
  config:
    stateFile: /Users/you/.dsh/context-hub-bridge.json
    secretFile: /Users/you/.dsh/context-hub-bridge.secret
```

`secret` 与 `secretFile` 二选一；`secretFile` 更安全（不进配置文件）。生成：

```bash
openssl rand -hex 32 > ~/.dsh/context-hub-bridge.secret
chmod 600 ~/.dsh/context-hub-bridge.secret
```

### 3. 重启宿主

插件在启动时挂载，改完要重启 DSH Desktop（或 `dsh web`）。重启后 `stateFile` 会写入实际监听端口：

```json
{ "pid": 45455, "port": 59703, "origin": "http://127.0.0.1:59703", "basePath": "/context-hub" }
```

端口由宿主决定，可能是动态的，所以 context-hub 必须读这个文件而不是写死。

### 4. 自检

```bash
PORT=$(python3 -c "import json;print(json.load(open('$HOME/.dsh/context-hub-bridge.json'))['port'])")
SECRET=$(cat ~/.dsh/context-hub-bridge.secret)
curl -s -H "x-context-hub-secret: $SECRET" "http://127.0.0.1:$PORT/context-hub/health"
```

### 无人值守的权限预设

桌面 profile 默认的 `workspace-write` 是 `approval: ask`——定时任务遇到需要审批的工具会一直挂着等人点。给 profile 的 `cordis.patch.yml` 加第三个预设（不动现有的）：

```yaml
- id: permission
  name: "@deepseek-ai/dsh-permission-presets"
  config:
    presets:
      read-only:
        sandbox: read-only
        approval: ask
      workspace-write:
        sandbox: workspace-write
        approval: ask
      unattended:
        sandbox: workspace-write
        approval: never
        name: 自动执行
      danger-full-access:
        sandbox: danger-full-access
        approval: never
```

`config.presets` 是**整表替换**，不是深合并，所以三个原有项也要写上。改完重启宿主。

## 边界

- **宿主不在 = 任务不会开始**。桥只负责在宿主里执行；拉起宿主、排队、重试仍然归 context-hub（它可以在 `runtime: desktop` 下 `open -a` 唤醒一次）。
- **额外可写根是运行时授权**。宿主重启、会话恢复或 fork 后需要重新登记；`addDirs` 不写进会话日志。
- **单宿主**。同一个 `DSH_HOME` 不要同时跑桌面端和 `dsh web`，两边都会写会话库和工作区注册表。
- **本地可信**。路由只绑回环地址并要求共享密钥，但同机进程能读到密钥文件。把它当成「本机自动化入口」，别当成跨用户边界。
- **不做目录白名单**。拿到密钥的进程可以让宿主建出 `workspace-write + never` 的会话，并把任意目录登记成额外可写根。这是有意的取舍（同机同用户本来就能直接写文件），但不要把密钥放进共享脚本或多用户环境。
- **不负责清理**。会话日志、附件、缓存都按宿主自己的策略留存；context-hub 想清就自己清。
