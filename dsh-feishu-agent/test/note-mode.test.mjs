import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NOTE_MODE_DEFAULT_MINUTES,
  NOTE_MODE_MAX_MINUTES,
  clampNoteMinutes,
  createNoteMode,
  formatRemaining,
} from '../lib/core/note-mode.js';

/** 可推进的假时钟。 */
function fakeClock(start = 1_700_000_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => { current += ms; },
  };
}

test('note-mode：默认开启 10 分钟，窗口内 active', () => {
  const clock = fakeClock();
  const mode = createNoteMode({ now: clock.now });

  assert.deepEqual(mode.status('oc_a'), { active: false, remainingMs: 0, count: 0 });
  const state = mode.enable('oc_a');
  assert.equal(state.active, true);
  assert.equal(state.remainingMs, NOTE_MODE_DEFAULT_MINUTES * 60 * 1000);

  clock.advance(30 * 1000);
  assert.equal(mode.isActive('oc_a'), true);
  assert.equal(mode.status('oc_a').remainingMs, (NOTE_MODE_DEFAULT_MINUTES * 60 - 30) * 1000);
});

test('note-mode：窗口过期后自动失效，不计数', () => {
  const clock = fakeClock();
  const mode = createNoteMode({ now: clock.now });
  mode.enable('oc_a', { minutes: 1 });

  clock.advance(60 * 1000 + 1);
  assert.equal(mode.isActive('oc_a'), false);
  assert.deepEqual(mode.status('oc_a'), { active: false, remainingMs: 0, count: 0 });
  assert.equal(mode.record('oc_a'), 0, '过期后写入不应计数');
});

test('note-mode：按会话隔离', () => {
  const mode = createNoteMode({ now: () => 0 });
  mode.enable('oc_a');
  assert.equal(mode.isActive('oc_a'), true);
  assert.equal(mode.isActive('oc_b'), false);
});

test('note-mode：写入计数只在窗口内累加，关闭时带回', () => {
  const clock = fakeClock();
  const mode = createNoteMode({ now: clock.now });
  mode.enable('oc_a');
  assert.equal(mode.record('oc_a'), 1);
  assert.equal(mode.record('oc_a'), 2);

  const before = mode.disable('oc_a');
  assert.deepEqual(before, { active: true, remainingMs: NOTE_MODE_DEFAULT_MINUTES * 60 * 1000, count: 2 });
  assert.equal(mode.isActive('oc_a'), false);
  assert.equal(mode.record('oc_a'), 0);
});

test('note-mode：延长叠加时长，但不超过上限', () => {
  const clock = fakeClock();
  const mode = createNoteMode({ now: clock.now });
  mode.enable('oc_a', { minutes: 5 });

  clock.advance(60 * 1000);
  const extended = mode.extend('oc_a', { minutes: 5 });
  assert.equal(extended.remainingMs, 9 * 60 * 1000, '延长是在剩余时间上加，不是重置');

  const capped = mode.extend('oc_a', { minutes: 999 });
  assert.equal(capped.remainingMs, NOTE_MODE_MAX_MINUTES * 60 * 1000);
});

test('note-mode：延长已过期的窗口等于重新开启，计数归零', () => {
  const clock = fakeClock();
  const mode = createNoteMode({ now: clock.now });
  mode.enable('oc_a', { minutes: 1 });
  mode.record('oc_a');
  clock.advance(2 * 60 * 1000);

  const state = mode.extend('oc_a', { minutes: 3 });
  assert.equal(state.active, true);
  assert.equal(state.count, 0);
  assert.equal(state.remainingMs, 3 * 60 * 1000);
});

test('note-mode：重复 enable 会重置计时与计数', () => {
  const clock = fakeClock();
  const mode = createNoteMode({ now: clock.now });
  mode.enable('oc_a', { minutes: 5 });
  clock.advance(4 * 60 * 1000);
  mode.record('oc_a');

  const state = mode.enable('oc_a', { minutes: 10 });
  assert.equal(state.count, 0);
  assert.equal(state.remainingMs, 10 * 60 * 1000);
});

test('note-mode：分钟数收进 1 ~ 120', () => {
  assert.equal(clampNoteMinutes(undefined), NOTE_MODE_DEFAULT_MINUTES);
  assert.equal(clampNoteMinutes('abc'), NOTE_MODE_DEFAULT_MINUTES);
  assert.equal(clampNoteMinutes(0), 1);
  assert.equal(clampNoteMinutes(-5), 1);
  assert.equal(clampNoteMinutes(30), 30);
  assert.equal(clampNoteMinutes(999), NOTE_MODE_MAX_MINUTES);
  assert.equal(clampNoteMinutes('15'), 15);
});

test('note-mode：剩余时间格式化成 mm:ss', () => {
  assert.equal(formatRemaining(0), '00:00');
  assert.equal(formatRemaining(-1000), '00:00');
  assert.equal(formatRemaining(59_400), '01:00', '向上取整到秒');
  assert.equal(formatRemaining(9 * 60 * 1000 + 32 * 1000), '09:32');
  assert.equal(formatRemaining(125 * 60 * 1000), '125:00');
});
