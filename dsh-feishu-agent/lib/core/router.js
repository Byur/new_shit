/** 意图路由核心：配置归一化、快捷前缀、记事规则、分类提示词、健康嗅探、降级与跨会话短期历史。 */

import { polishItems } from '../local/polish.js';
import { createHealthMonitor } from '../local/ollama-health.js';
import { DEFAULT_KEEP_ALIVE, DEFAULT_OLLAMA_BASE_URL } from '../local/ollama.js';
import { NOTE_ACTIONS, detectNoteIntent } from './note-intent.js';

/** 三条路由枚举（分类器只会返回 dsh / local，obsidian 只由规则或显式命令产生）。 */
export const ROUTES = {
  DSH: 'dsh',
  LOCAL: 'local',
  OBSIDIAN: 'obsidian',
};

/** 快捷命令 → 强制路由映射。 */
export const ROUTE_COMMANDS = {
  dsh: ROUTES.DSH,
  loc: ROUTES.LOCAL,
  note: ROUTES.OBSIDIAN,
};

/** 传给 Ollama `format` 的 JSON Schema。 */
export const ROUTER_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string', enum: [ROUTES.DSH, ROUTES.LOCAL] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' },
    needsCrossContext: { type: 'boolean' },
  },
  required: ['route', 'confidence', 'reason'],
};

/** 路由配置默认值。 */
export const DEFAULT_ROUTER_CONFIG = {
  enabled: false,
  groupEnabled: false,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,
  classifierModel: 'qwen3:8b',
  timeoutMs: 8000,
  keepAlive: DEFAULT_KEEP_ALIVE,
  localConfidence: 0.8,
  contextWindowSec: 180,
  polish: {
    enabled: true,
    timeoutMs: 6000,
    maxChars: 300,
    maxItems: 6,
  },
  health: {
    enabled: true,
    ttlMs: 30000,
    cooldownMs: 60000,
    failureThreshold: 2,
    probeTimeoutMs: 400,
  },
  routes: {
    dsh: {
      provider: '',
      model: '',
      permissionPreset: '',
      agentPreset: '',
      titlePrefix: '',
      label: '4.1 Flash',
    },
    local: {
      provider: 'ollama',
      model: 'qwen3:8b',
      permissionPreset: 'read-only',
      agentPreset: '',
      titlePrefix: '[飞书·本地]',
      label: '本地 Qwen3',
    },
    obsidian: {
      inboxDir: '',
      label: '待整理',
    },
  },
};

/** 触发词前缀：规则层已剥离，保留用于兜底清理（例如显式命令的原文）。 */
const NOTE_TRIGGER_PREFIX = /^(?:请|帮我|麻烦)?(?:记一下|记录一下|记下来|记一笔|备忘|收进待整理|放到待整理|存待整理|写进待整理|待整理|想法|灵感)\s*[:：,，]?\s*/;

/**
 * 解析布尔值（兼容环境变量 `'on'`/`'true'`/`'1'` 与 `'off'`/`'false'`/`'0'`）。
 *
 * @param value 原值
 * @param fallback 缺省值
 * @returns boolean
 */
function toBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'no') return false;
  }
  return fallback;
}

/**
 * 解析区间内浮点数。
 *
 * @param value 原值
 * @param fallback 缺省值
 * @param min 下界
 * @param max 上界
 * @returns 合法数字
 */
function toClampedNumber(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * 合并多层路由配置：默认值 → bundle → local-config.json → 环境变量覆盖。
 *
 * @param bundled bundle 默认配置里的 `router`
 * @param local 本机 `local-config.json` 里的 `router`
 * @param env 进程环境变量（可选）
 * @returns 归一化后的完整路由配置
 */
export function normalizeRouterConfig(bundled = {}, local = {}, env = {}) {
  const b = bundled !== null && typeof bundled === 'object' ? bundled : {};
  const l = local !== null && typeof local === 'object' ? local : {};
  const bRoutes = b.routes !== null && typeof b.routes === 'object' ? b.routes : {};
  const lRoutes = l.routes !== null && typeof l.routes === 'object' ? l.routes : {};

  const mergeRoute = (key) => ({
    ...DEFAULT_ROUTER_CONFIG.routes[key],
    ...(bRoutes[key] !== null && typeof bRoutes[key] === 'object' ? bRoutes[key] : {}),
    ...(lRoutes[key] !== null && typeof lRoutes[key] === 'object' ? lRoutes[key] : {}),
  });

  const mergeSection = (key) => ({
    ...DEFAULT_ROUTER_CONFIG[key],
    ...(b[key] !== null && typeof b[key] === 'object' ? b[key] : {}),
    ...(l[key] !== null && typeof l[key] === 'object' ? l[key] : {}),
  });

  const dshRoute = mergeRoute('dsh');
  const localRoute = mergeRoute('local');
  const obsidianRoute = mergeRoute('obsidian');
  const polishSection = mergeSection('polish');
  const distillSection = mergeSection('distill');
  const healthSection = mergeSection('health');

  // 旧 `distill` 配置段只在 `polish` 未显式出现时作为别名生效；归一化结果里只保留 `polish`。
  const explicitPolish = Object.hasOwn(b, 'polish') || Object.hasOwn(l, 'polish');
  const polishInput = explicitPolish ? polishSection : { ...DEFAULT_ROUTER_CONFIG.polish };
  if (!explicitPolish) {
    for (const key of ['enabled', 'timeoutMs', 'maxChars', 'maxItems']) {
      if (distillSection[key] !== undefined) polishInput[key] = distillSection[key];
    }
  }

  const envBool = (name) => {
    const raw = env?.[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    return toBool(raw, undefined);
  };
  const envNumber = (name) => {
    const raw = env?.[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    return Number(String(raw).trim());
  };
  // 旧环境变量只是别名：新键缺省时作为回退，避免用户已有 .env 失效。
  const polishEnvBool = (name, legacyName) => envBool(name) ?? envBool(legacyName);
  const polishEnvNumber = (name, legacyName) => envNumber(name) ?? envNumber(legacyName);

  const envEnabled = env?.FEISHU_AGENT_ROUTER_ENABLED;
  const envOllamaUrl = typeof env?.FEISHU_AGENT_OLLAMA_URL === 'string' && env.FEISHU_AGENT_OLLAMA_URL.trim() !== ''
    ? env.FEISHU_AGENT_OLLAMA_URL.trim()
    : undefined;
  const envClassifierModel = typeof env?.FEISHU_AGENT_ROUTER_MODEL === 'string' && env.FEISHU_AGENT_ROUTER_MODEL.trim() !== ''
    ? env.FEISHU_AGENT_ROUTER_MODEL.trim()
    : undefined;
  const envInboxDir = typeof env?.FEISHU_AGENT_OBSIDIAN_INBOX_DIR === 'string' && env.FEISHU_AGENT_OBSIDIAN_INBOX_DIR.trim() !== ''
    ? env.FEISHU_AGENT_OBSIDIAN_INBOX_DIR.trim()
    : undefined;

  if (envInboxDir !== undefined) obsidianRoute.inboxDir = envInboxDir;

  const mergedEnabled = l.enabled !== undefined ? l.enabled : b.enabled;
  const mergedGroupEnabled = l.groupEnabled !== undefined ? l.groupEnabled : b.groupEnabled;

  return {
    enabled: envEnabled !== undefined && String(envEnabled).trim() !== ''
      ? toBool(envEnabled, DEFAULT_ROUTER_CONFIG.enabled)
      : toBool(mergedEnabled, DEFAULT_ROUTER_CONFIG.enabled),
    groupEnabled: toBool(mergedGroupEnabled, DEFAULT_ROUTER_CONFIG.groupEnabled),
    ollamaBaseUrl: envOllamaUrl
      ?? (typeof l.ollamaBaseUrl === 'string' && l.ollamaBaseUrl.trim() !== '' ? l.ollamaBaseUrl.trim() : undefined)
      ?? (typeof b.ollamaBaseUrl === 'string' && b.ollamaBaseUrl.trim() !== '' ? b.ollamaBaseUrl.trim() : DEFAULT_ROUTER_CONFIG.ollamaBaseUrl),
    classifierModel: envClassifierModel
      ?? (typeof l.classifierModel === 'string' && l.classifierModel.trim() !== '' ? l.classifierModel.trim() : undefined)
      ?? (typeof b.classifierModel === 'string' && b.classifierModel.trim() !== '' ? b.classifierModel.trim() : DEFAULT_ROUTER_CONFIG.classifierModel),
    timeoutMs: toClampedNumber(l.timeoutMs ?? b.timeoutMs, DEFAULT_ROUTER_CONFIG.timeoutMs, 300, 30000),
    keepAlive: typeof (l.keepAlive ?? b.keepAlive) === 'string' && String(l.keepAlive ?? b.keepAlive).trim() !== ''
      ? String(l.keepAlive ?? b.keepAlive).trim()
      : DEFAULT_ROUTER_CONFIG.keepAlive,
    localConfidence: toClampedNumber(l.localConfidence ?? b.localConfidence, DEFAULT_ROUTER_CONFIG.localConfidence, 0, 1),
    contextWindowSec: toClampedNumber(l.contextWindowSec ?? b.contextWindowSec, DEFAULT_ROUTER_CONFIG.contextWindowSec, 0, 3600),
    polish: {
      enabled: polishEnvBool('FEISHU_AGENT_POLISH_ENABLED', 'FEISHU_AGENT_DISTILL_ENABLED')
        ?? toBool(polishInput.enabled, DEFAULT_ROUTER_CONFIG.polish.enabled),
      timeoutMs: toClampedNumber(
        polishEnvNumber('FEISHU_AGENT_POLISH_TIMEOUT_MS', 'FEISHU_AGENT_DISTILL_TIMEOUT_MS')
          ?? polishInput.timeoutMs,
        DEFAULT_ROUTER_CONFIG.polish.timeoutMs,
        300,
        30000,
      ),
      maxChars: toClampedNumber(
        polishEnvNumber('FEISHU_AGENT_POLISH_MAX_CHARS', 'FEISHU_AGENT_DISTILL_MAX_CHARS')
          ?? polishInput.maxChars,
        DEFAULT_ROUTER_CONFIG.polish.maxChars,
        100,
        2000,
      ),
      maxItems: Math.floor(toClampedNumber(
        envNumber('FEISHU_AGENT_POLISH_MAX_ITEMS') ?? polishInput.maxItems,
        DEFAULT_ROUTER_CONFIG.polish.maxItems,
        1,
        20,
      )),
    },
    health: {
      enabled: envBool('FEISHU_AGENT_HEALTH_ENABLED')
        ?? toBool(healthSection.enabled, DEFAULT_ROUTER_CONFIG.health.enabled),
      ttlMs: toClampedNumber(
        envNumber('FEISHU_AGENT_HEALTH_TTL_MS') ?? healthSection.ttlMs,
        DEFAULT_ROUTER_CONFIG.health.ttlMs,
        1000,
        600000,
      ),
      cooldownMs: toClampedNumber(
        envNumber('FEISHU_AGENT_HEALTH_COOLDOWN_MS') ?? healthSection.cooldownMs,
        DEFAULT_ROUTER_CONFIG.health.cooldownMs,
        1000,
        600000,
      ),
      failureThreshold: Math.max(1, Math.floor(toClampedNumber(
        healthSection.failureThreshold,
        DEFAULT_ROUTER_CONFIG.health.failureThreshold,
        1,
        10,
      ))),
      probeTimeoutMs: toClampedNumber(
        healthSection.probeTimeoutMs,
        DEFAULT_ROUTER_CONFIG.health.probeTimeoutMs,
        200,
        5000,
      ),
    },
    routes: {
      dsh: dshRoute,
      local: localRoute,
      obsidian: obsidianRoute,
    },
  };
}

/**
 * 兜底拆解待整理条目：按显式多行拆分，并去掉开头的“记一下：”类触发词。
 *
 * @param text 用户原文
 * @param quoted 被引用消息（可选）
 * @returns 清理后的条目数组
 */
export function fallbackObsidianItems(text, quoted = '') {
  const raw = typeof text === 'string' ? text.trim() : '';
  const stripped = raw.replace(NOTE_TRIGGER_PREFIX, '').trim();
  if (stripped === '') {
    const q = String(quoted ?? '').replace(/^\[引用消息\]\s*/, '').trim();
    return q === '' ? [] : [q];
  }
  const lines = stripped
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').trim())
    .filter((line) => line !== '');
  return lines.length > 0 ? lines : [stripped];
}

/**
 * 构造发给本地 Qwen 分类器的消息数组。
 *
 * @param options.text 用户当前输入
 * @param options.quoted 引用消息块（可空）
 * @param options.recent 最近 3 轮跨路由历史
 * @returns Ollama messages 数组
 */
export function buildClassifierMessages({ text, quoted = '', recent = [] }) {
  const system = [
    '你是个人飞书助手的意图路由器。只输出符合 JSON Schema 的路由决策，不要回答用户问题。',
    '可选路由（必须二选一）：',
    '1. "dsh"（复杂事务 / 付费远端 Agent）：需要联网搜索或实时信息（新闻/天气/价格/最新文档）、读写本地文件或代码仓库、运行命令、查询/列举/检索/整理/归档已有笔记、更新任务总表、复杂多步分析/编程/长文撰写、或延续刚进行的 dsh 任务。拿不准时一律选 "dsh"。',
    '2. "local"（简单应答 / 本地小模型）：闲聊、打招呼、短句翻译、基础常识/概念解释、简单文字润色、日常小计算——不需要外部工具、不需要实时信息、不需要读取任何本地文件或笔记。',
    '规则：',
    '- 记录新想法、备忘、灵感的速记请求已由规则层处理，不会进入本分类；这里只区分 dsh 与 local。',
    '- confidence 取 0~1，边界模糊时压低分数（如 0.6）或直接选 "dsh"。',
    '- reason 用不超过 12 个字的短语说明理由。',
    '- 若当前消息明显在追问最近一轮"另一条路由"刚聊过的内容，将 needsCrossContext 设为 true，否则 false。',
    '- 用户消息里可能附带「最近对话」「被引用消息」，据此理解指代与跨轮上下文，但不要把它们当成新的用户问题。',
  ].join('\n');

  const parts = [];
  if (Array.isArray(recent) && recent.length > 0) {
    const lines = recent.map((item) => {
      const ago = `${Math.max(0, Math.round(item.secondsAgo ?? 0))}s前`;
      return `- [${item.route} · ${ago}] 用户：${item.user}${item.assistant ? ` | 助手：${item.assistant}` : ''}`;
    });
    parts.push(`最近对话（按时间顺序）：\n${lines.join('\n')}`);
  }
  if (typeof quoted === 'string' && quoted.trim() !== '') {
    parts.push(`被引用消息：\n${quoted.trim()}`);
  }
  parts.push(`当前用户输入：\n${text}`);

  return [
    { role: 'system', content: system },
    { role: 'user', content: parts.join('\n\n') },
  ];
}

/**
 * 跨路由短期记忆（内存滑窗）：用于帮助分类器理解指代，以及跨会话切换时补前情。
 *
 * @param options.maxPerChat 每个 chat 最多记几轮
 * @returns `{ record, recent, crossContextFor }`
 */
export function createRouteHistory({ maxPerChat = 5 } = {}) {
  /** chatId → Array<{ route, user, assistant, at }> */
  const buckets = new Map();

  function snippet(text, limit = 160) {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
    return flat.length <= limit ? flat : `${flat.slice(0, limit)}…`;
  }

  /**
   * 记一轮完成的对话摘要。
   */
  function record(chatId, { route, user, assistant = '', at = Date.now() }) {
    if (typeof chatId !== 'string' || chatId === '') return;
    const list = buckets.get(chatId) ?? [];
    list.push({
      route,
      user: snippet(user, 160),
      assistant: snippet(assistant, 220),
      at,
    });
    while (list.length > maxPerChat) list.shift();
    buckets.set(chatId, list);
  }

  /**
   * 取最近几轮（带 `secondsAgo`），供分类器判断连贯性。
   */
  function recent(chatId, { limit = 3, now = Date.now() } = {}) {
    const list = buckets.get(chatId) ?? [];
    return list.slice(-limit).map((item) => ({
      ...item,
      secondsAgo: Math.max(0, Math.round((now - item.at) / 1000)),
    }));
  }

  /**
   * 当目标路由与上一轮不同且在时间窗内时，拼一段极简跨会话前情。
   */
  function crossContextFor(chatId, targetRoute, { windowSec = 180, now = Date.now() } = {}) {
    if (!(windowSec > 0)) return '';
    const list = buckets.get(chatId) ?? [];
    const last = list.at(-1);
    if (last === undefined || last.route === targetRoute) return '';
    if ((now - last.at) / 1000 > windowSec) return '';
    const parts = [`[跨会话前情（来自上一轮 ${last.route}）]`, `用户：${last.user}`];
    if (last.assistant !== '') parts.push(`助手：${last.assistant}`);
    return parts.join('\n');
  }

  return { record, recent, crossContextFor };
}

/**
 * 降级到 dsh 的固定形状。
 *
 * @param options.source 决策来源
 * @param options.confidence 置信度
 * @param options.reason 可读原因
 * @param options.reasonText 可直接上卡片的中文说明
 * @param options.fallbackReason 机器可读原因
 * @param options.durationMs 耗时
 * @param options.needsCrossContext 是否补前情
 * @returns 路由决策
 */
function fallbackDecision({
  source,
  confidence = 0,
  reason,
  reasonText = '',
  fallbackReason,
  durationMs = 0,
  needsCrossContext = false,
}) {
  return {
    route: ROUTES.DSH,
    source,
    confidence,
    reason,
    reasonText,
    fallbackReason,
    needsCrossContext,
    obsidianItems: [],
    durationMs,
  };
}

/**
 * 建意图路由器：记事规则前置、Ollama 健康嗅探、分类、阈值校验、降级与命中统计。
 *
 * @param deps.ollama Ollama 客户端（`chatJson` / `healthCheck`）
 * @param deps.history 跨路由历史（`createRouteHistory()`）
 * @param deps.logger 日志
 * @param deps.health 健康监控器（缺省时按需用 `createHealthMonitor({ ollama })`）
 * @returns `{ decide, stats, recordOverride }`
 */
export function createIntentRouter({ ollama, history, logger, health }) {
  const stats = {
    dsh: 0,
    local: 0,
    obsidian: 0,
    fallback: 0,
    note: 0,
    override: 0,
  };

  /** 内部健康监控器：只建一次；ollama 不支持探测时为 `null`（不拦截分类）。 */
  let internalHealth;
  if (health !== undefined) {
    internalHealth = health;
  }

  /**
   * 取健康监控器；没有可探测的 ollama 客户端时返回 `null`。
   *
   * @returns 健康监控器或 null
   */
  function getHealthMonitor() {
    if (internalHealth !== undefined) return internalHealth;
    if (ollama === null || typeof ollama !== 'object' || typeof ollama.healthCheck !== 'function') {
      internalHealth = null;
      return null;
    }
    internalHealth = createHealthMonitor({ ollama });
    return internalHealth;
  }

  /**
   * 记录一次用户点按钮纠错。
   */
  function recordOverride() {
    stats.override += 1;
  }

  /**
   * 「读/查/整理笔记」的固定决策：永远走 dsh，速记模式也不接管查询。
   *
   * @returns 路由决策
   */
  function queryDecision() {
    stats.dsh += 1;
    stats.note += 1;
    return {
      route: ROUTES.DSH,
      source: 'rule',
      confidence: 1,
      reason: '读取笔记',
      noteAction: 'query',
      needsCrossContext: false,
      obsidianItems: [],
      durationMs: 0,
    };
  }

  /**
   * 把一段文本变成待写入的条目，并按配置跑清噪。
   *
   * 显式 `/note`、速记模式共用这套：先按行拆，再交给规则清噪 + 必要时断句。
   *
   * @param options.text 用来判断噪声与长度的用户原文（含 `/note` 触发词）
   * @param options.items 已拆好的条目；不给时按 `itemText` / `text` 拆行
   * @param options.itemText 拆行用的正文（默认同 `text`）
   * @param options.quoted 引用上下文
   * @param options.config 归一化后的路由配置
   * @returns `{ obsidianItems, durationMs }`
   */
  async function buildObsidianPayload({ text, items, itemText, quoted, config }) {
    const ruleItems = Array.isArray(items)
      ? items
      : fallbackObsidianItems(itemText ?? text, quoted);
    if (ruleItems.length === 0 || !config?.polish?.enabled) {
      return { obsidianItems: ruleItems, durationMs: 0 };
    }
    const startedAt = Date.now();
    const polished = await polishItems({
      ollama,
      items: ruleItems,
      text,
      quoted,
      model: config.classifierModel,
      baseUrl: config.ollamaBaseUrl,
      timeoutMs: config.polish.timeoutMs,
      maxChars: config.polish.maxChars,
      maxItems: config.polish.maxItems,
      logger,
    });
    return { obsidianItems: polished.items, durationMs: Date.now() - startedAt };
  }

  /**
   * 决定这条消息走哪条路由。
   *
   * @param options.chatId 飞书 chatId
   * @param options.isGroup 是否群聊
   * @param options.text 清洗后的用户输入（若来自 `/note` 等前缀则已剥离前缀）
   * @param options.quoted 引用上下文（可空）
   * @param options.forcedRoute 显式命令强制指定的路由（可选）
   * @param options.noteMode 是否处于速记模式（窗口内的消息直接记事，跳过分类器）
   * @param options.config 归一化后的路由配置
   * @param options.now 当前时间戳（测试可注入）
   * @returns `{ route, source, confidence, reason, reasonText?, noteAction?, needsCrossContext, obsidianItems, durationMs?, fallbackReason? }`
   */
  async function decide({
    chatId,
    isGroup = false,
    text,
    quoted = '',
    forcedRoute,
    noteMode = false,
    config,
    now = Date.now(),
  }) {
    // 1) 显式命令直达：/dsh、/loc、/note（跳过规则与分类器，即使 router.enabled=false 也允许手动用）
    if (forcedRoute !== undefined) {
      stats[forcedRoute] = (stats[forcedRoute] ?? 0) + 1;
      if (forcedRoute === ROUTES.OBSIDIAN) {
        return {
          route: ROUTES.OBSIDIAN,
          source: 'command',
          confidence: 1,
          reason: '显式指令',
          noteAction: 'append',
          needsCrossContext: false,
          ...(await buildObsidianPayload({ text, quoted, config })),
        };
      }
      return {
        route: forcedRoute,
        source: 'command',
        confidence: 1,
        reason: '显式指令',
        needsCrossContext: false,
        obsidianItems: [],
        durationMs: 0,
      };
    }

    // 2) 速记模式：用户在卡片或 `/note on` 里显式开启，窗口内每条消息直接记事。
    //    它和 `/note` 一样属于显式意图，所以不受 router.enabled 开关影响。
    if (noteMode) {
      const noteIntent = detectNoteIntent({ text, quoted });
      // 速记模式只接管「记」，不接管「查」：查询/整理笔记仍要读文件，固定走 dsh。
      if (noteIntent.action === NOTE_ACTIONS.QUERY) return queryDecision();
      if (!config?.routes?.obsidian?.inboxDir) {
        stats.dsh += 1;
        stats.fallback += 1;
        logger?.warn?.('速记模式下未配置 inboxDir，降级走 DSH');
        return fallbackDecision({
          source: 'fallback',
          confidence: 1,
          reason: '未配置待整理目录',
          reasonText: '待整理目录未配置，已改为交给远端处理',
          fallbackReason: 'inbox-missing',
        });
      }
      const payload = await buildObsidianPayload({ text, quoted, config });
      if (payload.obsidianItems.length === 0) {
        stats.dsh += 1;
        stats.fallback += 1;
        logger?.warn?.('速记模式下没有可写入的条目，降级走 DSH');
        return fallbackDecision({
          source: 'fallback',
          confidence: 1,
          reason: '待整理内容为空，降级走 DSH',
          reasonText: '没有可写入的内容，已改为交给远端处理',
          fallbackReason: 'empty-items',
        });
      }
      stats.obsidian += 1;
      stats.note += 1;
      return {
        route: ROUTES.OBSIDIAN,
        source: 'note-mode',
        confidence: 1,
        reason: '速记模式',
        noteAction: 'append',
        needsCrossContext: false,
        ...payload,
      };
    }

    // 3) 未启用或群聊默认旁路（群聊不触发记事规则）
    if (!config?.enabled || (isGroup && !config.groupEnabled)) {
      return {
        route: ROUTES.DSH,
        source: 'bypass',
        confidence: 1,
        reason: '',
        needsCrossContext: false,
        obsidianItems: [],
      };
    }

    // 4) 记事规则：写速记 / 查速记都由纯规则决定，不消耗分类器。
    const noteIntent = detectNoteIntent({ text, quoted });

    if (noteIntent.action === NOTE_ACTIONS.APPEND) {
      if (!config.routes?.obsidian?.inboxDir) {
        stats.dsh += 1;
        stats.fallback += 1;
        logger?.warn?.('命中速记规则但未配置 inboxDir，降级走 DSH');
        return fallbackDecision({
          source: 'fallback',
          confidence: 1,
          reason: '未配置待整理目录',
          reasonText: '待整理目录未配置，已改为交给远端处理',
          fallbackReason: 'inbox-missing',
        });
      }

      const payload = await buildObsidianPayload({
        text,
        itemText: noteIntent.payload !== '' ? noteIntent.payload : text,
        quoted,
        config,
      });
      if (payload.obsidianItems.length === 0) {
        stats.dsh += 1;
        stats.fallback += 1;
        logger?.warn?.('命中速记规则但没有可写入的条目，降级走 DSH');
        return fallbackDecision({
          source: 'fallback',
          confidence: 1,
          reason: '待整理内容为空，降级走 DSH',
          reasonText: '没有可写入的内容，已改为交给远端处理',
          fallbackReason: 'empty-items',
        });
      }

      stats.obsidian += 1;
      stats.note += 1;
      return {
        route: ROUTES.OBSIDIAN,
        source: 'rule',
        confidence: 1,
        reason: '触发词命中',
        noteAction: 'append',
        needsCrossContext: false,
        ...payload,
      };
    }

    if (noteIntent.action === NOTE_ACTIONS.QUERY) {
      return queryDecision();
    }

    // 5) 健康嗅探：本地分类器不可用时直接降级，不再等分类超时。
    const healthMonitor = getHealthMonitor();
    if (config.health?.enabled && healthMonitor !== null) {
      const probe = await healthMonitor.check({
        baseUrl: config.ollamaBaseUrl,
        model: config.classifierModel,
        policy: config.health,
      });
      if (probe?.ok !== true) {
        const reason = typeof probe?.reason === 'string' && probe.reason.trim() !== ''
          ? probe.reason.trim()
          : 'unhealthy';
        // 只有连接层失败（拒绝连接 / 解析失败 / 超时）才算“不可达”；
        // HTTP 500 这类是服务可达但探测报错，写成“不可达”会掩盖真实故障。
        const unreachable = /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|fetch failed|连接超时/i.test(reason);
        const reasonText = reason === 'circuit-open'
          ? '本地模型熔断中，已跳过本地判断'
          : reason === 'model-missing'
            ? '本地缺少分类模型，已跳过本地判断'
            : unreachable
              ? '本地模型不可达，已跳过本地判断'
              : '本地模型探测失败，已跳过本地判断';
        stats.dsh += 1;
        stats.fallback += 1;
        logger?.warn?.(`本地分类器不可用，降级走 DSH：${reason}`);
        return fallbackDecision({
          source: 'fallback',
          reason: '本地分类器不可用',
          reasonText,
          fallbackReason: reason,
        });
      }
    }

    // 6) 调用本地 Ollama 结构化分类（只区分 dsh / local）
    const recent = history ? history.recent(chatId, { limit: 3, now }) : [];
    const messages = buildClassifierMessages({ text, quoted, recent });
    const response = await ollama.chatJson({
      baseUrl: config.ollamaBaseUrl,
      model: config.classifierModel,
      messages,
      schema: ROUTER_SCHEMA,
      timeoutMs: config.timeoutMs,
      keepAlive: config.keepAlive,
    });

    if (!response.ok) {
      healthMonitor?.markFailure?.(response.error);
      stats.dsh += 1;
      stats.fallback += 1;
      logger?.warn?.(`意图分类失败，降级走 DSH：${response.error}`);
      return fallbackDecision({
        source: 'fallback',
        reason: '分类器不可用，自动降级',
        reasonText: '本地分类失败，已交给远端',
        fallbackReason: response.error,
        durationMs: response.durationMs,
      });
    }

    healthMonitor?.markSuccess?.();

    const data = response.data ?? {};
    const rawRoute = data.route;
    const confidence = toClampedNumber(data.confidence, 0, 0, 1);
    const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
    const needsCrossContext = data.needsCrossContext === true;

    // 分类器已不再提供 obsidian 选项；万一旧模型仍返回，按 dsh 处理并标注。
    if (rawRoute === ROUTES.OBSIDIAN) {
      stats.dsh += 1;
      logger?.warn?.('分类器返回了已下线的 obsidian 路由，按 DSH 处理');
      return {
        route: ROUTES.DSH,
        source: 'classifier',
        confidence,
        reason: 'classifier-returned-obsidian',
        needsCrossContext,
        obsidianItems: [],
        durationMs: response.durationMs,
      };
    }

    if (rawRoute === ROUTES.LOCAL) {
      if (confidence < config.localConfidence) {
        stats.dsh += 1;
        stats.fallback += 1;
        return fallbackDecision({
          source: 'fallback',
          confidence,
          reason: `local 置信度 ${confidence.toFixed(2)} 低于阈值 ${config.localConfidence}`,
          reasonText: '本地判断把握不足，已交给远端',
          fallbackReason: 'low-confidence',
          durationMs: response.durationMs,
          needsCrossContext,
        });
      }
      stats.local += 1;
      return {
        route: ROUTES.LOCAL,
        source: 'classifier',
        confidence,
        reason,
        needsCrossContext,
        obsidianItems: [],
        durationMs: response.durationMs,
      };
    }

    stats.dsh += 1;
    return {
      route: ROUTES.DSH,
      source: 'classifier',
      confidence,
      reason,
      needsCrossContext,
      obsidianItems: [],
      durationMs: response.durationMs,
    };
  }

  return {
    decide,
    recordOverride,
    get stats() {
      return { ...stats };
    },
  };
}
