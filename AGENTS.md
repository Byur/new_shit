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

## Context Hub

- 使用 TypeScript 编写，运行时使用 Node.js，不引入额外 TypeScript runtime。
- MCP 服务默认监听 127.0.0.1:7777，endpoint 为 /mcp；完成调用后停止本地服务。
- Agent 负责掌握 HTML 模板、组织内容并生成最终 HTML；Context Hub 不生成报告、不维护第二套模板。定时任务优先通过 MCP 读取 compact memory 指针和 SQLite 排重数据，不扫描全部历史报告。
- Context Hub 的详细 CLI、数据库和 automation 迁移约束见 context-hub/README.md 和 context-hub/skills/context-hub/SKILL.md。

## Remotion Skill Routing

- Use remotion-best-practices as the default entrypoint for Remotion code, APIs, Studio, media, debugging, rendering, upgrades, and technical review.
- Use knowledge-planner for topic research, learning scope, and the approved teaching plan.
- Use remotion-video-director for narrative, storyboard, visual language, pacing, caption intent, and creative acceptance criteria. It may be selected automatically when the request includes those concerns.
- Use remotion-technical-guardrails alongside the official technical workflow for project-specific scene-continuity and render-mode constraints. It supplements the official Skills; do not patch or fork the official Skill packages to add these local rules.
- When a task needs both creative and technical work, use this order: approved learning direction -> Director creative brief -> remotion-best-practices implementation and technical review with remotion-technical-guardrails -> Director creative review -> remotion-studio-qa playback, encoded-output, and frame-level verification.
- Split shared-looking concerns by decision type: the Director owns caption wording and editorial cue intent, while the technical router owns synchronization code and frame calculations; the Director owns meaning, attention order, visual identity, and perceived pacing, while Studio QA owns playback stability, transition defects, clipping, and flicker.
- Render, still, and frame-export steps use headless mode unless the user explicitly requests non-headless rendering. Studio preview is interactive and is not covered by this render-mode restriction.
- Keep one owner for each decision. A later stage may report a constraint to an earlier stage, but it must not silently rewrite that stage's decisions.
