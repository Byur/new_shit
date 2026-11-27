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
import { buildCard, button, buttonRow, markdown, textCard, toastResponse } from './core/cards.js';
import { ROUTES, ROUTE_COMMANDS, createIntentRouter, createRouteHistory, normalizeRouterConfig } from './core/router.js';
import {
  NOTE_MODE_DEFAULT_MINUTES,
  createNoteMode,
  formatRemaining,
} from './core/note-mode.js';
import { createOllamaClient } from './local/ollama.js';
import { createHealthMonitor } from './local/ollama-health.js';
import { createObsidianInbox } from './local/obsidian-inbox.js';
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

  /** 运行时开关覆盖：`/router on|off` 设置，`undefined` 时用配置文件。 */
  let routerEnabledOverride;

  const runtimeConfig = {
    get() {
      const bundledChats = readConfigField(config.chats, {}) ?? {};
      const localChats = localConfig.chats !== null && typeof localConfig.chats === 'object' && !Array.isArray(localConfig.chats)
        ? localConfig.chats
        : {};
      const router = normalizeRouterConfig(readConfigField(config.router, {}), localConfig.router, process.env);
      if (routerEnabledOverride !== undefined) router.enabled = routerEnabledOverride;
      return {
        // chats 逐键浅合并：bundle → 本机配置 → 环境变量，后面的层覆盖前面的；`'*'` 再叠平铺默认值。
        chats: composeChats(bundledChats, localChats, envConfig),
        ownerOpenId: envConfig.ownerOpenId ?? configValue('ownerOpenId', ''),
        schedules: configValue('schedules', []),
        answerConcurrency:
          envConfig.answerConcurrency ?? (Number(configValue('answerConcurrency', DEFAULT_MAX_CONCURRENT)) || DEFAULT_MAX_CONCURRENT),
        router,
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
  /** 意图路由：本地 Ollama 分类器、Obsidian 速记、跨路由短期历史、卡片纠错缓存。 */
  const ollama = createOllamaClient({
    fetchImpl: (...args) => (globalThis.__dshFeishuAgentOllamaFetch ?? globalThis.fetch)(...args),
  });
  const obsidianInbox = createObsidianInbox();
  const routeHistory = createRouteHistory();
  // 健康监控只建一次：嗅探结果与熔断状态要跨消息复用，否则每条消息都会重新探一遍。
  const healthMonitor = createHealthMonitor({ ollama });
  const intentRouter = createIntentRouter({ ollama, history: routeHistory, logger, health: healthMonitor });
  /** 速记模式窗口（内存态，进程重启即失效）。 */
  const noteMode = createNoteMode();
  /** feishuMessageId → 卡片纠错/撤销上下文（上限 100 条）。 */
  const routeActions = new Map();

  function saveRouteAction(messageId, entry) {
    if (typeof messageId !== 'string' || messageId === '') return;
    routeActions.set(messageId, entry);
    while (routeActions.size > 100) {
      const oldest = routeActions.keys().next().value;
      if (oldest === undefined) break;
      routeActions.delete(oldest);
    }
  }

  function onTurnFinished({ turn, text }) {
    if (turn === undefined) return;
    routeHistory.record(turn.chatId, {
      route: turn.routeKind || 'dsh',
      user: turn.originalText || turn.text,
      assistant: text,
    });
  }

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
    getRouterConfig: () => runtimeConfig.get().router,
    setRouterEnabled: (enabled) => {
      routerEnabledOverride = enabled;
    },
    getRouterStatus: () => ({
      config: runtimeConfig.get().router,
      override: routerEnabledOverride,
      stats: intentRouter.stats,
      // 命令层要能展示「本地模型：open/closed（连续失败 N 次，剩余 Xs）」。
      health: healthMonitor.snapshot(),
    }),
    ollama,
  });
  /** 宿主会话事件。 */
  const onSessionEvent = createSessionEventHandler({ turns, cards, answerers, logger, onTurnFinished });
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
    onTurnFinished,
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
   * 发一张卡片，发不出去时记一条日志。
   *
   * @param chatId 会话 ID
   * @param card 卡片
   * @param label 日志里的名字
   * @returns 消息 ID（失败时 undefined）
   */
  async function sendCard(chatId, card, label) {
    const messageId = await outbound.sendCard({ chatId, card });
    if (messageId === undefined) {
      logger.warn(`卡片「${label}」没发到 ${chatId}（可能是限频，或飞书凭据失效）`);
    }
    return messageId;
  }

  /**
   * 给某个 chat 发一张提示卡。
   *
   * @param chatId 会话 ID
   * @param title 标题
   * @param content 正文
   * @param buttons 正文下方的按钮（可选）
   */
  async function notice(chatId, title, content, buttons) {
    return sendCard(chatId, textCard({ title, content, buttons }), title);
  }

  /**
   * 造一个速记模式按钮。
   *
   * @param text 按钮文字
   * @param action `on` / `off` / `extend`
   * @param type 按钮样式
   * @returns 按钮元素
   */
  function noteModeButton(text, action, type = 'default') {
    return button({ name: `note_mode_${action}`, text, type, value: { tag: 'note-mode', action } });
  }

  /**
   * 速记模式的状态卡：开启时显示剩余时间与本次已写入条数。
   *
   * @param chatId 会话 ID
   * @returns 卡片
   */
  function noteModeCard(chatId) {
    const state = noteMode.status(chatId);
    if (!state.active) {
      return textCard({
        title: '速记模式未开启',
        content: [
          '开启后，接下来一段时间内的每条消息都会直接写进「待整理/飞书速记」，不经过分类器。',
          '',
          '适合连续口述多条速记：说一句「开始速记」，然后连着说，不用每条都加触发词。',
        ].join('\n'),
        buttons: [noteModeButton(`开启速记 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`, 'on', 'primary')],
      });
    }
    return textCard({
      title: '速记模式已开启',
      content: [
        '接下来每条消息都会直接写进「待整理/飞书速记」，不经过分类器。',
        '',
        `- 剩余：${formatRemaining(state.remainingMs)}`,
        `- 本次已写入：${state.count} 条`,
        '- 提前结束：/note off',
      ].join('\n'),
      color: 'green',
      buttons: [noteModeButton('结束速记', 'off'), noteModeButton(`延长 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`, 'extend')],
    });
  }

  /**
   * 解析 `/note on|off|status` 以及 `/note on 30`。
   *
   * 返回 `undefined` 表示这不是速记开关，而是普通的 `/note <内容>`。
   *
   * @param arg 命令参数
   * @returns `{ action, minutes }`；不匹配时 undefined
   */
  function parseNoteModeArg(arg) {
    const match = /^(on|off|status)(?:\s+(\d{1,3}))?$/i.exec(String(arg ?? '').trim());
    if (match === null) return undefined;
    return {
      action: match[1].toLowerCase(),
      minutes: match[2] === undefined ? undefined : Number(match[2]),
    };
  }

  /**
   * 执行速记开关并回一张状态卡。
   *
   * @param chatId 会话 ID
   * @param action `on` / `off` / `status`
   * @param minutes 开启或延长的分钟数（可选）
   */
  async function applyNoteMode(chatId, action, minutes) {
    if (action === 'on') {
      // 没有待整理目录时不要开窗：否则每条消息都会降级成一次远端调用，用户还以为在记事。
      if (!runtimeConfig.get().router?.routes?.obsidian?.inboxDir) {
        await notice(
          chatId,
          '无法开启速记模式',
          '未配置 Obsidian 待整理目录。请先在 router.routes.obsidian.inboxDir（或 FEISHU_AGENT_OBSIDIAN_INBOX_DIR）里指定。',
        );
        return;
      }
      noteMode.enable(chatId, { minutes });
      await sendCard(chatId, noteModeCard(chatId), '速记模式已开启');
      return;
    }
    if (action === 'off') {
      const before = noteMode.disable(chatId);
      const card = textCard({
        title: '速记模式已结束',
        content: before.active
          ? `本次速记共写入 ${before.count} 条。之后的消息恢复正常路由。`
          : '速记模式本来就没有开启。',
        buttons: [noteModeButton(`再开启 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`, 'on')],
      });
      await sendCard(chatId, card, '速记模式已结束');
      return;
    }
    await sendCard(chatId, noteModeCard(chatId), '速记模式状态');
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

    // 命令必须在建绑定之前处理：`/new`、`/stop`、`/status`、`/router` 都不该顺手建一条会话。
    const command = parseCommand(text);
    // `/note on|off|status` 是速记模式的开关；其余 `/note <内容>` 仍是单次写入。
    const noteModeArg = command !== undefined && command.name === 'note' ? parseNoteModeArg(command.arg) : undefined;
    if (noteModeArg !== undefined) {
      if (isGroup) {
        await notice(event.chatId, '群聊不支持速记模式', '速记模式只在私聊里开启，避免把群里的聊天全部写进笔记。');
        return;
      }
      await applyNoteMode(event.chatId, noteModeArg.action, noteModeArg.minutes);
      return;
    }
    let forcedRoute;
    let effectiveText = text;
    if (command !== undefined) {
      if (ROUTE_COMMANDS[command.name] === undefined) {
        // 群聊里命令只给 owner：`/new`、`/stop` 这类会动到整条会话。
        if (isGroup && event.senderOpenId !== owner()) {
          await notice(event.chatId, '只有 owner 能用命令', '群聊里的 /new、/switch、/stop、/router 只对 owner 生效。');
          return;
        }
        await handleCommand(event, key, command);
        return;
      }
      forcedRoute = ROUTE_COMMANDS[command.name];
      effectiveText = command.arg;
      if (isGroup && forcedRoute === ROUTES.OBSIDIAN && event.senderOpenId !== owner()) {
        await notice(event.chatId, '只有 owner 能写入待整理', '群聊里的 /note 命令只对 owner 生效。');
        return;
      }
    }

    // 引用回复时把被引用消息的正文补进这一轮，路由分类与模型都有上下文。
    const quoted = await quotedContextOf(event);
    if (forcedRoute !== undefined && effectiveText === '' && quoted === '') {
      await notice(event.chatId, '缺少内容', `用法：/${command.name} <内容>（或先引用一条消息再发 /${command.name}）`);
      return;
    }

    const routerConfig = runtimeConfig.get().router;
    const decision = await intentRouter.decide({
      chatId: event.chatId,
      isGroup,
      text: effectiveText,
      quoted,
      forcedRoute,
      noteMode: !isGroup && noteMode.isActive(event.chatId),
      config: routerConfig,
    });
    if (decision.source !== 'bypass') {
      logger.info(
        `意图路由：${decision.route}（${decision.source}，置信度 ${decision.confidence.toFixed(2)}${decision.reason ? `，${decision.reason}` : ''}）`,
      );
    }

    // 分支 A：Obsidian 速记（不建工作区绑定，直接写入当天文件并回带撤销/转交按钮的确认卡）。
    if (decision.route === ROUTES.OBSIDIAN) {
      const inboxDir = routerConfig.routes.obsidian.inboxDir;
      if (!inboxDir) {
        await notice(
          event.chatId,
          '未配置 Obsidian 待整理目录',
          '请在配置的 router.routes.obsidian.inboxDir（或环境变量 FEISHU_AGENT_OBSIDIAN_INBOX_DIR）中指定目录。',
        );
        return;
      }
      const written = await obsidianInbox.appendItems({
        inboxDir,
        items: decision.obsidianItems,
        messageId: event.messageId,
        quoted,
      });
      if (!written.ok) {
        await notice(event.chatId, '写入待整理失败', written.error || '未知错误');
        return;
      }
      routeHistory.record(event.chatId, {
        route: ROUTES.OBSIDIAN,
        user: effectiveText || quoted,
        assistant: `已记入 ${written.fileName}`,
      });
      saveRouteAction(event.messageId, {
        chatId: event.chatId,
        key,
        event,
        originalText: effectiveText,
        quoted,
        obsidianFilePath: written.filePath,
        obsidianFileName: written.fileName,
        obsidianItems: written.writtenItems,
        route: ROUTES.OBSIDIAN,
      });
      const dshLabel = routerConfig.routes.dsh.label || '4.1 Flash';
      // 速记模式下每条确认卡都带上剩余时间与「结束速记」，不用再翻命令。
      const noteState = noteMode.status(event.chatId);
      const trackedCount = noteState.active ? noteMode.record(event.chatId) : 0;
      const bullets = written.writtenItems.map((item) => `- ${item}`).join('\n');
      const noteLine = noteState.active
        ? `\n\n速记中 · 剩余 ${formatRemaining(noteState.remainingMs)} · 本次第 ${trackedCount} 条`
        : '';
      const footerButtons = [
        button({
          name: 'undo_note',
          text: '撤销写入',
          value: { tag: 'route', action: 'undo-note', messageId: event.messageId },
        }),
        button({
          name: 'note_to_dsh',
          text: `改交 ${dshLabel} 处理`,
          value: { tag: 'route', action: 'note-to-dsh', messageId: event.messageId },
        }),
      ];
      // 群聊不参与速记模式，确认卡也就不放这个入口。
      if (!isGroup) {
        footerButtons.push(
          noteState.active
            ? noteModeButton('结束速记', 'off')
            : noteModeButton(`开启速记 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`, 'on'),
        );
      }
      const card = buildCard({
        title: noteState.active ? '速记中 · 已记入待整理' : `已记入待整理 · ${written.fileName}`,
        color: 'green',
        elements: [
          markdown(`${bullets}${noteLine}`),
          buttonRow(footerButtons),
        ],
      });
      await outbound.replyCard({ chatId: event.chatId, messageId: event.messageId, card });
      return;
    }

    // 分支 B：主会话（DSH）或本地模型会话（LOCAL）。
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

    const cross = decision.needsCrossContext
      ? routeHistory.crossContextFor(event.chatId, decision.route, { windowSec: routerConfig.contextWindowSec })
      : '';
    const promptText = [cross, quoted, effectiveText].filter(Boolean).join('\n\n');

    const routeCfg = routerConfig.routes[decision.route] ?? {};
    const dshLabel = routerConfig.routes.dsh?.label || '4.1 Flash';
    // 降级与规则结果是用户可见的事实：只有真的没经过分类器时才加标题前缀与说明行，
    // 正常分类路径保持干净，避免每条消息都顶着一行噪音。
    const fallbackNotes = decision.source === 'fallback'
      ? {
          cardTitlePrefix: '[飞书·兜底]',
          note: decision.reasonText || `本地分类器不可用，已直接走 ${dshLabel}`,
        }
      : decision.source === 'rule' && decision.noteAction === 'query'
        ? { cardTitlePrefix: '[飞书·读笔记]', note: '读取/整理笔记需要远端模型' }
        : { cardTitlePrefix: '', note: '' };
    const routeOption = decision.source === 'bypass'
      ? undefined
      : {
          kind: decision.route,
          label: routeCfg.label || (decision.route === ROUTES.LOCAL ? '本地模型' : '4.1 Flash'),
          provider: routeCfg.provider || '',
          model: routeCfg.model || '',
          permissionPreset: routeCfg.permissionPreset || '',
          agentPreset: routeCfg.agentPreset || '',
          titlePrefix: routeCfg.titlePrefix || '',
          cardTitlePrefix: fallbackNotes.cardTitlePrefix,
          note: fallbackNotes.note,
          canEscalate: decision.route === ROUTES.LOCAL,
          escalateLabel: dshLabel,
          originalText: effectiveText,
        };

    if (decision.route === ROUTES.LOCAL) {
      saveRouteAction(event.messageId, {
        chatId: event.chatId,
        key,
        event,
        originalText: effectiveText,
        quoted,
        route: ROUTES.LOCAL,
      });
    }

    await runViaCli({ binding, key, event, text: promptText, route: routeOption });
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
    if (value.tag === 'note-mode') {
      const chatId = event.chatId;
      if (chatId === '') return toastResponse('这条操作缺少会话信息', 'warning');
      const action = String(value.action ?? '');
      if (action === 'on') {
        if (!runtimeConfig.get().router?.routes?.obsidian?.inboxDir) {
          return toastResponse('未配置 Obsidian 待整理目录，无法开启', 'warning');
        }
        noteMode.enable(chatId);
        return toastResponse('速记模式已开启', 'success', noteModeCard(chatId));
      }
      if (action === 'extend') {
        noteMode.extend(chatId);
        return toastResponse(`已延长 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`, 'success', noteModeCard(chatId));
      }
      if (action === 'off') {
        const before = noteMode.disable(chatId);
        return toastResponse(
          '速记模式已结束',
          'info',
          textCard({
            title: '速记模式已结束',
            content: before.active
              ? `本次速记共写入 ${before.count} 条。之后的消息恢复正常路由。`
              : '速记模式本来就没有开启。',
            buttons: [noteModeButton(`再开启 ${NOTE_MODE_DEFAULT_MINUTES} 分钟`, 'on')],
          }),
        );
      }
      return toastResponse('不认识的操作', 'warning');
    }
    if (value.tag === 'group-register') return await groupGate.handleCard(event, value);
    if (value.tag === 'question') return answerers.question.handleCard(value);
    if (value.tag === 'approval') return answerers.approval.handleCard(value);
    if (value.tag === 'route') {
      const msgId = String(value.messageId ?? '');
      const actionRec = routeActions.get(msgId);
      if (actionRec === undefined) return toastResponse('这条操作已过期', 'info');

      const routerConfig = runtimeConfig.get().router;
      const dshCfg = routerConfig.routes.dsh ?? {};
      const dshLabel = dshCfg.label || '4.1 Flash';
      const buildDshRoute = () => ({
        kind: ROUTES.DSH,
        label: dshLabel,
        provider: dshCfg.provider || '',
        model: dshCfg.model || '',
        permissionPreset: dshCfg.permissionPreset || '',
        agentPreset: dshCfg.agentPreset || '',
        titlePrefix: dshCfg.titlePrefix || '',
        canEscalate: false,
        escalateLabel: '',
        originalText: actionRec.originalText,
        escalated: true,
      });

      if (value.action === 'undo-note') {
        const res = await obsidianInbox.removeItems({ filePath: actionRec.obsidianFilePath, messageId: msgId });
        routeActions.delete(msgId);
        return toastResponse(
          res.removedCount > 0 ? '已从待整理撤销' : '未找到对应条目',
          res.ok ? 'success' : 'warning',
          textCard({
            title: '已撤销写入',
            content: res.removedCount > 0
              ? `已撤销 ${res.removedCount} 条记录（${actionRec.obsidianFileName}）。`
              : '文件中已不存在对应条目。',
            color: 'grey',
          }),
        );
      }

      if (value.action === 'note-to-dsh') {
        await obsidianInbox.removeItems({ filePath: actionRec.obsidianFilePath, messageId: msgId }).catch(() => {});
        intentRouter.recordOverride();
        routeActions.delete(msgId);
        const promptText = [actionRec.quoted, actionRec.originalText].filter(Boolean).join('\n\n');
        const dshRoute = buildDshRoute();
        void (async () => {
          let binding;
          try {
            binding = await binder.ensureBinding({
              key: actionRec.key,
              appId: actionRec.event.appId,
              tenantKey: actionRec.event.tenantKey,
              chatId: actionRec.event.chatId,
              chatType: actionRec.event.chatType,
              threadId: actionRec.event.threadId,
            });
          } catch (error) {
            logger.warn(`转交处理建绑定失败：${errorMessage(error)}`);
            await notice(actionRec.chatId, '无法建会话', errorMessage(error));
            return;
          }
          if (binding === undefined) {
            await notice(
              actionRec.chatId,
              '这个会话没有配置工作区',
              `请把 chat_id 「${actionRec.event.chatId}」加到配置的 chats 里，指定 workspacePath。`,
            );
            return;
          }
          await runViaCli({ binding, key: actionRec.key, event: actionRec.event, text: promptText, route: dshRoute });
        })().catch((error) => logger.warn(`转交 ${dshLabel} 处理失败：${errorMessage(error)}`));
        return toastResponse(
          '已撤销误记并转交处理',
          'info',
          textCard({
            title: `已转交 ${dshLabel}`,
            content: '已撤回刚才误记的待整理条目，正在用远端模型重新处理。',
            color: 'blue',
          }),
        );
      }

      if (value.action === 'escalate') {
        intentRouter.recordOverride();
        routeActions.delete(msgId);
        const promptText = [actionRec.quoted, actionRec.originalText].filter(Boolean).join('\n\n');
        const dshRoute = buildDshRoute();
        void (async () => {
          let binding = binder.get(actionRec.key);
          if (binding === undefined) {
            binding = await binder.ensureBinding({
              key: actionRec.key,
              appId: actionRec.event.appId,
              tenantKey: actionRec.event.tenantKey,
              chatId: actionRec.event.chatId,
              chatType: actionRec.event.chatType,
              threadId: actionRec.event.threadId,
            });
          }
          if (binding === undefined) {
            await notice(
              actionRec.chatId,
              '这个会话没有配置工作区',
              `请把 chat_id 「${actionRec.event.chatId}」加到配置的 chats 里，指定 workspacePath。`,
            );
            return;
          }
          await runViaCli({ binding, key: actionRec.key, event: actionRec.event, text: promptText, route: dshRoute });
        })().catch((error) => logger.warn(`转交 ${dshLabel} 重答失败：${errorMessage(error)}`));
        return toastResponse(
          `已转交 ${dshLabel} 重答`,
          'info',
          textCard({
            title: `已转交 ${dshLabel} 重答`,
            content: '正在用远端模型为你重新生成回答（请查看下方新卡片）。',
            color: 'blue',
          }),
        );
      }

      return toastResponse('不认识的操作', 'warning');
    }
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
