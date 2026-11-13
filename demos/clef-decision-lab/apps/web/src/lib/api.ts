import type { DecisionRequest } from '../../../../packages/shared/src/schema';
import type { LabError, RunResponse } from '../../../../packages/shared/src/decision';
export class ApiError extends Error {
  constructor(public detail: LabError) { super(detail.message); }
}
export async function runDecision(input: DecisionRequest, signal: AbortSignal): Promise<RunResponse> {
  try {
    const response = await fetch('/api/decisions/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
    });
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.error ?? { code: 'PROXY_ERROR', message: '本地代理请求失败。' });
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted) throw new ApiError({ code: 'CANCELLED', message: '请求已取消，输入已保留。已送达提供商的请求可能仍计入用量。' });
    throw new ApiError({ code: 'CONNECTION_ERROR', message: '无法连接本地 API，请确认 Hono 服务正在运行。' });
  }
}
