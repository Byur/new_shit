/** 宿主会话事件：认领轮次、累加工具、追加正文、收尾卡片。 */

import { TURN_END_TITLES } from '../common/constants.js';
import { button } from '../core/cards.js';
import { textOfAssistantMessage } from '../core/text.js';
import { errorMessage } from './services.js';

/**
 * 建会话事件处理器。
 *
 * @param deps.turns 轮次注册表
 * @param deps.cards 回答卡句柄
 * @param deps.answerers 反问/审批应答句柄
 * @param deps.logger 日志
 * @param deps.onTurnFinished 轮次结束回调（记录跨路由历史用，可选）
 * @returns 处理函数 `(session, event) => void`
 */
export function createSessionEventHandler({ turns, cards, answerers, logger, onTurnFinished }) {
  return function onSessionEvent(session, event) {
    const sessionId = String(session?.id ?? session?.header?.id ?? '');
    const type = event?.type ?? '';
    const data = event?.data ?? {};
    try {
      if (type === 'user/message') {
        const rpcId = data?.source?.kind === 'user' ? String(data.source.rpcId ?? '') : '';
        if (rpcId === '') return;
        const claimed = turns.claim(rpcId, Number(data?.turn ?? 0));
        if (claimed === undefined) return;
        const record = turns.byFeishuMessage(claimed.feishuMessageId);
        if (record !== undefined) record.hostMessageId = String(data?.message?.id ?? '');
        cards.markRunning(claimed.feishuMessageId, Number(data?.turn ?? 0));
        return;
      }
      if (type === 'turn/start') {
        // user/message 事件不带 turn，轮次号靠 turn/start 补（两个事件先后不定）。
        const bound = turns.noteTurnStart(sessionId, Number(data?.turn ?? 0));
        if (bound !== undefined) cards.markRunning(bound.feishuMessageId, Number(data.turn));
        return;
      }
      if (type === 'tool/call') {
        // 宿主轮次的工具调用走会话事件；和 CLI 路径一样只累加计数，正文不刷日志。
        const turn = turns.turnOf(sessionId, Number(data?.turn ?? 0));
        if (turn === undefined) return;
        cards.noteTool(turn.feishuMessageId, String(data?.name ?? ''));
        return;
      }
      if (type === 'assistant/message') {
        const turn = turns.turnOf(sessionId, Number(data?.turn ?? 0));
        if (turn === undefined) return;
        const chunk = textOfAssistantMessage(data?.message);
        if (chunk !== '') {
          turn.assistantText = turn.assistantText ? `${turn.assistantText}\n\n${chunk}` : chunk;
        }
        cards.append(turn.feishuMessageId, chunk);
        return;
      }
      if (type === 'turn/end') {
        const turnNo = Number(data?.turn ?? 0);
        const turn = turns.turnOf(sessionId, turnNo);
        if (turn === undefined) return;
        const kind = String(data?.reason?.kind ?? 'completed');
        const baseTitle = TURN_END_TITLES[kind] ?? '已完成';
        const title = turn.routeLabel ? `${baseTitle} · ${turn.routeLabel}` : baseTitle;
        const color = kind === 'error' ? 'red' : kind === 'aborted' ? 'orange' : 'green';
        const reason = kind === 'error' ? `结束原因：${data?.reason?.message ?? data?.reason?.code ?? 'error'}` : '';
        // 降级/规则说明放在正文最前面（与 CLI 路径一致），空行分隔。
        const note = [turn.note ?? '', reason].filter((part) => part !== '').join('\n\n');
        const footerButtons = turn.canEscalate === true
          ? [
              button({
                name: 'route_escalate',
                text: `改用 ${turn.escalateLabel || '4.1 Flash'} 重答`,
                value: { tag: 'route', action: 'escalate', messageId: turn.feishuMessageId },
              }),
            ]
          : undefined;
        void cards.finish(turn.feishuMessageId, { title, color, note, footerButtons });
        answerers.question.settleTurn(turn);
        answerers.approval.settleTurn(turn);
        turns.finish(turn, kind);
        onTurnFinished?.({ turn, kind, text: turn.assistantText ?? '' });
      }
    } catch (error) {
      logger.warn(`处理会话事件 ${type} 失败：${errorMessage(error)}`);
    }
  };
}
