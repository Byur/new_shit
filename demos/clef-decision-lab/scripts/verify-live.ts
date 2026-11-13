import { createApp } from '../apps/server/src/app';
import { config } from '../apps/server/src/env';
import { parseRequest, type DecisionRequest } from '../packages/shared/src/schema';
import { answerTitle, probabilities, record, type RunResponse } from '../packages/shared/src/decision';
import { exampleRequest, exampleScenarios } from '../packages/shared/src/examples';

// Four explicitly bounded calls, through the same Hono route as the web UI.
// No retries. Authentication/quota failure stops the sequence immediately.
const app = createApp(config);
const baseline = parseRequest(await Bun.file(new URL('../fixtures/tavern-erin.json', import.meta.url)).text());
const write = process.argv.includes('--write-fixtures');
const examples = process.argv.includes('--examples');
const models = examples ? ['clef-flash'] as const : ['clef-flash', 'clef'] as const;
const results: { scenario: string; request: DecisionRequest; response: RunResponse }[] = [];
for (const model of models) {
  for (const scenario of examples ? exampleScenarios.map(s => s.id) : ['A', 'B'] as const) {
    const input = examples ? exampleRequest(scenario, model) : structuredClone(baseline); input.model = model;
    if (!examples && scenario === 'B') (input.state as Record<string, unknown>).memory = ['三天前与爱丽丝发生争执', '昨天爱丽丝偷走了艾琳的钱包'];
    const response = await app.request('/api/decisions/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const payload = await response.json();
    if (!response.ok) { console.error(JSON.stringify({ model, scenario, error: payload.error })); process.exit(1); }
    const run = payload as RunResponse;
    if (!Object.keys(input.questions).every(id => record(run.answers[id]))) throw new Error(`${model}: missing answers`);
    results.push({ scenario, request: input, response: run });
    if (write) {
      const fixture = {
        source: 'Cloudflare Workers AI REST via Hono', capturedAt: run.requestedAt,
        requestSha256: new Bun.CryptoHasher('sha256').update(JSON.stringify(input)).digest('hex'),
        durationMs: run.durationMs, httpStatus: response.status, request: input, raw: run.raw,
      };
      const name = examples ? `${model}.learning.${scenario}.real.json` : `${model}${scenario === 'B' ? '.B' : ''}.real.json`;
      await Bun.write(new URL(`../fixtures/${name}`, import.meta.url), JSON.stringify(fixture, null, 2) + '\n');
    }
    console.log(JSON.stringify({ model, scenario, durationMs: run.durationMs, usage: run.usage,
      answers: Object.fromEntries(Object.entries(input.questions).map(([id, q]) => [id, answerTitle(q, run.answers[id])])),
      probabilities: probabilities(run.answers.next_action),
    }));
  }
}
for (const model of models) {
  const [a, ...variants] = results.filter(r => r.request.model === model);
  for (const variant of variants) {
    const ap = probabilities(a.response.answers.next_action), bp = probabilities(variant.response.answers.next_action);
    console.log(JSON.stringify({ model, comparison: `${variant.scenario} minus A (percentage points)`,
      next_action: Object.fromEntries(Object.keys(ap).map(key => [key, Number(((bp[key] - ap[key]) * 100).toFixed(2))])),
    }));
  }
}
