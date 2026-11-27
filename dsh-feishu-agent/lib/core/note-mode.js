/** 速记模式：一段窗口内的每条消息都直接写入待整理，不经过分类器。 */

/** 默认开启时长（分钟）。 */
export const NOTE_MODE_DEFAULT_MINUTES = 10;

/** 单次延长后的剩余时间上限（分钟），避免一直点「延长」把模式挂一整天。 */
export const NOTE_MODE_MAX_MINUTES = 120;

const MINUTE_MS = 60 * 1000;

/**
 * 把用户给的分钟数收进可用区间。
 *
 * @param minutes 原始值
 * @returns 1 ~ `NOTE_MODE_MAX_MINUTES` 之间的整数
 */
export function clampNoteMinutes(minutes) {
  const value = Math.round(Number(minutes));
  if (!Number.isFinite(value)) return NOTE_MODE_DEFAULT_MINUTES;
  return Math.max(1, Math.min(NOTE_MODE_MAX_MINUTES, value));
}

/**
 * 把剩余毫秒格式化成 `mm:ss`（超过一小时按分钟继续累加）。
 *
 * @param remainingMs 剩余毫秒
 * @returns `mm:ss`
 */
export function formatRemaining(remainingMs) {
  const total = Math.max(0, Math.ceil(Number(remainingMs) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 建速记模式状态机。
 *
 * 只存在内存里：进程重启后窗口自动失效，避免升级后半夜仍在把消息写进笔记。
 * 窗口按 `chatId` 隔离，私聊之间互不影响。
 *
 * @param options.now 取当前时间（测试可注入）
 * @returns 开启 / 延长 / 关闭 / 查询 / 计数
 */
export function createNoteMode({ now = Date.now } = {}) {
  /** chatId → `{ until, count }` */
  const sessions = new Map();

  function keyOf(chatId) {
    return String(chatId ?? '');
  }

  function live(chatId) {
    const key = keyOf(chatId);
    const item = sessions.get(key);
    if (item === undefined) return undefined;
    if (item.until <= now()) {
      sessions.delete(key);
      return undefined;
    }
    return item;
  }

  /**
   * 查一个会话的速记状态。
   *
   * @param chatId 飞书 chatId
   * @returns `{ active, remainingMs, count }`
   */
  function status(chatId) {
    const item = live(chatId);
    if (item === undefined) return { active: false, remainingMs: 0, count: 0 };
    return { active: true, remainingMs: Math.max(0, item.until - now()), count: item.count };
  }

  /**
   * 开启速记模式（已在窗口内时重置为新的时长）。
   *
   * @param chatId 飞书 chatId
   * @param options.minutes 时长（分钟）
   * @returns 开启后的状态
   */
  function enable(chatId, { minutes = NOTE_MODE_DEFAULT_MINUTES } = {}) {
    const safe = clampNoteMinutes(minutes);
    sessions.set(keyOf(chatId), { until: now() + safe * MINUTE_MS, count: 0 });
    return status(chatId);
  }

  /**
   * 延长窗口；已过期时等价于重新开启。
   *
   * @param chatId 飞书 chatId
   * @param options.minutes 延长多少分钟
   * @returns 延长后的状态
   */
  function extend(chatId, { minutes = NOTE_MODE_DEFAULT_MINUTES } = {}) {
    const safe = clampNoteMinutes(minutes);
    const item = live(chatId);
    if (item === undefined) return enable(chatId, { minutes: safe });
    const limit = now() + NOTE_MODE_MAX_MINUTES * MINUTE_MS;
    item.until = Math.min(limit, item.until + safe * MINUTE_MS);
    return status(chatId);
  }

  /**
   * 关闭速记模式。
   *
   * @param chatId 飞书 chatId
   * @returns 关闭前的状态（`count` 是本次窗口写入的条数）
   */
  function disable(chatId) {
    const before = status(chatId);
    sessions.delete(keyOf(chatId));
    return before;
  }

  /**
   * 记一条成功写入；窗口已过期时不计数。
   *
   * @param chatId 飞书 chatId
   * @returns 本次窗口累计写入条数；未开启时 0
   */
  function record(chatId) {
    const item = live(chatId);
    if (item === undefined) return 0;
    item.count += 1;
    return item.count;
  }

  /**
   * 判断速记模式是否仍在窗口内。
   *
   * @param chatId 飞书 chatId
   * @returns 是否生效
   */
  function isActive(chatId) {
    return live(chatId) !== undefined;
  }

  return { isActive, status, enable, extend, disable, record };
}
