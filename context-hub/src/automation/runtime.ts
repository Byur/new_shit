import {existsSync, readFileSync} from 'node:fs';
import {readlinkSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {ResolvedRuntime, RuntimePreference} from './types.ts';

/** Electron 用户数据目录；SingletonLock 指向 `<hostname>-<pid>`，可用来判断桌面实例是否真的活着。 */
export const DESKTOP_USER_DATA_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  '@deepseek-ai',
  'dsh-desktop',
);

/** dsh-context-hub-bridge 写出的发现文件：宿主监听端口与 pid。 */
export const DEFAULT_BRIDGE_STATE = path.join(os.homedir(), '.dsh', 'context-hub-bridge.json');
/** 与桥共享的密钥文件；缺失或为空时按「桥不可用」处理。 */
export const DEFAULT_BRIDGE_SECRET = path.join(os.homedir(), '.dsh', 'context-hub-bridge.secret');
/** 需要拉起时用的 App 名称。 */
export const DEFAULT_DESKTOP_APP = 'DeepSeek Harness';

export interface DesktopDetection {
  running: boolean;
  pid: number | null;
  detail: string;
}

export interface BridgeDetection {
  available: boolean;
  stateFile: string;
  secretFile: string;
  port: number | null;
  pid: number | null;
  detail: string;
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function detectDesktopRuntime(
  userDataDir: string = process.env.DSH_DESKTOP_USER_DATA || DESKTOP_USER_DATA_DIR,
): DesktopDetection {
  const lockPath = path.join(userDataDir, 'SingletonLock');
  let target: string;
  try {
    target = readlinkSync(lockPath);
  } catch {
    return {running: false, pid: null, detail: `未运行（未找到 ${lockPath}）`};
  }
  const pid = Number(/-(\d+)$/.exec(target)?.[1] ?? '');
  if (!Number.isInteger(pid) || pid <= 0) {
    return {running: false, pid: null, detail: `无法解析 SingletonLock 目标: ${target}`};
  }
  if (!isPidAlive(pid)) {
    return {running: false, pid: null, detail: `残留锁（pid ${pid} 已退出）`};
  }
  return {running: true, pid, detail: `运行中（pid ${pid}）`};
}

export function bridgeStatePath(): string {
  return process.env.CONTEXT_HUB_BRIDGE_STATE || DEFAULT_BRIDGE_STATE;
}

export function bridgeSecretPath(): string {
  return process.env.CONTEXT_HUB_BRIDGE_SECRET || DEFAULT_BRIDGE_SECRET;
}

/**
 * 判断宿主里的桥是否可用：发现文件存在、记录的宿主进程还活着、密钥文件非空。
 *
 * 这里只做本地文件与 pid 检查（同步、便宜）；真正的连通性由 HTTP health 探测确认。
 */
export function detectBridgeRuntime(
  stateFile: string = bridgeStatePath(),
  secretFile: string = bridgeSecretPath(),
): BridgeDetection {
  const unavailable = (detail: string, port: number | null = null, pid: number | null = null): BridgeDetection => ({
    available: false,
    stateFile,
    secretFile,
    port,
    pid,
    detail,
  });

  if (!existsSync(stateFile)) {
    return unavailable(`未找到 ${stateFile}（宿主未装 dsh-context-hub-bridge，或装后未重启）`);
  }
  let raw: {port?: unknown; pid?: unknown};
  try {
    raw = JSON.parse(readFileSync(stateFile, 'utf8')) as {port?: unknown; pid?: unknown};
  } catch (error) {
    return unavailable(`${stateFile} 无法解析: ${(error as Error).message}`);
  }
  const port = Number(raw.port);
  const pid = Number(raw.pid);
  if (!Number.isInteger(port) || port <= 0) return unavailable(`${stateFile} 没有有效端口`);
  if (!Number.isInteger(pid) || pid <= 0) return unavailable(`${stateFile} 没有有效 pid`, port, null);
  if (!isPidAlive(pid)) return unavailable(`桥记录的宿主进程 pid ${pid} 已退出（发现文件是残留）`, port, pid);
  if (!existsSync(secretFile)) return unavailable(`缺少密钥文件 ${secretFile}`, port, pid);
  let secret = '';
  try {
    secret = readFileSync(secretFile, 'utf8').trim();
  } catch (error) {
    return unavailable(`${secretFile} 不可读: ${(error as Error).message}`, port, pid);
  }
  if (secret === '') return unavailable(`密钥文件 ${secretFile} 为空`, port, pid);
  return {available: true, stateFile, secretFile, port, pid, detail: `桥可用（pid ${pid}, port ${port}）`};
}

export function runtimePreferenceFromEnv(value: string | undefined = process.env.CONTEXT_HUB_DSH_RUNTIME): RuntimePreference {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'desktop' || normalized === 'headless' || normalized === 'auto') return normalized;
  return 'auto';
}

/**
 * 解析运行时偏好。
 *
 * - `headless`：一次性 `dsh --profile headless`，没有会话、过程不可见。
 * - `desktop`：经桥在桌面宿主里建会话；桥不可用时 fail-closed，不静默降级。
 * - `auto`：桥可用就走桌面，否则回退 headless。
 */
export function resolveRuntime(
  preference?: RuntimePreference | string,
  detect: () => DesktopDetection = detectDesktopRuntime,
  detectBridge: () => BridgeDetection = detectBridgeRuntime,
): ResolvedRuntime {
  const normalized = typeof preference === 'string' && preference.trim() !== ''
    ? runtimePreferenceFromEnv(preference)
    : runtimePreferenceFromEnv();
  const desktop = detect();
  const bridge = detectBridge();
  const bridgeInfo = bridge.available && bridge.port !== null && bridge.pid !== null
    ? {stateFile: bridge.stateFile, port: bridge.port, pid: bridge.pid}
    : null;

  if (normalized === 'headless') {
    return {
      preference: normalized,
      resolved: 'headless',
      supported: true,
      desktopDetected: desktop.running,
      desktopPid: desktop.pid,
      bridge: bridgeInfo,
      detail: `headless 执行（桌面状态：${desktop.detail}；${bridge.detail}）`,
    };
  }

  if (normalized === 'desktop') {
    return {
      preference: normalized,
      resolved: 'desktop',
      supported: bridge.available,
      desktopDetected: desktop.running,
      desktopPid: desktop.pid,
      bridge: bridgeInfo,
      detail: bridge.available
        ? `desktop 执行：${bridge.detail}（桌面状态：${desktop.detail}）`
        : `desktop 执行不可用：${bridge.detail}。装好 dsh-context-hub-bridge 并重启桌面宿主，或改用 runtime=headless/auto`,
    };
  }

  const useDesktop = bridge.available;
  return {
    preference: normalized,
    resolved: useDesktop ? 'desktop' : 'headless',
    supported: true,
    desktopDetected: desktop.running,
    desktopPid: desktop.pid,
    bridge: bridgeInfo,
    detail: useDesktop
      ? `auto → desktop：${bridge.detail}`
      : `auto → headless：${bridge.detail}`,
  };
}
