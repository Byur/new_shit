import {existsSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {FeishuNotifier} from './automation/notify-feishu.ts';
import {DshRunner} from './automation/runner-dsh.ts';
import {AutomationScheduler} from './automation/scheduler.ts';
import {CONTEXT_HUB_ROOT} from './automation/units.ts';
import {loadEnvFiles} from './env-file.ts';
import {DEFAULT_DB_PATH, initDatabase, openDatabase} from './lib.ts';
import {createMcpServer} from './mcp-server.ts';
import {createDashboardServer} from './server.ts';

// 部署 env（~/.config/context-hub/env）→ 仓库根 .env；只补未设置的键，真实环境变量永远优先。
// 必须在读取 CONTEXT_HUB_* 端口/路径和创建 FeishuNotifier 之前执行。
await loadEnvFiles({info: (message) => console.log(message), warn: (message) => console.warn(message)});

function isPidRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function acquirePidFile(pidFile: string): Promise<void> {
  await mkdir(path.dirname(pidFile), {recursive: true});
  if (existsSync(pidFile)) {
    const raw = (await readFile(pidFile, 'utf8')).trim();
    const oldPid = Number(raw);
    if (oldPid && oldPid !== process.pid && isPidRunning(oldPid)) {
      throw new Error(`context-hub serve is already running (pid=${oldPid}, pidfile=${pidFile})`);
    }
  }
  await writeFile(pidFile, `${process.pid}\n`, 'utf8');
}

const dbPath = process.env.CONTEXT_HUB_DB ? path.resolve(process.env.CONTEXT_HUB_DB) : DEFAULT_DB_PATH;
const dashboardPort = Number(process.env.CONTEXT_HUB_PORT || 4321);
const mcpPort = Number(process.env.CONTEXT_HUB_MCP_PORT || 7777);
const pidFile = process.env.CONTEXT_HUB_PIDFILE
  ? path.resolve(process.env.CONTEXT_HUB_PIDFILE)
  : path.join(CONTEXT_HUB_ROOT, 'data', 'context-hub.pid');

const bootNotifier = new FeishuNotifier();

try {
  await acquirePidFile(pidFile);
} catch (error) {
  console.error((error as Error).message);
  await bootNotifier.notifyAlert({
    level: 'P1',
    kind: 'serve_single_instance',
    title: 'context-hub 单实例锁冲突',
    signal: (error as Error).message,
    scope: '常驻守护进程启动失败',
    action: '检查 ps / launchctl 是否已有重复实例',
  });
  process.exit(1);
}

await initDatabase(dbPath);
const db = openDatabase(dbPath);
const notifier = new FeishuNotifier({db});
const runner = new DshRunner();
const scheduler = new AutomationScheduler({db, runner, notifier});

await scheduler.init();

const dashboard = createDashboardServer({
  port: dashboardPort,
  dbPath,
  db,
  automation: {scheduler},
});
const mcp = createMcpServer({
  port: mcpPort,
  dbPath,
  db,
});

try {
  await dashboard.listen();
  await mcp.listen();
} catch (error) {
  const message = `端口绑定失败 (${dashboardPort}/${mcpPort}): ${(error as Error).message}`;
  console.error(message);
  await notifier.notifyAlert({
    level: 'P1',
    kind: 'serve_port_conflict',
    title: 'context-hub 端口被占用，常驻启动失败',
    signal: message,
    scope: '4321 dashboard / 7777 MCP / 自动化调度未启动',
    action: `lsof -i :${dashboardPort} -i :${mcpPort} 检查占用进程并重启 launchd`,
  });
  await dashboard.close().catch(() => {});
  await mcp.close().catch(() => {});
  db.close();
  await rm(pidFile, {force: true}).catch(() => {});
  process.exit(1);
}

scheduler.start();
console.log(`Context Hub resident daemon started (pid=${process.pid})`);
console.log(`- Dashboard & Automation: http://127.0.0.1:${dashboard.port}/automation`);
console.log(`- MCP: http://127.0.0.1:${mcp.port}/mcp (GitHub: /github/mcp)`);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Context Hub shutting down (${signal})...`);
  // 先中止在飞运行，再等它们收尾：宿主里的轮次需要一次 HTTP cancel 才算真的停。
  // 不等就 exit 会把会话留在桌面里继续跑，下次启动还会被崩溃恢复判成失败。
  await scheduler.shutdown().catch((error: Error) => console.warn(`scheduler shutdown: ${error.message}`));
  await Promise.allSettled([dashboard.close(), mcp.close()]);
  db.close();
  await rm(pidFile, {force: true}).catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// 以前 `void scheduler.executeTaskRun(...)` 的 rejection 会直接把守护进程带走。
// 现在隔离成日志 + 告警：一条任务失败不该让常驻调度整体退出。
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`unhandledRejection: ${message}`);
  void notifier
    .notifyAlert({
      level: 'P1',
      kind: 'daemon_unhandled_rejection',
      title: 'context-hub 捕获未处理的 Promise 拒绝',
      signal: message.slice(0, 500),
      scope: '守护进程仍在运行；该次运行可能已失败',
      action: '查看 dashboard 运行记录与日志，确认是否有任务需要重试',
    })
    .catch(() => {});
});
