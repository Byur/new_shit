/** 回答卡：一条飞书消息一张卡，标题从排队中到处理中到终态，正文随轮次增长。 */

import { existsSync } from 'node:fs';
import { readFile, rename, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { CARD_COLORS, CARD_MAX_BYTES, CARD_PATCH_DEBOUNCE_MS } from '../common/constants.js';
import { answerCard, cardBytes, textCard } from '../core/cards.js';
import { clampAnswer, textOfAssistantMessage } from '../core/text.js';

/** 回答卡状态文件名。 */
const CARDS_FILE = 'cards.json';

/**
 * 读卡片记账文件（重启后仍能认领运行中的卡片）。
 *
 * @param dir 状态目录
 * @param logger 日志
 * @returns 记账 Map
 */
async function loadCards(dir, logger) {
  const file = join(dir, CARDS_FILE);
  const cards = new Map();
  if (!existsSync(file)) return cards;
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (raw !== null && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw)) cards.set(key, value);
    }
  } catch (error) {
    logger?.warn?.(`回答卡记账读取失败（${error?.message ?? error}），按空处理`);
  }
  return cards;
}

/**
 * 建回答卡驱动器。
 *
 * @param deps.logger 日志
 * @param deps.outbound 出站句柄
 * @param deps.stateDir 状态目录
 * @returns 驱动器
 */
/** 所有构造过的实例；插件卸载时用来落盘（测试也能据此确认生命周期）。 */
const instances = new Set();

export function createAnswerCards({ logger, outbound, stateDir }) {
  /** feishuMessageId → `{ cardId, title, content, action, turn, tooLong, sendFailed }` */
  const cards = new Map();
  /** feishuMessageId → 排队中的写卡任务。 */
  const chains = new Map();
  /** feishuMessageId → 防抖定时器。 */
  const debounces = new Map();
  let saveTimer = null;

  /**
   * 异步把所有卡片记账落盘（节流）。
   */
  function scheduleSave() {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persist();
    }, 500);
    saveTimer.unref?.();
  }

  /**
   * 落盘。
   */
  async function persist() {
    try {
      await mkdir(stateDir, { recursive: true });
      const file = join(stateDir, CARDS_FILE);
      const tmp = `${file}.tmp-${process.pid}`;
      const plain = {};
      for (const [key, value] of cards.entries()) plain[key] = value;
      await writeFile(tmp, JSON.stringify(plain), 'utf8');
      await rename(tmp, file);
    } catch (error) {
      logger.warn(`回答卡记账落盘失败：${error?.message ?? error}`);
    }
  }

  /**
   * 取一张卡的记账。
   *
   * @param messageId 飞书消息 ID
   * @returns 记账；没有时 undefined
   */
  function get(messageId) {
    return cards.get(messageId);
  }

  /**
   * 把一件活排进这张卡的队列：同一张卡的写操作按顺序来。
   *
   * @param messageId 飞书消息 ID
   * @param job 要干的事
   * @returns 这一笔的 promise
   */
  function enqueue(messageId, job) {
    const previous = chains.get(messageId) ?? Promise.resolve();
    const next = previous.then(job).catch((error) => {
      logger.warn(`回答卡操作失败（${messageId}）：${error?.message ?? error}`);
    });
    chains.set(messageId, next);
    return next;
  }

  /**
   * 按记账画一次卡并推给飞书。
   *
   * @param messageId 飞书消息 ID
   * @param patch 要改的字段
   */
  async function paint(messageId, patch = {}) {
    const record = cards.get(messageId);
    if (record === undefined) return;
    Object.assign(record, patch);
    const content = clampAnswer(record.content ?? '');
    if ((record.content ?? '').length > content.length) {
      record.tooLong = true;
      record.content = content;
    }
    const card = record.action === undefined
      ? textCard({ title: record.title, content, color: record.color })
      : answerCard({ messageId, title: record.title, color: record.color, content, action: record.action });
    if (cardBytes(card) > CARD_MAX_BYTES) {
      record.tooLong = true;
      record.action = undefined;
      record.content = '内容过长，请到 DSH Desktop 查看完整回答。';
      await outbound.patchCard({ messageId: record.cardId, card: textCard({ title: '内容过长', content: record.content, color: CARD_COLORS.failed }) });
      scheduleSave();
      return;
    }
    if (record.cardId === '') {
      scheduleSave();
      return;
    }
    const updated = await outbound.patchCard({ messageId: record.cardId, card });
    if (!updated) {
      record.sendFailed = true;
      logger.warn(`回答卡更新没发到飞书（${messageId}，cardId=${record.cardId}）`);
    }
    scheduleSave();
  }

  /**
   * 开一张卡：回复在用户那条消息上，先把标题摆对。
   *
   * @param options.messageId 触发它的飞书消息 ID
   * @param options.chatId 会话 ID
   * @param options.title 初始标题
   * @param options.action 初始按钮
   * @param options.turn turn 号（已经开跑时）
   * @returns 卡片消息 ID；失败 undefined
   */
  async function open({ messageId, chatId, title, action, turn = 0 }) {
    if (cards.has(messageId)) return cards.get(messageId).cardId;
    const record = { cardId: '', title, content: '', color: CARD_COLORS.queued, action, turn, tooLong: false, sendFailed: false };
    cards.set(messageId, record);
    const card = action === undefined
      ? textCard({ title, content: '…', color: record.color })
      : answerCard({ messageId, title, color: record.color, content: '…', action });
    const cardId = await outbound.replyCard({ chatId, messageId, card });
    if (!cardId) {
      cards.delete(messageId);
      logger.warn(`回答卡没发出去（${messageId}）`);
      return undefined;
    }
    record.cardId = cardId;
    logger.info(`回答卡已开出（${messageId}，${title}，cardId=${cardId}）`);
    scheduleSave();
    return cardId;
  }

  /**
   * 排队中 → 处理中（带停止按钮）。
   *
   * @param messageId 飞书消息 ID
   * @param turn turn 号
   */
  function markRunning(messageId, turn) {
    void enqueue(messageId, async () => {
      const record = cards.get(messageId);
      if (record === undefined) return;
      record.turn = turn;
      if (record.title !== '排队中') return;
      await paint(messageId, { title: '处理中', color: CARD_COLORS.running, action: 'stop' });
    });
  }

  /**
   * 追加一段正文（同一张卡的更新按顺序、带防抖）。
   *
   * @param messageId 飞书消息 ID
   * @param text 这一段正文
   */
  function append(messageId, text) {
    const record = cards.get(messageId);
    if (record === undefined || typeof text !== 'string' || text === '') return;
    record.content = record.content === '' ? text : `${record.content}\n\n${text}`;
    scheduleSave();
    const timer = debounces.get(messageId);
    if (timer !== undefined) clearTimeout(timer);
    const next = setTimeout(() => {
      debounces.delete(messageId);
      void enqueue(messageId, () => paint(messageId));
    }, CARD_PATCH_DEBOUNCE_MS);
    next.unref?.();
    debounces.set(messageId, next);
  }

  /**
   * 收尾：按 turn 结束原因换成终态标题，摘掉按钮。
   *
   * @param messageId 飞书消息 ID
   * @param options.title 终态标题
   * @param options.color 颜色
   * @param options.note 追加的说明
   */
  async function finish(messageId, { title, color, note = '' }) {
    const timer = debounces.get(messageId);
    if (timer !== undefined) {
      clearTimeout(timer);
      debounces.delete(messageId);
    }
    await enqueue(messageId, async () => {
      const record = cards.get(messageId);
      if (record === undefined) return;
      const content = [record.content, note].filter((part) => part !== '').join('\n\n');
      await paint(messageId, { title, color, action: undefined, content: content === '' ? '（这一轮没有可显示的正文）' : content });
      cards.delete(messageId);
      scheduleSave();
    });
  }

  /**
   * 把一张卡换成一句提示（停止中、已撤回等）。
   *
   * @param messageId 飞书消息 ID
   * @param card 新卡片
   * @param title 记录标题
   */
  async function replace(messageId, card, title) {
    const record = cards.get(messageId);
    if (record === undefined) return;
    record.title = title;
    record.action = undefined;
    await outbound.patchCard({ messageId: record.cardId, card });
  }

  /**
   * 丢掉一张卡的记账（不对飞书做任何事）。
   *
   * @param messageId 飞书消息 ID
   */
  function drop(messageId) {
    cards.delete(messageId);
    scheduleSave();
  }

  /**
   * 把还没写完的记账落盘（插件卸载、测试收尾时调用）。
   *
   * @returns 写完后 resolve
   */
  async function flush() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await Promise.all([...chains.values()].map((chain) => chain.catch(() => {})));
    await persist();
  }

  const instance = {
    load: () => loadCards(stateDir, logger).then((loaded) => {
      for (const [key, value] of loaded.entries()) cards.set(key, value);
      return cards.size;
    }),
    get,
    open,
    markRunning,
    append,
    finish,
    replace,
    drop,
    textOfAssistantMessage,
    flush,
  };
  instances.add(instance);
  return instance;
}

/**
 * 把所有实例的记账落盘（插件卸载用）。
 *
 * @returns 写完后 resolve
 */
export async function flushAllAnswerCards() {
  await Promise.all([...instances].map((instance) => instance.flush().catch(() => {})));
}
