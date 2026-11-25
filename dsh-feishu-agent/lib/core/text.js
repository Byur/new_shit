/** 文本处理：用户文本的解析、回答的清洗、卡片正文的截断。 */

import { ANSWER_MAX_CHARS } from '../common/constants.js';

/**
 * 去掉飞书群聊里的 @ 占位符（`@_user_1`）与零宽字符，压成干净的一句话。
 *
 * @param text 原始文本
 * @returns 干净文本
 */
export function cleanUserText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/@_user_\d+/g, ' ')
    .replace(/@_all/g, ' ')
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * 解析命令：`/new`、`/switch xx`、`/stop`、`/status`、`/help`。
 *
 * @param text 干净的用户文本
 * @returns `{ name, arg }`；不是命令时返回 undefined
 */
export function parseCommand(text) {
  if (typeof text !== 'string') return undefined;
  const match = /^\/([a-zA-Z]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (match === null) return undefined;
  return { name: match[1].toLowerCase(), arg: (match[2] ?? '').trim() };
}

/**
 * 从助手消息里取可见正文（只要 text 块；思考与工具结果不上屏）。
 *
 * @param message 助手消息
 * @returns 正文
 */
export function textOfAssistantMessage(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  return blocks
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

/**
 * 把回答压进卡片能装下的长度：超了就截断并附一句指路。
 *
 * @param text 完整回答
 * @param limit 字符上限
 * @returns 可以上屏的回答
 */
export function clampAnswer(text, limit = ANSWER_MAX_CHARS) {
  if (typeof text !== 'string') return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n…（内容过长已截断，完整回答请在 DSH Desktop 里查看该会话）`;
}

/**
 * 从会话标题投影里取一个可读标题；拿不到就返回空串。
 *
 * @param projection 投影值
 * @returns 标题
 */
export function titleOfProjection(projection) {
  return typeof projection?.title === 'string' ? projection.title : '';
}

/**
 * 回答里的图片引用：`![alt](path)`。
 *
 * 兼容 CommonMark 的几种写法：`![alt](<带 空格 的路径>)`、`![alt](path "title")`；
 * 裸路径不跨空白，够用且不误伤正文。
 */
const IMAGE_REF = /!\[([^\]]*)\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

/**
 * 把回答正文切成文字段与图片段，供卡片做图文混排。
 *
 * 只认 markdown 图片语法：模型写 `![示意图](/abs/path.png)` 就够了，
 * 不会把正文里随便出现的路径当图片。
 *
 * @param text 回答正文
 * @returns 段数组：`{ type: 'text', text }` 或 `{ type: 'image', alt, path }`
 */
export function splitImageRefs(text) {
  const source = typeof text === 'string' ? text : '';
  const segments = [];
  let last = 0;
  for (const match of source.matchAll(IMAGE_REF)) {
    const at = match.index ?? 0;
    if (at > last) segments.push({ type: 'text', text: source.slice(last, at) });
    segments.push({ type: 'image', alt: match[1], path: (match[2] ?? match[3] ?? '').trim() });
    last = at + match[0].length;
  }
  if (last < source.length) segments.push({ type: 'text', text: source.slice(last) });
  return segments;
}
