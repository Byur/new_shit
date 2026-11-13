import type { DecisionRequest } from '../../../../packages/shared/src/schema';
import { record, type LabError, type RunResponse } from '../../../../packages/shared/src/decision';

export class ProviderError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
  toJSON(): LabError { return { code: this.code, message: this.message, status: this.status }; }
}
interface Credentials { accountId: string; token: string }
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const models = { clef: '@cf/cloudflare/clef', 'clef-flash': '@cf/cloudflare/clef-flash' } as const;

export function normalize(raw: unknown, input: DecisionRequest, requestedAt: string, durationMs: number): RunResponse {
  const envelope = record(raw);
  const result = record(envelope?.result) ?? envelope;
  return {
    runId: crypto.randomUUID(), model: input.model, durationMs, requestedAt,
    answers: record(result?.answers) ?? {}, usage: record(result?.usage), raw,
  };
}

export async function runCloudflare(input: DecisionRequest, credentials: Credentials, options: {
  signal?: AbortSignal; timeoutMs?: number; fetcher?: Fetcher;
} = {}): Promise<RunResponse> {
  if (!credentials.accountId || !credentials.token) throw new ProviderError('NOT_CONFIGURED', '服务端缺少 Cloudflare Account ID 或 Token，请检查 .env。', 503);
  const requestedAt = new Date().toISOString();
  const started = performance.now();
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  const redact = (value: unknown) => JSON.parse(JSON.stringify(value)
    .replaceAll(credentials.token, '[REDACTED]').replaceAll(credentials.accountId, '[REDACTED]'));
  try {
    const response = await (options.fetcher ?? fetch)(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/ai/run/${models[input.model]}`,
      { method: 'POST', headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal },
    );
    let raw: unknown;
    try { raw = await response.json(); } catch {
      if (!response.ok) throwForStatus(response.status);
      throw new ProviderError('INVALID_RESPONSE', 'Cloudflare 返回了非 JSON 响应，请稍后重试。', 502);
    }
    const envelope = record(raw);
    const errors = Array.isArray(envelope?.errors) ? envelope.errors : [];
    const authFailure = errors.some(error => [10000, 10001, 9109].includes(Number(record(error)?.code)));
    if (!response.ok || envelope?.success === false || errors.length) {
      throwForStatus(authFailure ? 403 : response.status, errors);
    }
    return normalize(redact(raw), input, requestedAt, Math.round(performance.now() - started));
  } catch (error) {
    if (options.signal?.aborted) throw new ProviderError('CANCELLED', '请求已取消。Cloudflare 已接收的计算可能仍计入用量。', 499);
    if (timeout.aborted) throw new ProviderError('TIMEOUT', '请求超过 30 秒，已停止等待。输入已保留，可稍后重试。', 504);
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('NETWORK_ERROR', '无法连接 Cloudflare，请检查网络后重试。', 502);
  }
}

function throwForStatus(status: number, errors: unknown[] = []): never {
  if (status === 401 || status === 403) throw new ProviderError('AUTH_ERROR', 'Cloudflare 认证失败：请确认 Account ID、Token 及 Workers AI Read / Edit 权限。', status);
  if (status === 429) throw new ProviderError('RATE_LIMITED', 'Cloudflare 限流或额度不足，批量实验已停止。请检查账户配额后再试。', 429);
  const codes = errors.map(e => record(e)?.code).filter(c => typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))).join(', ');
  throw new ProviderError('PROVIDER_ERROR', `Cloudflare 请求失败（HTTP ${status}${codes ? `，代码 ${codes}` : ''}）。请检查请求 Schema 或稍后重试。`, 502);
}
