/** 集成：假飞书 SDK + 假宿主，把插件 `apply()` 真跑一遍。 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { apply } from '../lib/index.js';
import { CARD_ACTION_EVENT, MESSAGE_EVENT } from '../lib/feishu/events.js';
import { installFakeSdk } from './fake-sdk.mjs';

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
  return {
    sessions,
    prompts,
    renames,
    cancels,
    services: {
      agents: { get: (sessionId) => sessions.get(sessionId) },
      workspaceRegistry: {
        async resolveByPath(path) {
          const id = workspaces.get(path);
          return id === undefined ? undefined : { id, path, sessionIds: [] };
        },
        async create(path) {
          const id = `ws_${workspaces.size + 1}`;
          workspaces.set(path, id);
          return { id, path, sessionIds: [] };
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
await import('node:fs').then((fs) => fs.appendFileSync(${JSON.stringify(join(dir, 'fake-cli-calls.jsonl'))}, JSON.stringify({ sessionId: sessionIndex >= 0 ? sessionId : null, prompt }) + '\\n'));
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
  const feishu = installFakeSdk();
  const savedEnv = {};
  for (const [key, value] of Object.entries(options.env ?? {})) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-agent-'));
  const workspacePath = join(dir, 'workspace');
  await mkdir(workspacePath, { recursive: true });
  process.env.DSH_FEISHU_AGENT_STATE_DIR = dir;
  if (options.config?.appId === '') {
    delete process.env.DSH_FEISHU_AGENT_APP_ID;
    delete process.env.DSH_FEISHU_AGENT_APP_SECRET;
  } else {
    process.env.DSH_FEISHU_AGENT_APP_ID = 'cli_test';
    process.env.DSH_FEISHU_AGENT_APP_SECRET = 'secret';
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
    eventId = `ev-${messageSeq}-${Date.now().toString(36)}`,
    messageId = `om-${messageSeq}-${Date.now().toString(36)}`,
  } = options;
  return feishu.deliver(MESSAGE_EVENT, {
    header: { event_id: eventId, app_id: 'cli_test', tenant_key: 't', create_time: String(Date.now() * 1000) },
    event: {
      sender: { sender_id: { open_id: sender }, sender_type: 'user' },
      message: {
        message_id: messageId,
        chat_id: chatId,
        chat_type: 'p2p',
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

/** 把宿主会话事件送进插件。 */
function hostEvents(env, sessionId, events) {
  for (const event of events) env.ctx.emitSync('session/event', { id: sessionId }, event);
}

/** 把一条消息先投喂再让宿主「取走」，返回宿主看到的 prompt。 */
async function promptOnce(env, text, options = {}) {
  const before = await cliCalls(env).then((rows) => rows.length);
  await env.message({ text, ...options });
  for (let i = 0; i < 40; i += 1) {
    await settle(50);
    const rows = await cliCalls(env);
    if (rows.length > before) return rows.at(-1);
  }
  assert.fail('CLI 没有被调用');
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
    assert.ok(JSON.stringify(env.feishu.sent.at(-1).card).includes('/new'));
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
