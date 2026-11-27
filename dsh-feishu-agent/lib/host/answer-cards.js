/** 回答卡：一条飞书消息一张卡，标题从排队中到处理中到终态，正文随轮次增长。 */

import { existsSync } from 'node:fs';
import { readFile, rename, writeFile, mkdir } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

import { CARD_COLORS, CARD_MAX_BYTES, CARD_PATCH_DEBOUNCE_MS } from '../common/constants.js';
import { answerCard, cardBytes, imgElement, markdown, textCard } from '../core/cards.js';
import { clampAnswer, splitImageRefs, textOfAssistantMessage } from '../core/text.js';

/** 回答卡状态文件名。 */
const CARDS_FILE = 'cards.json';

/** 记住最近发过的多少张卡：引用回复时要靠它还原卡片正文（飞书 API 只回标题）。 */
const RECENT_CARD_LIMIT = 50;

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
  /** 回答正文里的 `![alt](路径)` 是否转成卡片图片；`FEISHU_AGENT_INLINE_IMAGES=off` 可关掉。 */
  const inlineImages = String(process.env.FEISHU_AGENT_INLINE_IMAGES ?? '').toLowerCase() !== 'off';
  /** feishuMessageId → `{ cardId, title, content, action, turn, tooLong, sendFailed }` */
  const cards = new Map();
  /** cardId → `{ title, content, at }`：发出去的卡片正文，供引用回复回查。 */
  const recent = new Map();
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
   * 把正文排成卡片元素：文字走 markdown，`![alt](path)` 上传成图片元素。
   *
   * 上传失败不吞掉内容：退回一行文字，把路径和原因写清楚。
   *
   * @param record 记账
   * @param content 已截断的正文
   * @returns 卡片元素数组
   */
  async function buildBody(record, content) {
    const fallback = [markdown(content === '' ? '…' : content)];
    if (!inlineImages) return fallback;
    const segments = splitImageRefs(content);
    if (!segments.some((segment) => segment.type === 'image')) return fallback;

    const elements = [];
    for (const segment of segments) {
      if (segment.type === 'text') {
        if (segment.text.trim() !== '') elements.push(markdown(segment.text));
        continue;
      }
      const path = isAbsolute(segment.path) ? segment.path : join(record.workspacePath ?? '', segment.path);
      const uploaded = await outbound.uploadImage({ path });
      if (uploaded.imageKey !== undefined) {
        elements.push(imgElement({ imgKey: uploaded.imageKey, alt: segment.alt === '' ? basename(path) : segment.alt }));
      } else {
        logger.warn(`卡片图片没发出去（${path}）：${uploaded.error}`);
        elements.push(markdown(`🖼 ${segment.alt === '' ? basename(path) : segment.alt}（图片没发出去：${uploaded.error}）`));
      }
    }
    return elements.length > 0 ? elements : fallback;
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
    const activity = activityText(record, record.action === 'stop');
    const body = await buildBody(record, content);
    const card = answerCard({
      messageId,
      title: record.title,
      color: record.color,
      content,
      action: record.action,
      activity,
      elements: body,
      footerButtons: record.footerButtons,
    });
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
   * 给标题加路由前缀（前缀与标题之间留一个空格；没有前缀时原样返回）。
   *
   * @param prefix 标题前缀
   * @param title 标题
   * @returns 展示用标题
   */
  function withPrefix(prefix, title) {
    return typeof prefix === 'string' && prefix !== '' ? `${prefix} ${title}` : title;
  }

  /**
   * 开一张卡：回复在用户那条消息上，先把标题摆对。
   *
   * @param options.messageId 触发它的飞书消息 ID
   * @param options.chatId 会话 ID
   * @param options.title 初始标题
   * @param options.action 初始按钮
   * @param options.turn turn 号（已经开跑时）
   * @param options.workspacePath 会话工作区（相对图片路径按它解析）
   * @param options.titlePrefix 标题前缀（降级/规则路由的可见标记）
   * @returns 卡片消息 ID；失败 undefined
   */
  async function open({ messageId, chatId, title, action, turn = 0, workspacePath = '', titlePrefix = '' }) {
    if (cards.has(messageId)) return cards.get(messageId).cardId;
    const displayTitle = withPrefix(titlePrefix, title);
    const record = {
      cardId: '',
      title: displayTitle,
      titlePrefix,
      content: '',
      color: CARD_COLORS.queued,
      action,
      turn,
      queued: true,
      tooLong: false,
      sendFailed: false,
      tools: {},
      startedAt: 0,
      workspacePath: '',
    };
    cards.set(messageId, record);
    const card = action === undefined
      ? textCard({ title: displayTitle, content: '…', color: record.color })
      : answerCard({ messageId, title: displayTitle, color: record.color, content: '…', action });
    const cardId = await outbound.replyCard({ chatId, messageId, card });
    if (!cardId) {
      cards.delete(messageId);
      logger.warn(`回答卡没发出去（${messageId}）`);
      return undefined;
    }
    record.cardId = cardId;
    record.workspacePath = workspacePath;
    logger.info(`回答卡已开出（${messageId}，${displayTitle}，cardId=${cardId}）`);
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
      if (record === undefined || record.queued !== true) return;
      record.queued = false;
      record.turn = turn;
      if (record.startedAt === 0) record.startedAt = Date.now();
      await paint(messageId, { title: withPrefix(record.titlePrefix, '处理中'), color: CARD_COLORS.running, action: 'stop' });
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
    schedulePaint(messageId);
  }

  /**
   * 排一次防抖的刷新：同一张卡的高频更新合并成一次 PATCH。
   *
   * @param messageId 飞书消息 ID
   */
  function schedulePaint(messageId) {
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
   * 记一次工具调用（不往正文里追加内容，只在卡片底部汇总成一行）。
   *
   * @param messageId 飞书消息 ID
   * @param tool 工具名
   */
  function noteTool(messageId, tool) {
    const record = cards.get(messageId);
    if (record === undefined || typeof tool !== 'string' || tool === '') return;
    const tools = record.tools ?? (record.tools = {});
    tools[tool] = (tools[tool] ?? 0) + 1;
    scheduleSave();
    schedulePaint(messageId);
  }

  /**
   * 把工具计数排成一行：`🔧 25 次工具调用 · bash ×12 · read ×7`。
   *
   * @param record 记账
   * @param running 是否还在跑（还在跑就不写用时）
   * @returns 摘要行；没有工具调用时空串
   */
  function activityText(record, running) {
    const entries = Object.entries(record.tools ?? {})
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1]);
    if (entries.length === 0) return '';
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const shown = entries.slice(0, 6).map(([name, count]) => `${name} ×${count}`);
    const rest = entries.length - shown.length;
    const parts = [`🔧 ${total} 次工具调用`, ...shown];
    if (rest > 0) parts.push(`等 ${rest} 种`);
    if (!running && record.startedAt > 0) {
      const seconds = Math.max(0, Math.round((Date.now() - record.startedAt) / 1000));
      parts.push(`用时 ${seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`}`);
    }
    return parts.join(' · ');
  }

  /**
   * 收尾：按 turn 结束原因换成终态标题，摘掉运行中按钮（可附终态纠错按钮）。
   *
   * @param messageId 飞书消息 ID
   * @param options.title 终态标题
   * @param options.color 颜色
   * @param options.note 追加的说明
   * @param options.footerButtons 终态底部按钮数组（可选）
   */
  async function finish(messageId, { title, color, note = '', footerButtons } = {}) {
    const timer = debounces.get(messageId);
    if (timer !== undefined) {
      clearTimeout(timer);
      debounces.delete(messageId);
    }
    await enqueue(messageId, async () => {
      const record = cards.get(messageId);
      if (record === undefined) return;
      const displayTitle = withPrefix(record.titlePrefix, title);
      const content = [record.content, note].filter((part) => part !== '').join('\n\n');
      await paint(messageId, {
        title: displayTitle,
        color,
        action: undefined,
        footerButtons: Array.isArray(footerButtons) && footerButtons.length > 0 ? footerButtons : undefined,
        content: content === '' ? '（这一轮没有可显示的正文）' : content,
      });
      // 飞书的消息 API 只把卡片读成「标题 + 降级占位」，所以自己留一份正文给引用回复用。
      if (typeof record.cardId === 'string' && record.cardId !== '') {
        recent.set(record.cardId, { title: displayTitle, content: record.content ?? '', at: Date.now() });
        while (recent.size > RECENT_CARD_LIMIT) {
          const oldest = recent.keys().next().value;
          if (oldest === undefined) break;
          recent.delete(oldest);
        }
      }
      cards.delete(messageId);
      scheduleSave();
    });
  }

  /**
   * 收尾「上一次进程留下的半截卡」：插件重启后，这些轮次已经不可能再收到收尾事件了。
   *
   * @returns 收尾的卡片数量
   */
  async function reconcileStale() {
    let count = 0;
    for (const [messageId, record] of [...cards.entries()]) {
      cards.delete(messageId);
      if (typeof record.cardId !== 'string' || record.cardId === '') continue;
      count += 1;
      await outbound
        .patchCard({
          messageId: record.cardId,
          card: textCard({ title: '已中断', content: '插件重启前这一轮没有收尾，重新发一句吧。', color: CARD_COLORS.failed }),
        })
        .catch(() => {});
    }
    if (count > 0) {
      logger.info(`收尾了 ${count} 张重启前没结束的卡`);
      scheduleSave();
    }
    return count;
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
   * 回查一张卡发出时的正文（引用回复用）。
   *
   * @param cardId 卡片消息 ID
   * @returns `{ title, content }`；没记过时 undefined
   */
  function recall(cardId) {
    return recent.get(cardId);
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
    noteTool,
    finish,
    reconcileStale,
    recall,
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
