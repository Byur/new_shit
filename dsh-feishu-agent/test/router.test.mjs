/** 离线用例：本地 Ollama 客户端、Obsidian 待整理写入与意图路由（无网络、无真实 Ollama）。 */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  DEFAULT_KEEP_ALIVE,
  DEFAULT_OLLAMA_BASE_URL,
  createOllamaClient,
  normalizeBaseUrl,
  parseJsonObject,
} from '../lib/local/ollama.js';
import {
  buildDailyHeader,
  createObsidianInbox,
  localDateStamp,
  sanitizeInboxItem,
} from '../lib/local/obsidian-inbox.js';
import {
  DEFAULT_ROUTER_CONFIG,
  ROUTER_SCHEMA,
  ROUTES,
  ROUTE_COMMANDS,
  createIntentRouter,
  createRouteHistory,
  fallbackObsidianItems,
  normalizeRouterConfig,
} from '../lib/core/router.js';
import { POLISH_SCHEMA } from '../lib/local/polish.js';

/**
 * 建一个记录调用的假 fetch。
 *
 * @param responder 根据调用返回 Response 形状（或抛错）
 * @returns `{ calls, fetchImpl }`
 */
function createFetchSpy(responder) {
  const calls = [];
  return {
    calls,
    async fetchImpl(url, init) {
      const call = { url, init, index: calls.length };
      calls.push(call);
      return responder(call);
    },
  };
}

/** 造一个成功返回 JSON 的 Response 形状。 */
function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

/** 造一个记录 chatJson 调用的假 Ollama 客户端。 */
function stubOllama(response) {
  const calls = [];
  return {
    calls,
    async chatJson(options) {
      calls.push(options);
      return typeof response === 'function' ? response(options) : response;
    },
  };
}

/** 用归一化配置造一个默认启用的路由配置（obsidian 默认带 inboxDir）。 */
function routerConfig(overrides = {}) {
  const { routes, ...rest } = overrides;
  return normalizeRouterConfig({}, {
    enabled: true,
    ...rest,
    routes: {
      obsidian: { inboxDir: '/tmp/dsh-test-inbox' },
      ...(routes ?? {}),
    },
  });
}

test('parseJsonObject 读取纯 JSON 对象与 fenced 代码块', () => {
  assert.deepEqual(parseJsonObject('{"route":"local","confidence":0.9}'), { route: 'local', confidence: 0.9 });
  assert.deepEqual(parseJsonObject('```json\n{"route":"obsidian","reason":"记下来"}\n```'), { route: 'obsidian', reason: '记下来' });
  assert.deepEqual(parseJsonObject('```\n{"a":1}\n```'), { a: 1 });
});

test('parseJsonObject 从夹带文字里抠出对象', () => {
  assert.deepEqual(parseJsonObject('好的，结果如下：{"route":"dsh"} 以上。'), { route: 'dsh' });
  assert.deepEqual(parseJsonObject('前言\n```json\n{"route":"local","reason":"闲聊"}\n```\n后记'), { route: 'local', reason: '闲聊' });
  assert.deepEqual(parseJsonObject('  {"nested":{"ok":true}}  '), { nested: { ok: true } });
});

test('parseJsonObject 对数组、非对象与坏 JSON 返回 undefined', () => {
  assert.equal(parseJsonObject('[1,2,3]'), undefined);
  assert.equal(parseJsonObject('[]'), undefined);
  assert.equal(parseJsonObject('"dsh"'), undefined);
  assert.equal(parseJsonObject('42'), undefined);
  assert.equal(parseJsonObject('null'), undefined);
  assert.equal(parseJsonObject('{"route":'), undefined);
  assert.equal(parseJsonObject('not json'), undefined);
  assert.equal(parseJsonObject(''), undefined);
  assert.equal(parseJsonObject(undefined), undefined);
});

test('normalizeBaseUrl 去尾部斜杠并回落到默认地址', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:11434///'), 'http://127.0.0.1:11434');
  assert.equal(normalizeBaseUrl('  http://host:1  '), 'http://host:1');
  assert.equal(normalizeBaseUrl(''), DEFAULT_OLLAMA_BASE_URL);
  assert.equal(normalizeBaseUrl(undefined), DEFAULT_OLLAMA_BASE_URL);
});

test('chatJson 发送流式关闭的分类请求并解析 JSON 输出', async () => {
  const schema = { type: 'object', properties: { route: { type: 'string' } } };
  const spy = createFetchSpy(() => jsonResponse({ message: { content: '{"route":"local","confidence":0.91}' } }));
  const client = createOllamaClient({ fetchImpl: spy.fetchImpl });
  const messages = [
    { role: 'system', content: '你是路由器' },
    { role: 'user', content: '你好' },
  ];

  const result = await client.chatJson({
    baseUrl: 'http://127.0.0.1:11434///',
    model: ' qwen3:8b ',
    messages,
    schema,
    keepAlive: '10m',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { route: 'local', confidence: 0.91 });
  assert.equal(result.raw, '{"route":"local","confidence":0.91}');
  assert.ok(result.durationMs >= 0);

  assert.equal(spy.calls.length, 1);
  const { url, init } = spy.calls[0];
  assert.equal(url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['content-type'], 'application/json');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'qwen3:8b');
  assert.equal(body.stream, false);
  assert.equal(body.think, false);
  assert.equal(body.keep_alive, '10m');
  assert.deepEqual(body.format, schema);
  assert.equal(body.options.temperature, 0);
  assert.deepEqual(body.messages, messages);
});

test('chatJson 未给 schema 时不带 format，keepAlive 用默认值', async () => {
  const spy = createFetchSpy(() => jsonResponse({ message: { content: '{"ok":true}' } }));
  const client = createOllamaClient({ fetchImpl: spy.fetchImpl });
  const result = await client.chatJson({ model: 'qwen3:8b', messages: [] });
  assert.equal(result.ok, true);
  const body = JSON.parse(spy.calls[0].init.body);
  assert.equal('format' in body, false);
  assert.equal(body.keep_alive, DEFAULT_KEEP_ALIVE);
  assert.equal(spy.calls[0].url, `${DEFAULT_OLLAMA_BASE_URL}/api/chat`);
});

test('chatJson 在 HTTP 500 时返回失败', async () => {
  const spy = createFetchSpy(() => ({ ok: false, status: 500 }));
  const client = createOllamaClient({ fetchImpl: spy.fetchImpl });
  const result = await client.chatJson({ model: 'qwen3:8b', messages: [] });
  assert.equal(result.ok, false);
  assert.match(result.error, /HTTP 500/);
});

test('chatJson 对非法 JSON 正文与非法模型输出都返回失败', async () => {
  const badContentSpy = createFetchSpy(() => jsonResponse({ message: { content: '我觉得应该走 local' } }));
  const badContent = await createOllamaClient({ fetchImpl: badContentSpy.fetchImpl })
    .chatJson({ model: 'qwen3:8b', messages: [] });
  assert.equal(badContent.ok, false);
  assert.equal(badContent.raw, '我觉得应该走 local');
  assert.match(badContent.error, /不是合法 JSON/);

  const badBodySpy = createFetchSpy(() => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  }));
  const badBody = await createOllamaClient({ fetchImpl: badBodySpy.fetchImpl })
    .chatJson({ model: 'qwen3:8b', messages: [] });
  assert.equal(badBody.ok, false);
  assert.match(badBody.error, /Unexpected token/);
});

test('chatJson 捕获 AbortError 并报告超时', async () => {
  const spy = createFetchSpy(() => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  });
  const client = createOllamaClient({ fetchImpl: spy.fetchImpl });
  const result = await client.chatJson({ model: 'qwen3:8b', messages: [], timeoutMs: 200 });
  assert.equal(result.ok, false);
  assert.match(result.error, /超时/);
  assert.match(result.error, /200ms/);
});

test('chatJson 缺少 fetch 或模型时直接失败，不发请求', async () => {
  const missingFetch = await createOllamaClient({ fetchImpl: null }).chatJson({ model: 'qwen3:8b', messages: [] });
  assert.equal(missingFetch.ok, false);
  assert.match(missingFetch.error, /fetch/);

  const spy = createFetchSpy(() => jsonResponse({ message: { content: '{"ok":true}' } }));
  const missingModel = await createOllamaClient({ fetchImpl: spy.fetchImpl }).chatJson({ model: '  ', messages: [] });
  assert.equal(missingModel.ok, false);
  assert.match(missingModel.error, /模型/);
  assert.equal(spy.calls.length, 0);
});

test('healthCheck 解析 /api/tags 的模型列表并过滤空名', async () => {
  const spy = createFetchSpy(() => jsonResponse({ models: [{ name: 'qwen3:8b' }, { name: 'llama3:8b' }, { name: '' }, {}] }));
  const client = createOllamaClient({ fetchImpl: spy.fetchImpl });
  const result = await client.healthCheck({ baseUrl: 'http://127.0.0.1:11434/' });
  assert.deepEqual(result, { ok: true, models: ['qwen3:8b', 'llama3:8b'] });
  assert.equal(spy.calls[0].url, 'http://127.0.0.1:11434/api/tags');
  assert.equal(spy.calls[0].init.method, 'GET');
});

test('healthCheck 网络失败与超时都干净地返回错误', async () => {
  const refused = createFetchSpy(() => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
  });
  const refusedResult = await createOllamaClient({ fetchImpl: refused.fetchImpl }).healthCheck();
  assert.equal(refusedResult.ok, false);
  assert.match(refusedResult.error, /ECONNREFUSED/);

  const aborted = createFetchSpy(() => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });
  const abortedResult = await createOllamaClient({ fetchImpl: aborted.fetchImpl }).healthCheck();
  assert.deepEqual(abortedResult, { ok: false, error: '连接超时' });

  const badStatus = createFetchSpy(() => ({ ok: false, status: 503 }));
  const badStatusResult = await createOllamaClient({ fetchImpl: badStatus.fetchImpl }).healthCheck();
  assert.deepEqual(badStatusResult, { ok: false, error: 'HTTP 503' });
});

test('sanitizeInboxItem 把排名写法转成 No. N，保留中文标签', () => {
  assert.equal(sanitizeInboxItem('#1 买牛奶'), 'No. 1 买牛奶');
  assert.equal(sanitizeInboxItem('排名 (#2) 的方案'), '排名 (No. 2) 的方案');
  assert.equal(sanitizeInboxItem('（#3）备选'), '（No. 3）备选');
  assert.equal(sanitizeInboxItem('#速记 今天想到 #1 个点子'), '#速记 今天想到 No. 1 个点子');
  assert.equal(sanitizeInboxItem(undefined), '');
});

test('sanitizeInboxItem 压平多行与多余空白', () => {
  assert.equal(sanitizeInboxItem('第一行\r\n第二行\n\n  第三行  '), '第一行 第二行 第三行');
  assert.equal(sanitizeInboxItem('  多   个\t空格  '), '多 个 空格');
});

test('appendItems 新建当天文件并写入 OTD 头与多条条目', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  try {
    const inbox = createObsidianInbox();
    const inboxDir = join(dir, '待整理', '飞书速记');
    const now = new Date(2026, 0, 5, 9, 7);
    const result = await inbox.appendItems({
      inboxDir,
      items: ['买牛奶', '(#2) 修灯'],
      messageId: 'om_abc_123',
      now,
    });

    assert.equal(result.ok, true);
    assert.equal(result.filePath, join(inboxDir, '2026-01-05.md'));
    assert.equal(result.fileName, '2026-01-05.md');
    assert.equal(result.date, '2026-01-05');
    assert.equal(result.count, 2);
    assert.deepEqual(result.writtenItems, ['买牛奶', '(No. 2) 修灯']);

    const content = await readFile(result.filePath, 'utf8');
    assert.ok(content.startsWith(buildDailyHeader('2026-01-05')));
    assert.ok(content.includes('---\ncreated: 2026-01-05\n'));
    assert.ok(content.includes('summary: 飞书随手记与待整理想法（2026-01-05）'));
    assert.ok(content.includes('type: quick-note'));
    assert.ok(content.includes('status: inbox'));
    assert.equal(/^agent:/m.test(content), false, 'OTD 头不该有 agent 字段');
    assert.ok(content.includes('# 2026-01-05 飞书速记'));
    assert.ok(content.includes('- 09:07 买牛奶 <!-- feishu:om_abc_123 -->'));
    assert.ok(content.includes('- 09:07 (No. 2) 修灯 <!-- feishu:om_abc_123 -->'));
    assert.equal(content.match(/^- 09:07 /gm).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendItems 在引用时追加缩进引用行并压平换行', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  try {
    const inbox = createObsidianInbox();
    const inboxDir = join(dir, 'inbox');
    const now = new Date(2026, 0, 5, 8, 30);
    const result = await inbox.appendItems({
      inboxDir,
      items: ['记下这个'],
      messageId: 'om_q1',
      quoted: '[引用消息] 原文第一行\n原文第二行',
      now,
    });

    assert.equal(result.ok, true);
    const content = await readFile(result.filePath, 'utf8');
    assert.ok(content.includes('- 08:30 记下这个 <!-- feishu:om_q1 -->\n  > 引用：原文第一行 原文第二行\n'));
    assert.equal(content.match(/引用：/g).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendItems 并发写同一天文件不会丢条目', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  try {
    const inbox = createObsidianInbox();
    const inboxDir = join(dir, 'inbox');
    const now = new Date(2026, 0, 6, 10, 0);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => inbox.appendItems({
        inboxDir,
        items: [`并发条目 ${index + 1}`],
        messageId: `om_c${index + 1}`,
        now,
      })),
    );

    assert.ok(results.every((item) => item.ok));
    const filePath = join(inboxDir, '2026-01-06.md');
    const content = await readFile(filePath, 'utf8');
    for (let index = 1; index <= 8; index += 1) {
      assert.ok(content.includes(`并发条目 ${index} <!-- feishu:om_c${index} -->`));
    }
    assert.equal(content.match(/^- 10:00 /gm).length, 8);
    assert.equal(content.match(/<!-- feishu:/g).length, 8);
    assert.deepEqual(await readdir(inboxDir), ['2026-01-06.md'], '原子写不该留下 tmp 文件');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('removeItems 只删目标消息的条目与引用行', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  try {
    const inbox = createObsidianInbox();
    const inboxDir = join(dir, 'inbox');
    const now = new Date(2026, 0, 7, 11, 0);
    await inbox.appendItems({ inboxDir, items: ['保留一'], messageId: 'om_keep_1', now });
    await inbox.appendItems({
      inboxDir,
      items: ['待删一', '待删二'],
      messageId: 'om_del',
      quoted: '引用内容',
      now,
    });
    await inbox.appendItems({ inboxDir, items: ['保留二'], messageId: 'om_keep_2', now });

    const filePath = join(inboxDir, `${localDateStamp(now)}.md`);
    const removed = await inbox.removeItems({ filePath, messageId: 'om_del' });
    assert.equal(removed.ok, true);
    assert.equal(removed.removedCount, 2);

    const content = await readFile(filePath, 'utf8');
    assert.ok(content.includes('保留一 <!-- feishu:om_keep_1 -->'));
    assert.ok(content.includes('保留二 <!-- feishu:om_keep_2 -->'));
    assert.equal(content.includes('待删一'), false);
    assert.equal(content.includes('待删二'), false);
    assert.equal(content.includes('om_del'), false);
    assert.equal(content.includes('引用：引用内容'), false);
    assert.ok(content.includes('# 2026-01-07 飞书速记'));
    assert.equal(content.match(/^- 11:00 /gm).length, 2, '其它消息的条目必须保留');

    const again = await inbox.removeItems({ filePath, messageId: 'om_del' });
    assert.deepEqual(again, { ok: true, removedCount: 0 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('removeItems 目标文件不存在时返回失败而不是抛错', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  try {
    const inbox = createObsidianInbox();
    const result = await inbox.removeItems({ filePath: join(dir, 'missing.md'), messageId: 'om_x' });
    assert.equal(result.ok, false);
    assert.equal(result.removedCount, 0);
    assert.match(result.error, /不存在/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('normalizeRouterConfig 无输入时给出完整默认值', () => {
  const config = normalizeRouterConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.groupEnabled, false);
  assert.equal(config.ollamaBaseUrl, DEFAULT_OLLAMA_BASE_URL);
  assert.equal(config.classifierModel, DEFAULT_ROUTER_CONFIG.classifierModel);
  assert.equal(config.timeoutMs, DEFAULT_ROUTER_CONFIG.timeoutMs);
  assert.equal(config.keepAlive, DEFAULT_KEEP_ALIVE);
  assert.equal(config.localConfidence, DEFAULT_ROUTER_CONFIG.localConfidence);
  assert.equal('obsidianConfidence' in config, false, '已下线的阈值不应出现在归一化结果里');
  assert.equal(config.contextWindowSec, 180);
  assert.deepEqual(config.polish, { enabled: true, timeoutMs: 6000, maxChars: 300, maxItems: 6 });
  assert.equal('distill' in config, false, '旧的 distill 段不应再出现');
  assert.deepEqual(config.health, {
    enabled: true,
    ttlMs: 30000,
    cooldownMs: 60000,
    failureThreshold: 2,
    probeTimeoutMs: 400,
  });
  assert.equal(config.routes.dsh.label, '4.1 Flash');
  assert.equal(config.routes.local.provider, 'ollama');
  assert.equal(config.routes.local.label, '本地 Qwen3');
  assert.equal(config.routes.obsidian.inboxDir, '');
});

test('normalizeRouterConfig 按默认值 → bundle → local 逐层覆盖', () => {
  const config = normalizeRouterConfig(
    {
      enabled: false,
      ollamaBaseUrl: 'http://bundle:1',
      classifierModel: 'bundle:model',
      timeoutMs: 1000,
      keepAlive: '1h',
      polish: { timeoutMs: 1000, maxChars: 900, maxItems: 3 },
      health: { ttlMs: 5000, failureThreshold: 3 },
      routes: {
        dsh: { label: 'bundle-dsh' },
        obsidian: { inboxDir: '/bundle/inbox' },
      },
    },
    {
      enabled: true,
      timeoutMs: 5000,
      polish: { maxChars: 100, maxItems: 9 },
      health: { cooldownMs: 7000 },
      routes: {
        dsh: { model: 'local-dsh-model' },
        local: { model: 'local-model' },
        obsidian: { inboxDir: '/local/inbox' },
      },
    },
    {},
  );

  assert.equal(config.enabled, true);
  assert.equal(config.ollamaBaseUrl, 'http://bundle:1');
  assert.equal(config.classifierModel, 'bundle:model');
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.keepAlive, '1h');
  assert.equal(config.routes.obsidian.inboxDir, '/local/inbox');
  assert.equal(config.routes.local.model, 'local-model');
  assert.equal(config.routes.local.provider, 'ollama');
  assert.equal(config.routes.dsh.label, 'bundle-dsh');
  assert.equal(config.routes.dsh.model, 'local-dsh-model');
  assert.equal(config.routes.dsh.permissionPreset, '', '未覆盖字段仍取默认值');
  assert.equal(config.polish.enabled, true);
  assert.equal(config.polish.timeoutMs, 1000, 'bundle 的 polish.timeoutMs 生效');
  assert.equal(config.polish.maxChars, 100, 'local 的 polish.maxChars 覆盖 bundle');
  assert.equal(config.polish.maxItems, 9, 'local 的 polish.maxItems 覆盖 bundle');
  assert.equal(config.health.enabled, true);
  assert.equal(config.health.ttlMs, 5000);
  assert.equal(config.health.cooldownMs, 7000);
  assert.equal(config.health.failureThreshold, 3);
  assert.equal(config.health.probeTimeoutMs, 400, '未覆盖字段仍取默认值');
});

test('normalizeRouterConfig 环境变量最后覆盖且空白值不算设置', () => {
  const config = normalizeRouterConfig(
    { enabled: false, ollamaBaseUrl: 'http://bundle:1', classifierModel: 'bundle:model' },
    {
      enabled: false,
      ollamaBaseUrl: 'http://local:1',
      classifierModel: 'local:model',
      routes: { obsidian: { inboxDir: '/local/inbox' } },
    },
    {
      FEISHU_AGENT_ROUTER_ENABLED: 'on',
      FEISHU_AGENT_OLLAMA_URL: ' http://env:9/ ',
      FEISHU_AGENT_ROUTER_MODEL: ' env:model ',
      FEISHU_AGENT_OBSIDIAN_INBOX_DIR: ' /env/inbox ',
    },
  );
  assert.equal(config.enabled, true);
  assert.equal(config.ollamaBaseUrl, 'http://env:9/');
  assert.equal(config.classifierModel, 'env:model');
  assert.equal(config.routes.obsidian.inboxDir, '/env/inbox');

  assert.equal(normalizeRouterConfig({ enabled: true }, {}, { FEISHU_AGENT_ROUTER_ENABLED: 'off' }).enabled, false);
  assert.equal(normalizeRouterConfig({}, { enabled: true }, { FEISHU_AGENT_ROUTER_ENABLED: '1' }).enabled, true);

  const blank = normalizeRouterConfig({}, { enabled: true, ollamaBaseUrl: 'http://local:1' }, {
    FEISHU_AGENT_ROUTER_ENABLED: '   ',
    FEISHU_AGENT_OLLAMA_URL: '   ',
    FEISHU_AGENT_ROUTER_MODEL: '',
    FEISHU_AGENT_OBSIDIAN_INBOX_DIR: '  ',
  });
  assert.equal(blank.enabled, true);
  assert.equal(blank.ollamaBaseUrl, 'http://local:1');
  assert.equal(blank.classifierModel, DEFAULT_ROUTER_CONFIG.classifierModel);

  const tuned = normalizeRouterConfig({}, {}, {
    FEISHU_AGENT_POLISH_ENABLED: 'off',
    FEISHU_AGENT_POLISH_TIMEOUT_MS: '100',
    FEISHU_AGENT_POLISH_MAX_CHARS: '99999',
    FEISHU_AGENT_POLISH_MAX_ITEMS: '99',
    FEISHU_AGENT_HEALTH_ENABLED: 'off',
    FEISHU_AGENT_HEALTH_TTL_MS: '1',
    FEISHU_AGENT_HEALTH_COOLDOWN_MS: '9999999',
  });
  assert.equal(tuned.polish.enabled, false);
  assert.equal(tuned.polish.timeoutMs, 300, '润色超时下限 300ms');
  assert.equal(tuned.polish.maxChars, 2000, '润色长度上限 2000');
  assert.equal(tuned.polish.maxItems, 20, '润色条目上限 20');
  assert.equal(tuned.health.enabled, false);
  assert.equal(tuned.health.ttlMs, 1000, 'TTL 下限 1000ms');
  assert.equal(tuned.health.cooldownMs, 600000, '冷却上限 600000ms');

  const envWins = normalizeRouterConfig(
    { polish: { enabled: true, timeoutMs: 6000 }, health: { enabled: true, ttlMs: 30000 } },
    { polish: { enabled: true }, health: { enabled: true } },
    { FEISHU_AGENT_POLISH_ENABLED: 'false', FEISHU_AGENT_HEALTH_ENABLED: 'no' },
  );
  assert.equal(envWins.polish.enabled, false, '环境变量最后覆盖 polish.enabled');
  assert.equal(envWins.health.enabled, false, '环境变量最后覆盖 health.enabled');
});

test('normalizeRouterConfig 兼容旧 distill 环境变量与配置段，但只输出 polish', () => {
  const fromOldEnv = normalizeRouterConfig({}, {}, {
    FEISHU_AGENT_DISTILL_ENABLED: 'off',
    FEISHU_AGENT_DISTILL_TIMEOUT_MS: '1200',
    FEISHU_AGENT_DISTILL_MAX_CHARS: '456',
  });
  assert.deepEqual(fromOldEnv.polish, {
    enabled: false,
    timeoutMs: 1200,
    maxChars: 456,
    maxItems: 6,
  });
  assert.equal('distill' in fromOldEnv, false, '旧环境变量只写进 polish，不产生 distill 段');

  const fromOldConfig = normalizeRouterConfig(
    { distill: { enabled: false, timeoutMs: 800, maxChars: 200 } },
    { distill: { maxItems: 4, maxChars: 250 } },
    {},
  );
  assert.deepEqual(fromOldConfig.polish, {
    enabled: false,
    timeoutMs: 800,
    maxChars: 250,
    maxItems: 4,
  });

  const polishWins = normalizeRouterConfig(
    { distill: { enabled: false, timeoutMs: 800 } },
    { polish: { enabled: true } },
    {
      FEISHU_AGENT_POLISH_TIMEOUT_MS: '1500',
      FEISHU_AGENT_POLISH_MAX_CHARS: '800',
      FEISHU_AGENT_DISTILL_MAX_CHARS: '999',
    },
  );
  assert.equal(polishWins.polish.enabled, true, '显式 polish 段压过 distill 配置段');
  assert.equal(polishWins.polish.timeoutMs, 1500, '新环境变量优先');
  assert.equal(polishWins.polish.maxChars, 800, '新旧环境变量同时存在时新键赢');

  const oldEnvFallback = normalizeRouterConfig(
    { polish: { maxChars: 300 } },
    {},
    { FEISHU_AGENT_DISTILL_MAX_CHARS: '999' },
  );
  assert.equal(oldEnvFallback.polish.maxChars, 999, '旧环境变量在新键缺省时仍作为回退');
});

test('normalizeRouterConfig 把越界数字夹到区间内，坏值回落默认', () => {
  const low = normalizeRouterConfig({ timeoutMs: 1, localConfidence: -3, contextWindowSec: -10 });
  assert.equal(low.timeoutMs, 300);
  assert.equal(low.localConfidence, 0);
  assert.equal(low.contextWindowSec, 0);

  const high = normalizeRouterConfig({}, {
    timeoutMs: 999999,
    localConfidence: 9,
    contextWindowSec: 99999,
  });
  assert.equal(high.timeoutMs, 30000);
  assert.equal(high.localConfidence, 1);
  assert.equal(high.contextWindowSec, 3600);

  const bad = normalizeRouterConfig({}, { timeoutMs: 'abc', localConfidence: Number.NaN, keepAlive: '  ' });
  assert.equal(bad.timeoutMs, DEFAULT_ROUTER_CONFIG.timeoutMs);
  assert.equal(bad.localConfidence, DEFAULT_ROUTER_CONFIG.localConfidence);
  assert.equal(bad.keepAlive, DEFAULT_KEEP_ALIVE);
});

test('normalizeRouterConfig 忽略未知字段（本机残留的 obsidianConfidence 不报错）', () => {
  const config = normalizeRouterConfig(
    { obsidianConfidence: 0.85, unknownField: true },
    { obsidianConfidence: 0.7, routes: { obsidian: { inboxDir: '/local/inbox' } } },
  );

  assert.equal('obsidianConfidence' in config, false, '归一化结果不应再包含已下线字段');
  assert.equal('unknownField' in config, false, '未知字段一律忽略');
  assert.equal(config.routes.obsidian.inboxDir, '/local/inbox', '已知字段照常合并');
});

test('fallbackObsidianItems 剥掉触发词', () => {
  assert.deepEqual(fallbackObsidianItems('帮我记一下：买牛奶'), ['买牛奶']);
  assert.deepEqual(fallbackObsidianItems('备忘: 交房租'), ['交房租']);
  assert.deepEqual(fallbackObsidianItems('请记录一下 明天带伞'), ['明天带伞']);
  assert.deepEqual(fallbackObsidianItems('想法：换个键盘'), ['换个键盘']);
  assert.deepEqual(fallbackObsidianItems('普通一句话'), ['普通一句话']);
});

test('fallbackObsidianItems 拆分多行并回退到引用原文', () => {
  assert.deepEqual(
    fallbackObsidianItems('1. 买牛奶\n2. 交房租\n- 修灯\n• 倒垃圾'),
    ['买牛奶', '交房租', '修灯', '倒垃圾'],
  );
  assert.deepEqual(fallbackObsidianItems('记一下：\n1、第一\n2) 第二'), ['第一', '第二']);
  assert.deepEqual(fallbackObsidianItems('帮我记一下：', '[引用消息] 被引用的原文'), ['被引用的原文']);
  assert.deepEqual(fallbackObsidianItems('备忘', '引用原文'), ['引用原文']);
  assert.deepEqual(fallbackObsidianItems('帮我记一下：', ''), []);
  assert.deepEqual(fallbackObsidianItems(undefined), []);
});

test('createRouteHistory 截断历史并提供 secondsAgo', () => {
  const history = createRouteHistory({ maxPerChat: 2 });
  const now = 1_000_000;
  history.record('c1', { route: 'local', user: 'u1', assistant: 'a1', at: now - 10_000 });
  history.record('c1', { route: 'dsh', user: 'u2', assistant: 'a2', at: now - 5_000 });
  history.record('c1', { route: 'obsidian', user: 'u3', assistant: '', at: now - 1_000 });

  const recent = history.recent('c1', { now });
  assert.equal(recent.length, 2);
  assert.deepEqual(recent.map((item) => item.user), ['u2', 'u3']);
  assert.deepEqual(recent.map((item) => item.secondsAgo), [5, 1]);
  assert.deepEqual(history.recent('c1', { limit: 1, now }).map((item) => item.user), ['u3']);
  assert.deepEqual(history.recent('missing', { now }), []);

  history.record('', { route: 'dsh', user: '空 chat 不记' });
  assert.deepEqual(history.recent('', { now }), []);
});

test('crossContextFor 只在不同路由且窗口内返回前情', () => {
  const history = createRouteHistory();
  const now = 2_000_000;
  history.record('c1', { route: 'local', user: '帮我翻译', assistant: '译文', at: now - 30_000 });

  const cross = history.crossContextFor('c1', 'dsh', { windowSec: 180, now });
  assert.ok(cross.includes('[跨会话前情（来自上一轮 local）]'));
  assert.ok(cross.includes('用户：帮我翻译'));
  assert.ok(cross.includes('助手：译文'));

  assert.equal(history.crossContextFor('c1', 'local', { windowSec: 180, now }), '', '同路由不补前情');
  assert.equal(history.crossContextFor('c1', 'dsh', { windowSec: 20, now }), '', '超出窗口不补前情');
  assert.equal(history.crossContextFor('c1', 'dsh', { windowSec: 0, now }), '');
  assert.equal(history.crossContextFor('missing', 'dsh', { windowSec: 180, now }), '');

  history.record('c2', { route: 'dsh', user: '查天气', at: now - 1_000 });
  const noAssistant = history.crossContextFor('c2', 'local', { windowSec: 180, now });
  assert.ok(noAssistant.includes('用户：查天气'));
  assert.equal(noAssistant.includes('助手：'), false);
});

test('decide：/note、/loc、/dsh 显式指令跳过分类器（即使未启用）', async () => {
  const entries = Object.entries(ROUTE_COMMANDS);
  assert.deepEqual(entries, [['dsh', 'dsh'], ['loc', 'local'], ['note', 'obsidian']]);

  for (const [command, route] of entries) {
    const ollama = stubOllama({ ok: false, error: '不该被调用' });
    const router = createIntentRouter({ ollama });
    const decision = await router.decide({
      chatId: 'c1',
      text: '帮我记一下：买菜',
      forcedRoute: route,
      config: routerConfig({ enabled: false, groupEnabled: false }),
    });

    assert.equal(decision.route, route, command);
    assert.equal(decision.source, 'command', command);
    assert.equal(decision.confidence, 1);
    assert.equal(decision.needsCrossContext, false);
    assert.equal(ollama.calls.length, 0, '显式指令不应调用分类器');
    assert.equal(router.stats[route], 1);
    if (route === ROUTES.OBSIDIAN) assert.deepEqual(decision.obsidianItems, ['买菜']);
    else assert.deepEqual(decision.obsidianItems, []);
  }
});

test('decide：未启用或群聊未开启时旁路到 dsh', async () => {
  const ollama = stubOllama({ ok: true, data: { route: 'local', confidence: 1 } });
  const router = createIntentRouter({ ollama });

  const disabled = await router.decide({
    chatId: 'c',
    text: '你好',
    config: routerConfig({ enabled: false }),
  });
  assert.equal(disabled.route, ROUTES.DSH);
  assert.equal(disabled.source, 'bypass');
  assert.equal(disabled.confidence, 1);
  assert.deepEqual(disabled.obsidianItems, []);
  assert.equal(ollama.calls.length, 0);

  const group = await router.decide({
    chatId: 'c',
    isGroup: true,
    text: '你好',
    config: routerConfig({ groupEnabled: false }),
  });
  assert.equal(group.route, ROUTES.DSH);
  assert.equal(group.source, 'bypass');
  assert.equal(ollama.calls.length, 0);

  const allowed = await router.decide({
    chatId: 'c',
    isGroup: true,
    text: '你好',
    config: routerConfig({ groupEnabled: true }),
  });
  assert.equal(allowed.route, ROUTES.LOCAL);
  assert.equal(allowed.source, 'classifier');
  assert.equal(ollama.calls.length, 1, '群聊开启后才进入分类器');
});

test('decide：local 置信度达标走本地，低于阈值降级 dsh', async () => {
  const hitOllama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.9, reason: '闲聊' }, durationMs: 12 });
  const hit = createIntentRouter({ ollama: hitOllama });
  const decision = await hit.decide({ chatId: 'c', text: '你好', config: routerConfig() });

  assert.equal(decision.route, ROUTES.LOCAL);
  assert.equal(decision.source, 'classifier');
  assert.equal(decision.confidence, 0.9);
  assert.equal(decision.reason, '闲聊');
  assert.equal(decision.durationMs, 12);
  assert.equal(hit.stats.local, 1);
  assert.equal(hitOllama.calls.length, 1);
  assert.equal(hitOllama.calls[0].baseUrl, DEFAULT_OLLAMA_BASE_URL);
  assert.equal(hitOllama.calls[0].model, 'qwen3:8b');
  assert.equal(hitOllama.calls[0].timeoutMs, DEFAULT_ROUTER_CONFIG.timeoutMs);
  assert.equal(hitOllama.calls[0].keepAlive, DEFAULT_KEEP_ALIVE);
  assert.equal(hitOllama.calls[0].schema, ROUTER_SCHEMA);

  const lowOllama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.5, reason: 'maybe' } });
  const low = createIntentRouter({ ollama: lowOllama });
  const fallback = await low.decide({ chatId: 'c', text: '你好', config: routerConfig() });
  assert.equal(fallback.route, ROUTES.DSH);
  assert.equal(fallback.source, 'fallback');
  assert.equal(fallback.fallbackReason, 'low-confidence');
  assert.match(fallback.reason, /低于阈值/);
  assert.equal(low.stats.fallback, 1);
  assert.equal(low.stats.dsh, 1);
});

test('decide：记事规则命中 append 直接写入，不调用分类器', async () => {
  const ollama = stubOllama({ ok: false, error: '不该被调用' });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text: '记一下：周五前给 Ollama 配开机自启',
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.OBSIDIAN);
  assert.equal(decision.source, 'rule');
  assert.equal(decision.confidence, 1);
  assert.equal(decision.reason, '触发词命中');
  assert.equal(decision.noteAction, 'append');
  assert.deepEqual(decision.obsidianItems, ['周五前给 Ollama 配开机自启']);
  assert.equal(ollama.calls.length, 0, '记事规则不应调用分类器');
  assert.equal(router.stats.obsidian, 1);
  assert.equal(router.stats.note, 1);
  assert.equal(router.stats.dsh, 0);
});

test('decide：读取笔记走规则查询，不调用分类器且零耗时', async () => {
  const ollama = stubOllama({ ok: false, error: '不该被调用' });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text: '我待整理里昨天记了什么，帮我列一下',
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'rule');
  assert.equal(decision.noteAction, 'query');
  assert.equal(decision.durationMs, 0);
  assert.deepEqual(decision.obsidianItems, []);
  assert.equal(ollama.calls.length, 0, '查询规则不应调用分类器');
  assert.equal(router.stats.dsh, 1);
  assert.equal(router.stats.note, 1);
});

test('decide：记事后带执行尾巴时不进规则，交给分类器', async () => {
  const ollama = stubOllama({ ok: true, data: { route: 'dsh', confidence: 0.85, reason: '要联网' } });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text: '记一下这个点子：给机器人加每日摘要，顺便帮我上网搜下现成方案',
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'classifier');
  assert.equal(ollama.calls.length, 1, '带执行尾巴应交给分类器');
  assert.equal(router.stats.note, 0);
});

test('decide：缺 inboxDir 时记事规则降级 dsh（inbox-missing）', async () => {
  const ollama = stubOllama({ ok: false, error: '不该被调用' });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text: '记一下：买牛奶',
    config: routerConfig({ routes: { obsidian: { inboxDir: '' } } }),
  });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'fallback');
  assert.equal(decision.fallbackReason, 'inbox-missing');
  assert.equal(ollama.calls.length, 0);
  assert.equal(router.stats.dsh, 1);
  assert.equal(router.stats.fallback, 1);
});

test('decide：分类器返回已下线的 obsidian 时按 dsh 处理并标注', async () => {
  const ollama = stubOllama({
    ok: true,
    data: { route: 'obsidian', confidence: 0.9, reason: '旧模型', obsidianItems: ['x'] },
  });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({ chatId: 'c', text: '帮我看看这个想法', config: routerConfig() });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'classifier');
  assert.equal(decision.reason, 'classifier-returned-obsidian');
  assert.deepEqual(decision.obsidianItems, []);
  assert.equal(router.stats.dsh, 1);
});

test('decide：健康嗅探失败直接降级，不调用分类器', async () => {
  let checks = 0;
  const health = {
    async check({ baseUrl, model }) {
      checks += 1;
      assert.equal(baseUrl, DEFAULT_OLLAMA_BASE_URL);
      assert.equal(model, 'qwen3:8b');
      return { ok: false, reason: 'model-missing' };
    },
    markSuccess() {},
    markFailure() {},
  };
  const ollama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.9 } });
  const router = createIntentRouter({ ollama, health });
  const decision = await router.decide({ chatId: 'c', text: '你好', config: routerConfig() });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'fallback');
  assert.equal(decision.confidence, 0);
  assert.equal(decision.reason, '本地分类器不可用');
  assert.equal(decision.fallbackReason, 'model-missing');
  assert.equal(decision.durationMs, 0);
  assert.equal(ollama.calls.length, 0, '健康检查失败不应调用分类器');
  assert.equal(checks, 1);
  assert.equal(router.stats.dsh, 1);
  assert.equal(router.stats.fallback, 1);
});

test('decide：健康嗅探成功后调用分类器并标记成功', async () => {
  let successes = 0;
  const health = {
    async check() {
      return { ok: true, models: ['qwen3:8b'] };
    },
    markSuccess() {
      successes += 1;
    },
    markFailure() {},
  };
  const ollama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.9, reason: '闲聊' } });
  const router = createIntentRouter({ ollama, health });
  const decision = await router.decide({ chatId: 'c', text: '你好', config: routerConfig() });

  assert.equal(decision.route, ROUTES.LOCAL);
  assert.equal(decision.source, 'classifier');
  assert.equal(ollama.calls.length, 1);
  assert.equal(successes, 1, '分类成功应标记 markSuccess');
  assert.equal(router.stats.local, 1);
});

test('decide：分类器失败时标记 markFailure 并降级 dsh', async () => {
  const failures = [];
  const health = {
    async check() {
      return { ok: true, models: ['qwen3:8b'] };
    },
    markSuccess() {},
    markFailure(error) {
      failures.push(error);
    },
  };
  const ollama = stubOllama({ ok: false, error: 'Ollama 分类超时（3000ms）' });
  const router = createIntentRouter({ ollama, health });
  const decision = await router.decide({ chatId: 'c', text: '你好', config: routerConfig() });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'fallback');
  assert.equal(decision.fallbackReason, 'Ollama 分类超时（3000ms）');
  assert.deepEqual(failures, ['Ollama 分类超时（3000ms）']);
  assert.equal(router.stats.fallback, 1);
  assert.equal(router.stats.dsh, 1);
});

test('decide：polish.enabled 控制速记是否做清噪断句（只在噪声时）', async () => {
  const text = '记一下：\n- 呃那个周五前给 Ollama 配开机自启\n- 然后周末给飞书机器人补日志';
  const items = ['呃那个周五前给 Ollama 配开机自启', '然后周末给飞书机器人补日志'];
  const polishedItems = ['周五前给 Ollama 配开机自启。', '然后周末给飞书机器人补日志。'];

  const enabledOllama = stubOllama({ ok: true, data: { items: polishedItems } });
  const enabled = createIntentRouter({ ollama: enabledOllama });
  const enabledDecision = await enabled.decide({ chatId: 'c', text, config: routerConfig() });
  assert.equal(enabledDecision.route, ROUTES.OBSIDIAN);
  assert.equal(enabledDecision.source, 'rule');
  assert.deepEqual(enabledDecision.obsidianItems, polishedItems);
  assert.equal(enabledOllama.calls.length, 1, '噪声条目开启清噪断句时只调用一次本地模型');
  assert.deepEqual(enabledOllama.calls[0].schema, POLISH_SCHEMA, '断句调用应带 POLISH_SCHEMA');
  assert.equal(enabledOllama.calls[0].model, DEFAULT_ROUTER_CONFIG.classifierModel);
  assert.deepEqual(Object.keys(enabledDecision).sort(), [
    'confidence', 'durationMs', 'needsCrossContext', 'noteAction',
    'obsidianItems', 'reason', 'route', 'source',
  ]);
  assert.ok(enabledDecision.durationMs >= 0);

  const cleanText = '记一下：\n- 周五前给 Ollama 配开机自启\n- 周末整理飞书机器人日志';
  const cleanOllama = stubOllama({ ok: true, data: { items } });
  const clean = createIntentRouter({ ollama: cleanOllama });
  const cleanDecision = await clean.decide({ chatId: 'c', text: cleanText, config: routerConfig() });
  assert.deepEqual(cleanDecision.obsidianItems, ['周五前给 Ollama 配开机自启', '周末整理飞书机器人日志']);
  assert.equal(cleanOllama.calls.length, 0, '干净笔记不该调用本地模型');

  const disabledOllama = stubOllama({ ok: true, data: { items } });
  const disabled = createIntentRouter({ ollama: disabledOllama });
  const disabledDecision = await disabled.decide({
    chatId: 'c',
    text,
    config: routerConfig({ polish: { enabled: false } }),
  });
  assert.equal(disabledDecision.route, ROUTES.OBSIDIAN);
  assert.deepEqual(disabledDecision.obsidianItems, items, '关闭润色时用规则拆分结果');
  assert.equal(disabledOllama.calls.length, 0, '关闭润色时不应调用本地模型');
  assert.equal(disabledDecision.durationMs, 0);
});

test('decide：断句结果不忠实时仍写入，但条目退回去噪结果而不是原文', async () => {
  const text = '记一下：\n- 呃周五前给 Ollama 配开机自启\n- 然后周末给飞书机器人补日志';
  const ollama = stubOllama({ ok: true, data: { items: ['完全不存在的新内容'] } });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({ chatId: 'c', text, config: routerConfig() });

  assert.equal(decision.route, ROUTES.OBSIDIAN);
  assert.equal(decision.source, 'rule');
  assert.equal(ollama.calls.length, 1);
  assert.deepEqual(decision.obsidianItems, ['周五前给 Ollama 配开机自启', '然后周末给飞书机器人补日志']);
});

test('decide：/note 命令路径同样走清噪断句', async () => {
  const text = '呃那个明天要去银行然后顺便把水费交了我我怕忘了';
  const ollama = stubOllama({
    ok: true,
    data: { items: ['明天要去银行，然后顺便把水费交了。我怕忘了。'] },
  });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text,
    forcedRoute: ROUTES.OBSIDIAN,
    config: routerConfig({ enabled: false }),
  });

  assert.equal(decision.route, ROUTES.OBSIDIAN);
  assert.equal(decision.source, 'command');
  assert.equal(ollama.calls.length, 1, '/note 命中噪声时也应调用断句');
  assert.deepEqual(ollama.calls[0].schema, POLISH_SCHEMA);
  assert.deepEqual(decision.obsidianItems, ['明天要去银行，然后顺便把水费交了。我怕忘了。']);
  assert.deepEqual(Object.keys(decision).sort(), [
    'confidence', 'durationMs', 'needsCrossContext', 'noteAction',
    'obsidianItems', 'reason', 'route', 'source',
  ]);
});


test('decide：Ollama 报错或超时降级 dsh 并累计 fallback', async () => {
  const warnings = [];
  const logger = { warn: (line) => warnings.push(line) };
  const failing = createIntentRouter({
    ollama: stubOllama({ ok: false, error: 'Ollama HTTP 500' }),
    logger,
  });
  const decision = await failing.decide({ chatId: 'c', text: '你好', config: routerConfig() });
  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'fallback');
  assert.equal(decision.confidence, 0);
  assert.equal(decision.fallbackReason, 'Ollama HTTP 500');
  assert.equal(failing.stats.fallback, 1);
  assert.equal(failing.stats.dsh, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /降级走 DSH/);

  const timingOut = createIntentRouter({
    ollama: stubOllama({ ok: false, error: 'Ollama 分类超时（3000ms）' }),
  });
  const timedOut = await timingOut.decide({ chatId: 'c', text: '你好', config: routerConfig() });
  assert.equal(timedOut.route, ROUTES.DSH);
  assert.equal(timedOut.source, 'fallback');
  assert.match(timedOut.fallbackReason, /超时/);
  assert.equal(timingOut.stats.fallback, 1);
});

test('decide：模型选 dsh 时透传，recordOverride 只累计纠错且 stats 是快照', async () => {
  const ollama = stubOllama({
    ok: true,
    data: { route: 'dsh', confidence: 0.8, reason: '要联网', needsCrossContext: true },
  });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({ chatId: 'c', text: '查一下明天的天气', config: routerConfig() });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'classifier');
  assert.equal(decision.needsCrossContext, true);
  assert.equal(router.stats.dsh, 1);
  assert.equal(router.stats.fallback, 0);

  const snapshot = router.stats;
  router.recordOverride();
  router.recordOverride();
  assert.equal(router.stats.override, 2);
  assert.equal(snapshot.override, 0, 'stats 返回的是快照，不被后续修改影响');
});

test('decide：把 config.health 原样作为 policy 传给 health.check', async () => {
  const seen = [];
  const health = {
    async check(args) {
      seen.push(args);
      return { ok: true, models: ['qwen3:8b'] };
    },
    markSuccess() {},
    markFailure() {},
  };
  const ollama = stubOllama({ ok: true, data: { route: 'dsh', confidence: 0.9, reason: '要联网' } });
  const config = routerConfig({
    health: { ttlMs: 1234, cooldownMs: 2345, failureThreshold: 4, probeTimeoutMs: 321 },
  });
  const router = createIntentRouter({ ollama, health });

  await router.decide({ chatId: 'c', text: '你好', config });

  assert.equal(seen.length, 1);
  assert.equal(seen[0].baseUrl, config.ollamaBaseUrl);
  assert.equal(seen[0].model, config.classifierModel);
  assert.equal(seen[0].policy, config.health, '应把本轮 config.health 原样交给健康检查');
});

test('decide：所有降级分支都带中文 reasonText，且不暴露英文机读码', async () => {
  const decisions = [];

  decisions.push(await createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) }).decide({
    chatId: 'c',
    text: '记一下：买牛奶',
    config: routerConfig({ routes: { obsidian: { inboxDir: '' } } }),
  }));
  decisions.push(await createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) }).decide({
    chatId: 'c',
    text: '帮我记一下：',
    config: routerConfig(),
  }));

  for (const reason of ['circuit-open', 'model-missing', 'ECONNREFUSED']) {
    const health = {
      async check() {
        return { ok: false, reason };
      },
      markSuccess() {},
      markFailure() {},
    };
    decisions.push(await createIntentRouter({
      ollama: stubOllama({ ok: true, data: { route: 'local', confidence: 0.9 } }),
      health,
    }).decide({ chatId: 'c', text: '你好', config: routerConfig() }));
  }

  decisions.push(await createIntentRouter({ ollama: stubOllama({ ok: false, error: 'Ollama HTTP 500' }) }).decide({
    chatId: 'c',
    text: '你好',
    config: routerConfig(),
  }));
  decisions.push(await createIntentRouter({
    ollama: stubOllama({ ok: true, data: { route: 'local', confidence: 0.1 } }),
  }).decide({ chatId: 'c', text: '你好', config: routerConfig() }));

  assert.equal(decisions.length, 7);
  for (const decision of decisions) {
    assert.equal(decision.source, 'fallback');
    assert.equal(typeof decision.reasonText, 'string');
    assert.notEqual(decision.reasonText.trim(), '');
    assert.equal(/^[a-z-]+$/.test(decision.reasonText), false, `reasonText 不应是机读码：${decision.reasonText}`);
  }
});

test('decide：local 置信度不足时 reasonText 说明把握不足', async () => {
  const ollama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.3, reason: 'maybe' } });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({ chatId: 'c', text: '你好', config: routerConfig() });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'fallback');
  assert.equal(decision.fallbackReason, 'low-confidence');
  assert.match(decision.reasonText, /本地判断把握不足/);
});

test('decide：速记模式下无触发词的普通消息也直接记事，且不调分类器', async () => {
  const ollama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.99 } });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text: '我开了那个暖气，我觉得好干。',
    noteMode: true,
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.OBSIDIAN);
  assert.equal(decision.source, 'note-mode');
  assert.equal(decision.reason, '速记模式');
  assert.equal(decision.noteAction, 'append');
  assert.deepEqual(decision.obsidianItems, ['我开了那个暖气，我觉得好干。']);
  assert.equal(ollama.calls.length, 0, '速记模式不应调用分类器');
  assert.equal(router.stats.obsidian, 1);
  assert.equal(router.stats.note, 1);
  assert.equal(router.stats.local, 0);
});

test('decide：速记模式下仍然清噪（规则去噪不需要触发词）', async () => {
  const router = createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) });
  const decision = await router.decide({
    chatId: 'c',
    text: '嗯，因为呢，最近那个GPT，最近那个GPT，嗯，它的智力不太好。',
    noteMode: true,
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.OBSIDIAN);
  assert.deepEqual(decision.obsidianItems, ['最近那个GPT，它的智力不太好。']);
  assert.equal(decision.durationMs, 0);
});

test('decide：速记模式是显式意图，/router off 时仍然记事', async () => {
  const router = createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) });
  const decision = await router.decide({
    chatId: 'c',
    text: '买咖啡豆',
    noteMode: true,
    config: routerConfig({ enabled: false }),
  });

  assert.equal(decision.route, ROUTES.OBSIDIAN);
  assert.equal(decision.source, 'note-mode');
});

test('decide：速记模式下显式命令 /dsh 仍然优先', async () => {
  const router = createIntentRouter({ ollama: stubOllama({ ok: true, data: { route: 'dsh', confidence: 1 } }) });
  const decision = await router.decide({
    chatId: 'c',
    text: '看下今天日志',
    forcedRoute: ROUTES.DSH,
    noteMode: true,
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'command');
});

test('decide：速记模式下未配置 inboxDir 或内容为空时降级 dsh', async () => {
  const noInbox = await createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) }).decide({
    chatId: 'c',
    text: '买咖啡豆',
    noteMode: true,
    config: normalizeRouterConfig({}, { enabled: true }),
  });
  assert.equal(noInbox.route, ROUTES.DSH);
  assert.equal(noInbox.source, 'fallback');
  assert.equal(noInbox.fallbackReason, 'inbox-missing');

  const empty = await createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) }).decide({
    chatId: 'c',
    text: '   ',
    noteMode: true,
    config: routerConfig(),
  });
  assert.equal(empty.route, ROUTES.DSH);
  assert.equal(empty.source, 'fallback');
  assert.equal(empty.fallbackReason, 'empty-items');
});

test('decide：速记模式关闭时，普通消息仍交给分类器', async () => {
  const ollama = stubOllama({ ok: true, data: { route: 'local', confidence: 0.95 } });
  const router = createIntentRouter({ ollama });
  const decision = await router.decide({
    chatId: 'c',
    text: '你好',
    noteMode: false,
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.LOCAL);
  assert.equal(decision.source, 'classifier');
  assert.equal(ollama.calls.length, 1);
});

test('decide：速记模式下查询/整理笔记仍走 dsh，不被写进待整理', async () => {
  const router = createIntentRouter({ ollama: stubOllama({ ok: false, error: '不该被调用' }) });
  const decision = await router.decide({
    chatId: 'c',
    text: '我待整理里昨天记了什么？',
    noteMode: true,
    config: routerConfig(),
  });

  assert.equal(decision.route, ROUTES.DSH);
  assert.equal(decision.source, 'rule');
  assert.equal(decision.noteAction, 'query');
  assert.deepEqual(decision.obsidianItems, []);
  assert.equal(router.stats.note, 1);
});
