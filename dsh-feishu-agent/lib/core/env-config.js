/** 从环境变量读本机配置：owner、chat → 工作区映射、并发。 */

/**
 * 环境变量名：收到一处，改名字只改这里。
 *
 * 前缀必须是 `FEISHU_AGENT_`，不能是 `DSH_`——dsh 拒绝项目 `.env` 里的任何 `DSH_*`。
 */
export const ENV_NAMES = {
  ownerOpenId: 'FEISHU_AGENT_OWNER_OPEN_ID',
  chats: 'FEISHU_AGENT_CHATS',
  defaultWorkspace: 'FEISHU_AGENT_DEFAULT_WORKSPACE',
  defaultTitlePrefix: 'FEISHU_AGENT_DEFAULT_TITLE_PREFIX',
  defaultPermissionPreset: 'FEISHU_AGENT_DEFAULT_PERMISSION_PRESET',
  defaultAgentPreset: 'FEISHU_AGENT_DEFAULT_AGENT_PRESET',
  answerConcurrency: 'FEISHU_AGENT_ANSWER_CONCURRENCY',
};

/** 旧名字（`DSH_` 前缀）：只从进程环境兜底读，用于已经在 launchctl / 登录项里配过的人。 */
const LEGACY_NAMES = {
  ownerOpenId: 'DSH_FEISHU_AGENT_OWNER_OPEN_ID',
  chats: 'FEISHU_AGENT_CHATS',
  defaultWorkspace: 'DSH_FEISHU_AGENT_DEFAULT_WORKSPACE',
  defaultTitlePrefix: 'DSH_FEISHU_AGENT_DEFAULT_TITLE_PREFIX',
  defaultPermissionPreset: 'DSH_FEISHU_AGENT_DEFAULT_PERMISSION_PRESET',
  defaultAgentPreset: 'DSH_FEISHU_AGENT_DEFAULT_AGENT_PRESET',
  answerConcurrency: 'DSH_FEISHU_AGENT_ANSWER_CONCURRENCY',
};

/**
 * 读一个字符串环境变量：缺省、空串、全是空白都算没设置。
 *
 * @param env 环境变量表
 * @param key 变量名
 * @returns 去掉首尾空白的值；没设置时 undefined
 */
function readString(env, key) {
  const value = env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * 读一个配置项：新名字优先，旧名字兜底。
 *
 * @param env 环境变量表
 * @param field `ENV_NAMES` 的键
 * @returns 值；都没设置时 undefined
 */
function readField(env, field) {
  return readString(env, ENV_NAMES[field]) ?? readString(env, LEGACY_NAMES[field]);
}

/**
 * 解 `FEISHU_AGENT_CHATS`：一个 JSON 对象，键是 chat_id（或 `'*'`），值是频道配置。
 *
 * 解析失败只告警、不抛错：配置写坏了不该把整条长连接带下来。
 *
 * @param raw 原始字符串
 * @param logger 日志
 * @returns chat_id → 频道配置；没写或无效时 undefined
 */
function parseChats(raw, logger) {
  if (raw === undefined) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger?.warn(`${ENV_NAMES.chats} 不是合法 JSON，忽略：${error?.message ?? error}`);
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    logger?.warn(`${ENV_NAMES.chats} 必须是 JSON 对象（chat_id → 配置），忽略`);
    return undefined;
  }
  const chats = {};
  for (const [chatId, value] of Object.entries(parsed)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      logger?.warn(`${ENV_NAMES.chats} 里 ${chatId} 的值不是对象，忽略`);
      continue;
    }
    chats[chatId] = value;
  }
  return Object.keys(chats).length > 0 ? chats : undefined;
}

/**
 * 拼 `'*'` 通配频道：用几个平铺的环境变量描述「所有 chat 默认落到哪」。
 *
 * @param env 环境变量表
 * @returns 频道配置；一个字段都没给时 undefined
 */
function parseDefaultChat(env) {
  const chat = {};
  const workspacePath = readField(env, 'defaultWorkspace');
  if (workspacePath !== undefined) chat.workspacePath = workspacePath;
  const titlePrefix = readField(env, 'defaultTitlePrefix');
  if (titlePrefix !== undefined) chat.titlePrefix = titlePrefix;
  const permissionPreset = readField(env, 'defaultPermissionPreset');
  if (permissionPreset !== undefined) chat.permissionPreset = permissionPreset;
  const agentPreset = readField(env, 'defaultAgentPreset');
  if (agentPreset !== undefined) chat.agentPreset = agentPreset;
  return Object.keys(chat).length > 0 ? chat : undefined;
}

/**
 * 读并校验并发上限：只接受 ≥ 1 的整数，写错就当没设置。
 *
 * @param env 环境变量表
 * @param logger 日志
 * @returns 并发上限；没设置或无效时 undefined
 */
function parseConcurrency(env, logger) {
  const raw = readField(env, 'answerConcurrency');
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    logger?.warn(`${ENV_NAMES.answerConcurrency} 必须是 ≥ 1 的整数（收到 ${raw}），忽略`);
    return undefined;
  }
  return value;
}

/**
 * 从环境变量读一份配置。没写任何相关变量时，返回的字段全是 undefined。
 *
 * @param env 环境变量表，默认 `process.env`
 * @param logger 日志
 * @returns `{ ownerOpenId, chats, defaultChat, answerConcurrency }`
 */
export function readEnvConfig(env = process.env, logger) {
  return {
    ownerOpenId: readField(env, 'ownerOpenId'),
    chats: parseChats(readField(env, 'chats'), logger),
    defaultChat: parseDefaultChat(env),
    answerConcurrency: parseConcurrency(env, logger),
  };
}

/**
 * 合成最终的 chats：bundle → 本机配置 → 环境变量，后面的层按 chat_id 逐个覆盖；
 * 最后把 `'*'` 默认频道与平铺的默认值合并。
 *
 * @param bundled bundle 配置里的 chats
 * @param local 本机配置里的 chats
 * @param envConfig `readEnvConfig()` 的结果
 * @returns 合成后的 chats
 */
export function composeChats(bundled, local, envConfig) {
  const chats = { ...(bundled ?? {}), ...(local ?? {}), ...(envConfig?.chats ?? {}) };
  if (envConfig?.defaultChat !== undefined) {
    chats['*'] = { ...(chats['*'] ?? {}), ...envConfig.defaultChat };
  }
  return chats;
}
