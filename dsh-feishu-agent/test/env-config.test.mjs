/** 离线用例：环境变量配置的解析与分层合并。 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { composeChats, readEnvConfig, ENV_NAMES } from '../lib/core/env-config.js';

/** 收日志的假 logger。 */
function createLogger() {
  const lines = [];
  return {
    lines,
    info: (line) => lines.push(['info', line]),
    warn: (line) => lines.push(['warn', line]),
  };
}

test('readEnvConfig：一个变量都没设置时字段全是 undefined', () => {
  assert.deepEqual(readEnvConfig({}), {
    ownerOpenId: undefined,
    chats: undefined,
    defaultChat: undefined,
    answerConcurrency: undefined,
  });
});

test('readEnvConfig：平铺默认值合成 defaultChat，空白值算没写', () => {
  const config = readEnvConfig({
    [ENV_NAMES.defaultWorkspace]: '  /tmp/ws  ',
    [ENV_NAMES.defaultTitlePrefix]: '',
    [ENV_NAMES.defaultPermissionPreset]: 'read-only',
    [ENV_NAMES.defaultAgentPreset]: 'standard',
  });
  assert.deepEqual(config.defaultChat, {
    workspacePath: '/tmp/ws',
    permissionPreset: 'read-only',
    agentPreset: 'standard',
  });
});

test('readEnvConfig：owner 去空白', () => {
  assert.equal(readEnvConfig({ [ENV_NAMES.ownerOpenId]: ' ou_x ' }).ownerOpenId, 'ou_x');
});

test('readEnvConfig：FEISHU_AGENT_CHATS 按 chat_id 解析，非对象项跳过', () => {
  const logger = createLogger();
  const config = readEnvConfig(
    {
      [ENV_NAMES.chats]: JSON.stringify({
        oc_a: { workspacePath: '/tmp/a' },
        oc_bad: 'not-an-object',
        oc_arr: [],
      }),
    },
    logger,
  );
  assert.deepEqual(config.chats, { oc_a: { workspacePath: '/tmp/a' } });
  assert.ok(logger.lines.some(([level, text]) => level === 'warn' && text.includes('oc_bad')));
  assert.ok(logger.lines.some(([level, text]) => level === 'warn' && text.includes('oc_arr')));
});

test('readEnvConfig：chats JSON 写坏时告警并忽略，不抛错', () => {
  const logger = createLogger();
  assert.equal(readEnvConfig({ [ENV_NAMES.chats]: '{oops' }, logger).chats, undefined);
  assert.equal(readEnvConfig({ [ENV_NAMES.chats]: '[]' }, logger).chats, undefined);
  assert.equal(logger.lines.filter(([level]) => level === 'warn').length, 2);
  // 空对象等于「没配」，不算错误，不该刷告警。
  const before = logger.lines.length;
  assert.equal(readEnvConfig({ [ENV_NAMES.chats]: '{}' }, logger).chats, undefined);
  assert.equal(logger.lines.length, before);
});

test('readEnvConfig：并发只接受 ≥ 1 的整数', () => {
  const logger = createLogger();
  assert.equal(readEnvConfig({ [ENV_NAMES.answerConcurrency]: '5' }).answerConcurrency, 5);
  assert.equal(readEnvConfig({ [ENV_NAMES.answerConcurrency]: '0' }, logger).answerConcurrency, undefined);
  assert.equal(readEnvConfig({ [ENV_NAMES.answerConcurrency]: '2.5' }, logger).answerConcurrency, undefined);
  assert.equal(readEnvConfig({ [ENV_NAMES.answerConcurrency]: 'abc' }, logger).answerConcurrency, undefined);
  assert.ok(logger.lines.every(([level]) => level === 'warn'));
});

test('composeChats：bundle → 本机 → 环境变量逐键覆盖', () => {
  const envConfig = readEnvConfig({
    [ENV_NAMES.chats]: JSON.stringify({
      oc_a: { workspacePath: '/tmp/from-env' },
      oc_only_env: { workspacePath: '/tmp/only-env' },
    }),
  });
  const chats = composeChats(
    { oc_a: { workspacePath: '/tmp/from-bundle' }, oc_b: { workspacePath: '/tmp/b' } },
    { oc_a: { workspacePath: '/tmp/from-local' } },
    envConfig,
  );
  assert.deepEqual(chats.oc_a, { workspacePath: '/tmp/from-env' });
  assert.deepEqual(chats.oc_b, { workspacePath: '/tmp/b' });
  assert.deepEqual(chats.oc_only_env, { workspacePath: '/tmp/only-env' });
});

test('composeChats：defaultChat 合并进 `*`，只覆盖给出的字段', () => {
  const envConfig = readEnvConfig({
    [ENV_NAMES.defaultWorkspace]: '/tmp/default-ws',
    [ENV_NAMES.defaultPermissionPreset]: 'read-only',
  });
  const chats = composeChats(
    { '*': { workspacePath: '/tmp/placeholder', titlePrefix: '[飞书]', permissionPreset: 'workspace-write' } },
    {},
    envConfig,
  );
  assert.deepEqual(chats['*'], {
    workspacePath: '/tmp/default-ws',
    titlePrefix: '[飞书]',
    permissionPreset: 'read-only',
  });
});

test('composeChats：没有默认值时不动 `*`，缺配置就是空对象', () => {
  assert.deepEqual(composeChats({ '*': { workspacePath: '/tmp/x' } }, {}, readEnvConfig({})), {
    '*': { workspacePath: '/tmp/x' },
  });
  assert.deepEqual(composeChats(undefined, undefined, readEnvConfig({})), {});
});
