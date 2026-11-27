/** 本地 Ollama 健康监控：TTL 缓存、模型缺失、熔断与半开恢复（全内存，不联网）。 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_HEALTH, createHealthMonitor } from '../lib/local/ollama-health.js';

const HEALTHY = { ok: true, models: ['qwen3:8b', 'llama3:8b'] };
const BASE_URL = 'http://127.0.0.1:11434';

/**
 * 建一个全内存测试环境：可变时钟 + 记录调用次数的假 ollama。
 *
 * @param options.respond 每次探测的响应工厂（可返回 Error 以模拟抛错）
 * @param options.* 其余参数透传给 createHealthMonitor
 * @returns `{ monitor, calls, advance, currentNow }`
 */
function createHarness({ respond = () => HEALTHY, ...options } = {}) {
  let now = 1000;
  const calls = [];
  const ollama = {
    async healthCheck(args) {
      calls.push(args);
      const reply = respond(args, calls.length);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  const monitor = createHealthMonitor({ ollama, now: () => now, ...options });
  return {
    monitor,
    calls,
    advance(ms) {
      now += ms;
    },
    currentNow() {
      return now;
    },
  };
}

test('DEFAULT_HEALTH 暴露约定的默认策略', () => {
  assert.deepEqual(DEFAULT_HEALTH, {
    ttlMs: 30000,
    cooldownMs: 60000,
    failureThreshold: 2,
    probeTimeoutMs: 400,
  });
});

test('首次 check 探测，TTL 内复用缓存不再调用 healthCheck', async () => {
  const harness = createHarness();
  const first = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(first.ok, true);
  assert.equal(first.cached, false);
  assert.deepEqual(first.models, HEALTHY.models);
  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.calls[0], { baseUrl: BASE_URL, timeoutMs: DEFAULT_HEALTH.probeTimeoutMs });

  harness.advance(DEFAULT_HEALTH.ttlMs - 1);
  const second = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(second.ok, true);
  assert.equal(second.cached, true);
  assert.deepEqual(second.models, HEALTHY.models);
  assert.equal(harness.calls.length, 1);
});

test('TTL 过期后重新探测并更新 lastProbeAt', async () => {
  const harness = createHarness();
  await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(harness.monitor.snapshot().lastProbeAt, 1000);

  harness.advance(DEFAULT_HEALTH.ttlMs);
  const second = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(second.cached, false);
  assert.equal(harness.calls.length, 2);
  assert.equal(harness.monitor.snapshot().lastProbeAt, 1000 + DEFAULT_HEALTH.ttlMs);
});

test('配置模型不在 models 列表时返回 model-missing，且结果可缓存', async () => {
  const harness = createHarness({ respond: () => ({ ok: true, models: ['llama3:8b'] }) });
  const first = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(first.ok, false);
  assert.equal(first.reason, 'model-missing');
  assert.deepEqual(first.models, ['llama3:8b']);
  assert.equal(first.cached, false);
  assert.equal(harness.calls.length, 1);

  const second = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'model-missing');
  assert.equal(second.cached, true);
  assert.equal(harness.calls.length, 1);
});

test('模型名按 tag 归一化：配置 qwen3 命中已装 qwen3:8b', async () => {
  const harness = createHarness({ respond: () => ({ ok: true, models: ['qwen3:8b', 'llama3:8b'] }) });
  const result = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3' });

  assert.equal(result.ok, true);
  assert.equal(result.reason, undefined);
  assert.deepEqual(result.models, ['qwen3:8b', 'llama3:8b']);
  assert.equal(harness.calls.length, 1);
});

test('模型名按 tag 归一化：配置 qwen3:8b 不命中 qwen3:1.7b', async () => {
  const harness = createHarness({ respond: () => ({ ok: true, models: ['qwen3:1.7b'] }) });
  const result = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'model-missing');
  assert.deepEqual(result.models, ['qwen3:1.7b']);
});

test('models 为空数组时视为没有可用分类模型，返回 model-missing 且可缓存', async () => {
  const harness = createHarness({ respond: () => ({ ok: true, models: [] }) });
  const first = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(first.ok, false);
  assert.equal(first.reason, 'model-missing');
  assert.deepEqual(first.models, []);
  assert.equal(first.cached, false);

  const second = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'model-missing');
  assert.equal(second.cached, true);
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.monitor.snapshot().state, 'closed', '模型缺失不打开熔断');
});

test('连续探测失败达到阈值后熔断打开', async () => {
  const harness = createHarness({ respond: () => ({ ok: false, error: '连接超时' }) });

  const first = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(first.ok, false);
  assert.equal(first.reason, '连接超时');
  assert.equal(first.cached, false);

  harness.advance(DEFAULT_HEALTH.ttlMs);
  const second = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(second.ok, false);
  assert.equal(second.reason, '连接超时');

  const snapshot = harness.monitor.snapshot();
  assert.equal(snapshot.state, 'open');
  assert.equal(snapshot.failures, DEFAULT_HEALTH.failureThreshold);
  assert.equal(snapshot.openUntil, harness.currentNow() + DEFAULT_HEALTH.cooldownMs);
  assert.equal(snapshot.lastError, '连接超时');
  assert.equal(harness.calls.length, 2);
});

test('熔断期内 check 不调用 healthCheck，直接返回 circuit-open', async () => {
  const harness = createHarness({ respond: () => ({ ok: false, error: 'ECONNREFUSED' }) });

  harness.monitor.markFailure('第一次');
  harness.monitor.markFailure('第二次');
  assert.equal(harness.monitor.snapshot().state, 'open');

  harness.advance(DEFAULT_HEALTH.cooldownMs - 1);
  const result = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.deepEqual(result, { ok: false, reason: 'circuit-open', cached: true });
  assert.equal(harness.calls.length, 0);
});

test('冷却期结束后重新探测，成功则恢复 closed 并清零 failures', async () => {
  let healthy = false;
  const harness = createHarness({
    respond: () => (healthy ? HEALTHY : { ok: false, error: '连接超时' }),
  });

  harness.monitor.markFailure('第一次');
  harness.monitor.markFailure('第二次');
  assert.equal(harness.monitor.snapshot().state, 'open');

  harness.advance(DEFAULT_HEALTH.cooldownMs);
  healthy = true;
  const recovered = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  assert.equal(recovered.ok, true);
  assert.equal(recovered.cached, false);
  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.monitor.snapshot(), {
    state: 'closed',
    failures: 0,
    openUntil: 0,
    lastProbeAt: harness.currentNow(),
    lastError: null,
    policy: { ...DEFAULT_HEALTH },
  });

  const cached = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(cached.cached, true);
  assert.equal(harness.calls.length, 1);
});

test('markSuccess 能提前关闭熔断', async () => {
  const harness = createHarness();

  harness.monitor.markFailure('第一次');
  harness.monitor.markFailure('第二次');
  assert.equal(harness.monitor.snapshot().state, 'open');

  harness.monitor.markSuccess();
  assert.deepEqual(harness.monitor.snapshot(), {
    state: 'closed',
    failures: 0,
    openUntil: 0,
    lastProbeAt: 0,
    lastError: null,
    policy: { ...DEFAULT_HEALTH },
  });

  const result = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  assert.equal(result.ok, true);
  assert.equal(harness.calls.length, 1);
});

test('healthCheck 抛错时 check 不抛异常，按失败返回', async () => {
  const harness = createHarness({ respond: () => new Error('boom') });

  await assert.doesNotReject(async () => {
    const result = await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'boom');
    assert.equal(result.cached, false);
  });

  assert.equal(harness.calls.length, 1);
  assert.equal(harness.monitor.snapshot().failures, 1);
  assert.equal(harness.monitor.snapshot().state, 'closed');
});

test('不同 baseUrl 不共享 TTL 缓存', async () => {
  const harness = createHarness();
  await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  const other = await harness.monitor.check({ baseUrl: 'http://127.0.0.1:11435', model: 'qwen3:8b' });

  assert.equal(other.cached, false);
  assert.equal(harness.calls.length, 2);
  assert.equal(harness.calls[1].baseUrl, 'http://127.0.0.1:11435');
});

test('model-missing 属于配置问题，连续出现也不打开熔断', async () => {
  const harness = createHarness({ respond: () => ({ ok: true, models: ['llama3:8b'] }) });

  await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });
  harness.advance(DEFAULT_HEALTH.ttlMs);
  await harness.monitor.check({ baseUrl: BASE_URL, model: 'qwen3:8b' });

  const snapshot = harness.monitor.snapshot();
  assert.equal(snapshot.state, 'closed');
  assert.equal(snapshot.failures, 0);
  assert.equal(harness.calls.length, 2);
});

test('自定义失败阈值与冷却时长生效', async () => {
  const harness = createHarness({ failureThreshold: 3, cooldownMs: 5000 });

  harness.monitor.markFailure('e1');
  harness.monitor.markFailure('e2');
  assert.equal(harness.monitor.snapshot().state, 'closed');

  harness.monitor.markFailure('e3');
  const snapshot = harness.monitor.snapshot();
  assert.equal(snapshot.state, 'open');
  assert.equal(snapshot.failures, 3);
  assert.equal(snapshot.openUntil, harness.currentNow() + 5000);
});

test('check 传入 policy 可覆盖构造时的 TTL 与探测超时', async () => {
  const harness = createHarness({ ttlMs: 30000, probeTimeoutMs: 400 });

  const first = await harness.monitor.check({
    baseUrl: BASE_URL,
    model: 'qwen3:8b',
    policy: { ttlMs: 1, probeTimeoutMs: 99 },
  });
  assert.equal(first.cached, false);
  assert.equal(harness.calls[0].timeoutMs, 99);

  harness.advance(2);
  const second = await harness.monitor.check({
    baseUrl: BASE_URL,
    model: 'qwen3:8b',
    policy: { ttlMs: 1, probeTimeoutMs: 99 },
  });
  assert.equal(second.cached, false, '策略 TTL 已过期，应重新探测');
  assert.equal(harness.calls.length, 2);
});

test('check 传入 policy.failureThreshold 后 markFailure 按该阈值熔断', async () => {
  const harness = createHarness({ failureThreshold: 2 });

  await harness.monitor.check({
    baseUrl: BASE_URL,
    model: 'qwen3:8b',
    policy: { failureThreshold: 5 },
  });

  for (let index = 0; index < 4; index += 1) {
    harness.monitor.markFailure(`e${index + 1}`);
  }
  assert.equal(harness.monitor.snapshot().state, 'closed', '未到 5 次不应熔断');

  harness.monitor.markFailure('e5');
  const snapshot = harness.monitor.snapshot();
  assert.equal(snapshot.state, 'open');
  assert.equal(snapshot.failures, 5);
});

test('snapshot().policy 反映最近一次生效策略，缺省字段沿用上一次', async () => {
  const harness = createHarness();

  await harness.monitor.check({
    baseUrl: BASE_URL,
    model: 'qwen3:8b',
    policy: { ttlMs: 5, cooldownMs: 7, failureThreshold: 3, probeTimeoutMs: 99 },
  });
  assert.deepEqual(harness.monitor.snapshot().policy, {
    ttlMs: 5,
    cooldownMs: 7,
    failureThreshold: 3,
    probeTimeoutMs: 99,
  });

  await harness.monitor.check({
    baseUrl: BASE_URL,
    model: 'qwen3:8b',
    policy: { failureThreshold: 4 },
  });
  assert.deepEqual(harness.monitor.snapshot().policy, {
    ttlMs: 5,
    cooldownMs: 7,
    failureThreshold: 4,
    probeTimeoutMs: 99,
  });
});
