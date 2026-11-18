/** 轮次注册表：记住「哪个会话的哪一轮是飞书发起的」，用来决定反问与审批弹在哪一端。 */

/**
 * 建轮次注册表。
 *
 * @param deps.persist 状态持久化回调（可选）
 * @param deps.initialEventIds 启动时把持久化过的 requestId 灌回来（重启后仍能认领）
 * @returns 注册表
 */
export function createTurnRegistry({ persist, initialEventIds = [] } = {}) {
  /** messageId（飞书）→ 轮次记录。 */
  const byMessage = new Map();
  /** requestId → messageId，用来认领这一轮的宿主消息。 */
  const byRequest = new Map(initialEventIds.map((id) => [id, '']));
  /** turn 号 → 轮次记录，用来把 session/event 对回到某条飞书消息。 */
  const byTurn = new Map();

  /**
   * 记一条已投喂但还没被取走的消息。
   *
   * @param messageId 飞书消息 ID
   * @param record `{ requestId, sessionId, chatId, bindingKey, text }`
   */
  function open(messageId, record) {
    const entry = { ...record, feishuMessageId: messageId, turn: 0, status: 'queued' };
    byMessage.set(messageId, entry);
    byRequest.set(record.requestId, messageId);
    persist?.();
    return entry;
  }

  /**
   * 认领一条宿主消息：按 requestId 找到飞书消息，记下 turn 号。
   *
   * @param requestId 请求身份
   * @param turn turn 号
   * @returns 轮次记录；不是飞书发起时 undefined
   */
  function claim(requestId, turn) {
    const messageId = byRequest.get(requestId);
    if (messageId === undefined) return undefined;
    const entry = byMessage.get(messageId);
    if (entry === undefined) return undefined;
    entry.turn = turn;
    entry.status = 'running';
    if (turn > 0) byTurn.set(`${entry.sessionId}:${turn}`, entry);
    persist?.();
    return entry;
  }

  /**
   * 按会话找当前正在跑的飞书轮次（反问/审批靠它判断「谁触发谁答」）。
   *
   * @param sessionId 会话 ID
   * @returns 轮次记录；没有时 undefined
   */
  function activeTurnOfSession(sessionId) {
    for (const entry of byTurn.values()) {
      if (entry.sessionId === sessionId && entry.status === 'running') return entry;
    }
    return undefined;
  }

  /**
   * 按「会话 + turn 号」取轮次。
   *
   * @param sessionId 会话 ID
   * @param turn turn 号
   * @returns 轮次记录
   */
  function turnOf(sessionId, turn) {
    return byTurn.get(`${sessionId}:${turn}`);
  }

  /**
   * 按飞书消息 ID 取轮次。
   *
   * @param messageId 飞书消息 ID
   * @returns 轮次记录
   */
  function byFeishuMessage(messageId) {
    return byMessage.get(messageId);
  }

  /**
   * 一轮结束：把记录标成终态并释放 turn 映射。
   *
   * @param record 轮次记录
   * @param status 终态
   */
  function finish(record, status) {
    if (record === undefined) return;
    record.status = status;
    if (record.turn > 0) byTurn.delete(`${record.sessionId}:${record.turn}`);
    persist?.();
  }

  /**
   * 插件卸载时清空。
   */
  function clear() {
    byMessage.clear();
    byTurn.clear();
    byRequest.clear();
  }

  return { open, claim, activeTurnOfSession, turnOf, byFeishuMessage, finish, clear };
}
