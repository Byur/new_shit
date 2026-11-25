/** 交互卡片发到哪：私聊发本 chat；群聊发给 owner 私聊，避免把授权/问题摊在群里。 */

/**
 * 算交互卡片的目标。
 *
 * @param turn 飞书轮次记录
 * @param ownerOpenId owner 的 open_id
 * @returns `{ chatId }` 或 `{ openId }`
 */
export function interactiveTargetOf(turn, ownerOpenId) {
  const chatId = String(turn?.chatId ?? '');
  if (turn?.chatType === 'group' && ownerOpenId !== '') return { openId: ownerOpenId };
  return { chatId };
}

/**
 * 把交互卡片发到上面算出来的目标。
 *
 * @param deps.outbound 出站句柄
 * @param deps.turn 飞书轮次记录
 * @param deps.ownerOpenId owner 的 open_id
 * @param deps.card 卡片对象
 * @returns 消息 ID；失败 undefined
 */
export async function sendInteractiveCard({ outbound, turn, ownerOpenId, card }) {
  const target = interactiveTargetOf(turn, ownerOpenId);
  return target.openId === undefined
    ? await outbound.sendCard({ chatId: target.chatId, card })
    : await outbound.sendCardToOpenId({ openId: target.openId, card });
}
