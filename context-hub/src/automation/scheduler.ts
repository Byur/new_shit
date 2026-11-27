import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {appendFile, mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {promisify} from 'node:util';
import type {FeishuNotifier} from './notify-feishu.ts';
import {
  checkDshDesktopSchedules,
  diffProtectedGitChanges,
  runPreflightChecks,
  runWizzImagineDoctor,
  snapshotGitStatus,
} from './preflight.ts';
import type {PreflightOptions} from './preflight.ts';
import type {DshRunner} from './runner-dsh.ts';
import {resolveRuntime} from './runtime.ts';
import {
  describeWorkspace,
  getTaskState,
  listTaskStates,
  loadTaskDefinitions,
  readQueueSnapshot,
  resolveMaterialsDir,
  resolveWorkspaceDir,
  setTaskEnabled,
  syncTasksToDatabase,
} from './tasks.ts';
import type {
  DshRunResult,
  FailedNodeRecord,
  PreflightReport,
  RunStatus,
  RuntimePreference,
  TaskConfig,
  TaskId,
  UnitResultContract,
  UnitType,
} from './types.ts';
import {CONTEXT_HUB_ROOT, assembleUnitPrompt, formatShanghaiTime, loadTaskDocBody} from './units.ts';

const execFileAsync = promisify(execFile);

export interface SchedulerOptions {
  db: DatabaseSync;
  runner: DshRunner;
  notifier: FeishuNotifier;
  contextHubRoot?: string;
  runsRootDir?: string;
  leaseTtlMs?: number;
  /** 状态看板/dry-run 可复用的本地预检；实际运行前始终重新执行。 */
  preflightRunner?: (options: PreflightOptions) => Promise<PreflightReport>;
  preflightCacheTtlMs?: number;
  execTool?: (cmd: string, args: string[], cwd: string, env?: Record<string, string>) => Promise<{stdout: string; stderr: string}>;
  logger?: {info: (msg: string) => void; warn: (msg: string) => void};
}

export interface RunTriggerResult {
  accepted: boolean;
  dryRun?: boolean;
  runKey: string;
  status: string;
  message: string;
  plan?: unknown;
}

function defaultExecTool(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<{stdout: string; stderr: string}> {
  return execFileAsync(cmd, args, {cwd, env: {...process.env, ...env}, timeout: 60_000});
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

function shanghaiParts(date: Date = new Date()): {
  dateStr: string;
  hh: number;
  mm: number;
  minutesOfDay: number;
  dayOfMonth: number;
  month: number;
  /** 0=周日 … 6=周六 */
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hh = Number(get('hour')) % 24;
  const mm = Number(get('minute'));
  // 日期用同一套上海本地值算星期，避免宿主时区影响。
  const localNoon = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00+08:00`);
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    hh,
    mm,
    minutesOfDay: hh * 60 + mm,
    dayOfMonth: Number(get('day')),
    month: Number(get('month')),
    weekday: Number.isNaN(localNoon.getUTCDay()) ? 0 : localNoon.getUTCDay(),
  };
}

/**
 * 解析一个 cron 字段（分/时/日/月/周）。
 *
 * 只支持标准五段 cron 的通用于集：`*`、单值、`a-b`、列表 `a,b`、步长 `*&#47;n` 与 `a-b/n`。
 * 不支持名称（MON）、`?`、`L`、`W`；遇到不支持的写法直接抛错，避免写成「看起来生效其实没生效」。
 *
 * @param field 字段文本
 * @param min 最小值
 * @param max 最大值
 * @returns 允许值的集合
 */
export function parseCronField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  const addRange = (from: number, to: number, step: number) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || !Number.isInteger(step) || step <= 0) {
      throw new Error(`invalid cron range ${from}-${to}/${step}`);
    }
    for (let v = from; v <= to; v += step) {
      if (v < min || v > max) throw new Error(`cron value ${v} out of range ${min}-${max}`);
      values.add(v);
    }
  };
  for (const chunk of field.split(',')) {
    const [rangePart, stepPart] = chunk.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (rangePart === '*') {
      addRange(min, max, step);
      continue;
    }
    const bounds = rangePart.split('-');
    if (bounds.length === 1) {
      const value = Number(bounds[0]);
      addRange(value, value, 1);
      continue;
    }
    if (bounds.length !== 2) throw new Error(`invalid cron field ${field}`);
    addRange(Number(bounds[0]), Number(bounds[1]), step);
  }
  return values;
}

export function cronMatches(cron: string, sh: {minutesOfDay: number; dayOfMonth: number; month: number; weekday: number}): boolean {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`cron must have 5 fields: ${cron}`);
  const [minuteField, hourField, domField, monthField, dowField] = fields;
  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const doms = parseCronField(domField, 1, 31);
  const months = parseCronField(monthField, 1, 12);
  // cron 的周字段 0/7 都是周日。
  const dows = new Set([...parseCronField(dowField, 0, 7)].map((d) => (d === 7 ? 0 : d)));
  return (
    minutes.has(sh.minutesOfDay % 60) &&
    hours.has(Math.floor(sh.minutesOfDay / 60)) &&
    doms.has(sh.dayOfMonth) &&
    months.has(sh.month) &&
    dows.has(sh.weekday)
  );
}

/**
 * 在 misfire 窗口内找出本应触发的那一分钟。
 *
 * 只看最近 `misfireMinutes` 分钟，避免「任务跑了一整天之后 tick 又补一次」。
 *
 * @param cron 五段 cron
 * @param now 当前时刻
 * @param misfireMinutes 允许迟到的窗口
 * @returns 命中的 slot（`YYYY-MM-DDTHH:mm`）或 null
 */
export function cronSlotWithin(cron: string, now: Date, misfireMinutes: number): string | null {
  const window = Math.max(0, Math.floor(misfireMinutes));
  for (let back = 0; back <= window; back += 1) {
    const at = new Date(now.getTime() - back * 60_000);
    const sh = shanghaiParts(at);
    let matched = false;
    try {
      matched = cronMatches(cron, sh);
    } catch {
      return null;
    }
    if (matched) {
      const hh = String(sh.hh).padStart(2, '0');
      const mm = String(sh.mm).padStart(2, '0');
      return `${sh.dateStr}T${hh}:${mm}`;
    }
  }
  return null;
}

export class AutomationScheduler {
  private readonly db: DatabaseSync;
  private readonly runner: DshRunner;
  private readonly notifier: FeishuNotifier;
  private readonly contextHubRoot: string;
  private readonly runsRootDir: string;
  private readonly leaseTtlMs: number;
  private readonly preflightRunner: (options: PreflightOptions) => Promise<PreflightReport>;
  private readonly preflightCacheTtlMs: number;
  private preflightCache: {key: string; at: number; report: PreflightReport} | null = null;
  private readonly execTool: (cmd: string, args: string[], cwd: string, env?: Record<string, string>) => Promise<{stdout: string; stderr: string}>;
  private readonly logger: {info: (msg: string) => void; warn: (msg: string) => void};
  private tasks = new Map<TaskId, TaskConfig>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeAbort = new Map<string, AbortController>();
  /** 正在执行的任务运行；shutdown 要等它们真的收尾（含取消宿主会话）。 */
  private readonly inFlight = new Set<Promise<unknown>>();
  private dailyDoctorDate = '';

  constructor(options: SchedulerOptions) {
    this.db = options.db;
    this.runner = options.runner;
    this.notifier = options.notifier;
    this.contextHubRoot = options.contextHubRoot ?? CONTEXT_HUB_ROOT;
    this.runsRootDir = options.runsRootDir ?? path.join(this.contextHubRoot, 'data', 'runs');
    this.leaseTtlMs = options.leaseTtlMs ?? 15 * 60_000;
    this.preflightRunner = options.preflightRunner ?? runPreflightChecks;
    this.preflightCacheTtlMs = options.preflightCacheTtlMs ?? 60_000;
    this.execTool = options.execTool ?? defaultExecTool;
    this.logger = options.logger ?? {
      info: (msg) => console.log(`[scheduler] ${msg}`),
      warn: (msg) => console.warn(`[scheduler] ${msg}`),
    };
  }

  async init(): Promise<void> {
    await mkdir(this.runsRootDir, {recursive: true});
    this.tasks = await loadTaskDefinitions(this.contextHubRoot);
    syncTasksToDatabase(this.db, this.tasks);
    await this.recoverFromCrash();
    const conflict = await checkDshDesktopSchedules();
    if (conflict.activeSchedules.length > 0) {
      const names = conflict.activeSchedules.map((s) => `${s.name}(${s.status})`).join(', ');
      this.logger.warn(`检测到 DSH Desktop 仍启用旧定时任务: ${names}`);
      await this.notifier.notifyAlert({
        level: 'P1',
        kind: 'dual_scheduler_conflict',
        title: '检测到 DSH 旧定时任务被启用',
        signal: `~/.dsh/storages/schedule.json 中仍有未暂停任务: ${names}`,
        scope: '可能与 context-hub 调度器并发抢占队列',
        action: '在 DSH Desktop 暂停旧 A/B/C schedule，保留 context-hub 独占调度',
        dedupeKey: 'dual_scheduler_conflict',
        dedupeWindowMinutes: 360,
      });
    }
  }

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      void this.tick().catch((err) => this.logger.warn(`tick error: ${(err as Error).message}`));
    }, 30_000);
    this.tickTimer.unref?.();
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    for (const ctrl of this.activeAbort.values()) ctrl.abort();
  }

  /**
   * 停机：先中止在飞运行，再等它们收尾。
   *
   * `stop()` 只是同步 abort；宿主里的轮次需要一次 HTTP cancel 才算真的停。
   * 不等收尾就 `process.exit` 会把会话留在宿主里继续跑，下次启动还会被
   * `recoverFromCrash` 判成失败。
   *
   * @param timeoutMs 最长等待时间；超过就放弃等待（下一次启动走崩溃恢复）
   */
  async shutdown(timeoutMs = 120_000): Promise<void> {
    this.stop();
    if (this.inFlight.size === 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      Promise.allSettled([...this.inFlight]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref?.();
      }),
    ]);
    if (timer !== null) clearTimeout(timer);
  }

  getTaskConfig(taskId: TaskId): TaskConfig | undefined {
    return this.tasks.get(taskId);
  }

  async getStatusSnapshot(): Promise<Record<string, unknown>> {
    const taskRows = listTaskStates(this.db);
    const leases = this.db.prepare('SELECT task_id, owner, pid, acquired_at, expires_at FROM automation_leases').all();
    const recentRuns = this.db
      .prepare(
        'SELECT run_key, task_id, trigger, upstream_run, status, retry_count, next_retry_at, started_at, ended_at, exit_code, log_dir FROM automation_runs ORDER BY started_at DESC LIMIT 20',
      )
      .all();
    const recentAlerts = this.db
      .prepare('SELECT id, run_key, level, kind, sent_at FROM automation_alerts ORDER BY sent_at DESC LIMIT 20')
      .all();

    const firstTask = this.tasks.get('wizz-a') ?? [...this.tasks.values()][0];
    const workspace = firstTask ? describeWorkspace(firstTask, this.contextHubRoot) : null;
    const wizzRepoDir = workspace?.dir ?? '';
    const materialsRoot = wizzRepoDir ? resolveMaterialsDir(wizzRepoDir) : '';
    const queue = materialsRoot ? await readQueueSnapshot(materialsRoot) : null;
    const preflight = wizzRepoDir
      ? await this.cachedPreflight(wizzRepoDir, materialsRoot, firstTask?.runtime)
      : null;

    return {
      now: new Date().toISOString(),
      shanghaiNow: formatShanghaiTime(),
      pid: process.pid,
      workspace,
      tasks: taskRows.map((row) => {
        const cfg = JSON.parse(row.config_json || '{}') as Partial<TaskConfig>;
        return {
          taskId: row.task_id,
          name: cfg.name ?? row.task_id,
          enabled: row.enabled === 1,
          pausedReason: row.paused_reason,
          trigger: cfg.trigger ?? null,
          unitConcurrency: cfg.unitConcurrency ?? 1,
          updatedAt: row.updated_at,
          workspace: describeWorkspace(
            {
              id: row.task_id,
              workspaceEnv: cfg.workspaceEnv ?? '',
              workspaceDir: cfg.workspaceDir,
            },
            this.contextHubRoot,
          ),
          runtime: resolveRuntime(cfg.runtime),
        };
      }),
      leases,
      queue,
      preflight,
      recentRuns,
      recentAlerts,
    };
  }

  /**
   * 看板/dry-run 共用的本地预检缓存。真实执行前仍走 runPreflightChecks，
   * 避免用过期结果决定是否真正开跑。
   */
  private async cachedPreflight(
    wizzRepoDir: string,
    materialsRoot: string,
    runtime?: RuntimePreference,
  ): Promise<PreflightReport> {
    const key = `${wizzRepoDir}\u0000${materialsRoot}\u0000${runtime ?? ''}`;
    const now = Date.now();
    if (this.preflightCache && this.preflightCache.key === key && now - this.preflightCache.at < this.preflightCacheTtlMs) {
      return this.preflightCache.report;
    }
    const report = await this.preflightRunner({
      wizzRepoDir,
      materialsDir: materialsRoot,
      runtime,
      checkCodexAuth: true,
      checkDshCli: true,
    });
    this.preflightCache = {key, at: now, report};
    return report;
  }

  listRuns(limit = 30): Array<Record<string, unknown>> {
    const runs = this.db
      .prepare(
        'SELECT run_key, task_id, trigger, upstream_run, status, prompt_hash, retry_count, next_retry_at, started_at, ended_at, exit_code, log_dir, summary_json FROM automation_runs ORDER BY started_at DESC LIMIT ?',
      )
      .all(limit) as Array<Record<string, any>>;

    const unitStmt = this.db.prepare(
      'SELECT id, unit_type, batch, dsh_session_id, status, started_at, ended_at, exit_code, node, failure_reason FROM automation_units WHERE run_key = ? ORDER BY started_at ASC',
    );
    return runs.map((run) => ({
      ...run,
      summary: (() => {
        try {
          return JSON.parse(run.summary_json || '{}');
        } catch {
          return {};
        }
      })(),
      units: unitStmt.all(run.run_key),
    }));
  }

  async getRunLogs(runKey: string): Promise<Record<string, unknown> | null> {
    const run = this.db
      .prepare('SELECT run_key, task_id, status, log_dir FROM automation_runs WHERE run_key = ?')
      .get(runKey) as {run_key: string; task_id: string; status: string; log_dir: string | null} | undefined;
    if (!run) return null;
    const logDir = run.log_dir;
    if (!logDir || !existsSync(logDir)) {
      return {runKey, taskId: run.task_id, status: run.status, logDir, files: {}};
    }
    const readSafe = async (file: string, tailLines?: number) => {
      if (!existsSync(file)) return null;
      const content = await readFile(file, 'utf8');
      if (!tailLines) return content;
      const lines = content.split(/\r?\n/);
      return lines.slice(-tailLines).join('\n');
    };
    const entries = await readdir(logDir, {withFileTypes: true});
    const units: Record<string, unknown> = {};
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const unitDir = path.join(logDir, entry.name);
      units[entry.name] = {
        envelope: await readSafe(path.join(unitDir, 'envelope.md')),
        stdoutTail: await readSafe(path.join(unitDir, 'stdout.jsonl'), 120),
        stderr: await readSafe(path.join(unitDir, 'stderr.log')),
        result: await readSafe(path.join(unitDir, 'result.json')),
      };
    }
    return {
      runKey,
      taskId: run.task_id,
      status: run.status,
      logDir,
      summary: await readSafe(path.join(logDir, 'summary.json')),
      units,
    };
  }

  async recoverFromCrash(): Promise<{reclaimedLeases: number; failedRuns: number; scheduledRetries: number}> {
    const nowIso = new Date().toISOString();
    const leases = this.db
      .prepare('SELECT task_id, pid, expires_at FROM automation_leases')
      .all() as Array<{task_id: string; pid: number; expires_at: string}>;
    let reclaimedLeases = 0;
    for (const lease of leases) {
      // 与 acquireLease 同一条规则：持锁进程还活着就不能回收。
      // 否则启动一次新守护进程，就会把另一个仍在跑长任务的进程的锁删掉。
      if (!isPidAlive(lease.pid)) {
        this.db.prepare('DELETE FROM automation_leases WHERE task_id = ?').run(lease.task_id);
        reclaimedLeases += 1;
      }
    }

    const stuckRuns = this.db
      .prepare("SELECT run_key, task_id FROM automation_runs WHERE status = 'running'")
      .all() as Array<{run_key: string; task_id: string}>;
    let failedRuns = 0;
    for (const run of stuckRuns) {
      this.db
        .prepare("UPDATE automation_runs SET status = 'failed', ended_at = ?, summary_json = ? WHERE run_key = ?")
        .run(nowIso, JSON.stringify({error: 'daemon restarted during active run'}), run.run_key);
      this.db
        .prepare("UPDATE automation_units SET status = 'failed', ended_at = ?, node = COALESCE(node, 'daemon/crash'), failure_reason = COALESCE(failure_reason, 'daemon restarted while unit was running') WHERE run_key = ? AND status = 'running'")
        .run(nowIso, run.run_key);
      failedRuns += 1;
      // 崩溃恢复本身就是一次失败：不通知的话，只有打开看板才知道昨晚断了。
      await this.safeNotify(() =>
        this.notifier.notifyFailure({
          runKey: run.run_key,
          taskId: run.task_id as TaskId,
          node: `${run.task_id}/daemon/crash`,
          reason: '守护进程在该运行期间退出；已标记失败',
          retryInfo: '不自动重试：下一次定时触发会重新开始',
          chainStatus: '已停止',
          logDir: '',
          level: 'P1',
        }),
      );
    }

    const pendingRetries = this.db
      .prepare("SELECT run_key, task_id, next_retry_at FROM automation_runs WHERE status = 'failed' AND next_retry_at IS NOT NULL")
      .all() as Array<{run_key: string; task_id: string; next_retry_at: string}>;
    let scheduledRetries = 0;
    for (const item of pendingRetries) {
      this.scheduleRetryTimer(item.run_key, item.task_id as TaskId, Date.parse(item.next_retry_at));
      scheduledRetries += 1;
    }

    return {reclaimedLeases, failedRuns, scheduledRetries};
  }

  acquireLease(taskId: TaskId, owner: string): boolean {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresIso = new Date(now + this.leaseTtlMs).toISOString();
    const existing = this.db
      .prepare('SELECT owner, pid, expires_at FROM automation_leases WHERE task_id = ?')
      .get(taskId) as {owner: string; pid: number; expires_at: string} | undefined;

    if (existing) {
      // 进程还活着就绝不抢租约。expires_at 只是「崩溃后多久可以回收」的提示：
      // 长任务（1 小时以上）必然越过 TTL，按过期时间抢锁等于并发跑两份同任务。
      if (isPidAlive(existing.pid)) return false;
      this.db.prepare('DELETE FROM automation_leases WHERE task_id = ?').run(taskId);
    }

    this.db
      .prepare('INSERT INTO automation_leases (task_id, owner, pid, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(taskId, owner, process.pid, nowIso, expiresIso);
    return true;
  }

  releaseLease(taskId: TaskId, owner: string): void {
    this.db.prepare('DELETE FROM automation_leases WHERE task_id = ? AND owner = ?').run(taskId, owner);
  }

  /**
   * 续租。
   *
   * 抢锁只看 pid 是否活着，续租的作用是让看板和崩溃恢复看到一个合理的过期时间，
   * 以及在 pid 被别的进程复用时缩短误判窗口。
   */
  private renewLease(taskId: TaskId, owner: string): void {
    this.db
      .prepare('UPDATE automation_leases SET expires_at = ? WHERE task_id = ? AND owner = ?')
      .run(new Date(Date.now() + this.leaseTtlMs).toISOString(), taskId, owner);
  }

  private startLeaseHeartbeat(taskId: TaskId, owner: string): ReturnType<typeof setInterval> {
    const timer = setInterval(() => {
      try {
        this.renewLease(taskId, owner);
      } catch (error) {
        this.logger.warn(`续租失败 ${taskId}: ${(error as Error).message}`);
      }
    }, Math.max(30_000, Math.floor(this.leaseTtlMs / 3)));
    timer.unref?.();
    return timer;
  }

  pauseTask(taskId: TaskId, reason = 'manual pause', killActive = false): {ok: boolean; killed: number} {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);
    setTaskEnabled(this.db, taskId, false, reason);
    let killed = 0;
    if (killActive) {
      for (const [key, ctrl] of this.activeAbort.entries()) {
        if (key.startsWith(`${taskId}@`)) {
          ctrl.abort();
          killed += 1;
        }
      }
    }
    return {ok: true, killed};
  }

  resumeTask(taskId: TaskId): {ok: boolean} {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);
    setTaskEnabled(this.db, taskId, true, null);
    return {ok: true};
  }

  async runDoctor({liveImageCheck = false, feishuTest = false} = {}): Promise<Record<string, unknown>> {
    const firstTask = this.tasks.get('wizz-c') ?? this.tasks.get('wizz-a');
    if (!firstTask) throw new Error('no task definitions loaded');
    const wizzRepoDir = resolveWorkspaceDir(firstTask, this.contextHubRoot);
    const materialsRoot = resolveMaterialsDir(wizzRepoDir);
    const report = await runPreflightChecks({wizzRepoDir, materialsDir: materialsRoot, checkCodexAuth: true, checkDshCli: true});
    if (liveImageCheck) {
      report.checks.push(await runWizzImagineDoctor(wizzRepoDir));
    }
    const scheduleConflict = await checkDshDesktopSchedules();
    let feishuSent = false;
    if (feishuTest) {
      feishuSent = await this.notifier.notifyAlert({
        level: 'P2',
        kind: 'doctor_test',
        title: 'Context Hub Automation 医生自检',
        signal: `自检状态: ${report.ok ? 'OK' : 'WARN'}`,
        scope: wizzRepoDir,
        action: '无需处理（人工触发 doctor 测试）',
        dedupeKey: `doctor:${Date.now()}`,
      });
    }
    return {
      ...report,
      ok: report.checks.every((c) => c.ok || c.level === 'P2'),
      scheduleConflict,
      feishuSent,
    };
  }

  /**
   * 手动触发一次运行。
   *
   * @param taskId 任务
   * @param options.dryRun 只生成计划，不留 run 记录
   * @param options.follow 成功后是否继续顺流（A→B→C）；默认 true。
   *   定时触发（cron / cascade）总是顺流，`follow` 只影响手动调用。
   * @returns 触发结果
   */
  async triggerManualRun(taskId: TaskId, {dryRun = false, follow = true} = {}): Promise<RunTriggerResult> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);
    const slot = `manual-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const runKey = `${taskId}@${slot}`;
    if (dryRun) {
      const plan = await this.buildDryRunPlan(task, runKey);
      return {accepted: true, dryRun: true, runKey, status: 'dry_run', message: 'dry-run plan generated', plan};
    }
    void this.executeTaskRun(task, runKey, 'manual', null, 0, follow);
    return {
      accepted: true,
      runKey,
      status: 'running',
      message: follow ? `started ${runKey}（成功后继续下一环）` : `started ${runKey}（只跑这一环）`,
    };
  }

  async retryRun(runKey: string): Promise<RunTriggerResult> {
    const existing = this.db
      .prepare('SELECT run_key, task_id, status, retry_count, upstream_run FROM automation_runs WHERE run_key = ?')
      .get(runKey) as {run_key: string; task_id: TaskId; status: string; retry_count: number; upstream_run: string | null} | undefined;
    if (!existing) throw new Error(`run not found: ${runKey}`);
    const task = this.tasks.get(existing.task_id);
    if (!task) throw new Error(`task not found: ${existing.task_id}`);
    if (existing.retry_count >= (task.retry?.infra?.max ?? 1)) {
      return {
        accepted: false,
        runKey,
        status: existing.status,
        message: `retry limit reached (${existing.retry_count}/${task.retry?.infra?.max ?? 1})`,
      };
    }

    const wizzRepoDir = resolveWorkspaceDir(task, this.contextHubRoot);
    const materialsRoot = resolveMaterialsDir(wizzRepoDir);
    await this.cleanupBeforeRetry(task.id, wizzRepoDir, undefined, materialsRoot);
    const retrySlot = `retry-${existing.retry_count + 1}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const newRunKey = `${task.id}@${retrySlot}`;
    this.db.prepare('UPDATE automation_runs SET next_retry_at = NULL WHERE run_key = ?').run(runKey);
    void this.executeTaskRun(task, newRunKey, 'retry', existing.run_key, existing.retry_count + 1);
    return {accepted: true, runKey: newRunKey, status: 'running', message: `retry started from ${runKey}`};
  }

  async cleanupBeforeRetry(taskId: TaskId, wizzRepoDir: string, targetBatch?: string, materialsDirOverride?: string): Promise<void> {
    const materialsRoot = materialsDirOverride ?? resolveMaterialsDir(wizzRepoDir);
    if (taskId === 'wizz-b') {
      const doingDir = path.join(materialsRoot, '_queue', 'doing');
      const todoDir = path.join(materialsRoot, '_queue', 'todo');
      if (!existsSync(doingDir)) return;
      await mkdir(todoDir, {recursive: true});
      const files = await readdir(doingDir);
      for (const name of files) {
        if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
        const src = path.join(doingDir, name);
        try {
          const card = JSON.parse(await readFile(src, 'utf8')) as {batch?: string; jobKey?: string};
          if (targetBatch && card.batch !== targetBatch) continue;
          const tmp = path.join(todoDir, `${name}.tmp`);
          await writeFile(tmp, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
          await rename(tmp, path.join(todoDir, name));
          await rm(src, {force: true});
        } catch {
          // ignore malformed card
        }
      }
      return;
    }

    if (taskId === 'wizz-c') {
      const cStateScript = path.join(wizzRepoDir, 'tools', 'wizz-c-state.mjs');
      if (!existsSync(cStateScript)) return;
      const cDir = path.join(materialsRoot, '_queue', 'c');
      if (!existsSync(cDir)) return;
      const files = await readdir(cDir);
      for (const name of files) {
        if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
        const batch = name.replace(/\.json$/, '');
        if (targetBatch && batch !== targetBatch) continue;
        try {
          const state = JSON.parse(await readFile(path.join(cDir, name), 'utf8')) as {status?: string};
          if (state.status === 'claimed' || state.status === 'running') {
            await this.execTool('node', [cStateScript, 'release', '--batch', batch], wizzRepoDir, {WIZZ_MATERIALS: materialsRoot});
          }
        } catch {
          // ignore
        }
      }
    }
  }

  async tick(now: Date = new Date()): Promise<void> {
    const sh = shanghaiParts(now);
    const taskAState = getTaskState(this.db, 'wizz-a');
    const taskA = this.tasks.get('wizz-a');

    // cron 触发：cron 表达式、时区（固定 Asia/Shanghai）与 misfire 窗口都来自任务 JSON。
    // 以前这里是硬编码 10:00，任务里的 `cron: "0 10 * * *"` 改了没有任何效果。
    if (taskA && taskAState?.enabled === 1 && taskA.trigger.kind === 'cron' && taskA.trigger.cron) {
      const misfireWindow = taskA.trigger.misfireMinutes ?? 30;
      const slot = cronSlotWithin(taskA.trigger.cron, now, misfireWindow);
      if (slot !== null) {
        const runKey = `wizz-a@${slot}`;
        const existing = this.db.prepare('SELECT run_key FROM automation_runs WHERE run_key = ?').get(runKey);
        if (!existing) {
          void this.executeTaskRun(taskA, runKey, 'cron', null);
        }
      }
    }

    // Dead-man checks (only emit when corresponding task is enabled / not paused)
    if (taskAState?.enabled === 1 && sh.minutesOfDay >= 11 * 60 + 30) {
      const todayA = this.db
        .prepare("SELECT status FROM automation_runs WHERE task_id = 'wizz-a' AND run_key LIKE ? AND status IN ('ok','partial','running') LIMIT 1")
        .get(`wizz-a@${sh.dateStr}%`);
      if (!todayA) {
        await this.notifier.notifyAlert({
          level: 'P1',
          kind: 'deadman_a_1130',
          title: '死手告警：11:30 前 A 未启动或未成功',
          signal: `Asia/Shanghai ${sh.dateStr} 11:30 前 wizz-a 无 ok/partial/running 记录`,
          scope: '当日二创开题链路阻断',
          action: '检查宿主机状态并运行 context-hub automation run wizz-a',
          dedupeKey: `deadman_a:${sh.dateStr}`,
          dedupeWindowMinutes: 720,
        });
      }
    }

    const taskBState = getTaskState(this.db, 'wizz-b');
    const taskCState = getTaskState(this.db, 'wizz-c');
    if (taskCState?.enabled === 1 && sh.minutesOfDay >= 21 * 60) {
      const todayC = this.db
        .prepare("SELECT status FROM automation_runs WHERE task_id = 'wizz-c' AND run_key LIKE ? AND status IN ('ok','partial','skipped') LIMIT 1")
        .get(`wizz-c@${sh.dateStr}%`);
      if (!todayC) {
        await this.notifier.notifyAlert({
          level: 'P2',
          kind: 'deadman_chain_2100',
          title: '断链提醒：21:00 前 C 尚未完成',
          signal: `Asia/Shanghai ${sh.dateStr} 21:00 前 wizz-c 无完成记录`,
          scope: '当日出图交付延迟',
          action: '查看 context-hub automation status 并检查积压',
          dedupeKey: `deadman_c:${sh.dateStr}`,
          dedupeWindowMinutes: 720,
        });
      }
    }

    if (taskBState?.enabled === 1) {
      const recentA = this.db
        .prepare("SELECT run_key, ended_at FROM automation_runs WHERE task_id = 'wizz-a' AND run_key LIKE ? AND status IN ('ok','partial') ORDER BY ended_at DESC LIMIT 1")
        .get(`wizz-a@${sh.dateStr}%`) as {run_key: string; ended_at: string} | undefined;
      if (recentA?.ended_at && Date.now() - Date.parse(recentA.ended_at) >= 30 * 60_000) {
        const bStarted = this.db
          .prepare("SELECT run_key FROM automation_runs WHERE task_id = 'wizz-b' AND started_at >= ? LIMIT 1")
          .get(recentA.ended_at);
        if (!bStarted && taskA) {
          const queue = await readQueueSnapshot(resolveMaterialsDir(resolveWorkspaceDir(taskA, this.contextHubRoot)));
          if (queue.todo > 0) {
            await this.notifier.notifyAlert({
              level: 'P2',
              kind: 'deadman_b_gap',
              title: '断链提醒：A 完成后 30 分钟内 B 未启动',
              signal: `todo=${queue.todo}，上游 ${recentA.run_key} 已于 ${recentA.ended_at} 结束`,
              scope: 'B 未消费待办卡片',
              action: '运行 context-hub automation run wizz-b',
              dedupeKey: `deadman_b:${recentA.run_key}`,
              dedupeWindowMinutes: 720,
            });
          }
        }
      }
    }
  }

  private scheduleRetryTimer(runKey: string, taskId: TaskId, targetMs: number): void {
    if (this.retryTimers.has(runKey)) return;
    const waitMs = Math.max(1_000, targetMs - Date.now());
    const timer = setTimeout(() => {
      this.retryTimers.delete(runKey);
      void this.retryRun(runKey).catch((err) => this.logger.warn(`scheduled retry failed for ${runKey}: ${(err as Error).message}`));
    }, waitMs);
    timer.unref?.();
    this.retryTimers.set(runKey, timer);
  }

  private async buildDryRunPlan(task: TaskConfig, runKey: string): Promise<Record<string, unknown>> {
    const wizzRepoDir = resolveWorkspaceDir(task, this.contextHubRoot);
    const materialsRoot = resolveMaterialsDir(wizzRepoDir);
    const preflight = await this.cachedPreflight(wizzRepoDir, materialsRoot, task.runtime);
    const queue = await readQueueSnapshot(materialsRoot);
    const runtime = resolveRuntime(task.runtime);
    const unitType = `${task.id.slice(-1)}-run` as UnitType;
    const loaded = await loadTaskDocBody(task, wizzRepoDir);
    const prompt = assembleUnitPrompt(loaded.body, {
      runId: runKey,
      unitId: `${runKey}:${unitType}`,
      taskId: task.id,
      unitType,
      triggeredAt: formatShanghaiTime(),
      workspaceDir: wizzRepoDir,
      materialsRoot,
      timeoutMinutes: task.timeoutMinutes,
      stalledMinutes: task.stalledMinutes,
      mode: runtime.resolved === 'desktop' ? 'parent' : 'inline',
      concurrency: task.unitConcurrency,
    });

    return {
      runKey,
      taskId: task.id,
      wizzRepoDir,
      materialsRoot,
      workspace: describeWorkspace(task, this.contextHubRoot),
      runtime,
      permissionMode: task.permissionMode,
      approvalPolicy: task.approvalPolicy,
      unitConcurrency: task.unitConcurrency,
      timeoutMinutes: task.timeoutMinutes,
      stalledMinutes: task.stalledMinutes,
      preflight,
      queue,
      promptChecks: [{unit: unitType, hash: loaded.hash, length: prompt.length}],
    };
  }

  /**
   * 执行一次任务运行；对外只暴露这一个入口。
   *
   * 真正的实现在 `runTaskRun`，这里负责把 promise 记进 inFlight，
   * 让 shutdown 能等到宿主会话真的被取消。
   */
  async executeTaskRun(
    task: TaskConfig,
    runKey: string,
    trigger: string,
    upstreamRun: string | null,
    retryCount = 0,
    follow = true,
  ): Promise<RunStatus> {
    const promise = this.runTaskRun(task, runKey, trigger, upstreamRun, retryCount, follow);
    this.inFlight.add(promise);
    try {
      return await promise;
    } catch (error) {
      // 调用方几乎都是 `void this.executeTaskRun(...)`：这里吞掉 rejection，
      // 否则一个未处理的拒绝会把整个常驻调度带走。
      this.logger.warn(`${task.id} 运行时抛出未捕获错误（${runKey}）：${(error as Error).message}`);
      return 'failed';
    } finally {
      this.inFlight.delete(promise);
    }
  }

  private async runTaskRun(
    task: TaskConfig,
    runKey: string,
    trigger: string,
    upstreamRun: string | null,
    retryCount: number,
    follow: boolean,
  ): Promise<RunStatus> {
    const exists = this.db.prepare('SELECT run_key FROM automation_runs WHERE run_key = ?').get(runKey);
    if (exists) {
      this.logger.warn(`幂等拦截：runKey=${runKey} 已存在`);
      return 'skipped';
    }

    const leaseOwner = `${runKey}:${process.pid}`;
    let leaseHeld = false;
    let runRowInserted = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let abortCtrl: AbortController | null = null;
    let wizzRepoDir = '';
    let materialsRoot = '';
    let logDir = '';
    const startedMs = Date.now();
    let finalStatus: RunStatus = 'failed';
    let infraFailure = false;
    const failedNodes: FailedNodeRecord[] = [];
    let summaryObj: Record<string, unknown> = {};

    // 取租约、解析工作区、建日志目录、落 run 行全部在 try 里：
    // 只要拿到租约，无论哪一步抛错都会走到 finally 释放，不会留下死租约。
    try {
      if (!this.acquireLease(task.id, leaseOwner)) {
        this.logger.warn(`租约占用：${task.id} 正在运行中，跳过 ${runKey}`);
        return 'skipped';
      }
      leaseHeld = true;
      heartbeat = this.startLeaseHeartbeat(task.id, leaseOwner);

      wizzRepoDir = resolveWorkspaceDir(task, this.contextHubRoot);
      materialsRoot = resolveMaterialsDir(wizzRepoDir);
      logDir = path.join(this.runsRootDir, runKey.replace(/[^a-zA-Z0-9._@-]/g, '_'));
      await mkdir(logDir, {recursive: true});

      this.db
        .prepare(
          'INSERT INTO automation_runs (run_key, task_id, trigger, upstream_run, status, retry_count, started_at, log_dir) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(runKey, task.id, trigger, upstreamRun, 'running', retryCount, new Date().toISOString(), logDir);
      runRowInserted = true;

      abortCtrl = new AbortController();
      this.activeAbort.set(runKey, abortCtrl);

      const preflight: PreflightReport = await runPreflightChecks({
        wizzRepoDir,
        materialsDir: materialsRoot,
        runtime: task.runtime,
        checkCodexAuth: task.id === 'wizz-c',
        checkDshCli: true,
      });
      if (!preflight.ok) {
        const failedMsg = preflight.checks
          .filter((c) => !c.ok && c.level !== 'P2')
          .map((c) => `${c.name}: ${c.detail}`)
          .join('; ');
        throw Object.assign(new Error(`L2 前置检查失败: ${failedMsg}`), {infra: true, node: `${task.id}/preflight`});
      }

      if (task.id === 'wizz-c') {
        const today = shanghaiParts().dateStr;
        if (this.dailyDoctorDate !== today) {
          const docCheck = await runWizzImagineDoctor(wizzRepoDir);
          if (!docCheck.ok) {
            throw Object.assign(new Error(`wizz-imagine doctor 失败: ${docCheck.detail}`), {
              infra: true,
              node: 'wizz-c/preflight/doctor',
            });
          }
          this.dailyDoctorDate = today;
        }
      }

      const gitBefore = await snapshotGitStatus(wizzRepoDir);
      const out = await this.runTaskDoc(task, runKey, wizzRepoDir, materialsRoot, logDir, abortCtrl.signal);
      finalStatus = out.status;
      infraFailure = out.infraFailure;
      failedNodes.push(...out.failedNodes);
      summaryObj = out.summary;

      const gitAfter = await snapshotGitStatus(wizzRepoDir);
      const unexpected = diffProtectedGitChanges(gitBefore, gitAfter);
      if (unexpected.length > 0) {
        await this.safeNotify(() =>
          this.notifier.notifyAlert({
            runKey,
            level: 'P1',
            kind: 'protected_path_write',
            title: '越界写告警（允许目录之外有改动）',
            signal: unexpected.slice(0, 10).join('\n'),
            scope: `${task.id} 运行期间改动了 ideas/ materials/ worlds/ works/ 之外的路径`,
            action: `检查 git diff 并核对日志: context-hub automation logs ${runKey}`,
            dedupeKey: `git_guard:${runKey}`,
          }),
        );
      }
    } catch (error) {
      const err = error as Error & {infra?: boolean; node?: string};
      finalStatus = 'failed';
      infraFailure = Boolean(err.infra);
      failedNodes.push({
        node: err.node ?? `${task.id}/runtime`,
        phase: '执行',
        reason: err.message,
        retryable: infraFailure,
      });
      summaryObj = {error: err.message};
    }

    try {
      // 连 run 行都没建成：没有可收尾的对象，也没法重试/级联。
      if (!runRowInserted) {
        this.logger.warn(`${task.id} 在落库前失败（${runKey}）：${failedNodes[0]?.reason ?? 'unknown'}`);
        return 'failed';
      }

      if (failedNodes.length > 0) {
        const actor = task.id === 'wizz-a' ? 'A' : task.id === 'wizz-b' ? 'B' : 'C';
        await this.appendFailuresLog(materialsRoot, actor, failedNodes).catch(() => {});
      }
      if (task.id === 'wizz-b' || task.id === 'wizz-c') {
        // 只有失败才写快照；成功时清空旧的 run_issue，避免上一轮的残留被当成这一轮的问题。
        const issue = finalStatus === 'failed' ? String(summaryObj.error || 'run failed') : 'none';
        await this.writePendingIssueSnapshot(materialsRoot, issue).catch(() => {});
      }

      let nextRetryAt: string | null = null;
      const maxRetry = task.retry?.infra?.max ?? 1;
      if (finalStatus === 'failed' && infraFailure && retryCount < maxRetry) {
        const backoffMin = task.retry?.infra?.backoffMinutes ?? 30;
        const targetMs = Date.now() + backoffMin * 60_000;
        nextRetryAt = new Date(targetMs).toISOString();
        this.scheduleRetryTimer(runKey, task.id, targetMs);
      }

      this.db
        .prepare(
          'UPDATE automation_runs SET status = ?, next_retry_at = ?, ended_at = ?, exit_code = ?, summary_json = ? WHERE run_key = ?',
        )
        .run(
          finalStatus,
          nextRetryAt,
          new Date().toISOString(),
          finalStatus === 'ok' || finalStatus === 'skipped' ? 0 : 1,
          JSON.stringify(summaryObj),
          runKey,
        );
      await writeFile(
        path.join(logDir, 'summary.json'),
        JSON.stringify({runKey, status: finalStatus, failedNodes, summaryObj}, null, 2),
        'utf8',
      ).catch(() => {});

      // 通知是旁路：飞书配错、网络失败都只记日志，不改变运行结果，也不阻断级联。
      if (finalStatus === 'failed') {
        const primary = failedNodes[0] ?? {node: `${task.id}/run`, phase: '执行', reason: 'unknown failure'};
        await this.safeNotify(() =>
          this.notifier.notifyFailure({
            runKey,
            taskId: task.id,
            node: primary.node,
            reason: primary.reason,
            retryInfo: nextRetryAt
              ? `将在 ${task.retry?.infra?.backoffMinutes ?? 30} 分钟后自动重试 1 次`
              : '未重试（业务失败或已达上限）',
            chainStatus: '已停止',
            logDir,
            level: 'P1',
          }),
        );
      } else if (task.id === 'wizz-c' && (finalStatus === 'ok' || finalStatus === 'partial')) {
        const images = Array.isArray(summaryObj.deliveryImages)
          ? (summaryObj.deliveryImages as Array<{path: string; label: string}>)
          : [];
        const batches = (Array.isArray(summaryObj.batchRows) ? summaryObj.batchRows : []) as Array<{
          batch: string;
          character?: string;
          work?: string;
          style?: string;
          durationMs?: number;
          status: 'done' | 'failed' | 'skipped';
        }>;
        await this.safeNotify(() =>
          this.notifier.notifySuccess({
            runKey,
            dateLabel: shanghaiParts().dateStr,
            durationMs: Date.now() - startedMs,
            batches,
            images: task.notify?.success?.images === false ? [] : images,
            maxImages: task.notify?.success?.maxImages ?? 0,
            failures: failedNodes.map((f) => ({node: f.node, reason: f.reason})),
          }),
        );
      }

      // skipped 也要顺流：B 因 todo=0 跳过时，c_pending 可能还有积压（B 早先成功、C 失败），
      // 这一步不能成为链条断点。是否真的触发由 maybeCascade 的队列判断兜住。
      if ((finalStatus === 'ok' || finalStatus === 'partial' || finalStatus === 'skipped') && task.id !== 'wizz-c' && follow) {
        await this.maybeCascade(task.id, runKey, materialsRoot);
      }

      return finalStatus;
    } finally {
      // 收尾（含最终 UPDATE 与 summary 落盘）完成后再放锁：
      // 否则最终写库失败或被停机打断时，别人会以为这个任务已结束，
      // 下次启动把这条 run 判成崩溃，凭空多一条 P1。
      if (heartbeat !== null) clearInterval(heartbeat);
      if (abortCtrl !== null) this.activeAbort.delete(runKey);
      if (leaseHeld) this.releaseLease(task.id, leaseOwner);
    }
  }

  /**
   * 通知必须 best-effort。
   *
   * 飞书配错、网络失败、SDK 抛错都不能改变运行结果，也不能把异常抛回 tick。
   */
  private async safeNotify(run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.warn(`通知发送失败（已忽略）：${(error as Error).message}`);
    }
  }

  /**
   * 顺流触发下一环。
   *
   * `enabled` 只决定「定时器自己会不会触发」，不决定一条已经开始流水线的走向：
   * 手动跑 A 要能走完 A→B→C，除非调用方显式 follow=false。
   *
   * 唯一例外是**显式暂停**（`paused_reason` 非空）：那是人明确要求停下这一环，
   * 级联不能把它绕过去。默认的 `enabled: false`（还没启用过）不算暂停。
   */
  private async maybeCascade(upstreamTask: TaskId, upstreamRunKey: string, materialsRoot: string): Promise<void> {
    const nextTaskId: TaskId | null = upstreamTask === 'wizz-a' ? 'wizz-b' : upstreamTask === 'wizz-b' ? 'wizz-c' : null;
    if (!nextTaskId) return;
    const nextTask = this.tasks.get(nextTaskId);
    if (!nextTask) return;
    const nextState = getTaskState(this.db, nextTaskId);
    if (nextState?.paused_reason) {
      this.logger.info(`级联停在 ${nextTaskId}：该任务已被显式暂停（${nextState.paused_reason}）`);
      return;
    }

    const queue = await readQueueSnapshot(materialsRoot);
    const ready = nextTaskId === 'wizz-b' ? queue.todo > 0 : queue.cPending > 0;
    if (!ready) return;

    const slot = `cascade-${shanghaiParts().dateStr}-${Date.now()}`;
    void this.executeTaskRun(nextTask, `${nextTaskId}@${slot}`, 'cascade', upstreamRunKey);
  }

  private recordUnitStart(id: string, runKey: string, unitType: UnitType, batch: string | null): void {
    this.db
      .prepare(
        'INSERT INTO automation_units (id, run_key, unit_type, batch, status, started_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, runKey, unitType, batch, 'running', new Date().toISOString());
  }

  private recordUnitFinish(
    id: string,
    result: DshRunResult,
    status: string,
    node: string | null,
    failureReason: string | null,
  ): void {
    this.db
      .prepare(
        'UPDATE automation_units SET dsh_session_id = ?, status = ?, ended_at = ?, exit_code = ?, node = ?, failure_reason = ?, artifacts_json = ? WHERE id = ?',
      )
      .run(
        result.sessionId || null,
        status,
        new Date().toISOString(),
        result.exitCode,
        node,
        failureReason,
        JSON.stringify(result.contract?.artifacts ?? []),
        id,
      );
  }

  /**
   * 一次运行 = 一个会话 + 任务书全文。
   *
   * 任务书自己描述父子会话分工（开题 / 派发 / 收口 / 入队），所以守护进程不再把
   * 任务书拆成 a-plan / a-research / b-batch 之类的子单元：拆开会同时产生两套
   * 并发所有权（调度器按批建会话 + 父会话再 session_spawn），也会让模型看不到
   * 「父子会话分工」这类全局条款。
   *
   * 并发上限通过运行信封告诉父会话，由父会话用 `session_spawn` 自行滚动补位。
   *
   * @param task 任务配置
   * @param runKey 运行标识
   * @param wizzRepoDir 工作区绝对路径
   * @param materialsRoot 物料根
   * @param logDir 运行日志目录
   * @param signal 取消信号（pause --kill / 停机）
   */
  private async runTaskDoc(
    task: TaskConfig,
    runKey: string,
    wizzRepoDir: string,
    materialsRoot: string,
    logDir: string,
    signal: AbortSignal,
  ): Promise<{status: RunStatus; infraFailure: boolean; failedNodes: FailedNodeRecord[]; summary: Record<string, unknown>}> {
    // B 的自愈留在调度器侧：把卡在 doing 的批次退回 todo。会话只负责本轮工作，
    // 不该由它决定别的批次是否过期。
    if (task.id === 'wizz-b') {
      const queueScript = path.join(wizzRepoDir, 'tools', 'wizz-queue.mjs');
      if (existsSync(queueScript)) {
        await this.execTool('node', [queueScript, 'requeue-stale', '--minutes', '120'], wizzRepoDir, {
          WIZZ_MATERIALS: materialsRoot,
        }).catch(() => {});
      }
    }

    const queue = await readQueueSnapshot(materialsRoot);
    if (task.id === 'wizz-b' && queue.todo === 0) {
      return {status: 'skipped', infraFailure: false, failedNodes: [], summary: {reason: 'todo=0'}};
    }
    if (task.id === 'wizz-c' && queue.cPending === 0) {
      return {status: 'skipped', infraFailure: false, failedNodes: [], summary: {reason: 'c_pending=0'}};
    }

    const unitType = `${task.id.slice(-1)}-run` as UnitType;
    const unitId = `${unitType}-${randomUUID().slice(0, 6)}`;
    const loaded = await loadTaskDocBody(task, wizzRepoDir);
    this.db.prepare('UPDATE automation_runs SET prompt_hash = ? WHERE run_key = ?').run(loaded.hash, runKey);
    this.recordUnitStart(unitId, runKey, unitType, null);

    const runtime = resolveRuntime(task.runtime);
    const label = task.id === 'wizz-a' ? 'A' : task.id === 'wizz-b' ? 'B' : 'C';
    const prompt = assembleUnitPrompt(loaded.body, {
      runId: runKey,
      unitId,
      taskId: task.id,
      unitType,
      triggeredAt: formatShanghaiTime(),
      workspaceDir: wizzRepoDir,
      materialsRoot,
      timeoutMinutes: task.timeoutMinutes,
      stalledMinutes: task.stalledMinutes,
      mode: runtime.resolved === 'desktop' ? 'parent' : 'inline',
      concurrency: task.unitConcurrency,
      snapshot: {
        materialsRoot,
        queue: {
          todo: queue.todo,
          doing: queue.doing,
          done: queue.done,
          failed: queue.failed,
          cPending: queue.cPending,
          todoBatches: queue.todoBatches.map((batch) => ({
            batch: batch.batch,
            layout: batch.layout,
            materialsDir: batch.materialsDir,
          })),
          cPendingBatches: queue.cPendingBatches.map((batch) => ({
            batch: batch.batch,
            layout: batch.layout,
            materialsDir: batch.materialsDir,
          })),
        },
      },
    });

    const res = await this.runner.runUnit({
      runId: runKey,
      unitId,
      cwd: wizzRepoDir,
      watchDir: materialsRoot,
      addDirs: [materialsRoot],
      extraEnv: {WIZZ_MATERIALS: materialsRoot},
      logDir: path.join(logDir, unitId),
      prompt,
      title: `Wizz ${label} · 全流程`.slice(0, 120),
      permissionMode: task.permissionMode,
      approvalPolicy: task.approvalPolicy,
      runtime: task.runtime,
      timeoutMinutes: task.timeoutMinutes,
      stalledMinutes: task.stalledMinutes,
      signal,
    });

    const contract = res.contract;
    // 基础设施失败才重试：契约说 failed 是业务结论，重试一次不会变好，还会重复写盘。
    const infra = Boolean(res.timedOut || res.stalled || (res.exitCode !== 0 && !contract));
    const failedNodes: FailedNodeRecord[] = [];
    let status: RunStatus;

    if (res.ok && contract && (contract.status === 'ok' || contract.status === 'partial')) {
      status = contract.status === 'partial' ? 'partial' : 'ok';
      this.recordUnitFinish(unitId, res, contract.status, null, null);
      if (Array.isArray(contract.failed_nodes) && contract.failed_nodes.length > 0) {
        failedNodes.push(...contract.failed_nodes);
      }
    } else {
      const node = contract?.failed_nodes?.[0]?.node ?? `${task.id}/${unitType}`;
      const reason = contract?.failed_nodes?.[0]?.reason ?? (res.error || res.contractParseError || `${unitType} failed`);
      failedNodes.push({node, phase: '执行', reason, retryable: infra});
      this.recordUnitFinish(unitId, res, res.timedOut ? 'timeout' : 'failed', node, reason);
      status = 'failed';
    }

    return {
      status,
      infraFailure: infra,
      failedNodes,
      summary: this.summarizeContract(task, contract, failedNodes),
    };
  }

  /**
   * 把契约里的可选汇总字段映射成看板/飞书要的字段。
   *
   * 缺失就留空而不是伪造 0：契约不完整本身就是信息。
   */
  private summarizeContract(
    task: TaskConfig,
    contract: UnitResultContract | null,
    failedNodes: FailedNodeRecord[],
  ): Record<string, unknown> {
    const summary: Record<string, unknown> = {
      failedNodes: failedNodes.length,
      ...(contract?.summary ? {contractSummary: contract.summary} : {}),
      ...(contract?.batches ? {batches: contract.batches} : {}),
      ...(Array.isArray(contract?.batch_rows) ? {batchRows: contract.batch_rows} : {}),
      ...(Array.isArray(contract?.jobs) ? {jobs: contract.jobs} : {}),
    };
    if (task.id === 'wizz-a') {
      if (typeof contract?.enqueued_batches === 'number') summary.enqueuedBatches = contract.enqueued_batches;
      if (Array.isArray(contract?.proposals)) summary.proposals = contract.proposals.length;
    }
    if (task.id === 'wizz-c' && Array.isArray(contract?.delivery_images)) {
      summary.deliveryImages = contract.delivery_images.filter(
        (image): image is {path: string; label: string} => Boolean(image) && typeof image.path === 'string',
      );
    }
    return summary;
  }

  private async appendFailuresLog(materialsRoot: string, actor: 'A' | 'B' | 'C', nodes: FailedNodeRecord[]): Promise<void> {
    if (!existsSync(materialsRoot)) return;
    const logPath = path.join(materialsRoot, '_failures.log');
    const iso = formatShanghaiTime();
    const lines = nodes.map(
      (n) => `${iso} actor=${actor} job=${n.job_key || n.batch || '-'} phase=${n.phase} reason=[${n.node}] ${n.reason.replace(/\r?\n/g, ' ')}`,
    );
    await appendFile(logPath, `${lines.join('\n')}\n`, 'utf8');
  }

  private async writePendingIssueSnapshot(materialsRoot: string, runIssue: string): Promise<void> {
    const queueRoot = path.join(materialsRoot, '_queue');
    if (!existsSync(queueRoot)) return;
    const failedDir = path.join(queueRoot, 'failed');
    const cDir = path.join(queueRoot, 'c');

    const failedJobs: string[] = [];
    if (existsSync(failedDir)) {
      for (const name of (await readdir(failedDir)).sort()) {
        if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
        try {
          const card = JSON.parse(await readFile(path.join(failedDir, name), 'utf8')) as any;
          failedJobs.push(`${card.jobKey} | ${card.title || '-'} | ${card.lastReason || '-'}`);
        } catch {
          // ignore
        }
      }
    }

    const cFailedBatches: string[] = [];
    if (existsSync(cDir)) {
      for (const name of (await readdir(cDir)).sort()) {
        if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
        try {
          const state = JSON.parse(await readFile(path.join(cDir, name), 'utf8')) as any;
          if (state.status === 'failed') {
            cFailedBatches.push(`${state.batch} | ${state.reason || 'failed'}`);
          }
        } catch {
          // ignore
        }
      }
    }

    const content = [
      '## pending issues',
      `generated: ${formatShanghaiTime()}`,
      `failed_jobs: ${failedJobs.length ? `\n${failedJobs.map((l) => `  - ${l}`).join('\n')}` : 'none'}`,
      `c_failed_batches: ${cFailedBatches.length ? `\n${cFailedBatches.map((l) => `  - ${l}`).join('\n')}` : 'none'}`,
      `run_issue: ${runIssue || 'none'}`,
      '',
    ].join('\n');
    const issuePath = path.join(materialsRoot, '_pending_issue.md');
    const tmpPath = `${issuePath}.${process.pid}.tmp`;
    await writeFile(tmpPath, content, 'utf8');
    await rename(tmpPath, issuePath);
  }
}
