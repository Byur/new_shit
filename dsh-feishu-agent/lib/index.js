/** 插件入口：把飞书长连接、绑定、回答卡、反问/审批应答、调度器串起来。 */

import { join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import { APP_ID_REF, APP_SECRET_REF, DEFAULT_PERMISSION_PRESET, LOGGER_NAME, PLUGIN_NAME, STALE_EVENT_MS, TURN_END_TITLES } from './common/constants.js';
import { createBinder, bindingKeyOf } from './core/binding.js';
import { createStore } from './core/store.js';
import { createTurnRegistry } from './core/turns.js';
import { createScheduler } from './core/scheduler.js';
import { cleanUserText, parseCommand, textOfAssistantMessage } from './core/text.js';
import { textCard, toastResponse } from './core/cards.js';
import { CARD_ACTION_EVENT, MESSAGE_EVENT, normalizeEvent } from './feishu/events.js';
import { createConnection } from './feishu/connection.js';
import { createOutbound } from './feishu/outbound.js';
import { createSessionBridge } from './host/session.js';
import { createCliExecutor, resolveCliPath } from './host/cli-executor.js';
import { createAnswerCards, flushAllAnswerCards } from './host/answer-cards.js';
import { createApprovalAnswerer, APPROVAL_EVENT } from './host/answerer-approval.js';
import { createQuestionAnswerer, USER_QUESTIONS_EVENT } from './host/answerer-question.js';
import { errorMessage, userFacingSessionError } from './host/services.js';

/** 插件名（loader 条目的 name）。 */
export const name = PLUGIN_NAME;

/** 插件声明的依赖：Agent 注册表、会话控制器、工作区注册表。 */
export const inject = ['agents', 'sessionController', 'workspaceRegistry'];

/** 并发上限的默认值：同时最多跑几条飞书会话（每条会话内部的轮次本来就串行）。 */
const DEFAULT_MAX_CONCURRENT = 3;

/**
 * 读一个 config 字段：volatile 字段在 loader 下是带 `get()` 的引用。
 *
 * @param value 字段值
 * @param fallback 缺省值
 * @returns 实际值
 */
export function readConfigField(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get() ?? fallback;
  }
  return value ?? fallback;
}

/**
 * 取状态目录：环境变量优先，其次 `$DSH_HOME/feishu-agent`。
 *
 * @returns 目录路径
 */
function stateDirOf() {
  if (process.env.DSH_FEISHU_AGENT_STATE_DIR) return process.env.DSH_FEISHU_AGENT_STATE_DIR;
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'feishu-agent');
}

/**
 * 读本机的私有配置（`$DSH_HOME/feishu-agent/local-config.json`）。
 *
 * 仓库里的 bundle 配置只放通用默认值；个人 chat_id、工作区路径、provider/model
 * 放在这个文件里，既不进仓库，也不需要在 profile 的 cordis.patch.yml 里重复写。
 *
 * 用 JSON 而不是 YAML：插件要保持零外部依赖（不引入 yaml 包），
 * 而手写 YAML 解析器的一个缩进边界就足以让配置静默失效。
 *
 * @param stateDir 插件状态目录
 * @param logger 日志
 * @returns 配置对象；文件不存在或解析失败时返回空对象
 */
async function loadLocalConfig(stateDir, logger) {
  const file = join(stateDir, 'local-config.json');
  try {
    const text = await readFile(file, 'utf8');
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      logger.info(`已加载本机配置 ${file}`);
      return parsed;
    }
    logger.warn(`${file} 的内容不是对象，忽略`);
    return {};
  } catch (error) {
    if (error?.code === 'ENOENT') {
      logger.info(`没有本机配置 ${file}（只用 bundle 默认值）`);
    } else {
      logger.warn(`读取本机配置 ${file} 失败：${error?.message ?? error}`);
    }
    return {};
  }
}

/**
 * 插件入口。
 *
 * @param ctx Cordis 上下文
 * @param config 插件条目配置（可为空）
 */
export async function apply(ctx, config = {}) {
  const logger = ctx.logger(LOGGER_NAME);

  // ---------- 配置 ----------
  /** 本机私有配置（仓库外）：`$DSH_HOME/feishu-agent/local-config.json`；chats / ownerOpenId / schedules 优先取这里的值。 */
  let localConfig = {};

  const runtimeConfig = {
    get() {
      const bundledChats = readConfigField(config.chats, {}) ?? {};
      const localChats = localConfig.chats ?? {};
      const bundledSchedules = readConfigField(config.schedules, []) ?? [];
      return {
        // 精确键 + 通配 `'*'`；本机配置优先。
        chats: { ...bundledChats, ...localChats },
        ownerOpenId: localConfig.ownerOpenId ?? readConfigField(config.ownerOpenId, '') ?? '',
        schedules: localChats.schedules ?? bundledSchedules,
        answerConcurrency: Number(readConfigField(config.answerConcurrency, DEFAULT_MAX_CONCURRENT)) || DEFAULT_MAX_CONCURRENT,
      };
    },
  };

  /**
   * 取凭据：凭据服务优先，环境变量兜底。
   *
   * @returns `{ appId, appSecret }`
   */
  /** 从宿主凭据服务读到的凭据缓存；`undefined` 表示还没读。 */
  let storedCredentials;

  /**
   * 读凭据：优先宿主凭据存储（`$DSH_HOME/.credentials.yaml`），其次环境变量与插件 config。
   *
   * @returns `{ appId, appSecret }`
   */
  async function loadCredentials() {
    const credentials = ctx.get('credentials');
    let stored = { appId: '', appSecret: '', refs: {} };
    if (credentials !== undefined) {
      // 1) 飞书凭据。
      try {
        const [a, s] = await Promise.all([
          credentials.resolve(APP_ID_REF),
          credentials.resolve(APP_SECRET_REF),
        ]);
        stored.appId = String(a?.value ?? '');
        stored.appSecret = String(s?.value ?? '');
      } catch (error) {
        logger.warn(`读取飞书凭据失败，回退到环境变量：${error?.message ?? error}`);
      }
      // 2) CLI 子进程要用的 provider key（apiKeyEnv 只认进程环境）。
      const wanted = readConfigField(config.cliEnvRefs, ['CODEPLAN_API_KEY']);
      const refs = Array.isArray(wanted) && wanted.length > 0 ? wanted : ['CODEPLAN_API_KEY'];
      for (const ref of refs) {
        if (typeof ref !== 'string' || ref === '') continue;
        try {
          const resolved = await credentials.resolve(ref);
          if (typeof resolved?.value === 'string' && resolved.value !== '') stored.refs[ref] = resolved.value;
        } catch {
          // 缺就缺：子进程那边会报缺凭据。
        }
      }
    }
    storedCredentials = stored;
  }

  /**
   * 给 CLI 子进程的环境变量。
   *
   * 两件事：
   * 1. `DSH_HOME` 指向可写目录（Desktop 沙箱不允许子进程改写自己的 profile）；
   * 2. 模型 provider 的 key。`llm-pi-ai` 的 `apiKeyEnv: CODEPLAN_API_KEY` 只从**进程环境**读，
   *    不读 `.credentials.yaml`；而插件进程里没有这个变量，所以必须由这里注入。
   *
   * @returns 环境变量表
   */
  function cliEnv() {
    const home = readConfigField(config.cliHome, '') || process.env.DSH_FEISHU_AGENT_CLI_HOME || '';
    const env = home === '' ? {} : { DSH_HOME: home };
    // 需要注入的 provider key（可配置覆盖）。
    const wanted = readConfigField(config.cliEnvRefs, ['CODEPLAN_API_KEY']);
    const refs = Array.isArray(wanted) && wanted.length > 0 ? wanted : ['CODEPLAN_API_KEY'];
    for (const ref of refs) {
      if (typeof ref !== 'string' || ref === '' || process.env[ref] !== undefined) continue;
      const value = storedCredentials?.refs?.[ref];
      if (typeof value === 'string' && value !== '') env[ref] = value;
    }
    return env;
  }

  /**
   * 同步取凭据（连接层与出站层都用这个）。
   *
   * @returns `{ appId, appSecret }`
   */
  function credentials() {
    const stored = storedCredentials ?? { appId: '', appSecret: '' };
    const appId = stored.appId || process.env.DSH_FEISHU_AGENT_APP_ID || readConfigField(config.appId, '') || '';
    const appSecret = stored.appSecret || process.env.DSH_FEISHU_AGENT_APP_SECRET || readConfigField(config.appSecret, '') || '';
    return { appId: String(appId), appSecret: String(appSecret) };
  }

  // ---------- 状态 ----------
  const stateDir = stateDirOf();
  // 本机私有配置：仓库里的 cordis.patch.yml 只放通用默认值，个人 chat_id / 路径 / provider 放这里。
  localConfig = await loadLocalConfig(stateDir, logger);
  // 先把状态目录建出来：这是"插件确实跑起来了"的第一个可观测证据，也免得首轮绑定前目录不存在。
  await mkdir(stateDir, { recursive: true });
  const store = createStore({ dir: stateDir, logger });
  await store.load();
  // 配置里显式给了 owner 就以配置为准：状态文件里那份是上次自举留下的，换配置后不应继续压着它。
  const configuredOwner = runtimeConfig.get().ownerOpenId;
  if (configuredOwner !== '' && store.state.ownerOpenId !== configuredOwner) {
    store.state.ownerOpenId = configuredOwner;
    store.touch();
  }

  /** 取宿主服务；缺席返回 undefined（插件不因为可选服务缺席而挂掉）。 */
  const getService = (service) => ctx.get(service);

  const host = createSessionBridge({ ctx, logger, getService });
  const binder = createBinder({ logger, store, host, config: runtimeConfig });
  const outbound = createOutbound({ logger, getCredentials: credentials });
  const cards = createAnswerCards({ logger, outbound, stateDir });
  await cards.load();
  const pending = new Map();
  const turns = createTurnRegistry({ persist: () => store.touch() });

  /** 正在跑的 CLI 执行：runId → AbortController（停止按钮用）。 */
  const runningRuns = new Map();

  /** CLI 执行器：用 `dsh --profile headless` 子进程真正跑一轮。 */
  const executor = createCliExecutor({
    logger,
    getConfig: () => ({
      cliPath: resolveCliPath(readConfigField(config.cliPath, '')),
      cwd: process.cwd(),
      timeoutMs: Number(readConfigField(config.runTimeoutMs, 600000)) || 600000,
      profile: readConfigField(config.cliProfile, 'headless') || 'headless',
      // Desktop 进程里跑 CLI 时，子进程要写 profile 目录；Desktop 的沙箱不让写时就换一个可写的 DSH_HOME。
      extraEnv: cliEnv(),
    }),
  });
  let answerers;
  try {
    answerers = {
      question: createQuestionAnswerer({ logger, outbound, turns, pending }),
      approval: createApprovalAnswerer({ logger, outbound, turns, pending }),
    };
  } catch (error) {
      throw error;
  }

  /** 运行期状态：连接状态、在跑的会话、待处理队列。 */
  const runtime = {
    connected: false,
    lastError: '',
    running: new Map(),
    bootAt: Date.now(),
  };

  // ---------- owner ----------
  /**
   * 取 owner open_id：状态文件里的为准，没有就用配置里的。
   *
   * @returns open_id；都没有时空串
   */
  function owner() {
    return store.state.ownerOpenId || runtimeConfig.get().ownerOpenId || '';
  }

  /**
   * 首次私聊自举：把第一条私聊的发送者设为 owner。
   *
   * @param event 归一化后的消息事件
   * @returns 是否是刚自举的那个
   */
  function bootstrapOwner(event) {
    if (owner() !== '' || event.chatType !== 'p2p' || event.senderOpenId === '') return false;
    store.state.ownerOpenId = event.senderOpenId;
    store.touch();
    logger.info(`owner 自举：${event.senderOpenId}（之后只认这个账号）`);
    return true;
  }

  // ---------- 发送小工具 ----------
  /**
   * 给某个 chat 发一张提示卡。
   *
   * @param chatId 会话 ID
   * @param title 标题
   * @param content 正文
   */
  async function notice(chatId, title, content) {
    const card = textCard({ title, content });
    const messageId = await outbound.sendCard({ chatId, card });
    if (messageId === undefined) {
      logger.warn(`提示卡「${title}」没发到 ${chatId}（可能是限频，或飞书凭据失效）`);
    }
    return messageId;
  }

  // ---------- 消息处理 ----------
  /**
   * 处理一条私聊/群聊消息。
   *
   * @param event 归一化后的消息事件
   */
  async function onMessage(event) {
    if (event.senderType === 'app') return;
    if (bootstrapOwner(event)) {
      await notice(event.chatId, '已绑定', '这是你的私人 Agent。第一条消息会按配置里的工作区建会话。');
    }
    const me = owner();
    if (me === '' || event.senderOpenId !== me) {
      logger.info(`拒绝非 owner 的消息（${event.senderOpenId || '未知'}）`);
      return;
    }
    if (event.chatType === 'group') {
      logger.info('群聊消息暂不处理');
      return;
    }
    const key = bindingKeyOf(event);
    const text = cleanUserText(event.text);
    if (text === '') return;

    // 命令必须在建绑定之前处理：`/new`、`/stop`、`/status` 都不该顺手建一条会话。
    const command = parseCommand(text);
    if (command !== undefined) {
      await handleCommand(event, key, command);
      return;
    }

    const binding = await binder
      .ensureBinding({ key, appId: event.appId, tenantKey: event.tenantKey, chatId: event.chatId, threadId: event.threadId })
      .catch(async (error) => {
        logger.warn(`建绑定失败：${errorMessage(error)}`);
        await notice(event.chatId, '无法建会话', errorMessage(error));
        return undefined;
      });
    if (binding === undefined) {
      await notice(event.chatId, '这个会话没有配置工作区', `请把 chat_id 「${event.chatId}」加到配置的 chats 里，指定 workspacePath。`);
      return;
    }

    // 走 CLI 子进程执行：宿主内的 sessionController 只能排队，驱动循环跑不起来
    // （agent 的 phase 卡在非 idle，followup 的唤醒被挂起），所以改由 `dsh --profile headless` 真正跑一轮。
    await runViaCli({ binding, key, event, text });
  }

  /**
   * 用 CLI 跑一轮，并把事件流映射到回答卡。
   *
   * @param options.binding 会话绑定（新会话时 `dshSessionId` 为空）
   * @param options.key 绑定键
   * @param options.event 飞书消息事件
   * @param options.text 任务文本
   */
  async function runViaCli({ binding, key, event, text }) {
    const requestId = `f_${event.messageId}`;
    const runId = `run_${event.messageId}`;
    turns.open(event.messageId, { requestId, sessionId: binding.dshSessionId, chatId: event.chatId, bindingKey: key, text });
    await cards.open({ messageId: event.messageId, chatId: event.chatId, title: '排队中', action: 'withdraw' });

    // 并发上限：超过就排队等（这里简单等一等，不做完整队列）。
    const limit = runtimeConfig.get().answerConcurrency;
    while (executor.size() >= limit) await new Promise((resolve) => setTimeout(resolve, 200));

    const controller = new AbortController();
    runningRuns.set(runId, controller);
    let started = false;
    let toolCount = 0;

    let result = await executor
      .run({
        runId,
        sessionId: binding.dshSessionId || '',
        prompt: text,
        signal: controller.signal,
        onEvent: (eventLine) => {
          if (eventLine.type === 'status' && eventLine.phase === 'turn_start' && !started) {
            started = true;
            cards.markRunning(event.messageId, Number(eventLine.turn ?? 1));
          }
          if (eventLine.type === 'tool_call') {
            toolCount += 1;
            cards.append(event.messageId, `\n> 🔧 正在使用 ${eventLine.tool}${toolCount > 1 ? `（第 ${toolCount} 次）` : ''}\n`);
          }
        },
      })
      .finally(() => runningRuns.delete(runId));

    // 绑定里的会话若带 agentPreset（早期由宿主 API 创建），CLI 的 --session-id 一律拒绝。
    // 这时清掉它、当作新会话重跑一次，而不是把错误甩给用户。
    if (!result.ok && /one-shot runner does not compose|does not exist/i.test(result.error ?? '') && (binding.dshSessionId ?? '') !== '') {
      logger.warn(`绑定的会话 ${binding.dshSessionId} 不能被 CLI 续写（${result.error}），改用新会话重试`);
      binder.attachSessionId(key, '');
      binding.dshSessionId = '';
      result = await executor
        .run({
          runId: `${runId}_retry`,
          sessionId: '',
          prompt: text,
          signal: controller.signal,
        })
        .finally(() => runningRuns.delete(runId));
    }

    // 新会话：把 CLI 返回的 sessionId 写进绑定。
    if ((binding.dshSessionId === '' || binding.dshSessionId === undefined) && result.sessionId !== '') {
      binder.attachSessionId(key, result.sessionId);
      // 补 Workspace 归属（CLI 建的会话没有归属）：Pod 里登记到配置的工作区。
      void host.attachToWorkspace(binding.workspaceId, result.sessionId).catch((error) => {
        logger.warn(`会话 ${result.sessionId} 归属工作区失败（后续再处理）：${errorMessage(error)}`);
      });
    }

    const record = turns.byFeishuMessage(event.messageId);
    if (result.ok) {
      await cards.finish(event.messageId, {
        title: TURN_END_TITLES[result.turnEndKind] ?? '已完成',
        color: result.turnEndKind === 'completed' ? 'green' : 'orange',
        note: typeof result.text === 'string' && result.text.trim() !== '' ? result.text : '（这一轮没有可显示的正文）',
      });
      turns.finish(record, result.turnEndKind || 'completed');
      answerers.question.settleTurn(record);
      answerers.approval.settleTurn(record);
      logger.info(`CLI 执行完成：${event.messageId} → 会话 ${result.sessionId || binding.dshSessionId}（${result.durationMs}ms）`);
      return;
    }

    await cards.finish(event.messageId, {
      title: '失败',
      color: 'red',
      note: result.error || '执行失败',
    });
    turns.finish(record, 'failed');
    logger.warn(`CLI 执行失败：${event.messageId} → ${result.error}`);
  }

  /**
   * 处理文本命令。
   *
   * @param event 消息事件
   * @param key 绑定键
   * @param command `{ name, arg }`
   */
  async function handleCommand(event, key, command) {
    const binding = binder.get(key);
    switch (command.name) {
      case 'new': {
        // CLI 路径下"新建会话"= 清空绑定里的 sessionId，下一条消息会让 CLI 建一条新会话。
        if (binding === undefined) {
          await notice(event.chatId, '还没有绑定', '先发一条消息建绑定。');
          return;
        }
        binding.dshSessionId = '';
        binding.updatedAt = new Date().toISOString();
        store.touch();
        await notice(event.chatId, '已新建会话', `下一条消息会开一条新会话\n工作区：${binding.workspacePath}`);
        return;
      }
      case 'switch': {
        const result = await binder.switchSession(key, command.arg);
        await notice(event.chatId, '切换会话', result.error ?? `现在绑定到 ${result.binding.dshSessionId}（${result.binding.title || '无标题'}）`);
        return;
      }
      case 'stop': {
        let cancelled = 0;
        for (const controller of runningRuns.values()) {
          controller.abort();
          cancelled += 1;
        }
        await notice(event.chatId, '停止', cancelled > 0 ? `已请求停止 ${cancelled} 个执行` : '当前没有在跑的任务');
        return;
      }
      case 'status': {
        const lines = [
          `owner：${owner() || '（未绑定）'}`,
          `绑定：${binding ? `${binding.dshSessionId}` : '（还没有）'}`,
          binding ? `工作区：${binding.workspacePath}` : '',
          binding ? `权限预设：${binding.permissionPreset || DEFAULT_PERMISSION_PRESET}` : '',
          `连接：${runtime.connected ? '已连接' : '未连接'}`,
        ].filter((line) => line !== '');
        await notice(event.chatId, '状态', lines.join('\n'));
        return;
      }
      case 'help':
      default: {
        await notice(event.chatId, '可用命令', [
          '/new —— 在当前工作区新建会话',
          '/switch <会话ID前缀> —— 切换到这个工作区里的另一条会话',
          '/stop —— 停止当前这一轮',
          '/status —— 看当前绑定与连接状态',
          '/help —— 这份说明',
        ].join('\n'));
      }
    }
  }

  // ---------- 卡片回调 ----------
  /**
   * 处理卡片回传。
   *
   * @param event 归一化后的卡片事件
   * @returns 回调响应
   */
  async function onCardAction(event) {
    const me = owner();
    if (me === '' || event.operatorOpenId !== me) return toastResponse('你不是这个机器人的主人', 'warning');
    const value = event.value ?? {};
    if (value.tag === 'question') return answerers.question.handleCard(value);
    if (value.tag === 'approval') return answerers.approval.handleCard(value);
    if (value.tag !== 'answer') return toastResponse('不认识的操作', 'warning');

    const record = cards.get(String(value.messageId ?? ''));
    if (record === undefined) return toastResponse('这张卡片已经结束了', 'info');
    const turn = turns.byFeishuMessage(String(value.messageId ?? ''));
    const sessionId = turn?.sessionId;
    if (sessionId === undefined) return toastResponse('找不到对应的会话', 'warning');

    if (value.action === 'stop') {
      await cards.replace(value.messageId, textCard({ title: '正在停止', content: '已请求停止当前这一轮。', color: 'grey' }), '正在停止');
      const controller = runningRuns.get(`run_${value.messageId}`);
      if (controller === undefined) return toastResponse('这一轮已经结束了', 'info');
      controller.abort();
      return toastResponse('已请求停止', 'info');
    }
    if (value.action === 'withdraw') {
      const controller = runningRuns.get(`run_${value.messageId}`);
      if (controller !== undefined) return toastResponse('已经开跑，只能停止', 'warning');
      cards.drop(value.messageId);
      turns.finish(turn, 'withdrawn');
      return toastResponse('已撤回', 'success');
    }
    return toastResponse('不认识的操作', 'warning');
  }

  // ---------- 宿主流 ----------
  /**
   * 宿主会话事件：认领轮次、追加正文、收尾。
   *
   * @param session 会话
   * @param event 会话事件
   */
  function onSessionEvent(session, event) {
    const sessionId = String(session?.id ?? session?.header?.id ?? '');
    const type = event?.type ?? '';
    const data = event?.data ?? {};
    try {
      if (type === 'user/message') {
        const rpcId = data?.source?.kind === 'user' ? String(data.source.rpcId ?? '') : '';
        if (rpcId === '') return;
        const claimed = turns.claim(rpcId, Number(data?.turn ?? 0));
        if (claimed === undefined) return;
        const record = turns.byFeishuMessage(claimed.feishuMessageId);
        if (record !== undefined) record.hostMessageId = String(data?.message?.id ?? '');
        cards.markRunning(claimed.feishuMessageId, Number(data?.turn ?? 0));
        return;
      }
      if (type === 'assistant/message') {
        const turn = turns.turnOf(sessionId, Number(data?.turn ?? 0));
        if (turn === undefined) return;
        cards.append(turn.feishuMessageId, textOfAssistantMessage(data?.message));
        return;
      }
      if (type === 'turn/end') {
        const turnNo = Number(data?.turn ?? 0);
        const turn = turns.turnOf(sessionId, turnNo);
        if (turn === undefined) return;
        const kind = String(data?.reason?.kind ?? 'completed');
        const title = TURN_END_TITLES[kind] ?? '已完成';
        const color = kind === 'error' ? 'red' : kind === 'aborted' ? 'orange' : 'green';
        const note = kind === 'error' ? `结束原因：${data?.reason?.message ?? data?.reason?.code ?? 'error'}` : '';
        void cards.finish(turn.feishuMessageId, { title, color, note });
        answerers.question.settleTurn(turn);
        answerers.approval.settleTurn(turn);
        turns.finish(turn, kind);
      }
    } catch (error) {
      logger.warn(`处理会话事件 ${type} 失败：${errorMessage(error)}`);
    }
  }

  // ---------- 调度 ----------
  /**
   * 定时任务到点：找到该 chat 的绑定，投喂一条主动消息。
   *
   * @param schedule 任务记录
   */
  async function onScheduleDue(schedule) {
    const key = Object.keys(store.state.bindings).find((item) => item.endsWith(`:${schedule.chatId}:-`))
      ?? Object.keys(store.state.bindings).find((item) => item.includes(`:${schedule.chatId}:`));
    const binding = key === undefined ? undefined : store.state.bindings[key];
    if (binding === undefined) {
      await notice(schedule.chatId, '定时任务跳过', `没有找到 chat ${schedule.chatId} 的绑定，先发一条消息建会话。`);
      return;
    }
    const runId = `run_sched_${schedule.id}_${Date.now()}`;
    logger.info(`定时任务 ${schedule.id} 开始执行`);
    const result = await executor.run({
      runId,
      sessionId: binding.dshSessionId || '',
      prompt: schedule.prompt,
    });
    if (!result.ok) {
      await notice(schedule.chatId, '定时任务失败', result.error || '执行失败');
      return;
    }
    if (binding.dshSessionId === '' && result.sessionId !== '') {
      binder.attachSessionId(key, result.sessionId);
      void host.attachToWorkspace(binding.workspaceId, result.sessionId).catch(() => {});
    }
    // 主动发一张结果卡（不回复任何用户消息）。
    await outbound.sendCard({
      chatId: schedule.chatId,
      card: textCard({
        title: `定时任务：${schedule.title ?? schedule.id}`,
        content: result.text || '（没有正文）',
        color: 'blue',
      }),
    });
  }

  const scheduler = createScheduler({ logger, store, onDue: onScheduleDue });

  // ---------- 接入 ----------
  /**
   * 飞书事件入口：迟到丢弃 → 去重 → 分派。
   *
   * @param type 事件名
   * @param payload 飞书原始事件
   * @returns 回调响应（卡片回调要有）
   */
  async function onFeishuEvent(type, payload) {
    const event = normalizeEvent(type, payload);
    if (event === undefined) return undefined;
    if (event.timeMs !== undefined && Date.now() - event.timeMs > STALE_EVENT_MS) {
      logger.info(`丢弃迟到事件 ${type}（${Date.now() - event.timeMs}ms 前）`);
      return type === CARD_ACTION_EVENT ? toastResponse('这条交互已过期', 'warning') : undefined;
    }
    logger.info(`收到事件 ${type} id=${event.eventId} chat=${event.chatId ?? ''} sender=${event.senderOpenId ?? event.operatorOpenId ?? ''}`);
    // 只按事件 ID 去重。卡片回调不能按 open_message_id 去重（同一张卡会被点多次），用户消息也不能
    // 按 message_id 去重（那是同一条消息的重投，event_id 已经覆盖了）。
    if (event.eventId !== '' && !store.rememberEvent(event.eventId)) {
      logger.info(`重复事件，忽略：${event.eventId}`);
      return type === CARD_ACTION_EVENT ? toastResponse('已处理过', 'info') : undefined;
    }
    if (type === MESSAGE_EVENT) {
      void onMessage(event).catch((error) => logger.warn(`处理消息失败：${error?.message ?? error}`));
      return undefined;
    }
    if (type === CARD_ACTION_EVENT) {
      try {
        return await onCardAction(event);
      } catch (error) {
        logger.warn(`处理卡片回调失败：${error?.message ?? error}`);
        return toastResponse('处理失败，请重试', 'error');
      }
    }
    return undefined;
  }

  const connection = createConnection({
    logger,
    getCredentials: credentials,
    onEvent: onFeishuEvent,
    onStatus: (status) => {
      runtime.connected = status.connected === true;
      if (status.error) runtime.lastError = status.error;
    },
  });

  // ---------- 订阅 ----------
  const disposers = [];
  disposers.push(ctx.on('session/event', onSessionEvent));
  if (getService('userQuestions') !== undefined) {
    disposers.push(ctx.on(USER_QUESTIONS_EVENT, (request, next) => answerers.question.onRequest(request, next), { prepend: true }));
    logger.info(`已订阅 ${USER_QUESTIONS_EVENT}`);
  } else {
    logger.warn('宿主没有 userQuestions 服务：反问不会弹到飞书');
  }
  if (getService('approval') !== undefined) {
    disposers.push(ctx.on(APPROVAL_EVENT, (request, next) => answerers.approval.onRequest(request, next), { prepend: true }));
    logger.info(`已订阅 ${APPROVAL_EVENT}`);
  } else {
    logger.warn('宿主没有 approval 服务：审批不会弹到飞书');
  }

  // ---------- 启动 ----------
  scheduler.start();
  await loadCredentials();
  const { appId, appSecret } = credentials();
  if (!appId || !appSecret) {
    logger.warn('飞书凭据未配置：插件已加载但不会连飞书（设置 DSH_FEISHU_AGENT_APP_ID / DSH_FEISHU_AGENT_APP_SECRET）');
  } else {
    try {
      await connection.start();
        } catch (error) {
          throw error;
    }
  }

  // 首次落盘：apply 结束就把状态写出来，既是"插件确实跑起来了"的证据，也让重启后能恢复 owner/绑定。
  await store.save(true);

  ctx.on('dispose', () => {
    scheduler.stop();
    connection.stop();
    answerers.question.dispose();
    answerers.approval.dispose();
    for (const dispose of disposers) dispose();
    // 落盘要等在途的写卡任务与状态写完成，否则下一次启动会读到半截。
    void (async () => {
      await flushAllAnswerCards();
      await store.save();
      logger.info('插件已卸载');
    })();
  });

  logger.info(`插件已加载（状态目录 ${stateDir}，owner ${owner() || '未绑定'}${configuredOwner !== '' ? '，来自配置' : ''}）`);
}
