/** 纯逻辑：速记意图识别（append / query / none）的逐条规则用例。 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NOTE_ACTIONS, detectNoteIntent } from '../lib/core/note-intent.js';

test('append：记一下 + 单条正文，执行尾巴不是动作字时仍记录', () => {
  const result = detectNoteIntent({
    text: '记一下：周五前给 Ollama 配开机自启，顺便测下内存占用',
  });
  assert.equal(result.action, NOTE_ACTIONS.APPEND);
  assert.equal(result.payload, '周五前给 Ollama 配开机自启，顺便测下内存占用');
  assert.equal(result.reason, 'note-trigger');
});

test('append：备忘 + 多行编号正文，保留多行', () => {
  const result = detectNoteIntent({
    text: '备忘：\n1. 给 remotion 咖啡视频补个结尾镜头\n2. 整理下 semmelweis 素材里的引用出处',
  });
  assert.equal(result.action, NOTE_ACTIONS.APPEND);
  assert.equal(
    result.payload,
    '1. 给 remotion 咖啡视频补个结尾镜头\n2. 整理下 semmelweis 素材里的引用出处',
  );
  assert.equal(result.reason, 'note-trigger');
});

test('append：突然想到一个点子式开场', () => {
  const result = detectNoteIntent({
    text: '突然想到一个点子：人物二创研究可以按角色阵营做个 Obsidian Bases 卡片视图',
  });
  assert.equal(result.action, NOTE_ACTIONS.APPEND);
  assert.equal(result.payload, '人物二创研究可以按角色阵营做个 Obsidian Bases 卡片视图');
  assert.equal(result.reason, 'note-trigger');
});

test('append：灵感触发词被剥离', () => {
  const result = detectNoteIntent({
    text: '灵感：把 lol-material 的皮肤系列按发布年份做条时间线视频',
  });
  assert.equal(result.action, NOTE_ACTIONS.APPEND);
  assert.equal(result.payload, '把 lol-material 的皮肤系列按发布年份做条时间线视频');
  assert.equal(result.reason, 'note-trigger');
});

test('append：句尾触发词，剥离触发词后正文即条目', () => {
  const samples = [
    ['这个方法不错，记一下', '这个方法不错'],
    ['明天要交房租，记一下。', '明天要交房租'],
    ['这个方法不错，请帮我记一下吧！', '这个方法不错'],
  ];
  for (const [text, payload] of samples) {
    assert.deepEqual(
      detectNoteIntent({ text }),
      { action: NOTE_ACTIONS.APPEND, payload, reason: 'note-trigger-suffix' },
      text,
    );
  }
});

test('none：句尾触发词不误伤改一下 / 记账这类非触发词', () => {
  for (const text of ['帮我把这个改一下', '别忘了记账']) {
    assert.deepEqual(detectNoteIntent({ text }), {
      action: NOTE_ACTIONS.NONE,
      payload: '',
      reason: '',
    }, text);
  }
});

test('none：单独一个句尾触发词且无引用时不写入空条目', () => {
  assert.deepEqual(detectNoteIntent({ text: '记一下' }), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
});

test('append：开头触发词优先，句尾分支不改写 payload', () => {
  const result = detectNoteIntent({
    text: '记一下：周五前给 Ollama 配开机自启，顺便测下内存占用',
  });
  assert.equal(result.action, NOTE_ACTIONS.APPEND);
  assert.equal(result.payload, '周五前给 Ollama 配开机自启，顺便测下内存占用');
  assert.equal(result.reason, 'note-trigger');
});

test('句尾触发词 6 条负例/回归逐条确认', () => {
  assert.deepEqual(detectNoteIntent({ text: '帮我把这个改一下' }), {
    action: NOTE_ACTIONS.NONE, payload: '', reason: '',
  });
  assert.deepEqual(detectNoteIntent({ text: '别忘了记账' }), {
    action: NOTE_ACTIONS.NONE, payload: '', reason: '',
  });
  assert.deepEqual(detectNoteIntent({ text: '记一下' }), {
    action: NOTE_ACTIONS.NONE, payload: '', reason: '',
  });
  assert.deepEqual(detectNoteIntent({
    text: '记一下：周五前给 Ollama 配开机自启，顺便测下内存占用',
  }), {
    action: NOTE_ACTIONS.APPEND,
    payload: '周五前给 Ollama 配开机自启，顺便测下内存占用',
    reason: 'note-trigger',
  });
  assert.deepEqual(detectNoteIntent({
    text: '记一下这个点子：做一期 Remotion 教程，顺便帮我上网搜下最新版本特性',
  }), {
    action: NOTE_ACTIONS.NONE, payload: '', reason: 'note-with-execution',
  });
  assert.deepEqual(detectNoteIntent({ text: '待整理里昨天记了什么，帮我列一下' }), {
    action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query',
  });
});

test('none：句尾触发词 + 执行尾巴仍按执行处理', () => {
  const result = detectNoteIntent({
    text: '明天交房租，顺便查下天气，记一下',
  });
  assert.deepEqual(result, {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: 'note-with-execution',
  });
});

test('append：只有触发词时 payload 为空，由调用方用 quoted 兜底', () => {
  const result = detectNoteIntent({ text: '记下来', quoted: '会议结论：周四提交终版' });
  assert.deepEqual(result, {
    action: NOTE_ACTIONS.APPEND,
    payload: '',
    reason: 'note-trigger',
  });
});

test('none：记录请求里带执行尾巴（顺便帮我搜）', () => {
  const result = detectNoteIntent({
    text: '记一下这个点子：做一期 Remotion 教程，顺便帮我上网搜下 Remotion 最新版本特性',
  });
  assert.deepEqual(result, {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: 'note-with-execution',
  });
});

test('none：执行尾巴关键词出现多次时，后续命中也能识别', () => {
  const result = detectNoteIntent({
    text: '记一下：周五前交预告片，顺便吃饭，另外搜下新素材',
  });
  assert.deepEqual(result, {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: 'note-with-execution',
  });
});

test('query：待整理 + 时间词 + 查询动作', () => {
  const result = detectNoteIntent({ text: '我待整理里昨天记了什么，帮我列一下' });
  assert.deepEqual(result, { action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query' });
});

test('query：速记 + 整理归档到项目卷', () => {
  const result = detectNoteIntent({ text: '帮我把今天的飞书速记整理归档到项目卷和主题卷里' });
  assert.deepEqual(result, { action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query' });
});

test('query：任务总表直接命中', () => {
  const result = detectNoteIntent({ text: '帮我把「周四提交视频终版」加进 OTD 的任务总表' });
  assert.deepEqual(result, { action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query' });
});

test('query：速记 + 这周 + 总结', () => {
  const result = detectNoteIntent({ text: '帮我看看飞书速记这周记了哪些想法，总结一下' });
  assert.deepEqual(result, { action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query' });
});

test('query：待整理里 + 时间词 + 列出，先判查询而不是写文件', () => {
  const result = detectNoteIntent({ text: '待整理里昨天记了什么，帮我列一下' });
  assert.deepEqual(result, { action: NOTE_ACTIONS.QUERY, payload: '', reason: 'note-query' });
});

test('none：裸名词触发词后接续写词，不误判成 append', () => {
  for (const text of [
    '备忘里的内容怎么导出',
    '待整理的东西太多了，怎么清理',
    '想法很好，但先别做',
    '灵感枯竭了，有什么办法',
  ]) {
    assert.deepEqual(detectNoteIntent({ text }), {
      action: NOTE_ACTIONS.NONE,
      payload: '',
      reason: '',
    }, text);
  }
});

test('append：备忘 + 冒号换行 + 编号多行（名词触发词回归）', () => {
  const result = detectNoteIntent({
    text: '备忘：\n1. 给 remotion 咖啡视频补个结尾镜头\n2. 整理下 semmelweis 素材里的引用出处',
  });
  assert.equal(result.action, NOTE_ACTIONS.APPEND);
  assert.equal(
    result.payload,
    '1. 给 remotion 咖啡视频补个结尾镜头\n2. 整理下 semmelweis 素材里的引用出处',
  );
});

test('append：待整理 + 冒号 + 正文，名词触发词仍可记录', () => {
  const result = detectNoteIntent({ text: '待整理：今天的想法' });
  assert.deepEqual(result, {
    action: NOTE_ACTIONS.APPEND,
    payload: '今天的想法',
    reason: 'note-trigger',
  });
});

test('append：裸「备忘」+ 引用消息，payload 空由 quoted 兜底', () => {
  assert.deepEqual(detectNoteIntent({ text: '备忘', quoted: '会议结论：周四提交终版' }), {
    action: NOTE_ACTIONS.APPEND,
    payload: '',
    reason: 'note-trigger-bare',
  });
});

test('append：裸「待整理。」+ 引用消息仍按引用记录', () => {
  assert.deepEqual(detectNoteIntent({ text: '待整理。', quoted: '把咖啡视频结尾镜头补上' }), {
    action: NOTE_ACTIONS.APPEND,
    payload: '',
    reason: 'note-trigger-bare',
  });
});

test('none：裸「备忘」没有引用消息时不写入空条目', () => {
  assert.deepEqual(detectNoteIntent({ text: '备忘' }), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
});

test('append：裸「点子」+ 引用消息也按引用记录', () => {
  assert.deepEqual(detectNoteIntent({ text: '点子', quoted: '把咖啡视频结尾镜头补上' }), {
    action: NOTE_ACTIONS.APPEND,
    payload: '',
    reason: 'note-trigger-bare',
  });
});

test('none：正文「备忘里的内容」+ 引用消息不被窄规则吃掉', () => {
  assert.deepEqual(
    detectNoteIntent({ text: '备忘里的内容', quoted: '把咖啡视频结尾镜头补上' }),
    { action: NOTE_ACTIONS.NONE, payload: '', reason: '' },
  );
});

test('none：长句 + 引用消息不会被裸触发词窄规则吃掉', () => {
  assert.deepEqual(
    detectNoteIntent({ text: '灵感枯竭了，有什么办法', quoted: '把咖啡视频结尾镜头补上' }),
    { action: NOTE_ACTIONS.NONE, payload: '', reason: '' },
  );
});

test('健壮性：null、无参与非字符串 text 均不抛', () => {
  const none = { action: NOTE_ACTIONS.NONE, payload: '', reason: '' };
  assert.deepEqual(detectNoteIntent(null), none);
  assert.deepEqual(detectNoteIntent(), none);
  assert.deepEqual(detectNoteIntent({ text: 123 }), none);
});

test('none：普通寒暄、翻译、日期问答都不算速记', () => {
  assert.deepEqual(detectNoteIntent({ text: '在吗' }), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
  assert.deepEqual(detectNoteIntent({ text: '把这句话翻成英文：今天天气不错' }), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
  assert.deepEqual(detectNoteIntent({ text: '今天几号' }), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
});

test('健壮性：非字符串输入不抛异常', () => {
  assert.deepEqual(detectNoteIntent(), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
  assert.deepEqual(detectNoteIntent({ text: 123 }), {
    action: NOTE_ACTIONS.NONE,
    payload: '',
    reason: '',
  });
});
