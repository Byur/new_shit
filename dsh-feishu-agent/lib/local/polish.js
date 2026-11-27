/**
 * 写入前的本地处理：确定性清噪 + 模型断句。
 *
 * 分工是硬边界：删噪声（口头语、重复代词）由本文件的规则完成，同输入永远同输出；
 * 本地小模型只被允许插标点、调空白，一个字符都不许改。
 * 这样每次失败都能退回到“已经清过噪”的文本，而不是退回带噪原文。
 */

/** 传给 Ollama `format` 的 JSON Schema。 */
export const POLISH_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'string' } },
  },
  required: ['items'],
};

/** 固定系统提示词：模型只插标点，清噪已由规则做完。 */
export const POLISH_SYSTEM_PROMPT = [
  '你只给中文文本加标点和断句，输出会直接归档。',
  '允许：插入标点符号（，。？！：、；）和调整空白。',
  '严禁：删除、新增、改写任何一个汉字、字母、数字或符号；严禁调整字符顺序。',
  '严禁分条、严禁总结、严禁加标题、严禁改写措辞。',
  '输出去掉标点与空白后，必须与输入完全相同。',
  '只输出符合 Schema 的 items。',
  '',
  '示例一：',
  '输入：我明天要去一趟银行顺便把水费交了我怕忘了',
  '输出：我明天要去一趟银行，顺便把水费交了。我怕忘了。',
  '',
  '示例二：',
  '输入：明天下午三点开会记得带上合同',
  '输出：明天下午三点开会，记得带上合同。',
  '',
  '只输出符合 Schema 的 items。',
].join('\n');

/**
 * 噪声短语表，按从长到短排列。
 *
 * 顺序有意义：`就是说那个` 必须先于 `就是说`，否则长短语会被短词截断成半截。
 * 只收明确没有语义的口头语，宁可漏删也不误伤。
 */
const DENOISE_PHRASES = [
  '嗯就是那个', '呃那个就是', '就是说那个', '然后那个',
  '那个啥', '就是那个', '嗯就是', '呃就是', '嗯那个', '呃那个',
  '就是说呢', '就是说', '因为呢', '然后呢', '之类的', '哼哼', '嗯嗯', '呃呃', '唔唔',
  '呃', '嗯', '唔',
];

/**
 * 重复代词：`我我` → `我`。
 *
 * 只处理第一人称到第三人称单数代词，`看看`、`想想` 这类动词重叠是正当表达，不能动。
 */
const DUPLICATED_PRONOUN = /(我|你|他|她|它)\1/g;

/** 中英文标点与空白（比较前统一删除，数字与字母保留）。 */
const PUNCTUATION = /[\s!-/:-@[-`{-~，。、；：？！…—–·“”‘’（）【】《》〈〉「」『』〔〕｡〜]/g;

/** 判断“有没有标点”时使用的标点集合。 */
const SENTENCE_PUNCTUATION = /[，。？！；：、,.;:!?]/;

/** 前置标签（`记一下：`、`备忘:`）：它的冒号只分隔标签与正文，不算断句依据。 */
const LEADING_LABEL = /^[^：:\n]{0,12}[：:]\s*/;

/** 至少 24 字且完全没有标点时，认为这是一句没断句的口语。 */
const LONG_NO_PUNCTUATION = 24;

/**
 * 归一化：删除空白与中英文标点。
 *
 * @param value 原值
 * @returns 可比较的串
 */
function normalize(value) {
  return String(value ?? '').replace(PUNCTUATION, '');
}

/**
 * 删词之后粘在句中的空标点。
 *
 * 顺序固定且有意义：先去掉紧贴另一个标点的逗号（`嗯，可是` → `，可是` 不属于此类，
 * 但 `GPT，，它的` 属于），再合并重复标点，再去掉句末标点之后的逗号，最后清掉句首标点。
 */
const PUNCTUATION_CLEANUPS = [
  [/[，、；：]+\s*(?=[，。？！])/g, ''],
  [/([，、；：])\1+/g, '$1'],
  [/(?<=[。？！])\s*[，、；：]+/g, ''],
  [/^[\s，、；：]+/, ''],
];

/** 子句切分：保留分隔符，便于原样拼回。 */
const CLAUSE_PATTERN = /[^，。、；：？！]+[，。、；：？！]?/g;

/** 子句核心：去掉空白与标点后用于判重。 */
const CLAUSE_CORE = /[\s，。、；：？！]/g;

/**
 * 删除紧邻的重复子句：`最近那个GPT，最近那个GPT，` → `最近那个GPT，`。
 *
 * 语音重启会造成相邻子句重复，这是最显眼的一类噪声。只处理**紧邻**重复：
 * `我开了那个暖气` 与 `把那个暖气关了` 语义相关但不同，必须都保留。
 *
 * @param text 文本
 * @returns 去掉相邻重复子句后的文本
 */
export function dedupeAdjacentClauses(text) {
  const raw = typeof text === 'string' ? text : '';
  const clauses = raw.match(CLAUSE_PATTERN) ?? [];
  if (clauses.length === 0) return raw;

  let previous = null;
  const kept = [];
  for (const clause of clauses) {
    const core = clause.replace(CLAUSE_CORE, '');
    if (core !== '' && previous !== null && core === previous) continue;
    if (core !== '') previous = core;
    kept.push(clause);
  }
  return kept.join('');
}

/**
 * 确定性清噪：删除口头语、合并重复代词、修掉空标点、去掉相邻重复子句、折叠空白。
 *
 * 不做的事（都有反例，所以留给人眼判断）：
 * - 不删裸 `那个`：`那个报错` / `那个方案` / `最近那个GPT` 里它是指示词，删了就丢信息；
 * - 不删裸 `然后`：`先跑测试然后提交` / `然后现在就感觉` 里它是顺序连接；
 * - 不删 `对呀`：它可能是真实回答，而不是接话的语气词；
 * - 不删 `啊`：`好啊` / `行啊` 是语气而非填充，误删会改变语气。
 *
 * @param text 原文
 * @returns `{ text, removed }`，`removed` 按首次删除顺序记录命中的短语（可重复）
 */
export function denoise(text) {
  if (typeof text !== 'string') return { text: '', removed: [] };

  let result = text;
  const removed = [];

  for (const phrase of DENOISE_PHRASES) {
    const parts = result.split(phrase);
    if (parts.length === 1) continue;
    for (let index = 1; index < parts.length; index += 1) removed.push(phrase);
    result = parts.join('');
  }

  result = result.replace(DUPLICATED_PRONOUN, (match, pronoun) => {
    removed.push(match);
    return pronoun;
  });

  for (const [pattern, replacement] of PUNCTUATION_CLEANUPS) {
    result = result.replace(pattern, replacement);
  }

  result = dedupeAdjacentClauses(result);

  // 只折叠连续空白：原文里的单个半角空格是有意义的，不能删，也不能变成换行。
  return { text: result.replace(/\s+/g, ' ').trim(), removed };
}

/**
 * 判断文本是否值得处理：命中噪声词表（真的删得掉东西），或够长却没有任何标点。
 *
 * @param text 文本
 * @returns 是否需要清噪 / 断句
 */
export function looksNoisy(text) {
  const raw = typeof text === 'string' ? text : '';
  const result = denoise(raw);
  if (result.removed.length > 0) return true;
  // 只把空白折叠当成“没变化”：`denoise` 会折叠换行，直接比 `text` 会把
  // 干净的多行笔记误判成噪声；但空标点与重复子句的修复确实算变化。
  if (result.text !== raw.replace(/\s+/g, ' ').trim()) return true;
  return raw.length >= LONG_NO_PUNCTUATION && !SENTENCE_PUNCTUATION.test(raw);
}

/**
 * 判断整段是否完全没有标点；只有这种文本才值得花一次模型调用去断句。
 *
 * @param text 文本
 * @returns 是否需要断句
 */
export function needsPunctuation(text) {
  const raw = String(text ?? '');
  // 事实 token 内部的标点（`qwen3:8b` 的冒号、URL 的 `/` 与 `?`）不是句子标点，先剥掉。
  const withoutTokens = raw.replace(FACT_TOKEN, ' ');
  // `记一下：` 这类前置标签的冒号也不是断句依据，去掉标签后再判断。
  const body = withoutTokens.replace(LEADING_LABEL, '');
  return !SENTENCE_PUNCTUATION.test(body);
}

/**
 * 判断是否值得处理（规则清噪 + 可能的模型断句）。
 *
 * @param options.items 已拆好的条目
 * @param options.text 用户原文
 * @param options.maxChars 允许调用模型的最大长度（不限制规则清噪）
 * @param options.maxItems 允许调用模型的最大条目数（不限制规则清噪）
 * @returns 是否需要处理
 */
export function needsPolish({ items, text, maxChars = 300, maxItems = 6 } = {}) {
  if (!Array.isArray(items) || items.length === 0) return false;
  if (items.length > maxItems) return false;
  const raw = typeof text === 'string' ? text : '';
  if (raw.length > maxChars) return false;
  return looksNoisy(raw);
}

/** 事实 token：数字串、英文标识符、URL。内部标点（`:` `_` `-` `/`）属于事实本身。 */
const FACT_TOKEN = /[A-Za-z0-9][A-Za-z0-9._:/?#=&%+\-@]*/g;

/** 紧贴 token 两端的句末标点：`9GB.` 与 `9GB` 应视为同一个 token。 */
const TOKEN_EDGE_PUNCTUATION = /^[.,;:!?]+|[.,;:!?]+$/g;

/**
 * 抽出必须逐字保留的事实 token。
 *
 * `normalize` 会抹掉所有标点，因此 `qwen3:8b` 与 `qwen3 8b`、`https://a.com/b-c`
 * 与 `httpsa com b c` 在归一化后相同。只比归一化文本会漏掉这类改动，
 * 所以必须额外逐字、逐序比较 token 本身。
 *
 * @param value 原值
 * @returns 按出现顺序排列的 token 数组
 */
export function protectedTokens(value) {
  const matches = String(value ?? '').match(FACT_TOKEN) ?? [];
  return matches
    .map((token) => token.replace(TOKEN_EDGE_PUNCTUATION, ''))
    .filter((token) => token !== '');
}

/**
 * 判断两组事实 token 是否逐字、逐序相等。
 *
 * @param left 数组
 * @param right 数组
 * @returns 是否相等
 */
export function sameProtectedTokens(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  return a.length === b.length && a.every((token, index) => token === b[index]);
}

/**
 * 修复模型输出的条目数：一条被拆成多条时用全角逗号合并回去。
 *
 * 返回的 `items` 是应当采用的结果（等数时即模型输出），`repaired` 表示是否合并过。
 *
 * @param options.inputs 输入条目
 * @param options.outputs 模型输出条目
 * @returns `{ items, repaired, reason }`
 */
export function repairItemCount({ inputs, outputs } = {}) {
  const inputItems = Array.isArray(inputs) ? inputs : [];
  const outputItems = Array.isArray(outputs) ? outputs : [];

  if (outputItems.length === 0) {
    return { items: inputItems, repaired: false, reason: 'empty-output' };
  }
  if (outputItems.length === inputItems.length) {
    return { items: outputItems, repaired: false, reason: 'ok' };
  }
  if (inputItems.length === 1 && outputItems.length > 1) {
    return { items: [outputItems.join('，')], repaired: true, reason: 'merged-split' };
  }
  if (outputItems.length < inputItems.length) {
    return { items: inputItems, repaired: false, reason: 'lost-items' };
  }
  return { items: inputItems, repaired: false, reason: 'extra-items' };
}

/**
 * 校验模型输出是否忠实于去噪后的输入。
 *
 * - `text-changed`：去掉标点与空白后与输入不完全相同（多字、少字、换字、换序都在此）；
 * - `token-changed`：事实 token 逐字逐序不一致，如 `qwen3:8b` → `qwen3 8b`；
 * - `empty-item`：某条归一化后为空；
 * - `empty-output` / `lost-items` / `extra-items`：条目数与输入不符，整批回退。
 *
 * `inputs` 必须是**去噪后**的条目：清噪已发生，模型只能动标点。
 *
 * @param options.inputs 去噪后的条目
 * @param options.outputs 模型输出条目
 * @returns `{ ok, items, reason }`
 */
export function verifyPolish({ inputs, outputs } = {}) {
  const inputItems = Array.isArray(inputs) ? inputs : [];
  const outputItems = (Array.isArray(outputs) ? outputs : [])
    .map((item) => String(item ?? '').trim())
    .filter((item) => item !== '');

  const repaired = repairItemCount({ inputs: inputItems, outputs: outputItems });
  if (['empty-output', 'lost-items', 'extra-items'].includes(repaired.reason)) {
    return { ok: false, items: inputItems, reason: repaired.reason };
  }

  const items = repaired.items.map((item) => String(item ?? '').trim());

  for (let index = 0; index < items.length; index += 1) {
    const input = String(inputItems[index] ?? inputItems[inputItems.length - 1] ?? '');
    const output = items[index] ?? '';
    const normalizedInput = normalize(input);
    const normalizedOutput = normalize(output);

    if (normalizedOutput !== normalizedInput) {
      return { ok: false, items: inputItems, reason: 'text-changed' };
    }
    if (!sameProtectedTokens(protectedTokens(input), protectedTokens(output))) {
      return { ok: false, items: inputItems, reason: 'token-changed' };
    }
    if (normalizedOutput === '') {
      return { ok: false, items: inputItems, reason: 'empty-item' };
    }
  }

  return { ok: true, items, reason: 'ok' };
}

/**
 * 规则清噪 + 模型断句；任何失败都返回清噪后的文本，绝不退回带噪原文，也不抛异常。
 *
 * `maxChars` / `maxItems` 只决定“要不要调模型”：超限时仍然返回规则清噪后的结果，
 * 因为它们约束的是模型调用，而不是 O(n) 的纯字符串规则。
 *
 * @param options.ollama 注入的 Ollama 客户端（`chatJson`）
 * @param options.items 已拆好的条目
 * @param options.text 用户原文
 * @param options.quoted 被引用消息（可空）
 * @param options.model 模型名
 * @param options.baseUrl Ollama 地址
 * @param options.timeoutMs 超时毫秒数
 * @param options.maxChars 允许调用模型的最大长度（超限仍会清噪）
 * @param options.maxItems 允许调用模型的最大条目数（超限仍会清噪）
 * @param options.logger 日志
 * @returns `{ items, usedModel, reason }`
 */
export async function polishItems({
  ollama,
  items,
  text,
  quoted = '',
  model,
  baseUrl,
  timeoutMs = 6000,
  maxChars = 300,
  maxItems = 6,
  logger,
} = {}) {
  const inputItems = Array.isArray(items) ? items : [];
  const rawText = typeof text === 'string' ? text : '';
  const rawQuoted = typeof quoted === 'string' ? quoted.trim() : '';

  // 规则清噪先无条件执行：它是纯字符串操作，长度与条数上限只该约束模型调用。
  // 任何不走模型的出口都返回 denoised，绝不把噪声退回给用户。
  const denoised = inputItems.map((item) => denoise(item).text);

  if (inputItems.length === 0) {
    return { items: inputItems, usedModel: false, reason: 'not-needed' };
  }
  if (inputItems.length > maxItems) {
    return { items: denoised, usedModel: false, reason: 'too-many-items' };
  }
  if (rawText.length > maxChars) {
    return { items: denoised, usedModel: false, reason: 'too-long' };
  }
  if (!needsPolish({ items: inputItems, text: rawText, maxChars, maxItems })) {
    return { items: inputItems, usedModel: false, reason: 'not-needed' };
  }

  if (typeof ollama?.chatJson !== 'function') {
    return { items: denoised, usedModel: false, reason: 'ollama-unavailable' };
  }

  // 噪声已清且原文本来就有标点：不需要模型，省掉一次 1 秒级的本地推理。
  // 必须逐条判断：多条里只要有一条缺标点，就值得花一次调用（其余条模型会原样返回并通过校验）。
  if (!denoised.some((item) => needsPunctuation(item))) {
    return { items: denoised, usedModel: false, reason: 'rule-only' };
  }

  let userContent = `待整理原文：\n${denoised.join('\n')}`;
  if (rawQuoted !== '') userContent += `\n\n被引用消息：\n${rawQuoted}`;
  userContent += '\n\n请输出 items。';

  let response;
  try {
    response = await ollama.chatJson({
      baseUrl,
      model,
      schema: POLISH_SCHEMA,
      timeoutMs,
      messages: [
        { role: 'system', content: POLISH_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });
  } catch (error) {
    const reason = `ollama-failed:${String(error?.message ?? error)}`;
    logger?.warn?.(`断句失败，落盘清噪后的文本：${reason}`);
    return { items: denoised, usedModel: false, reason };
  }

  if (response?.ok !== true) {
    const reason = `ollama-failed:${String(response?.error ?? '未知错误')}`;
    logger?.warn?.(`断句失败，落盘清噪后的文本：${reason}`);
    return { items: denoised, usedModel: false, reason };
  }

  const outputs = Array.isArray(response?.data?.items)
    ? response.data.items.map((item) => String(item ?? '').trim()).filter((item) => item !== '')
    : [];
  if (outputs.length === 0) {
    return { items: denoised, usedModel: false, reason: 'bad-items' };
  }

  const verified = verifyPolish({ inputs: denoised, outputs });
  if (!verified.ok) {
    const reason = `unverified:${verified.reason}`;
    logger?.warn?.(`断句结果不忠实，落盘清噪后的文本：${reason}`);
    return { items: denoised, usedModel: false, reason };
  }

  const repair = repairItemCount({ inputs: denoised, outputs });
  return {
    items: verified.items,
    usedModel: true,
    reason: repair.repaired ? 'ok:merged-split' : 'ok',
  };
}
