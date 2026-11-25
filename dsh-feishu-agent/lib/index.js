/** 插件入口：把飞书长连接、绑定、回答卡、反问/审批应答、调度器串起来。 */

import { join, resolve } from 'node:path';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  APP_ID_ENV,
  APP_ID_REF,
  APP_SECRET_ENV,
  APP_SECRET_REF,
  DEFAULT_PERMISSION_PRESET,
  LOGGER_NAME,
  PLUGIN_NAME,
  STALE_EVENT_MS,
  STATE_DIR_ENV,
} from './common/constants.js';
import { createBinder, bindingKeyOf } from './core/binding.js';
import { createStore } from './core/store.js';
import { createTurnRegistry } from './core/turns.js';
import { createScheduler } from './core/scheduler.js';
import { findProjectRoot, loadEnvFile } from './common/env-file.js';
import { composeChats, readEnvConfig } from './core/env-config.js';
import { cleanUserText, parseCommand } from './core/text.js';
import { textCard, toastResponse } from './core/cards.js';
import { CARD_ACTION_EVENT, MESSAGE_EVENT, normalizeEvent } from './feishu/events.js';
import { createConnection } from './feishu/connection.js';
import { createOutbound } from './feishu/outbound.js';
import { createSessionBridge } from './host/session.js';
import { createCommandHandler } from './host/commands.js';
import { createGroupGate } from './host/group-gate.js';
import { createQuotedContext } from './host/quoted-context.js';
import { createSessionEventHandler } from './host/session-events.js';
import { createTurnRunner } from './host/turn-runner.js';
import { createCliExecutor, resolveCliPath } from './host/cli-executor.js';
import { createAnswerCards, flushAllAnswerCards } from './host/answer-cards.js';
import { createApprovalAnswerer, APPROVAL_EVENT } from './host/answerer-approval.js';
import { createQuestionAnswerer, USER_QUESTIONS_EVENT } from './host/answerer-question.js';
import { errorMessage } from './host/services.js';

/** 插件名（loader 条目的 name）。 */
export const name = PLUGIN_NAME;

/** 插件声明的依赖：Agent 注册表、会话控制器、工作区注册表。 */
export const inject = ['agents', 'sessionController', 'workspaceRegistry'];

/** 并发上限的默认值：同时最多跑几条飞书会话（每条会话内部的轮次本来就串行）。 */
const DEFAULT_MAX_CONCURRENT = 3;

/** 默认要从凭据存储注入 CLI 子进程的 provider key；配置里的 `cliEnvRefs` 可以覆盖。 */
const DEFAULT_CLI_ENV_REFS = ['DEEPSEEK_API_KEY'];

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
  const override = process.env[STATE_DIR_ENV] ?? process.env.DSH_FEISHU_AGENT_STATE_DIR;
  if (override) return override;
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'feishu-agent');
}

/** 插件包目录（`lib/` 的上一层）。 */
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

/**
 * 取 `.env` 的读取顺序。`FEISHU_AGENT_ENV_FILE` 给了就只读它；否则先读项目根
 * （上游第一个有 `.git` 的目录），再读插件包目录里的那份兜底。先读到的键赢，
 * 所以项目根的配置压过包内的。
 *
 * @returns 文件路径列表
 */
export function resolveEnvFiles() {
  const override = process.env.FEISHU_AGENT_ENV_FILE ?? process.env.DSH_FEISHU_AGENT_ENV_FILE;
  if (override !== undefined && override.trim() !== '') return [resolve(override.trim())];
  const files = [];
  const root = findProjectRoot(PACKAGE_DIR);
  if (root !== undefined && resolve(root) !== resolve(PACKAGE_DIR)) files.push(join(root, '.env'));
  files.push(join(PACKAGE_DIR, '.env'));
  return files;
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

  // 先把项目里的 `.env` 读进 process.env：凭据、状态目录、CLI home 都能写在那里。
  // 只补没设置的键，所以真实进程环境变量（launchctl 注入的那份）永远优先。
  for (const file of resolveEnvFiles()) await loadEnvFile(file, logger);
  // 环境变量是最高一层配置：owner、chat → 工作区映射、并发都能从这里给。
  const envConfig = readEnvConfig(process.env, logger);

  // ---------- 配置 ----------
  /** 本机私有配置（仓库外）：`$DSH_HOME/feishu-agent/local-config.json`；同名字段优先于 bundle 配置。 */
  let localConfig = {};

  /**
   * 取一项配置：本机私有配置优先，其次 bundle 配置。
   *
   * bundle 配置里的 volatile 字段在 loader 下是带 `get()` 的引用，统一交给 readConfigField 解包。
   *
   * @param key 配置字段名
   * @param fallback 缺省值
   * @returns 实际值
   */
  function configValue(key, fallback) {
    const local = localConfig[key];
    if (local !== undefined && local !== null) return readConfigField(local, fallback);
    return readConfigField(config[key], fallback);
  }

  const runtimeConfig = {
    get() {
      const bundledChats = readConfigField(config.chats, {}) ?? {};
      const localChats = localConfig.chats !== null && typeof localConfig.chats === 'object' && !Array.isArray(localConfig.chats)
        ? localConfig.chats
        : {};
      return {
        // chats 逐键浅合并：bundle → 本机配置 → 环境变量，后面的层覆盖前面的；`'*'` 再叠平铺默认值。
        chats: composeChats(bundledChats, localChats, envConfig),
        ownerOpenId: envConfig.ownerOpenId ?? configValue('ownerOpenId', ''),
        schedules: configValue('schedules', []),
        answerConcurrency:
          envConfig.answerConcurrency ?? (Number(configValue('answerConcurrency', DEFAULT_MAX_CONCURRENT)) || DEFAULT_MAX_CONCURRENT),
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
      const wanted = configValue('cliEnvRefs', DEFAULT_CLI_ENV_REFS);
      const refs = Array.isArray(wanted) && wanted.length > 0 ? wanted : DEFAULT_CLI_ENV_REFS;
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
   * 2. 模型 provider 的 key（`cliEnvRefs`，默认 `DEEPSEEK_API_KEY`）。provider 的 `apiKeyEnv`
   *    只从**进程环境**读，不读 `.credentials.yaml`；插件进程里没有这个变量，所以由这里注入。
   *
   * @returns 环境变量表
   */
  function cliEnv() {
    const home = configValue('cliHome', '') || process.env.FEISHU_AGENT_CLI_HOME || process.env.DSH_FEISHU_AGENT_CLI_HOME || '';
    const env = home === '' ? {} : { DSH_HOME: home };
    // 需要注入的 provider key（可配置覆盖）。
    const wanted = configValue('cliEnvRefs', DEFAULT_CLI_ENV_REFS);
    const refs = Array.isArray(wanted) && wanted.length > 0 ? wanted : DEFAULT_CLI_ENV_REFS;
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
    const appId = stored.appId || process.env[APP_ID_ENV] || process.env.DSH_FEISHU_AGENT_APP_ID || configValue('appId', '') || '';
    const appSecret =
      stored.appSecret || process.env[APP_SECRET_ENV] || process.env.DSH_FEISHU_AGENT_APP_SECRET || configValue('appSecret', '') || '';
    return { appId: String(appId), appSecret: String(appSecret) };
  }

  // ---------- 状态 ----------
  const stateDir = stateDirOf();
  // 本机私有配置：仓库里的 cordis.patch.yml 只放通用默认值，个人 chat_id / 路径 / provider 放这里。
  localConfig = await loadLocalConfig(stateDir, logger);

  /** 上次读到的 local-config.json 修改时间；变了就重读，改配置不用重启。 */
  let localConfigMtime = -1;

  /**
   * 热加载本机配置：`local-config.json` 的 mtime 变了就重读。
   *
   * 只覆盖本机配置这一层；`.env` 里的变量仍然是启动时读一次。
   *
   * @returns 读完后 resolve
   */
  async function refreshLocalConfig() {
    const file = join(stateDir, 'local-config.json');
    let info;
    try {
      info = await stat(file);
    } catch {
      return;
    }
    if (info.mtimeMs === localConfigMtime) return;
    localConfigMtime = info.mtimeMs;
    localConfig = await loadLocalConfig(stateDir, logger);
    logger.info('本机配置已热加载');
  }
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
      cliPath: resolveCliPath(configValue('cliPath', '')),
      cwd: process.cwd(),
      timeoutMs: Number(configValue('runTimeoutMs', 600000)) || 600000,
      profile: configValue('cliProfile', 'headless') || 'headless',
      // Desktop 进程里跑 CLI 时，子进程要写 profile 目录；Desktop 的沙箱不让写时就换一个可写的 DSH_HOME。
      extraEnv: cliEnv(),
    }),
  });
  let answerers;
  try {
    answerers = {
      question: createQuestionAnswerer({ logger, outbound, turns, pending, getOwner: () => owner() }),
      approval: createApprovalAnswerer({ logger, outbound, turns, pending, getOwner: () => owner() }),
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

  // ---------- 组合子模块 ----------
  /** 引用回复的上下文。 */
  const quotedContextOf = createQuotedContext({ cards, outbound });
  /** 文本命令。 */
  const handleCommand = createCommandHandler({
    binder,
    store,
    notice,
    runningRuns,
    getOwner: () => owner(),
    isConnected: () => runtime.connected,
  });
  /** 宿主会话事件。 */
  const onSessionEvent = createSessionEventHandler({ turns, cards, answerers, logger });
  /** 群聊门禁与动态接入。 */
  const groupGate = createGroupGate({
    store,
    binder,
    outbound,
    logger,
    getOwner: () => owner(),
    getGroupWorkspace: () => groupWorkspacePath(),
    notice,
    registrationEnabled: () => String(process.env.FEISHU_AGENT_GROUP_REGISTRATION ?? '').toLowerCase() !== 'off',
  });
  /** 一轮的执行器。 */
  const runViaCli = createTurnRunner({
    logger,
    binder,
    host,
    cards,
    turns,
    executor,
    runningRuns,
    answerers,
    getRuntimeConfig: () => runtimeConfig.get(),
    getService,
    getCliHome: () => configValue('cliHome', '') || process.env.FEISHU_AGENT_CLI_HOME || '',
  }).run;

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

  /**
   * 群聊默认落到哪个工作区：`groupWorkspace` → 环境变量 → 私聊通配的目录。
   *
   * @returns 目录路径；都没配时为空串
   */
  function groupWorkspacePath() {
    const configured = String(configValue('groupWorkspace', '') || process.env.FEISHU_AGENT_GROUP_WORKSPACE || '').trim();
    if (configured !== '') return configured;
    const wildcard = runtimeConfig.get().chats?.['*'];
    return typeof wildcard?.workspacePath === 'string' ? wildcard.workspacePath : '';
  }

  // ---------- 消息处理 ----------
  /**
   * 处理一条私聊/群聊消息。
   *
   * @param event 归一化后的消息事件
   */
  async function onMessage(event) {
    if (event.senderType === 'app') return;
    await refreshLocalConfig();

    // 挂着的自由文本反问：owner 在这个会话里的下一条普通消息就是答案。
    const rawText = typeof event.text === 'string' ? event.text.trim() : '';
    if (rawText !== '' && !rawText.startsWith('/') && event.senderOpenId === owner()
      && answerers.question.takeTextAnswer({ chatId: event.chatId, text: rawText })) {
      logger.info('这条消息被当作自由文本反问的答案');
      return;
    }

    const isGroup = event.chatType === 'group';
    // 群聊按「群」一条会话：忽略话题 ID，免得同一个群按话题裂成多条会话。
    const key = bindingKeyOf({
      appId: event.appId,
      tenantKey: event.tenantKey,
      chatId: event.chatId,
      threadId: isGroup ? '' : event.threadId,
    });

    if (!isGroup) {
      if (bootstrapOwner(event)) {
        await notice(event.chatId, '已绑定', '这是你的私人 Agent。第一条消息会按配置里的工作区建会话。');
      }
      const me = owner();
      if (me === '' || event.senderOpenId !== me) {
        logger.info(`拒绝非 owner 的消息（${event.senderOpenId || '未知'}）`);
        return;
      }
    } else if ((await groupGate.gate(event, key)) !== 'continue') {
      return;
    }
    const text = cleanUserText(event.text);
    if (text === '') return;

    // 命令必须在建绑定之前处理：`/new`、`/stop`、`/status` 都不该顺手建一条会话。
    const command = parseCommand(text);
    if (command !== undefined) {
      // 群聊里命令只给 owner：`/new`、`/stop` 这类会动到整条会话。
      if (isGroup && event.senderOpenId !== owner()) {
        await notice(event.chatId, '只有 owner 能用命令', '群聊里的 /new、/switch、/stop 只对 owner 生效。');
        return;
      }
      await handleCommand(event, key, command);
      return;
    }

    const binding = await binder
      .ensureBinding({
        key,
        appId: event.appId,
        tenantKey: event.tenantKey,
        chatId: event.chatId,
        chatType: event.chatType,
        threadId: event.threadId,
      })
      .catch(async (error) => {
        logger.warn(`建绑定失败：${errorMessage(error)}`);
        await notice(event.chatId, '无法建会话', errorMessage(error));
        return undefined;
      });
    if (binding === undefined) {
      await notice(event.chatId, '这个会话没有配置工作区', `请把 chat_id 「${event.chatId}」加到配置的 chats 里，指定 workspacePath。`);
      return;
    }

    // 引用回复时把被引用消息的正文补进这一轮，模型才有上下文。
    const quoted = await quotedContextOf(event);
    const promptText = quoted === '' ? text : `${quoted}\n\n${text}`;

    await runViaCli({ binding, key, event, text: promptText });
  }

  // ---------- 卡片回调 ----------
  /**
   * 处理卡片回传。
   *
   * @param event 归一化后的卡片事件
   * @returns 回调响应
   */
  async function onCardAction(event) {
    await refreshLocalConfig();
    const me = owner();
    if (me === '' || event.operatorOpenId !== me) return toastResponse('你不是这个机器人的主人', 'warning');
    const value = event.value ?? {};
    if (value.tag === 'group-register') return await groupGate.handleCard(event, value);
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
  // 上次进程留下的「处理中」卡片：那一轮不可能再收尾了，标成已中断。
  await cards.reconcileStale();
  const { appId, appSecret } = credentials();
  if (!appId || !appSecret) {
    logger.warn(`飞书凭据未配置：插件已加载但不会连飞书（设置 ${APP_ID_ENV} / ${APP_SECRET_ENV}）`);
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
