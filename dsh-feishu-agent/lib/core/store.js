/** 状态存储：一个 JSON 文件，原子写（tmp + rename），读写都在内存里做。 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { SEEN_EVENT_LIMIT } from '../common/constants.js';

/** 状态文件的当前结构版本；结构变了就加一并在 migrate 里补迁移。 */
export const STATE_VERSION = 1;

/**
 * 造一份空状态。
 *
 * @returns 空状态对象
 */
export function emptyState() {
  return {
    version: STATE_VERSION,
    ownerOpenId: '',
    bindings: {},
    schedules: [],
  };
}

/**
 * 把读到的对象补成合法状态：缺的字段补默认值，版本不认识就报错（不静默丢数据）。
 *
 * @param raw 从磁盘读出来的对象
 * @returns 结构完整的状态
 */
export function normalizeState(raw) {
  if (raw === null || typeof raw !== 'object') return emptyState();
  const version = typeof raw.version === 'number' ? raw.version : STATE_VERSION;
  if (version > STATE_VERSION) {
    throw new Error(`state.json 的版本 ${version} 比本插件支持的 ${STATE_VERSION} 新，拒绝加载以免丢数据`);
  }
  const state = emptyState();
  if (typeof raw.ownerOpenId === 'string') state.ownerOpenId = raw.ownerOpenId;
  if (raw.bindings !== null && typeof raw.bindings === 'object') {
    for (const [key, value] of Object.entries(raw.bindings)) {
      if (value === null || typeof value !== 'object') continue;
      state.bindings[key] = { ...value, key };
    }
  }
  if (Array.isArray(raw.schedules)) {
    state.schedules = raw.schedules.filter((item) => item !== null && typeof item === 'object');
  }
  return state;
}

/**
 * 新建一个状态存储。读一次磁盘，之后都在内存里改，`save()` 落盘。
 *
 * @param options.dir 状态目录
 * @param options.logger 日志
 * @returns 存储句柄
 */
export function createStore({ dir, logger }) {
  const file = join(dir, 'state.json');
  let state = emptyState();
  let dirty = false;
  let writing = null;
  /** 事件去重（内存）：飞书的重推窗口是 7.5 小时，重启后补推的那批靠时间戳丢弃。 */
  const seenEventIds = new Set();
  const seenQueue = [];
  /** 未落盘的写盘 promise；卸载与测试用它等写完。 */
  let pending = null;

  /**
   * 从磁盘加载；文件不存在就按空状态处理，解析失败则备份坏文件后重置。
   */
  async function load() {
    try {
      const text = await readFile(file, 'utf8');
      state = normalizeState(JSON.parse(text));
      logger?.info?.(`已加载状态：${Object.keys(state.bindings).length} 个绑定、${state.schedules.length} 个定时任务`);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        state = emptyState();
        return;
      }
      const backup = `${file}.corrupt-${Date.now()}`;
      logger?.warn?.(`状态文件解析失败（${error?.message ?? error}），已备份到 ${backup} 并重置`);
      try {
        await rename(file, backup);
      } catch {
        // 备份失败也只能继续：保留内存里的空状态。
      }
      state = emptyState();
    }
  }

  /**
   * 落盘：串行化，避免并发写把文件写坏。
   *
   * @returns 写完后 resolve
   */
  async function save(force = false) {
    if (writing !== null) {
      await writing.catch(() => {});
    }
    // force：首次启动要无条件落一次盘，否则 owner 与绑定要等第一次 touch 才有文件。
    if (!dirty && !force) return;
    dirty = false;
    const snapshot = JSON.stringify(state, null, 2);
    writing = (async () => {
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(tmp, snapshot, 'utf8');
      await rename(tmp, file);
    })();
    pending = writing;
    try {
      await writing;
    } finally {
      writing = null;
    }
  }

  /** 标脏并异步落盘；调用方不必等。 */
  function touch() {
    dirty = true;
    save().catch((error) => logger?.warn?.(`状态落盘失败：${error?.message ?? error}`));
  }


  /**
   * 等所有在途写盘完成（插件卸载、测试收尾时调用）。
   *
   * @returns 写完后 resolve
   */
  async function flush() {
    if (pending !== null) await pending.catch(() => {});
    if (dirty) await save();
  }

  /**
   * 记一个见过的事件 ID，并返回它是不是新的。
   *
   * @param eventId 事件唯一 ID
   * @returns 第一次见到时 true
   */
  function rememberEvent(eventId) {
    if (typeof eventId !== 'string' || eventId === '') return true;
    if (seenEventIds.has(eventId)) return false;
    seenEventIds.add(eventId);
    seenQueue.push(eventId);
    while (seenQueue.length > SEEN_EVENT_LIMIT) {
      const evicted = seenQueue.shift();
      seenEventIds.delete(evicted);
    }
    return true;
  }

  return {
    load,
    save,
    touch,
    flush,
    rememberEvent,
    get state() {
      return state;
    },
  };
}
