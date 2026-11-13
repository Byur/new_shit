import { describe, test, expect } from 'bun:test';
import fixture from '../fixtures/clef-flash.real.json';
import { createApp } from '../apps/server/src/app';
import { normalize, runCloudflare, ProviderError } from '../apps/server/src/providers/cloudflare';
import { parseRequest, requestSchema, type DecisionRequest } from '../packages/shared/src/schema';
import { answerTitle, comparisonIssue, percentile, probabilities, summarize, type RunRecord } from '../packages/shared/src/decision';
import { exampleRequest, exampleScenarios, identifyExample } from '../packages/shared/src/examples';

const input = requestSchema.parse(fixture.request);
const credentials = { accountId: 'test-account', token: 'test-secret' };
const appWith = (fetcher: (url: string | URL | Request, init?: RequestInit) => Promise<Response>) => createApp(credentials, { fetcher });
const request = (body: string) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

describe('real provider fixture semantics', () => {
  const fixtures = Array.from(new Bun.Glob('*.real.json').scanSync({ cwd: new URL('../fixtures/', import.meta.url).pathname })).sort();
  for (const file of fixtures) {
    const name = file.replace('.real.json', '');
    test(`replays ${name} captured schema and verifies its request hash`, async () => {
      const captured = await Bun.file(new URL(`../fixtures/${name}.real.json`, import.meta.url)).json();
      const parsed = requestSchema.parse(captured.request);
      expect(captured.requestSha256).toBe(new Bun.CryptoHasher('sha256').update(JSON.stringify(parsed)).digest('hex'));
      expect(captured.raw.success).toBe(true);
      expect(captured.raw.result.model).toBe(parsed.model);
      for (const [id, q] of Object.entries(parsed.questions)) {
        const answer = captured.raw.result.answers[id];
        expect(answer.type).toBe(q.type);
        if (q.type === 'noul') {
          expect(answer.noul).toBeGreaterThanOrEqual(0); expect(answer.noul).toBeLessThanOrEqual(1);
        } else {
          const entries = Object.entries(probabilities(answer));
          expect(entries.reduce((sum, [, v]) => sum + v, 0)).toBeCloseTo(1, 3);
          if (q.type === 'choice') expect(answer.choice).toBe(entries.sort((a, b) => b[1] - a[1])[0][0]);
          else expect(answer.score).toBeCloseTo(entries.reduce((sum, [key, value]) => sum + Number(key) * value, 0), 3);
        }
      }
    });
  }
  test('replays actual fields, without treating score as an integer or confidence as P(selected)', () => {
    const run = normalize(fixture.raw, input, fixture.capturedAt, fixture.durationMs);
    expect(Object.keys(run.answers)).toEqual(Object.keys(input.questions));
    expect(probabilities(run.answers.next_action)).toHaveProperty('greet');
    const answer = run.answers.leave_urgency as { score: number };
    expect(answerTitle(input.questions.leave_urgency, run.answers.leave_urgency)).toBe(`${answer.score.toFixed(4)} / 3`);
    expect(run.usage).toHaveProperty('input_tokens');
    expect(run.raw).toEqual(fixture.raw);
  });
  test('does not invent fields when provider shape changes', () => {
    const run = normalize({ result: { unknown: 123 }, success: true }, input, '', 1);
    expect(run.answers).toEqual({}); expect(run.usage).toBeNull();
    expect(answerTitle(input.questions.next_action, undefined)).toContain('未识别');
    expect(probabilities({ probabilities: { a: 1.1, b: -1, c: '0.5', d: .5 } })).toEqual({ d: .5 });
  });
});

describe('controlled state examples', () => {
  test('all variants keep the same model/questions and change exactly the documented state leaf', () => {
    const baseline = exampleRequest('A');
    function differences(a: unknown, b: unknown, path = ''): string[] {
      if (JSON.stringify(a) === JSON.stringify(b)) return [];
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        const aa = a as Record<string, unknown>, bb = b as Record<string, unknown>;
        return [...new Set([...Object.keys(aa), ...Object.keys(bb)])].flatMap(key => differences(aa[key], bb[key], Array.isArray(a) ? `${path}[${key}]` : path ? `${path}.${key}` : key));
      }
      return [path];
    }
    for (const scenario of exampleScenarios) {
      const input = requestSchema.parse(exampleRequest(scenario.id));
      expect(input.questions).toEqual(baseline.questions);
      expect(input.model).toBe(baseline.model);
      expect(differences(baseline.state, input.state)).toEqual(scenario.changedPath ? [scenario.changedPath] : []);
      expect(identifyExample(input)?.id).toBe(scenario.id);
      expect(exampleRequest(scenario.id, 'clef').model).toBe('clef');
    }
    const edited = exampleRequest('A');
    (edited.state as Record<string, unknown>).personality = '外向、热情';
    expect(identifyExample(edited)).toBeNull();
    expect(exampleRequest('A')).toEqual(baseline);
  });
});

describe('input boundary', () => {
  test('duplicate IDs are rejected before JSON.parse overwrites them', () => {
    const duplicate = JSON.stringify(input).replace('"questions":{', '"questions":{"next_action":{"type":"noul","instructions":"duplicate"},');
    expect(() => parseRequest(duplicate)).toThrow('重复');
    expect(() => parseRequest('{"model": "clef",}')).toThrow('JSON');
  });
  test('enforces actual question limits and model allowlist', () => {
    expect(requestSchema.safeParse({ ...input, model: 'https://example.org' }).success).toBe(false);
    expect(requestSchema.safeParse({ ...input, questions: {} }).success).toBe(false);
    expect(requestSchema.safeParse({ ...input, questions: { q: { type: 'choice', instructions: 'pick', criteria: { only: 'one' } } } }).success).toBe(false);
    expect(requestSchema.safeParse({ ...input, questions: { q: { type: 'score', instructions: 'rate', criteria: Array(11).fill('level') } } }).success).toBe(false);
    expect(requestSchema.safeParse({ ...input, state: null }).success).toBe(false);
    expect(requestSchema.safeParse({ ...input, images: [] }).success).toBe(false);
  });
  test('invalid input and cross-origin writes never reach the provider', async () => {
    let calls = 0;
    const app = appWith(async () => { calls++; return Response.json(fixture.raw); });
    expect((await app.request('/api/decisions/run', request('{'))).status).toBe(400);
    expect((await app.request('/api/decisions/run', { ...request(JSON.stringify(input)), headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' } })).status).toBe(403);
    expect(calls).toBe(0);
    expect((await app.request('/api/health')).headers.get('cache-control')).toBe('no-store');
  });
});

describe('proxy contract and error handling', () => {
  test('selects only the allowlisted endpoint and sends model/state/questions', async () => {
    let sent: unknown;
    const app = appWith(async (url, init) => {
      expect(String(url)).toBe('https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/cloudflare/clef-flash');
      sent = JSON.parse(init!.body as string);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-secret');
      return Response.json(fixture.raw);
    });
    const response = await app.request('/api/decisions/run', request(JSON.stringify(input)));
    const data = await response.json();
    expect(response.status).toBe(200); expect(sent).toEqual(input);
    expect(data.answers.next_action).toEqual(fixture.raw.result.answers.next_action);
    expect(JSON.stringify(data)).not.toContain('test-secret');
  });
  for (const [status, code] of [[401, 'AUTH_ERROR'], [403, 'AUTH_ERROR'], [429, 'RATE_LIMITED'], [500, 'PROVIDER_ERROR']] as const) {
    test(`maps ${status} and does not leak upstream error strings`, async () => {
      const app = appWith(async () => Response.json({ success: false, errors: [{ message: 'test-secret test-account' }] }, { status }));
      const response = await app.request('/api/decisions/run', request(JSON.stringify(input)));
      const data = await response.json(); expect(data.error.code).toBe(code);
      expect(JSON.stringify(data)).not.toMatch(/test-secret|test-account/);
    });
  }
  test('checks success/errors even on HTTP 200', async () => {
    const app = appWith(async () => Response.json({ success: false, errors: [{ code: 10000 }] }));
    const response = await app.request('/api/decisions/run', request(JSON.stringify(input)));
    expect((await response.json()).error.code).toBe('AUTH_ERROR');
  });
  test('handles non-JSON auth failures and successful non-JSON responses', async () => {
    for (const [status, expected] of [[403, 'AUTH_ERROR'], [200, 'INVALID_RESPONSE']] as const) {
      const app = appWith(async () => new Response('not json', { status }));
      expect((await (await app.request('/api/decisions/run', request(JSON.stringify(input)))).json()).error.code).toBe(expected);
    }
  });
  test('timeouts and cancellation abort the upstream fetch', async () => {
    const waiting = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => new Promise((_, reject) => {
      const signal = init!.signal!;
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    await expect(runCloudflare(input, credentials, { fetcher: waiting, timeoutMs: 10 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    const controller = new AbortController();
    const pending = runCloudflare(input, credentials, { fetcher: waiting, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  test('missing credentials and network failures have stable errors', async () => {
    await expect(runCloudflare(input, { accountId: '', token: '' })).rejects.toBeInstanceOf(ProviderError);
    await expect(runCloudflare(input, credentials, { fetcher: async () => { throw new Error('test-secret'); } })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
  test('disconnecting the real HTTP client propagates cancellation through Hono', async () => {
    let started!: () => void;
    let cancelled!: () => void;
    const didStart = new Promise<void>(resolve => started = resolve);
    const didCancel = new Promise<void>(resolve => cancelled = resolve);
    const app = appWith(async (_url, init) => new Promise((_, reject) => {
      started();
      init!.signal!.addEventListener('abort', () => { cancelled(); reject(init!.signal!.reason); }, { once: true });
    }));
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.fetch });
    try {
      const controller = new AbortController();
      const pending = fetch(`http://127.0.0.1:${server.port}/api/decisions/run`, { ...request(JSON.stringify(input)), signal: controller.signal }).catch(() => null);
      await didStart; controller.abort(); await pending;
      await Promise.race([didCancel, new Promise((_, reject) => setTimeout(() => reject(new Error('Upstream cancellation did not propagate')), 500))]);
    } finally { server.stop(true); }
  });
  test('redacts credentials even if the provider echoes them in a successful response', async () => {
    const run = await runCloudflare(input, credentials, { fetcher: async () => Response.json({ result: { extra: 'test-secret test-account' }, success: true }) });
    expect(JSON.stringify(run)).not.toMatch(/test-secret|test-account/);
  });
});

describe('experiment statistics', () => {
  const makeRun = (ms: number, error = false): RunRecord => ({ id: String(ms), requestedAt: '', request: input, clientDurationMs: ms,
    response: error ? null : normalize(fixture.raw, input, '', ms), error: error ? { code: 'TIMEOUT', message: 'timeout' } : null });
  test('P50/P95 use only successes and frequencies count selections rather than probabilities', () => {
    const stats = summarize([makeRun(100), makeRun(200), makeRun(300), makeRun(1, true)]);
    expect(stats.p50).toBe(200); expect(stats.p95).toBe(300); expect(stats.failureRate).toBe(.25);
    const choice = fixture.raw.result.answers.next_action.choice;
    expect(stats.frequencies.next_action[choice]).toBe(3);
    expect(stats.meanProbabilities.next_action.greet).toBeCloseTo(fixture.raw.result.answers.next_action.probabilities.greet);
    expect(stats.usage?.input_tokens).toBe(fixture.raw.result.usage.input_tokens * 3);
    expect(percentile([], .95)).toBeNull();
  });
  test('comparison cannot silently mix models or question sets', () => {
    const a = makeRun(1), b = makeRun(2);
    expect(comparisonIssue(a, b)).toBeNull();
    b.request = { ...input, model: 'clef' };
    expect(comparisonIssue(a, b)).toContain('同一模型');
    b.request = { ...input, questions: { q: { type: 'noul', instructions: 'different' } } } as DecisionRequest;
    expect(comparisonIssue(a, b)).toContain('相同的问题集');
  });
});
