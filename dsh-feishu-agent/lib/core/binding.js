/** 绑定：把飞书会话（chat/thread）解析到 Workspace 与 DSH Session，并按需创建会话。 */

import { DEFAULT_AGENT_PRESET, DEFAULT_PERMISSION_PRESET, DEFAULT_TITLE_PREFIX } from '../common/constants.js';
import { errorMessage } from '../host/services.js';

/**
 * 造一个给人看的本地时间戳（`MM-DD HH:mm`），用于会话标题。
 *
 * 用 `toISOString()` 会得到 UTC，和你手机上看到的时间差 8 小时，所以这里按运行环境的本地时区格式化。
 *
 * @param date 时刻，默认当前
 * @returns 形如 `11-17 13:15`
 */
export function localStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 造绑定键：应用 + 租户 + 会话 + 话题（没有话题用 `-`）。
 *
 * @param options.appId 应用 ID
 * @param options.tenantKey 租户 key
 * @param options.chatId 会话 ID
 * @param options.threadId 话题 ID
 * @returns 绑定键
 */
export function bindingKeyOf({ appId, tenantKey, chatId, threadId }) {
  return [appId, tenantKey, chatId, threadId || '-'].join(':');
}

/**
 * 把一个 chat 的显式配置补全成默认值；配置里没写 workspacePath 时返回 undefined。
 *
 * @param config 用户给的该 chat 的配置
 * @returns 完整的频道配置；没配工作区时不返回
 */
export function normalizeChatConfig(config) {
  if (config === null || typeof config !== 'object') return undefined;
  if (typeof config.workspacePath !== 'string' || config.workspacePath.trim() === '') return undefined;
  return {
    workspacePath: config.workspacePath.trim(),
    chatType: config.chatType === 'group' ? 'group' : 'p2p',
    permissionPreset: config.permissionPreset || DEFAULT_PERMISSION_PRESET,
    agentPreset: config.agentPreset || DEFAULT_AGENT_PRESET,
    provider: typeof config.provider === 'string' ? config.provider : '',
    model: typeof config.model === 'string' ? config.model : '',
    titlePrefix: typeof config.titlePrefix === 'string' ? config.titlePrefix : DEFAULT_TITLE_PREFIX,
    requireMention: config.requireMention !== false,
  };
}

/**
 * 建绑定器：查绑定、建会话、改标题、切换会话。
 *
 * @param deps.logger 日志
 * @param deps.store 状态存储
 * @param deps.host 宿主服务入口（`host/session.js`）
 * @param deps.config 运行期配置（可读 `chats`）
 * @returns 绑定器
 */
export function createBinder({ logger, store, host, config }) {
  /**
   * 某个 chat 的配置：优先精确匹配 chatId，其次按 chatType 给默认。
   *
   * @param chatId 飞书会话 ID
   * @returns 频道配置；没配时候 undefined
   */
  function chatConfigOf(chatId) {
    const chats = config.get().chats ?? {};
    // 先按 chat_id 精确匹配，没配就用通配项 `'*'`，再没有就返回 undefined（由调用方提示去配置）。
    return normalizeChatConfig(chats[chatId]) ?? normalizeChatConfig(chats['*']);
  }

  /**
   * 读一个绑定。
   *
   * @param key 绑定键
   * @returns 绑定；没有时 undefined
   */
  function get(key) {
    return store.state.bindings[key];
  }

  /**
   * 确保 Workspace 存在并拿到它的 id 与规范路径。
   *
   * @param workspacePath 绝对路径
   * @returns `{ workspaceId, workspacePath }`
   */
  async function ensureWorkspace(workspacePath) {
    const resolved = await host.resolveWorkspace(workspacePath);
    if (resolved !== undefined) return resolved;
    return await host.createWorkspace(workspacePath);
  }

  /**
   * 为一轮新的飞书会话建绑定：先解析 Workspace，再在它下面建 Session。
   *
   * @param options.key 绑定键
   * @param options.appId 应用 ID
   * @param options.tenantKey 租户
   * @param options.chatId 会话 ID
   * @param options.chatType 私聊/群聊
   * @param options.threadId 话题 ID
   * @param options.channelConfig 该 chat 的配置
   * @returns 绑定
   */
  async function createBinding({ key, appId, tenantKey, chatId, chatType, threadId, channelConfig }) {
    const workspace = await ensureWorkspace(channelConfig.workspacePath);
    // 会话本身由 CLI 第一次执行时创建（`dsh --profile headless --json "<prompt>"` 的返回里带 sessionId），
    // 这里只登记绑定与工作区；dshSessionId 先留空。
    const now = new Date().toISOString();
    const binding = {
      key,
      appId,
      tenantKey,
      chatId,
      chatType,
      ...(threadId ? { threadId } : {}),
      workspaceId: workspace.workspaceId,
      workspacePath: workspace.workspacePath,
      dshSessionId: '',
      agentPreset: channelConfig.agentPreset,
      permissionPreset: channelConfig.permissionPreset,
      title: '',
      titlePrefix: channelConfig.titlePrefix,
      provider: channelConfig.provider,
      model: channelConfig.model,
      createdAt: now,
      updatedAt: now,
    };
    store.state.bindings[key] = binding;
    store.touch();
    logger.info(`已为 ${chatId} 建绑定（工作区 ${workspace.workspacePath}，会话由 CLI 首次执行时创建）`);
    return binding;
  }

  /**
   * 取绑定；没有就按配置新建。配置里没有这个 chat 时返回 undefined（由调用方拒绝）。
   *
   * @param options 同 createBinding
   * @returns 绑定；未配置该 chat 时 undefined
   */
  async function ensureBinding(options) {
    const existing = get(options.key);
    if (existing !== undefined) return existing;
    const channelConfig = chatConfigOf(options.chatId);
    if (channelConfig === undefined) return undefined;
    return await createBinding({ ...options, chatType: channelConfig.chatType, channelConfig });
  }

  /**
   * 在当前绑定的 Workspace 下换一条新会话（`/new`）。
   *
   * @param key 绑定键
   * @returns `{ binding }` 或 `{ error }`
   */
  async function resetSession(key) {
    const binding = get(key);
    if (binding === undefined) return { error: '还没有会话，先发一条消息建会话' };
    const channelConfig = {
      workspacePath: binding.workspacePath,
      agentPreset: binding.agentPreset,
      permissionPreset: binding.permissionPreset,
      titlePrefix: binding.titlePrefix,
    };
    const workspace = await ensureWorkspace(binding.workspacePath);
    const created = await host.createSession({ workspaceId: workspace.workspaceId, agentPreset: binding.agentPreset });
    if (created.sessionId === '') return { error: '宿主没有返回会话 ID' };
    const stamp = localStamp();
    const title = `${channelConfig.titlePrefix} ${stamp}`;
    await host.rename(created.sessionId, title).catch(() => false);
    binding.dshSessionId = created.sessionId;
    binding.title = title;
    binding.updatedAt = new Date().toISOString();
    store.touch();
    logger.info(`绑定 ${key} 换到新会话 ${created.sessionId}`);
    return { binding };
  }

  /**
   * 把绑定切到同工作区里的另一条会话（`/switch`）。
   *
   * @param key 绑定键
   * @param sessionId 目标会话 ID
   * @returns `{ binding }` 或 `{ error }`
   */
  async function switchSession(key, sessionId) {
    const binding = get(key);
    if (binding === undefined) return { error: '还没有会话，先发一条消息建会话' };
    const id = sessionId.trim();
    if (id === '') return { error: '用法：/switch <会话ID 前缀>' };
    const found = await host.findByIdPrefix(id);
    if (found === undefined) return { error: `找不到会话 ${id}` };
    if (found.cwd !== binding.workspacePath) {
      return { error: `会话 ${found.id} 属于 ${found.cwd}，不在当前工作区 ${binding.workspacePath}` };
    }
    binding.dshSessionId = found.id;
    binding.title = found.title;
    binding.updatedAt = new Date().toISOString();
    store.touch();
    logger.info(`绑定 ${key} 切到会话 ${found.id}`);
    return { binding };
  }

  /**
   * 把 CLI 跑出来的 sessionId 记到绑定上（新会话第一次执行完成后调用）。
   *
   * @param key 绑定键
   * @param sessionId CLI 返回的会话 ID
   */
  function attachSessionId(key, sessionId) {
    const binding = get(key);
    if (binding === undefined || typeof sessionId !== 'string' || sessionId === '') return;
    binding.dshSessionId = sessionId;
    binding.updatedAt = new Date().toISOString();
    store.touch();
    logger.info(`绑定 ${key} 记下 CLI 会话 ${sessionId}`);
  }

  return { get, ensureBinding, resetSession, switchSession, chatConfigOf, attachSessionId };
}
