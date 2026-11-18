import { createRequire } from 'node:module';

/** 长连接：飞书 WSClient 的薄封装，带存活看门狗与状态回调。 */

import { SUBSCRIBED_EVENTS } from './events.js';

/**
 * 飞书 SDK 在第一次建连时才加载。
 *
 * 原因：SDK 用 CommonJS 打包，顶层加载会带来不必要的主线程开销，也会让测试替身的模块解析钩子
 * （只对 ESM 生效）失灵；放进函数里按需加载，测试可以直接注入替身。
 *
 * @returns SDK 模块
 */
export function loadSdk() {
  // 测试注入口：测试在 `apply()` 之前放一个替身到这里（见 test/fake-sdk.mjs）。
  const sdk = globalThis.__dshFeishuAgentSdk;
  if (sdk !== undefined) return sdk;
  return createRequire(import.meta.url)('@larksuiteoapi/node-sdk');
}

/** 发出去的 ping 等这么久（秒）还没有任何回帧，就当连接死了，拆掉重连。 */
export const PING_TIMEOUT_SEC = 15;

/** 握手最多等这么久（毫秒），防止 DNS/代理卡住时无限挂着。 */
export const HANDSHAKE_TIMEOUT_MS = 20_000;

/**
 * 建一条长连接。
 *
 * @param deps.logger 日志
 * @param deps.getCredentials 取凭据：`() => ({ appId, appSecret })`
 * @param deps.onEvent 收到事件：`(type, payload) => Promise<any> | any`
 * @param deps.onStatus 连接状态变化：`(status) => void`，`status` 形如 `{ connected, error }`
 * @returns 连接句柄：`start` / `stop` / `restart`
 */
export function createConnection({ logger, getCredentials, onEvent, onStatus }) {
  let client = null;
  let key = '';

  /**
   * 关掉当前连接。
   */
  function stop() {
    const previous = client;
    client = null;
    key = '';
    onStatus?.({ connected: false });
    if (previous === null) return;
    try {
      previous.close({ force: true });
    } catch (error) {
      logger.warn(`关闭飞书长连接失败：${error?.message ?? error}`);
    }
  }

  /**
   * 建连（凭据没变就不重建）。
   *
   * @returns 建连完成时 resolve
   */
  async function start() {
    const { appId, appSecret } = getCredentials();
    if (!appId || !appSecret) {
      onStatus?.({ connected: false, error: '飞书凭据未配置' });
      return;
    }
    const nextKey = `${appId}:${appSecret}`;
    if (client !== null && key === nextKey) return;
    stop();
    key = nextKey;

    const { Domain, EventDispatcher, LoggerLevel, WSClient } = loadSdk();
    const dispatcher = new EventDispatcher({});
    for (const type of SUBSCRIBED_EVENTS) {
      dispatcher.register({
        [type]: async (payload) => {
          try {
            return await onEvent(type, payload);
          } catch (error) {
            logger.error(`处理 ${type} 时出错：${error?.stack ?? error?.message ?? error}`);
            return undefined;
          }
        },
      });
    }

    const ws = new WSClient({
      appId,
      appSecret,
      domain: Domain.Feishu,
      loggerLevel: LoggerLevel.info,
      autoReconnect: true,
      handshakeTimeoutMs: HANDSHAKE_TIMEOUT_MS,
      wsConfig: { pingTimeout: PING_TIMEOUT_SEC },
      onReady: () => {
        logger.info('飞书长连接已建立');
        onStatus?.({ connected: true });
      },
      onReconnecting: () => {
        logger.warn('飞书长连接断开，开始重连');
        onStatus?.({ connected: false });
      },
      onReconnected: () => {
        logger.info('飞书长连接已重连');
        onStatus?.({ connected: true });
      },
      onError: (error) => {
        logger.error(`飞书长连接错误：${error?.message ?? error}`);
        onStatus?.({ connected: false, error: error?.message ?? String(error) });
      },
    });
    client = ws;
    try {
      await ws.start({ eventDispatcher: dispatcher });
    } catch (error) {
      logger.error(`建立飞书长连接失败：${error?.message ?? error}`);
      onStatus?.({ connected: false, error: error?.message ?? String(error) });
    }
  }

  return {
    start,
    stop,
    async restart() {
      stop();
      await start();
    },
  };
}
