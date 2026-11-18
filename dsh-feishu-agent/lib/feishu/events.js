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
