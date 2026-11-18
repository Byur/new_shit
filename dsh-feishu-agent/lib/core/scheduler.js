/** 调度：持久化的定时任务，错过了只补最新一次。 */

/**
 * 算一个任务下一次该跑的时间（严格大于 `now`）。
 *
 * @param schedule 任务记录
 * @param now 当前时间（毫秒）
 * @returns 下一次时间（毫秒）；不会再有时 undefined
 */
export function nextDueAt(schedule, now) {
  if (typeof schedule.at === 'string') {
    const at = Date.parse(schedule.at);
    return Number.isFinite(at) ? at : undefined;
  }
  const every = Number(schedule.everySeconds ?? 0);
  if (!Number.isFinite(every) || every < 60) return undefined;
  const anchor = Date.parse(schedule.anchorAt ?? schedule.createdAt ?? '');
  const base = Number.isFinite(anchor) ? anchor : now;
  if (now < base) return base;
  const slots = Math.floor((now - base) / (every * 1000)) + 1;
  return base + slots * every * 1000;
}

/**
 * 判断一条重复任务此刻是否已经到点：距上次执行已过一个及以上周期。
 *
 * @param schedule 任务记录
 * @param now 当前时间（毫秒）
 * @returns 到点时 true
 */
export function isRecurringDue(schedule, now) {
  if (typeof schedule.at === 'string') return false;
  const every = Number(schedule.everySeconds ?? 0);
  if (!Number.isFinite(every) || every < 60) return false;
  const last = Date.parse(schedule.lastRunAt ?? '');
  const anchor = Date.parse(schedule.anchorAt ?? schedule.createdAt ?? '');
  const since = Number.isFinite(last) ? last : Number.isFinite(anchor) ? anchor : now;
  return now - since >= every * 1000;
}

/**
 * 判断一条一次性任务此刻是否已到点。
 *
 * @param schedule 任务记录
 * @param now 当前时间（毫秒）
 * @returns 到点时 true
 */
export function isOneShotDue(schedule, now) {
  if (typeof schedule.at !== 'string') return false;
  const at = Date.parse(schedule.at);
  return Number.isFinite(at) && at <= now;
}

/**
 * 校验并补全一条定时任务配置。
 *
 * @param input 用户给的任务
 * @returns `{ schedule }` 或 `{ error }`
 */
export function normalizeSchedule(input) {
  if (input === null || typeof input !== 'object') return { error: '定时任务必须是对象' };
  const id = typeof input.id === 'string' && input.id.trim() !== '' ? input.id.trim() : '';
  const chatId = typeof input.chatId === 'string' ? input.chatId.trim() : '';
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (id === '') return { error: '定时任务缺少 id' };
  if (chatId === '') return { error: `定时任务 ${id} 缺少 chatId` };
  if (prompt === '') return { error: `定时任务 ${id} 缺少 prompt` };
  const hasAt = typeof input.at === 'string' && input.at.trim() !== '';
  const hasEvery = input.everySeconds !== undefined;
  if (hasAt === hasEvery) return { error: `定时任务 ${id} 必须且只能给 at 或 everySeconds 之一` };
  if (hasAt && !Number.isFinite(Date.parse(input.at))) return { error: `定时任务 ${id} 的 at 不是合法时间` };
  if (hasEvery) {
    const every = Number(input.everySeconds);
    if (!Number.isFinite(every) || every < 60) return { error: `定时任务 ${id} 的 everySeconds 至少 60` };
  }
  const now = new Date().toISOString();
  return {
    schedule: {
      id,
      chatId,
      prompt,
      ...(typeof input.title === 'string' && input.title.trim() !== '' ? { title: input.title.trim() } : {}),
      enabled: input.enabled !== false,
      createdAt: now,
      ...(hasAt ? { at: input.at.trim() } : { everySeconds: Number(input.everySeconds), anchorAt: now }),
    },
  };
}

/**
 * 建调度器：定时扫一遍，到点的交给 `onDue`。
 *
 * @param deps.logger 日志
 * @param deps.store 状态存储
 * @param deps.onDue 到点回调：`(schedule) => Promise<void>`
 * @param deps.intervalMs 扫描间隔
 * @returns 调度器
 */
export function createScheduler({ logger, store, onDue, intervalMs = 30_000 }) {
  let timer = null;
  let running = false;

  /**
   * 扫一遍：一次性任务到点就跑并删除；重复任务按周期补一次（只补最新）。
   */
  async function tick() {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const oneShots = store.state.schedules.filter((item) => isOneShotDue(item, now));
      const recurring = store.state.schedules.filter((item) => item.enabled !== false && isRecurringDue(item, now));
      if (oneShots.length > 0) {
        store.state.schedules = store.state.schedules.filter((item) => !oneShots.includes(item));
        store.touch();
      }
      for (const schedule of [...oneShots, ...recurring]) {
        schedule.lastRunAt = new Date().toISOString();
        store.touch();
        try {
          logger.info(`定时任务 ${schedule.id} 触发`);
          await onDue(schedule);
        } catch (error) {
          logger.warn(`定时任务 ${schedule.id} 执行失败：${error?.message ?? error}`);
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer !== null) return;
      timer = setInterval(() => void tick(), intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    tick,
  };
}
