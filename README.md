# new_shit monorepo

new_shit 是一个使用 npm workspaces 管理的个人项目 monorepo。源码、运行脚本、数据和生成产物按子包分治，monorepo 根目录只负责 workspace 配置和跨包入口，不承载各包的 output/、build/ 或 out/。

## 子包

| 子包 | 职责 | 包级文档 |
| --- | --- | --- |
| context-hub/ | TypeScript + Node.js 的 SQLite 数据服务、上下文压缩和 MCP 服务 | [context-hub/README.md](context-hub/README.md) |
| remotion/ | Remotion 视频源码、媒体、Studio、渲染脚本和视频 QA 产物 | [remotion/README.md](remotion/README.md) |
| demos/ | 独立实验和可运行演示，不承担生产包职责 | [demos/README.md](demos/README.md) |

## 安装

在 monorepo 根目录执行：

~~~bash
npm install
~~~

运行时使用 Node.js；各包的 TypeScript 源码遵循对应包 README 中的运行约定。

## 根目录入口

根 package.json 只提供 Remotion 和 Context Hub 的常用跨包入口：

~~~bash
npm run remotion:dev
npm run remotion:build
npm run remotion:lint
npm run remotion:render-story
npm run context-hub:test
npm run context-hub:mcp
~~~

demos 不注册根目录命令。运行 demo 时进入 demos/，使用该包自己的脚本：

~~~bash
cd demos
npm run motion-ai-kit:serve
~~~

## 产物与数据归属

- remotion/build/：Remotion bundle 产物。
- remotion/out/：视频渲染和帧级 QA 产物。
- remotion/output/：Remotion 项目的交付视频、转场对比和 QA 证据，默认由 remotion 包的 .gitignore 忽略。
- demos/output/：demo 自己的浏览器验证和演示产物。
- context-hub/data/：SQLite 数据库和 compact memory；最终 HTML 由 Agent 写入定时任务工作区。

根目录不创建共享的 output/、build/ 或 out/ 目录。每个子包通过自己的 .gitignore 管理可再生或临时产物。

## 设计原则

- 包内源码、脚本、配置和产物路径相对包根目录定义。
- 需要长期维护的数据使用结构化 SQLite 记录，不把完整历史上下文反复写回 automation memory。
- Agent 持有并复用固定 HTML 模板，Context Hub 只提供已获取信息的查询、去重和序列化服务。
- 本地 MCP 服务默认监听 127.0.0.1:7777，使用后应停止服务。
