# Clef Decision Lab

一个本地 NPC 决策实验台：编辑状态与候选问题，通过 Hono 调用 Cloudflare Clef / Clef-flash，观察选择、概率、评分与延迟。按照用户提供的 `clef-decision-lab-spec.md` 实现 P0 与 P1。

Demo 作为 `demos/` 的独立目录维护，包含自己的依赖、锁文件和启动入口。可以把此目录单独复制成仓库；不依赖 Unity、Context Hub 或 Remotion。未创建远程仓库或部署。

## 启动

需要 Bun 1.3.5+；构建使用 Vite 7，建议 Node.js 22.12+。Vue 固定为 3.5.22：本次安装时 registry 返回的更高版本无法解析匹配的 runtime-core，固定版本后已用冻结锁文件验证安装。

从 demos workspace 启动：

```bash
cd /Volumes/Project/new_shit/demos
npm run clef:install
npm run clef:dev
```

或者在此目录独立运行：

```bash
bun install --frozen-lockfile
bun run dev
```

- Web：[http://localhost:5173](http://localhost:5173)
- API：[http://localhost:3000/api/health](http://localhost:3000/api/health)
- Ctrl+C 同时停止 Web 和 API；端口已占用时停止启动，不自动换端口。

在此目录的 `.env` 配置以下变量，或使用现有 monorepo 根 `.env`：

```dotenv
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_AUTH_TOKEN=...
PORT=3000
```

优先级：进程环境 > Demo `.env` > monorepo 根 `.env`。只有服务端模块读凭据，Vite 使用独立的 Web 根目录、禁用 envDir，开发启动器剥离传给 Web 进程的 Cloudflare 变量。不要把密钥放进 `VITE_` 变量。`/api/health` 只返回配置是否存在，不保证权限或额度可用。

## 建议的学习路径

1. 点击 **载入三题示例**，选择 `clef-flash`，在 **A 钱包找回** 下点击 Run。载入操作会替换当前输入，历史记录保留。
2. 阅读固定的三种题型：`next_action`（choice）在喝茶、点头、走近交谈、安全离开中选一个；`willing_to_talk`（noul）判断此刻是否愿意主动友好交谈；`leave_urgency`（score）按“无须离开 → 轻微回避需求 → 明显冲突或风险 → 即时人身危险”四个明确等级评估必要性。
3. 分别载入 **B 钱包被偷**、**C 暂不和解**、**D 现场危险**，每组再 Run。它们分别只比 A 改 `memory[1]`、`goal`、`observation.situation`，问题集和其他状态字段保持一致；这四组不是一段连续剧情。每个按钮都会载入完整示例输入。
4. 进入 **A / B 对比**，可按预设名称选择 A 与任意一组比较。也可自行只改一处 Context，再 Run；或换 `clef` 重复同样的实验。
5. 在 **重复试验** 选择 5 / 10 / 20 / 50 次。输入会冻结为同一份快照，串行调用，每次独立保存。认证失败、未配置、取消或 429 会停止后续请求；不自动重试，不推算未知账户剩余额度。
6. 用 **历史记录** 恢复输入、查看结果或导出完整 JSON；用右上角 **理解 Clef** 回看接口的意义与 NPC 接入位置。

快捷键：Ctrl / Command + Enter 运行当前工作台输入。原始请求与表单双向同步；导入请求 JSON 会进入 Raw JSON 编辑器，非法输入不会发往提供商。

候选 ID（如 `option_a`）用于程序识别，描述需要写出具体行为或等级含义。新增候选只显示示例提示，不把提示作为真实输入；空白或旧版“选项一 / 选项二 / 新候选项”会在工作台中提示补全并阻止运行。choice 与 score 互相切换时保留已有描述，请自行核对新题型的判断说明与等级顺序。

当前三题示例来自 `fixtures/tavern-learning.json`，四组状态由 `packages/shared/src/examples.ts` 统一生成。首次打开且没有本地草稿时默认显示 A；已有草稿请用“载入三题示例”显式替换。最初规格的 `tavern-erin.json` 与旧版真实响应仍用于回归回放；旧版问题集与新示例不同，不能混在同一次状态 A/B 中比较。切换状态只改输入，点击 Run 才调用模型；页面不会把期望趋势伪装成结果。

## 输出该怎样理解

- `choice.choice` 是概率最高的候选，而非按分布随机抽样。重复试验的“选择频次”统计这个字段，不把概率冒充频率。
- `noul.noul` 是 0–1 的 Yes 概率；界面不擅自把它转为布尔值。
- `score.score` 是等级索引的概率加权均值，可为小数；等级从 0 开始。界面不会把它四舍五入成某个选中等级。
- `confidence` 是提供商从概率分布衍生的指标，与某个候选的概率不同，也不是在你的任务上校准过的正确率。
- 概率、confidence、usage 只显示真实响应字段；未知结构仍能在原始响应里查看。
- API 耗时从服务端发送请求到完整读取提供商响应；浏览器往返包含本地开销。P50/P95 使用成功请求、nearest-rank 算法，不包含失败请求。
- A/B 只允许比较相同模型、相同 Questions 的两次成功运行，Δ 是 B − A 的百分点差。自定义实验仍需自己控制变量。

截至 2026-11-13，已通过真实调用验证：两个模型都能处理酒馆中文场景的三种问题；钱包被偷会提高离开倾向，但并不一定改变首选动作。`fixtures/*.real.json` 保存接口直接产出的脱敏快照，包含请求、输入 SHA-256、时间戳与原始响应。可使用下面的命令重跑，实际输出而非本段文字是数值依据。

这证明了接口可用、结构化输出能够接入程序，以及特定输入下的偏好变化。它不能证明模型在所有 NPC 场景上可信；还需要角色一致性、非法动作、矛盾记忆和不同语言的场景集评测。长期记忆必须由应用保存并作为下次 State 传入。

## 验证与重跑

```bash
bun run test                 # 不使用账户，回放真实 Fixture 并检查输入、错误、取消、统计
bun run build                # vue-tsc + Vite 生产构建
bun run verify:live          # 4 次真实付费/额度请求：两个模型 × A/B；无重试
bun run verify:live --write-fixtures  # 同样请求，并更新 fixtures/*.real.json
bun run verify:live --examples --write-fixtures # 新三题示例的 A/B/C/D，各调用一次 clef-flash
```

`verify:live` 通过同一个 Hono 路由调用提供商，无需先启动开发服务器。遇到错误立即停止；默认不修改快照。`--examples` 使用当前三题示例，保存时文件名为 `clef-flash.learning.<A/B/C/D>.real.json`。所有 `*.real.json` 都由回放测试读取并校验请求哈希和响应语义，不作为浏览器假数据源。

也可分阶段启动：`bun run server` 只启动 API；`bun run web` 只启动 Vite（API 地址默认 3000，可用 `LAB_API_PORT` 指定）。UI 支持桌面三栏独立滚动与移动端区域切换。

## 文件与复用边界

```text
apps/web/                 Vue 3 + Vite + shadcn-vue + Tailwind 4
apps/server/src/app.ts    Hono 本地接口、请求大小与来源校验
apps/server/src/env.ts    仅服务端读取的配置
apps/server/src/providers/cloudflare.ts   模型白名单、真实 API、脱敏、标准响应
packages/shared/src/     Zod Schema、重复键解析、结果语义与统计
fixtures/                酒馆输入 + 真实脱敏响应（回放测试会读取）
scripts/dev.ts           双服务启动与退出
scripts/verify-live.ts   可重跑的真实联调入口
test/                    请求边界、Provider 契约与统计回归
dist/web/                可重建的客户端产物，Git 忽略
```

shadcn-vue 的 Button、Input、Textarea 源码来自官方 new-york registry，并通过 Reka UI / VueUse 使用。样式采用本地系统字体，不依赖远程字体服务。

客户端只调用 `POST /api/decisions/run`，不接触 Cloudflare URL、账号或认证头。请求 JSON 上限为 256 KiB，默认 30 秒超时，Cancel 会向上传播 AbortSignal。取消不能保证提供商不计费。历史在当前浏览器 localStorage 中最多 100 次、合计 2 MB，超大完整记录不持久化并给出提示，不截断原始响应。可清空历史、导出结果；State 可能包含你自己的数据，请按需清理。

本地服务仅绑定 127.0.0.1，并拒绝外部网页 Origin 的请求。当前未部署，公网使用前需要认证、限流与访问控制。本次不包含图片、视频、Agent 调度或游戏世界状态模拟。未来可把 shared 与 provider 模块移入 Agent Runtime：World Server 仍负责生成合法动作、执行裁决与记录事件。

## 官方参考

- [Clef-flash 模型](https://developers.cloudflare.com/workers-ai/models/clef-flash/)
- [Clef 模型](https://developers.cloudflare.com/workers-ai/models/clef/)
- [当前输入 Schema](https://developers.cloudflare.com/workers-ai/models/clef-flash/schema-input.json)
- [当前输出 Schema](https://developers.cloudflare.com/workers-ai/models/clef-flash/schema-output.json)
- [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
