<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Download, Play, Square, RotateCcw, ChevronDown, Check, CircleAlert, WandSparkles } from 'lucide-vue-next';
import type { RunRecord } from '../../../../packages/shared/src/decision';
import type { DecisionRequest } from '../../../../packages/shared/src/schema';
import { record } from '../../../../packages/shared/src/decision';
import { runDecision } from '../lib/api';
import { downloadJson } from '../lib/storage';

type WritingMode = 'propose' | 'phrase';
type StageStatus = 'idle' | 'running' | 'done' | 'error';
interface WritingResult {
  runId: string; provider: string; model: string; mode: WritingMode; requestedAt: string;
  durationMs: number; request: { system: string; user: Record<string, unknown> };
  finishReason: string | null; content: string; reasoningMode: string; usage: unknown; raw: unknown;
}
interface PlanResult {
  plan_type?: string; intent?: string; first_step?: { type?: string; target?: string; content?: string };
  speech?: string; continuation_condition?: string; schedule_change?: null | {
    operation?: string; from?: string; to?: string; commitment_quote?: string; reason?: string;
  }; basis_refs?: string[]; assumptions?: string[];
  [key: string]: unknown;
}
interface ContinuityEvent { turn: number; kind: 'player_speech' | 'bob_speech' | 'bob_action_intent' | 'schedule_update'; text: string }
interface TraceEntry { id: string; at: string; actor: '玩家' | 'Runtime' | 'Clef' | 'DeepSeek' | 'World Core' | 'Session'; title: string; detail: string; tone: 'info' | 'success' | 'warning' | 'error' }
interface FlowRun {
  id: string; sessionId: string; turnNumber: number; priorEvents: ContinuityEvent[];
  createdAt: string; utterance: string; decisionRequest: DecisionRequest;
  decision: RunRecord | null; writingRequest: Record<string, unknown> | null;
  writing: WritingResult | null; writingError: string | null; route: string;
  worldCore: { checks: string[]; errors: string[]; committed: boolean } | null;
  committedAction: string | null; scheduleAfter: string; trace: TraceEntry[];
}

const props = defineProps<{ decision: RunRecord | null }>();
const histories = ref<FlowRun[]>(loadHistory());
const selected = ref<FlowRun | null>(histories.value[0] || null);
const sessionId = ref<string | null>(histories.value[0]?.sessionId || null);
const nextTurnNumber = ref(histories.value[0]?.turnNumber ? histories.value[0].turnNumber + 1 : 1);
const seedEvents = ref<ContinuityEvent[]>([]);
const utterance = ref('打烊了你能到后门看一眼吗？看看她在不在就行。');
const decisionModel = ref<'clef-flash' | 'clef'>('clef-flash');
const routeOverride = ref<'auto' | WritingMode>('auto');
const decisionBusy = ref(false);
const writingBusy = ref(false);
const error = ref('');
const speechStatus = ref<StageStatus>('done');
const decisionStatus = ref<StageStatus>('idle');
const writingStatus = ref<StageStatus>('idle');
const coreStatus = ref<StageStatus>('idle');
let decisionController: AbortController | null = null;
let writingController: AbortController | null = null;

const initialState = {
  world: { location: '酒馆', clock: '20:55，距打烊 5 分钟', closing_at: '21:00', appointment_at: '21:05' },
  character: { id: 'bob', name: '鲍勃', profile: '修琴人；会认真对待自己明确答应的事；不愿让别人替他安排。' },
  observation: { speaker: 'player', heard_verbatim: utterance.value, confidence: '清楚听见；原话是请求，不是事实陈述。' },
  personal_records: [
    { id: 'M1', kind: '个人记忆', text: '艾琳当面对我说过：“打烊后，门口等我一下。”她没有说哪扇门。' },
    { id: 'P1', kind: '自己的有效日程', version: 1, text: '21:05 在正门等艾琳。' },
    { id: 'O1', kind: '观察到的空间事实', text: '正门旁放着鲍勃的琴盒；后门通卸货巷。' },
  ],
};
const currentDecision = computed(() => selected.value?.decision || null);
const choiceAnswer = computed(() => {
  const result = currentDecision.value?.response;
  if (!result) return null;
  const q = result.answers.next_action;
  return record(q)?.choice as string | undefined;
});
const choiceQuestion = computed(() => selected.value?.decisionRequest.questions.next_action);
const choiceLabel = computed(() => {
  const choice = choiceAnswer.value;
  const q = choiceQuestion.value;
  return choice && q?.type === 'choice' ? String(q.criteria[choice] ?? choice) : choice || '';
});
const routeDescription = computed(() => selected.value?.route || '等待决策结果后，Runtime 才选择“既定意图拟稿”或“开放构思”。');
const plan = computed<PlanResult | null>(() => {
  const content = selected.value?.writing?.content;
  if (!content) return null;
  try { const parsed = JSON.parse(content); return record(parsed) as PlanResult | null; } catch { return null; }
});
const coreChecks = computed(() => selected.value?.worldCore);
const canCommit = computed(() => !!plan.value && !!coreChecks.value && coreChecks.value.errors.length === 0 && !coreChecks.value.committed);
const effectiveMode = computed<WritingMode | null>(() => {
  if (!choiceAnswer.value) return null;
  return routeOverride.value === 'auto' ? choiceAnswer.value === 'other' ? 'propose' : 'phrase' : routeOverride.value;
});
const stage = computed(() => ({ speech: speechStatus.value, decision: decisionStatus.value, writing: writingStatus.value, core: coreStatus.value }));
const activeTurnNumber = computed(() => selected.value?.turnNumber || nextTurnNumber.value);
const activePriorEvents = computed(() => selected.value?.priorEvents || (sessionId.value ? priorEventsForSession(sessionId.value, nextTurnNumber.value) : seedEvents.value));
const activeSessionTurns = computed(() => sessionId.value ? histories.value.filter(item => item.sessionId === sessionId.value).sort((a, b) => a.turnNumber - b.turnNumber) : []);
const canContinue = computed(() => !!selected.value?.worldCore?.committed && selected.value.turnNumber === Math.max(0, ...activeSessionTurns.value.map(item => item.turnNumber)));
const visibleTrace = computed(() => {
  const id = selected.value?.sessionId || sessionId.value;
  const throughTurn = selected.value?.turnNumber || nextTurnNumber.value;
  if (!id) return [];
  return histories.value.filter(item => item.sessionId === id && item.turnNumber <= throughTurn)
    .sort((a, b) => a.turnNumber - b.turnNumber)
    .flatMap(item => (item.trace || []).map(entry => ({ ...entry, turnNumber: item.turnNumber })));
});

function decisionInput(line: string, priorEvents: ContinuityEvent[], scheduleText: string): DecisionRequest {
  const priorTurns = sessionId.value ? histories.value.filter(item => item.sessionId === sessionId.value && item.turnNumber < nextTurnNumber.value && item.worldCore?.committed) : [];
  const scheduleVersion = 1 + priorTurns.filter(item => {
    let parsed: PlanResult | null = null;
    try { parsed = item.writing ? record(JSON.parse(item.writing.content)) as PlanResult | null : null; } catch { parsed = null; }
    return !!parsed?.schedule_change?.to;
  }).length;
  return {
    model: decisionModel.value,
    state: {
      ...structuredClone(initialState),
      personal_records: initialState.personal_records.map(entry => entry.id === 'P1' ? { ...entry, version: scheduleVersion, text: scheduleText } : entry),
      observation: { ...initialState.observation, heard_verbatim: line },
      schedule: { appointment: scheduleText, version: scheduleVersion, can_change_only_after: '鲍勃本人明确作出承诺' },
      session: { turn_number: nextTurnNumber.value, prior_events: priorEvents },
    },
    questions: {
      next_action: {
        type: 'choice',
        instructions: '判断鲍勃此刻最合适的下一步。优先考虑他实际听到的请求、个人赴约日程和时间约束。只有当现有候选都不能表达合理做法时才选 other；若需要消除关键歧义，选择 ask_first。不要把请求本身当作鲍勃已经答应。',
        criteria: {
          check_then_meet: '答应打烊后去后门查看，再去正门赴约',
          ask_first: '先问清楚要看什么、能否现在查看，再决定是否答应',
          keep_appointment: '不接这个请求，按原计划去正门等艾琳',
          other: '以上候选都不合适；需要另想一种做法',
        },
      },
      commitment: {
        type: 'noul',
        instructions: '仅根据现有输入，鲍勃是否已经明确承诺改变自己的安排？收到请求不等于承诺。',
      },
    },
  };
}

function loadHistory(): FlowRun[] {
  try {
    const raw = JSON.parse(localStorage.getItem('clef-lab:agent-tavern-flows:v1') || '[]');
    return Array.isArray(raw) ? raw.filter(x => typeof x?.id === 'string').map((x: any) => ({
      ...x,
      sessionId: typeof x.sessionId === 'string' ? x.sessionId : x.id,
      turnNumber: Number.isInteger(x.turnNumber) ? x.turnNumber : 1,
      priorEvents: Array.isArray(x.priorEvents) ? x.priorEvents : [],
      trace: Array.isArray(x.trace) ? x.trace : [],
    })).slice(0, 30) : [];
  } catch { return []; }
}
function persist() {
  try { localStorage.setItem('clef-lab:agent-tavern-flows:v1', JSON.stringify(histories.value.slice(0, 30))); }
  catch { error.value = '本地空间不足，当前流程仍可导出。'; }
}
function setStageFromRun(item: FlowRun) {
  speechStatus.value = 'done';
  decisionStatus.value = item.decision?.response ? 'done' : item.decision?.error ? 'error' : 'idle';
  writingStatus.value = item.writing ? 'done' : item.writingError ? 'error' : 'idle';
  coreStatus.value = item.worldCore?.committed ? 'done' : item.worldCore ? (item.worldCore.errors.length ? 'error' : 'done') : 'idle';
}
function update(item: FlowRun) {
  const index = histories.value.findIndex(x => x.id === item.id);
  if (index >= 0) histories.value.splice(index, 1, item);
  else histories.value.unshift(item);
  histories.value = histories.value.slice(0, 30);
  selected.value = item;
  persist();
}
function appendTrace(item: FlowRun, actor: TraceEntry['actor'], title: string, detail: string, tone: TraceEntry['tone'] = 'info') {
  item.trace ||= [];
  item.trace.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, title, detail, tone });
  update(item);
}
function eventsFromTurn(item: FlowRun): ContinuityEvent[] {
  if (!item.worldCore?.committed) return [];
  const events: ContinuityEvent[] = [{ turn: item.turnNumber, kind: 'player_speech', text: item.utterance }];
  const output = item.writing?.content;
  let result: PlanResult | null = null;
  try { result = output ? record(JSON.parse(output)) as PlanResult | null : null; } catch { result = null; }
  if (result?.speech) events.push({ turn: item.turnNumber, kind: 'bob_speech', text: result.speech });
  if (item.committedAction) events.push({ turn: item.turnNumber, kind: 'bob_action_intent', text: `已确认记录的行动意图（尚未模拟执行）：${item.committedAction}` });
  if (result?.schedule_change?.to) events.push({ turn: item.turnNumber, kind: 'schedule_update', text: `鲍勃的日程更新为：${result.schedule_change.to}` });
  return events;
}
function priorEventsForSession(id: string, beforeTurn: number): ContinuityEvent[] {
  const committed = histories.value.filter(item => item.sessionId === id && item.turnNumber < beforeTurn && item.worldCore?.committed)
    .sort((a, b) => a.turnNumber - b.turnNumber);
  const events = committed.flatMap(eventsFromTurn);
  return [...seedEvents.value, ...events];
}
function scheduleForSession(id: string, beforeTurn: number): string {
  const previous = histories.value.filter(item => item.sessionId === id && item.turnNumber < beforeTurn && item.worldCore?.committed)
    .sort((a, b) => b.turnNumber - a.turnNumber)[0];
  return previous?.scheduleAfter || '打烊后 21:05 到正门等艾琳';
}
function newFlow() {
  error.value = '';
  const line = utterance.value.trim();
  if (!line) { error.value = '先输入一句被鲍勃听见的话。'; return; }
  if (!sessionId.value) { sessionId.value = crypto.randomUUID(); nextTurnNumber.value = 1; seedEvents.value = []; }
  const priorEvents = priorEventsForSession(sessionId.value, nextTurnNumber.value);
  const scheduleText = scheduleForSession(sessionId.value, nextTurnNumber.value);
  const input = decisionInput(line, priorEvents, scheduleText);
  const item: FlowRun = {
    id: crypto.randomUUID(), sessionId: sessionId.value, turnNumber: nextTurnNumber.value,
    priorEvents, createdAt: new Date().toISOString(), utterance: line,
    decisionRequest: input, decision: null, writingRequest: null, writing: null,
    writingError: null, route: '', worldCore: null, committedAction: null,
    scheduleAfter: scheduleText, trace: [],
  };
  routeOverride.value = 'auto';
  update(item);
  decisionStatus.value = 'idle'; writingStatus.value = 'idle'; coreStatus.value = 'idle'; speechStatus.value = 'done';
  if (priorEvents.length) appendTrace(item, 'Session', `接续第 ${item.turnNumber} 轮`, `承接 ${priorEvents.length} 条已提交事件；本轮模型将看到这些前序信息。`, 'info');
  appendTrace(item, '玩家', '提交本轮发言', line, 'info');
  const candidateCount = input.questions.next_action?.type === 'choice' ? Object.keys(input.questions.next_action.criteria).length : 0;
  appendTrace(item, 'Runtime', '准备决策上下文', `Session T${item.turnNumber}；携带 ${priorEvents.length} 条已提交前序事件；候选 ${candidateCount} 项。`);
}
async function runClef() {
  if (decisionBusy.value) return;
  if (!selected.value || selected.value.utterance !== utterance.value.trim()) newFlow();
  const item = selected.value;
  if (!item) return;
  error.value = ''; decisionBusy.value = true; decisionStatus.value = 'running';
  decisionController = new AbortController();
  // FlowRun comes from a Vue ref, so decisionRequest may be a reactive Proxy that structuredClone rejects.
  // This contract is JSON-only; serialize it to capture the immutable request snapshot safely.
  const requestSnapshot = JSON.parse(JSON.stringify(item.decisionRequest)) as DecisionRequest;
  const recordRun: RunRecord = { id: crypto.randomUUID(), requestedAt: new Date().toISOString(), request: requestSnapshot, response: null, error: null, clientDurationMs: 0 };
  const started = performance.now();
  appendTrace(item, 'Runtime', '调用 Clef', `${recordRun.request.model}；发送当前发言、角色状态和封闭候选。`);
  try {
    recordRun.response = await runDecision(recordRun.request, decisionController.signal);
    recordRun.id = recordRun.response.runId;
    item.decision = recordRun; item.writing = null; item.writingError = null; item.worldCore = null; item.committedAction = null;
    const choice = record(recordRun.response.answers.next_action)?.choice;
    const q = recordRun.request.questions.next_action;
    const candidate = q?.type === 'choice' && typeof choice === 'string' ? q.criteria[choice] : choice;
    item.route = choice === 'other'
      ? `Clef 选择 other：候选集没有覆盖的做法，Runtime 分派给 DeepSeek 开放构思。`
      : `Clef 选择「${String(candidate ?? '未识别答案')}」：Runtime 将意图交给 DeepSeek 拟写角色发言。`;
    decisionStatus.value = 'done';
    const commitment = record(recordRun.response.answers.commitment)?.noul;
    appendTrace(item, 'Clef', '决策结果返回', `选择 ${String(choice ?? '未识别')} · ${String(candidate ?? '')}；承诺概率 ${typeof commitment === 'number' ? `${(commitment * 100).toFixed(1)}%` : '无有效值'}；服务端 ${recordRun.response.durationMs} ms。`, 'success');
    appendTrace(item, 'Runtime', choice === 'other' ? '分派开放构思' : '分派既定意图拟稿', item.route, 'info');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Clef 请求失败。';
    recordRun.error = { code: 'FLOW_ERROR', message };
    item.decision = recordRun; item.route = '决策模型调用失败，尚未分派写作模型。';
    decisionStatus.value = 'error'; error.value = message;
    appendTrace(item, 'Clef', '决策请求失败', message, 'error');
  } finally {
    recordRun.clientDurationMs = Math.round(performance.now() - started);
    decisionBusy.value = false; decisionController = null; update(item);
  }
}
function continueSession() {
  const current = selected.value;
  if (!current?.worldCore?.committed) return;
  const latest = Math.max(...histories.value.filter(item => item.sessionId === current.sessionId).map(item => item.turnNumber));
  if (current.turnNumber !== latest) {
    error.value = '请选择这个 Session 最新且已提交的一轮，再继续。';
    return;
  }
  sessionId.value = current.sessionId;
  nextTurnNumber.value = current.turnNumber + 1;
  seedEvents.value = [];
  selected.value = null;
  utterance.value = '';
  error.value = '';
  speechStatus.value = 'idle'; decisionStatus.value = 'idle'; writingStatus.value = 'idle'; coreStatus.value = 'idle';
}
function makeWritingRequest(item: FlowRun) {
  const choice = record(item.decision?.response?.answers.next_action)?.choice;
  const q = item.decisionRequest.questions.next_action;
  const candidate = q?.type === 'choice' && typeof choice === 'string' ? q.criteria[choice] : String(choice || '');
  const isOpen = effectiveMode.value === 'propose';
  const state = item.decisionRequest.state as Record<string, unknown>;
  const task = isOpen ? {
    goal: '为鲍勃提出一种候选列表未覆盖、但符合其个人记录和现场条件的做法。你可以提出不同于候选的方案，也可以判断暂缓更合理。不要替其他角色行动，不要把尚未发生的行动写成事实。',
    rejected_or_insufficient_candidates: Object.entries(q?.type === 'choice' ? q.criteria : {}).map(([id, value]) => ({ id, intent: value })),
    required_output: '生成可执行的单个第一步、角色此刻可说的一句话、继续条件，以及可选的日程变更提案。',
  } : {
    goal: '严格落实决策模型选定的行动意图，为鲍勃写一句自然、符合人物的发言，并指出他的第一步。不能改变所选行动的目的；如信息不足，台词可以提出澄清，不得虚构承诺。',
    selected_candidate: { id: choice, intent: candidate },
    required_output: '生成发言、第一步和继续条件；日程变更只作为提案，必须给出发言中的明确承诺原文。',
  };
  return {
    model: 'deepseek-flash' as const, mode: isOpen ? 'propose' as const : 'phrase' as const,
    state: { ...state, writing_context: { player_utterance: item.utterance, selected_intent: isOpen ? null : candidate } },
    task,
  };
}
async function runWriting() {
  const item = selected.value;
  if (!item?.decision?.response || !choiceAnswer.value || writingBusy.value) return;
  error.value = ''; writingBusy.value = true; writingStatus.value = 'running'; coreStatus.value = 'idle';
  item.worldCore = null; item.writing = null; item.writingError = null;
  const request = makeWritingRequest(item); item.writingRequest = request; update(item);
  writingController = new AbortController();
  const started = performance.now();
  appendTrace(item, 'Runtime', `分派 DeepSeek · ${request.mode === 'propose' ? '开放构思' : '既定意图拟稿'}`, `${routeDescription.value}；本轮写作输入携带 ${item.priorEvents.length} 条前序事件。`);
  try {
    const response = await fetch('/api/writing/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: writingController.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'DeepSeek 请求失败。');
    const writingResult = { ...result, clientDurationMs: Math.round(performance.now() - started) } as WritingResult;
    item.writing = writingResult;
    item.route = `${item.route} 实际投递：${writingResult.mode === 'propose' ? '开放构思' : '既定意图拟稿'}。`;
    writingStatus.value = 'done';
    let summary = '响应返回，但内容不是可解析的计划 JSON。';
    try {
      const generated = record(JSON.parse(writingResult.content));
      if (generated) summary = `意图：${String(generated.intent || '未提供')}；第一步：${String(record(generated.first_step)?.type || '未提供')} · ${String(record(generated.first_step)?.content || '')}；台词：${String(generated.speech || '未提供')}；${writingResult.durationMs} ms。`;
    } catch { /* keep parse-failure summary */ }
    appendTrace(item, 'DeepSeek', '写作结果返回', summary, 'success');
    validateWorldCore(item);
  } catch (e) {
    item.writingError = e instanceof Error ? e.message : 'DeepSeek 请求失败。';
    error.value = item.writingError; writingStatus.value = 'error';
    appendTrace(item, 'DeepSeek', '写作请求失败', item.writingError, 'error');
  } finally {
    writingBusy.value = false; writingController = null; update(item);
  }
}
function validateWorldCore(item: FlowRun) {
  const result = item.writing;
  let parsed: PlanResult | null = null;
  try { parsed = result ? record(JSON.parse(result.content)) as PlanResult | null : null; } catch { parsed = null; }
  const checks: string[] = [];
  const errors: string[] = [];
  if (!result || !parsed) errors.push('写作模型没有返回可解析的 JSON 对象，World Core 拒绝结算。');
  else {
    checks.push('返回内容是 JSON 对象');
    if (!['new', 'reuse', 'defer', 'phrase'].includes(String(parsed.plan_type))) errors.push('plan_type 缺失或不在约定值中（new / reuse / defer / phrase）。');
    if (parsed.plan_type === 'invalid') errors.push('写作模型标记所需意图与输入事实不相容，World Core 拒绝结算。');
    if (typeof parsed.intent === 'string' && parsed.intent.trim()) checks.push('提案包含行动意图');
    else errors.push('缺少 intent，不能确定写作模型提议的行动目标。');
    if (parsed.first_step && ['say', 'move', 'observe', 'wait', 'ask', 'defer'].includes(String(parsed.first_step.type)) && typeof parsed.first_step.content === 'string' && parsed.first_step.content.trim()) checks.push('第一步属于允许的动作类型，且包含动作说明');
    else errors.push('first_step.type 缺失或不在允许集合中（say / move / observe / wait / ask / defer）。');
    if (typeof parsed.speech === 'string' && parsed.speech.trim()) checks.push('发言是待提交内容，不会自动记作世界事实');
    else errors.push('缺少 speech，无法形成角色发言事件。');
    const itemChoice = record(item.decision?.response?.answers.next_action)?.choice;
    if (item.writingRequest?.mode === 'phrase' && itemChoice === 'other') errors.push('Runtime 路由冲突：other 必须进入开放构思。');
    if (item.writingRequest?.mode === 'propose' && itemChoice !== 'other') errors.push('Runtime 路由冲突：当前决策选择了候选项，不应以开放构思模式越过既定意图。');
    const change = parsed.schedule_change;
    if (!change) checks.push('没有日程变更提案，保持原日程');
    else {
      const quote = change.commitment_quote;
      if (typeof quote === 'string' && quote.trim() && parsed.speech?.includes(quote)) {
        checks.push('日程提案引用的文本与拟提交发言逐字一致；语义上的承诺仍需人工确认');
      } else errors.push('日程变更缺少与角色发言逐字匹配的 commitment_quote，World Core 不得修改日程。');
      if (change.operation === 'replace' && typeof change.to === 'string' && change.to.trim()) checks.push(`目标日程明确：${change.to}`);
      else if (change) errors.push('日程变更提案缺少 to。');
    }
  }
  item.worldCore = { checks, errors, committed: false };
  coreStatus.value = errors.length ? 'error' : 'done';
  appendTrace(item, 'World Core', errors.length ? '提案未通过校验' : '提案通过结构校验', errors.length ? errors.join('；') : `通过 ${checks.length} 项检查，等待人工确认。`, errors.length ? 'warning' : 'success');
}
function commitWorldCore() {
  const item = selected.value;
  const result = item?.worldCore;
  const generated = plan.value;
  if (!item || !result || !generated || result.errors.length) return;
  const type = generated.first_step?.type || 'unknown';
  const target = generated.first_step?.target ? ` → ${generated.first_step.target}` : '';
  item.committedAction = `${type}${target}：${generated.first_step?.content || generated.intent || '未提供动作说明'}；发言事件：「${generated.speech}」`;
  if (generated.schedule_change?.to) item.scheduleAfter = generated.schedule_change.to;
  result.committed = true;
  result.checks = [...result.checks, '实验者确认：台词与行动意图写入 Session；动作执行仍待模拟'];
  coreStatus.value = 'done';
  appendTrace(item, 'World Core', '确认并写入 Session', `记录行动意图与发言；日程：${item.scheduleAfter}。动作尚未模拟执行。`, 'success');
}
function cancel() { decisionController?.abort(); writingController?.abort(); }
function reset() { utterance.value = '打烊了你能到后门看一眼吗？看看她在不在就行。'; selected.value = null; sessionId.value = null; nextTurnNumber.value = 1; seedEvents.value = []; error.value = ''; speechStatus.value = 'done'; decisionStatus.value = 'idle'; writingStatus.value = 'idle'; coreStatus.value = 'idle'; }
function chooseFlow(item: FlowRun) {
  selected.value = item; utterance.value = item.utterance; decisionModel.value = item.decisionRequest.model; setStageFromRun(item);
  sessionId.value = item.sessionId; nextTurnNumber.value = item.turnNumber + 1; seedEvents.value = [];
  const storedMode = item.writingRequest?.mode;
  const expectedMode = record(item.decision?.response?.answers.next_action)?.choice === 'other' ? 'propose' : 'phrase';
  routeOverride.value = storedMode === expectedMode ? 'auto' : storedMode === 'propose' || storedMode === 'phrase' ? storedMode : 'auto';
}
watch(() => props.decision?.id, () => {
  // Keep the generic Decision Lab reusable; this workflow owns its fixed tavern state and candidate set.
});
</script>

<template>
  <section class="writing-lab flow-lab">
    <div class="writing-heading">
      <div><span class="eyebrow">AGENT RUNTIME · TRACE VIEW</span><h2>“去后门看一眼”协作实验</h2><p>逐步观察玩家话语如何进入决策、开放构思或拟稿，再由 World Core 校验并提交。</p></div>
      <div class="flow-actions"><button class="writing-export" :disabled="!selected" @click="selected && downloadJson('agent-tavern-flow.json', selected)"><Download :size="15" /> 导出全链路</button><button class="writing-export" @click="reset"><RotateCcw :size="14" /> 新实验</button></div>
    </div>

    <div class="flow-timeline" aria-label="协作阶段">
      <div v-for="(item, key) in [{ key: 'speech', title: `第 ${activeTurnNumber} 轮 · 玩家输入`, sub: 'Speech Event' }, { key: 'decision', title: '决策模型', sub: 'Clef · candidate / other' }, { key: 'writing', title: '写作模型', sub: 'DeepSeek · propose / phrase' }, { key: 'core', title: '本地确认', sub: 'accept · append to session' }]" :key="key" class="flow-stage" :class="`stage-${stage[item.key as keyof typeof stage]}`">
        <span class="flow-stage-index">{{ String(Object.keys(stage).indexOf(item.key) + 1).padStart(2, '0') }}</span><strong>{{ item.title }}</strong><small>{{ item.sub }}</small>
        <span class="flow-stage-status">{{ stage[item.key as keyof typeof stage] === 'done' ? '完成' : stage[item.key as keyof typeof stage] === 'running' ? '运行中' : stage[item.key as keyof typeof stage] === 'error' ? '需处理' : '等待' }}</span>
      </div>
    </div>

    <div class="flow-session-strip">
      <div><b>{{ sessionId ? `连续 Session · ${sessionId.slice(0, 8)}` : '新 Session · 尚未开始' }}</b><span>{{ activeSessionTurns.length }} 轮已记录 · 当前准备第 {{ activeTurnNumber }} 轮</span></div>
      <div v-if="activePriorEvents.length" class="flow-prior-events"><small>已提交并将传给两类模型的前序事件</small><p v-for="(event, index) in activePriorEvents" :key="`${event.turn}-${event.kind}-${index}`"><code>T{{ event.turn }} / {{ event.kind }}</code>{{ event.text }}</p></div>
      <p v-else class="flow-session-empty">第一轮没有历史上下文；确认结算后可继续输入第二轮。</p>
    </div>

    <section class="flow-log-card" aria-live="polite">
      <div class="flow-log-heading"><div><span class="eyebrow">FRONTEND TRACE</span><strong>模型协作过程</strong></div><span class="micro">{{ visibleTrace.length }} 条 · Session 累积</span></div>
      <ol v-if="visibleTrace.length" class="flow-log-list">
        <li v-for="entry in visibleTrace" :key="entry.id" :class="`tone-${entry.tone}`">
          <time>{{ new Date(entry.at).toLocaleTimeString('zh-CN', { hour12: false }) }}</time>
          <span class="flow-log-actor">T{{ entry.turnNumber }} · {{ entry.actor }}</span>
          <div><b>{{ entry.title }}</b><p>{{ entry.detail }}</p></div>
        </li>
      </ol>
      <p v-else class="flow-session-empty">运行后会按发生顺序记录输入、模型请求与返回、路由、校验和提交。</p>
    </section>

    <div class="flow-input-card">
      <div class="flow-card-title"><span>01</span><div><strong>输入事实与玩家话语</strong><p>每轮都以玩家实际发言为触发；第二轮起，已提交的前序事件会随同本轮输入进入决策和写作模型。</p></div><span class="flow-tag">WORLD SNAPSHOT · 固定初始状态</span></div>
      <div class="flow-facts"><div><b>鲍勃的日程</b><span>21:05 到正门等艾琳；约定没有指定哪扇门。</span></div><div><b>当前时间</b><span>20:55，酒馆 21:00 打烊。</span></div><div><b>请求者</b><span>玩家；请求鲍勃在打烊时查看后门，艾琳是否在场仍未知。</span></div></div>
      <label class="flow-utterance">玩家发言 / 鲍勃听见的原话<textarea v-model="utterance" :disabled="decisionBusy || writingBusy" rows="2" /></label>
      <div class="flow-input-footer"><span><Check :size="13" /> SpeechEvent 将按原文记录；语义理解交给决策/写作链路。</span><label class="flow-model-picker">决策模型<select v-model="decisionModel" :disabled="decisionBusy || writingBusy"><option value="clef-flash">Clef Flash</option><option value="clef">Clef</option></select></label><button class="run-button" :disabled="decisionBusy || writingBusy || !utterance.trim()" @click="runClef"><Play :size="14" fill="currentColor" /> {{ decisionBusy ? 'Clef 决策中…' : '1. 运行决策模型' }}</button></div>
    </div>

    <div class="flow-columns">
      <section class="flow-step-card">
        <div class="flow-card-title"><span>02</span><div><strong>候选动作与决策结果</strong><p>候选由 Runtime 提供；Clef 负责选择或指出候选不够。</p></div></div>
        <div class="flow-candidate-list">
          <div v-for="(value, id) in (selected?.decisionRequest.questions.next_action?.type === 'choice' ? selected.decisionRequest.questions.next_action.criteria : decisionInput(utterance, [], '打烊后 21:05 到正门等艾琳').questions.next_action.criteria)" :key="id" :class="{ chosen: choiceAnswer === id }"><code>{{ id }}</code><span>{{ value }}</span><b v-if="choiceAnswer === id">Clef 选择</b></div>
        </div>
        <div v-if="currentDecision?.response" class="flow-decision-result"><span class="result-chip">{{ choiceAnswer || '未识别候选' }}</span><strong>{{ choiceLabel }}</strong><p>承诺判断：{{ record(currentDecision.response.answers.commitment)?.noul === undefined ? '无有效返回' : `P(已明确承诺) = ${(Number(record(currentDecision.response.answers.commitment)?.noul) * 100).toFixed(1)}%` }}</p><details><summary>查看 Clef 的实际输入 / 原始输出</summary><pre>{{ JSON.stringify({ request: currentDecision.request, response: currentDecision.response, error: currentDecision.error }, null, 2) }}</pre></details></div>
        <div v-else class="flow-placeholder"><CircleAlert :size="15" />运行后显示实际候选选择、承诺信号与请求快照。</div>
      </section>

      <section class="flow-step-card">
        <div class="flow-card-title"><span>03</span><div><strong>Runtime 分派与写作结果</strong><p>{{ routeDescription }}</p></div></div>
        <div class="flow-route-branch"><div :class="{ active: choiceAnswer && choiceAnswer !== 'other' }"><b>选中已有候选</b><span>DeepSeek phrase：遵守该意图拟写一句话</span></div><div class="route-or">或</div><div :class="{ active: choiceAnswer === 'other' }"><b>候选覆盖不足</b><span>DeepSeek propose：可提出候选之外的新做法</span></div></div>
        <div v-if="currentDecision?.response" class="flow-write-action"><label class="flow-route-picker">Runtime 路由<select v-model="routeOverride" :disabled="writingBusy"><option value="auto">按 Clef 结果自动分派</option><option value="phrase">强制既定意图拟稿 · 对照实验</option><option value="propose">强制开放构思 · 对照实验</option></select></label><button class="run-button" :disabled="writingBusy || !effectiveMode" @click="runWriting"><Play :size="14" fill="currentColor" /> {{ writingBusy ? 'DeepSeek 生成中…' : `2. 调用 DeepSeek · ${effectiveMode === 'propose' ? '开放构思' : '既定意图拟稿'}` }}</button></div>
        <div v-if="selected?.writing" class="flow-writing-result"><div class="flow-result-meta"><span>{{ selected.writing.mode === 'propose' ? '开放构思' : '既定意图拟稿' }}</span><span>{{ selected.writing.durationMs }} ms</span><span>thinking disabled</span></div>
          <template v-if="plan"><div class="flow-plan-grid"><div><small>行动意图</small><p>{{ plan.intent || '—' }}</p></div><div><small>第一步</small><p>{{ plan.first_step?.type || '—' }}{{ plan.first_step?.target ? ` → ${plan.first_step.target}` : '' }}<br>{{ plan.first_step?.content || '—' }}</p></div><div><small>角色发言（模型生成）</small><blockquote>{{ plan.speech || '—' }}</blockquote></div><div><small>继续条件</small><p>{{ plan.continuation_condition || '—' }}</p></div></div></template>
          <div v-else class="flow-error"><CircleAlert :size="15" />返回不是约定 JSON；World Core 将拒绝直接结算。<pre>{{ selected.writing.content }}</pre></div>
          <details><summary>查看 DeepSeek 实际系统提示词、输入与原始响应</summary><pre>{{ JSON.stringify({ request: selected.writing.request, response: selected.writing.raw, content: selected.writing.content, writingTask: selected.writingRequest }, null, 2) }}</pre></details>
        </div>
        <p v-else-if="selected?.writingError" class="flow-error"><CircleAlert :size="15" />{{ selected.writingError }}</p>
        <div v-else class="flow-placeholder"><WandSparkles :size="15" />写作模型不会预设鲍勃的回答；它只在 Clef 决策后收到当前分派任务。</div>
      </section>
    </div>

    <section v-if="selected?.worldCore" class="flow-core-card">
      <div class="flow-card-title"><span>04</span><div><strong>World Core · 校验与模拟结算</strong><p>模型输出只是提案；这里的规则检查通过后仍需实验者确认，才写入本次本地模拟状态。</p></div><span class="core-badge" :class="selected.worldCore.errors.length ? 'invalid' : selected.worldCore.committed ? 'committed' : 'valid'">{{ selected.worldCore.errors.length ? '拒绝结算' : selected.worldCore.committed ? '已提交' : '可提交' }}</span></div>
      <ul class="core-checks"><li v-for="check in selected.worldCore.checks" :key="check" class="pass"><Check :size="14" />{{ check }}</li><li v-for="issue in selected.worldCore.errors" :key="issue" class="fail"><CircleAlert :size="14" />{{ issue }}</li></ul>
      <div class="flow-schedule"><span><b>提交前日程</b>{{ selected.worldCore.committed && plan?.schedule_change?.to ? (plan.schedule_change.from || '21:05 在正门等艾琳（原日程）') : '21:05 在正门等艾琳（原日程）' }}</span><span><b>结算后日程</b>{{ selected.scheduleAfter }}</span></div>
      <div v-if="selected.committedAction" class="flow-committed"><Check :size="15" /><span>{{ selected.committedAction }}</span></div>
      <div class="flow-core-footer"><span>系统只能校验承诺原文是否逐字出现在拟提交台词中；承诺是否真诚、含蓄或只是客套，仍由实验者判断。请求、想法和未提交台词都不改世界状态。</span><button class="run-button" :disabled="!canCommit" @click="commitWorldCore"><Check :size="14" /> 确认并提交到模拟世界</button></div>
      <div v-if="selected.worldCore.committed" class="flow-next-turn"><span>本轮事件已加入 Session；下一轮会把玩家与鲍勃的已提交发言、行动及日程带入模型上下文。</span><button class="run-button" :disabled="!canContinue" @click="continueSession"><Play :size="14" fill="currentColor" /> 开始第 {{ selected.turnNumber + 1 }} 轮</button></div>
    </section>
    <div v-else class="flow-core-locked"><span>04</span>等待写作输出后，World Core 才会执行结构与承诺证据检查。</div>

    <section class="flow-method-note"><strong>本次协作假设（可在试玩中推翻）</strong><p>Runtime 预先给出可比较的候选；Clef 负责选择或请求开放构思；DeepSeek 负责把意图变成角色可执行的第一步与台词；World Core 只验证动作边界和可追溯承诺，按顺序提交。每次模型输入、输出和人工提交都保留在这次运行记录中。</p></section>
    <section v-if="histories.length" class="flow-history"><div class="flow-history-head"><strong>最近的连续运行</strong><span class="micro">{{ histories.length }} / 30</span></div><button v-for="item in histories" :key="item.id" :class="{ active: selected?.id === item.id }" @click="chooseFlow(item)"><span><b>Session {{ item.sessionId.slice(0, 8) }} · T{{ item.turnNumber }}</b> {{ item.utterance }}</span><span>{{ item.decision?.response ? String(record(item.decision.response.answers.next_action)?.choice || '已决策') : '待决策' }}</span><span>{{ new Date(item.createdAt).toLocaleTimeString('zh-CN') }}</span></button></section>
    <p v-if="error" class="flow-error"><CircleAlert :size="15" />{{ error }}</p>
    <div v-if="decisionBusy || writingBusy" class="flow-cancel"><button class="run-button cancel" @click="cancel"><Square :size="13" fill="currentColor" /> 取消当前请求</button></div>
  </section>
</template>
