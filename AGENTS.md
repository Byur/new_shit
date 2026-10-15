# new_shit monorepo instructions

## Monorepo boundaries

- 本仓库使用 npm workspaces，当前子包为 context-hub/、remotion/ 和 demos/。
- 每个子包独立维护自己的源码、脚本、配置、README、.gitignore 和可再生产物。
- 子包之间通过明确的文件、命令或数据契约协作；不要把一个子包的运行产物写入另一个子包或 monorepo 根目录。
- 根 package.json 只保留 monorepo 级别和已有的 Remotion、Context Hub 跨包入口。demos 的命令只放在 demos/package.json，从 demos/ 目录执行。

## Package output policy

- remotion/build/：Remotion bundle。
- remotion/out/：渲染视频、帧导出和一次性 QA 结果。
- remotion/output/：Remotion 本地交付物和 QA 证据，默认由 remotion 包的 .gitignore 忽略。
- demos/output/：demo 的截图、浏览器验证和其他演示产物。
- context-hub/data/：SQLite 数据库、compact memory 和数据服务导出；不保存 Context Hub 渲染产物。
- 禁止新建或恢复 monorepo 根目录的 output/、build/ 或 out/ 作为共享产物目录。
- 新增可再生产物时，优先更新对应子包的 .gitignore；需要交付或审阅的证据才放入该子包的受控 output/。

## Handoff and artifact policy

- 产物（文件、报告、JSON、文档、`present` 卡片）只在满足下列之一时创建：① 检查器或脚本会读它；② Agent 会回读它，作为后续判断的输入；③ 它本身就是检查器可重跑的输出。三条都不满足时，结论写进回复正文；需要长期留存的，写进已有文档的对应小节。不为单个结论新立文件，也不用 `present` 给没有人打开的东西盖章。
- 证据必须由机器产出、可重跑、且自身可被验伪。把别处算出的数字手抄进一个新文件，等于给同一批数字造一个无法验伪的第二事实源——这比单纯冗余更糟，因为它长得像证据。
- 需要 before/after 时不要手写差值文件：让同一个检查器多跑几次，报告自带生成时间与输入内容哈希（如源码树哈希），一串报告本身就是可重推的对照链。
- 新建检查器或脚本前，先确认仓库里没有同类能力。脚本的价值在于它发现过、或能防止原理上看不见的失败；"零发现 + 每次固定输出的 note" 不算价值，永久 note 会训练人忽略该检查器的输出。
- 未能满足上述条件的既有产物应被删除，而不是留在仓库里等待某个未来的读者。
- **交付即定稿。** 产物一经定稿，为其临时建立的检查脚本、审计探针、一次性 QA 报告与差值文件随之删除：结论已经记进文档，不留下工具去等一次不会发生的重跑。跨子包或跨片子复用的共享工具（如通用的渲染、帧导出、编码验收脚本）和可复现产物的构建脚本不属于临时产物，应保留。删除前确认引用它的文档、`package.json` 条目和类型定义一并收掉，不留悬空引用。

## Context Hub

- 使用 TypeScript 编写，运行时使用 Node.js，不引入额外 TypeScript runtime。
- MCP 服务默认监听 127.0.0.1:7777，endpoint 为 /mcp；完成调用后停止本地服务。
- Agent 负责掌握 HTML 模板、组织内容并生成最终 HTML；Context Hub 不生成报告、不维护第二套模板。定时任务优先通过 MCP 读取 compact memory 指针和 SQLite 排重数据，不扫描全部历史报告。
- Context Hub 的详细 CLI、数据库和 automation 迁移约束见 context-hub/README.md 和 context-hub/skills/context-hub/SKILL.md。

## Remotion Skill Routing

- Remotion 视频默认画布为 1920 * 1080；除非用户明确指定其他尺寸，否则按此分辨率创建 Composition。
- Use remotion-best-practices as the default entrypoint for Remotion code, APIs, Studio, media, debugging, rendering, upgrades, and technical review.
- Use knowledge-planner for topic research, learning scope, and the approved teaching plan.
- Use remotion-video-director for narrative, storyboard, visual language, pacing, caption intent, and creative acceptance criteria. It may be selected automatically when the request includes those concerns.
- Use remotion-technical-guardrails alongside the official technical workflow for project-specific scene-continuity and render-mode constraints. It supplements the official Skills; do not patch or fork the official Skill packages to add these local rules.
- When a task needs both creative and technical work, use this order: approved learning direction -> Director creative brief -> remotion-best-practices implementation and technical review with remotion-technical-guardrails -> Director creative review -> remotion-studio-qa playback, encoded-output, and frame-level verification.
- Split shared-looking concerns by decision type: the Director owns caption wording and editorial cue intent, while the technical router owns synchronization code and frame calculations; the Director owns meaning, attention order, visual identity, and perceived pacing, while Studio QA owns playback stability, transition defects, clipping, and flicker.
- Render, still, and frame-export steps use headless mode unless the user explicitly requests non-headless rendering. Studio preview is interactive and is not covered by this render-mode restriction.
- Keep one owner for each decision. A later stage may report a constraint to an earlier stage, but it must not silently rewrite that stage's decisions.
