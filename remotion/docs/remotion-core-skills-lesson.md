# Remotion 核心 Skills：让 Agent 真正会做视频

## Lesson Brief

- **主题**：Remotion Agent Skills 的分工、调用顺序与一个最小视频工作流
- **受众**：能读 React/TypeScript，但第一次接触 Remotion Agent Skills 的开发者
- **前置知识**：知道 npm、React component 和基本命令行操作即可
- **学习承诺**：看完后，学习者能够解释 Skill 与普通 prompt 的区别，知道从哪个 Skill 开始，并能把一个“做视频”的请求拆成创建、编排、预览、渲染四步
- **建议时长**：4 分 30 秒，30fps，1920x1080
- **主格式**：无配音的屏幕字幕教材，字幕就是讲解正文；代码、流程和结果承担视觉记忆
- **Remotion 实现预期**：可直接转成现有项目的独立 composition；本稿本身不改写已有 composition

## Scope

### 讲什么

1. Skill 是给 coding agent 的可复用工作方法，不是视频运行时组件
2. `remotion-best-practices` 作为总入口，如何按任务选择专门 Skill
3. 一条可复用的主链：`create -> markup -> captions -> studio -> render`
4. `docs` 和 `upgrade` 在主链中的辅助位置
5. 用一个“带标题、动效和字幕的短视频”演示 agent 的工作流

### 暂不展开

- 地图动画、Remotion SaaS 架构、交互式 Studio 编辑能力
- Lambda、批量渲染、授权与商业部署
- 每个 Skill 的完整 API 细节
- 具体 coding agent 的安装和账号配置差异

这些内容可以作为下一期“Remotion Skills 进阶地图”。

## Central Mental Model

把 Skills 讲成一组“工作台按钮”，而不是一堆命令：

```text
需求
  -> 选择工作台
  -> 读取对应规则
  -> 生成/修改代码
  -> 预览确认
  -> 渲染交付
```

关键区分：

- **事实**：Remotion 官方仓库维护一组面向 Claude Code、Codex、Kimi Code、Cursor 等 agent 的 Skills，并提供 `npx skills add remotion-dev/skills` 安装方式。
- **教学比喻**：Skill 像工作台按钮，按任务打开对应的操作手册。
- **本期主张**：核心价值不是让 agent“更会说”，而是让它按照更稳定的工作顺序做出可预览、可渲染的视频。

## Skill Map

| Skill | 教学中的一句话 | 画面角色 | 使用时机 |
| --- | --- | --- | --- |
| `/remotion-best-practices` | 不确定从哪里开始，就先打开总入口 | 总控面板 | 每个项目的默认起点 |
| `/remotion-create` | 创建项目或 composition | 建造台 | 新建视频或新场景 |
| `/remotion-markup` | 处理 React 标记、布局、动效、媒体、字体和 timing | 编排台 | 编写与修改画面 |
| `/remotion-captions` | 处理字幕和 caption 轨道 | 字幕台 | 需要字幕或无配音教学时 |
| `/remotion-studio` | 启动 Studio，看见并拖动时间线 | 预览台 | 每次视觉检查 |
| `/remotion-render` | 把 composition 输出为视频或 still | 出片台 | 验收与交付 |
| `/remotion-docs` | 查当前 API 与官方文档 | 资料台 | 遇到版本/API 不确定时 |
| `/remotion-upgrade` | 升级 Remotion 与相关 Skills | 维护台 | 项目升级时 |

主线只展示前六个，`docs` 和 `upgrade` 以侧边提示出现，避免做成 Skills 名称点名大会。

## Remotion Storyboard

| Time | Scene | Narration | On-screen Text | Visual / Motion | Assets / Demo |
| --- | --- | --- | --- | --- | --- |
| 00:00-00:20 | Hook：同一句请求，结果为什么不同 | 无配音；用逐句字幕呈现：“请帮我做一个 Remotion 视频。”同一句话，第一次可能得到静态卡片，第二次得到可预览、可渲染的 composition。 | `同一句请求，为什么结果差这么多？` | 左侧是散乱的 prompt 便签，右侧是有顺序的工作台；右侧灯光依次亮起 | 无外部素材，纯 CSS/React 图形 |
| 00:20-00:48 | 命名 Skill | Skill 是给 coding agent 的可复用工作方法。它把经验、约束和工具顺序放到任务旁边。 | `Skill = 可复用的工作方法` | `prompt` 卡片翻面成为 `SKILL.md`，文件内出现 `when to use / steps / verify` | 代码样式文本 |
| 00:48-01:15 | 总入口 | Remotion 官方把一组 Skills 放在一起。拿不准时，从 `remotion-best-practices` 开始，再分流到专门 Skill。 | `/remotion-best-practices` `总入口` | 中央圆盘向外发出 6 条彩色路径；路径标签依次出现 | Skill Map |
| 01:15-01:50 | 创建与编排 | 第一站是 `create`，决定项目或 composition 的骨架；第二站是 `markup`，把 React、布局、动效和媒体写进时间轴。 | `create：搭骨架` `markup：编排画面` | 一个空 composition 从 0 变成带标题、色块、计时器的画面；元素按 spring/slide-in 进入 | 最小 composition 示意 |
| 01:50-02:22 | 字幕是第二条叙事轨 | 本期不用配音，所以字幕不能只是最后贴上去的文字。它要和画面一样有时间、层级和节奏。 | `captions：让无配音视频也能讲清楚` | 字幕轨道在时间线下方展开；当前句高亮，已读句降低透明度 | 同步字幕组件 |
| 02:22-02:52 | 预览不是终点 | `studio` 让 agent 和人一起看见每一帧。重点不是“命令跑过了”，而是标题是否溢出、动画是否太快、字幕是否挡住主体。 | `studio：把代码变成可观察的画面` | 时间线 cursor 扫过 3 个检查点：布局、节奏、字幕 | 检查清单动画 |
| 02:52-03:20 | 渲染交付 | 视觉确认后才进入 `render`。它把 composition 变成视频或 still；预览通过，不等于交付完成。 | `render：从 composition 到 MP4` | 预览窗口收缩成一张时间线，再转成 MP4 文件卡；文件卡显示 `1920×1080 / 30fps` | 本地文件图形 |
| 03:20-03:50 | 辅助台：docs / upgrade | API 不确定时查 `docs`，版本变化时用 `upgrade`。它们不替代主流程，而是降低错误和维护成本。 | `docs：查证` `upgrade：维护` | 两个侧边抽屉短暂打开，不打断主流程；抽屉自动归位 | 侧边抽屉 |
| 03:50-04:15 | Before / After | 没有 Skill，agent 需要临场猜顺序；有了 Skill，任务变成可检查的流水线。 | `猜测 → 试错 → 返工` 对比 `识别 → 加载 → 预览 → 渲染` | 左侧红色路径抖动并回退，右侧绿色路径稳定向前 | 前后对比 |
| 04:15-04:30 | Close：下一步 | 记住的不是八个名字，而是选择逻辑：先找入口，再按任务打开工作台，最后用预览和渲染验收。 | `先选 Skill，再做视频。` | 所有工作台按钮合拢成一条发光路径；结尾停在 `create -> markup -> captions -> studio -> render` | 片尾主线 |

## 无配音字幕脚本

每条字幕建议 1-2 行，单条停留 3-6 秒；不要把整段旁白压成一张长卡。下面的文案与分镜时间对应，可直接拆成 caption cue：

```text
请帮我做一个 Remotion 视频。
同一句请求，为什么结果差这么多？

Skill 是给 coding agent 的可复用工作方法。
它把经验、约束和工具顺序，放到任务旁边。

不确定从哪里开始？先打开 remotion-best-practices。
它是总入口，再把任务分流给专门 Skill。

create 负责搭骨架。
markup 负责把 React、布局、动效和媒体编排进时间轴。

本期不用配音，所以字幕就是第二条叙事轨。
它也需要时间、层级和节奏。

studio 让我们看见每一帧。
检查布局、节奏，以及字幕有没有挡住主体。

预览通过，不等于交付完成。
render 才把 composition 输出成视频或 still。

docs 用来查证当前 API。
upgrade 用来维护版本和 Skills。

没有 Skill：猜测、试错、返工。
有了 Skill：识别、加载、预览、渲染。

记住选择逻辑：先找入口，再按任务打开工作台，最后验收。
先选 Skill，再做视频。
```

## 教学 Demo Spec

### Demo 要证明什么

证明一条 Skill 主链可以把一个模糊的视频请求变成一个可观察、可交付的 Remotion composition。

### 输入

```text
做一个 10 秒视频，解释“一个请求如何经过 Agent Skills 变成可渲染的 Remotion composition”。
要求有标题、流程动画和字幕，不需要配音。
```

### 变换

1. 从 `best-practices` 识别需要的专门能力
2. 用 `create` 定义 composition 的尺寸、fps 和时长
3. 用 `markup` 编写布局、动画和流程卡片
4. 用 `captions` 把本期脚本变成时间轴 cue
5. 用 `studio` 检查关键帧
6. 用 `render` 输出 MP4 和一张 still

### 输出

- 一个 10 秒、1920x1080、30fps 的 composition
- 一条能随时间推进的流程动画
- 一组与时间轴同步的中文字幕
- 一个可播放的 MP4 和一张用于缩略图检查的 still

### 有意省略

- 不引入外部图片、远程字体或不可控网络素材
- 不演示完整 AI agent 安装过程
- 不把 `maps`、`saas`、`interactivity` 伪装成“每个视频都必须用”的核心步骤

## Remotion Production Notes

- **画面**：深色工作台底色，青色表示信息流，绿色表示已验证，珊瑚色表示试错/返工，黄色表示检查点。
- **版式**：左侧保持教学标题和当前问题，右侧承载结构图或代码；底部固定字幕带，避免字幕遮住流程主体。
- **动效**：每个动效只承担一个教学动作：出现表示加载，连线表示因果，回退表示返工，完成标记表示验收。
- **无配音策略**：字幕字号不低于 34px（1920x1080），每条 cue 至少保留 3 秒；重要术语同时显示英文 Skill 名和中文解释。
- **音频**：本期不放配音；可保留静音输出，避免加入无意义背景音乐分散阅读注意力。
- **素材**：优先使用 React/CSS 图形与代码文本，不依赖外部图片链接。

## Accuracy Boundaries

- 不把 Skill 说成 Remotion runtime API；它是给 agent 的指导材料。
- 不把所有 Skills 都叫“核心”。本期的核心是视频生产主链，地图、SaaS、交互、多媒体属于按场景加载的扩展能力。
- `best-practices` 的定位是总入口；具体调用顺序是本教材为初学者设计的教学路径，不宣称每个项目都必须严格按此顺序。
- 片中任何 `-42%`、`+73%` 之类的效果数字都不使用；本期只展示流程差异，不虚构性能数据。

## Sources

- [Remotion Agent Skills 官方文档](https://www.remotion.dev/docs/ai/skills)
- [Remotion 官方 Skills 仓库](https://github.com/remotion-dev/skills)

## Review Checklist

- [ ] 前 20 秒让学习者看见“同一请求，结果不同”的问题
- [ ] 清楚区分 Skill、prompt、Remotion composition 和 runtime API
- [ ] 主线不超过 5 个核心操作节点，辅助 Skill 只做侧边提示
- [ ] 每个画面元素都在解释状态、因果、节奏或验收标准
- [ ] 无配音时，字幕仍能独立完成知识传递
- [ ] Demo 最终有 composition、still、MP4 三种可见结果
- [ ] 不依赖外部图片、远程字体和不可复现的网络状态
- [ ] 教材结尾给出下一步：安装 Skills，并用一个小 composition 实践主链
