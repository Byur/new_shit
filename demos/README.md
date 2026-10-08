# Demos package

demos/ 是 new_shit monorepo 的独立 workspace package，用来存放不属于生产包的可运行实验和演示。

## 当前 demo

- motion-ai-kit-demo/：无依赖的本地 Motion AI Kit 交互演示。
- output/playwright/：归属于 demos 包的历史浏览器验证截图。

## 运行

demos 自己管理运行命令，不在 monorepo 根 package.json 注册 demo 入口。从本包目录启动：

~~~bash
cd /Volumes/Project/new_shit/demos
npm run motion-ai-kit:serve
~~~

然后打开 http://127.0.0.1:4173。

## 产物归属

- output/：本包自己的浏览器验证截图和演示产物。
- motion-ai-kit-demo/：独立、无依赖的本地演示源码。

不要把 demo 产物写入 monorepo 根目录，也不要把 demo 命令添加到根 package.json。
