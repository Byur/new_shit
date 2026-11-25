/** 离线用例：`.env` 解析、加载与路径解析（不联网、不依赖宿主）。 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  findProjectRoot,
  isPluginEnvKey,
  loadEnvFile,
  parseEnvFile,
} from '../lib/common/env-file.js';
import { resolveEnvFiles } from '../lib/index.js';

/** 测试用的宽松接纳：检查解析行为时不受键名过滤影响。 */
const acceptAll = () => true;

test('parseEnvFile：基本键值、注释与空行', () => {
  const parsed = parseEnvFile(['# 注释', '', 'A=1', 'B = two ', '   # 缩进注释'].join('\n'));
  assert.deepEqual(parsed, { A: '1', B: 'two' });
});

test('parseEnvFile：export 前缀、引号与转义', () => {
  const parsed = parseEnvFile(
    ['export A=1', `B="x y"`, `C='x y'`, `D="line\\nnext"`, `E="quote\\""`].join('\n'),
  );
  assert.deepEqual(parsed, { A: '1', B: 'x y', C: 'x y', D: 'line\nnext', E: 'quote"' });
});

test('parseEnvFile：未加引号的值只截掉 ` #` 之后的注释', () => {
  const parsed = parseEnvFile(['A=value # comment', 'B=a#b', 'C="a#b"'].join('\n'));
  assert.deepEqual(parsed, { A: 'value', B: 'a#b', C: 'a#b' });
});

test('parseEnvFile：值里带等号、空值、重复键取最后一个', () => {
  const parsed = parseEnvFile(['A=base64==', 'B=', 'C=1', 'C=2'].join('\n'));
  assert.deepEqual(parsed, { A: 'base64==', B: '', C: '2' });
});

test('parseEnvFile：跳过非法行、兼容 BOM 与 CRLF', () => {
  const parsed = parseEnvFile('\uFEFFA=1\r\n没有等号\r\n=2\r\n3B=4\r\nC=5\r\n');
  assert.deepEqual(parsed, { A: '1', C: '5' });
});

test('parseEnvFile：引号没闭合时按普通文本处理，不吞掉后面的内容', () => {
  const parsed = parseEnvFile('A="unterminated');
  assert.deepEqual(parsed, { A: '"unterminated' });
});

test('isPluginEnvKey：认自己的名字空间与 provider key，其它一律不认', () => {
  assert.equal(isPluginEnvKey('FEISHU_AGENT_APP_ID'), true);
  for (const key of ['DEEPSEEK_API_KEY', 'ZENMUX_API_KEY', 'OPENAI_API_KEY']) {
    assert.equal(isPluginEnvKey(key), true, key);
  }
  // 退役的 CoDePlan 键既不读，也不该被当成 provider key 放进来。
  for (const key of ['CODEPLAN_API_KEY', 'CLOUDFLARE_AUTH_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'DSH_HOME', 'DEEPSEEK_API_KEY_BACKUP']) {
    assert.equal(isPluginEnvKey(key), false, key);
  }
});

test('loadEnvFile：只补没设置的键，并报告被真实环境覆盖的键', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-env-'));
  const file = join(dir, '.env');
  await writeFile(file, 'ENV_FILE_TEST_NEW=from-file\nENV_FILE_TEST_KEPT=from-file\n', 'utf8');

  process.env.ENV_FILE_TEST_KEPT = 'from-real-env';
  delete process.env.ENV_FILE_TEST_NEW;
  try {
    const result = await loadEnvFile(file, undefined, { accept: acceptAll });
    assert.equal(process.env.ENV_FILE_TEST_NEW, 'from-file');
    assert.equal(process.env.ENV_FILE_TEST_KEPT, 'from-real-env');
    assert.deepEqual(result.loaded, ['ENV_FILE_TEST_NEW']);
    assert.deepEqual(result.skipped, ['ENV_FILE_TEST_KEPT']);
  } finally {
    delete process.env.ENV_FILE_TEST_NEW;
    delete process.env.ENV_FILE_TEST_KEPT;
  }
});

test('loadEnvFile：留空的键按未设置处理，不写进 process.env', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-env-'));
  const file = join(dir, '.env');
  await writeFile(file, 'ENV_FILE_TEST_EMPTY=\n', 'utf8');
  delete process.env.ENV_FILE_TEST_EMPTY;
  try {
    const result = await loadEnvFile(file, undefined, { accept: acceptAll });
    assert.equal(process.env.ENV_FILE_TEST_EMPTY, undefined);
    assert.deepEqual(result.empty, ['ENV_FILE_TEST_EMPTY']);
    assert.deepEqual(result.loaded, []);
  } finally {
    delete process.env.ENV_FILE_TEST_EMPTY;
  }
});

test('loadEnvFile：DSH_ 这类 bootstrap 名字单独告警（dsh 会拒绝整份 .env）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-env-'));
  const file = join(dir, '.env');
  await writeFile(file, 'DSH_FEISHU_AGENT_APP_ID=bad\nFEISHU_AGENT_TEST_OK=ok\n', 'utf8');
  const lines = [];
  const logger = { info: (line) => lines.push(line), warn: (line) => lines.push(line) };
  delete process.env.FEISHU_AGENT_TEST_OK;
  const hadLegacy = process.env.DSH_FEISHU_AGENT_APP_ID;
  delete process.env.DSH_FEISHU_AGENT_APP_ID;
  try {
    const result = await loadEnvFile(file, logger);
    assert.deepEqual(result.bootstrap, ['DSH_FEISHU_AGENT_APP_ID']);
    assert.equal(process.env.DSH_FEISHU_AGENT_APP_ID, undefined, '旧名字不该从文件里生效');
    assert.equal(process.env.FEISHU_AGENT_TEST_OK, 'ok');
    assert.ok(lines.some((line) => line.includes('dsh 拒绝项目 .env')));
  } finally {
    delete process.env.FEISHU_AGENT_TEST_OK;
    if (hadLegacy !== undefined) process.env.DSH_FEISHU_AGENT_APP_ID = hadLegacy;
  }
});

test('loadEnvFile：默认只把插件的键和 provider key 读进环境', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-env-'));
  const file = join(dir, '.env');
  await writeFile(
    file,
    'CLOUDFLARE_AUTH_TOKEN=other-tool\nFEISHU_AGENT_TEST_ONLY=ok\nDEEPSEEK_API_KEY=provider\n',
    'utf8',
  );
  delete process.env.FEISHU_AGENT_TEST_ONLY;
  delete process.env.DEEPSEEK_API_KEY;
  const hadCloudflare = process.env.CLOUDFLARE_AUTH_TOKEN;
  try {
    const result = await loadEnvFile(file, undefined);
    assert.equal(process.env.FEISHU_AGENT_TEST_ONLY, 'ok');
    assert.equal(process.env.DEEPSEEK_API_KEY, 'provider');
    assert.equal(process.env.CLOUDFLARE_AUTH_TOKEN, hadCloudflare, '无关的键不该被读进来');
    assert.deepEqual(result.ignored, ['CLOUDFLARE_AUTH_TOKEN']);
  } finally {
    delete process.env.FEISHU_AGENT_TEST_ONLY;
    delete process.env.DEEPSEEK_API_KEY;
  }
});

test('loadEnvFile：文件缺失不抛错，返回空结果', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-env-'));
  const result = await loadEnvFile(join(dir, 'missing.env'), undefined);
  assert.deepEqual(result.loaded, []);
  assert.deepEqual(result.skipped, []);
  assert.equal(result.file, join(dir, 'missing.env'));
});

test('loadEnvFile：日志里只有键名，没有值', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-env-'));
  const file = join(dir, '.env');
  await writeFile(file, 'FEISHU_AGENT_TEST_LOGGED=s3cret-value\n', 'utf8');
  const lines = [];
  const logger = {
    info: (line) => lines.push(line),
    warn: (line) => lines.push(line),
  };
  delete process.env.FEISHU_AGENT_TEST_LOGGED;
  try {
    await loadEnvFile(file, logger);
    assert.ok(lines.some((line) => line.includes('FEISHU_AGENT_TEST_LOGGED')));
    assert.ok(!lines.some((line) => line.includes('s3cret-value')));
  } finally {
    delete process.env.FEISHU_AGENT_TEST_LOGGED;
  }
});

test('findProjectRoot：找到最近的有 .git 的那一层', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-feishu-root-'));
  await mkdir(join(root, '.git'));
  const nested = join(root, 'a', 'b');
  await mkdir(nested, { recursive: true });
  assert.equal(findProjectRoot(nested), root);
});

test('resolveEnvFiles：默认先项目根、再插件包目录', () => {
  const saved = process.env.FEISHU_AGENT_ENV_FILE;
  delete process.env.FEISHU_AGENT_ENV_FILE;
  try {
    const files = resolveEnvFiles();
    // 用例文件在 test/ 下一层：`../` 是插件包根，`../../` 是仓库根。
    assert.equal(files[0], fileURLToPath(new URL('../../.env', import.meta.url)));
    assert.equal(files[1], fileURLToPath(new URL('../.env', import.meta.url)));
  } finally {
    if (saved !== undefined) process.env.FEISHU_AGENT_ENV_FILE = saved;
  }
});

test('resolveEnvFiles：FEISHU_AGENT_ENV_FILE 给了就只读它', () => {
  const saved = process.env.FEISHU_AGENT_ENV_FILE;
  process.env.FEISHU_AGENT_ENV_FILE = 'tmp/custom.env';
  try {
    assert.deepEqual(resolveEnvFiles(), [resolve('tmp/custom.env')]);
  } finally {
    if (saved !== undefined) process.env.FEISHU_AGENT_ENV_FILE = saved;
    else delete process.env.FEISHU_AGENT_ENV_FILE;
  }
});
