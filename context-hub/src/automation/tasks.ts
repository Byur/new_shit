import {existsSync} from 'node:fs';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import type {TaskConfig, TaskId} from './types.ts';
import {CONTEXT_HUB_ROOT} from './units.ts';

const TASK_IDS: TaskId[] = ['wizz-a', 'wizz-b', 'wizz-c'];

export interface StoredTaskRow {
  task_id: TaskId;
  enabled: number;
  paused_reason: string | null;
  config_json: string;
  updated_at: string;
}

export interface QueueSnapshot {
  available: boolean;
  todo: number;
  doing: number;
  done: number;
  failed: number;
  cPending: number;
  cRunning: number;
  cFailed: number;
  todoBatches: Array<{batch: string; count: number; materialsDir: string; layout: string}>;
  cPendingBatches: Array<{batch: string; status: string; stale: boolean; layout: string; materialsDir: string}>;
}

export interface WorkspaceResolution {
  /** 解析后的工作区目录；未配置时为 null。 */
  dir: string | null;
  source: 'env' | 'task' | null;
  /** 生效的环境变量名（source=env 时有值）。 */
  envKey: string | null;
  exists: boolean;
  /** 未配置或目录不存在时的可读错误。 */
  error: string | null;
}

export type WorkspaceTaskConfig = Pick<TaskConfig, 'id' | 'workspaceEnv' | 'workspaceDir'>;

function resolveWorkspaceValue(value: string, contextHubRoot: string): string {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(contextHubRoot, value);
}

/**
 * 工作区优先级：任务的环境变量 → 任务 workspaceDir（绝对路径或相对 context-hub 根）→ 报错。
 * 不做硬编码兜底：没有显式来源时宁可失败，也不猜仓库位置。
 */
export function describeWorkspace(
  task: WorkspaceTaskConfig,
  contextHubRoot: string = CONTEXT_HUB_ROOT,
): WorkspaceResolution {
  const envKey = task.workspaceEnv?.trim() || null;
  const fromEnv = envKey ? process.env[envKey] : undefined;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    const dir = path.resolve(fromEnv.trim());
    const exists = existsSync(dir);
    return {
      dir,
      source: 'env',
      envKey,
      exists,
      error: exists ? null : `工作区不存在: ${dir}（来自环境变量 ${envKey}）`,
    };
  }
  if (typeof task.workspaceDir === 'string' && task.workspaceDir.trim() !== '') {
    const dir = resolveWorkspaceValue(task.workspaceDir.trim(), contextHubRoot);
    const exists = existsSync(dir);
    return {
      dir,
      source: 'task',
      envKey: null,
      exists,
      error: exists ? null : `工作区不存在: ${dir}（来自任务 ${task.id} 的 workspaceDir）`,
    };
  }
  return {
    dir: null,
    source: null,
    envKey,
    exists: false,
    error: `任务 ${task.id} 未配置 workspaceDir${envKey ? `，环境变量 ${envKey} 也为空` : ''}`,
  };
}

export function resolveWorkspaceDir(task: TaskConfig, contextHubRoot: string = CONTEXT_HUB_ROOT): string {
  const resolved = describeWorkspace(task, contextHubRoot);
  if (!resolved.dir) throw new Error(resolved.error ?? `任务 ${task.id} 工作区未配置`);
  return resolved.dir;
}

export function resolveMaterialsDir(wizzRepoDir: string): string {
  const fromEnv = process.env.WIZZ_MATERIALS;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return path.resolve(fromEnv.trim());
  }
  return path.join(wizzRepoDir, 'materials');
}

export async function loadTaskDefinitions(contextHubRoot: string = CONTEXT_HUB_ROOT): Promise<Map<TaskId, TaskConfig>> {
  const tasksDir = path.join(contextHubRoot, 'automation', 'tasks');
  const map = new Map<TaskId, TaskConfig>();
  for (const id of TASK_IDS) {
    const file = path.join(tasksDir, `${id}.json`);
    if (!existsSync(file)) continue;
    const parsed = JSON.parse(await readFile(file, 'utf8')) as TaskConfig;
    map.set(parsed.id, parsed);
  }
  return map;
}

/** 早期版本给「默认未启用」也写了一条暂停原因，会把级联永久堵住；这里做一次性清理。 */
const LEGACY_DEFAULT_PAUSE = 'P0 default manual-only';

export function syncTasksToDatabase(db: DatabaseSync, tasks: Map<TaskId, TaskConfig>): void {
  const now = new Date().toISOString();
  const select = db.prepare('SELECT task_id, enabled, paused_reason FROM automation_tasks WHERE task_id = ?');
  const insert = db.prepare(
    'INSERT INTO automation_tasks (task_id, enabled, paused_reason, config_json, updated_at) VALUES (?, ?, ?, ?, ?)',
  );
  const updateConfig = db.prepare(
    'UPDATE automation_tasks SET config_json = ?, updated_at = ? WHERE task_id = ?',
  );
  // `enabled=0` 只是「定时器没开」，不是「被暂停」。只有 pause 才写 paused_reason，
  // 否则手动 run A 会在 B 处被一条没人写过的暂停原因拦住。
  db.prepare('UPDATE automation_tasks SET paused_reason = NULL WHERE paused_reason = ?').run(LEGACY_DEFAULT_PAUSE);

  for (const [taskId, config] of tasks.entries()) {
    const existing = select.get(taskId) as {task_id: string; enabled: number; paused_reason: string | null} | undefined;
    const configJson = JSON.stringify(config);
    if (!existing) {
      insert.run(taskId, config.enabled ? 1 : 0, null, configJson, now);
    } else {
      updateConfig.run(configJson, now, taskId);
    }
  }
}

export function getTaskState(db: DatabaseSync, taskId: TaskId): StoredTaskRow | null {
  const row = db
    .prepare('SELECT task_id, enabled, paused_reason, config_json, updated_at FROM automation_tasks WHERE task_id = ?')
    .get(taskId) as StoredTaskRow | undefined;
  return row ?? null;
}

export function listTaskStates(db: DatabaseSync): StoredTaskRow[] {
  return db
    .prepare('SELECT task_id, enabled, paused_reason, config_json, updated_at FROM automation_tasks ORDER BY task_id ASC')
    .all() as unknown as StoredTaskRow[];
}

export function setTaskEnabled(db: DatabaseSync, taskId: TaskId, enabled: boolean, pausedReason: string | null = null): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE automation_tasks SET enabled = ?, paused_reason = ?, updated_at = ? WHERE task_id = ?').run(
    enabled ? 1 : 0,
    enabled ? null : pausedReason,
    now,
    taskId,
  );
}

async function readJsonFilesInDir(dir: string): Promise<Array<{name: string; data: any}>> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const out: Array<{name: string; data: any}> = [];
  for (const name of entries.sort()) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    try {
      const data = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
      out.push({name, data});
    } catch {
      // ignore malformed transient files
    }
  }
  return out;
}

export async function readQueueSnapshot(materialsDir: string): Promise<QueueSnapshot> {
  const queueRoot = path.join(materialsDir, '_queue');
  if (!existsSync(queueRoot)) {
    return {
      available: false,
      todo: 0,
      doing: 0,
      done: 0,
      failed: 0,
      cPending: 0,
      cRunning: 0,
      cFailed: 0,
      todoBatches: [],
      cPendingBatches: [],
    };
  }

  const [todoCards, doingCards, doneCards, failedCards, cStates] = await Promise.all([
    readJsonFilesInDir(path.join(queueRoot, 'todo')),
    readJsonFilesInDir(path.join(queueRoot, 'doing')),
    readJsonFilesInDir(path.join(queueRoot, 'done')),
    readJsonFilesInDir(path.join(queueRoot, 'failed')),
    readJsonFilesInDir(path.join(queueRoot, 'c')),
  ]);

  const todoMap = new Map<string, {batch: string; count: number; materialsDir: string; layout: string}>();
  for (const {data} of todoCards) {
    const batch = String(data?.batch ?? '');
    if (!batch) continue;
    const prev = todoMap.get(batch);
    if (prev) {
      prev.count += 1;
    } else {
      todoMap.set(batch, {
        batch,
        count: 1,
        materialsDir: String(data?.materialsDir ?? ''),
        layout: String(data?.layout ?? ''),
      });
    }
  }

  const inflightBatches = new Set<string>();
  for (const {data} of [...todoCards, ...doingCards]) {
    if (data?.batch) inflightBatches.add(String(data.batch));
  }

  const cByBatch = new Map<string, any>();
  let cRunning = 0;
  let cFailed = 0;
  for (const {data} of cStates) {
    if (!data?.batch) continue;
    cByBatch.set(String(data.batch), data);
    if (data.status === 'running' || data.status === 'claimed') cRunning += 1;
    if (data.status === 'failed') cFailed += 1;
  }

  const doneByBatch = new Map<string, any[]>();
  for (const {data} of doneCards) {
    const batch = String(data?.batch ?? '');
    if (!batch) continue;
    const list = doneByBatch.get(batch) ?? [];
    list.push(data);
    doneByBatch.set(batch, list);
  }

  const cPendingBatches: QueueSnapshot['cPendingBatches'] = [];
  for (const [batch, cards] of [...doneByBatch.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const cState = cByBatch.get(batch);
    if (cState && (cState.status === 'done' || cState.status === 'failed')) continue;
    if (inflightBatches.has(batch)) continue;
    const stamp = Date.parse(cState?.updatedAt ?? cState?.claimedAt ?? '');
    const stale = Boolean(cState?.owner) && (Number.isNaN(stamp) || Date.now() - stamp > 240 * 60 * 1000);
    cPendingBatches.push({
      batch,
      status: cState?.status ?? 'unclaimed',
      stale,
      layout: String(cState?.layout ?? cards[0]?.layout ?? ''),
      materialsDir: String(cards[0]?.materialsDir ?? ''),
    });
  }

  return {
    available: true,
    todo: todoCards.length,
    doing: doingCards.length,
    done: doneCards.length,
    failed: failedCards.length,
    cPending: cPendingBatches.length,
    cRunning,
    cFailed,
    todoBatches: [...todoMap.values()].sort((a, b) => a.batch.localeCompare(b.batch)),
    cPendingBatches,
  };
}
