/** 一轮由谁执行：宿主优先（auto）/ 只宿主 / 只 CLI。 */

/**
 * 一轮怎么跑：
 * - `auto`（默认）：Desktop 能接管就交给 Desktop（宿主），接不住再退回 CLI；
 * - `host`：只走宿主，接不住就报失败；
 * - `cli`：只走 CLI（旧行为，会话在桌面端打开时会撞写句柄）。
 *
 * @returns `auto` / `host` / `cli`
 */
export function turnMode() {
  const value = String(process.env.FEISHU_AGENT_TURN_MODE ?? 'auto').trim().toLowerCase();
  return value === 'host' || value === 'cli' ? value : 'auto';
}

/**
 * 等宿主认领这一轮的时长：认领 = 宿主真的开始跑了，而不是把消息排进队列。
 *
 * @returns 毫秒数
 */
export function hostTurnTimeoutMs() {
  const value = Number(process.env.FEISHU_AGENT_HOST_TURN_TIMEOUT_MS ?? '');
  return Number.isInteger(value) && value >= 100 ? value : 8000;
}
