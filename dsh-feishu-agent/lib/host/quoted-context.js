/** 引用回复：把被引用那条消息的正文补进这一轮的提示词。 */

import { summarizeMessage } from '../feishu/events.js';

/**
 * 建引用上下文解析器。
 *
 * @param deps.cards 回答卡句柄（本地记账比飞书 API 准）
 * @param deps.outbound 出站句柄（拉被引用消息）
 * @returns 解析函数 `(event) => 引用块`
 */
export function createQuotedContext({ cards, outbound }) {
  /**
   * 取「被引用那条消息」的摘要，补进这一轮的提示词里。
   *
   * 飞书只给 `parent_id`，正文要自己拉：读不到（比如缺 `im:message:readonly`）就当作没有引用，
   * 不影响正常问答。
   *
   * @param event 归一化后的消息事件
   * @returns 引用块；没有引用或读不到时为空串
   */
  return async function quotedContextOf(event) {
    if (typeof event.parentId !== 'string' || event.parentId === '') return '';
    // 引用的若是插件自己发的卡，本地记账比飞书 API 准（后者只回标题 + 降级占位）。
    const known = cards.recall(event.parentId);
    const summary = known !== undefined
      ? `${known.title}：${known.content}`
      : summarizeMessage(await outbound.getMessage({ messageId: event.parentId }) ?? {});
    const flat = summary.replace(/\s+/g, ' ').trim().slice(0, 500);
    return flat === '' ? '' : `[引用消息] ${flat}`;
  };
}
