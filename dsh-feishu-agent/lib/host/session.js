/** 宿主会话与工作区：创建/唤醒/投喂/取消会话，解析与创建工作区，按前缀查会话。 */

import { errorMessage } from './services.js';

/** 建会话时传给宿主的「调用方信号」，不会中止。 */
const NEVER_ABORTED = new AbortController().signal;

/**
 * 会话与工作区的宿主封装。
 *
 * @param deps.ctx Cordis 上下文
 * @param deps.logger 日志
 * @param deps.getService 取服务（缺席时返回 undefined）
 * @returns 会话与工作区句柄
 */
export function createSessionBridge({ ctx, logger, getService }) {
  /**
   * 解析一个目录对应的已有工作区。
   *
   * @param workspacePath 绝对路径
   * @returns `{ workspaceId, workspacePath }`；没有时 undefined
   */
  async function resolveWorkspace(workspacePath) {
    const registry = getService('workspaceRegistry');
    if (registry === undefined) throw new Error('宿主缺少 workspaceRegistry');
    try {
      const found = await registry.resolveByPath(workspacePath);
      if (found === undefined) return undefined;
      return { workspaceId: String(found.id), workspacePath: String(found.path) };
    } catch (error) {
      logger.warn(`解析工作区 ${workspacePath} 失败：${errorMessage(error)}`);
      return undefined;
    }
  }

  /**
   * 注册一个新的工作区（目录必须存在）。
   *
   * @param workspacePath 绝对路径
   * @returns `{ workspaceId, workspacePath }`
   */
  async function createWorkspace(workspacePath) {
    const registry = getService('workspaceRegistry');
    if (registry === undefined) throw new Error('宿主缺少 workspaceRegistry');
    const created = await registry.create(workspacePath);
    logger.info(`已注册工作区 ${created.path}（${created.id}）`);
    return { workspaceId: String(created.id), workspacePath: String(created.path) };
  }

  /**
   * 在指定工作区下建一条会话。
   *
   * @param options.workspaceId 工作区 ID
   * @param options.agentPreset agent preset
   * @returns `{ sessionId, agentPreset }`
   */
  async function createSession({ workspaceId, agentPreset }) {
    const controller = getService('sessionController');
    if (controller === undefined) throw new Error('宿主缺少 sessionController');
    const created = await controller.create({ workspaceId, ...(agentPreset ? { agentPreset } : {}) });
    return { sessionId: String(created?.sessionId ?? ''), agentPreset: created?.agentPreset };
  }

  /**
   * 给会话显式指定模型（provider / model）。
   *
   * 新会话默认快照部署级默认模型，可能与桌面端当前使用的 provider 不同（例如官方网关 vs 中转网关），
   * 显式指定可以让飞书会话与桌面端走同一条链路。
   *
   * @param sessionId 会话 ID
   * @param provider provider 名（空串表示只改 model）
   * @param model 模型 id
   * @returns `{ ok, error? }`
   */
  async function selectModel(sessionId, provider, model) {
    const controller = getService('sessionController');
    if (controller === undefined || typeof controller.selectModel !== 'function') {
      return { ok: false, error: '宿主不支持 sessionController.selectModel' };
    }
    try {
      // 只给了其中一个时，用会话当前选择的另一半补齐。
      let effectiveProvider = provider;
      let effectiveModel = model;
      if (effectiveProvider === '' || effectiveModel === '') {
        const agent = getService('agents')?.get?.(sessionId);
        const current = agent?.model?.current?.();
        effectiveProvider = effectiveProvider || String(current?.provider ?? '');
        effectiveModel = effectiveModel || String(current?.model ?? '');
      }
      if (effectiveProvider === '' || effectiveModel === '') {
        return { ok: false, error: 'provider 与 model 都要能确定（配置里补全，或等会话有当前模型）' };
      }
      await controller.selectModel({ sessionId, provider: effectiveProvider, model: effectiveModel });
      return { ok: true };
    } catch (error) {
      logger.warn(`会话 ${sessionId} 选模型失败：${errorMessage(error)}`);
      return { ok: false, error: errorMessage(error) };
    }
  }

  /**
   * 唤醒会话（已有 live agent 就复用），恢复它记录的 preset 与模型。
   *
   * @param sessionId 会话 ID
   * @returns 活着的 agent
   */
  async function resolveAgent(sessionId) {
    const controller = getService('sessionController');
    if (controller === undefined) throw new Error('宿主缺少 sessionController');
    const found = await controller.resolveAgent(sessionId);
    if (found !== null && typeof found === 'object' && 'error' in found && found.error) {
      throw new Error(errorMessage(found.error));
    }
    return found;
  }

  /**
   * 投喂一条文本；`mode: 'queue'` 不打断正在跑的一轮。
   *
   * @param options.sessionId 会话 ID
   * @param options.requestId 请求身份（宿主写进消息 source，用来认领这一轮）
   * @param options.text 文本
   * @param options.mode `queue` 或 `steer`
   * @returns `{ ok, messageId?, error? }`
   */
  async function prompt({ sessionId, requestId, text, mode = 'queue' }) {
    const controller = getService('sessionController');
    if (controller === undefined) return { ok: false, error: '宿主缺少 sessionController' };
    try {
      const accepted = await controller.prompt(
        { requestId, sessionId, mode, content: [{ type: 'text', text }] },
        NEVER_ABORTED,
      );
      // 宿主的 prompt 只返回 `{ accepted: true }`（见 dsh-api-session-controller 的 commands.prompt），
      // 没有 messageId；认领这一轮靠的是随后的 `user/message` 事件里的 `source.rpcId`。
      return { ok: true, accepted: accepted?.accepted === true };
    } catch (error) {
      logger.warn(`投喂会话 ${sessionId} 失败：${errorMessage(error)}`);
      return { ok: false, error: errorMessage(error) };
    }
  }

  /**
   * 中止会话当前这一轮。
   *
   * @param sessionId 会话 ID
   * @returns `{ ok, error? }`
   */
  async function cancel(sessionId) {
    const controller = getService('sessionController');
    if (controller === undefined) return { ok: false, error: '宿主缺少 sessionController' };
    try {
      await controller.cancel({ sessionId });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  /**
   * 撤掉队列里还没跑的一条消息。
   *
   * @param sessionId 会话 ID
   * @param itemId 宿主消息 ID
   * @returns `{ ok, error? }`
   */
  async function removeQueued(sessionId, itemId) {
    const controller = getService('sessionController');
    if (controller === undefined) return { ok: false, error: '宿主缺少 sessionController' };
    const updateQueue = controller.updateQueue ?? controller.agents?.updateQueue;
    if (typeof updateQueue !== 'function') return { ok: false, error: '宿主不支持撤回队列消息' };
    try {
      await updateQueue.call(controller, { sessionId, itemId, action: { kind: 'remove' } });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  /**
   * 给会话改名（标题只影响可读性，失败不影响主流程）。
   *
   * @param sessionId 会话 ID
   * @param title 新标题
   * @returns 宿主收下的标题
   */
  async function rename(sessionId, title) {
    const controller = getService('sessionController');
    if (controller !== undefined && typeof controller.rename === 'function') {
      const accepted = await controller.rename({ sessionId, title });
      return accepted?.title ?? title;
    }
    const titles = getService('sessionTitle');
    const agents = getService('agents');
    const live = agents?.get?.(sessionId);
    if (titles !== undefined && live?.session !== undefined) {
      return titles.rename(live.session, title)?.title ?? title;
    }
    throw new Error('宿主没有可用的改名入口');
  }

  /**
   * 所有带工作目录的会话（来自 sessionQuery），按最近活动倒序。
   *
   * @returns 会话摘要数组
   */
  async function listSessions() {
    const query = getService('sessionQuery');
    if (query === undefined) return [];
    try {
      const records = await query.listSessions();
      const projects = getService('sessionProjectionCache');
      return records
        .filter((record) => record?.header?.cwd !== undefined)
        .map((record) => ({
          id: String(record.header.id),
          cwd: String(record.header.cwd),
          title: readTitle(projects, record.header),
          updatedAt: Number(record.header.createdAt ?? 0),
        }))
        .sort((left, right) => right.updatedAt - left.updatedAt);
    } catch (error) {
      logger.warn(`列会话失败：${errorMessage(error)}`);
      return [];
    }
  }

  /**
   * 读会话标题投影。
   *
   * @param cache 投影缓存
   * @param header 会话 header
   * @returns 标题；读不到时空串
   */
  function readTitle(cache, header) {
    if (cache === undefined) return '';
    try {
      if (header.isSeeded) return '';
      const block = cache.cachedSnapshot?.(header) ?? cache.cachedPredecessorTitle?.(header);
      const title = block?.values?.title;
      return typeof title === 'string' ? title : '';
    } catch {
      return '';
    }
  }

  /**
   * 按 ID 前缀找会话。
   *
   * @param prefix 会话 ID 前缀
   * @returns 会话摘要；找不到或不止一条时 undefined
   */
  async function findByIdPrefix(prefix) {
    const sessions = await listSessions();
    const matches = sessions.filter((item) => item.id === prefix || item.id.startsWith(prefix));
    if (matches.length === 1) return matches[0];
    return undefined;
  }

  /**
   * 把 CLI 建的会话挂到工作区（CLI 不写 Workspace 归属，由宿主补）。
   *
   * @param workspaceId 工作区 ID
   * @param sessionId 会话 ID
   * @returns `{ ok, error? }`
   */
  async function attachToWorkspace(workspaceId, sessionId) {
    const registry = getService('workspaceRegistry');
    if (registry === undefined) return { ok: false, error: '宿主缺少 workspaceRegistry' };
    try {
      const workspace = registry.get(workspaceId);
      if (workspace === undefined) return { ok: false, error: `工作区 ${workspaceId} 不存在` };
      await workspace.attachSession(sessionId);
      logger.info(`会话 ${sessionId} 已归属工作区 ${workspace.path}`);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  return {
    selectModel,
    attachToWorkspace,
    resolveWorkspace,
    createWorkspace,
    createSession,
    resolveAgent,
    prompt,
    cancel,
    removeQueued,
    rename,
    listSessions,
    findByIdPrefix,
    ctx,
  };
}
