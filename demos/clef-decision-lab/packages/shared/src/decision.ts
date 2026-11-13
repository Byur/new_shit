import type { DecisionRequest, Question } from './schema';
export type Model = DecisionRequest['model'];
export interface RunResponse {
  runId: string;
  model: Model;
  durationMs: number;
  requestedAt: string;
  answers: Record<string, unknown>;
  usage: Record<string, unknown> | null;
  raw: unknown;
}
export interface LabError { code: string; message: string; status?: number }
export interface RunRecord {
  id: string;
  requestedAt: string;
  request: DecisionRequest;
  response: RunResponse | null;
  error: LabError | null;
  clientDurationMs: number;
}
export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function label(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? '';
}
export function probabilities(answer: unknown): Record<string, number> {
  const values = record(record(answer)?.probabilities);
  if (!values) return {};
  return Object.fromEntries(Object.entries(values).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0 && e[1] <= 1));
}
export function optionLabel(question: Question, key: string, answer?: unknown): string {
  if (question.type === 'choice') return label(question.criteria[key] ?? key);
  if (question.type === 'score') return label(record(record(answer)?.legend)?.[key] ?? question.criteria[Number(key)] ?? key);
  return key;
}
export function answerTitle(question: Question, answer: unknown): string {
  const a = record(answer);
  if (!a) return '未识别的结果 · 查看原始响应';
  if (question.type === 'choice' && typeof a.choice === 'string') return optionLabel(question, a.choice);
  if (question.type === 'noul' && typeof a.noul === 'number') return `P(Yes) = ${(a.noul * 100).toFixed(2)}%`;
  if (question.type === 'score' && typeof a.score === 'number') return `${a.score.toFixed(4)} / ${question.criteria.length - 1}`;
  return '未识别的结果 · 查看原始响应';
}
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function summarize(runs: RunRecord[]) {
  const success = runs.filter(r => r.response);
  const times = success.map(r => r.response!.durationMs);
  const frequencies: Record<string, Record<string, number>> = {};
  const averages: Record<string, Record<string, { sum: number; count: number }>> = {};
  const usage: Record<string, number> = {};
  for (const run of success) {
    for (const [id, answer] of Object.entries(run.response!.answers)) {
      const a = record(answer);
      if (typeof a?.choice === 'string') {
        const counts = frequencies[id] ||= {};
        counts[a.choice] = (counts[a.choice] || 0) + 1;
      }
      for (const [key, value] of Object.entries(probabilities(answer))) {
        const item = (averages[id] ||= {})[key] ||= { sum: 0, count: 0 };
        item.sum += value; item.count++;
      }
    }
    for (const [key, value] of Object.entries(run.response!.usage || {})) {
      if (typeof value === 'number') usage[key] = (usage[key] || 0) + value;
    }
  }
  return {
    total: runs.length, success: success.length, failed: runs.length - success.length,
    failureRate: runs.length ? (runs.length - success.length) / runs.length : 0,
    p50: percentile(times, .5), p95: percentile(times, .95), frequencies,
    meanProbabilities: Object.fromEntries(Object.entries(averages).map(([id, options]) => [id, Object.fromEntries(Object.entries(options).map(([key, v]) => [key, v.sum / v.count]))])),
    usage: Object.keys(usage).length ? usage : null,
  };
}
export function comparisonIssue(a: RunRecord, b: RunRecord): string | null {
  if (!a.response || !b.response) return '只能比较两次成功运行。';
  if (a.request.model !== b.request.model) return '状态对比需要固定同一模型。';
  if (JSON.stringify(a.request.questions) !== JSON.stringify(b.request.questions)) return '状态对比需要使用相同的问题集与候选顺序。';
  return null;
}
