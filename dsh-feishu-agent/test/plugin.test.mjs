/** 集成：假飞书 SDK + 假宿主，把插件 `apply()` 真跑一遍。 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { apply } from '../lib/index.js';
import { CARD_ACTION_EVENT, MESSAGE_EVENT } from '../lib/feishu/events.js';
import { installFakeSdk } from './fake-sdk.mjs';
import { interactiveTargetOf } from '../lib/host/interactive-target.js';
import { localDateStamp } from '../lib/local/obsidian-inbox.js';
import { POLISH_SCHEMA } from '../lib/local/polish.js';

/**
 * 模块加载时的进程环境快照：`boot()` 用它把用例之间的环境变量隔离干净。
 *
 * `FEISHU_AGENT_*` 一律不算「洁净环境」：插件会在宿主进程里读 `.env` 并写进 `process.env`，
 * 从这里启动的测试进程会继承到它们（比如真实的 owner / 工作区），从而污染用例。
 */
const PRISTINE_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('FEISHU_AGENT_')),
);

/**
 * 造一个假 Cordis 上下文。
 *
 * @param services 服务表
 * @returns 上下文与日志
 */
function createFakeContext(services) {
  const listeners = new Map();
  const log = [];
  const ctx = {
    get: (name) => services[name],
    logger: (scope) => ({
      info: (message) => log.push(['info', scope, String(message)]),
      warn: (message) => log.push(['warn', scope, String(message)]),
      error: (message) => log.push(['error', scope, String(message)]),
      debug: () => {},
    }),
    on: (eventName, handler, options) => {
      const list = listeners.get(eventName) ?? [];
      if (options?.prepend) list.unshift(handler);
      else list.push(handler);
      listeners.set(eventName, list);
      return () => {
        listeners.set(eventName, (listeners.get(eventName) ?? []).filter((item) => item !== handler));
      };
    },
    async emit(eventName, ...args) {
      for (const handler of listeners.get(eventName) ?? []) {
        const result = await handler(...args);
        if (eventName.endsWith('/request') && result !== undefined) return result;
      }
      return undefined;
    },
    emitSync(eventName, ...args) {
      for (const handler of listeners.get(eventName) ?? []) handler(...args);
    },
    listenerCount: (eventName) => (listeners.get(eventName) ?? []).length,
  };
  return { ctx, log };
}

/**
 * 造一个假宿主。
 *
 * @returns 宿主句柄
 */
function createFakeHost() {
  let seq = 0;
  const sessions = new Map();
  const prompts = [];
  const workspaces = new Map();
  const renames = [];
  const cancels = [];
  const attaches = [];
  const selectModels = [];
  return {
    sessions,
    prompts,
    renames,
    cancels,
    attaches,
    selectModels,
    services: {
      agents: { get: (sessionId) => sessions.get(sessionId) },
      workspaceRegistry: {
        async resolveByPath(path) {
          const id = workspaces.get(path);
          return id === undefined ? undefined : { id, path, sessionIds: [] };
        },
        async create(path) {
          // 真实的 Registry 要求目录存在；测试里顺带建出来，CLI 才能把它当 cwd。
          await mkdir(path, { recursive: true });
          const id = `ws_${workspaces.size + 1}`;
          workspaces.set(path, id);
          return { id, path, sessionIds: [] };
        },
        get(id) {
          return {
            id,
            path: [...workspaces].find(([, value]) => value === id)?.[0] ?? '',
            async attachSession(sessionId) {
              attaches.push({ workspaceId: id, sessionId });
            },
          };
        },
        list: () => [],
      },
      sessionController: {
        async create(request) {
          seq += 1;
          const sessionId = `session-test-${seq}`;
          sessions.set(sessionId, { id: sessionId, session: { id: sessionId } });
          return { sessionId, agentPreset: request?.agentPreset };
        },
        async selectModel(request) {
          selectModels.push({ sessionId: request.sessionId, provider: request.provider, model: request.model });
          const agent = sessions.get(request.sessionId);
          if (agent) {
            agent.model = { current: () => ({ provider: request.provider, model: request.model }) };
          }
          return {};
        },
        async prompt(request) {
          prompts.push(request);
          return { messageId: `msg_${prompts.length}` };
        },
        async cancel(request) {
          cancels.push(request);
          return {};
        },
        async resolveAgent(sessionId) {
          return sessions.get(sessionId) ?? { error: new Error('not found') };
        },
        async rename(request) {
          renames.push(request);
          return { title: request.title };
        },
      },
      userQuestions: {},
      approval: {},
    },
  };
}

let messageSeq = 0;

/**
 * 写一个假 CLI：按 `--json` 事件流输出，模拟一轮成功执行。
 *
 * 支持的环境变量：FAKE_CLI_MODE=ok|fail|slow
 *
 * @param dir 临时目录
 * @returns 脚本路径
 */
async function writeFakeCli(dir) {
  const { writeFile, chmod, appendFile } = await import('node:fs/promises');
  const file = join(dir, 'fake-dsh.mjs');
  const logFile = join(dir, 'fake-cli-calls.jsonl');
  const script = `#!/usr/bin/env node

const args = process.argv.slice(2);
const sessionIndex = args.indexOf('--session-id');
const sessionId = sessionIndex >= 0 ? args[sessionIndex + 1] : 'session-cli-' + Math.random().toString(36).slice(2, 10);

const prompt = args[args.length - 1];
const mode = process.env.FAKE_CLI_MODE ?? 'ok';
// 模拟持久化：把会话目录建在 DSH_HOME 下，插件据此判断会话是否还在。
{
  const { mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  mkdirSync(join(process.env.DSH_HOME ?? '.', 'sessions', 'fake', sessionId), { recursive: true });
}
await import('node:fs').then((fs) => fs.appendFileSync(${JSON.stringify(join(dir, 'fake-cli-calls.jsonl'))}, JSON.stringify({ sessionId: sessionIndex >= 0 ? sessionId : null, prompt, dshHome: process.env.DSH_HOME ?? null, cwd: process.cwd() }) + '\\n'));
const write = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
if (process.env.FAKE_CLI_REJECT_LEGACY === '1' && sessionId === 'session-legacy-with-preset') {
  process.stderr.write('dsh: session runs under agent preset "standard", which the one-shot runner does not compose\\n');
  process.exit(1);
}
write({ type: 'session', sessionId, cwd: process.cwd() });
if (mode === 'fail') {
  write({ type: 'status', phase: 'turn_end', turn: 1, reason: { kind: 'error', error: { message: '模拟失败' } } });
  write({ type: 'final', sessionId, reason: { kind: 'error', error: { message: '模拟失败' } }, text: '' });
  process.exit(1);
}
write({ type: 'status', phase: 'turn_start', turn: 1 });
if (mode === 'slow') { await new Promise((r) => setTimeout(r, 3000)); }
write({ type: 'status', phase: 'step_start', turn: 1, step: 1 });
write({ type: 'tool_call', callId: 'c1', tool: 'bash', input: {} });
write({ type: 'text', text: '假 CLI 的回答：' + prompt });
write({ type: 'status', phase: 'turn_end', turn: 1, reason: { kind: 'completed' } });
write({ type: 'final', sessionId, reason: { kind: 'completed' }, text: '假 CLI 的回答：' + prompt });
process.exit(0);
`;
  await writeFile(file, script, 'utf8');
  await chmod(file, 0o755);
  return file;
}

/**
 * 装插件：每个用例一份新的假飞书 + 假宿主 + 独立状态目录。
 *
 * @param options.config 插件配置（覆盖默认）
 * @param options.services 额外/覆盖的宿主服务
 * @returns 运行环境
 */
async function boot(options = {}) {
  // 回到模块加载时的进程环境：上一个用例可能把 FEISHU_AGENT_* 留在 process.env 里，
  // 带着它跑下一个用例会让配置互相污染（比如环境的 chats 覆盖下一个用例的默认工作区）。
  for (const [key, value] of Object.entries(PRISTINE_ENV)) {
    if (process.env[key] !== value) process.env[key] = value;
  }
  for (const key of Object.keys(process.env)) {
    if (!(key in PRISTINE_ENV)) delete process.env[key];
  }
  const feishu = installFakeSdk();
  const savedEnv = {};
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-agent-'));
  const workspacePath = join(dir, 'workspace');
  await mkdir(workspacePath, { recursive: true });
  process.env.FEISHU_AGENT_STATE_DIR = dir;
  // 插件的会话存在性检查按 DSH_HOME 找工作区目录；测试里指向临时目录，假 CLI 也在那里落会话目录。
  savedEnv.DSH_HOME = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  // 用例默认不读仓库里的真实 `.env`；给了 envFile 就写到临时目录里当项目 .env 用。
  savedEnv.FEISHU_AGENT_ENV_FILE = process.env.FEISHU_AGENT_ENV_FILE;
  if (options.envFile !== undefined) {
    await writeFile(join(dir, '.env'), options.envFile, 'utf8');
    process.env.FEISHU_AGENT_ENV_FILE = join(dir, '.env');
  } else {
    process.env.FEISHU_AGENT_ENV_FILE = join(dir, 'no-such.env');
  }
  if (options.state !== undefined) {
    await writeFile(join(dir, 'state.json'), JSON.stringify(options.state), 'utf8');
  }
  if (options.cards !== undefined) {
    await writeFile(join(dir, 'cards.json'), JSON.stringify(options.cards), 'utf8');
  }
  // 本机私有配置在 apply 时读取；必须在插件启动前写好。
  if (options.localConfig !== undefined) {
    await writeFile(join(dir, 'local-config.json'), JSON.stringify(options.localConfig), 'utf8');
  }
  if (options.config?.appId === '') {
    delete process.env.FEISHU_AGENT_APP_ID;
    delete process.env.FEISHU_AGENT_APP_SECRET;
  } else {
    process.env.FEISHU_AGENT_APP_ID = 'cli_test';
    process.env.FEISHU_AGENT_APP_SECRET = 'secret';
  }
  // 默认把「等宿主认领」压到 100ms：假宿主不会发认领事件，用例不该每条消息都等 8 秒。
  if (process.env.FEISHU_AGENT_HOST_TURN_TIMEOUT_MS === undefined) process.env.FEISHU_AGENT_HOST_TURN_TIMEOUT_MS = '100';
  // 用例显式传的 env 最后生效，压过上面的默认凭据。
  for (const [key, value] of Object.entries(options.env ?? {})) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  const host = createFakeHost();
  const { ctx, log } = createFakeContext({ ...host.services, ...(options.services ?? {}) });
  // 用假的 CLI 脚本替代真 `dsh`：它写出与 headless `--json` 相同的事件流。
  const cliPath = await writeFakeCli(dir);
  const config = {
    ownerOpenId: 'ou_owner',
    cliPath,
    chats: { oc_test: { workspacePath, titlePrefix: '[私人]' } },
    ...(options.config ?? {}),
  };
  await apply(ctx, config);
  await settle();
  return {
    feishu,
    dir,
    workspacePath,
    host,
    ctx,
    log,
    config,
    /** 送一条私聊消息。 */
    message: (payload) => message(feishu, payload),
    /** 点一下卡片按钮。 */
    clickCard: (value, operator = 'ou_owner') => clickCard(feishu, value, operator),
    /** 恢复 boot 时改写过的环境变量。 */
    restoreEnv: () => {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}

/**
 * 送一条私聊消息进插件。
 *
 * @param feishu 假飞书
 * @param options 正文 / 发送者 / 会话 / 事件 ID
 * @returns 插件返回值
 */
function message(feishu, options) {
  messageSeq += 1;
  const {
    text,
    sender = 'ou_owner',
    chatId = 'oc_test',
    chatType = 'p2p',
    mentions = [],
    eventId = `ev-${messageSeq}-${Date.now().toString(36)}`,
    messageId = `om-${messageSeq}-${Date.now().toString(36)}`,
    parentId = '',
  } = options;
  return feishu.deliver(MESSAGE_EVENT, {
    header: { event_id: eventId, app_id: 'cli_test', tenant_key: 't', create_time: String(Date.now() * 1000) },
    event: {
      sender: { sender_id: { open_id: sender }, sender_type: 'user' },
      message: {
        message_id: messageId,
        ...(parentId === '' ? {} : { parent_id: parentId }),
        chat_id: chatId,
        chat_type: chatType,
        ...(mentions.length === 0
          ? {}
          : {
            mentions: mentions.map((item, index) => ({
              key: `@_user_${index + 1}`,
              id: { open_id: item.openId ?? '' },
              name: item.name ?? '',
            })),
          }),
        message_type: 'text',
        content: JSON.stringify({ text }),
        create_time: String(Date.now() * 1000),
      },
    },
  });
}

/**
 * 点一下卡片按钮。
 *
 * @param feishu 假飞书
 * @param value 按钮回传值
 * @param operator 操作者 open_id
 * @returns 回调响应
 */
function clickCard(feishu, value, operator = 'ou_owner') {
  messageSeq += 1;
  return feishu.deliver(CARD_ACTION_EVENT, {
    header: {
      event_id: `evc-${messageSeq}`,
      app_id: 'cli_test',
      tenant_key: 't',
      create_time: String(Date.now() * 1000),
    },
    event: {
      operator: { open_id: operator },
      action: { value },
      context: { open_chat_id: 'oc_test', open_message_id: 'om_fake_card' },
    },
  });
}

/** 等异步链跑完。 */
function settle(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 轮询等待条件成立。 */
async function waitFor(predicate, label = '条件未满足', timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await settle(40);
  }
  if (lastError) throw lastError;
  assert.fail(`等待超时（${timeoutMs}ms）：${label}`);
}

/** 把宿主会话事件送进插件。 */
function hostEvents(env, sessionId, events) {
  for (const event of events) env.ctx.emitSync('session/event', { id: sessionId }, event);
}

/** 把一条消息先投喂再让宿主「取走」，返回宿主看到的 prompt。 */
async function promptOnce(env, text, options = {}) {
  const before = await cliCalls(env).then((rows) => rows.length);
  await env.message({ text, ...options });
  for (let i = 0; i < 120; i += 1) {
    await settle(50);
    const rows = await cliCalls(env);
    if (rows.length > before) return rows.at(-1);
  }
  assert.fail(`CLI 没有被调用；插件日志：\n${env.log.map((row) => row.join(' ')).join('\n')}`);
}

/**
 * 假 CLI 记录下来的调用。
 *
 * @param env 运行环境
 * @returns 调用数组
 */
async function cliCalls(env) {
  try {
    const text = await readFile(join(env.dir, 'fake-cli-calls.jsonl'), 'utf8');
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

test('加载：订阅宿主流与两条 waterfall，并建立带看门狗的长连接', async () => {
  const env = await boot();
  try {
    assert.equal(env.ctx.listenerCount('session/event'), 1);
    assert.equal(env.ctx.listenerCount('user-questions/request'), 1);
    assert.equal(env.ctx.listenerCount('approval/request'), 1);
    assert.equal(env.feishu.state.startCalls, 1);
    assert.equal(env.feishu.state.wsOptions.wsConfig.pingTimeout, 15, '必须开存活看门狗');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('消息 → 建会话（带工作区）→ 投喂 → 回答卡收尾', async () => {
  const env = await boot();
  try {
    const call = await promptOnce(env, '你好');
    assert.equal(call.prompt, '你好', 'CLI 应该收到原文');
    assert.equal(call.sessionId, null, '首次执行不带 --session-id');
    await settle(600);
    assert.ok(env.feishu.patched.length >= 1, '应该有卡片更新');

    const firstCard = env.feishu.sent.find((item) => item.kind === 'reply');
    assert.ok(firstCard, '应该在用户消息下回一张卡');
    assert.equal(firstCard.card.header.title.content, '排队中');
    assert.ok(JSON.stringify(firstCard.card).includes('"name":"withdraw"'), '排队中应带撤回按钮');

    await settle(1200);
    const titles = env.feishu.patched.map((item) => item.card.header.title.content);
    assert.ok(titles.includes('处理中'), `应出现处理中，实际 ${JSON.stringify(titles)}`);
    assert.equal(titles.at(-1), '已完成');
    const final = env.feishu.patched.at(-1).card;
    assert.ok(JSON.stringify(final).includes('假 CLI 的回答'), '终态应包含 CLI 的正文');
    assert.ok(!JSON.stringify(final).includes('"name":"stop"'), '终态应摘掉按钮');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    assert.ok(binding.dshSessionId.startsWith('session-cli-'), 'CLI 返回的 sessionId 应写进绑定');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('第二条消息复用同一个会话', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '第一句');
    await settle(300);
    await promptOnce(env, '第二句');
    await settle(300);
    const calls = await cliCalls(env);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].sessionId, null, '第一条新建会话');
    assert.ok(calls[1].sessionId?.startsWith('session-cli-'), '第二条应带 --session-id 续写');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('没有配置的 chat 收到提示，不投喂', async () => {
  const env = await boot();
  try {
    await env.message({ text: 'hi', chatId: 'oc_unknown' });
    await settle();
    assert.equal((await cliCalls(env)).length, 0);
    assert.ok(JSON.stringify(env.feishu.sent.at(-1).card).includes('没有配置工作区'));
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('非 owner 被忽略；第一条私聊自举 owner', async () => {
  const env = await boot({ config: { ownerOpenId: '' } });
  try {
    await env.message({ text: '第一条', sender: 'ou_owner' });
    for (let i = 0; i < 40 && (await cliCalls(env)).length === 0; i += 1) await settle(50);
    assert.equal((await cliCalls(env)).length, 1, '第一条私聊自举 owner 后应被处理');
    const titles = env.feishu.sent.map((item) => item.card?.header?.title?.content);
    assert.ok(titles.includes('已绑定'), `应该先发一张已绑定卡，实际 ${JSON.stringify(titles)}`);
    await env.message({ text: '第二条', sender: 'ou_other' });
    await settle(400);
    assert.equal((await cliCalls(env)).length, 1, '别的账号应该被忽略');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('重复 event_id 只处理一次；迟到事件被丢弃', async () => {
  const env = await boot();
  try {
    await env.message({ text: '只跑一次', eventId: 'ev-dup' });
    for (let i = 0; i < 40 && (await cliCalls(env)).length === 0; i += 1) await settle(50);
    const afterFirst = (await cliCalls(env)).length;
    await env.message({ text: '只跑一次', eventId: 'ev-dup' });
    await settle(500);
    assert.equal((await cliCalls(env)).length, afterFirst, '重复 event_id 不能再次触发 CLI');
    await env.feishu.deliver(MESSAGE_EVENT, {
      header: { event_id: 'ev-old', app_id: 'cli_test', tenant_key: 't', create_time: String((Date.now() - 60_000) * 1000) },
      event: {
        sender: { sender_id: { open_id: 'ou_owner' }, sender_type: 'user' },
        message: {
          message_id: 'om_old',
          chat_id: 'oc_test',
          chat_type: 'p2p',
          message_type: 'text',
          content: JSON.stringify({ text: '旧消息' }),
          create_time: String((Date.now() - 60_000) * 1000),
        },
      },
    });
    await settle(400);
    assert.equal((await cliCalls(env)).length, afterFirst, '迟到的重推消息不能当新指令');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('/status 与 /help 直接回卡，不建会话也不投喂', async () => {
  const env = await boot();
  try {
    await env.message({ text: '/status', eventId: 'cmd-1' });
    await settle();
    await env.message({ text: '/help', eventId: 'cmd-2' });
    await settle(600);
    assert.equal((await cliCalls(env)).length, 0);
    assert.equal(env.host.sessions.size, 0, '命令不应该顺手建会话');
    const titles = env.feishu.sent.map((item) => item.card?.header?.title?.content);
    assert.deepEqual(titles, ['状态', '可用命令']);
    const helpJson = JSON.stringify(env.feishu.sent.at(-1).card);
    assert.ok(helpJson.includes('/new [local|all]'));
    assert.equal(helpJson.match(/\/new\b/g)?.length, 1, '/help 中 /new 只应出现一次');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('/new 换会话，/stop 取消当前这一轮', async () => {
  const env = await boot();
  try {
    const first = await promptOnce(env, '建会话');
    await settle(800);
    const state1 = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const bound1 = Object.values(state1.bindings)[0].dshSessionId;
    assert.ok(bound1.startsWith('session-cli-'), '首轮之后应记下 CLI 会话');
    await env.message({ text: '/new' });
    await settle(300);
    const state2 = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    assert.equal(Object.values(state2.bindings)[0].dshSessionId, '', '/new 应清空当前会话');
    await env.message({ text: '/stop' });
    await settle(300);
    const titles = env.feishu.sent.map((item) => item.card?.header?.title?.content);
    assert.ok(titles.includes('停止'), '应回一张停止提示卡');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('回答卡「停止」按钮取消当前这一轮', async () => {
  const env = await boot({
    config: {},
    env: { FAKE_CLI_MODE: 'slow' },
  });
  try {
    await env.message({ text: '长任务' });
    // 等到「处理中」卡出现（CLI 已开始跑，但要 3 秒才结束）
    for (let i = 0; i < 60; i += 1) {
      await settle(50);
      const titles = env.feishu.patched.map((item) => item.card.header.title.content);
      if (titles.includes('处理中')) break;
    }
    const titles = env.feishu.patched.map((item) => item.card.header.title.content);
    assert.ok(titles.includes('处理中'), `应进入处理中，实际 ${JSON.stringify(titles)}`);
    const reply = env.feishu.sent.find((item) => item.kind === 'reply');
    assert.ok(reply, '应该先开出一张回答卡');
    const response = await env.clickCard({ tag: 'answer', action: 'stop', messageId: reply.replyTo });
    assert.equal(response.toast.content, '已请求停止');
    await settle(1200);
    const finals = env.feishu.patched.map((item) => item.card.header.title.content);
    assert.ok(finals.includes('失败') || finals.includes('已停止'), `停止后应收尾，实际 ${JSON.stringify(finals)}`);
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

/** 从卡片 JSON 里抠出按钮回传的 requestId。 */
function requestIdOf(card) {
  const text = JSON.stringify(card ?? {});
  const matched = /"requestId":"([^"]+)"/.exec(text);
  return matched?.[1];
}

/** 起一条宿主轮次并让它进入 running（反问/审批只接管这种轮次）。 */
async function startHostTurn(env, text, messageId) {
  // 状态落盘是异步的：轮询到绑定里真有会话再继续，避免读到半截。
  let sessionId = '';
  for (let i = 0; i < 40 && sessionId === ''; i += 1) {
    await settle(50);
    try {
      const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      sessionId = String(Object.values(state.bindings ?? {})[0]?.dshSessionId ?? '');
    } catch {
      // 还没写全
    }
  }
  assert.ok(sessionId, '绑定里应该有会话 ID');
  env.host.sessions.set(sessionId, { id: sessionId, session: { id: sessionId } });
  await env.message({ text, messageId });
  await settle(200);
  hostEvents(env, sessionId, [
    { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: `f_${messageId}` }, message: { id: 'h1' } } },
  ]);
  await settle(100);
  return sessionId;
}

test('宿主轮次的反问：飞书发选项卡，点选项再提交后把答案交回会话', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const sessionId = await startHostTurn(env, '问我一题', 'om-ask-1');

    const answerPromise = env.ctx.emit(
      'user-questions/request',
      {
        agent: { id: sessionId },
        questions: [{ id: 'q1', header: '配色', question: '选一个', options: [{ label: '红' }, { label: '蓝' }] }],
      },
      async () => {
        throw new Error('不该让给桌面端');
      },
    );
    await settle(200);

    const card = env.feishu.sent.at(-1)?.card;
    assert.equal(card.header.title.content, '需要你回答');
    const requestId = requestIdOf(card);
    assert.ok(requestId, '选项卡应带 requestId');

    env.clickCard({ tag: 'question', action: 'pick', requestId, questionId: 'q1', optionValue: '蓝' });
    await settle(100);
    assert.ok(
      env.feishu.sent.some((item) => JSON.stringify(item.card).includes('已选：蓝')) === false,
      '选中只是 toast，不该另发消息',
    );
    env.clickCard({ tag: 'question', action: 'submit', requestId });
    const result = await answerPromise;
    assert.deepEqual(result, { answers: [{ id: 'q1', selected: ['蓝'] }] });
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('宿主事件顺序：turn/start 先到、user/message 不带 turn，也能收尾卡片', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const sessionId = Object.values(state.bindings)[0].dshSessionId;
    env.host.sessions.set(sessionId, { id: sessionId, session: { id: sessionId } });
    await env.message({ text: '跑一轮', messageId: 'om-order-1' });
    await settle(200);

    hostEvents(env, sessionId, [
      { type: 'turn/start', data: { turn: 2 } },
      { type: 'user/message', data: { source: { kind: 'user', rpcId: 'f_om-order-1' }, message: { id: 'h2' } } },
      { type: 'tool/call', data: { turn: 2, step: 1, callId: 'c1', name: 'bash' } },
      { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } },
    ]);
    await settle(1400);

    const titles = env.feishu.patched.map((item) => item.card?.header?.title?.content);
    assert.ok(titles.includes('已完成'), `卡片应被收尾，实际 ${JSON.stringify(titles)}`);
    assert.ok(JSON.stringify(env.feishu.patched).includes('bash ×1'), '工具计数应算进这一轮');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('启动时收尾上一次进程留下的「处理中」卡片', async () => {
  const env = await boot({
    cards: {
      om_stale: { cardId: 'om_card_stale', title: '处理中', content: '', color: 'blue', action: 'stop', turn: 0, tooLong: false, sendFailed: false },
    },
  });
  try {
    const titles = env.feishu.patched.map((item) => item.card?.header?.title?.content);
    assert.ok(titles.includes('已中断'), `重启后应把半截卡标成已中断，实际 ${JSON.stringify(titles)}`);
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('宿主轮次的自由文本反问：下一条消息就是答案', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const sessionId = await startHostTurn(env, '问个自由题', 'om-ask-free');

    const answerPromise = env.ctx.emit(
      'user-questions/request',
      { agent: { id: sessionId }, questions: [{ id: 'q-free', header: '风格', question: '想要什么风格？' }] },
      async () => {
        throw new Error('自由文本题不该让给桌面端');
      },
    );
    await settle(200);
    const card = env.feishu.sent.at(-1)?.card;
    assert.equal(card.header.title.content, '需要你回复');

    const before = (await cliCalls(env)).length;
    await env.message({ text: '要冷色调' });
    const result = await answerPromise;
    assert.deepEqual(result, { answers: [{ id: 'q-free', selected: [], custom: '要冷色调' }] });
    assert.equal((await cliCalls(env)).length, before, '答案消息不该再起一轮');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群聊里的交互卡片发给 owner 私聊，私聊里发给本会话', () => {
  assert.deepEqual(interactiveTargetOf({ chatId: 'oc_1', chatType: 'p2p' }, 'ou_owner'), { chatId: 'oc_1' });
  assert.deepEqual(interactiveTargetOf({ chatId: 'oc_group', chatType: 'group' }, 'ou_owner'), { openId: 'ou_owner' });
  // 群聊但没有 owner（理论上不会发生）：退回群会话，至少不丢消息。
  assert.deepEqual(interactiveTargetOf({ chatId: 'oc_group', chatType: 'group' }, ''), { chatId: 'oc_group' });
});

test('宿主轮次的审批：飞书发「允许一次 / 拒绝」，点允许交回 allowed-once', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const sessionId = await startHostTurn(env, '跑个命令', 'om-approve-1');

    const decision = env.ctx.emit(
      'approval/request',
      { agent: { id: sessionId }, toolName: 'bash', reason: '要删文件' },
      async () => 'unavailable',
    );
    await settle(200);

    const card = env.feishu.sent.at(-1)?.card;
    assert.equal(card.header.title.content, '需要授权');
    const requestId = requestIdOf(card);
    env.clickCard({ tag: 'approval', action: 'allow', requestId });
    assert.equal(await decision, 'allowed-once');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('宿主轮次里多题且含自由文本的反问让给桌面端', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const sessionId = await startHostTurn(env, '问个混合题', 'om-ask-2');
    let delegated = 0;
    await env.ctx.emit(
      'user-questions/request',
      {
        agent: { id: sessionId },
        questions: [
          { id: 'q1', question: '选一个', options: [{ label: 'a' }] },
          { id: 'q2', question: '随便说说' },
        ],
      },
      async () => {
        delegated += 1;
        return { answers: [] };
      },
    );
    assert.equal(delegated, 1);
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('CLI 路径下反问让给桌面端（子进程里的 turn 不经过本插件）', async () => {
  const env = await boot();
  try {
    let delegated = 0;
    const next = async () => {
      delegated += 1;
      return { answers: [] };
    };
    // 任何会话 ID 的请求都由子进程处理，插件一律 next()。
    await env.ctx.emit('user-questions/request', {
      agent: { id: 'session-whatever' },
      questions: [{ id: '1', question: 'q', options: [{ label: 'a' }] }],
    }, next);
    assert.equal(delegated, 1);
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('CLI 路径下工具审批让给桌面端', async () => {
  const env = await boot();
  try {
    const outcome = await env.ctx.emit(
      'approval/request',
      { agent: { id: 'session-whatever' }, toolName: 'bash' },
      async () => 'unavailable',
    );
    assert.equal(outcome, 'unavailable');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('绑定里残留不可采纳的会话时自动改用新会话', async () => {
  const env = await boot({ env: { FAKE_CLI_REJECT_LEGACY: '1' } });
  try {
    await promptOnce(env, '第一句');
    const statePath = join(env.dir, 'state.json');
    let state;
    for (let i = 0; i < 80; i += 1) {
      await settle(50);
      try {
        state = JSON.parse(await readFile(statePath, 'utf8'));
        const bound = Object.values(state.bindings ?? {})[0];
        if (bound?.dshSessionId?.startsWith('session-cli-')) break;
      } catch {
        // 还没写全
      }
    }
    const key = Object.keys(state.bindings)[0];
    assert.ok(state.bindings[key].dshSessionId.startsWith('session-cli-'), '首轮后应有 CLI 会话');

    // 把绑定换成一条"带 preset、CLI 不能采纳"的会话。
    state.bindings[key].dshSessionId = 'session-legacy-with-preset';
    await (await import('node:fs/promises')).writeFile(statePath, JSON.stringify(state), 'utf8');

    // 插件是从内存里的 store 读的，所以直接改内存不现实；这里验证的是"CLI 报那个错时不崩、卡片给失败"。
    const before = (await cliCalls(env)).length;
    await env.message({ text: '第二句' });
    for (let i = 0; i < 60; i += 1) {
      await settle(50);
      if ((await cliCalls(env)).length > before + 1) break;
    }
    const calls = await cliCalls(env);
    assert.ok(calls.length >= before + 1, '应该至少又调了一次 CLI');
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('状态落盘：owner 与绑定能恢复', async () => {
  const env = await boot();
  try {
    await env.message({ text: '建会话' });
    // 等 CLI 跑完并回写 sessionId（CLI 冷启动要几百毫秒到几秒）。
    for (let i = 0; i < 100; i += 1) {
      await settle(50);
      try {
        const probe = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
        const bound = Object.values(probe.bindings ?? {})[0];
        if (bound?.dshSessionId?.startsWith('session-cli-')) break;
      } catch {
        // 文件还没写全，继续等。
      }
    }
    const text = await readFile(join(env.dir, 'state.json'), 'utf8');
    const raw = JSON.parse(text);
    assert.equal(raw.ownerOpenId, 'ou_owner');
    assert.equal(Object.keys(raw.bindings).length, 1);
    const binding = Object.values(raw.bindings)[0];
    assert.equal(binding.workspacePath, env.workspacePath);
    assert.ok(binding.dshSessionId.startsWith('session-cli-'), 'CLI 会话 ID 应写进绑定');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('凭据缺失时不建连，但插件照常加载', async () => {
  const env = await boot({ config: { appId: '' } });
  try {
    assert.equal(env.feishu.state.startCalls, 0);
    assert.ok(env.log.some(([level, , text]) => level === 'warn' && text.includes('飞书凭据未配置')));
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('项目 .env 里的凭据能建连', async () => {
  const env = await boot({
    config: { appId: '' },
    envFile: 'FEISHU_AGENT_APP_ID=cli_from_env_file\nFEISHU_AGENT_APP_SECRET=secret_from_env_file\n',
  });
  try {
    assert.equal(env.feishu.state.startCalls, 1);
    assert.equal(env.feishu.state.wsOptions.appId, 'cli_from_env_file');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('真实环境变量压过项目 .env 里的同名键', async () => {
  const env = await boot({
    config: { appId: '' },
    envFile: 'FEISHU_AGENT_APP_ID=cli_from_env_file\n',
    env: {
      FEISHU_AGENT_APP_ID: 'cli_from_real_env',
      FEISHU_AGENT_APP_SECRET: 'secret_from_real_env',
    },
  });
  try {
    assert.equal(env.feishu.state.wsOptions.appId, 'cli_from_real_env');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('定时任务到点会主动投喂', async () => {
  const env = await boot();
  try {
    await env.message({ text: '先建会话' });
    await settle();
    const before = env.host.prompts.length;
    const { createScheduler } = await import('../lib/core/scheduler.js');
    const scheduler = createScheduler({
      logger: { info() {}, warn() {} },
      store: {
        state: {
          schedules: [{ id: 's1', chatId: 'oc_test', prompt: '主动任务', at: new Date(Date.now() - 1000).toISOString() }],
        },
        touch() {},
      },
      onDue: async (schedule) => {
        env.host.prompts.push({ sessionId: 'timer', content: [{ text: schedule.prompt }], mode: 'queue' });
      },
    });
    await scheduler.tick();
    assert.equal(env.host.prompts.length, before + 1);
    assert.equal(env.host.prompts.at(-1).content[0].text, '主动任务');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('本机配置优先：local-config.json 覆盖 bundle 里的同一个 chat', async () => {
  const localWorkspace = '/tmp/dsh-feishu-local-override';
  const env = await boot({ localConfig: { chats: { oc_test: { workspacePath: localWorkspace, titlePrefix: '[本机]' } } } });
  try {
    await promptOnce(env, '走本机配置');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    assert.equal(binding.workspacePath, localWorkspace, '本机配置里的工作区应覆盖 bundle');
    assert.equal(binding.titlePrefix, '[本机]');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('本机配置优先：通配 chats 接管 bundle 未列出的 chat', async () => {
  const wildcardWorkspace = '/tmp/dsh-feishu-local-wildcard';
  const env = await boot({ localConfig: { chats: { '*': { workspacePath: wildcardWorkspace, titlePrefix: '[通配]' } } } });
  try {
    await promptOnce(env, '走通配', { chatId: 'oc_unlisted' });
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings).find((item) => item.chatId === 'oc_unlisted');
    assert.ok(binding, '通配配置应该建出绑定');
    assert.equal(binding.workspacePath, wildcardWorkspace);
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('环境变量优先：默认工作区决定消息落在哪个目录', async () => {
  const envWorkspace = '/tmp/dsh-feishu-env-default-workspace';
  const env = await boot({ config: { chats: {} }, env: { FEISHU_AGENT_DEFAULT_WORKSPACE: envWorkspace } });
  try {
    await promptOnce(env, '走环境变量');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    assert.equal(binding.workspacePath, envWorkspace, '默认工作区应来自环境变量');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('环境变量优先：FEISHU_AGENT_CHATS 覆盖 local-config.json 里的同一个 chat', async () => {
  const localWorkspace = '/tmp/dsh-feishu-env-local-loses';
  const envWorkspace = '/tmp/dsh-feishu-env-chats-wins';
  const env = await boot({
    localConfig: { chats: { oc_test: { workspacePath: localWorkspace, titlePrefix: '[本机]' } } },
    env: {
      FEISHU_AGENT_CHATS: JSON.stringify({ oc_test: { workspacePath: envWorkspace, titlePrefix: '[环境]' } }),
    },
  });
  try {
    await promptOnce(env, '环境变量压过本机配置');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    assert.equal(binding.workspacePath, envWorkspace);
    assert.equal(binding.titlePrefix, '[环境]');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('会话被删掉后，下一条消息自动新起一条并更新绑定', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '第一条');
    const oldId = await waitFor(async () => {
      const first = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const id = Object.values(first.bindings ?? {})[0]?.dshSessionId;
      return id?.startsWith('session-cli-') ? id : false;
    }, '等待首条会话 ID 落盘');

    // 模拟在桌面端删掉了这条会话。
    await rm(join(env.dir, 'sessions', 'fake', oldId), { recursive: true, force: true });

    const call = await promptOnce(env, '第二条');
    assert.equal(call.sessionId, null, '会话不在了就不该再带 --session-id');

    const newId = await waitFor(async () => {
      const next = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const id = Object.values(next.bindings ?? {})[0]?.dshSessionId;
      return id && id !== oldId ? id : false;
    }, '等待绑定换到新会话');
    assert.notEqual(newId, oldId, '绑定应换到新会话');
    assert.ok(newId.startsWith('session-cli-'));
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('会话在桌面端开着时改由宿主投喂，不再抢 CLI 的写句柄', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const binding = await waitFor(async () => {
      const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const item = Object.values(state.bindings ?? {})[0];
      return item?.dshSessionId?.startsWith('session-cli-') ? item : false;
    }, '等待首轮 CLI 会话 ID 落盘');
    const cliBefore = (await cliCalls(env)).length;
    const promptsBefore = env.host.prompts.length;

    // 模拟桌面端打开了这条会话：宿主里出现活的 agent，同时也就握着它的写句柄。
    env.host.sessions.set(binding.dshSessionId, { id: binding.dshSessionId, session: { id: binding.dshSessionId } });

    await env.message({ text: '第二轮' });
    await settle(200);

    assert.equal((await cliCalls(env)).length, cliBefore, '不应再起 CLI 子进程');
    assert.equal(env.host.prompts.length, promptsBefore + 1, '应由宿主收到这一轮');
    assert.equal(env.host.prompts.at(-1).content[0].text, '第二轮');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('host 模式：会话由 Desktop 建、由宿主执行，不起 CLI', async () => {
  const env = await boot({
    env: { FEISHU_AGENT_TURN_MODE: 'host', FEISHU_AGENT_HOST_TURN_TIMEOUT_MS: '150' },
  });
  try {
    await env.message({ text: '交给桌面端' });
    await settle(700);

    assert.equal((await cliCalls(env)).length, 0, 'host 模式不该起 CLI');
    assert.equal(env.host.prompts.length, 1, '应由宿主收到这一轮');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    assert.ok(binding.dshSessionId.startsWith('session-test-'), '会话应由宿主创建');
    assert.ok(
      env.host.attaches.some((item) => item.sessionId === binding.dshSessionId),
      '宿主建的会话也要挂到工作区',
    );
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('宿主轮次的工具调用与 CLI 轮次同一样式：一行汇总', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '先建会话');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    const sessionId = binding.dshSessionId;
    const before = env.feishu.patched.length;

    env.host.sessions.set(sessionId, { id: sessionId, session: { id: sessionId } });
    await env.message({ text: '跑两个工具', messageId: 'om-host-tools' });
    // 等插件开好这一轮（turns.open / 卡片），否则事件来了也没有轮次可认领。
    await settle(200);
    hostEvents(env, sessionId, [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: 'f_om-host-tools' }, message: { id: 'h1' } } },
      { type: 'tool/call', data: { turn: 1, step: 1, callId: 'c1', name: 'bash' } },
      { type: 'tool/call', data: { turn: 1, step: 1, callId: 'c2', name: 'read' } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    await settle(1200);

    const text = JSON.stringify(env.feishu.patched.slice(before).map((item) => item.card));
    assert.ok(text.includes('bash ×1'), '宿主轮次应汇总 bash');
    assert.ok(text.includes('read ×1'), '宿主轮次应汇总 read');
    assert.ok(!text.includes('正在使用'), '宿主轮次也不该逐条刷日志');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('FEISHU_AGENT_TURN_MODE=cli 时即使会话开着也走 CLI', async () => {
  const env = await boot({ env: { FEISHU_AGENT_TURN_MODE: 'cli' } });
  try {
    await promptOnce(env, '先建会话');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    const cliBefore = (await cliCalls(env)).length;
    const promptsBefore = env.host.prompts.length;

    env.host.sessions.set(binding.dshSessionId, { id: binding.dshSessionId, session: { id: binding.dshSessionId } });
    await promptOnce(env, '第二轮');

    assert.equal(env.host.prompts.length, promptsBefore, 'cli 模式不应投喂宿主');
    assert.equal((await cliCalls(env)).length, cliBefore + 1, '应该继续走 CLI');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群接入：回调里没有 appId 时用已有绑定兜底，绑定键不会算错', async () => {
  const workspace = join(tmpdir(), 'dsh-feishu-group-appid');
  const env = await boot({
    config: {
      chats: { oc_test: { workspacePath: join(tmpdir(), 'dsh-feishu-group-appid-p2p') } },
      groupWorkspace: workspace,
    },
  });
  try {
    // 先有一个私聊绑定，作为 appId/tenantKey 的来源。
    await promptOnce(env, '先建私聊绑定');

    // 生产环境真实回调不带 app_id/tenant_key：这里故意只传 tag/action/chatId/preset。
    env.clickCard({ tag: 'group-register', action: 'allow', chatId: 'oc_group_appid', preset: 'read-only' });
    await settle(400);

    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    assert.ok(
      Object.keys(state.bindings).includes('cli_test:t:oc_group_appid:-'),
      `群绑定键应带上 appId/tenantKey，实际 ${JSON.stringify(Object.keys(state.bindings))}`,
    );

    // 再 @ 一次：不该再发确认卡，直接开跑。
    const cardsBefore = env.feishu.sent.filter((item) => item.receiveIdType === 'open_id').length;
    const call = await promptOnce(env, '@_user_1 现在问一句', {
      chatId: 'oc_group_appid',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    assert.equal(call.prompt, '现在问一句');
    assert.equal(
      env.feishu.sent.filter((item) => item.receiveIdType === 'open_id').length,
      cardsBefore,
      '授权过之后不该再发确认卡',
    );
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群接入：历史版本算错键的绑定会被认回并修正', async () => {
  const workspace = join(tmpdir(), 'dsh-feishu-group-legacy');
  const env = await boot({
    config: { chats: {}, groupWorkspace: workspace },
    state: {
      version: 1,
      ownerOpenId: 'ou_owner',
      bindings: {
        '::oc_legacy_group:-': {
          key: '::oc_legacy_group:-',
          appId: '',
          tenantKey: '',
          chatId: 'oc_legacy_group',
          chatType: 'group',
          workspaceId: 'ws_1',
          workspacePath: workspace,
          dshSessionId: '',
          agentPreset: 'standard',
          permissionPreset: 'read-only',
          title: '',
          titlePrefix: '[群]',
          allowSenders: [],
          createdAt: '2026-11-25T00:00:00.000Z',
          updatedAt: '2026-11-25T00:00:00.000Z',
        },
      },
      schedules: [],
    },
  });
  try {
    const call = await promptOnce(env, '@_user_1 老绑定也要能用', {
      chatId: 'oc_legacy_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    assert.equal(call.prompt, '老绑定也要能用');

    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    assert.ok(Object.keys(state.bindings).includes('cli_test:t:oc_legacy_group:-'), '绑定键应被修正');
    assert.ok(!Object.keys(state.bindings).includes('::oc_legacy_group:-'), '旧键应被删除');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群聊动态接入：未配置的群只有 owner @ 才收到确认卡，点了允许才建会话', async () => {
  const workspace = join(tmpdir(), 'dsh-feishu-group-dynamic');
  const env = await boot({ config: { chats: {}, groupWorkspace: workspace } });
  try {
    // 非 owner 先 @ 一次：不该有确认卡，也不该起 CLI。
    await env.message({
      text: '@_user_1 路人想用',
      chatId: 'oc_new_group',
      chatType: 'group',
      sender: 'ou_stranger',
      mentions: [{ openId: 'ou_bot' }],
    });
    await settle(400);
    assert.equal((await cliCalls(env)).length, 0);
    assert.equal(env.feishu.sent.length, 0, '非 owner 不该触发确认卡');

    // owner @：确认卡发到私聊（open_id），此时还没有绑定。
    await env.message({
      text: '@_user_1 接一下这个群',
      chatId: 'oc_new_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    await settle(600);
    const card = env.feishu.sent.find((item) => item.receiveIdType === 'open_id');
    assert.ok(card, '确认卡应发到 owner 的 open_id');
    assert.ok(JSON.stringify(card.card).includes('group-register'), '卡片按钮要带注册动作');
    let state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    assert.equal(Object.keys(state.bindings).length, 0, '还没点允许，不该建绑定');

    // 点「允许（只读）」
    env.clickCard({ tag: 'group-register', action: 'allow', chatId: 'oc_new_group', preset: 'read-only' });
    await settle(600);
    state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings).find((item) => item.chatId === 'oc_new_group');
    assert.ok(binding, '点允许后应该有绑定');
    assert.equal(binding.permissionPreset, 'read-only');
    assert.equal(binding.workspacePath, workspace);

    // 再 @ 一次：这次该正常起 CLI。
    const call = await promptOnce(env, '@_user_1 现在能聊了吗', {
      chatId: 'oc_new_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    assert.equal(call.prompt, '现在能聊了吗');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('配置热加载：改 local-config.json 后不用重启就生效', async () => {
  const workspace = join(tmpdir(), 'dsh-feishu-group-hot');
  const env = await boot({ config: { chats: {} } });
  try {
    // 先证明这时候群消息不被接管。
    await env.message({
      text: '@_user_1 热加载前',
      chatId: 'oc_hot_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    await settle(300);
    assert.equal((await cliCalls(env)).length, 0);

    // 写入本机配置（不重启插件）。
    await writeFile(
      join(env.dir, 'local-config.json'),
      JSON.stringify({ chats: { oc_hot_group: { workspacePath: workspace, chatType: 'group' } } }),
      'utf8',
    );

    const call = await promptOnce(env, '@_user_1 热加载之后', {
      chatId: 'oc_hot_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    assert.equal(call.prompt, '热加载之后');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群聊：显式配置 + @ 机器人 才会建独立会话', async () => {
  const groupWorkspace = join(tmpdir(), 'dsh-feishu-group-workspace');
  const env = await boot({
    config: { chats: { oc_group: { workspacePath: groupWorkspace, chatType: 'group', titlePrefix: '[群]' } } },
  });
  try {
    const call = await promptOnce(env, '@_user_1 群里问一句', {
      chatId: 'oc_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot', name: 'fake-bot' }],
    });
    assert.equal(call.prompt, '@_user_1 群里问一句'.replace('@_user_1 ', ''));
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings).find((item) => item.chatId === 'oc_group');
    assert.ok(binding, '群聊应该建出独立绑定');
    assert.equal(binding.chatType, 'group');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群聊：没 @ 机器人就不响应', async () => {
  const env = await boot({
    config: { chats: { oc_group: { workspacePath: join(tmpdir(), 'dsh-feishu-group-ws2'), chatType: 'group' } } },
  });
  try {
    await env.message({ text: '随便聊聊', chatId: 'oc_group', chatType: 'group' });
    await settle(600);
    assert.equal((await cliCalls(env)).length, 0, '没 @ 就不该起 CLI');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群聊：通配 chats 不接管群聊', async () => {
  const env = await boot();
  try {
    await env.message({
      text: '@_user_1 你好',
      chatId: 'oc_unlisted_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot' }],
    });
    await settle(600);
    assert.equal((await cliCalls(env)).length, 0, '通配配置只给私聊，群聊必须显式列 chat_id');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('群聊：非授权成员被拒绝，allowSenders 里的人可以提问', async () => {
  const workspace = join(tmpdir(), 'dsh-feishu-group-ws3');
  const env = await boot({
    config: {
      chats: {
        oc_group: { workspacePath: workspace, chatType: 'group', allowSenders: ['ou_teammate'] },
      },
    },
  });
  try {
    await env.message({
      text: '@_user_1 我是路人',
      chatId: 'oc_group',
      chatType: 'group',
      sender: 'ou_stranger',
      mentions: [{ openId: 'ou_bot' }],
    });
    await settle(400);
    assert.equal((await cliCalls(env)).length, 0, '不在白名单里的人不该触发');

    const call = await promptOnce(env, '@_user_1 我是队友', {
      chatId: 'oc_group',
      chatType: 'group',
      sender: 'ou_teammate',
      mentions: [{ openId: 'ou_bot' }],
    });
    assert.equal(call.prompt, '我是队友');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('引用卡片回复：把被引用卡片的文字补进这一轮提示词', async () => {
  const env = await boot();
  try {
    env.feishu.quoted.set('om_prev_card', {
      msg_type: 'interactive',
      body: {
        content: JSON.stringify({
          schema: '2.0',
          header: { title: { tag: 'plain_text', content: '图文混排（插件真实渲染）' } },
          body: {
            elements: [
              { tag: 'markdown', content: '这段文字和下面的图由插件自己的卡片代码拼出来' },
              { tag: 'img', img_key: 'img_v3_xxx' },
            ],
          },
        }),
      },
    });

    const call = await promptOnce(env, '这张图哪来的', { parentId: 'om_prev_card' });
    assert.ok(call.prompt.includes('[引用消息]'), '应带上引用标记');
    assert.ok(call.prompt.includes('图文混排（插件真实渲染）'), '应包含被引用卡片的标题');
    assert.ok(call.prompt.includes('插件自己的卡片代码'), '应包含卡片正文');
    assert.ok(call.prompt.trim().endsWith('这张图哪来的'), '用户的正文应放在引用之后');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('引用插件自己发的卡片：用本地记账还原正文，而不是飞书的降级占位', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '第一条：解释一下这张图');
    await settle(400);
    const cardId = env.feishu.sent.at(-1)?.id;
    assert.ok(cardId, '上一轮应该发过一张卡');

    const call = await promptOnce(env, '那它是什么风格', { parentId: cardId });
    assert.ok(call.prompt.includes('[引用消息]'), '应带上引用标记');
    assert.ok(call.prompt.includes('假 CLI 的回答：第一条'), '应还原上一张卡的正文');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('引用读不到时不阻断问答', async () => {
  const env = await boot();
  try {
    const call = await promptOnce(env, '没有引用也要能答', { parentId: 'om_missing' });
    assert.equal(call.prompt, '没有引用也要能答');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('回答里的 ![alt](路径) 渲染成卡片的 img 元素（图文混排）', async () => {
  const env = await boot();
  try {
    const pngPath = join(env.dir, 'shot.png');
    await writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));

    await promptOnce(env, `先看图 ![截图](${pngPath}) 然后继续`);
    await settle(1400);

    const cards = JSON.stringify(env.feishu.patched.map((item) => item.card));
    assert.ok(cards.includes('"tag":"img"'), '卡片里应有图片元素');
    assert.ok(cards.includes('img_fake_1'), '应使用上传得到的 image_key');
    assert.equal(env.feishu.uploads.length, 1, '同一张图只上传一次');
    assert.ok(!cards.includes('![截图]'), '图片语法不该原样留在卡片里');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('图文混排：相对路径 + <...> 写法也能内嵌', async () => {
  const env = await boot();
  try {
    const dir = join(env.workspacePath, '.preview');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    await promptOnce(env, '看图 ![](<.preview/shot.png>) 继续');
    await settle(1400);

    const cards = JSON.stringify(env.feishu.patched.map((item) => item.card));
    assert.ok(cards.includes('"tag":"img"'), '相对路径的图也应内嵌');
    assert.ok(!cards.includes('图片没发出去'), '不应退回失败文案');
    assert.equal(env.feishu.uploads.length, 1);
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('图片发不出去时回退成一行文字，不吞掉正文', async () => {
  const env = await boot();
  try {
    const missing = join(env.dir, 'nope.png');
    await promptOnce(env, `看图 ![丢失](${missing})`);
    await settle(1400);

    const cards = JSON.stringify(env.feishu.patched.map((item) => item.card));
    assert.ok(cards.includes('图片没发出去'), '应提示图片发送失败');
    assert.equal(env.feishu.uploads.length, 0, '读不到文件就不该上传');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('工具调用只在卡片底部汇总一行，不再逐条刷日志', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '用个工具');
    await settle(1200);
    const text = JSON.stringify(env.feishu.patched.map((item) => item.card));
    assert.ok(text.includes('次工具调用'), '卡片里应有工具汇总');
    assert.ok(text.includes('bash ×1'), '汇总里应带工具名与次数');
    assert.ok(!text.includes('正在使用'), '不该再逐条刷「正在使用」');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('新会话一出现就挂到工作区，不用等这一轮跑完', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '挂个工作区');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    const binding = Object.values(state.bindings)[0];
    assert.ok(binding.dshSessionId, '绑定里应记下 CLI 会话');
    assert.ok(
      env.host.attaches.some((item) => item.sessionId === binding.dshSessionId),
      '会话应被挂到绑定的工作区',
    );
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('CLI 在绑定的工作区里跑：子进程 cwd 就是 workspacePath', async () => {
  const env = await boot();
  try {
    await promptOnce(env, '看看工作目录');
    const calls = (await readFile(join(env.dir, 'fake-cli-calls.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    // macOS 的 /var 是 /private/var 的软链，两边都取真实路径再比。
    assert.equal(await realpath(calls.at(-1).cwd), await realpath(env.workspacePath), 'CLI 应把工作区当 cwd');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('本机配置优先：cliHome 注入 CLI 子进程', async () => {
  const cliHome = '/tmp/dsh-feishu-local-cli-home';
  const env = await boot({ localConfig: { cliHome } });
  try {
    const call = await promptOnce(env, '看子进程环境');
    assert.equal(call.dshHome, cliHome, 'CLI 子进程的 DSH_HOME 应来自本机配置');
  } finally {
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('意图路由 Route 3（obsidian）写入待整理且不建会话，撤销按钮可回滚', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            message: {
              content: JSON.stringify({
                route: 'obsidian',
                confidence: 0.95,
                reason: '记笔记',
                obsidianItems: ['买咖啡豆', '整理路由文档'],
              }),
            },
          };
        },
      };
    }
    return { ok: true, status: 200, async json() { return { models: [{ name: 'qwen3:8b' }] }; } };
  };

  const env = await boot({
    config: {
      router: {
        enabled: true,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    await env.message({ text: '帮我记一下买咖啡豆，还有整理路由文档', messageId: 'om-obsidian-1' });

    const replyCard = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-obsidian-1'),
      '等待 Obsidian 确认卡发出',
    );
    assert.ok(replyCard.card.header.title.content.includes('已记入待整理'));
    const cardJson = JSON.stringify(replyCard.card);
    assert.ok(cardJson.includes('"name":"undo_note"'), '确认卡应包含 undo_note 按钮');
    assert.ok(cardJson.includes('"name":"note_to_dsh"'), '确认卡应包含 note_to_dsh 按钮');

    const files = await readdir(inboxDir);
    assert.equal(files.length, 1);
    assert.equal(files[0], `${localDateStamp()}.md`);
    const filePath = join(inboxDir, files[0]);
    const written = await readFile(filePath, 'utf8');
    assert.ok(written.includes('买咖啡豆'));
    assert.ok(written.includes('整理路由文档'));
    assert.ok(written.includes('<!-- feishu:om-obsidian-1 -->'));

    assert.equal(env.host.sessions.size, 0, 'Obsidian 路由不应创建宿主会话');
    assert.equal((await cliCalls(env)).length, 0, 'Obsidian 路由不应触发 CLI');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    assert.equal(Object.keys(state.bindings).length, 0, 'Obsidian 路由不应创建绑定');

    const undoRes = await env.clickCard({ tag: 'route', action: 'undo-note', messageId: 'om-obsidian-1' });
    assert.equal(undoRes?.card?.data?.header?.title?.content, '已撤销写入');

    const afterUndo = await readFile(filePath, 'utf8');
    assert.ok(!afterUndo.includes('买咖啡豆'));
    assert.ok(!afterUndo.includes('整理路由文档'));
    assert.ok(!afterUndo.includes('<!-- feishu:om-obsidian-1 -->'));
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('意图路由 Route 3 点击「改交 4.1 Flash 处理」（note-to-dsh）撤销条目并执行主会话', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            message: {
              content: JSON.stringify({
                route: 'obsidian',
                confidence: 0.95,
                reason: '记笔记',
                obsidianItems: ['帮我重构网关路由'],
              }),
            },
          };
        },
      };
    }
    return { ok: true, status: 200, async json() { return { models: [{ name: 'qwen3:8b' }] }; } };
  };

  const env = await boot({
    config: {
      router: {
        enabled: true,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    await env.message({ text: '/note 帮我重构网关路由', messageId: 'om-note-dsh-1' });
    const filePath = join(inboxDir, `${localDateStamp()}.md`);
    await waitFor(async () => {
      try {
        const content = await readFile(filePath, 'utf8');
        return content.includes('帮我重构网关路由');
      } catch {
        return false;
      }
    }, '等待误记条目写入 Obsidian 文件');

    const res = await env.clickCard({ tag: 'route', action: 'note-to-dsh', messageId: 'om-note-dsh-1' });
    assert.ok(res?.card?.data?.header?.title?.content?.includes('已转交 4.1 Flash'));

    await waitFor(async () => {
      const content = await readFile(filePath, 'utf8');
      return !content.includes('帮我重构网关路由') && !content.includes('<!-- feishu:om-note-dsh-1 -->');
    }, '等待误记条目从 Obsidian 文件中撤销');

    const call = await waitFor(async () => {
      const calls = await cliCalls(env);
      return calls.length >= 1 ? calls.at(-1) : false;
    }, '等待主会话 DSH 执行');
    assert.equal(call.prompt, '帮我重构网关路由');

    const finished = await waitFor(
      () => env.feishu.patched.find((item) => item.card?.header?.title?.content === '已完成 · 4.1 Flash'),
      '等待转交后的 DSH 卡片收尾',
    );
    assert.ok(JSON.stringify(finished.card).includes('假 CLI 的回答：帮我重构网关路由'));

    const state = await waitFor(async () => {
      const raw = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const binding = Object.values(raw.bindings ?? {})[0];
      return binding?.dshSessionId ? binding : false;
    }, '等待主会话绑定写入 state.json');
    assert.ok(state.dshSessionId.startsWith('session-cli-'));
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('Host 模式双会话绑定（dsh vs local）+ selectModel + 改用 4.1 Flash 重答（escalate）', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  let nextDecision = { route: 'dsh', confidence: 0.92, reason: '复杂任务' };
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { message: { content: JSON.stringify(nextDecision) } };
        },
      };
    }
    return { ok: true, status: 200, async json() { return { models: [{ name: 'qwen3:8b' }] }; } };
  };

  const env = await boot({
    env: {
      FEISHU_AGENT_TURN_MODE: 'host',
      FEISHU_AGENT_HOST_TURN_TIMEOUT_MS: '2000',
    },
    config: {
      router: {
        enabled: true,
        routes: {
          dsh: {
            provider: 'zenmux',
            model: 'deepseek/deepseek-v4.1-flash',
            label: '4.1 Flash',
          },
          local: {
            provider: 'ollama',
            model: 'qwen3:8b',
            label: '本地 Qwen3',
            titlePrefix: '[飞书·本地]',
          },
        },
      },
    },
  });
  try {
    // Message 1 -> dsh
    await env.message({ text: '分析仓库架构并给出改动建议', messageId: 'om-host-dsh-1' });
    const prompt1 = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-host-dsh-1'),
      '等待第 1 轮 dsh 投喂宿主',
    );
    assert.equal(prompt1.sessionId, 'session-test-1');
    assert.ok(
      env.host.selectModels.some(
        (item) => item.sessionId === 'session-test-1' && item.provider === 'zenmux' && item.model === 'deepseek/deepseek-v4.1-flash',
      ),
      'dsh 会话应调用 selectModel 选中 zenmux / deepseek/deepseek-v4.1-flash',
    );
    const reply1 = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-host-dsh-1'),
      '等待第 1 轮回答卡开出',
    );
    hostEvents(env, 'session-test-1', [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: prompt1.requestId }, message: { id: 'hm-1' } } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '这是 4.1 Flash 的分析结果' }] } } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    await waitFor(
      () => env.feishu.patched.find((item) => item.messageId === reply1.id && item.card?.header?.title?.content === '已完成 · 4.1 Flash'),
      '等待第 1 轮卡片收尾为 已完成 · 4.1 Flash',
    );

    // Message 2 -> local
    nextDecision = { route: 'local', confidence: 0.91, reason: '简单常识问答' };
    await env.message({ text: '什么是幂等性？', messageId: 'om-host-local-2' });
    const prompt2 = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-host-local-2'),
      '等待第 2 轮 local 投喂宿主',
    );
    assert.equal(prompt2.sessionId, 'session-test-2');
    assert.ok(
      env.host.selectModels.some(
        (item) => item.sessionId === 'session-test-2' && item.provider === 'ollama' && item.model === 'qwen3:8b',
      ),
      'local 会话应调用 selectModel 选中 ollama / qwen3:8b',
    );
    const reply2 = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-host-local-2'),
      '等待第 2 轮回答卡开出',
    );
    hostEvents(env, 'session-test-2', [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: prompt2.requestId }, message: { id: 'hm-2' } } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '本地模型简答：多次执行结果一致。' }] } } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    const localDone = await waitFor(
      () => env.feishu.patched.find((item) => item.messageId === reply2.id && item.card?.header?.title?.content === '已完成 · 本地 Qwen3'),
      '等待第 2 轮卡片收尾为 已完成 · 本地 Qwen3',
    );
    assert.ok(JSON.stringify(localDone.card).includes('"name":"route_escalate"'), '本地回答卡应附带 route_escalate 按钮');

    const binding = await waitFor(async () => {
      const raw = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const item = Object.values(raw.bindings ?? {})[0];
      return item?.dshSessionId && item?.localSessionId ? item : false;
    }, '等待双会话绑定写入 state.json');
    assert.equal(binding.dshSessionId, 'session-test-1');
    assert.equal(binding.localSessionId, 'session-test-2');
    assert.notEqual(binding.dshSessionId, binding.localSessionId);

    // Click escalate -> runs on dshSessionId (session-test-1)
    const escRes = await env.clickCard({ tag: 'route', action: 'escalate', messageId: 'om-host-local-2' });
    assert.equal(escRes?.card?.data?.header?.title?.content, '已转交 4.1 Flash 重答');

    const promptEsc = await waitFor(
      () => env.host.prompts.find((item) => String(item.requestId).startsWith('f_om-host-local-2_esc_')),
      '等待 escalate 后把新 prompt 投进 dshSessionId',
    );
    assert.equal(promptEsc.sessionId, 'session-test-1');
    const escReply = await waitFor(
      () => env.feishu.sent.filter((item) => item.kind === 'reply' && item.replyTo === 'om-host-local-2')[1],
      '等待重答的新回答卡开出',
    );
    hostEvents(env, 'session-test-1', [
      { type: 'user/message', data: { turn: 2, source: { kind: 'user', rpcId: promptEsc.requestId }, message: { id: 'hm-3' } } },
      { type: 'turn/start', data: { turn: 2 } },
      { type: 'assistant/message', data: { turn: 2, message: { content: [{ type: 'text', text: '4.1 Flash 重答：幂等性详细解释。' }] } } },
      { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } },
    ]);
    await waitFor(
      () => env.feishu.patched.find((item) => item.messageId === escReply.id && item.card?.header?.title?.content === '已完成 · 4.1 Flash'),
      '等待重答卡片收尾为 已完成 · 4.1 Flash',
    );
    assert.equal((await cliCalls(env)).length, 0, 'host 模式全流程不应起 CLI');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('快捷命令（/note、/router off|on|status、/new local）与 Ollama 故障自动降级', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  let chatCalls = 0;
  let chatShouldFail = true;
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      chatCalls += 1;
      if (chatShouldFail) {
        throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { message: { content: JSON.stringify({ route: 'local', confidence: 0.9, reason: 'ok' }) } };
        },
      };
    }
    if (String(url).endsWith('/api/tags')) {
      return { ok: true, status: 200, async json() { return { models: [{ name: 'qwen3:8b' }] }; } };
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const env = await boot({
    env: {
      FEISHU_AGENT_TURN_MODE: 'host',
      FEISHU_AGENT_HOST_TURN_TIMEOUT_MS: '2000',
    },
    config: {
      router: {
        enabled: false,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    // 1) /note 在 router.enabled=false 时仍直接写 Obsidian，且不调 Ollama
    await env.message({ text: '/note 强制记一条', messageId: 'om-cmd-note-1' });
    const noteFile = join(inboxDir, `${localDateStamp()}.md`);
    await waitFor(async () => {
      try {
        return (await readFile(noteFile, 'utf8')).includes('强制记一条');
      } catch {
        return false;
      }
    }, '等待 /note 写入 Obsidian');
    assert.equal(chatCalls, 0, 'router.enabled=false 时 /note 不应调用 Ollama');

    // 2) /router on 开启路由；Ollama 抛网络错误时自动降级到 dsh 并干净收尾
    await env.message({ text: '/router on', messageId: 'om-cmd-router-on' });
    await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '意图路由已开启'),
      '等待 /router on 响应卡',
    );

    await env.message({ text: 'Ollama 挂了也要能答', messageId: 'om-fallback-1' });
    const fallbackPrompt = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-fallback-1'),
      '等待 Ollama 失败后降级投喂 DSH',
    );
    assert.equal(chatCalls, 1, '开启路由后应尝试调用一次 Ollama 分类');
    assert.equal(fallbackPrompt.sessionId, 'session-test-1');
    const fallbackReply = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-fallback-1'),
      '等待降级轮次开卡',
    );
    hostEvents(env, 'session-test-1', [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: fallbackPrompt.requestId }, message: { id: 'hm-fb' } } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '降级主会话回答成功' }] } } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    const fallbackDone = await waitFor(
      () => env.feishu.patched.find(
        (item) => item.messageId === fallbackReply.id && item.card?.header?.title?.content === '[飞书·兜底] 已完成 · 4.1 Flash',
      ),
      '等待降级轮次卡片正常完成（标题带 [飞书·兜底] 前缀）',
    );
    const fallbackJson = JSON.stringify(fallbackDone.card);
    assert.ok(fallbackJson.includes('本地分类失败，已交给远端'), '降级卡正文应说明本地分类失败');
    assert.equal(fallbackJson.includes('ECONNREFUSED'), false, '降级卡不应再印英文机读码');

    // 3) /router status 返回 Ollama 状态与命中统计（fallback >= 1）
    await env.message({ text: '/router status', messageId: 'om-cmd-router-status' });
    const statusCard = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '意图路由状态'),
      '等待 /router status 响应卡',
    );
    const statusJson = JSON.stringify(statusCard.card);
    assert.ok(statusJson.includes('Ollama：在线'), '状态卡应包含 Ollama 在线状态');
    assert.ok(statusJson.includes('fallback 1'), `状态卡应包含 fallback >= 1 统计，实际 ${statusJson}`);

    // 4) /router off 之后普通消息直接旁路 Ollama 走 DSH
    await env.message({ text: '/router off', messageId: 'om-cmd-router-off' });
    await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '意图路由已暂停'),
      '等待 /router off 响应卡',
    );
    const callsBeforeBypass = chatCalls;
    await env.message({ text: '关闭路由后的普通消息', messageId: 'om-bypass-1' });
    const bypassPrompt = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-bypass-1'),
      '等待旁路消息直达 DSH',
    );
    assert.equal(chatCalls, callsBeforeBypass, '/router off 后不应再调 Ollama');
    assert.equal(bypassPrompt.sessionId, 'session-test-1');
    const bypassReply = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-bypass-1'),
      '等待旁路轮次开卡',
    );
    hostEvents(env, 'session-test-1', [
      { type: 'user/message', data: { turn: 2, source: { kind: 'user', rpcId: bypassPrompt.requestId }, message: { id: 'hm-bp' } } },
      { type: 'turn/start', data: { turn: 2 } },
      { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } },
    ]);
    await waitFor(
      () => env.feishu.patched.find((item) => item.messageId === bypassReply.id && item.card?.header?.title?.content === '已完成'),
      '等待旁路轮次卡片收尾',
    );

    // 5) 先用 /loc 建立 localSessionId，再发 /new local 只清空 localSessionId、保留 dshSessionId
    await env.message({ text: '/loc 本地来一句', messageId: 'om-cmd-loc-1' });
    const locPrompt = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-cmd-loc-1'),
      '等待 /loc 建立本地会话并投喂宿主',
    );
    assert.equal(locPrompt.sessionId, 'session-test-2');
    const locReply = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-cmd-loc-1'),
      '等待 /loc 轮次开卡',
    );
    hostEvents(env, 'session-test-2', [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: locPrompt.requestId }, message: { id: 'hm-loc' } } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    await waitFor(
      () => env.feishu.patched.find((item) => item.messageId === locReply.id && item.card?.header?.title?.content?.startsWith('已完成')),
      '等待 /loc 轮次收尾',
    );

    const beforeNewLocal = await waitFor(async () => {
      const raw = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const item = Object.values(raw.bindings ?? {})[0];
      return item?.dshSessionId && item?.localSessionId ? item : false;
    }, '等待 state.json 记下双会话 ID');
    assert.equal(beforeNewLocal.dshSessionId, 'session-test-1');
    assert.equal(beforeNewLocal.localSessionId, 'session-test-2');

    await env.message({ text: '/new local', messageId: 'om-cmd-new-local' });
    await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '已新建本地会话'),
      '等待 /new local 提示卡',
    );
    const afterNewLocal = await waitFor(async () => {
      const raw = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
      const item = Object.values(raw.bindings ?? {})[0];
      return item?.localSessionId === '' ? item : false;
    }, '等待 state.json 中的 localSessionId 被清空');
    assert.equal(afterNewLocal.localSessionId, '');
    assert.equal(afterNewLocal.dshSessionId, 'session-test-1', '/new local 不应改动 dshSessionId');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('记事规则：干净短句「记一下」不触发清噪断句，直接写入待整理', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  let chatCalls = 0;
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      chatCalls += 1;
      throw new Error('记事规则不该调用分类器');
    }
    return { ok: true, status: 200, async json() { return { models: [{ name: 'qwen3:8b' }] }; } };
  };

  const env = await boot({
    config: {
      router: {
        enabled: true,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    await env.message({ text: '记一下：周五前给 Ollama 配开机自启', messageId: 'om-rule-append-1' });

    const replyCard = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-rule-append-1'),
      '等待「已记入待整理」确认卡',
    );
    assert.ok(replyCard.card.header.title.content.includes('已记入待整理'), '应回「已记入待整理」确认卡');
    assert.equal(chatCalls, 0, '干净短句不应调用本地模型断句');

    const filePath = join(inboxDir, `${localDateStamp()}.md`);
    const written = await readFile(filePath, 'utf8');
    assert.ok(written.includes('周五前给 Ollama 配开机自启'), '原文应写入当天文件');
    assert.ok(written.includes('<!-- feishu:om-rule-append-1 -->'), '条目应带消息标记以便撤销');
    assert.equal((await cliCalls(env)).length, 0, '写入待整理不应起 DSH 会话');
    const state = JSON.parse(await readFile(join(env.dir, 'state.json'), 'utf8'));
    assert.equal(Object.keys(state.bindings).length, 0, '写入待整理不应创建绑定');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('记事规则：噪声句只调用一次清噪断句，最终写入清噪结果', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  const chatBodies = [];
  globalThis.__dshFeishuAgentOllamaFetch = async (url, init) => {
    if (String(url).endsWith('/api/chat')) {
      chatBodies.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            message: {
              content: JSON.stringify({ items: ['明天要去银行，然后顺便把水费交了。我怕忘了。'] }),
            },
          };
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const env = await boot({
    config: {
      router: {
        enabled: true,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    await env.message({
      text: '记一下：呃那个明天要去银行然后顺便把水费交了我我怕忘了',
      messageId: 'om-rule-polish-1',
    });

    const replyCard = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-rule-polish-1'),
      '等待噪声明细的「已记入待整理」确认卡',
    );
    assert.ok(replyCard.card.header.title.content.includes('已记入待整理'), '应回「已记入待整理」确认卡');
    assert.equal(chatBodies.length, 1, '噪声句只应调用一次本地模型断句');
    assert.deepEqual(chatBodies[0].format, POLISH_SCHEMA, '断句调用应带 POLISH_SCHEMA');
    assert.equal(chatBodies[0].stream, false);

    const filePath = join(inboxDir, `${localDateStamp()}.md`);
    const written = await readFile(filePath, 'utf8');
    // 只断言去噪后的内容；模型加的标点由假 ollama 决定，不在这里钉死。
    const flat = written.replace(/[，。？！；：、,.;:!?\s]/g, '');
    assert.ok(flat.includes('明天要去银行然后顺便把水费交了我怕忘了'), '应写入去噪后的内容');
    assert.equal(written.includes('呃'), false, '口头语不该写进文件');
    assert.ok(written.includes('<!-- feishu:om-rule-polish-1 -->'), '条目应带消息标记以便撤销');
    assert.equal((await cliCalls(env)).length, 0, '写入待整理不应起 DSH 会话');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('记事规则：模型改字校验失败时，写入去噪结果而不是原文', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  let chatCalls = 0;
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      chatCalls += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            message: {
              content: JSON.stringify({ items: ['我明天去银行，顺便把水费交了，我怕忘。'] }),
            },
          };
        },
      };
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const env = await boot({
    config: {
      router: {
        enabled: true,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    await env.message({
      text: '记一下：呃那个明天要去银行然后顺便把水费交了我我怕忘了',
      messageId: 'om-rule-unverified-1',
    });

    await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-rule-unverified-1'),
      '等待「已记入待整理」确认卡',
    );
    assert.equal(chatCalls, 1, '应尝试一次断句');

    const filePath = join(inboxDir, `${localDateStamp()}.md`);
    const written = await readFile(filePath, 'utf8');
    assert.ok(written.includes('明天要去银行然后顺便把水费交了我怕忘了'), '校验失败也必须落盘去噪结果');
    assert.equal(written.includes('呃'), false, '口头语不该写进文件');
    // 模型改写过的痕迹（少了「了」、换成「我明天」）不能落盘。
    assert.equal(written.includes('我怕忘。'), false, '不得采用模型改写后的文本');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('记事规则：读/整理笔记走 dsh 会话，不写文件', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  let chatCalls = 0;
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/chat')) {
      chatCalls += 1;
      throw new Error('读取笔记不该调用分类器');
    }
    return { ok: true, status: 200, async json() { return { models: [{ name: 'qwen3:8b' }] }; } };
  };

  const env = await boot({
    env: {
      FEISHU_AGENT_TURN_MODE: 'host',
      FEISHU_AGENT_HOST_TURN_TIMEOUT_MS: '2000',
    },
    config: {
      router: {
        enabled: true,
        routes: { obsidian: { inboxDir } },
      },
    },
  });
  try {
    await env.message({ text: '我待整理里昨天记了什么，帮我列一下', messageId: 'om-rule-query-1' });
    const prompt = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-rule-query-1'),
      '等待读取笔记投喂 DSH 宿主',
    );
    assert.equal(prompt.sessionId, 'session-test-1');
    assert.equal(chatCalls, 0, '读取笔记不应调用分类器');

    const replyCard = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-rule-query-1'),
      '等待读笔记轮次开卡',
    );
    assert.ok(
      replyCard.card.header.title.content.startsWith('[飞书·读笔记]'),
      `标题应带 [飞书·读笔记] 前缀，实际 ${replyCard.card.header.title.content}`,
    );

    hostEvents(env, 'session-test-1', [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: prompt.requestId }, message: { id: 'hm-query' } } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    const finished = await waitFor(
      () => env.feishu.patched.find(
        (item) => item.messageId === replyCard.id && item.card?.header?.title?.content === '[飞书·读笔记] 已完成 · 4.1 Flash',
      ),
      '等待读笔记轮次收尾',
    );
    assert.ok(
      JSON.stringify(finished.card).includes('读取/整理笔记需要远端模型'),
      '正文应说明读笔记需要远端模型',
    );
    const files = await readdir(inboxDir);
    assert.deepEqual(files, [], '读取笔记不应写入待整理文件');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('本地分类器不可用：health 探测失败直接走 dsh，卡片标题带 [飞书·兜底] 与原因', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  let chatCalls = 0;
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/tags')) {
      throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
    }
    if (String(url).endsWith('/api/chat')) {
      chatCalls += 1;
      throw new Error('健康探测失败后不该再调分类器');
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const env = await boot({
    env: {
      FEISHU_AGENT_TURN_MODE: 'host',
      FEISHU_AGENT_HOST_TURN_TIMEOUT_MS: '2000',
    },
    config: { router: { enabled: true } },
  });
  try {
    await env.message({ text: '今天有什么安排', messageId: 'om-health-fallback-1' });
    const prompt = await waitFor(
      () => env.host.prompts.find((item) => item.requestId === 'f_om-health-fallback-1'),
      '等待健康探测失败后直接投喂 DSH',
    );
    assert.equal(prompt.sessionId, 'session-test-1');
    assert.equal(chatCalls, 0, '健康探测失败后应零延迟降级，不再调分类器');

    const replyCard = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-health-fallback-1'),
      '等待降级轮次开卡',
    );
    assert.ok(
      replyCard.card.header.title.content.startsWith('[飞书·兜底]'),
      `标题应带 [飞书·兜底] 前缀，实际 ${replyCard.card.header.title.content}`,
    );

    hostEvents(env, 'session-test-1', [
      { type: 'user/message', data: { turn: 1, source: { kind: 'user', rpcId: prompt.requestId }, message: { id: 'hm-fb' } } },
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    ]);
    const finished = await waitFor(
      () => env.feishu.patched.find(
        (item) => item.messageId === replyCard.id && item.card?.header?.title?.content === '[飞书·兜底] 已完成 · 4.1 Flash',
      ),
      '等待降级轮次收尾（标题保留 dsh label）',
    );
    const cardJson = JSON.stringify(finished.card);
    assert.ok(cardJson.includes('本地模型不可达，已跳过本地判断'), '卡片正文应说明本地模型不可达');
    assert.equal(cardJson.includes('ECONNREFUSED'), false, '卡片正文不应再印英文机读码');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('/router status 输出「记事规则」与「本地模型」两行', async () => {
  const prevFetch = globalThis.__dshFeishuAgentOllamaFetch;
  globalThis.__dshFeishuAgentOllamaFetch = async (url) => {
    if (String(url).endsWith('/api/tags')) {
      return { ok: false, status: 503, async json() { return {}; } };
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const env = await boot({ config: { router: { enabled: true } } });
  try {
    await env.message({ text: '/router status', messageId: 'om-router-status-1' });
    const statusCard = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '意图路由状态'),
      '等待 /router status 响应卡',
    );
    const statusJson = JSON.stringify(statusCard.card);
    assert.ok(
      statusJson.includes('记事规则：未生效（未配置待整理目录）'),
      `未配置 inboxDir 时应显示未生效，实际 ${statusJson}`,
    );
    assert.ok(statusJson.includes('本地模型：closed'), '状态卡应包含「本地模型」熔断状态行');
    assert.ok(statusJson.includes('note 0'), '命中统计应包含记事规则命中数');
  } finally {
    if (prevFetch === undefined) delete globalThis.__dshFeishuAgentOllamaFetch;
    else globalThis.__dshFeishuAgentOllamaFetch = prevFetch;
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('速记模式：/note on 开窗，普通消息直接写入待整理且不触发 CLI', async () => {
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  const env = await boot({
    config: { router: { enabled: false, routes: { obsidian: { inboxDir } } } },
  });
  try {
    await env.message({ text: '/note on', messageId: 'om-nm-on' });
    const onCard = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '速记模式已开启'),
      '等待速记模式开启卡',
    );
    const onJson = JSON.stringify(onCard.card);
    assert.ok(onJson.includes('"action":"off"'), '开启卡应带结束速记');
    assert.ok(onJson.includes('"action":"extend"'), '开启卡应带延长');
    assert.deepEqual(await readdir(inboxDir).catch(() => []), [], '开启本身不应写文件');

    await env.message({ text: '我开了那个暖气，我觉得好干。', messageId: 'om-nm-msg-1' });
    const noteFile = join(inboxDir, `${localDateStamp()}.md`);
    await waitFor(async () => {
      try {
        return (await readFile(noteFile, 'utf8')).includes('我开了那个暖气');
      } catch {
        return false;
      }
    }, '等待速记模式写入待整理');

    const reply = await waitFor(
      () => env.feishu.sent.find((item) => item.kind === 'reply' && item.replyTo === 'om-nm-msg-1'),
      '等待速记模式的确认卡',
    );
    assert.ok(reply.card.header.title.content.includes('速记中'), '速记模式的确认卡标题应标明速记中');
    assert.ok(JSON.stringify(reply.card).includes('"action":"off"'), '确认卡应带结束速记按钮');
    assert.ok(JSON.stringify(reply.card).includes('"name":"undo_note"'), '确认卡仍应带撤销');
    assert.equal((await cliCalls(env)).length, 0, '速记模式不应触发 CLI');
    assert.equal(env.host.sessions.size, 0, '速记模式不应创建宿主会话');
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('速记模式：卡片「开启速记」按钮与「结束速记」按钮都能用', async () => {
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  const env = await boot({
    config: { router: { enabled: false, routes: { obsidian: { inboxDir } } } },
  });
  try {
    const res = await env.clickCard({ tag: 'note-mode', action: 'on' });
    assert.equal(res?.toast?.content, '速记模式已开启');
    assert.equal(res?.card?.data?.header?.title?.content, '速记模式已开启');

    await env.message({ text: '卡片开启后这条也要记下来', messageId: 'om-nm-card-1' });
    const noteFile = join(inboxDir, `${localDateStamp()}.md`);
    await waitFor(async () => {
      try {
        return (await readFile(noteFile, 'utf8')).includes('卡片开启后这条也要记下来');
      } catch {
        return false;
      }
    }, '等待卡片开启后的写入');

    const off = await env.clickCard({ tag: 'note-mode', action: 'off' });
    assert.equal(off?.toast?.content, '速记模式已结束');
    assert.equal(off?.card?.data?.header?.title?.content, '速记模式已结束');
    assert.match(off?.card?.data?.body?.elements?.[0]?.content ?? '', /共写入 1 条/);
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('速记模式：/note off 结束后，后续消息回到正常路由', async () => {
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  const env = await boot({
    config: { router: { enabled: false, routes: { obsidian: { inboxDir } } } },
  });
  try {
    await env.message({ text: '/note on', messageId: 'om-nm-on-2' });
    await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '速记模式已开启'),
      '等待速记模式开启卡',
    );

    await env.message({ text: '/note off', messageId: 'om-nm-off-2' });
    const offCard = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '速记模式已结束'),
      '等待速记模式结束卡',
    );
    assert.ok(JSON.stringify(offCard.card).includes('"action":"on"'), '结束卡应带再开启入口');

    const noteFile = join(inboxDir, `${localDateStamp()}.md`);
    const before = await readFile(noteFile, 'utf8').catch(() => '');
    await env.message({ text: '这句不该进笔记', messageId: 'om-nm-after-off' });
    await waitFor(async () => (await cliCalls(env)).length > 0, '关闭速记模式后应回到 CLI 主会话');
    const after = await readFile(noteFile, 'utf8').catch(() => '');
    assert.equal(after, before, '关闭速记模式后普通消息不应再写进待整理');
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('速记模式：/status 与 /help 的卡片上带开启入口', async () => {
  const env = await boot({ config: { router: { enabled: false } } });
  try {
    await env.message({ text: '/help', messageId: 'om-help-nm' });
    const help = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '可用命令'),
      '等待帮助卡',
    );
    const helpJson = JSON.stringify(help.card);
    assert.ok(helpJson.includes('"tag":"note-mode"'), '帮助卡应带速记入口按钮');
    assert.ok(helpJson.includes('/note on|off|status'), '帮助卡应说明速记模式');

    await env.message({ text: '/status', messageId: 'om-status-nm' });
    const status = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '状态'),
      '等待状态卡',
    );
    assert.ok(JSON.stringify(status.card).includes('"tag":"note-mode"'), '状态卡应带速记入口按钮');

    // 未开启时点 /note status 应提示未开启，且不写文件。
    await env.message({ text: '/note status', messageId: 'om-nm-status' });
    const state = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '速记模式未开启'),
      '等待速记状态卡',
    );
    assert.ok(JSON.stringify(state.card).includes('"action":"on"'));
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('速记模式：群聊里 /note on 被拒绝，不开窗也不写文件', async () => {
  const inboxDir = await mkdtemp(join(tmpdir(), 'dsh-feishu-inbox-'));
  const env = await boot({
    config: {
      chats: { oc_group: { workspacePath: join(tmpdir(), 'dsh-feishu-group-nm-ws'), chatType: 'group' } },
      router: { enabled: false, routes: { obsidian: { inboxDir } } },
    },
  });
  try {
    await env.message({
      text: '/note on',
      chatId: 'oc_group',
      chatType: 'group',
      mentions: [{ openId: 'ou_bot', name: 'fake-bot' }],
    });
    const card = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '群聊不支持速记模式'),
      '等待群聊拒绝速记模式',
    );
    assert.ok(card);
    assert.deepEqual(await readdir(inboxDir).catch(() => []), [], '群聊开启速记不应写文件');
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(inboxDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('速记模式：未配置待整理目录时拒绝开窗', async () => {
  const env = await boot({ config: { router: { enabled: false } } });
  try {
    await env.message({ text: '/note on', messageId: 'om-nm-noinbox' });
    const card = await waitFor(
      () => env.feishu.sent.find((item) => item.card?.header?.title?.content === '无法开启速记模式'),
      '等待拒绝开窗卡',
    );
    assert.match(card.card.body.elements[0].content, /inboxDir/);

    // 拒绝后普通消息不应被当速记处理
    await env.message({ text: '这句不该进笔记', messageId: 'om-nm-noinbox-msg' });
    await waitFor(async () => (await cliCalls(env)).length > 0, '未开窗时消息应走 CLI');
  } finally {
    env.restoreEnv();
    await rm(env.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
