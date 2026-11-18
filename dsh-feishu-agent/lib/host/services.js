/** 宿主服务入口：把 Cordis 上下文里的服务收成一层薄封装，缺服务时给出明确错误。 */

/** 宿主服务缺席时抛的错误。 */
export class HostServiceMissingError extends Error {
  /**
   * @param service 服务名
   */
  constructor(service) {
    super(`宿主缺少服务 ${service}：这个部署没有挂载提供它的插件`);
    this.name = 'HostServiceMissingError';
    this.service = service;
  }
}

/**
 * 取一个服务；缺席时抛错。
 *
 * @param ctx Cordis 上下文
 * @param service 服务名
 * @returns 服务对象
 */
export function requireService(ctx, service) {
  const value = ctx.get(service);
  if (value === undefined || value === null) throw new HostServiceMissingError(service);
  return value;
}

/**
 * 把宿主抛出的错误压成一句人话。
 *
 * @param error 任意错误
 * @returns 描述
 */
export function errorMessage(error) {
  if (error === null || error === undefined) return '未知错误';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * 把会话相关错误翻译成用户能看懂的一句话。
 *
 * @param error 宿主错误
 * @returns 用户文案
 */
export function userFacingSessionError(error) {
  const message = errorMessage(error);
  if (/writer-held|AlreadyOwned|正在写/i.test(message)) return '这条会话正被另一端占用（可能是桌面端正在跑），稍后再试';
  if (/agent-preset\/conflict|preset/i.test(message)) return '会话的 agent preset 与配置不一致，换 `/new` 开一条新的';
  if (/not-found|不存在/i.test(message)) return '会话不存在或已被删除，用 `/new` 开一条新的';
  if (/agent-busy|busy/i.test(message)) return '会话正忙，消息已排队，请稍候';
  return `宿主报错：${message}`;
}
