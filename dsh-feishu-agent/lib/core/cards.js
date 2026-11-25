/** 飞书卡片 JSON 2.0：回答卡、反问卡、审批卡、通知卡，以及体积与回调响应的工具函数。 */

import { CARD_COLORS, CARD_MAX_BYTES } from '../common/constants.js';

/** 卡片 JSON 版本。 */
export const CARD_SCHEMA = '2.0';

/** 按钮回传行为的类型。 */
const CALLBACK = 'callback';

/**
 * 量一张卡片序列化后的字节数。
 *
 * @param card 卡片对象
 * @returns 字节数
 */
export function cardBytes(card) {
  return new TextEncoder().encode(JSON.stringify(card)).length;
}

/**
 * 造一张卡片的外壳：标题栏 + 一组内容元素，`update_multi` 打开以便之后整张替换。
 *
 * @param options.title 标题栏文字
 * @param options.color 标题栏颜色（`CARD_COLORS` 里的值）
 * @param options.elements 内容元素
 * @returns 卡片对象
 */
export function buildCard({ title, color = 'grey', elements }) {
  return {
    schema: CARD_SCHEMA,
    config: { update_multi: true, wide_screen_mode: true },
    header: {
      template: color,
      title: { tag: 'plain_text', content: title },
    },
    body: {
      direction: 'vertical',
      elements,
    },
  };
}

/**
 * 造一个 markdown 正文元素。
 *
 * @param content markdown 文本
 * @returns 卡片元素
 */
export function markdown(content) {
  return { tag: 'markdown', content };
}

/**
 * 造一个按钮。
 *
 * @param options.name 组件名（同一张卡里唯一）
 * @param options.text 按钮文字
 * @param options.type 样式（`primary` / `danger` / `default`）
 * @param options.value 点击后回传给服务端的值
 * @returns 按钮元素
 */
export function button({ name, text, type = 'default', value }) {
  return {
    tag: 'button',
    name,
    type,
    text: { tag: 'plain_text', content: text },
    behaviors: [{ type: CALLBACK, value }],
  };
}

/**
 * 造一个图片元素（`img_key` 来自 `im/v1/images` 上传）。
 *
 * @param options.imgKey 图片 key
 * @param options.alt 替代文字（读屏与加载失败时用）
 * @returns 卡片元素
 */
export function imgElement({ imgKey, alt = '' }) {
  return {
    tag: 'img',
    img_key: imgKey,
    preview: true,
    // 完整展示不裁剪：成品图不该被按卡片比例切掉。
    scale_type: 'fit_horizontal',
    alt: { tag: 'plain_text', content: alt === '' ? '图片' : alt },
  };
}

/**
 * 把按钮排成一行等宽列。
 *
 * @param buttons 按钮元素
 * @returns 分栏元素
 */
export function buttonRow(buttons) {
  return {
    tag: 'column_set',
    horizontal_spacing: '8px',
    columns: buttons.map((item) => ({ tag: 'column', width: 'weighted', weight: 1, elements: [item] })),
  };
}

/**
 * 造一张纯文字卡片（状态终态、提示、通知都用它）。
 *
 * @param options.title 标题
 * @param options.content 正文（markdown）
 * @param options.color 标题栏颜色
 * @returns 卡片对象
 */
export function textCard({ title, content, color = CARD_COLORS.notice }) {
  return buildCard({ title, color, elements: content === '' ? [markdown(' ')] : [markdown(content)] });
}

/**
 * 造回答卡：标题随状态变，正文是已产出的回答；排队中带「撤回」，处理中带「停止」。
 *
 * @param options.messageId 触发这次回答的飞书消息 ID（按钮回传要用）
 * @param options.title 状态标题
 * @param options.color 标题栏颜色
 * @param options.content 正文
 * @param options.action 按钮：`stop` / `withdraw` / 无
 * @param options.activity 工具活动的单行摘要（放在正文之后，别抢回答的位置）
 * @param options.elements 已经排好的正文元素（图文混排用；给了就不看 `content`）
 * @returns 卡片对象
 */
export function answerCard({ messageId, title, color, content, action, activity, elements: body }) {
  const elements = body === undefined
    ? [markdown(content === '' ? '…' : content)]
    : [...body];
  if (typeof activity === 'string' && activity !== '') elements.push(markdown(activity));
  if (action === 'stop') {
    elements.push(buttonRow([
      button({ name: 'stop', text: '停止', type: 'danger', value: { tag: 'answer', action: 'stop', messageId } }),
    ]));
  }
  if (action === 'withdraw') {
    elements.push(buttonRow([
      button({ name: 'withdraw', text: '撤回', value: { tag: 'answer', action: 'withdraw', messageId } }),
    ]));
  }
  return buildCard({ title, color, elements });
}

/**
 * 把回调响应包成「弹 toast + 可选换卡」。
 *
 * @param toast 提示文字
 * @param type toast 类型（`info` / `success` / `error` / `warning`）
 * @param card 可选的新卡片
 * @returns 回调响应体
 */
export function toastResponse(toast, type = 'info', card) {
  return {
    toast: { type, content: toast },
    ...(card === undefined ? {} : { card: { type: 'raw', data: card } }),
  };
}

export { CARD_MAX_BYTES };
