import {spawn as nodeSpawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {appendFile, mkdir, readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {ChildProcess} from 'node:child_process';
import {DEFAULT_DSH_CLI_PATH, DEFAULT_DSH_HOME} from './preflight.ts';
import {runUnitOnHost} from './runner-host.ts';
import {resolveRuntime, runtimePreferenceFromEnv} from './runtime.ts';
import type {ApprovalPolicy, DshEvent, DshRunResult, PermissionMode, RuntimePreference} from './types.ts';
import {parseResultContract} from './units.ts';

const MAX_LINE_BYTES = 64 * 1024;

export function* parseJsonLines(chunk: string): Generator<DshEvent> {
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || !trimmed.startsWith('{')) continue;
    try {
      yield JSON.parse(trimmed) as DshEvent;
    } catch {
      // ignore non-json diagnostic lines
    }
  }
}

export function foldDshEvents(events: DshEvent[]): {
  sessionId: string;
  text: string;
  turnEndKind: string;
  error: string;
  tools: string[];
} {
  let sessionId = '';
  let text = '';
  let turnEndKind = '';
  let error = '';
  const tools: string[] = [];

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
      if (typeof event.text === 'string' && event.text !== '') text = event.text;
      if (typeof event.sessionId === 'string' && sessionId === '') sessionId = event.sessionId;
      if (event.reason?.kind !== undefined && turnEndKind === '') turnEndKind = String(event.reason.kind);
      if (event.reason?.error?.message !== undefined && error === '') error = String(event.reason.error.message);
    }
  }

  return {sessionId, text, turnEndKind, error, tools};
}

export async function latestFileMtimeMs(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  let maxMtime = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        const info = await stat(full);
        if (info.mtimeMs > maxMtime) maxMtime = info.mtimeMs;
        if (entry.isDirectory()) stack.push(full);
      } catch {
        // ignore transient file removals
      }
    }
  }
  return maxMtime;
}

export interface DshRunnerOptions {
  cliPath?: string;
  dshHome?: string;
  patchPath?: string;
  /** 默认运行时偏好；单次 runUnit 可用 options.runtime 覆盖。 */
  runtime?: RuntimePreference;
  spawn?: typeof nodeSpawn;
}

export interface DshRunUnitOptions {
  runId: string;
  unitId: string;
  cwd: string;
  watchDir?: string;
  addDirs?: string[];
  extraEnv?: Record<string, string>;
  logDir: string;
  prompt: string;
  /** 会话标题；只在宿主运行时用于侧栏展示。 */
  title?: string;
  permissionMode: PermissionMode;
  approvalPolicy: ApprovalPolicy;
  runtime?: RuntimePreference;
  timeoutMinutes: number;
  stalledMinutes: number;
  sessionId?: string;
  signal?: AbortSignal;
  onEvent?: (event: DshEvent) => void;
}

export class DshRunner {
  private readonly cliPath: string;
  private readonly dshHome: string;
  private readonly patchPath: string;
  private readonly defaultRuntime: RuntimePreference;
  private readonly spawnFn: typeof nodeSpawn;
  private readonly activeChildren = new Map<string, ChildProcess>();
  /** 宿主执行的取消钩子；与子进程分开存，因为宿主任务没有本地进程。 */
  private readonly activeHostRuns = new Map<string, () => void>();

  constructor(options: DshRunnerOptions = {}) {
    this.cliPath = options.cliPath || process.env.CONTEXT_HUB_DSH_CLI || DEFAULT_DSH_CLI_PATH;
    this.dshHome = options.dshHome || process.env.CONTEXT_HUB_DSH_HOME || DEFAULT_DSH_HOME;
    this.patchPath = options.patchPath || process.env.CONTEXT_HUB_DSH_PATCH || '';
    this.defaultRuntime = options.runtime ?? runtimePreferenceFromEnv();
    this.spawnFn = options.spawn ?? nodeSpawn;
  }

  /** 看板/dry-run 用：展示运行时探测结果，不启动进程。 */
  describeRuntime(preference?: RuntimePreference): ReturnType<typeof resolveRuntime> {
    return resolveRuntime(preference ?? this.defaultRuntime);
  }

  killUnit(unitId: string): boolean {
    const hostCancel = this.activeHostRuns.get(unitId);
    if (hostCancel !== undefined) {
      hostCancel();
      return true;
    }
    const child = this.activeChildren.get(unitId);
    if (!child) return false;
    try {
      child.kill('SIGTERM');
      return true;
    } catch {
      return false;
    }
  }

  async runUnit(options: DshRunUnitOptions): Promise<DshRunResult> {
    await mkdir(options.logDir, {recursive: true});
    const envelopePath = path.join(options.logDir, 'envelope.md');
    const stdoutPath = path.join(options.logDir, 'stdout.jsonl');
    const stderrPath = path.join(options.logDir, 'stderr.log');
    const resultPath = path.join(options.logDir, 'result.json');

    await writeFile(envelopePath, options.prompt, 'utf8');
    await writeFile(stdoutPath, '', 'utf8');
    await writeFile(stderrPath, '', 'utf8');

    const runtime = resolveRuntime(options.runtime ?? this.defaultRuntime);
    // desktop 偏好即使当前探测为不可用也交给宿主执行器：它会先尝试唤醒桌面，
    // 再决定是否记基础设施失败。只有 non-desktop 的 unsupported 才就地拒绝。
    if (runtime.resolved === 'desktop' || (runtime.preference === 'desktop' && !runtime.supported)) {
      // 桌面路径**不能**注入 extraEnv：宿主 App 的环境在它启动时就固定了，
      // 往协议里加 env 只会让人以为生效了。同样的值由运行信封写进 prompt
      // （物料根、工作区），会话必须显式传参或加前缀。
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (options.signal?.aborted) controller.abort();
      else options.signal?.addEventListener('abort', onAbort, {once: true});
      this.activeHostRuns.set(options.unitId, () => controller.abort());
      try {
        return await runUnitOnHost(
          {
            unitId: options.unitId,
            runId: options.runId,
            cwd: options.cwd,
            prompt: options.prompt,
            title: options.title,
            addDirs: options.addDirs,
            permissionMode: options.permissionMode,
            approvalPolicy: options.approvalPolicy,
            timeoutMinutes: options.timeoutMinutes,
            stalledMinutes: options.stalledMinutes,
            logDir: options.logDir,
            wake: runtime.preference === 'desktop' && process.env.CONTEXT_HUB_BRIDGE_WAKE !== '0',
            signal: controller.signal,
            onEvent: options.onEvent,
          },
          runtime,
        );
      } finally {
        this.activeHostRuns.delete(options.unitId);
        options.signal?.removeEventListener('abort', onAbort);
      }
    }
    if (!runtime.supported) {
      const refused: DshRunResult = {
        ok: false,
        sessionId: '',
        text: '',
        turnEndKind: '',
        error: runtime.detail,
        exitCode: null,
        durationMs: 0,
        tools: [],
        contract: null,
        logDir: options.logDir,
        runtime,
      };
      await writeFile(resultPath, JSON.stringify(refused, null, 2), 'utf8').catch(() => {});
      return refused;
    }

    const args = ['--profile', 'headless'];
    if (this.patchPath && existsSync(this.patchPath)) {
      args.push('--patch', this.patchPath);
    }
    args.push('--json', '--permission-mode', options.permissionMode, '--approval-policy', options.approvalPolicy);
    if (options.permissionMode === 'workspace-write' && options.addDirs) {
      for (const dir of options.addDirs) {
        if (dir && path.isAbsolute(dir)) args.push('--add-dir', dir);
      }
    }
    if (options.sessionId) {
      args.push('--session-id', options.sessionId);
    }
    args.push('-'); // read prompt from stdin

    const startedAt = Date.now();
    let lastEventAt = startedAt;
    const events: DshEvent[] = [];
    const child = this.spawnFn(this.cliPath, args, {
      cwd: options.cwd,
      env: {...process.env, ...(options.extraEnv ?? {}), DSH_HOME: this.dshHome},
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.activeChildren.set(options.unitId, child);

    try {
      child.stdin?.end(options.prompt, 'utf8');
    } catch {
      // ignore if child failed immediately
    }

    const timeoutMs = Math.max(1_000, options.timeoutMinutes * 60_000);
    const stalledMs = Math.max(5_000, options.stalledMinutes * 60_000);
    const pollIntervalMs = Math.min(30_000, Math.max(1_000, Math.floor(stalledMs / 4)));

    return await new Promise<DshRunResult>((resolve) => {
      let settled = false;
      let buffer = '';
      let timedOut = false;
      let stalled = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | null = null;
      let writeQueue: Promise<void> = Promise.resolve();

      const enqueueWrite = (file: string, data: string) => {
        writeQueue = writeQueue.then(() => appendFile(file, data, 'utf8')).catch(() => {});
      };

      const terminateChild = () => {
        try {
          child.kill('SIGTERM');
        } catch {
          return;
        }
        forceKillTimer = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // already exited
          }
        }, 5_000);
        forceKillTimer.unref?.();
      };

      const finish = async (exitCode: number | null, spawnError?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        clearInterval(staleTimer);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        options.signal?.removeEventListener('abort', onAbort);
        this.activeChildren.delete(options.unitId);

        if (buffer.trim() !== '') {
          for (const event of parseJsonLines(buffer)) events.push(event);
        }
        await writeQueue;

        const folded = foldDshEvents(events);
        const parsedContract = parseResultContract(folded.text);
        const ok = !spawnError && !timedOut && !stalled && (exitCode === 0 || Boolean(parsedContract.contract)) && (folded.turnEndKind === '' || folded.turnEndKind === 'completed');
        const result: DshRunResult = {
          ok,
          sessionId: folded.sessionId,
          text: folded.text,
          turnEndKind: folded.turnEndKind,
          error:
            spawnError ||
            (stalled
              ? `进程静默超过 ${options.stalledMinutes} 分钟被终止`
              : timedOut
                ? `执行超过 ${options.timeoutMinutes} 分钟被终止`
                : folded.error || (ok ? '' : `dsh exit=${exitCode}`)),
          exitCode,
          durationMs: Date.now() - startedAt,
          ...(timedOut ? {timedOut: true} : {}),
          ...(stalled ? {stalled: true} : {}),
          tools: folded.tools,
          contract: parsedContract.contract,
          ...(parsedContract.error ? {contractParseError: parsedContract.error} : {}),
          logDir: options.logDir,
          runtime,
        };

        await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8').catch(() => {});
        resolve(result);
      };

      const hardTimer = setTimeout(() => {
        timedOut = true;
        terminateChild();
      }, timeoutMs);
      hardTimer.unref?.();

      const staleTimer = setInterval(async () => {
        if (settled) return;
        const now = Date.now();
        if (now - lastEventAt < stalledMs) return;
        const fileMtime = options.watchDir ? await latestFileMtimeMs(options.watchDir) : 0;
        const latestActivity = Math.max(lastEventAt, fileMtime);
        if (now - latestActivity >= stalledMs) {
          stalled = true;
          terminateChild();
        }
      }, pollIntervalMs);
      staleTimer.unref?.();

      const onAbort = () => terminateChild();
      if (options.signal?.aborted) onAbort();
      else options.signal?.addEventListener('abort', onAbort, {once: true});

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');

      child.stdout?.on('data', (chunk: string) => {
        lastEventAt = Date.now();
        enqueueWrite(stdoutPath, chunk);
        buffer += chunk;
        if (buffer.length > MAX_LINE_BYTES * 8) buffer = buffer.slice(-MAX_LINE_BYTES);
        let nl = buffer.indexOf('\n');
        while (nl >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          for (const event of parseJsonLines(line)) {
            events.push(event);
            try {
              options.onEvent?.(event);
            } catch {
              // keep streaming
            }
          }
          nl = buffer.indexOf('\n');
        }
      });

      child.stderr?.on('data', (chunk: string) => {
        enqueueWrite(stderrPath, chunk);
      });

      child.on('error', (error) => {
        void finish(null, error.message);
      });

      child.on('close', (code) => {
        void finish(code);
      });
    });
  }
}
