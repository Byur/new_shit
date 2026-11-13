# Demos package

demos/ 是 new_shit monorepo 的独立 workspace package，用来存放不属于生产包的可运行实验和演示。

## 当前 demo

- motion-ai-kit-demo/：无依赖的本地 Motion AI Kit 交互演示。
- [clef-decision-lab/](clef-decision-lab/README.md)：Vue 3 + Hono + Bun 的 NPC 决策实验台，真实调用 Cloudflare Clef / Clef-flash，支持状态 A/B 与重复试验。
- output/playwright/：归属于 demos 包的历史浏览器验证截图。

## 运行

demos 自己管理运行命令，不在 monorepo 根 package.json 注册 demo 入口。从本包目录启动：

~~~bash
cd /Volumes/Project/new_shit/demos
npm run motion-ai-kit:serve
~~~

然后打开 http://127.0.0.1:4173。

Clef Decision Lab：

```bash
cd /Volumes/Project/new_shit/demos
npm run clef:install
npm run clef:dev
```

打开 http://localhost:5173。服务端读取 Demo 内 `.env`，并支持当前 monorepo 根 `.env` 的 Cloudflare 凭据；浏览器不读取密钥。详见 Demo README。

## 产物归属

- output/：本包自己的浏览器验证截图和演示产物。
- motion-ai-kit-demo/：独立、无依赖的本地演示源码。

不要把 demo 产物写入 monorepo 根目录，也不要把 demo 命令添加到根 package.json。
