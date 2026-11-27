/** env 文件读取：只补未设置的键，不把别的工具密钥带进进程环境。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {loadEnvFile, parseEnvFile, resolveEnvFiles} from '../src/env-file.ts';

/** 备份一组环境变量。 */
function snapshotEnv(keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test('parseEnvFile supports export, quotes and trailing comments', () => {
  const parsed = parseEnvFile(
    [
      '# comment',
      'PLAIN=value',
      'export SPACED = "a b"',
      "SINGLE='literal # not a comment'",
      'TRAILING=value # comment',
      'EMPTY=',
      'not a pair',
    ].join('\n'),
  );
  assert.equal(parsed.PLAIN, 'value');
  assert.equal(parsed.SPACED, 'a b');
  assert.equal(parsed.SINGLE, 'literal # not a comment');
  assert.equal(parsed.TRAILING, 'value');
  assert.equal(parsed.EMPTY, '');
  assert.equal(parsed['not a pair'], undefined);
});

test('loadEnvFile fills only missing keys and rejects unrelated secrets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ch-env-'));
  const file = path.join(dir, '.env');
  await writeFile(
    file,
    [
      'FEISHU_AGENT_APP_ID=from_file',
      'FEISHU_AGENT_APP_SECRET="from file"',
      'FEISHU_AGENT_DEFAULT_WORKSPACE=',
      'DEEPSEEK_API_KEY=sk-file',
      'CLOUDFLARE_AUTH_TOKEN=should-not-load',
      'DSH_FEISHU_AGENT_APP_ID=legacy',
    ].join('\n'),
  );

  const keys = [
    'FEISHU_AGENT_APP_ID',
    'FEISHU_AGENT_APP_SECRET',
    'FEISHU_AGENT_DEFAULT_WORKSPACE',
    'DEEPSEEK_API_KEY',
    'CLOUDFLARE_AUTH_TOKEN',
    'DSH_FEISHU_AGENT_APP_ID',
  ];
  const saved = snapshotEnv(keys);
  try {
    process.env.FEISHU_AGENT_APP_ID = 'from_env';
    delete process.env.FEISHU_AGENT_APP_SECRET;
    delete process.env.FEISHU_AGENT_DEFAULT_WORKSPACE;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.CLOUDFLARE_AUTH_TOKEN;
    delete process.env.DSH_FEISHU_AGENT_APP_ID;

    const result = await loadEnvFile(file);

    assert.equal(process.env.FEISHU_AGENT_APP_ID, 'from_env', '真实环境变量优先');
    assert.equal(process.env.FEISHU_AGENT_APP_SECRET, 'from file', '文件里的值补空位');
    assert.equal(process.env.DEEPSEEK_API_KEY, 'sk-file');
    assert.equal(process.env.CLOUDFLARE_AUTH_TOKEN, undefined, '别的工具密钥不应载入');
    assert.equal(process.env.DSH_FEISHU_AGENT_APP_ID, undefined, 'DSH_ 前缀应被拒绝');
    assert.equal(process.env.FEISHU_AGENT_DEFAULT_WORKSPACE, undefined, '留空按未设置处理');
    assert.deepEqual(result.skipped, ['FEISHU_AGENT_APP_ID']);
    assert.ok(result.loaded.includes('FEISHU_AGENT_APP_SECRET'));
    assert.ok(result.ignored.includes('CLOUDFLARE_AUTH_TOKEN'));
    assert.ok(result.rejected.includes('DSH_FEISHU_AGENT_APP_ID'));
    assert.ok(result.empty.includes('FEISHU_AGENT_DEFAULT_WORKSPACE'));
  } finally {
    restoreEnv(saved);
    await rm(dir, {recursive: true, force: true});
  }
});

test('resolveEnvFiles honors CONTEXT_HUB_ENV_FILE override', async () => {
  const saved = process.env.CONTEXT_HUB_ENV_FILE;
  try {
    process.env.CONTEXT_HUB_ENV_FILE = '/tmp/context-hub-custom.env';
    assert.deepEqual(resolveEnvFiles(), ['/tmp/context-hub-custom.env']);
  } finally {
    if (saved === undefined) delete process.env.CONTEXT_HUB_ENV_FILE;
    else process.env.CONTEXT_HUB_ENV_FILE = saved;
  }
});
