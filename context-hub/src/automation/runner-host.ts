import {spawn} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {appendFile, writeFile} from 'node:fs/promises';
import {bridgeSecretPath, bridgeStatePath, DEFAULT_DESKTOP_APP, detectBridgeRuntime} from './runtime.ts';
import {parseResultContract} from './units.ts';
import type {DshRunResult, PermissionMode, ApprovalPolicy, ResolvedRuntime} from './types.ts';

/** 单次 HTTP 请求上限：创建会话要落盘+建目录，比轮询慢，但 30s 仍够。 */
const REQUEST_TIMEOUT_MS = 30_000;
/** 状态轮询间隔。宿主侧是内存快照读，2s 足够且不会明显耗 CPU。 */
const POLL_INTERVAL_MS = 2_000;
const POLL_INTERVAL_MIN_MS = 500;
/** 发 cancel 后等这一轮真正结束的上限；超过就按当前状态收尾。 */
const CANCEL_GRACE_MS = 60_000;
/** 唤醒桌面后等待桥写发现文件的上限。 */
const WAKE_TIMEOUT_MS = 90_000;
const WAKE_POLL_MS = 1_000;

export interface BridgeEndpoint {
  origin: string;
  secret: string;
  pid: number;
  port: number;
}

export interface HostRunRequest {
  prompt: string;
  /** 会话工作目录；工作区注册表能按它找到分组，就会挂进分组。 */
  cwd: string;
  title?: string;
  /** 额外可写目录；宿主会按会话注册成 sandbox 的额外根。 */
  addDirs?: string[];
  sandbox: PermissionMode;
  approval: ApprovalPolicy;
}

export interface HostStatus {
  sessionId: string;
  status: 'answered' | 'running' | 'idle';
  answer?: string;
  turn?: number;
  turnEndKind?: string;
  lastSeq?: number;
  seq?: number;
  error?: string;
}

export interface HostSubmitResult {
  sessionId: string;
  sinceSeq: number;
  workspaceId?: string;
  workspacePath?: string;
  workspaceTitle?: string;
}

export interface HostRunOptions {
  unitId: string;
  runId: string;
  cwd: string;
  prompt: string;
  title?: string;
  /** 额外可写目录，转成宿主的 sandbox 额外根。 */
  addDirs?: string[];
  permissionMode: PermissionMode;
  approvalPolicy: ApprovalPolicy;
  timeoutMinutes: number;
  stalledMinutes: number;
  logDir: string;
  /** 允许在宿主不可达时拉起桌面 App；只在显式 runtime=desktop 时开启。 */
  wake?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: {type: string; [key: string]: unknown}) => void;
}

function sleep(ms: number): Promise<void> {
  // 不要 unref：轮询间隙如果只剩这个定时器，unref 会让进程直接退出
  // （表现为「unsettled top-level await」）。
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 读一次桥的发现文件。
 *
 * 每次调用都重新读：宿主重启后端口会变，缓存 endpoint 会在下一次任务时打到死端口。
 *
 * @returns 可用的 endpoint；桥不可用时抛错并说明缺哪一步
 */
export function readBridgeEndpoint(): BridgeEndpoint {
  const stateFile = bridgeStatePath();
  const secretFile = bridgeSecretPath();
  const detection = detectBridgeRuntime(stateFile, secretFile);
  if (!detection.available || detection.port === null || detection.pid === null) {
    throw new Error(`桥不可用：${detection.detail}`);
  }
  const secret = readFileSync(secretFile, 'utf8').trim();
  // 用桥自己写出的 origin：它可能绑在 IPv6 或别的 host 上，也可能将来走 TLS。
  // 硬编码 http://127.0.0.1:<port> 在这些情况下会连不上。
  let origin = `http://127.0.0.1:${detection.port}`;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8')) as {origin?: unknown};
    if (typeof state.origin === 'string' && state.origin.trim() !== '') origin = state.origin.trim().replace(/\/+$/, '');
  } catch {
    // 发现文件的 origin 可选；退化到本机 loopback。
  }
  return {origin, secret, pid: detection.pid, port: detection.port};
}

async function requestJson<T>(
  endpoint: BridgeEndpoint,
  pathname: string,
  init: {method?: string; body?: unknown; timeoutMs?: number; signal?: AbortSignal} = {},
): Promise<T> {
  const signals = [AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS)];
  if (init.signal) signals.push(init.signal);
  const response = await fetch(`${endpoint.origin}${pathname}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-context-hub-secret': endpoint.secret,
      ...(init.body === undefined ? {} : {'content-type': 'application/json'}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.any(signals),
  });
  const text = await response.text();
  let value: unknown;
  try {
    value = text === '' ? {} : JSON.parse(text);
  } catch {
    throw new Error(`桥返回了非 JSON 响应（HTTP ${response.status}）：${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    const message = (value as {error?: unknown}).error;
    throw new Error(`桥请求失败（HTTP ${response.status}）：${typeof message === 'string' ? message : text.slice(0, 200)}`);
  }
  return value as T;
}

export async function bridgeHealth(endpoint: BridgeEndpoint): Promise<{ok: boolean; pid?: number; port?: number}> {
  return await requestJson(endpoint, '/context-hub/health', {timeoutMs: 5_000});
}

/**
 * 确保桥可用；`wake` 为真时先拉起桌面 App 再等发现文件。
 *
 * @param wake 是否允许 `open -a`
 * @returns 可用 endpoint
 */
export async function ensureBridgeEndpoint(wake: boolean): Promise<BridgeEndpoint> {
  try {
    const endpoint = readBridgeEndpoint();
    await bridgeHealth(endpoint);
    return endpoint;
  } catch (first) {
    if (!wake) throw first;
  }

  const app = process.env.CONTEXT_HUB_BRIDGE_APP || DEFAULT_DESKTOP_APP;
  await new Promise<void>((resolve, reject) => {
    const child = spawn('open', ['-a', app], {stdio: 'ignore', detached: true});
    child.on('error', reject);
    child.on('spawn', () => {
      child.unref();
      resolve();
    });
  }).catch((error: Error) => {
    throw new Error(`唤醒 ${app} 失败：${error.message}`);
  });

  const deadline = Date.now() + WAKE_TIMEOUT_MS;
  // 发现文件从未出现过，和「有文件但 pid 已死」是两种不同的故障：
  // 前者多半是插件没装/没挂载，等下去不会变；后者是宿主正在重启，值得等。
  const sawStateFile = existsSync(bridgeStatePath());
  let last = '';
  while (Date.now() < deadline) {
    await sleep(WAKE_POLL_MS);
    try {
      const endpoint = readBridgeEndpoint();
      await bridgeHealth(endpoint);
      return endpoint;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (!sawStateFile && Date.now() - (deadline - WAKE_TIMEOUT_MS) >= 15_000) {
      throw new Error(`${app} 已启动，但桥始终没有写出 ${bridgeStatePath()}——检查 dsh-context-hub-bridge 是否已装进该 profile 并挂进 bundles。最后错误：${last}`);
    }
  }
  throw new Error(`已拉起 ${app}，但 ${Math.round(WAKE_TIMEOUT_MS / 1000)}s 内桥仍不可用：${last}`);
}

export async function submitHostRun(endpoint: BridgeEndpoint, request: HostRunRequest, signal?: AbortSignal): Promise<HostSubmitResult> {
  const value = await requestJson<HostSubmitResult>(endpoint, '/context-hub/run', {
    method: 'POST',
    signal,
    body: {
      prompt: request.prompt,
      workspacePath: request.cwd,
      ...(request.title === undefined ? {} : {title: request.title}),
      ...(request.addDirs === undefined || request.addDirs.length === 0 ? {} : {addDirs: request.addDirs}),
      sandbox: request.sandbox,
      approval: request.approval,
    },
  });
  if (typeof value.sessionId !== 'string' || value.sessionId === '') throw new Error('桥没有返回 sessionId');
  if (typeof value.sinceSeq !== 'number' || !Number.isFinite(value.sinceSeq)) {
    throw new Error('桥没有返回 sinceSeq；无法区分这条任务的轮次和上一轮');
  }
  return value;
}

export async function pollHostRun(endpoint: BridgeEndpoint, sessionId: string, sinceSeq: number, signal?: AbortSignal): Promise<HostStatus> {
  return await requestJson<HostStatus>(endpoint, `/context-hub/run/${encodeURIComponent(sessionId)}?sinceSeq=${sinceSeq}`, {
    timeoutMs: 15_000,
    signal,
  });
}

export async function cancelHostRun(endpoint: BridgeEndpoint, sessionId: string): Promise<void> {
  await requestJson(endpoint, `/context-hub/run/${encodeURIComponent(sessionId)}/cancel`, {method: 'POST', timeoutMs: 15_000});
}

/**
 * 在宿主里跑一个单元：提交 → 轮询 → 超时/停滞/取消时收尾。
 *
 * 语义与 headless 版对齐：同一个 `result.json`、同样的 ok 判定、同样把答案当作
 * 契约文本解析。差别只有执行位置——这里是宿主里的真实会话。
 *
 * @param options 单元参数
 * @param runtime 已经解析过的运行时信息
 * @returns 与 headless 同形的结果
 */
export async function runUnitOnHost(options: HostRunOptions, runtime: ResolvedRuntime): Promise<DshRunResult> {
  const resultPath = path.join(options.logDir, 'result.json');
  const stdoutPath = path.join(options.logDir, 'stdout.jsonl');
  const startedAt = Date.now();
  const timeoutMs = Math.max(60_000, options.timeoutMinutes * 60_000);
  const stalledMs = Math.max(60_000, options.stalledMinutes * 60_000);
  const pollMs = Math.min(POLL_INTERVAL_MS, Math.max(POLL_INTERVAL_MIN_MS, Math.floor(stalledMs / 20)));

  const log = async (event: Record<string, unknown>) => {
    await appendFile(stdoutPath, `${JSON.stringify({at: new Date().toISOString(), ...event})}\n`, 'utf8').catch(() => {});
    try {
      options.onEvent?.({type: 'host', ...event});
    } catch {
      // 流式回调失败不影响任务
    }
  };

  const finish = async (fields: Omit<DshRunResult, 'logDir' | 'runtime' | 'durationMs' | 'exitCode' | 'tools'> & {exitCode?: number | null; tools?: string[]}): Promise<DshRunResult> => {
    const result: DshRunResult = {
      ...fields,
      exitCode: fields.exitCode ?? null,
      durationMs: Date.now() - startedAt,
      tools: fields.tools ?? [],
      logDir: options.logDir,
      runtime,
    };
    await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8').catch(() => {});
    return result;
  };

  let endpoint: BridgeEndpoint;
  try {
    endpoint = await ensureBridgeEndpoint(options.wake === true);
  } catch (error) {
    return await finish({
      ok: false,
      sessionId: '',
      text: '',
      turnEndKind: '',
      error: error instanceof Error ? error.message : String(error),
      contract: null,
    });
  }

  let submitted: HostSubmitResult;
  try {
    submitted = await submitHostRun(endpoint, {
      prompt: options.prompt,
      cwd: options.cwd,
      title: options.title,
      addDirs: options.addDirs,
      sandbox: options.permissionMode,
      approval: options.approvalPolicy,
    }, options.signal);
  } catch (error) {
    return await finish({
      ok: false,
      sessionId: '',
      text: '',
      turnEndKind: '',
      error: `提交到宿主失败：${error instanceof Error ? error.message : String(error)}`,
      contract: null,
    });
  }

  const {sessionId, sinceSeq} = submitted;
  await log({event: 'submitted', sessionId, sinceSeq, port: endpoint.port, pid: endpoint.pid, workspacePath: submitted.workspacePath ?? null});

  /** 一次可解释的停止原因；null 表示还没决定停。 */
  let stopReason: 'timeout' | 'stalled' | 'aborted' | null = null;
  let cancelAt: number | null = null;
  let lastSeq: number | undefined;
  let lastProgressAt = startedAt;

  for (;;) {
    if (stopReason === null) {
      const now = Date.now();
      if (options.signal?.aborted) stopReason = 'aborted';
      else if (now - startedAt >= timeoutMs) stopReason = 'timeout';
    }

    let status: HostStatus;
    try {
      status = await pollHostRun(endpoint, sessionId, sinceSeq);
    } catch (error) {
      // 一次轮询失败不等于任务失败：App 重启、ECONNRESET、15s 超时都会走到这里。
      // 关键是**先取消**再判失败——否则 30 分钟后重试会另起一个会话，
      // 而第一个还在跑、还在写卡片和图。
      if (stopReason === null) {
        const message = error instanceof Error ? error.message : String(error);
        await log({event: 'poll_failed', message});
        await cancelHostRun(endpoint, sessionId).catch((cancelError: Error) => {
          void log({event: 'cancel_failed', reason: cancelError.message});
        });
        return await finish({
          ok: false,
          sessionId,
          text: '',
          turnEndKind: '',
          error: `轮询宿主失败（已请求取消该会话）：${message}`,
          contract: null,
        });
      }
      break;
    }

    if (status.lastSeq !== undefined && status.lastSeq !== lastSeq) {
      lastSeq = status.lastSeq;
      lastProgressAt = Date.now();
    }
    // 宿主说这一轮还在跑，就是活着的证据：长任务（成稿、出图）可以长时间没有新事件，
    // 只有「既没在跑、也没交出答案」才算停滞。运行时长本身不是失败条件。
    if (status.status === 'running') lastProgressAt = Date.now();

    if (status.status === 'answered') {
      const text = status.answer ?? '';
      const contract = parseResultContract(text);
      const endKind = status.turnEndKind ?? '';
      const completed = endKind === 'completed';
      // 硬超时是兜底，不是精确闸门：如果宿主在超时判定之后、取消生效之前已经交出了
      // 完整答案，接受它。丢掉一份已经跑完的成果，比晚几秒收尾更糟。
      const ok = completed && (stopReason === null || stopReason === 'timeout');
      if (ok && stopReason === 'timeout') {
        await log({event: 'answered_after_timeout', turn: status.turn, chars: text.length});
      }
      await log({event: 'answered', turn: status.turn, turnEndKind: endKind, lastSeq: status.lastSeq ?? null, chars: text.length});
      return await finish({
        ok,
        sessionId,
        text,
        turnEndKind: endKind,
        // 与 headless 对齐：正常结束给 0，让「没有 JSON 契约」按业务失败处理，
        // 而不是被当成可重试的基础设施故障。
        exitCode: ok ? 0 : 1,
        error: ok
          ? ''
          : stopReason === 'timeout'
            ? `执行超过 ${options.timeoutMinutes} 分钟被取消`
            : stopReason === 'stalled'
              ? `会话既未在运行、也没有产出，已静默 ${options.stalledMinutes} 分钟`
              : stopReason === 'aborted'
                ? '调用方取消了执行'
                : endKind === 'aborted'
                  ? '宿主里的轮次被取消'
                  : `宿主轮次结束状态为 ${endKind || 'unknown'}`,
        contract: contract.contract,
        ...(contract.error ? {contractParseError: contract.error} : {}),
        ...(stopReason === 'timeout' && !ok ? {timedOut: true} : {}),
        ...(stopReason === 'stalled' ? {stalled: true} : {}),
      });
    }

    if (stopReason === null && Date.now() - lastProgressAt >= stalledMs) stopReason = 'stalled';
    if (stopReason !== null && cancelAt === null) {
      cancelAt = Date.now();
      await log({event: 'cancel', reason: stopReason});
      await cancelHostRun(endpoint, sessionId).catch((error: Error) => {
        void log({event: 'cancel_failed', reason: error.message});
      });
    }

    await log({event: 'poll', status: status.status, lastSeq: status.lastSeq ?? null});
    if (cancelAt !== null && Date.now() - cancelAt >= CANCEL_GRACE_MS) {
      return await finish({
        ok: false,
        sessionId,
        text: '',
        turnEndKind: '',
        error: `已请求取消，但宿主在 ${Math.round(CANCEL_GRACE_MS / 1000)}s 内没有结束该轮次`,
        contract: null,
        ...(stopReason === 'timeout' ? {timedOut: true} : {}),
        ...(stopReason === 'stalled' ? {stalled: true} : {}),
      });
    }
    await sleep(pollMs);
  }

  return await finish({
    ok: false,
    sessionId,
    text: '',
    turnEndKind: '',
    error: `宿主执行已结束但没有拿到轮次结果（${stopReason ?? 'unknown'}）`,
    contract: null,
    ...(stopReason === 'timeout' ? {timedOut: true} : {}),
    ...(stopReason === 'stalled' ? {stalled: true} : {}),
  });
}
