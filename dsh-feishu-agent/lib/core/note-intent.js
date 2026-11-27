/** 纯规则识别：这条消息是在“记速记”，还是在“查/整理已有速记”。无 IO、无依赖。 */

/** 速记意图枚举。 */
export const NOTE_ACTIONS = {
  APPEND: 'append',
  QUERY: 'query',
  NONE: 'none',
};

/**
 * 前置礼貌词：可叠加，如“麻烦帮我”“请帮我”。
 * 只影响剥离位置，不单独构成速记意图。
 */
const LEAD_PREFIX = /^(?:(?:请|帮我|麻烦)\s*)+/;

/**
 * 动词型触发词（长词在前，避免“记录一下”被“记一下”之类的短词抢先截断）。
 * 这类词本身就是动作，可无分隔符直接命中，后面必须紧跟正文。
 */
const VERB_TRIGGERS = [
  '收进待整理',
  '放到待整理',
  '写进待整理',
  '加入待整理',
  '存待整理',
  '记录一下',
  '记一下',
  '记下来',
  '记一笔',
  '记住',
];

/**
 * 名词型触发词：只有后接冒号、逗号或换行时才算“在记速记”。
 * 否则“待整理里昨天记了什么”“想法很好”这类查询/陈述句会被误写成文件。
 */
const NOUN_TRIGGERS = ['备忘', '待整理', '灵感', '想法', '点子'];

/** 动词型触发词后允许紧跟一个分隔符（英文/中文冒号或逗号）与空白。 */
const TRIGGER_TAIL = /^\s*(?:[:：,，]\s*)?/;

/** 名词型触发词后必须紧跟分隔符或换行，才视为记录意图。 */
const NOUN_TRIGGER_TAIL = /^(?:[：:,，]\s*|\r?\n\s*)/;

/**
 * 句尾触发词：中文最常见的记事写法之一是把触发词放在句尾，
 * 如“这个方法不错，记一下”。允许前置礼貌词、语气词与句末标点。
 * 长词在前，避免“备忘一下”被“备忘”抢先截断。
 */
const SUFFIX_TRIGGER = /(?:麻烦帮我|请帮我|帮我|麻烦|请)?(?:记录一下|备忘一下|记下来|记一笔|记一下|记住|备忘)[吧啊哦呀]?[。！!．.]*$/;

/** 句尾触发词前允许剥离的分隔符与空白，剥掉后剩下的就是正文。 */
const SUFFIX_SEPARATOR = /[\s，,：:、]+$/;

/** 句末终止标点：判定“裸触发词”时忽略，如单独回一个“备忘。”。 */
const SENTENCE_END = /[。！!．.]+$/;

/** “突然想到一个点子”式开场。 */
const BURST_PREFIX = /^(?:突然想到|忽然想到)\s*(?:一个点子|一个想法|点子|想法)/;

/** 执行尾巴关键词。 */
const EXECUTION_KEYWORDS = ['顺便', '另外', '再帮我', '同时', '然后', '顺手'];

/** 执行动作字：出现即说明用户要助手“现在去做”，不是纯记录。 */
const EXECUTION_VERBS = /[搜查改做跑渲染翻译总结整理读]/;

/** 速记主题词。 */
const NOTE_TOPICS = /待整理|速记|笔记|Obsidian|vault/i;

/** 查询动词。 */
const QUERY_VERBS = /记|写|存|列|找|总结|整理|归档|查|看|读|删|改|加进|添加|更新/;

/** 固定收纳卷名。 */
const NOTE_COLLECTIONS = /任务总表|行动卷|项目卷/;

/** 时间词。 */
const TIME_WORDS = ['昨天', '前天', '上周', '这周'];

/**
 * 判断全文是否带“执行尾巴”：`顺便 / 另外 / 再帮我 / 同时 / 然后 / 顺手` 之后
 * 8 个字内出现动作字，说明这条消息是“记完顺便让我做事”，应按普通任务处理。
 *
 * @param text 原文
 * @returns 是否带执行尾巴
 */
function hasExecutionTail(text) {
  for (const keyword of EXECUTION_KEYWORDS) {
    let at = text.indexOf(keyword);
    while (at >= 0) {
      const window = text.slice(at + keyword.length, at + keyword.length + 8);
      if (EXECUTION_VERBS.test(window)) return true;
      at = text.indexOf(keyword, at + keyword.length);
    }
  }
  return false;
}

/**
 * 匹配开头的速记触发词。
 *
 * 动词型触发词优先（“收进待整理”等包含名词型词根，必须先匹配）；
 * 名词型触发词要求后接分隔符或换行。
 *
 * @param text 原文
 * @returns 触发词结束位置；未命中返回 -1
 */
function matchNoteTrigger(text) {
  const lead = LEAD_PREFIX.exec(text);
  const start = lead === null ? 0 : lead[0].length;
  const rest = text.slice(start);
  for (const trigger of VERB_TRIGGERS) {
    if (!rest.startsWith(trigger)) continue;
    const tail = TRIGGER_TAIL.exec(rest.slice(trigger.length));
    return start + trigger.length + (tail === null ? 0 : tail[0].length);
  }
  for (const trigger of NOUN_TRIGGERS) {
    if (!rest.startsWith(trigger)) continue;
    const tail = NOUN_TRIGGER_TAIL.exec(rest.slice(trigger.length));
    if (tail === null) continue;
    return start + trigger.length + tail[0].length;
  }
  return -1;
}

/**
 * 判断正文是否“只剩一个名词型触发词”（可带前置礼貌词与句末终止标点）。
 *
 * 只用于引用消息场景：用户引用一条消息、只回一个“备忘”，语义是“把这条记下来”；
 * 没有引用消息时仍按 none 处理，避免写出空条目。
 *
 * @param text 原文
 * @returns 是否恰好是裸名词触发词
 */
function isBareNounTrigger(text) {
  const lead = LEAD_PREFIX.exec(text);
  const start = lead === null ? 0 : lead[0].length;
  const body = text.slice(start).trim().replace(SENTENCE_END, '').trim();
  return NOUN_TRIGGERS.includes(body);
}

/**
 * 匹配句尾触发词，如“这个方法不错，记一下”“明天要交房租，请帮我记一下。”。
 *
 * @param text 原文
 * @returns 触发词在原文中的起始位置；未命中返回 -1
 */
function matchSuffixTrigger(text) {
  const match = SUFFIX_TRIGGER.exec(text);
  return match === null ? -1 : match.index;
}

/**
 * 时间词附近 8 字内是否出现“记/写/存”。
 *
 * @param text 原文
 * @returns 是否命中
 */
function hasRecentNoteVerb(text) {
  for (const word of TIME_WORDS) {
    const at = text.indexOf(word);
    if (at < 0) continue;
    const window = text.slice(Math.max(0, at - 8), at + word.length + 8);
    if (/[记写存]/.test(window)) return true;
  }
  return false;
}

/**
 * 判断消息的速记意图。
 *
 * 判定顺序固定：APPEND（开头触发词）→ APPEND（句尾触发词）→ QUERY → NONE。
 *
 * @param options.text 用户原文
 * @param options.quoted 被引用消息（可空）
 * @returns `{ action, payload, reason }`；payload 仅在 append 时为剥离触发词后的正文
 */
export function detectNoteIntent(options = {}) {
  const { text, quoted = '' } = options ?? {};
  const raw = typeof text === 'string' ? text : '';
  const quote = typeof quoted === 'string' ? quoted.trim() : '';
  const trimmed = raw.trim();
  const none = { action: NOTE_ACTIONS.NONE, payload: '', reason: '' };

  if (trimmed === '') return none;

  // 1) APPEND：开头命中触发词（含“突然想到一个点子”式开场）。
  const burst = BURST_PREFIX.exec(trimmed);
  const triggerEnd = burst === null ? matchNoteTrigger(trimmed) : burst[0].length + (TRIGGER_TAIL.exec(trimmed.slice(burst[0].length))?.[0].length ?? 0);
  const hitTrigger = burst !== null || triggerEnd >= 0;

  if (hitTrigger) {
    const payload = trimmed.slice(triggerEnd).trim();
    if (payload === '' && quote !== '') {
      return { action: NOTE_ACTIONS.APPEND, payload: '', reason: 'note-trigger' };
    }
    // 只有触发词、既没有正文也没有引用：没有可记录的内容，不写入空条目。
    if (payload === '') return none;
    if (hasExecutionTail(trimmed)) {
      return { action: NOTE_ACTIONS.NONE, payload: '', reason: 'note-with-execution' };
    }
    return { action: NOTE_ACTIONS.APPEND, payload, reason: 'note-trigger' };
  }

  // 1.5) 裸名词触发词 + 引用消息：只回一个“备忘 / 待整理”表示记录被引用的那条。
  if (quote !== '' && isBareNounTrigger(trimmed)) {
    return { action: NOTE_ACTIONS.APPEND, payload: '', reason: 'note-trigger-bare' };
  }

  // 1.8) APPEND：句尾触发词（“这个方法不错，记一下”）。
  //      开头触发词分支优先，所以“记一下：……顺便……”不会被这里改写 payload。
  const suffixAt = matchSuffixTrigger(trimmed);
  if (suffixAt >= 0) {
    const payload = trimmed.slice(0, suffixAt).replace(SUFFIX_SEPARATOR, '').trim();
    if (payload === '') {
      return quote === ''
        ? none
        : { action: NOTE_ACTIONS.APPEND, payload: '', reason: 'note-trigger-suffix' };
    }
    // 句尾触发词同样要过执行尾巴检查：正文里带“顺便查一下”说明要先做事，不是纯记录。
    if (hasExecutionTail(payload)) {
      return { action: NOTE_ACTIONS.NONE, payload: '', reason: 'note-with-execution' };
    }
    return { action: NOTE_ACTIONS.APPEND, payload, reason: 'note-trigger-suffix' };
  }

  // 2) QUERY：查/整理已有速记，任一条件成立即可。
  //    主题词本身常自带“整理”等字（如“待整理”），先从文本中剥离再找查询动词，
  //    避免“待整理的东西太多了，怎么清理”被主题词里的“整理”误判成查询。
  const queryText = trimmed.replace(new RegExp(NOTE_TOPICS.source, 'gi'), '');
  const topicQuery = queryText !== trimmed && QUERY_VERBS.test(queryText);
  const collectionQuery = NOTE_COLLECTIONS.test(trimmed);
  if (topicQuery || collectionQuery || hasRecentNoteVerb(trimmed)) {
    return { action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query' };
  }

  // 3) 其余一律不做速记处理。
  return none;
}
