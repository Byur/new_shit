# DeepSeek Harness 插件视频事实来源

核验日期：2026-10-07（Asia/Shanghai）。以下链接均指向官方仓库/文档或插件原始仓库；第三方目录只用于观察社区可见度，不作为能力事实的唯一依据。

## 项目身份

- 官方项目主页：<https://www.deepseek.com/harness/en/>
- 官方原始仓库：<https://github.com/deepseek-ai/deepseek-harness>
- 官方 README：<https://github.com/deepseek-ai/deepseek-harness#readme>
- 官方包总览：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md>

关键事实：DeepSeek Harness（`dsh`）是 DeepSeek AI 开源的 agent harness，基于 Cordis，采用 everything-is-a-plugin 架构；官方 README 标为 developer preview，并提示会有 compatibility-breaking changes。

## 官方插件/插件组

- Bash：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/shell/tool-bash/README.md>
- Web：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/web/tool-web/README.md>
- MCP 资源：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-resources/README.md>
- Subagent：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/subagent/README.md>
- Plan mode（作为装配/审查概念的旁证）：<https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/plan/plan-mode/README.md>
- 官方工具目录：<https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/tool-catalog.md>
- 官方扩展说明：<https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md>

## 社区代表

- 原始仓库：<https://github.com/NanmiCoder/dsh-agent-teams>
- 原始仓库 README：<https://github.com/NanmiCoder/dsh-agent-teams/blob/main/README.md>
- 原始仓库 Releases：<https://github.com/NanmiCoder/dsh-agent-teams/releases>

关键事实：README 描述 captain、可持久化子 Agent、依赖感知任务和 Web UI；当前 README 的推荐组合为 DSH `0.2.0-rc.2` + AgentTeams `0.1.22`。Release 页面显示 `v0.1.22` 于 2026-09-29 发布，并明确它面向该 DSH RC。

## 社区可见度的参考

- 社区目录的源代码索引：<https://github.com/dshplugin-app/deepseek-harness-plugins>
- 该索引当前快照把 DSH Web UI、ModLens、dsh-better-sidebar、dsh-cc-tui、Aegis 列为高星项目，并强调条目应保留 canonical source；它不是官方安全认证，也不替代原始仓库核验。
