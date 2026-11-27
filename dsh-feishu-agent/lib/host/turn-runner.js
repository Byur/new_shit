/** 跑一轮：宿主优先，接不住退回 CLI；负责轮次登记、工作区归属、卡片收尾。 */

import { mkdir, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { TURN_END_TITLES } from '../common/constants.js';
import { localStamp } from '../core/binding.js';
import { hostTurnTimeoutMs, turnMode } from '../core/turn-mode.js';
import { errorMessage } from './services.js';

/**
 * 建轮次执行器。
 *
 * @param deps.logger 日志
 * @param deps.binder 绑定器
 * @param deps.host 宿主会话桥
 * @param deps.cards 回答卡句柄
 * @param deps.turns 轮次注册表
 * @param deps.executor CLI 执行器
 * @param deps.runningRuns 正在跑的执行表
 * @param deps.answerers 反问/审批应答句柄
 * @param deps.getRuntimeConfig 取运行期配置（并发上限）
 * @param deps.getService 取宿主服务
 * @param deps.getCliHome 取 CLI 子进程的 DSH_HOME
 * @param deps.onTurnFinished 轮次完成回调（可选）
 * @returns 执行器：`run({ binding, key, event, text, route })`
 */
export function createTurnRunner({
  logger,
  binder,
  host,
  cards,
  turns,
  executor,
  runningRuns,
  answerers,
  getRuntimeConfig,
  getService,
  getCliHome,
  onTurnFinished,
}) {
  /** 宿主接不住过的会话：别每条消息都重试一遍、白等超时。 */
  const hostDeadSessions = new Set();
  /** 宿主「建完接不住」一旦发生，之后新会话直接用 CLI，不再白试。 */
  let hostCreateUnusable = false;

  /**
   * 会话的持久化目录是否还在。
   *
   * Desktop 用 `DSH_HOME`，CLI 子进程可能被 `cliHome` 指到别处，所以两处都查。一个
   * `sessions` 目录都没读到时按「还在」处理——宁可照旧报错，也不要因为权限或布局差异
   * 把一条好会话静默重置掉。
   *
   * @param sessionId 会话 ID
   * @returns 会话是否还存在
   */
  async function sessionExists(sessionId) {
    if (getService('agents')?.get?.(sessionId) !== undefined) return true;
    const homes = new Set(
      [process.env.DSH_HOME || join(homedir(), '.dsh'), getCliHome()].filter((home) => home !== ''),
    );
    let checked = false;
    for (const home of homes) {
      let entries;
      try {
        entries = await readdir(join(home, 'sessions'), { withFileTypes: true });
      } catch {
        continue;
      }
      checked = true;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          await stat(join(home, 'sessions', entry.name, sessionId));
          return true;
        } catch {
          // 这个工作区目录下没有，接着看下一个
        }
      }
    }
    return checked ? false : true;
  }

  /**
   * 跑一轮，并把事件流映射到回答卡。
   *
   * @param options.binding 会话绑定（新会话时对应槽位 sessionId 为空）
   * @param options.key 绑定键
   * @param options.event 飞书消息事件
   * @param options.text 任务文本
   * @param options.route 路由元信息（省略时保持默认主会话行为）
   */
  async function run({ binding, key, event, text, route }) {
    let activeSlot = route?.kind === 'local' ? 'local' : 'dsh';
    const sessionFieldOf = (slot) => (slot === 'local' ? 'localSessionId' : 'dshSessionId');
    const currentSessionId = (slot = activeSlot) => {
      const value = binding[sessionFieldOf(slot)];
      return typeof value === 'string' ? value : '';
    };
    const setSlotSessionId = (slot, sessionId) => {
      const field = sessionFieldOf(slot);
      binding[field] = sessionId;
      if (sessionId === '') binder.clearSessionId?.(key, slot);
      else binder.attachSessionId(key, sessionId, slot);
    };

    const effectiveProvider = (route?.provider || (activeSlot === 'dsh' ? binding.provider : '') || '').trim();
    const effectiveModel = (route?.model || (activeSlot === 'dsh' ? binding.model : '') || '').trim();
    const effectiveAgentPreset = route?.agentPreset || binding.agentPreset;
    const effectivePermissionPreset = route?.permissionPreset || binding.permissionPreset;
    const effectiveTitlePrefix = route?.titlePrefix || '';
    // 卡片标题前缀（[飞书·兜底] / [飞书·读笔记]）：只标在回答卡上，不参与会话改名。
    const cardTitlePrefix = route?.cardTitlePrefix || '';
    const routeNote = typeof route?.note === 'string' ? route.note : '';

    // 会话的 cwd 就是工作区：目录被删掉（或绑定是迁移来的）时先建回来，否则 CLI 子进程
    // 连 chdir 都失败（spawn ENOENT），宿主建会话也会因为目录不存在被拒。
    if (typeof binding.workspacePath === 'string' && binding.workspacePath !== '') {
      await mkdir(binding.workspacePath, { recursive: true }).catch(() => {});
    }

    // 会话可能在桌面端被删掉了：入队前先确认它还在，不在就当作新会话重新连一条。
    if (currentSessionId() !== '' && !(await sessionExists(currentSessionId()))) {
      logger.warn(`绑定的${activeSlot === 'local' ? '本地' : ''}会话 ${currentSessionId()} 已经不在了，改用新会话`);
      setSlotSessionId(activeSlot, '');
    }

    const requestId = route?.escalated === true ? `f_${event.messageId}_esc_${Date.now()}` : `f_${event.messageId}`;
    const runId = `run_${event.messageId}`;
    const turnEntry = turns.open(event.messageId, {
      requestId,
      sessionId: currentSessionId(),
      chatId: event.chatId,
      chatType: event.chatType,
      bindingKey: key,
      text,
      originalText: route?.originalText ?? text,
      routeKind: route?.kind ?? 'dsh',
      routeLabel: route?.label ?? '',
      // 降级/规则说明：宿主轮次由 session-events 收尾时也要带上。
      note: routeNote,
      canEscalate: route?.canEscalate === true,
      escalateLabel: route?.escalateLabel ?? '',
    });
    await cards.open({
      messageId: event.messageId,
      chatId: event.chatId,
      title: '排队中',
      action: 'withdraw',
      workspacePath: binding.workspacePath,
      titlePrefix: cardTitlePrefix,
    });

    // 并发上限：超过就排队等（这里简单等一等，不做完整队列）。
    const limit = getRuntimeConfig().answerConcurrency;
    while (executor.size() >= limit) await new Promise((resolve) => setTimeout(resolve, 200));

    const controller = new AbortController();
    runningRuns.set(runId, controller);
    let started = false;

    /** 这条会话是否已经成功挂到工作区（挂载是「校验式」的，header 还没落盘时会失败）。 */
    let workspaceAttached = false;

    /**
     * 把会话挂到绑定的工作区；失败只记日志，这一轮照常跑。
     *
     * @param sessionId 会话 ID
     */
    async function attachSession(sessionId) {
      if (sessionId === '' || workspaceAttached) return;
      const outcome = await host
        .attachToWorkspace(binding.workspaceId, sessionId)
        .catch((error) => ({ ok: false, error: errorMessage(error) }));
      if (outcome.ok) workspaceAttached = true;
      else logger.warn(`会话 ${sessionId} 归属工作区失败：${outcome.error ?? '未知原因'}`);
    }

    /**
     * 为宿主会话应用路由指定的标题、权限预设与模型选择（幂等、失败只告警）。
     *
     * @param sessionId 宿主会话 ID
     * @param options.isNew 是否刚新建的会话
     */
    async function configureHostSession(sessionId, { isNew = false } = {}) {
      if (sessionId === '') return;
      if (isNew && effectiveTitlePrefix !== '') {
        await host.rename(sessionId, `${effectiveTitlePrefix} ${localStamp()}`).catch(() => {});
      }
      if (isNew && typeof effectivePermissionPreset === 'string' && effectivePermissionPreset !== '') {
        const presets = getService('permissionPresets');
        if (typeof presets?.set === 'function') {
          await presets.set(sessionId, effectivePermissionPreset).catch((error) => {
            logger.warn(`会话 ${sessionId} 设置权限预设 ${effectivePermissionPreset} 失败：${errorMessage(error)}`);
          });
        }
      }
      if (effectiveProvider !== '' || effectiveModel !== '') {
        const current = getService('agents')?.get?.(sessionId)?.model?.current?.();
        const sameProvider = effectiveProvider === '' || current?.provider === effectiveProvider;
        const sameModel = effectiveModel === '' || current?.model === effectiveModel;
        if (isNew || !sameProvider || !sameModel) {
          const selected = await host.selectModel(sessionId, effectiveProvider, effectiveModel);
          if (!selected.ok) {
            logger.warn(`会话 ${sessionId} 切换模型（${effectiveProvider}/${effectiveModel}）失败：${selected.error}`);
          }
        }
      }
    }

    /**
     * 由宿主直接投喂这一轮（会话在桌面端开着时用）。
     *
     * 宿主持有会话的写句柄时，CLI 子进程拿不到同一个会话（`already owned by an active
     * write handle`）。这时把这一轮交给宿主：卡片由 `session/event` 里的 user/message /
     * assistant/message / turn/end 驱动。
     *
     * @param reason 为什么要走这条路（日志用）
     * @returns 是否成功投喂
     */
    async function runViaHost(reason) {
      const sid = currentSessionId();
      logger.info(`会话 ${sid} ${reason}，改由宿主投喂这一轮`);
      await configureHostSession(sid, { isNew: false });
      const prompted = await host.prompt({ sessionId: sid, requestId, text });
      if (prompted.ok) return true;
      await cards.finish(event.messageId, {
        title: '失败',
        color: 'red',
        note: prompted.error ?? '宿主没有接受这一轮',
      });
      turns.finish(turns.byFeishuMessage(event.messageId), 'failed');
      return false;
    }

    /**
     * 让宿主跑这一轮，并等它真的认领（`user/message` 事件带 rpcId 回来）。
     *
     * @param timeoutMs 等多久还没认领就放弃
     * @param options.isNew 是否刚新建的会话
     * @returns 宿主是否接住了这一轮
     */
    async function runViaHostAndWait(timeoutMs, { isNew = false } = {}) {
      const sid = currentSessionId();
      if (sid === '') return false;
      let agent;
      try {
        agent = await host.resolveAgent(sid);
      } catch (error) {
        // 常见情况是这条会话不在宿主里（只有 CLI 建过）：这属于正常回退，不是故障。
        logger.info(`宿主接不了会话 ${sid}（${errorMessage(error)}），走 CLI`);
        return false;
      }
      if (agent === undefined || agent === null) return false;

      await configureHostSession(sid, { isNew });
      const prompted = await host.prompt({ sessionId: sid, requestId, text });
      if (!prompted.ok) {
        logger.warn(`宿主拒绝投喂：${prompted.error ?? '未知原因'}`);
        return false;
      }
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (turnEntry.status === 'running') return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (turnEntry.status === 'running') return true;
      logger.warn(`宿主 ${timeoutMs}ms 内没有认领这一轮，回退 CLI`);
      await host.cancel(sid).catch(() => {});
      return false;
    }

    // 会话在桌面端开着：宿主已经持有它，别让 CLI 去抢同一个写句柄。
    if (
      turnMode() !== 'cli' &&
      currentSessionId() !== '' &&
      !hostDeadSessions.has(currentSessionId()) &&
      getService('agents')?.get?.(currentSessionId()) !== undefined
    ) {
      await runViaHost('正在桌面端运行');
      return;
    }

    // host 模式：连会话本身也交给 Desktop 建，这样从第一条消息起就是宿主在写，桌面端随时能打开。
    if (turnMode() === 'host' && currentSessionId() === '' && binding.workspaceId !== '') {
      const created = await host
        .createSession({ workspaceId: binding.workspaceId, agentPreset: effectiveAgentPreset })
        .catch((error) => ({ sessionId: '', error: errorMessage(error) }));
      if (created.sessionId !== '') {
        setSlotSessionId(activeSlot, created.sessionId);
        // 事件按「会话 + turn 号」对回飞书消息，所以这里要把记录改成真会话 ID。
        turnEntry.sessionId = created.sessionId;
        await host.attachToWorkspace(binding.workspaceId, created.sessionId).catch(() => {});
        if (await runViaHostAndWait(hostTurnTimeoutMs(), { isNew: true })) return;
        await cards.finish(event.messageId, {
          title: '失败',
          color: 'red',
          note: `Desktop 建的会话没有接住这一轮（FEISHU_AGENT_TURN_MODE=host）。会话：${created.sessionId}`,
        });
        turns.finish(turnEntry, 'error');
        return;
      }
      logger.warn(`宿主建会话失败，退回 CLI：${created.error ?? '未知原因'}`);
    }

    // 默认让 Desktop 接管（会话已存在时）：宿主跑就不存在两个进程抢同一条会话的问题，
    // 你在界面里随时点开都能看。接不住（解析不出、迟迟不认领）才退回 CLI。
    if (turnMode() !== 'cli' && currentSessionId() !== '' && !hostDeadSessions.has(currentSessionId())) {
      if (await runViaHostAndWait(hostTurnTimeoutMs(), { isNew: false })) return;
      hostDeadSessions.add(currentSessionId());
      if (turnMode() === 'host') {
        await cards.finish(event.messageId, {
          title: '失败',
          color: 'red',
          note: `宿主没有接住这一轮（FEISHU_AGENT_TURN_MODE=host）。会话：${currentSessionId()}`,
        });
        turns.finish(turnEntry, 'error');
        return;
      }
    }

    // auto 模式：新会话也先让宿主建（这样从第一条消息起就只有宿主一个写者）；
    // 接不住就记住，之后新会话直接用 CLI，不再白试。
    if (turnMode() === 'auto' && currentSessionId() === '' && binding.workspaceId !== '' && !hostCreateUnusable) {
      const created = await host
        .createSession({ workspaceId: binding.workspaceId, agentPreset: effectiveAgentPreset })
        .catch((error) => ({ sessionId: '', error: errorMessage(error) }));
      if (created.sessionId !== '') {
        setSlotSessionId(activeSlot, created.sessionId);
        turnEntry.sessionId = created.sessionId;
        await host.attachToWorkspace(binding.workspaceId, created.sessionId).catch(() => {});
        if (await runViaHostAndWait(hostTurnTimeoutMs(), { isNew: true })) return;
        hostCreateUnusable = true;
        logger.warn('宿主建出的会话没被认领，之后新会话改用 CLI');
        // 空会话留在工作区里没有内容，把绑定清掉、让 CLI 另建一条。
        setSlotSessionId(activeSlot, '');
      } else {
        logger.warn(`宿主建会话失败，退回 CLI：${created.error ?? '未知原因'}`);
      }
    }

    // CLI 子进程（dsh headless）不支持指定 --model：若本地路由落到这里，改走主会话并如实标注，
    // 避免把远端模型会话误写进 localSessionId，也避免误标成「本地模型」。
    if (activeSlot === 'local') {
      logger.warn('宿主未能接管本地路由，回退到主会话由 CLI 执行');
      activeSlot = 'dsh';
      turnEntry.routeKind = 'dsh';
      turnEntry.routeLabel = route?.fallbackLabel ?? '已回退默认模型';
      turnEntry.canEscalate = false;
      turnEntry.sessionId = currentSessionId('dsh');
    }

    // 绑定里的会话若不在这个工作区（早期 CLI 用了 Desktop 的进程目录做 cwd），
    // 先丢掉它，按新会话重开，别让工具继续在错误的目录里跑。
    if (currentSessionId() !== '') {
      const stale = await host.findByIdPrefix(currentSessionId());
      if (stale !== undefined && stale.cwd !== binding.workspacePath) {
        logger.warn(`绑定的会话 ${currentSessionId()} 属于 ${stale.cwd}，不在 ${binding.workspacePath}，改用新会话`);
        setSlotSessionId(activeSlot, '');
      }
    }

    let result = await executor
      .run({
        runId,
        sessionId: currentSessionId(),
        prompt: text,
        cwd: binding.workspacePath,
        signal: controller.signal,
        onEvent: (eventLine) => {
          // 会话一出现就登记并挂载：长任务不该在整个执行期间都在侧边栏里隐身。
          if (typeof eventLine.sessionId === 'string' && eventLine.sessionId !== '' && currentSessionId() === '') {
            setSlotSessionId(activeSlot, eventLine.sessionId);
            void attachSession(eventLine.sessionId);
          }
          if (eventLine.type === 'status' && eventLine.phase === 'turn_start' && !started) {
            started = true;
            cards.markRunning(event.messageId, Number(eventLine.turn ?? 1));
          }
          if (eventLine.type === 'tool_call') cards.noteTool(event.messageId, eventLine.tool);
        },
      })
      .finally(() => runningRuns.delete(runId));

    // 绑定里的会话若带 agentPreset（早期由宿主 API 创建），CLI 的 --session-id 一律拒绝。
    // 这时清掉它、当作新会话重跑一次，而不是把错误甩给用户。
    if (!result.ok && /one-shot runner does not compose|does not exist/i.test(result.error ?? '') && currentSessionId() !== '') {
      logger.warn(`绑定的会话 ${currentSessionId()} 不能被 CLI 续写（${result.error}），改用新会话重试`);
      setSlotSessionId(activeSlot, '');
      result = await executor
        .run({
          runId: `${runId}_retry`,
          sessionId: '',
          prompt: text,
          cwd: binding.workspacePath,
          signal: controller.signal,
        })
        .finally(() => runningRuns.delete(runId));
    }

    // CLI 撞上「会话已被别人持有」：会话多半刚在桌面端打开，回退给宿主投喂。
    if (
      turnMode() !== 'cli' &&
      !result.ok &&
      /already owned by an active write handle/i.test(result.error ?? '') &&
      currentSessionId() !== ''
    ) {
      if (await runViaHost('刚被桌面端打开')) return;
    }

    // 新会话：把 CLI 返回的 sessionId 写进绑定，并补做一次归属（早期那次可能因为 header 没落盘而失败）。
    if (currentSessionId() === '' && result.sessionId !== '') {
      setSlotSessionId(activeSlot, result.sessionId);
    }
    if (result.sessionId !== '') await attachSession(result.sessionId);

    const record = turns.byFeishuMessage(event.messageId);
    if (result.ok) {
      const baseTitle = TURN_END_TITLES[result.turnEndKind] ?? '已完成';
      const title = turnEntry.routeLabel ? `${baseTitle} · ${turnEntry.routeLabel}` : baseTitle;
      // 降级/规则说明放在正文最前面：先说清「为什么不是你预期的路由」，再给回答。
      const note = [routeNote, typeof result.text === 'string' ? result.text.trim() : '']
        .filter((part) => part !== '')
        .join('\n\n');
      await cards.finish(event.messageId, {
        title,
        color: result.turnEndKind === 'completed' ? 'green' : 'orange',
        note: note === '' ? '（这一轮没有可显示的正文）' : note,
      });
      turns.finish(record, result.turnEndKind || 'completed');
      answerers.question.settleTurn(record);
      answerers.approval.settleTurn(record);
      onTurnFinished?.({ turn: record ?? turnEntry, kind: result.turnEndKind || 'completed', text: result.text ?? '' });
      logger.info(`CLI 执行完成：${event.messageId} → 会话 ${result.sessionId || currentSessionId()}（${result.durationMs}ms）`);
      return;
    }

    await cards.finish(event.messageId, {
      title: '失败',
      color: 'red',
      note: [routeNote, result.error || '执行失败'].filter((part) => part !== '').join('\n\n'),
    });
    turns.finish(record, 'failed');
    logger.warn(`CLI 执行失败：${event.messageId} → ${result.error}`);
  }

  return { run, sessionExists };
}
