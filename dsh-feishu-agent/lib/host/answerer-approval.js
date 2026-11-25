/** 审批应答：接管 `approval/request`，把工具授权请求发到飞书，回写 none/allowed-once/rejected/cancelled。 */

import { buildCard, buttonRow, button, markdown, textCard, toastResponse } from '../core/cards.js';
import { sendInteractiveCard } from './interactive-target.js';

/** 审批 waterfall 的事件名。 */
export const APPROVAL_EVENT = 'approval/request';

/**
 * 建审批应答句柄。
 *
 * @param deps.logger 日志
 * @param deps.outbound 出站句柄
 * @param deps.turns 轮次注册表
 * @param deps.pending 等待表
 * @returns 句柄：`onRequest` / `handleCard` / `settleTurn` / `dispose`
 */
export function createApprovalAnswerer({ logger, outbound, turns, pending, getOwner = () => '' }) {
  /**
   * 发起这一轮的飞书轮次；不是飞书发起时 undefined。
   *
   * @param agent 宿主 agent
   * @returns 轮次记录
   */
  function feishuTurnOf(agent) {
    const sessionId = String(agent?.id ?? agent?.session?.header?.id ?? '');
    return sessionId === '' ? undefined : turns.activeTurnOfSession(sessionId);
  }

  /**
   * 处理一次审批请求；不接就让给桌面端。
   *
   * @param request 宿主请求 `{ agent, toolName, reason, signal }`
   * @param next 下一个回答者
   * @returns 审批结果
   */
  async function onRequest(request, next) {
    const turn = feishuTurnOf(request?.agent);
    if (turn === undefined) {
      logger.info('审批：这一轮不是飞书发起的，让给桌面端');
      return next();
    }
    const requestId = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      kind: 'approval',
      requestId,
      sessionId: turn.sessionId,
      chatId: turn.chatId,
      toolName: String(request?.toolName ?? '未知工具'),
      reason: typeof request?.reason === 'string' ? request.reason : '',
      cardId: '',
      signal: request?.signal,
    };
    const decision = new Promise((resolve) => {
      record.resolve = resolve;
    });
    pending.set(requestId, record);

    const card = buildCard({
      title: '需要授权',
      color: 'orange',
      elements: [
        markdown([`工具：\`${record.toolName}\``, record.reason ? `原因：${record.reason}` : '', '', '允许只对这一次调用生效。']
          .filter((line) => line !== '')
          .join('\n')),
        buttonRow([
          button({ name: 'allow', text: '允许一次', type: 'primary', value: { tag: 'approval', action: 'allow', requestId } }),
          button({ name: 'reject', text: '拒绝', type: 'danger', value: { tag: 'approval', action: 'reject', requestId } }),
        ]),
      ],
    });
    const cardId = await sendInteractiveCard({ outbound, turn, ownerOpenId: getOwner(), card });
    if (!cardId) {
      pending.delete(requestId);
      logger.warn('审批：卡片没发出去，让给桌面端');
      return next();
    }
    record.cardId = cardId;
    logger.info(`审批卡片已发出（${requestId}，工具 ${record.toolName}，会话 ${turn.sessionId}）`);

    const abort = () => {
      if (!pending.delete(requestId)) return;
      logger.info(`审批 ${requestId} 随这一轮结束作废`);
      record.resolve?.('cancelled');
      void outbound.patchCard({ messageId: cardId, card: textCard({ title: '审批已取消', content: '这一轮已经结束。' }) });
    };
    if (request?.signal?.aborted === true) abort();
    else request?.signal?.addEventListener?.('abort', abort, { once: true });

    return decision;
  }

  /**
   * 卡片点击：允许一次 / 拒绝。
   *
   * @param action 卡片回传值
   * @returns 回调响应
   */
  async function handleCard(action) {
    const record = pending.get(String(action?.requestId ?? ''));
    if (record === undefined || record.kind !== 'approval') {
      return toastResponse('这张卡片已经失效了', 'info');
    }
    if (action.action !== 'allow' && action.action !== 'reject') {
      return toastResponse('不认识的操作', 'warning');
    }
    pending.delete(record.requestId);
    const outcome = action.action === 'allow' ? 'allowed-once' : 'rejected';
    record.resolve?.(outcome);
    const title = outcome === 'allowed-once' ? '已允许一次' : '已拒绝';
    await outbound.patchCard({
      messageId: record.cardId,
      card: textCard({ title, content: `工具：\`${record.toolName}\``, color: outcome === 'allowed-once' ? 'green' : 'red' }),
    });
    logger.info(`审批 ${record.requestId} → ${outcome}`);
    return toastResponse(title, outcome === 'allowed-once' ? 'success' : 'warning');
  }

  /**
   * 一轮结束时收回这轮还挂着的审批卡。
   *
   * @param turn 轮次记录
   */
  function settleTurn(turn) {
    for (const [requestId, record] of pending.entries()) {
      if (record.kind !== 'approval' || record.sessionId !== turn.sessionId) continue;
      pending.delete(requestId);
      record.resolve?.('cancelled');
      if (record.cardId) void outbound.patchCard({ messageId: record.cardId, card: textCard({ title: '审批已取消', content: '这一轮已经结束。' }) });
    }
  }

  /**
   * 插件卸载时把还挂着的审批全部取消（失败关闭，交回 cancelled）。
   */
  function dispose() {
    for (const [requestId, record] of pending.entries()) {
      if (record.kind !== 'approval') continue;
      pending.delete(requestId);
      record.resolve?.('cancelled');
    }
  }

  return { onRequest, handleCard, settleTurn, dispose };
}
