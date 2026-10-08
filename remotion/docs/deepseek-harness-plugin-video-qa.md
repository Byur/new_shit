# DeepSeek Harness 插件介绍视频 QA

日期：2026-10-07

## 输出规格

- Composition：`DeepSeekHarnessPlugins`
- 画面：1920×1080，30 fps，6120 帧，204 秒
- 编码：H.264 视频 + AAC 音频
- 文件：[deepseek-harness-plugins.mp4](/Volumes/Project/new_shit/remotion/output/deepseek-harness-plugins/deepseek-harness-plugins.mp4)

## 已完成检查

- `npm run lint`：通过（ESLint + TypeScript）
- `npm run build`：通过（Remotion bundle）
- Composition 列表：确认 1920×1080 / 30 fps / 204 秒
- 源帧边界检查：对每个场景的 N-1 / N / N+1，并抽查 N+6 / N+12；修正了切入帧主内容过暗的问题
- 编码后边界抽帧：0、12、39、47、71、84、107、129、152、183、203 秒；确认标题、卡片、字幕和来源行可读
- `ffprobe`：视频为 1920×1080、30/1、6120 帧、204 秒；音频为 48 kHz 双声道 AAC、204.053 秒
- 完整视频解码：通过（Remotion bundled FFmpeg，rawvideo null sink）
- 完整音频解码：通过（Remotion bundled FFmpeg，PCM null sink）

## 交互预览说明

本机 Studio 交互预览未完成：默认端口范围均被占用，浏览器请求头策略也不可用。正式交付依据是 headless 源帧/边界帧检查、编码后关键帧抽查、ffprobe 元数据和完整音视频解码；没有把 Studio 未打开误报成已验证。
