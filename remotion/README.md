# Remotion package

remotion/ 是 new_shit monorepo 中的 Remotion workspace package，集中维护视频源码、配置、媒体、渲染脚本、演示文档和历史产物。

## 包边界

本包独立维护 Remotion 源码、媒体、脚本和视频相关产物。不要把 bundle、渲染视频或 QA 文件写入 monorepo 根目录。

## 常用命令

在本包目录执行：

~~~bash
cd /Volumes/Project/new_shit/remotion
npm run dev
npm run build
npm run lint
npm run render:story
~~~

也可以从 monorepo 根目录使用 npm run remotion:dev、npm run remotion:build、npm run remotion:lint 和 npm run remotion:render-story。

## 目录约定

- src/：Compositions、场景、设计组件和 Remotion entrypoint。
- public/：配音、字幕和其他静态媒体。
- remotion.config.ts、tsconfig.json、eslint.config.mjs：本包配置。
- docs/：脚本、素材来源、QA 和视觉规则。
- build/：Remotion bundle 产物，由本包 .gitignore 管理。
- out/：单次渲染视频和帧级 QA 产物，由本包 .gitignore 管理。
- output/：按项目归档的交付视频、转场对比和 QA 证据，默认由本包 .gitignore 忽略。

## Remotion 工作约束

- 使用 remotion-best-practices 作为 Remotion 技术工作默认入口。
- 使用 remotion-technical-guardrails 处理本项目的场景连续性和渲染约束。
- 渲染、still 和 frame-export 默认使用 headless 模式；Studio 预览保持交互式。
- 具体 Skill 路由和创作、技术、QA 的职责边界见 monorepo 根 AGENTS.md。
