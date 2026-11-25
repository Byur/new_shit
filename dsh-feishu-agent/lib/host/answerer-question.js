/** 反问应答：接管 `user-questions/request`，把「有选项」的题发到飞书，按选项交回答案。 */

import { buildCard, buttonRow, button, markdown, textCard, toastResponse } from '../core/cards.js';
import { interactiveTargetOf, sendInteractiveCard } from './interactive-target.js';

/** 反问 waterfall 的事件名。 */
export const USER_QUESTIONS_EVENT = 'user-questions/request';

/** 作废原因：这一轮被停掉。 */
const ABORTED = 'ASK_ABORTED';

/**
 * 这批题飞书能不能答：每道题都得有选项（自由文本让给桌面端）。
 *
 * @param questions 宿主给的题目
 * @returns 能答时 true
 */
/**
 * 这批题能不能用「下一条消息当答案」的方式问：只有一道、且没有选项。
 *
 * @param questions 宿主给的题目
 * @returns 能答时 true
 */
export function answerableByText(questions) {
  return Array.isArray(questions)
    && questions.length === 1
    && (!Array.isArray(questions[0]?.options) || questions[0].options.length === 0);
}

/**
 * 这批题飞书能不能答：每道题都得有选项（自由文本让给桌面端）。
 *
 * @param questions 宿主给的题目
 * @returns 能答时 true
 */
export function answerable(questions) {
  return Array.isArray(questions)
    && questions.length > 0
    && questions.every((item) => Array.isArray(item?.options) && item.options.length > 0);
}

/**
 * 造反问卡：每道题一行标题 + 一组选项按钮，底部一个「提交」。
 *
 * @param record 在册记录
 * @returns 卡片对象
 */
export function questionCardOf(record) {
  const elements = [];
  for (const item of record.questions) {
    const lines = [`**${item.header ?? '问题'}${item.multiSelect === true ? '（可多选）' : ''}**`, item.question];
    if (item.detail) lines.push('', item.detail);
    elements.push(markdown(lines.join('\n')));
    const buttons = (item.options ?? []).slice(0, 5).map((option, index) => button({
      name: `q_${item.id}_${index}`,
      text: String(option.label).slice(0, 40),
      value: {
        tag: 'question',
        action: item.multiSelect === true ? 'toggle' : 'pick',
        requestId: record.requestId,
        questionId: item.id,
        optionValue: option.label,
      },
    }));
    if (buttons.length > 0) elements.push(buttonRow(buttons));
  }
  elements.push(buttonRow([
    button({ name: 'submit', text: '提交', type: 'primary', value: { tag: 'question', action: 'submit', requestId: record.requestId } }),
  ]));
  return buildCard({ title: '需要你回答', color: 'blue', elements });
}

/**
 * 建反问应答句柄。
 *
 * @param deps.logger 日志
 * @param deps.outbound 出站句柄
 * @param deps.turns 轮次注册表
 * @param deps.pending 等待表（requestId → 记录）
 * @param deps.getOwner 取 owner 的 open_id（群聊里交互卡片发给它）
 * @returns 句柄：`onRequest` / `handleCard` / `takeTextAnswer`
 */
export function createQuestionAnswerer({ logger, outbound, turns, pending, getOwner = () => '' }) {
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
   * 用「文字卡 + 下一条消息」的方式问一道自由文本题。
   *
   * @param options.request 宿主请求
   * @param options.turn 飞书轮次
   * @param options.next 下一个回答者
   * @returns 答案 promise
   */
  async function askByText({ request, turn, next }) {
    const question = request.questions[0];
    const requestId = `qt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const target = interactiveTargetOf(turn, getOwner());
    const record = {
      kind: 'question',
      mode: 'text',
      requestId,
      sessionId: turn.sessionId,
      chatId: turn.chatId,
      targetChatId: target.openId ?? target.chatId,
      question,
      cardId: '',
      signal: request.signal,
    };
    const answer = new Promise((resolve, reject) => {
      record.resolve = resolve;
      record.reject = reject;
    });
    pending.set(requestId, record);

    const card = buildCard({
      title: '需要你回复',
      color: 'blue',
      elements: [
        markdown([`**${question.header ?? '问题'}**`, question.question, question.detail ?? ''].filter((line) => line !== '').join('\n')),
        markdown('直接回复这条消息：你的下一条消息就是答案。这一轮会一直等你；等待期间你在这个会话里发的下一条普通消息会被当作答案。'),
      ],
    });
    const cardId = await sendInteractiveCard({ outbound, turn, ownerOpenId: getOwner(), card });
    if (!cardId) {
      pending.delete(requestId);
      logger.warn('反问（文字）：卡片没发出去，让给桌面端');
      return next();
    }
    record.cardId = cardId;
    record.turn = turn.turn;
    logger.info(`文字反问卡片已发出（${requestId}，会话 ${turn.sessionId}，目标 ${record.targetChatId}）`);

    const abort = () => {
      if (!pending.delete(requestId)) return;
      logger.info(`反问 ${requestId} 随这一轮结束作废`);
      const error = new Error('这一轮被停掉了，提问作废');
      error.code = ABORTED;
      record.reject?.(error);
      void outbound.patchCard({ messageId: cardId, card: textCard({ title: '提问已作废', content: '这一轮已经结束。' }) });
    };
    if (request?.signal?.aborted === true) abort();
    else request?.signal?.addEventListener?.('abort', abort, { once: true });

    return answer;
  }

  /**
   * 把一条用户消息当成挂着的自由文本反问的答案。
   *
   * @param options.chatId 收到消息的会话
   * @param options.text 消息正文
   * @returns 是否吃掉了这条消息
   */
  function takeTextAnswer({ chatId, text }) {
    const value = typeof text === 'string' ? text.trim() : '';
    if (value === '') return false;
    for (const [requestId, record] of pending.entries()) {
      if (record.kind !== 'question' || record.mode !== 'text') continue;
      if (record.targetChatId !== chatId) continue;
      pending.delete(requestId);
      record.resolve?.({ answers: [{ id: record.question.id, selected: [], custom: value }] });
      void outbound.patchCard({
        messageId: record.cardId,
        card: textCard({ title: '已回答', content: `问题：${record.question.question}\n\n回答：${value}` }),
      });
      logger.info(`文字反问 ${requestId} 已收到回答`);
      return true;
    }
    return false;
  }

  /**
   * 处理一次反问请求；不接就让给桌面端。
   *
   * @param request 宿主请求 `{ agent, questions, signal }`
   * @param next 下一个回答者
   * @returns 答案
   */
  async function onRequest(request, next) {
    const turn = feishuTurnOf(request?.agent);
    if (turn === undefined) {
      logger.info('反问：这一轮不是飞书发起的，让给桌面端');
      return next();
    }
    if (!answerable(request?.questions)) {
      if (!answerableByText(request?.questions)) {
        logger.info('反问：这批题飞书答不了（多题且含自由文本），让给桌面端');
        return next();
      }
      return await askByText({ request, turn, next });
    }
    const requestId = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      kind: 'question',
      requestId,
      sessionId: turn.sessionId,
      chatId: turn.chatId,
      questions: request.questions,
      answers: new Map(),
      cardId: '',
      signal: request.signal,
    };
    const answer = new Promise((resolve, reject) => {
      record.resolve = resolve;
      record.reject = reject;
    });
    pending.set(requestId, record);

    const cardId = await sendInteractiveCard({ outbound, turn, ownerOpenId: getOwner(), card: questionCardOf(record) });
    if (!cardId) {
      pending.delete(requestId);
      logger.warn('反问：卡片没发出去，让给桌面端');
      return next();
    }
    record.cardId = cardId;
    record.turn = turn.turn;
    logger.info(`反问卡片已发出（${requestId}，${record.questions.length} 题，会话 ${turn.sessionId}）`);

    const abort = () => {
      if (!pending.delete(requestId)) return;
      logger.info(`反问 ${requestId} 随这一轮结束作废`);
      const error = new Error('这一轮被停掉了，提问作废');
      error.code = ABORTED;
      record.reject?.(error);
      void outbound.patchCard({ messageId: cardId, card: textCard({ title: '提问已作废', content: '这一轮已经结束。' }) });
    };
    if (request?.signal?.aborted === true) abort();
    else request?.signal?.addEventListener?.('abort', abort, { once: true });

    return answer;
  }

  /**
   * 卡片点击：选项 / 提交。
   *
   * @param action 卡片回传值
   * @returns 回调响应
   */
  async function handleCard(action) {
    const record = pending.get(String(action?.requestId ?? ''));
    if (record === undefined || record.kind !== 'question') {
      return toastResponse('这张卡片已经失效了', 'info');
    }
    if (action.action === 'pick' || action.action === 'toggle') {
      const value = String(action.optionValue);
      const current = record.answers.get(action.questionId) ?? [];
      if (action.action === 'pick') {
        record.answers.set(action.questionId, [value]);
      } else {
        record.answers.set(
          action.questionId,
          current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
        );
      }
      const chosen = record.answers.get(action.questionId) ?? [];
      return toastResponse(chosen.length > 0 ? `已选：${chosen.join('、')}` : '已取消选择', 'info');
    }
    if (action.action === 'submit') {
      pending.delete(record.requestId);
      const answers = record.questions.map((item) => ({ id: item.id, selected: record.answers.get(item.id) ?? [] }));
      record.resolve?.({ answers });
      const summary = record.questions
        .map((item) => {
          const chosen = record.answers.get(item.id) ?? [];
          return `- ${item.header ?? item.question}：${chosen.length > 0 ? chosen.join('、') : '已跳过'}`;
        })
        .join('\n');
      await outbound.patchCard({ messageId: record.cardId, card: textCard({ title: '已回答', content: summary }) });
      logger.info(`反问 ${record.requestId} 已交卷，等待会话继续`);
      return toastResponse('已提交', 'success');
    }
    return toastResponse('不认识的操作', 'warning');
  }

  /**
   * 一轮结束时，把这轮里还挂着的反问卡收回。
   *
   * @param turn 轮次记录
   */
  function settleTurn(turn) {
    for (const [requestId, record] of pending.entries()) {
      if (record.kind !== 'question' || record.sessionId !== turn.sessionId) continue;
      pending.delete(requestId);
      const error = new Error('这一轮结束了，提问作废');
      error.code = ABORTED;
      record.reject?.(error);
      if (record.cardId) void outbound.patchCard({ messageId: record.cardId, card: textCard({ title: '提问已作废', content: '这一轮已经结束。' }) });
    }
  }

  /**
   * 插件卸载时把还挂着的反问全部作废。
   */
  function dispose() {
    for (const [requestId, record] of pending.entries()) {
      if (record.kind !== 'question') continue;
      pending.delete(requestId);
      record.reject?.(new Error('插件正在卸载，提问作废'));
    }
  }

  return { onRequest, handleCard, takeTextAnswer, settleTurn, dispose };
}

