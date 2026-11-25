/** 项目本地的 `.env` 读取：零依赖，只支持够用的一小撮语法。 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * 插件认的环境变量统一前缀。
 *
 * 不能是 `DSH_`：dsh 把 `DSH_` 前缀当成 bootstrap-only，项目 `.env` 里出现任何 `DSH_*`
 * 都会让它启动的 CLI 子进程直接抛错退出（见 `dsh-app-boot` 的 `readEnvLayer`）。
 */
export const ENV_KEY_PREFIX = 'FEISHU_AGENT_';

/** dsh 拒绝出现在项目 `.env` 里的前缀：整份文件都会被判无效，CLI 直接退出。 */
const BOOTSTRAP_PREFIXES = ['DSH_', 'XDG_', 'DYLD_', 'BASH_FUNC_'];

/** 允许从 `.env` 进来的 provider key 形态：`DEEPSEEK_API_KEY`、`ZENMUX_API_KEY` 这类。 */
const PROVIDER_KEY_PATTERN = /^[A-Z][A-Z0-9_]*_API_KEY$/;

/** 已经退役的键：CoDePlan 不再使用，即使项目 `.env` 里还留着也不读。 */
const RETIRED_ENV_KEYS = new Set(['CODEPLAN_API_KEY']);

/**
 * 判断一个键是不是本插件要的：项目根的 `.env` 可能还放着别的工具的密钥，
 * 整份塞进进程环境会顺着 CLI 子进程漏给跑工具的那一层，所以只认自己的名字空间
 * 和 provider key。
 *
 * @param key 环境变量名
 * @returns 是否接纳
 */
export function isPluginEnvKey(key) {
  if (RETIRED_ENV_KEYS.has(key)) return false;
  return key.startsWith(ENV_KEY_PREFIX) || PROVIDER_KEY_PATTERN.test(key);
}

/**
 * 从 `startDir` 往上找有 `.git` 的那一层，作为「项目根」。
 *
 * @param startDir 起始目录
 * @param maxDepth 最多往上找几层
 * @returns 项目根；找不到时 undefined
 */
export function findProjectRoot(startDir, maxDepth = 8) {
  let dir = startDir;
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * 解一个原始值：去空白、去成对引号、处理引号内的转义与未加引号时的行尾注释。
 *
 * @param raw `=` 右侧的原始文本（已 trim）
 * @returns 实际值
 */
function parseValue(raw) {
  if (raw === '') return '';
  if (raw[0] === '"') {
    // 双引号：扫到第一个没被反斜杠转义的收尾引号。
    const matched = /^"((?:[^"\\]|\\.)*)"/.exec(raw);
    if (matched !== null) {
      return matched[1].replace(/\\([nt"\\])/g, (_, ch) => ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[ch]);
    }
  } else if (raw[0] === "'") {
    // 单引号：字面值，不做转义。
    const end = raw.indexOf("'", 1);
    if (end !== -1) return raw.slice(1, end);
  }
  // 引号没闭合、或本来就没加引号：` #` 之后算注释。
  const commentAt = raw.search(/\s#/);
  return (commentAt === -1 ? raw : raw.slice(0, commentAt)).trim();
}

/**
 * 解析 `.env` 文本。
 *
 * 支持的写法：`KEY=VALUE`、`export KEY=VALUE`、`#` 注释、单/双引号包裹的值、
 * 未加引号值后的 ` # 注释`。后出现的同名键覆盖先出现的。
 *
 * @param text 文件内容
 * @returns 键值对
 */
export function parseEnvFile(text) {
  const result = {};
  for (const rawLine of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = body.indexOf('=');
    // 没有 `=`、或键在等号左边为空，都不是一条赋值。
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    result[key] = parseValue(body.slice(eq + 1).trim());
  }
  return result;
}

/**
 * 读 `.env` 并把它填进 `process.env`：**只补没有的键**，真实环境变量永远优先。
 *
 * 文件缺失不算错误——这本来就是可选的本机配置。
 *
 * @param file 文件路径
 * @param logger 日志（只记键名，不记值）
 * @param options.accept 哪些键才接纳，默认 {@link isPluginEnvKey}
 * @returns `{ file, loaded, skipped, empty, ignored, bootstrap }`
 */
export async function loadEnvFile(file, logger, options = {}) {
  const accept = options.accept ?? isPluginEnvKey;
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      logger?.info(`没有本机 env 文件 ${file}`);
    } else {
      logger?.warn(`读取 ${file} 失败：${error?.message ?? error}`);
    }
    return { file, loaded: [], skipped: [], empty: [], ignored: [], bootstrap: [] };
  }

  const loaded = [];
  const skipped = [];
  const empty = [];
  const ignored = [];
  const bootstrap = [];
  for (const [key, value] of Object.entries(parseEnvFile(text))) {
    // 这类名字会让 dsh 自己拒绝整份 .env、启动的 CLI 直接退出，单独提出来告警。
    if (BOOTSTRAP_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      bootstrap.push(key);
      continue;
    }
    if (!accept(key)) {
      ignored.push(key);
      continue;
    }
    // 留空的键按「没写」处理：模板里占位而没填的行，不该悄悄盖住凭据存储或真实环境变量。
    if (value === '') {
      empty.push(key);
      continue;
    }
    if (process.env[key] !== undefined) {
      skipped.push(key);
      continue;
    }
    process.env[key] = value;
    loaded.push(key);
  }
  if (loaded.length > 0) logger?.info(`${file} 读入环境变量：${loaded.join(', ')}`);
  if (skipped.length > 0) logger?.info(`${file} 里这些变量已被真实环境覆盖：${skipped.join(', ')}`);
  if (empty.length > 0) logger?.info(`${file} 里这些变量留空，按未设置处理：${empty.join(', ')}`);
  if (ignored.length > 0) logger?.info(`${file} 跳过 ${ignored.length} 个与本插件无关的变量：${ignored.join(', ')}`);
  if (bootstrap.length > 0) {
    logger?.warn(
      `${file} 里有 ${bootstrap.length} 个 DSH_/XDG_/DYLD_ 开头的变量（${bootstrap.join(', ')}）：` +
        'dsh 拒绝项目 .env 里的这类名字，启动的 CLI 子进程会直接报错退出；请改用 FEISHU_AGENT_ 前缀',
    );
  }
  return { file, loaded, skipped, empty, ignored, bootstrap };
}
