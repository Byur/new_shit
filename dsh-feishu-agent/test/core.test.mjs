/** 纯逻辑：文本与命令解析、飞书事件归一化、卡片 JSON、绑定键、调度时间计算。 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanUserText, parseCommand, splitImageRefs, textOfAssistantMessage, clampAnswer } from '../lib/core/text.js';
import {
  CARD_ACTION_EVENT,
  MESSAGE_EVENT,
  eventIdOf,
  eventTimeMs,
  messageText,
  normalizeCardAction,
  normalizeEvent,
  normalizeMessageEvent,
  summarizeMessage,
} from '../lib/feishu/events.js';
import { answerCard, buildCard, button, buttonRow, cardBytes, imgElement, markdown, textCard, toastResponse } from '../lib/core/cards.js';
import { bindingKeyOf, localStamp, normalizeChatConfig } from '../lib/core/binding.js';
import { isOneShotDue, isRecurringDue, nextDueAt, normalizeSchedule } from '../lib/core/scheduler.js';
import { emptyState, normalizeState } from '../lib/core/store.js';
import { createTurnRegistry } from '../lib/core/turns.js';

test('cleanUserText 去掉 @ 占位符与多余空白', () => {
  assert.equal(cleanUserText('@_user_1 你好  @_user_2 世界'), '你好 世界');
  assert.equal(cleanUserText('   \u200b xxx  '), 'xxx');
  assert.equal(cleanUserText(undefined), '');
});

test('parseCommand 认出命令与参数', () => {
  assert.deepEqual(parseCommand('/new'), { name: 'new', arg: '' });
  assert.deepEqual(parseCommand('/switch session-ab12'), { name: 'switch', arg: 'session-ab12' });
  assert.deepEqual(parseCommand('/Stop'), { name: 'stop', arg: '' });
  assert.equal(parseCommand('你好 /new'), undefined);
  assert.equal(parseCommand(''), undefined);
});

test('textOfAssistantMessage 只取 text 块', () => {
  const message = { content: [{ type: 'text', text: '答案' }, { type: 'reasoning', text: '不想上屏' }] };
  assert.equal(textOfAssistantMessage(message), '答案');
  assert.equal(textOfAssistantMessage(undefined), '');
});

test('clampAnswer 超长截断并加提示', () => {
  const long = 'x'.repeat(50);
  assert.equal(clampAnswer(long, 100), long);
  const cut = clampAnswer(long, 10);
  assert.ok(cut.startsWith('xxxxxxxxxx'));
  assert.ok(cut.includes('截断'));
});

test('eventTimeMs 兼容微秒/毫秒/秒', () => {
  assert.equal(eventTimeMs({ header: { create_time: '1794638891596000' } }), 1794638891596);
  assert.equal(eventTimeMs({ header: { create_time: '1794638891596' } }), 1794638891596);
  assert.equal(eventTimeMs({ header: { create_time: '1794638891' } }), 1794638891000);
  assert.equal(eventTimeMs({}), undefined);
});

test('eventIdOf 优先 header.event_id', () => {
  assert.equal(eventIdOf({ header: { event_id: 'e1' }, uuid: 'u1' }), 'e1');
  assert.equal(eventIdOf({ uuid: 'u1' }), 'u1');
  assert.equal(eventIdOf({}), '');
});

test('messageText 解析 text 与 post', () => {
  assert.equal(messageText({ message_type: 'text', content: JSON.stringify({ text: 'hi' }) }), 'hi');
  const post = { message_type: 'post', content: JSON.stringify({ content: [[{ tag: 'text', text: 'a' }], [{ tag: 'text', text: 'b' }]] }) };
  assert.equal(messageText(post), 'a\nb');
  assert.equal(messageText({ message_type: 'image', content: '{}' }), '');
});

test('normalizeMessageEvent 压成插件事件', () => {
  const raw = {
    schema: '2.0',
    header: { event_id: 'ev-1', app_id: 'cli_x', tenant_key: 't1', create_time: String(Date.now() * 1000) },
    event: {
      sender: { sender_id: { open_id: 'ou_a' }, sender_type: 'user' },
      message: {
        message_id: 'om_1',
        chat_id: 'oc_1',
        chat_type: 'p2p',
        message_type: 'text',
        content: JSON.stringify({ text: '@_user_1 跑一下测试' }),
        create_time: String(Date.now() * 1000),
      },
    },
  };
  const event = normalizeMessageEvent(raw);
  assert.equal(event.kind, 'message');
  assert.equal(event.eventId, 'ev-1');
  assert.equal(event.chatId, 'oc_1');
  assert.equal(event.chatType, 'p2p');
  assert.equal(event.messageId, 'om_1');
  assert.equal(event.senderOpenId, 'ou_a');
  assert.equal(event.text, '@_user_1 跑一下测试');
  assert.equal(event.threadId, '');
});

test('normalizeCardAction 解析 value 与上下文', () => {
  const raw = {
    header: { event_id: 'ev-2', app_id: 'cli_x', tenant_key: 't1' },
    event: {
      operator: { open_id: 'ou_a' },
      action: { value: { tag: 'approval', action: 'allow', requestId: 'a_1' } },
      context: { open_chat_id: 'oc_1', open_message_id: 'om_9' },
    },
  };
  const event = normalizeCardAction(raw);
  assert.equal(event.kind, 'card');
  assert.equal(event.messageId, 'om_9');
  assert.equal(event.value.action, 'allow');
  assert.equal(event.operatorOpenId, 'ou_a');
});

test('normalizeEvent 按类型分派', () => {
  assert.equal(normalizeEvent(MESSAGE_EVENT, { event: { message: {} } })?.kind, 'message');
  assert.equal(normalizeEvent(CARD_ACTION_EVENT, { event: {} })?.kind, 'card');
  assert.equal(normalizeEvent('other', {}), undefined);
});

test('卡片 JSON：结构完整、体积可量、按钮带回调值', () => {
  const card = answerCard({ messageId: 'om_1', title: '处理中', color: 'blue', content: '正文', action: 'stop' });
  assert.equal(card.schema, '2.0');
  assert.equal(card.config.update_multi, true);
  const buttons = card.body.elements.flatMap((element) => element.columns ?? []).flatMap((column) => column.elements);
  assert.equal(buttons.length, 1);
  assert.deepEqual(buttons[0].behaviors[0].value, { tag: 'answer', action: 'stop', messageId: 'om_1' });
  assert.ok(cardBytes(card) > 0 && cardBytes(card) < 30 * 1024);
});

test('卡片 JSON：按钮与按钮行带回调值', () => {
  const row = buttonRow([
    button({ name: 'allow', text: '允许一次', type: 'primary', value: { tag: 'approval', action: 'allow', requestId: 'a_1' } }),
    button({ name: 'reject', text: '拒绝', type: 'danger', value: { tag: 'approval', action: 'reject', requestId: 'a_1' } }),
  ]);
  assert.equal(row.columns.length, 2);
  assert.deepEqual(row.columns[0].elements[0].behaviors[0].value, { tag: 'approval', action: 'allow', requestId: 'a_1' });
  const card = textCard({ title: 'T', content: '**粗**' });
  assert.equal(card.body.elements[0].tag, 'markdown');
  assert.equal(markdown('x').content, 'x');
});

test('buildCard 与 toastResponse 形状', () => {
  const card = buildCard({ title: 'T', color: 'grey', elements: [] });
  assert.equal(card.header.title.content, 'T');
  const response = toastResponse('好', 'success', card);
  assert.equal(response.toast.content, '好');
  assert.equal(response.card.type, 'raw');
});

test('bindingKeyOf 拼出稳定键', () => {
  assert.equal(bindingKeyOf({ appId: 'a', tenantKey: 't', chatId: 'c' }), 'a:t:c:-');
  assert.equal(bindingKeyOf({ appId: 'a', tenantKey: 't', chatId: 'c', threadId: 'x' }), 'a:t:c:x');
});

test('normalizeChatConfig 补默认值，缺工作区返回 undefined', () => {
  assert.equal(normalizeChatConfig({}), undefined);
  const config = normalizeChatConfig({ workspacePath: '/tmp' });
  assert.equal(config.permissionPreset, 'workspace-write');
  assert.equal(config.agentPreset, 'standard');
  assert.equal(config.titlePrefix, '[飞书]');
  const typed = normalizeChatConfig({ workspacePath: '/tmp', chatType: 'group', titlePrefix: '[私人]' });
  assert.equal(typed.chatType, 'group');
  assert.equal(typed.titlePrefix, '[私人]');
});

test('nextDueAt 计算周期任务的下一个时间点', () => {
  const anchor = '2026-11-14T00:00:00.000Z';
  const base = Date.parse(anchor);
  const schedule = { everySeconds: 3600, anchorAt: anchor };
  assert.equal(nextDueAt(schedule, base), base + 3600 * 1000);
  assert.equal(nextDueAt(schedule, base + 1), base + 3600 * 1000);
  assert.equal(nextDueAt(schedule, base + 3600 * 1000), base + 2 * 3600 * 1000);
});

test('isRecurringDue 与 isOneShotDue', () => {
  const anchor = '2026-11-14T00:00:00.000Z';
  const base = Date.parse(anchor);
  assert.equal(isRecurringDue({ everySeconds: 60, anchorAt: anchor }, base + 59_000), false);
  assert.equal(isRecurringDue({ everySeconds: 60, anchorAt: anchor }, base + 61_000), true);
  assert.equal(isRecurringDue({ everySeconds: 60, anchorAt: anchor, lastRunAt: new Date(base + 61_000).toISOString() }, base + 90_000), false);
  assert.equal(isOneShotDue({ at: anchor }, base + 1), true);
  assert.equal(isOneShotDue({ at: anchor }, base - 1), false);
});

test('normalizeSchedule 校验必填与互斥', () => {
  assert.ok(normalizeSchedule({}).error);
  assert.ok(normalizeSchedule({ id: 'a', chatId: 'c', prompt: 'p' }).error, '既没有 at 也没有 everySeconds');
  assert.ok(normalizeSchedule({ id: 'a', chatId: 'c', prompt: 'p', at: '2099-01-01T00:00:00Z', everySeconds: 60 }).error, '两者都给');
  assert.ok(normalizeSchedule({ id: 'a', chatId: 'c', prompt: 'p', everySeconds: 30 }).error, '间隔小于 60');
  const ok = normalizeSchedule({ id: 'a', chatId: 'c', prompt: 'p', everySeconds: 600 });
  assert.equal(ok.schedule.everySeconds, 600);
  assert.ok(ok.schedule.anchorAt);
});

test('normalizeState 补默认值并拒绝更高版本', () => {
  const state = normalizeState({ ownerOpenId: 'ou_x', bindings: { k: { dshSessionId: 's' } } });
  assert.equal(state.ownerOpenId, 'ou_x');
  assert.equal(state.bindings.k.key, 'k');
  assert.deepEqual(normalizeState(null), emptyState());
  assert.throws(() => normalizeState({ version: 99 }), /版本/);
});

test('轮次注册表：认领、按会话找活跃轮次、收尾', () => {
  const turns = createTurnRegistry();
  turns.open('om_1', { requestId: 'req1', sessionId: 's1', chatId: 'c1', bindingKey: 'k' });
  assert.equal(turns.activeTurnOfSession('s1'), undefined, '还没被取走时不算活跃');
  const claimed = turns.claim('req1', 3);
  assert.equal(claimed.feishuMessageId, 'om_1');
  assert.equal(turns.activeTurnOfSession('s1')?.turn, 3);
  assert.equal(turns.turnOf('s1', 3)?.messageId ?? turns.turnOf('s1', 3)?.feishuMessageId, 'om_1');
  assert.equal(turns.claim('unknown', 1), undefined);
  turns.finish(claimed, 'completed');
  assert.equal(turns.activeTurnOfSession('s1'), undefined);
});

test('localStamp 用本地时区而不是 UTC', () => {
  const date = new Date(2026, 10, 17, 13, 5); // 本地时间 11-17 13:05
  assert.equal(localStamp(date), '11-17 13:05');
  const utc = date.toISOString().slice(5, 16).replace('T', ' ');
  // 只有当本地时区不是 UTC 时两者才不同；用这个断言防止以后又改回 toISOString()
  assert.equal(localStamp(date) === utc, date.getTimezoneOffset() === 0);
});

test('splitImageRefs：把图片语法切成独立段，其它文字原样保留', () => {
  assert.deepEqual(splitImageRefs('让我看看 ![截图](/tmp/a.png) 然后继续'), [
    { type: 'text', text: '让我看看 ' },
    { type: 'image', alt: '截图', path: '/tmp/a.png' },
    { type: 'text', text: ' 然后继续' },
  ]);
  assert.deepEqual(splitImageRefs('没有图片'), [{ type: 'text', text: '没有图片' }]);
  assert.deepEqual(splitImageRefs(''), []);
});

test('splitImageRefs：兼容 <路径> 与 markdown title', () => {
  assert.deepEqual(splitImageRefs('![](<.preview/a.png>)'), [
    { type: 'image', alt: '', path: '.preview/a.png' },
  ]);
  assert.deepEqual(splitImageRefs('![图](<带 空格.png> "标题")'), [
    { type: 'image', alt: '图', path: '带 空格.png' },
  ]);
  assert.deepEqual(splitImageRefs('![图](/abs/a.png \'标题\')'), [
    { type: 'image', alt: '图', path: '/abs/a.png' },
  ]);
});

test('splitImageRefs：只认 markdown 图片语法，裸路径不当图片', () => {
  const segments = splitImageRefs('路径是 /tmp/a.png，但没有感叹号括号');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].type, 'text');
});

test('imgElement：卡片 2.0 的 img 元素用 img_key', () => {
  assert.deepEqual(imgElement({ imgKey: 'img_x' }), {
    tag: 'img',
    img_key: 'img_x',
    preview: true,
    scale_type: 'fit_horizontal',
    alt: { tag: 'plain_text', content: '图片' },
  });
});

test('answerCard：给了 elements 就按它排版，不再看 content', () => {
  const card = answerCard({
    messageId: 'om_1',
    title: '已完成',
    color: 'green',
    content: '会被忽略',
    action: undefined,
    elements: [markdown('前'), imgElement({ imgKey: 'img_y', alt: '图' }), markdown('后')],
  });
  const tags = card.body.elements.map((element) => element.tag);
  assert.deepEqual(tags, ['markdown', 'img', 'markdown']);
  assert.equal(JSON.stringify(card).includes('会被忽略'), false);
});

test('normalizeMessageEvent：带上 parent_id（引用回复）', () => {
  const event = normalizeMessageEvent({
    header: { event_id: 'ev1', app_id: 'cli_x', tenant_key: 't' },
    event: {
      sender: { sender_id: { open_id: 'ou_1' }, sender_type: 'user' },
      message: {
        message_id: 'om_2',
        parent_id: 'om_1',
        chat_id: 'oc_1',
        chat_type: 'p2p',
        message_type: 'text',
        content: JSON.stringify({ text: '这张图哪来的' }),
        create_time: String(Date.now() * 1000),
      },
    },
  });
  assert.equal(event.parentId, 'om_1');
});

test('summarizeMessage：文字、图片、富文本与卡片都能读成一句', () => {
  assert.equal(summarizeMessage({ msg_type: 'text', body: { content: '{"text":"你好"}' } }), '你好');
  assert.equal(summarizeMessage({ msg_type: 'image', body: { content: '{"image_key":"k"}' } }), '[图片]');
  assert.equal(
    summarizeMessage({ msg_type: 'post', body: { content: '{"title":"标题","content":[[{"tag":"text","text":"一"},{"tag":"text","text":"二"}]]}' } }),
    '标题\n一二',
  );
  const card = {
    msg_type: 'interactive',
    body: {
      content: JSON.stringify({
        header: { title: { tag: 'plain_text', content: '完成' } },
        body: { elements: [{ tag: 'markdown', content: '正文' }, { tag: 'img', img_key: 'k' }] },
      }),
    },
  };
  assert.equal(summarizeMessage(card), '完成\n正文');
});

test('turns：user/message 不带 turn 时用 turn/start 补上（两个顺序都要能接）', () => {
  // 顺序 A：turn/start 先到
  const a = createTurnRegistry({});
  a.open('om_1', { requestId: 'r1', sessionId: 's1', chatId: 'c1', bindingKey: 'k', text: 'x' });
  a.noteTurnStart('s1', 3);
  assert.equal(a.claim('r1', 0).turn, 3);
  assert.equal(a.turnOf('s1', 3)?.feishuMessageId, 'om_1');

  // 顺序 B：claim 先到
  const b = createTurnRegistry({});
  b.open('om_2', { requestId: 'r2', sessionId: 's1', chatId: 'c1', bindingKey: 'k', text: 'y' });
  assert.equal(b.claim('r2', 0).turn, 0);
  b.noteTurnStart('s1', 4);
  assert.equal(b.turnOf('s1', 4)?.feishuMessageId, 'om_2');
});

test('turns：一轮结束后不会把同一个 turn 号复用给下一条排队消息', () => {
  const registry = createTurnRegistry({});
  registry.open('om_a', { requestId: 'ra', sessionId: 's1', chatId: 'c1', bindingKey: 'k', text: 'a' });
  registry.noteTurnStart('s1', 5);
  const first = registry.claim('ra', 0);
  assert.equal(first.turn, 5);
  registry.finish(first, 'completed');

  registry.open('om_b', { requestId: 'rb', sessionId: 's1', chatId: 'c1', bindingKey: 'k', text: 'b' });
  assert.equal(registry.claim('rb', 0).turn, 0, '已经用掉的 turn 不该再绑');
});
