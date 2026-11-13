import { requestSchema, type DecisionRequest } from '../../../../packages/shared/src/schema';
import { record, type RunRecord } from '../../../../packages/shared/src/decision';

const HISTORY_KEY = 'clef-lab:runs:v1';
const DRAFT_KEY = 'clef-lab:draft:v1';
const MAX_BYTES = 2_000_000;
export function loadDraft(fallback: DecisionRequest): DecisionRequest {
  try { return requestSchema.parse(JSON.parse(localStorage.getItem(DRAFT_KEY) || '')); } catch { return structuredClone(fallback); }
}
export function saveDraft(value: DecisionRequest): string | null {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); return null; }
  catch { return '浏览器未能保存输入，请导出请求 JSON 备份。'; }
}
export function loadRuns(): RunRecord[] {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(r => typeof r?.id === 'string' && requestSchema.safeParse(r?.request).success &&
      typeof r.requestedAt === 'string' && typeof r.clientDurationMs === 'number' &&
      (r.response === null || (record(r.response) && record(r.response.answers) && typeof r.response.durationMs === 'number')) &&
      (r.error === null || (record(r.error) && typeof r.error.code === 'string'))).slice(0, 100);
  } catch { return []; }
}
export function saveRuns(runs: RunRecord[]): { persisted: RunRecord[]; warning: string | null } {
  const bounded = runs.slice(0, 100);
  // Store whole records only. Never truncate raw data into a misleading partial response.
  while (bounded.length && new Blob([JSON.stringify(bounded)]).size > MAX_BYTES) bounded.pop();
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(bounded));
    return { persisted: bounded, warning: bounded.length < Math.min(100, runs.length) ? '本地历史达到 2 MB 限额，较早或超大记录未持久化；可立即导出当前结果。' : null };
  } catch { return { persisted: [], warning: '浏览器存储空间不足，当前结果仍可查看和导出。' }; }
}
export function clearRuns() { localStorage.removeItem(HISTORY_KEY); }
export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
