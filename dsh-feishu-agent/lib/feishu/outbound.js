/** 出站：按凭据造飞书 REST 客户端，发消息 / 回复 / 整张换卡片，带重试与限频。 */

import { setTimeout as delay } from 'node:timers/promises';

import { SEND_MAX_ATTEMPTS, SEND_MIN_INTERVAL_MS, SEND_RETRY_BASE_MS } from '../common/constants.js';
import { loadSdk } from './connection.js';

/** 卡片消息类型。 */
const INTERACTIVE = 'interactive';

/**
 * 判断飞书返回体是否成功。
 *
 * @param response 返回体
 * @returns 成功时 true
 */
export function isFeishuOk(response) {
  if (response === null || response === undefined) return false;
  if (response.code === undefined) return response.data !== undefined;
  return response.code === 0;
}

/**
 * 建出站句柄。
 *
 * @param deps.logger 日志
 * @param deps.getCredentials 取凭据：`() => ({ appId, appSecret })`
 * @returns 出站句柄：`sendCard` / `replyCard` / `patchCard` / `sendText`
 */
export function createOutbound({ logger, getCredentials }) {
  let client = null;
  let clientKey = '';
  /** 每个 chat 上一次发送的时间，用来做粗粒度限频。 */
  const lastSendAt = new Map();
  /** 每个 chat 的发送闸门（见 `throttle`）。 */
  const sendGates = new Map();

  /**
   * 拿（或在凭据变化时重建）REST 客户端。
   *
   * @returns 客户端；凭据不全时 undefined
   */
  function rest() {
    const { appId, appSecret } = getCredentials();
    if (!appId || !appSecret) return undefined;
    const { Client, Domain } = loadSdk();
    const key = `${appId}:${appSecret}`;
    if (client !== null && clientKey === key) return client;
    client = new Client({ appId, appSecret, domain: Domain.Feishu });
    clientKey = key;
    return client;
  }

  /**
   * 限频：同一个 chat 两次发送之间至少隔 `SEND_MIN_INTERVAL_MS`。
   *
   * @param chatId 会话 ID
   */
  async function throttle(chatId) {
    // 串行排队，避免两条并发发送同时看到同一个「上一次时间」而互相超车。
    const previousGate = sendGates.get(chatId) ?? Promise.resolve();
    const gate = previousGate.catch(() => {}).then(async () => {
      const previous = lastSendAt.get(chatId) ?? 0;
      const wait = previous + SEND_MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await delay(wait);
      lastSendAt.set(chatId, Date.now());
    });
    sendGates.set(chatId, gate.catch(() => {}));
    await gate;
  }

  /**
   * 发一个请求：没客户端直接放弃；抛错按次数重试；业务失败不重试。
   *
   * @param request 真正要发的请求
   * @param describe 日志里的短句
   * @returns 成功时的返回体；失败 undefined
   */
  async function call(request, describe) {
    const live = rest();
    if (live === undefined) {
      logger.warn(`${describe}失败：飞书凭据未配置`);
      return undefined;
    }
    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await request(live);
        if (isFeishuOk(response)) return response;
        logger.warn(`${describe}被飞书拒绝：code=${response?.code} msg=${response?.msg}`);
        return undefined;
      } catch (error) {
        const status = error?.response?.status;
        if (attempt === SEND_MAX_ATTEMPTS) {
          logger.warn(`${describe}失败，已放弃（${attempt} 次）：${error?.message ?? error}`);
          return undefined;
        }
        logger.warn(`${describe}失败，准备第 ${attempt + 1} 次：${error?.message ?? error}${status ? `（HTTP ${status}）` : ''}`);
        await delay(SEND_RETRY_BASE_MS * attempt);
      }
    }
    return undefined;
  }

  /**
   * 主动发一张卡片到某个 chat。
   *
   * @param options.chatId 会话 ID
   * @param options.card 卡片对象
   * @param options.uuid 幂等键（1 小时内同 uuid 至多成功一条）
   * @returns 消息 ID；失败 undefined
   */
  async function sendCard({ chatId, card, uuid }) {
    await throttle(chatId);
    const response = await call(
      (live) => live.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, msg_type: INTERACTIVE, content: JSON.stringify(card), ...(uuid ? { uuid } : {}) },
      }),
      `向 ${chatId} 发卡片`,
    );
    return response?.data?.message_id;
  }

  /**
   * 回复某条消息（卡片）。
   *
   * @param options.chatId 会话 ID（只用于限频）
   * @param options.messageId 被回复的消息 ID
   * @param options.card 卡片对象
   * @param options.uuid 幂等键
   * @returns 消息 ID；失败 undefined
   */
  async function replyCard({ chatId, messageId, card, uuid }) {
    await throttle(chatId);
    const response = await call(
      (live) => live.im.message.reply({
        path: { message_id: messageId },
        data: { msg_type: INTERACTIVE, content: JSON.stringify(card), ...(uuid ? { uuid } : {}) },
      }),
      `回复 ${messageId} 的卡片`,
    );
    return response?.data?.message_id;
  }

  /**
   * 整张替换已发出的卡片。
   *
   * @param options.messageId 卡片所在消息 ID
   * @param options.card 新卡片
   * @returns 成功时 true
   */
  async function patchCard({ messageId, card }) {
    const response = await call(
      (live) => live.im.message.patch({ path: { message_id: messageId }, data: { content: JSON.stringify(card) } }),
      `更新卡片 ${messageId}`,
    );
    return response !== undefined;
  }

  /**
   * 发一条纯文本。
   *
   * @param options.chatId 会话 ID
   * @param options.text 文本
   * @param options.uuid 幂等键
   * @returns 消息 ID；失败 undefined
   */
  async function sendText({ chatId, text, uuid }) {
    await throttle(chatId);
    const response = await call(
      (live) => live.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text }), ...(uuid ? { uuid } : {}) },
      }),
      `向 ${chatId} 发文本`,
    );
    return response?.data?.message_id;
  }

  return { sendCard, replyCard, patchCard, sendText };
}
