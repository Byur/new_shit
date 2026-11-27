/** 纯逻辑：确定性清噪、断句触发条件、忠实性校验与失败回退（无网络、无真实 Ollama）。 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  POLISH_SCHEMA,
  POLISH_SYSTEM_PROMPT,
  denoise,
  looksNoisy,
  needsPolish,
  needsPunctuation,
  polishItems,
  protectedTokens,
  repairItemCount,
  sameProtectedTokens,
  verifyPolish,
} from '../lib/local/polish.js';

/** 8 条真实语音转写噪声句及其确定性清噪结果。 */
const NOISY_SAMPLES = [
  ['呃那个我明天就是说要去一趟银行然后那个顺便把水费交了我我怕忘了', '我明天要去一趟银行顺便把水费交了我怕忘了'],
  ['嗯嗯这个卡片上的字是不是有点太多了能不能少一点看得我有点晕', '这个卡片上的字是不是有点太多了能不能少一点看得我有点晕'],
  ['那个啥我下午可能过不去了你帮我跟他说一声改天再约', '我下午可能过不去了你帮我跟他说一声改天再约'],
  ['就是说那个视频的开头我想换成一个黑底白字然后大概三秒左右慢慢淡出', '视频的开头我想换成一个黑底白字然后大概三秒左右慢慢淡出'],
  ['嗯就是那个 dsh-feishu-agent 的 README 里提到 227 个测试要全绿', 'dsh-feishu-agent 的 README 里提到 227 个测试要全绿'],
  ['呃 feishu 的卡片标题改成飞书兜底那个方案我觉得还行', 'feishu 的卡片标题改成飞书兜底那个方案我觉得还行'],
  ['唔我想想这个事情是不是应该先问一下再说', '我想想这个事情是不是应该先问一下再说'],
  ['我我明天去银行', '我明天去银行'],
];

/** 不能被误删的三种情况：裸 `那个`、裸 `然后`、代词以外的重叠。 */
const CLEAN_SAMPLES = ['那个报错要贴到 issue 里', '先跑测试然后提交', '把那个方案发给老板'];

/** 一条真实语音转写语料（308 字符 / 去空白 301），由它推翻了 maxChars 与孤立标点两个假设。 */
const CORPUS = '哼哼，是这样吗？嗯，可是我还没有吹头呢。我刚刚又去吃了一个水果。 我开了那个暖气，我觉得好干。 刚刚去衣柜里找到了一些以前的衣服，把冬天的拿出来。 嗯，因为呢，最近那个GPT，最近那个GPT，嗯，它的智力不太好，他除了圣徒之外没有其他的帮助，这会让我想，我要灵活地利用它的算力。 把那个暖气关了，然后现在就感觉房间它的温度就下来了。 找了一下，好像没有那种黑市渠道啊。你前两天不是说那个我买的咸鱼的黑茶被回收了嘛？看来只能够正价买。嗯，明天再研究了。 不然的话，嗯，不然的话，现在就是要自己脑爆，自己回忆当时说的什么。 嗯，对呀，我打算等一下去看看，不知道这是在哪里，什么奥特姆，一开始我还以为是那个云南印象那边呢。';

/** 该语料清噪后的逐字期望结果（274 字，保留原文的单空格）。 */
const CORPUS_DENOISED = '是这样吗？可是我还没有吹头呢。我刚刚又去吃了一个水果。 我开了那个暖气，我觉得好干。 刚刚去衣柜里找到了一些以前的衣服，把冬天的拿出来。最近那个GPT，它的智力不太好，他除了圣徒之外没有其他的帮助，这会让我想，我要灵活地利用它的算力。 把那个暖气关了，然后现在就感觉房间它的温度就下来了。 找了一下，好像没有那种黑市渠道啊。你前两天不是说那个我买的咸鱼的黑茶被回收了嘛？看来只能够正价买。明天再研究了。 不然的话，现在就是要自己脑爆，自己回忆当时说的什么。对呀，我打算等一下去看看，不知道这是在哪里，什么奥特姆，一开始我还以为是那个云南印象那边呢。';

test('POLISH_SCHEMA 只要求 items 字符串数组', () => {
  assert.deepEqual(POLISH_SCHEMA, {
    type: 'object',
    properties: { items: { type: 'array', items: { type: 'string' } } },
    required: ['items'],
  });
});

test('POLISH_SYSTEM_PROMPT 只允许插标点，且不含“含数字/英文就保守”的泛化句', () => {
  assert.equal(POLISH_SYSTEM_PROMPT.startsWith('你只给中文文本加标点和断句'), true);
  assert.equal(POLISH_SYSTEM_PROMPT.endsWith('只输出符合 Schema 的 items。'), true);
  assert.match(POLISH_SYSTEM_PROMPT, /严禁：删除、新增、改写任何一个汉字、字母、数字或符号/);
  assert.match(POLISH_SYSTEM_PROMPT, /严禁分条、严禁总结、严禁加标题、严禁改写措辞。/);
  assert.match(POLISH_SYSTEM_PROMPT, /输出去掉标点与空白后，必须与输入完全相同。/);
  assert.equal(POLISH_SYSTEM_PROMPT.includes('只给它加标点'), false);
  assert.equal(POLISH_SYSTEM_PROMPT.includes('必须删除这些口头语'), false);
  assert.match(POLISH_SYSTEM_PROMPT, /示例一：/);
  assert.match(POLISH_SYSTEM_PROMPT, /示例二：/);
  assert.match(POLISH_SYSTEM_PROMPT, /我明天要去一趟银行，顺便把水费交了。我怕忘了。/);
});

test('denoise：8 条真实噪声句输出确定', () => {
  for (const [input, expected] of NOISY_SAMPLES) {
    const result = denoise(input);
    assert.equal(result.text, expected, input);
    assert.ok(result.removed.length > 0, `应记录被删短语：${input}`);
  }
});

test('denoise：removed 按删除顺序记录命中的短语（可重复）', () => {
  assert.deepEqual(denoise('嗯就是那个呃那个明天开会').removed, ['嗯就是那个', '呃那个']);
  assert.deepEqual(denoise('我我明天去银行').removed, ['我我']);
  assert.deepEqual(denoise('嗯嗯嗯嗯明天开会').removed, ['嗯嗯', '嗯嗯']);
});

test('denoise：不删裸 那个 / 裸 然后 / 啊，也不碰动词重叠', () => {
  for (const sample of CLEAN_SAMPLES) {
    assert.deepEqual(denoise(sample), { text: sample, removed: [] }, sample);
  }
  assert.deepEqual(denoise('好啊我看看'), { text: '好啊我看看', removed: [] });
});

test('denoise：非字符串返回空结果且不抛', () => {
  for (const value of [null, undefined, 42, {}, []]) {
    assert.deepEqual(denoise(value), { text: '', removed: [] });
  }
});

test('denoise：折叠连续空白并 trim', () => {
  assert.equal(denoise('  把  那个   方案  ').text, '把 那个 方案');
});

test('looksNoisy：8 条噪声句全部命中', () => {
  for (const [input] of NOISY_SAMPLES) {
    assert.equal(looksNoisy(input), true, input);
  }
});

test('looksNoisy：干净句与“删不掉东西”的句子不命中', () => {
  for (const sample of CLEAN_SAMPLES) {
    assert.equal(looksNoisy(sample), false, sample);
  }
  assert.equal(looksNoisy('明天上午十点开会，记得带上合同。'), false);
  assert.equal(looksNoisy(null), false);
  assert.equal(looksNoisy(42), false);
});

test('looksNoisy：24 字无标点命中，23 字不命中', () => {
  assert.equal(looksNoisy('好'.repeat(23)), false);
  assert.equal(looksNoisy('好'.repeat(24)), true);
});

test('looksNoisy：多行干净笔记不因折叠空白被判成噪声', () => {
  const note = '记一下：\n- 周五前给 Ollama 配开机自启\n- 周末整理飞书机器人日志';
  assert.equal(looksNoisy(note), false);
  // 同一段里只要有真噪声仍然命中。
  assert.equal(looksNoisy('记一下：\n- 呃周五前给 Ollama 配开机自启'), true);
});

test('needsPunctuation：整段无标点才需要断句', () => {
  assert.equal(needsPunctuation('我明天要去一趟银行顺便把水费交了我怕忘了'), true);
  assert.equal(needsPunctuation('记一下：明天去很行交水电费'), true);
  assert.equal(needsPunctuation('记一下：明天去很行交水电费。'), false);
  assert.equal(needsPunctuation('前面一句，后面一句'), false);
  assert.equal(needsPunctuation(''), true);
});

test('needsPunctuation：token 内部与前置标签的冒号不算句子标点', () => {
  assert.equal(needsPunctuation('把 qwen3:8b 换成 qwen3:14b'), true);
  assert.equal(needsPunctuation('https://example.com/a?b=1 这个链接'), true);
  assert.equal(needsPunctuation('备忘：把 qwen3:8b 换成 qwen3:14b'), true);
  assert.equal(needsPunctuation('把 qwen3:8b 换成 qwen3:14b，显存 9GB'), false);
});

test('needsPolish：条目过多、超长、干净短句都不需要', () => {
  assert.equal(needsPolish({ items: Array(7).fill('噪声句'), text: '呃明天开会' }), false);
  assert.equal(needsPolish({ items: ['一句'], text: '好'.repeat(301) }), false);
  assert.equal(needsPolish({ items: ['一句'], text: '好'.repeat(301), maxChars: 400 }), true);
  assert.equal(needsPolish({ items: ['明天上午十点开会。'], text: '明天上午十点开会。' }), false);
  assert.equal(needsPolish({ items: ['呃明天开会'], text: '呃明天开会' }), true);
  assert.equal(needsPolish({ items: [], text: '呃明天开会' }), false);
  assert.equal(needsPolish({ items: null, text: '呃明天开会' }), false);
});

test('repairItemCount：等数原样返回输出', () => {
  assert.deepEqual(repairItemCount({ inputs: ['甲'], outputs: ['甲。'] }), {
    items: ['甲。'],
    repaired: false,
    reason: 'ok',
  });
});

test('repairItemCount：1 条被拆成 3 条时用全角逗号合并回 1 条', () => {
  assert.deepEqual(repairItemCount({ inputs: ['原始一句'], outputs: ['甲', '乙', '丙'] }), {
    items: ['甲，乙，丙'],
    repaired: true,
    reason: 'merged-split',
  });
});

test('repairItemCount：条数变少、变多、空输出分别报 lost/extra/empty', () => {
  assert.deepEqual(repairItemCount({ inputs: ['甲', '乙', '丙'], outputs: ['甲', '乙'] }), {
    items: ['甲', '乙', '丙'],
    repaired: false,
    reason: 'lost-items',
  });
  assert.deepEqual(repairItemCount({ inputs: ['甲', '乙'], outputs: ['甲', '乙', '丙'] }), {
    items: ['甲', '乙'],
    repaired: false,
    reason: 'extra-items',
  });
  assert.deepEqual(repairItemCount({ inputs: ['甲'], outputs: [] }), {
    items: ['甲'],
    repaired: false,
    reason: 'empty-output',
  });
});

test('verifyPolish：只加标点通过，且不再返回 tiers', () => {
  const input = '我明天要去一趟银行顺便把水费交了我怕忘了';
  const result = verifyPolish({ inputs: [input], outputs: ['我明天要去一趟银行，顺便把水费交了。我怕忘了。'] });
  assert.deepEqual(result, {
    ok: true,
    items: ['我明天要去一趟银行，顺便把水费交了。我怕忘了。'],
    reason: 'ok',
  });
  assert.equal('tiers' in result, false);
});

test('verifyPolish：改一个汉字报 text-changed', () => {
  const result = verifyPolish({ inputs: ['我明天去很行交水电费'], outputs: ['我明天去银行交水电费。'] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'text-changed');
  assert.deepEqual(result.items, ['我明天去很行交水电费']);
});

test('verifyPolish：token 内部标点被改报 token-changed', () => {
  const input = '把 qwen3:8b 换成 qwen3:14b';
  const result = verifyPolish({ inputs: [input], outputs: ['把 qwen3 8b 换成 qwen3 14b。'] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'token-changed');
  assert.deepEqual(result.items, [input]);
});

test('verifyPolish：URL 分隔符被抹掉时必须拒绝', () => {
  const input = '参考 https://example.com/a-b 然后更新文档';
  const result = verifyPolish({ inputs: [input], outputs: ['参考 httpsexamplecomab 然后更新文档。'] });
  assert.equal(result.ok, false);
  assert.ok(['token-changed', 'text-changed'].includes(result.reason), result.reason);
});

test('verifyPolish：输入 1 条输出 3 条时合并成 1 条并判 ok', () => {
  const result = verifyPolish({
    inputs: ['我明天去银行交水电费'],
    outputs: ['我明天去银行', '交', '水电费'],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.items, ['我明天去银行，交，水电费']);
  assert.equal(result.reason, 'ok');
});

test('verifyPolish：输入 2 条输出 1 条报 lost-items', () => {
  const result = verifyPolish({ inputs: ['甲', '乙'], outputs: ['甲。'] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'lost-items');
  assert.deepEqual(result.items, ['甲', '乙']);
});

test('verifyPolish：输出空串整批拒绝', () => {
  const result = verifyPolish({ inputs: ['明天开会'], outputs: [''] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.items, ['明天开会']);
  assert.ok(['empty-output', 'empty-item'].includes(result.reason), result.reason);
});

test('protectedTokens / sameProtectedTokens：按出现顺序抽 token，剥掉贴边句末标点', () => {
  assert.deepEqual(
    protectedTokens('把 qwen3:8b 换成 qwen3:14b，显存 9GB。'),
    ['qwen3:8b', 'qwen3:14b', '9GB'],
  );
  assert.deepEqual(protectedTokens('详见 https://example.com/a?b=1'), ['https://example.com/a?b=1']);
  assert.deepEqual(protectedTokens('纯中文的一句话'), []);
  assert.equal(sameProtectedTokens(['a'], ['a', 'b']), false);
  assert.equal(sameProtectedTokens(['a:b'], ['a b']), false);
  assert.equal(sameProtectedTokens(['a', 'b'], ['a', 'b']), true);
});

test('polishItems：干净短句完全不调用模型', async () => {
  let called = false;
  const inputItems = ['记一下：周五前给 Ollama 配开机自启'];
  const result = await polishItems({
    ollama: { async chatJson() { called = true; return { ok: true, data: { items: inputItems } }; } },
    items: inputItems,
    text: inputItems[0],
  });
  assert.equal(called, false);
  assert.deepEqual(result, { items: inputItems, usedModel: false, reason: 'not-needed' });
});

test('polishItems：条目过多与超长分别带出 too-many-items / too-long', async () => {
  let called = false;
  const ollama = { async chatJson() { called = true; return { ok: true, data: { items: [] } }; } };

  const tooMany = await polishItems({ ollama, items: Array(7).fill('呃明天开会'), text: '呃明天开会' });
  assert.deepEqual(tooMany, {
    items: Array(7).fill('明天开会'),
    usedModel: false,
    reason: 'too-many-items',
  });

  const tooLong = await polishItems({ ollama, items: ['呃明天开会'], text: `呃${'好'.repeat(300)}` });
  assert.deepEqual(tooLong, {
    items: ['明天开会'],
    usedModel: false,
    reason: 'too-long',
  });
  assert.equal(called, false);
});

test('polishItems：噪声句但原文有标点时不调用模型，只落盘去噪结果', async () => {
  let called = false;
  const inputItems = ['呃明天上午十点开会，记得带合同。'];
  const result = await polishItems({
    ollama: { async chatJson() { called = true; return { ok: true, data: { items: inputItems } }; } },
    items: inputItems,
    text: `记一下：${inputItems[0]}`,
  });
  assert.equal(called, false);
  assert.deepEqual(result, {
    items: ['明天上午十点开会，记得带合同。'],
    usedModel: false,
    reason: 'rule-only',
  });
});

test('polishItems：多条里只要有一条缺标点就仍然调用模型', async () => {
  let calls = 0;
  const inputItems = ['呃明天上午十点开会，记得带合同。', '那个啥下午可能过不去了你帮我跟他说一声'];
  const expected = inputItems.map((item) => denoise(item).text);
  const result = await polishItems({
    ollama: {
      async chatJson() {
        calls += 1;
        return { ok: true, data: { items: expected } };
      },
    },
    items: inputItems,
    text: `记一下\n${inputItems.join('\n')}`,
  });
  assert.equal(calls, 1);
  assert.equal(result.usedModel, true);
  assert.deepEqual(result.items, expected);
});

test('polishItems：模型不可用时落盘去噪结果，而不是原文', async () => {
  const inputItems = ['呃那个我明天就是说要去一趟银行'];
  const result = await polishItems({ ollama: {}, items: inputItems, text: inputItems[0] });
  assert.deepEqual(result, {
    items: [denoise(inputItems[0]).text],
    usedModel: false,
    reason: 'ollama-unavailable',
  });
  assert.notDeepEqual(result.items, inputItems);
});

test('polishItems：模型抛错或返回 ok:false 时落盘去噪结果', async () => {
  const inputItems = ['嗯就是那个把水费交了我怕忘了'];

  const thrown = await polishItems({
    ollama: { async chatJson() { throw new Error('boom'); } },
    items: inputItems,
    text: inputItems[0],
  });
  assert.equal(thrown.usedModel, false);
  assert.equal(thrown.reason, 'ollama-failed:boom');
  assert.deepEqual(thrown.items, [denoise(inputItems[0]).text]);

  const failed = await polishItems({
    ollama: { async chatJson() { return { ok: false, error: 'Ollama HTTP 500' }; } },
    items: inputItems,
    text: inputItems[0],
  });
  assert.equal(failed.usedModel, false);
  assert.equal(failed.reason, 'ollama-failed:Ollama HTTP 500');
  assert.deepEqual(failed.items, [denoise(inputItems[0]).text]);
});

test('polishItems：模型输出被改字时落盘去噪结果，不退原文也不采模型', async () => {
  const inputItems = ['呃那个明天要去银行交水电费'];
  const denoised = denoise(inputItems[0]).text;
  const result = await polishItems({
    ollama: {
      async chatJson() {
        return { ok: true, data: { items: ['明天要去很行交水电费。'] } };
      },
    },
    items: inputItems,
    text: inputItems[0],
  });
  assert.equal(result.usedModel, false);
  assert.equal(result.reason.startsWith('unverified:'), true, result.reason);
  assert.deepEqual(result.items, [denoised]);
  assert.notDeepEqual(result.items, inputItems);
});

test('polishItems：成功路径只接受插标点，透传引用消息并保持入参不变', async () => {
  const inputItems = ['嗯就是那个 dsh-feishu-agent 的 227 个测试要全绿'];
  const calls = [];
  const result = await polishItems({
    ollama: {
      async chatJson(options) {
        calls.push(options);
        return { ok: true, data: { items: ['dsh-feishu-agent 的 227 个测试要全绿。'] } };
      },
    },
    items: inputItems,
    text: inputItems[0],
    quoted: '上一条消息',
    model: 'qwen3:8b',
    baseUrl: 'http://127.0.0.1:11434',
    timeoutMs: 4321,
  });

  assert.equal(result.usedModel, true);
  assert.equal(result.reason, 'ok');
  assert.deepEqual(result.items, ['dsh-feishu-agent 的 227 个测试要全绿。']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'qwen3:8b');
  assert.equal(calls[0].baseUrl, 'http://127.0.0.1:11434');
  assert.equal(calls[0].timeoutMs, 4321);
  assert.deepEqual(calls[0].schema, POLISH_SCHEMA);
  assert.equal(calls[0].messages[0].content, POLISH_SYSTEM_PROMPT);
  assert.match(calls[0].messages[1].content, /^待整理原文：\n/);
  assert.match(calls[0].messages[1].content, /被引用消息：\n上一条消息/);
  assert.match(calls[0].messages[1].content, /请输出 items。$/);
  // 发给模型的是去噪后的文本。
  assert.equal(calls[0].messages[1].content.includes('嗯就是那个'), false);
  // 入参不被修改。
  assert.deepEqual(inputItems, ['嗯就是那个 dsh-feishu-agent 的 227 个测试要全绿']);
});

test('polishItems：模型返回 1→3 条时合并并报 ok:merged-split', async () => {
  const inputItems = ['呃那个这个卡片字太多了能不能少一点我看着累'];
  const result = await polishItems({
    ollama: {
      async chatJson() {
        return { ok: true, data: { items: ['这个卡片字太多了', '能不能少一点', '我看着累'] } };
      },
    },
    items: inputItems,
    text: inputItems[0],
  });
  assert.equal(result.usedModel, true);
  assert.equal(result.reason, 'ok:merged-split');
  assert.deepEqual(result.items, ['这个卡片字太多了，能不能少一点，我看着累']);
});

test('polishItems：模型返回空 items 时落盘去噪结果并报 bad-items', async () => {
  const inputItems = ['呃那个明天要去银行'];
  const result = await polishItems({
    ollama: { async chatJson() { return { ok: true, data: { items: [] } }; } },
    items: inputItems,
    text: inputItems[0],
  });
  assert.deepEqual(result, {
    items: [denoise(inputItems[0]).text],
    usedModel: false,
    reason: 'bad-items',
  });
});

test('polishItems：非字符串 items 不抛异常', async () => {
  const result = await polishItems({ ollama: {}, items: [null, 42], text: '呃明天开会' });
  assert.deepEqual(result.items, ['', '']);
  assert.equal(result.reason, 'ollama-unavailable');
});

test('真实语料：denoise 逐字等于期望输出，且保留原文的单空格', () => {
  const result = denoise(CORPUS);
  assert.equal(result.text, CORPUS_DENOISED);
  assert.equal(result.text.length, 274);
  // 原文里 `水果。 我开了` 的单个半角空格必须保留。
  assert.ok(result.text.includes('水果。 我开了那个暖气'));
});

test('真实语料：removed 记录 嗯 / 哼哼 / 因为呢', () => {
  const { removed } = denoise(CORPUS);
  for (const phrase of ['嗯', '哼哼', '因为呢']) {
    assert.ok(removed.includes(phrase), `removed 应包含 ${phrase}`);
  }
});

test('真实语料：无连续标点、无句首标点，且 那个 / 然后 / 对呀 按规则保留', () => {
  const { text } = denoise(CORPUS);
  assert.equal((text.match(/，。|，，/g) ?? []).length, 0);
  assert.equal(/^[\s，、；：]/.test(text), false, '输出不应以标点开头');
  assert.equal((text.match(/那个/g) ?? []).length, 5, '5 处裸 那个 都是指示词，必须保留');
  assert.equal((text.match(/然后/g) ?? []).length, 1, '然后 是顺序连接，必须保留');
  assert.equal((text.match(/对呀/g) ?? []).length, 1, '对呀 可能是真实回答，必须保留');
});

test('真实语料：looksNoisy 命中', () => {
  assert.equal(looksNoisy(CORPUS), true);
});

test('真实语料：超 maxChars 时 polishItems 仍落盘去噪结果（核心修复）', async () => {
  assert.equal(needsPolish({ items: [CORPUS], text: CORPUS, maxChars: 300 }), false);

  let called = false;
  const result = await polishItems({
    ollama: { async chatJson() { called = true; return { ok: true, data: { items: [CORPUS] } }; } },
    items: [CORPUS],
    text: CORPUS,
    maxChars: 300,
  });

  assert.equal(called, false, '超长只该跳过模型，不该跳过规则');
  assert.deepEqual(result.items, [CORPUS_DENOISED]);
  assert.notDeepEqual(result.items, [CORPUS], '绝不能退回带噪原文');
  assert.equal(result.reason, 'too-long');
  assert.equal(result.usedModel, false);
});

test('dedupeAdjacentClauses：只删紧邻重复，不删语义相关的不同子句', () => {
  assert.equal(denoise('好，好，好').text, '好，');
  assert.equal(denoise('我开了那个暖气，把那个暖气关了').text, '我开了那个暖气，把那个暖气关了');
  assert.equal(denoise('我开了那个暖气。把那个暖气关了。').text, '我开了那个暖气。把那个暖气关了。');
});
