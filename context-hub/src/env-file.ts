/** Context Hub 的部署/本地 env 读取：零依赖，只补未设置的键。 */

import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CONTEXT_HUB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 允许从 `.env` 进入进程环境的键前缀。 */
const ACCEPTED_PREFIXES = ['FEISHU_AGENT_', 'FEISHU_APP_', 'CONTEXT_HUB_', 'WIZZ_'];

/** provider key 形态：`DEEPSEEK_API_KEY`、`ZENMUX_API_KEY` 这类。 */
const PROVIDER_KEY_PATTERN = /^[A-Z][A-Z0-9_]*_API_KEY$/;

/**
 * 拒绝的前缀：项目 `.env` 里的 `DSH_*` 会让 dsh 拒绝整份文件，
 * `XDG_`/`DYLD_`/`BASH_FUNC_` 也不该由项目配置注入。
 */
const REJECTED_PREFIXES = ['DSH_', 'XDG_', 'DYLD_', 'BASH_FUNC_'];

export interface EnvFileResult {
  file: string;
  loaded: string[];
  skipped: string[];
  empty: string[];
  ignored: string[];
  rejected: string[];
}

export interface EnvLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

/**
 * 从 `startDir` 往上找有 `.git` 的那一层，作为项目根。
 *
 * @param startDir 起始目录
 * @param maxDepth 最多往上找几层
 * @returns 项目根；找不到时 undefined
 */
export function findProjectRoot(startDir: string, maxDepth = 8): string | undefined {
  let dir = startDir;
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * 解析 `.env` 文本：`KEY=VALUE`、`export KEY=VALUE`、`#` 注释、
 * 单/双引号与未加引号值后的 ` # 注释`。后出现的同名键覆盖先出现的。
 *
 * @param text 文件内容
 * @returns 键值对
 */
export function parseEnvFile(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = body.indexOf('=');
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    result[key] = parseValue(body.slice(eq + 1).trim());
  }
  return result;
}

/**
 * 解一个原始值：去空白、去成对引号、处理引号内的转义与未加引号时的行尾注释。
 *
 * @param raw `=` 右侧的原始文本（已 trim）
 * @returns 实际值
 */
function parseValue(raw: string): string {
  if (raw === '') return '';
  if (raw[0] === '"') {
    const matched = /^"((?:[^"\\]|\\.)*)"/.exec(raw);
    if (matched !== null) {
      const escapes: Record<string, string> = {n: '\n', t: '\t', '"': '"', '\\': '\\'};
      return matched[1].replace(/\\([nt"\\])/g, (whole, ch: string) => escapes[ch] ?? whole);
    }
  } else if (raw[0] === "'") {
    const end = raw.indexOf("'", 1);
    if (end !== -1) return raw.slice(1, end);
  }
  const commentAt = raw.search(/\s#/);
  return (commentAt === -1 ? raw : raw.slice(0, commentAt)).trim();
}

/**
 * 判断一个键是否允许从 `.env` 进入进程环境。
 *
 * @param key 环境变量名
 * @returns 是否接纳
 */
export function isAcceptedEnvKey(key: string): boolean {
  if (REJECTED_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  return ACCEPTED_PREFIXES.some((prefix) => key.startsWith(prefix)) || PROVIDER_KEY_PATTERN.test(key);
}

/**
 * 读一个 `.env` 并补进 `process.env`：**已有非空值的键不覆盖**，真实环境变量优先。
 * 文件缺失不算错误。
 *
 * @param file 文件路径
 * @param logger 日志（只记键名，不记值）
 * @returns 读取结果
 */
export async function loadEnvFile(file: string, logger?: EnvLogger): Promise<EnvFileResult> {
  const emptyResult: EnvFileResult = {file, loaded: [], skipped: [], empty: [], ignored: [], rejected: []};
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger?.warn(`读取 ${file} 失败：${(error as Error).message}`);
    }
    return emptyResult;
  }

  const result: EnvFileResult = {file, loaded: [], skipped: [], empty: [], ignored: [], rejected: []};
  for (const [key, value] of Object.entries(parseEnvFile(text))) {
    if (REJECTED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      result.rejected.push(key);
      continue;
    }
    if (!isAcceptedEnvKey(key)) {
      result.ignored.push(key);
      continue;
    }
    if (value === '') {
      result.empty.push(key);
      continue;
    }
    if ((process.env[key] ?? '') !== '') {
      result.skipped.push(key);
      continue;
    }
    process.env[key] = value;
    result.loaded.push(key);
  }

  if (result.loaded.length > 0) logger?.info(`${file} 读入环境变量：${result.loaded.join(', ')}`);
  if (result.skipped.length > 0) logger?.info(`${file} 里这些变量已被真实环境覆盖：${result.skipped.join(', ')}`);
  if (result.rejected.length > 0) {
    logger?.warn(`${file} 拒绝 DSH_/XDG_/DYLD_ 开头的变量：${result.rejected.join(', ')}`);
  }
  return result;
}

/**
 * 解析要读取的 env 文件。显式 `CONTEXT_HUB_ENV_FILE` 优先；否则部署 env → 仓库根 `.env`。
 * 先读到的键赢，部署配置压过仓库里的开发配置。
 *
 * @param startDir 仓库内起始目录
 * @returns 文件路径列表
 */
export function resolveEnvFiles(startDir: string = CONTEXT_HUB_ROOT): string[] {
  const override = (process.env.CONTEXT_HUB_ENV_FILE ?? '').trim();
  if (override !== '') return [path.resolve(override)];

  const files = [path.join(os.homedir(), '.config', 'context-hub', 'env')];
  const projectRoot = findProjectRoot(startDir);
  if (projectRoot !== undefined) files.push(path.join(projectRoot, '.env'));
  return [...new Set(files)];
}

/**
 * 按 {@link resolveEnvFiles} 的顺序读取全部 env 文件。
 *
 * @param logger 日志
 * @returns 每个文件的结果
 */
export async function loadEnvFiles(logger?: EnvLogger): Promise<EnvFileResult[]> {
  const results: EnvFileResult[] = [];
  for (const file of resolveEnvFiles()) results.push(await loadEnvFile(file, logger));
  return results;
}
