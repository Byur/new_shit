/** 本地 Ollama 健康嗅探：TTL 结果缓存 + 连续失败熔断（半开恢复）。 */

/**
 * 默认健康策略：
 * - `ttlMs` 成功/失败结果的复用窗口；
 * - `cooldownMs` 熔断打开后的冷却时长；
 * - `failureThreshold` 连续失败多少次后打开熔断；
 * - `probeTimeoutMs` 单次健康探测超时。
 */
export const DEFAULT_HEALTH = Object.freeze({
  ttlMs: 30000,
  cooldownMs: 60000,
  failureThreshold: 2,
  probeTimeoutMs: 400,
});

/**
 * 取有限非负数，非法值回退默认。
 *
 * @param value 候选值
 * @param fallback 默认值
 * @returns 规范化数值
 */
function finiteOr(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

/**
 * 把任意错误/返回值收敛成非空字符串。
 *
 * @param error 错误或原因
 * @returns 文本原因
 */
function errorText(error) {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  const text = String(error ?? '').trim();
  return text === '' ? '健康探测失败' : text;
}

/**
 * 建健康监控器。
 *
 * 语义：
 * - 熔断打开且未到 `openUntil` → `check` 直接返回 `circuit-open`，不发起请求；
 * - 同一 `baseUrl` 在 TTL 内 → 复用上一次探测结果；
 * - 冷却结束后的下一次 `check` 会重新探测（半开），成功则关闭熔断并清零失败计数；
 * - 只有连接层面的探测失败计入失败次数，模型缺失视为配置问题，不打开熔断；
 * - 模型名按 tag 归一化匹配（`qwen3` 命中 `qwen3:8b`），`models` 为空同样视为缺失。
 *
 * @param options.ollama 已注入的 Ollama 客户端（需提供 `healthCheck()`）
 * @param options.now 可注入时钟（测试用）
 * @param options.ttlMs 结果缓存时长
 * @param options.cooldownMs 熔断冷却时长
 * @param options.failureThreshold 熔断失败阈值
 * @param options.probeTimeoutMs 探测超时
 * @returns `{ check, markSuccess, markFailure, snapshot }`
 */
export function createHealthMonitor({
  ollama,
  now = () => Date.now(),
  ttlMs,
  cooldownMs,
  failureThreshold,
  probeTimeoutMs,
} = {}) {
  if (ollama === null || typeof ollama !== 'object' || typeof ollama.healthCheck !== 'function') {
    throw new TypeError('createHealthMonitor 需要注入带 healthCheck() 的 ollama');
  }
  if (typeof now !== 'function') {
    throw new TypeError('createHealthMonitor 的 now 必须是函数');
  }

  const defaults = {
    ttlMs: finiteOr(ttlMs, DEFAULT_HEALTH.ttlMs),
    cooldownMs: finiteOr(cooldownMs, DEFAULT_HEALTH.cooldownMs),
    failureThreshold: Math.max(1, Math.floor(finiteOr(failureThreshold, DEFAULT_HEALTH.failureThreshold))),
    probeTimeoutMs: finiteOr(probeTimeoutMs, DEFAULT_HEALTH.probeTimeoutMs),
  };

  /** 当前生效策略：构造默认值起步，每次 `check({ policy })` 逐字段覆盖。 */
  let activePolicy = { ...defaults };

  /** 连续失败次数。 */
  let failures = 0;
  /** 熔断截止时刻；`0` 表示关闭。 */
  let openUntil = 0;
  /** 最近一次真实探测时刻；`0` 表示尚未探测。 */
  let lastProbeAt = 0;
  /** 最近一次失败原因。 */
  let lastError = null;
  /** 最近一次探测结果缓存：`{ baseUrl, at, result }`。 */
  let cache = null;

  /**
   * 熔断是否仍在打开期（严格小于截止时刻）。
   *
   * @param at 当前时刻
   * @returns 是否打开
   */
  function isOpen(at) {
    return openUntil > 0 && at < openUntil;
  }

  /**
   * 关闭熔断并清零失败计数（探测成功或显式 `markSuccess`）。
   */
  function closeCircuit() {
    failures = 0;
    openUntil = 0;
    lastError = null;
  }

  /**
   * 用一次 `check` 传入的策略覆盖当前生效策略；缺省字段沿用上一次生效值。
   *
   * @param policy 策略片段（可选）
   * @returns 归一化后的生效策略
   */
  function applyPolicy(policy) {
    if (policy === null || typeof policy !== 'object') return activePolicy;
    activePolicy = {
      ttlMs: finiteOr(policy.ttlMs, activePolicy.ttlMs),
      cooldownMs: finiteOr(policy.cooldownMs, activePolicy.cooldownMs),
      failureThreshold: Math.max(1, Math.floor(finiteOr(policy.failureThreshold, activePolicy.failureThreshold))),
      probeTimeoutMs: finiteOr(policy.probeTimeoutMs, activePolicy.probeTimeoutMs),
    };
    return activePolicy;
  }

  /**
   * 记一次连接失败：累加计数，达到阈值时打开熔断并作废缓存。
   *
   * @param error 失败原因
   */
  function recordFailure(error) {
    failures += 1;
    lastError = errorText(error);
    if (failures >= activePolicy.failureThreshold) {
      openUntil = now() + activePolicy.cooldownMs;
      cache = null;
    }
  }

  /**
   * 清掉失败结果缓存（成功缓存保留）。
   */
  function clearFailureCache() {
    if (cache !== null && cache.result.ok !== true) cache = null;
  }

  /**
   * 探测本地模型可用性。
   *
   * @param options.baseUrl Ollama 地址
   * @param options.model 期望存在的模型名
   * @param options.policy 本轮健康策略（可选，逐字段覆盖当前生效值）
   * @returns `{ ok, reason?, models?, cached }`
   */
  async function check({ baseUrl, model, policy } = {}) {
    applyPolicy(policy);
    const at = now();
    if (isOpen(at)) {
      return { ok: false, reason: 'circuit-open', cached: true };
    }

    const cacheFresh =
      cache !== null &&
      cache.baseUrl === baseUrl &&
      openUntil === 0 &&
      at >= cache.at &&
      at - cache.at < activePolicy.ttlMs;
    if (cacheFresh) {
      return { ...cache.result, cached: true };
    }

    let response;
    try {
      response = await ollama.healthCheck({ baseUrl, timeoutMs: activePolicy.probeTimeoutMs });
    } catch (error) {
      response = { ok: false, error };
    }

    const probedAt = now();
    lastProbeAt = probedAt;

    if (response === null || typeof response !== 'object' || response.ok !== true) {
      const reason = errorText(response?.error);
      recordFailure(reason);
      const result = { ok: false, reason, cached: false };
      if (!isOpen(now())) {
        cache = { baseUrl, at: probedAt, result };
      }
      return result;
    }

    const models = Array.isArray(response.models) ? response.models.map((name) => String(name)) : [];
    closeCircuit();

    // 模型名按 tag 归一化匹配：配置 `qwen3` 命中已装 `qwen3:8b`；
    // 同时 `models` 为空说明没有任何可用的分类模型，按缺失处理。
    const modelName = typeof model === 'string' ? model.trim() : '';
    const hasModel = models.some((name) => name === modelName || name.startsWith(`${modelName}:`));
    if (models.length === 0 || (modelName !== '' && !hasModel)) {
      const result = { ok: false, reason: 'model-missing', models, cached: false };
      cache = { baseUrl, at: probedAt, result };
      return result;
    }

    const result = { ok: true, models, cached: false };
    cache = { baseUrl, at: probedAt, result };
    return result;
  }

  /**
   * 显式标记一次成功：关闭熔断、清零失败并丢弃失败缓存。
   */
  function markSuccess() {
    closeCircuit();
    clearFailureCache();
  }

  /**
   * 显式标记一次失败（例如聊天调用失败）。
   *
   * @param error 失败原因
   */
  function markFailure(error) {
    recordFailure(error);
  }

  /**
   * 当前熔断快照。
   *
   * @returns `{ state, failures, openUntil, lastProbeAt, lastError, policy }`
   */
  function snapshot() {
    const at = now();
    return {
      state: isOpen(at) ? 'open' : 'closed',
      failures,
      openUntil,
      lastProbeAt,
      lastError,
      policy: { ...activePolicy },
    };
  }

  return { check, markSuccess, markFailure, snapshot };
}
