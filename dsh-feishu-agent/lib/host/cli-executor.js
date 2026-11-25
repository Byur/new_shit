/** CLI 执行器：用 `dsh --profile headless` 子进程跑一轮，解析 `--json` 事件流。 */

import { spawn as nodeSpawn } from 'node:child_process';

import { errorMessage } from './services.js';

/** 单轮超时（毫秒）：超时就杀掉子进程，避免插件里挂一个永远不结束的进程。 */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** 单行事件上限（与 headless 自己的 32 KiB 上限对齐，留点余量）。 */
const MAX_LINE_BYTES = 64 * 1024;

/** 宿主 `--json` 会写的 stderr 前缀；其余 stderr 只进调试日志。 */
const STDERR_PREFIX = 'dsh:';

/**
 * 找 CLI 可执行文件。
 *
 * 顺序：显式配置 → 环境变量 → Desktop 自带 runtime → PATH 里的 dsh。
 *
 * @param configured 配置里给的路径
 * @returns 可执行文件路径
 */
export function resolveCliPath(configured) {
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  const fromEnv = process.env.FEISHU_AGENT_CLI ?? process.env.DSH_FEISHU_AGENT_CLI;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim();
  // Desktop 自带的 CLI 与 Desktop 同版本，优先用它（避免 PATH 里旧版 CLI 采纳规则不一致）。
  const bundled = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh';
  return bundled;
}

/**
 * 把 `--json` 的 NDJSON 事件流解析成一串事件。
 *
 * @param lines 一段文本（可含多行，末尾可以是不完整的行）
 * @yields 解析成功的事件对象
 */
export function* parseJsonLines(lines) {
  for (const line of lines.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || !trimmed.startsWith('{')) continue;
    try {
      yield JSON.parse(trimmed);
    } catch {
      // 单行解析失败不该打断整轮；headless 偶尔会在同一行里写诊断。
    }
  }
}

/**
 * 把一轮的事件流折叠成结果。
 *
 * @param events 收齐的事件
 * @returns `{ sessionId, text, turnEndKind, error, tools }`
 */
export function foldRun(events) {
  let sessionId = '';
  let text = '';
  let turnEndKind = '';
  let error = '';
  const tools = [];
  for (const event of events) {
    if (event.type === 'session' && typeof event.sessionId === 'string') sessionId = event.sessionId;
    if (event.type === 'error' && typeof event.message === 'string') error = event.message;
    if (event.type === 'text' && typeof event.text === 'string') text += event.text;
    if (event.type === 'status' && event.phase === 'turn_end') {
      turnEndKind = String(event.reason?.kind ?? '');
      if (event.reason?.error?.message !== undefined) error = String(event.reason.error.message);
    }
    if (event.type === 'tool_call' && typeof event.tool === 'string') tools.push(event.tool);
    if (event.type === 'final') {
      // final 是权威正文（不截断）；有它就用它，避免中间 text 被 8KiB 截断。
      if (typeof event.text === 'string' && event.text !== '') text = event.text;
      if (typeof event.sessionId === 'string' && sessionId === '') sessionId = event.sessionId;
      if (event.reason?.kind !== undefined && turnEndKind === '') turnEndKind = String(event.reason.kind);
      if (event.reason?.error?.message !== undefined && error === '') error = String(event.reason.error.message);
    }
  }
  return { sessionId, text, turnEndKind, error, tools };
}

/**
 * 建 CLI 执行器。
 *
 * @param deps.logger 日志
 * @param deps.getConfig 取执行器配置：`() => ({ cliPath, cwd, timeoutMs })`
 * @param deps.spawn 测试注入的 spawn（默认 `node:child_process.spawn`）
 * @returns 执行器：`run()`
 */
export function createCliExecutor({ logger, getConfig, spawn = nodeSpawn }) {
  /** 正在跑的进程：runId → 句柄。 */
  const running = new Map();

  /**
   * 跑一轮。
   *
   * @param options.runId 本次执行身份（插件内部）
   * @param options.sessionId 续写的会话 ID；省略表示新建
   * @param options.prompt 任务文本
   * @param options.onEvent 每条事件的回调（可空）
   * @param options.signal 取消信号（可空）
   * @param options.cwd 这一轮的工作目录（默认取执行器配置里的 cwd）
   * @returns `{ ok, sessionId, text, turnEndKind, error, exitCode, durationMs }`
   */
  async function run({ runId, sessionId, prompt, onEvent, signal, cwd: runCwd }) {
    const { cliPath, cwd, timeoutMs = DEFAULT_TIMEOUT_MS, profile = 'headless', extraEnv } = getConfig();
    const args = ['--profile', profile, '--json'];
    if (typeof sessionId === 'string' && sessionId !== '') args.push('--session-id', sessionId);
    args.push(prompt);

    const startedAt = Date.now();
    const events = [];
    let stderrTail = '';
    let stdoutTail = '';

    const child = spawn(cliPath, args, {
      // 会话的 cwd 由子进程的工作目录决定：必须落在绑定的工作区里，
      // 否则工作区的「校验式会话挂载」会拒绝它，会话也会跑错目录。
      cwd: runCwd ?? cwd,
      env: { ...process.env, ...(extraEnv ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    running.set(runId, child);

    return await new Promise((resolve) => {
      let settled = false;
      let buffer = '';

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener?.('abort', onAbort);
        running.delete(runId);
        resolve(result);
      };

      const consume = (chunk) => {
        buffer += chunk;
        // 防止单次输出把内存撑爆：超过上限就把旧的截掉。
        if (buffer.length > MAX_LINE_BYTES * 8) buffer = buffer.slice(-MAX_LINE_BYTES);
        let index = buffer.indexOf('\n');
        while (index >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          for (const event of parseJsonLines(line)) {
            events.push(event);
            try {
              onEvent?.(event);
            } catch (error) {
              logger.warn(`CLI 事件回调抛错（忽略）：${errorMessage(error)}`);
            }
          }
          index = buffer.indexOf('\n');
        }
      };

      const timer = setTimeout(() => {
        logger.warn(`CLI 执行超时（${timeoutMs}ms），杀掉子进程：${runId}`);
        try {
          child.kill('SIGTERM');
        } catch {
          // 已经退出就忽略。
        }
        const folded = foldRun(events);
        finish({
          ok: false,
          ...folded,
          error: folded.error || `执行超时（${Math.round(timeoutMs / 1000)}s）`,
          exitCode: null,
          durationMs: Date.now() - startedAt,
          timedOut: true,
        });
      }, timeoutMs);
      timer.unref?.();

      const onAbort = () => {
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
      };
      if (signal?.aborted === true) onAbort();
      else signal?.addEventListener?.('abort', onAbort, { once: true });

      child.stdout?.setEncoding?.('utf8');
      child.stderr?.setEncoding?.('utf8');
      child.stdout?.on('data', (chunk) => {
        stdoutTail = (stdoutTail + chunk).slice(-4096);
        consume(String(chunk));
      });
      child.stderr?.on('data', (chunk) => {
        const text = String(chunk);
        stderrTail = (stderrTail + text).slice(-4096);
        for (const line of text.split('\n')) {
          if (line.startsWith(STDERR_PREFIX)) logger.warn(`CLI: ${line.slice(STDERR_PREFIX.length).trim()}`);
        }
      });

      child.on('error', (error) => {
        logger.warn(`CLI 进程启动失败：${errorMessage(error)}`);
        finish({ ok: false, sessionId: '', text: '', turnEndKind: '', error: errorMessage(error), exitCode: null, durationMs: Date.now() - startedAt });
      });

      child.on('close', (code) => {
        // 收尾残行。
        for (const event of parseJsonLines(buffer)) events.push(event);
        const folded = foldRun(events);
        const ok = code === 0 && folded.turnEndKind === 'completed';
        if (!ok && folded.error === '') {
          const hint = stderrTail.trim() || stdoutTail.trim();
          logger.warn(`CLI 退出码 ${code}，turnEnd=${folded.turnEndKind || '(无)'}${hint ? `；输出尾部：${hint.slice(-400)}` : ''}`);
        }
        finish({
          ok,
          ...folded,
          error: folded.error || (ok ? '' : `CLI 退出码 ${code}${folded.turnEndKind ? `（${folded.turnEndKind}）` : ''}`),
          exitCode: code,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }

  /**
   * 杀掉某个执行（停止按钮用）。
   *
   * @param runId 执行身份
   * @returns 杀掉时 true
   */
  function cancel(runId) {
    const child = running.get(runId);
    if (child === undefined) return false;
    try {
      child.kill('SIGTERM');
    } catch {
      return false;
    }
    return true;
  }

  /**
   * 正在跑的执行数。
   *
   * @returns 数量
   */
  function size() {
    return running.size;
  }

  return { run, cancel, size };
}
