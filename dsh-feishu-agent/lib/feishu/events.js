/** 入站：把飞书原始事件压成插件自己的事件形状。 */

/** 私聊/群聊消息事件。 */
export const MESSAGE_EVENT = 'im.message.receive_v1';

/** 卡片回传交互事件（新版）。 */
export const CARD_ACTION_EVENT = 'card.action.trigger';

/** 要订阅的事件清单。 */
export const SUBSCRIBED_EVENTS = [MESSAGE_EVENT, CARD_ACTION_EVENT];

/**
 * 读事件发生时间（毫秒）。飞书给的是微秒字符串，也兼容毫秒与秒。
 *
 * @param event 飞书事件
 * @returns 毫秒时间戳；读不出时 undefined
 */
export function eventTimeMs(event) {
  const raw = event?.message?.create_time ?? event?.create_time ?? event?.header?.create_time;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const digits = String(Math.trunc(value)).length;
  if (digits >= 16) return Math.round(value / 1000);
  if (digits === 13) return value;
  if (digits === 10) return value * 1000;
  return undefined;
}

/**
 * 取事件唯一 ID：优先 `header.event_id`（v2），退回 `uuid`（v1）。
 *
 * @param event 飞书事件
 * @returns 事件 ID；没有时为空串
 */
export function eventIdOf(event) {
  return String(event?.header?.event_id ?? event?.uuid ?? event?.event_id ?? '');
}

/**
 * 读消息正文：text 直接取 text 字段，post 拼富文本里的纯文字段落。
 *
 * @param message 飞书消息体
 * @returns 正文
 */
export function messageText(message) {
  const type = message?.message_type ?? message?.msg_type ?? '';
  const raw = message?.content;
  if (typeof raw !== 'string' || raw === '') return '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (type === 'text') return typeof parsed?.text === 'string' ? parsed.text : '';
  if (type === 'post') {
    const blocks = Array.isArray(parsed?.content) ? parsed.content : [];
    const lines = [];
    for (const paragraph of blocks) {
      if (!Array.isArray(paragraph)) continue;
      lines.push(paragraph.filter((node) => node?.tag === 'text' || node?.tag === 'a').map((node) => node.text ?? '').join(''));
    }
    return lines.join('\n');
  }
  return '';
}

/**
 * 把消息事件压成插件事件。
 *
 * @param event 飞书原始事件
 * @returns 插件事件；不是消息事件时 undefined
 */
export function normalizeMessageEvent(event) {
  const body = event?.event ?? event;
  const message = body?.message;
  if (message === undefined) return undefined;
  const sender = body?.sender ?? {};
  return {
    kind: 'message',
    eventId: eventIdOf(event),
    appId: String(event?.header?.app_id ?? body?.app_id ?? ''),
    tenantKey: String(event?.header?.tenant_key ?? body?.tenant_key ?? ''),
    chatId: String(message.chat_id ?? body?.chat_id ?? ''),
    chatType: message.chat_type === 'group' ? 'group' : 'p2p',
    threadId: message.thread_id ? String(message.thread_id) : '',
    messageId: String(message.message_id ?? ''),
    parentId: message.parent_id ? String(message.parent_id) : '',
    // 群聊里 @ 了谁；@所有人 的 openId 为空、key 是 '@_all'。
    mentions: Array.isArray(message.mentions)
      ? message.mentions.map((item) => ({
        openId: String(item?.id?.open_id ?? ''),
        key: String(item?.key ?? ''),
        name: String(item?.name ?? ''),
      }))
      : [],
    senderOpenId: String(sender?.sender_id?.open_id ?? sender?.open_id ?? ''),
    senderType: String(sender?.sender_type ?? ''),
    text: messageText(message),
    timeMs: eventTimeMs({ message: { create_time: message.create_time }, header: event?.header }),
  };
}

/**
 * 把卡片回传事件压成插件事件。
 *
 * @param event 飞书原始回调
 * @returns 插件事件
 */
export function normalizeCardAction(event) {
  const body = event?.event ?? event;
  const value = body?.action?.value;
  let parsedValue = value;
  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = {};
    }
  }
  return {
    kind: 'card',
    eventId: eventIdOf(event),
    appId: String(event?.header?.app_id ?? ''),
    tenantKey: String(event?.header?.tenant_key ?? ''),
    chatId: String(body?.context?.open_chat_id ?? ''),
    messageId: String(body?.context?.open_message_id ?? ''),
    operatorOpenId: String(body?.operator?.open_id ?? ''),
    value: parsedValue !== null && typeof parsedValue === 'object' ? parsedValue : {},
    timeMs: eventTimeMs({ header: event?.header }),
  };
}

/**
 * 按事件类型分派到归一化函数。
 *
 * @param type 事件名
 * @param event 飞书原始事件
 * @returns 插件事件；不认识时 undefined
 */
export function normalizeEvent(type, event) {
  if (type === MESSAGE_EVENT) return normalizeMessageEvent(event);
  if (type === CARD_ACTION_EVENT) return normalizeCardAction(event);
  return undefined;
}

/** 非文字消息在引用里怎么表示。 */
const MESSAGE_TYPE_LABEL = {
  image: '[图片]',
  file: '[文件]',
  audio: '[语音]',
  video: '[视频]',
  sticker: '[表情]',
  share_chat: '[群名片]',
  merge_forward: '[合并转发]',
  system: '[系统消息]',
};

/**
 * 从卡片 JSON 里抠出可读文字：标题、plain_text/markdown/lark_md 的 content，按出现顺序。
 *
 * @param node 卡片节点的任意子树
 * @param out 收集数组
 */
function collectCardText(node, out) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectCardText(item, out);
    return;
  }
  const tag = node.tag;
  if ((tag === 'plain_text' || tag === 'markdown' || tag === 'lark_md') && typeof node.content === 'string') {
    out.push(node.content);
    return;
  }
  if (typeof node.title === 'string') out.push(node.title);
  for (const value of Object.values(node)) {
    if (value !== null && typeof value === 'object') collectCardText(value, out);
  }
}

/**
 * 把一条飞书消息压成一句可读摘要，用于「引用回复」时给模型补上下文。
 *
 * 消息可能来自事件（`message.content` 是字符串）或 `im/v1/messages` 返回（`body.content`）。
 *
 * @param message 飞书消息体
 * @returns 摘要；读不出时为空串
 */
export function summarizeMessage(message) {
  if (message === null || typeof message !== 'object') return '';
  const type = String(message.message_type ?? message.msg_type ?? '');
  const raw = message.content ?? message.body?.content;
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    parsed = undefined;
  }

  if (type === 'text') return typeof parsed?.text === 'string' ? parsed.text : '';
  if (type === 'post') {
    const blocks = parsed?.content ?? parsed?.zh_cn?.content ?? [];
    const lines = [];
    for (const paragraph of Array.isArray(blocks) ? blocks : []) {
      if (!Array.isArray(paragraph)) continue;
      lines.push(paragraph.filter((node) => node?.tag === 'text' || node?.tag === 'a').map((node) => node.text ?? '').join(''));
    }
    if (typeof parsed?.title === 'string' && parsed.title !== '') lines.unshift(parsed.title);
    return lines.join('\n').trim();
  }
  if (type === 'interactive') {
    const out = [];
    collectCardText(parsed, out);
    return [...new Set(out.map((line) => line.trim()).filter((line) => line !== ''))].join('\n');
  }
  return MESSAGE_TYPE_LABEL[type] ?? (type === '' ? '' : `[${type}]`);
}
