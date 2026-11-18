/**
 * 测试用的飞书替身。
 *
 * 每个用例调用 `installFakeSdk()` 得到一份独立替身：它自带发送记录与事件入口，
 * 插件通过 `globalThis.__dshFeishuAgentSdk` 拿到它（见 `lib/feishu/connection.js` 的 `loadSdk`）。
 */

export const Domain = { Feishu: 'https://open.feishu.cn', Lark: 'https://open.larksuite.com' };

export const LoggerLevel = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 };

/**
 * 造一份替身。
 *
 * @returns 替身句柄：`{ sdk, sent, patched, deliver, state }`
 */
export function createFakeFeishu() {
  const sent = [];
  const patched = [];
  const state = { startCalls: 0, stopCalls: 0, wsOptions: undefined, dispatcher: undefined };

  /** 事件分发器替身：只记下注册的处理函数。 */
  class EventDispatcher {
    constructor() {
      this.handlers = new Map();
    }

    register(handles) {
      for (const [key, handler] of Object.entries(handles)) this.handlers.set(key, handler);
      return this;
    }
  }

  /** 长连接替身：起连时立刻报「已连接」，并记下分发器。 */
  class WSClient {
    constructor(options) {
      this.options = options;
      state.wsOptions = options;
    }

    async start({ eventDispatcher }) {
      state.startCalls += 1;
      state.dispatcher = eventDispatcher;
      this.options.onReady?.();
    }

    close() {
      state.stopCalls += 1;
    }
  }

  /** REST 客户端替身：只实现插件用到的那几个 im.message 方法。 */
  class Client {
    constructor() {
      const record = (kind) => async (payload) => {
        const content = payload?.data?.content;
        const card = content === undefined ? undefined : JSON.parse(content);
        const id = `om_fake_${sent.length + patched.length + 1}`;
        if (kind === 'patch') {
          patched.push({ messageId: payload?.path?.message_id ?? null, card });
          return { code: 0, data: {} };
        }
        sent.push({
          kind,
          chatId: payload?.data?.receive_id ?? null,
          replyTo: payload?.path?.message_id ?? null,
          card,
          msgType: payload?.data?.msg_type,
          uuid: payload?.data?.uuid,
          id,
        });
        return { code: 0, data: { message_id: id } };
      };
      this.im = { message: { create: record('send'), reply: record('reply'), patch: record('patch') } };
    }
  }

  /**
   * 把一条飞书事件送进插件（等同长连接收到推送）。
   *
   * @param type 事件名
   * @param payload 飞书原始事件
   * @returns 插件返回值
   */
  async function deliver(type, payload) {
    if (state.dispatcher === undefined) throw new Error('插件还没有建立长连接');
    const handler = state.dispatcher.handlers.get(type);
    return handler === undefined ? undefined : await handler(payload);
  }

  return {
    sdk: { EventDispatcher, WSClient, Client, Domain, LoggerLevel },
    sent,
    patched,
    state,
    deliver,
  };
}

/**
 * 装一份新替身并返回它（每个用例开头调用）。
 *
 * @returns 替身句柄
 */
export function installFakeSdk() {
  const feishu = createFakeFeishu();
  globalThis.__dshFeishuAgentSdk = feishu.sdk;
  return feishu;
}

/** 保留导出，老调用点仍可编译（等价于换一份新替身）。 */
export function resetFakeSdk() {
  return installFakeSdk();
}

/** 最近一次装的替身（调试用）。 */
export function currentFakeSdk() {
  return globalThis.__dshFeishuAgentSdk;
}
