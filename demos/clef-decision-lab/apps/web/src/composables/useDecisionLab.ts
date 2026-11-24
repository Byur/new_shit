import { computed, ref, watch } from 'vue';
import { exampleRequest, type ExampleId } from '../../../../packages/shared/src/examples';
import { describeError, parseRequest, requestSchema, type DecisionRequest } from '../../../../packages/shared/src/schema';
import { summarize, type RunRecord, type LabError } from '../../../../packages/shared/src/decision';
import { ApiError, runDecision } from '../lib/api';
import { clearRuns, loadDraft, loadRuns, saveDraft, saveRuns } from '../lib/storage';

export function useDecisionLab() {
  const fixture = exampleRequest('A');
  const request = ref<DecisionRequest>(loadDraft(fixture));
  const runs = ref<RunRecord[]>(loadRuns());
  const selected = ref<RunRecord | null>(runs.value[0] || null);
  const rawDraft = ref(JSON.stringify(request.value, null, 2));
  const rawError = ref('');
  const contextError = ref('');
  const questionsError = ref('');
  const storageWarning = ref('');
  const busy = ref(false);
  const progress = ref({ completed: 0, planned: 0 });
  const batchRuns = ref<RunRecord[]>([]);
  const batchActive = ref(false);
  const batchSummary = computed(() => summarize(batchRuns.value));
  const error = ref<LabError | null>(null);
  const ready = ref<boolean | null>(null);
  const writingReady = ref<boolean | null>(null);
  let controller: AbortController | null = null;
  let editingRaw = false;
  const validationError = computed(() => {
    if (rawError.value || contextError.value || questionsError.value) return rawError.value || contextError.value || questionsError.value;
    const parsed = requestSchema.safeParse(request.value);
    return parsed.success ? '' : describeError(parsed.error);
  });
  watch(request, () => {
    if (!editingRaw && !rawError.value) rawDraft.value = JSON.stringify(request.value, null, 2);
    if (requestSchema.safeParse(request.value).success) storageWarning.value = saveDraft(request.value) || '';
  }, { deep: true, flush: 'sync' });

  function editRaw(value: string) {
    rawDraft.value = value;
    try {
      const parsed = parseRequest(value);
      rawError.value = ''; contextError.value = ''; questionsError.value = '';
      editingRaw = true; request.value = parsed; editingRaw = false;
    } catch (e) { rawError.value = describeError(e); }
  }
  function setRequest(value: DecisionRequest) {
    rawError.value = ''; contextError.value = ''; questionsError.value = '';
    request.value = JSON.parse(JSON.stringify(value)); rawDraft.value = JSON.stringify(value, null, 2); error.value = null;
  }
  function scenario(which: ExampleId) { setRequest(exampleRequest(which, request.value.model)); }
  function remember(run: RunRecord) {
    selected.value = run;
    runs.value = [run, ...runs.value].slice(0, 100);
    storageWarning.value = saveRuns(runs.value).warning || '';
  }
  async function execute(input: DecisionRequest, signal: AbortSignal): Promise<RunRecord> {
    const start = performance.now();
    const run: RunRecord = { id: crypto.randomUUID(), requestedAt: new Date().toISOString(), request: input, response: null, error: null, clientDurationMs: 0 };
    try { run.response = await runDecision(input, signal); run.id = run.response.runId; }
    catch (e) { run.error = e instanceof ApiError ? e.detail : { code: 'UNKNOWN', message: '请求未能完成。' }; }
    run.clientDurationMs = Math.round(performance.now() - start);
    remember(run); return run;
  }
  async function run(count = 1) {
    if (busy.value || validationError.value) return;
    const input = requestSchema.parse(request.value); // Snapshot: editing during a run cannot change the experiment.
    controller = new AbortController(); busy.value = true; error.value = null;
    progress.value = { completed: 0, planned: count };
    batchActive.value = count > 1;
    if (count > 1) batchRuns.value = [];
    try {
      for (let i = 0; i < count; i++) {
        if (controller.signal.aborted) break;
        const outcome = await execute(structuredClone(input), controller.signal);
        progress.value.completed++;
        if (count > 1) batchRuns.value.push(outcome);
        if (outcome.error) error.value = outcome.error;
        if (outcome.error && ['AUTH_ERROR', 'RATE_LIMITED', 'NOT_CONFIGURED', 'CANCELLED'].includes(outcome.error.code)) break;
      }
    } finally { busy.value = false; controller = null; }
  }
  async function checkHealth() {
    try { const response = await fetch('/api/health'); const health = await response.json(); ready.value = response.ok && health.ready; writingReady.value = response.ok && health.writingReady; }
    catch { ready.value = false; writingReady.value = false; }
  }
  function cancel() { controller?.abort(); }
  function clearHistory() { runs.value = []; selected.value = null; clearRuns(); }
  return { request, runs, selected, rawDraft, rawError, contextError, questionsError, storageWarning, busy, progress, batchRuns, batchActive, batchSummary,
    error, ready, writingReady, validationError, editRaw, setRequest, scenario, run, cancel, clearHistory, checkHealth };
}
