import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyStarGrowth, monthlyTrendingSnapshot, rankTrendingCandidates, repositoryEvidence, weeklyTrendingSnapshot} from '../src/github-cli.ts';
import {GITHUB_TOOL_DEFINITIONS, handleGithubMcpRequest} from '../src/github-mcp.ts';

const run = async (args: string[]) => {
  if (args.at(-1) === 'repos/acme/agent') return {stdout: JSON.stringify({full_name: 'acme/agent', html_url: 'https://github.com/acme/agent', stargazers_count: 50, forks_count: 4, created_at: '2026-09-01T00:00:00Z'}), stderr: ''};
  if (args.at(-1) === 'repos/acme/agent/stargazers/history') return {stdout: JSON.stringify([{week: 1788220800, total: 7, days: [1, 0, 2, 0, 1, 0, 3]}]), stderr: ''};
  if (args.at(-1) === 'repos/host452b/trending-on-github/contents/data/monthly/2026-09.json') {
    const snapshot = {granularity: 'monthly', run_date_utc: '2026-09-30T05:47:41Z', period: {start: '2026-09-01', end: '2026-09-30'}, source_url: 'https://github.com/trending?since=monthly', count: 2, items: [{rank: 1, full_name: 'acme/agent', period_stars: 12}, {rank: 2, full_name: 'acme/tools', period_stars: 8}]};
    return {stdout: JSON.stringify({type: 'file', content: Buffer.from(JSON.stringify(snapshot)).toString('base64')}), stderr: ''};
  }
  if (args.at(-1) === 'repos/host452b/trending-on-github/contents/data/weekly/2026-W41.json') {
    const snapshot = {granularity: 'weekly', run_date_utc: '2026-10-07T06:16:00Z', period: {start: '2026-10-01', end: '2026-10-07'}, source_url: 'https://github.com/trending?since=weekly', count: 2, items: [{rank: 1, full_name: 'acme/agent', period_stars: 12}, {rank: 2, full_name: 'acme/tools', period_stars: 8}]};
    return {stdout: JSON.stringify({type: 'file', content: Buffer.from(JSON.stringify(snapshot)).toString('base64')}), stderr: ''};
  }
  throw new Error(`unexpected args: ${args.join(' ')}`);
};

test('repository evidence returns a deliberately bounded metadata subset', async () => {
  const evidence = await repositoryEvidence('acme', 'agent', run);
  assert.deepEqual(evidence, {fullName: 'acme/agent', url: 'https://github.com/acme/agent', description: undefined, createdAt: '2026-09-01T00:00:00Z', updatedAt: undefined, pushedAt: undefined, stars: 50, forks: 4, openIssues: undefined, language: undefined, archived: undefined, disabled: undefined, defaultBranch: undefined});
});

test('monthly growth sums only dates inside the requested month', async () => {
  const growth = await monthlyStarGrowth('acme', 'agent', '2026-09', run);
  assert.equal(growth.addedStars, 7);
  assert.equal(growth.observedDays, 7);
  assert.equal(growth.expectedDays, 30);
  assert.equal(growth.coverageComplete, false);
  assert.equal(growth.bucketTimezone, 'UTC');
  assert.equal(growth.averagePerObservedDay, 1);
});

test('monthly Trending snapshot preserves the visible equivalent ranking and calendar period', async () => {
  const snapshot = await monthlyTrendingSnapshot('2026-09', run);
  assert.equal(snapshot.equivalentRanking, true);
  assert.equal(snapshot.globalTop500, false);
  assert.equal(snapshot.period.start, '2026-09-01');
  assert.equal(snapshot.period.end, '2026-09-30');
  assert.equal(snapshot.count, 2);
  assert.equal(snapshot.items[0].full_name, 'acme/agent');
});

test('weekly Trending snapshot preserves the visible fallback period', async () => {
  const snapshot = await weeklyTrendingSnapshot('2026-W41', run);
  assert.equal(snapshot.granularity, 'weekly');
  assert.equal(snapshot.period.start, '2026-10-01');
  assert.equal(snapshot.period.end, '2026-10-07');
  assert.equal(snapshot.count, 2);
});

test('Trending ranking is calculated in the MCP layer without a score threshold', () => {
  const ranked = rankTrendingCandidates({
    granularity: 'weekly',
    period: '2026-W41',
    visibleCount: 4,
    items: [
      {fullName: 'acme/top', rank: 1, periodStars: 40, starsTotal: 100, forks: 10, updatedAt: '2026-10-08T00:00:00Z', aiRelevant: true, repositoryVerified: true, dedupEligible: true, minimumEvidenceSatisfied: true, evidenceFieldsVerified: 6, evidenceFieldsTotal: 6, maturityDays: 300, docsAvailable: true, releaseCount90d: 5, communitySignals: 10, verifiedFields: ['updatedAt', 'aiRelevant', 'repositoryVerified', 'dedupEligible', 'minimumEvidenceSatisfied', 'evidenceFieldsVerified', 'evidenceFieldsTotal', 'maturityDays', 'docsAvailable', 'releaseCount90d', 'communitySignals']},
      {fullName: 'acme/hot', rank: 2, periodStars: 80, starsTotal: 200, forks: 20, updatedAt: '2026-10-07T00:00:00Z', aiRelevant: true, repositoryVerified: true, dedupEligible: true, minimumEvidenceSatisfied: true, evidenceFieldsVerified: 4, evidenceFieldsTotal: 6, maturityDays: 100, docsAvailable: false, releaseCount90d: 2, communitySignals: 4, verifiedFields: ['updatedAt', 'aiRelevant', 'repositoryVerified', 'dedupEligible', 'minimumEvidenceSatisfied', 'evidenceFieldsVerified', 'evidenceFieldsTotal', 'maturityDays', 'docsAvailable', 'releaseCount90d', 'communitySignals']},
      {fullName: 'acme/unknown', rank: 3, periodStars: 10, aiRelevant: true, repositoryVerified: true, dedupEligible: true, minimumEvidenceSatisfied: true, evidenceFieldsVerified: 4, evidenceFieldsTotal: 6, verifiedFields: ['aiRelevant', 'repositoryVerified', 'dedupEligible', 'minimumEvidenceSatisfied', 'evidenceFieldsVerified', 'evidenceFieldsTotal']},
      {fullName: 'acme/out-of-scope', rank: 4, periodStars: 90, aiRelevant: false, repositoryVerified: true, dedupEligible: true, minimumEvidenceSatisfied: true, evidenceFieldsVerified: 6, evidenceFieldsTotal: 6, verifiedFields: ['aiRelevant', 'repositoryVerified', 'dedupEligible', 'minimumEvidenceSatisfied', 'evidenceFieldsVerified', 'evidenceFieldsTotal']},
    ],
  });
  assert.equal(ranked.algorithmVersion, 'trending-ranking-v1');
  assert.equal(ranked.visibleCount, 4);
  assert.equal(ranked.eligibleCount, 3);
  assert.equal(ranked.shortfall, 0);
  assert.deepEqual(ranked.selected.map((item: any) => item.fullName), ['acme/top', 'acme/hot', 'acme/unknown']);
  assert.equal(ranked.ranking[2].scores.mainstreamSignalScore, 50);
  assert.deepEqual(ranked.excluded[0].filterReasons, ['ai_relevance_not_confirmed']);
});

test('Trending ranking rejects an incomplete visible pool', () => {
  assert.throws(() => rankTrendingCandidates({
    granularity: 'monthly',
    visibleCount: 2,
    items: [{fullName: 'acme/only', rank: 1, periodStars: 10, verifiedFields: []}],
  }), /complete visible pool: expected visibleCount 2, received 1/);
});

test('Trending ranking rejects unverified auxiliary fields instead of using them', () => {
  assert.throws(() => rankTrendingCandidates({
    granularity: 'weekly',
    visibleCount: 1,
    items: [{fullName: 'acme/fabricated', rank: 1, updatedAt: '2026-10-08T00:00:00Z', verifiedFields: []}],
  }), /provides unverified field\(s\): updatedAt/);
});

test('GitHub CLI MCP exposes fixed read-only tools and rejects unsafe repository names', async () => {
  assert.equal(GITHUB_TOOL_DEFINITIONS.length, 7);
  const rankingResponse = await handleGithubMcpRequest({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'github_rank_trending_candidates', arguments: {
    granularity: 'weekly',
    visibleCount: 1,
    items: [{fullName: 'acme/agent', rank: 1, periodStars: 10, aiRelevant: true, repositoryVerified: true, dedupEligible: true, minimumEvidenceSatisfied: true, verifiedFields: ['aiRelevant', 'repositoryVerified', 'dedupEligible', 'minimumEvidenceSatisfied']}],
  }}});
  assert.equal(rankingResponse?.result.isError, undefined);
  assert.equal(JSON.parse(rankingResponse?.result.content[0].text).algorithmVersion, 'trending-ranking-v1');
  const response = await handleGithubMcpRequest({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'github_repo_evidence', arguments: {owner: 'acme; rm -rf /', repo: 'agent'}}});
  assert.equal(response?.result.isError, true);
  assert.match(response?.result.content[0].text, /owner must be/);
});
