import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const namePattern = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98})$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export type CommandRunner = (args: string[]) => Promise<{stdout: string; stderr: string}>;

export type TrendingGranularity = 'weekly' | 'monthly';

export type TrendingCandidateInput = Record<string, unknown>;

export type TrendingRankingInput = {
  granularity: TrendingGranularity;
  period?: string;
  visibleCount: number;
  items: TrendingCandidateInput[];
  excludeFullNames?: string[];
  limit?: number;
};

const TRENDING_RANKING_WEIGHTS = {
  sourceRank: 0.45,
  periodHeat: 0.25,
  evidence: 0.15,
  mainstreamSignals: 0.1,
  recency: 0.05,
} as const;

const MAINSTREAM_SIGNAL_FIELDS = [
  {key: 'starsTotal', aliases: ['starsTotal', 'stars_total', 'stars']},
  {key: 'forks', aliases: ['forks', 'forksTotal', 'forks_total']},
  {key: 'maturityDays', aliases: ['maturityDays', 'maturity_days']},
  {key: 'docsAvailable', aliases: ['docsAvailable', 'docs_available']},
  {key: 'releaseCount90d', aliases: ['releaseCount90d', 'release_count_90d']},
  {key: 'communitySignals', aliases: ['communitySignals', 'community_signals']},
  {key: 'adoptionSignals', aliases: ['adoptionSignals', 'adoption_signals']},
] as const;

const SOURCE_FIELDS = new Set(['rank', 'periodStars', 'starsTotal', 'forks']);
const VERIFIED_FIELD_ALIASES = new Map<string, string>([
  ['aiRelevant', 'aiRelevant'], ['ai_relevant', 'aiRelevant'],
  ['repositoryVerified', 'repositoryVerified'], ['repository_verified', 'repositoryVerified'], ['repoVerified', 'repositoryVerified'],
  ['dedupEligible', 'dedupEligible'], ['dedup_eligible', 'dedupEligible'],
  ['minimumEvidenceSatisfied', 'minimumEvidenceSatisfied'], ['minimum_evidence_satisfied', 'minimumEvidenceSatisfied'],
  ['evidenceComplete', 'minimumEvidenceSatisfied'], ['evidence_complete', 'minimumEvidenceSatisfied'],
  ['evidenceFieldsVerified', 'evidenceFieldsVerified'], ['evidence_fields_verified', 'evidenceFieldsVerified'],
  ['evidenceFieldsTotal', 'evidenceFieldsTotal'], ['evidence_fields_total', 'evidenceFieldsTotal'],
  ['updatedAt', 'updatedAt'], ['updated_at', 'updatedAt'], ['pushedAt', 'updatedAt'], ['pushed_at', 'updatedAt'],
  ['maturityDays', 'maturityDays'], ['maturity_days', 'maturityDays'],
  ['docsAvailable', 'docsAvailable'], ['docs_available', 'docsAvailable'],
  ['releaseCount90d', 'releaseCount90d'], ['release_count_90d', 'releaseCount90d'],
  ['communitySignals', 'communitySignals'], ['community_signals', 'communitySignals'],
  ['adoptionSignals', 'adoptionSignals'], ['adoption_signals', 'adoptionSignals'],
]);

function firstValue(item: TrendingCandidateInput, aliases: readonly string[]): unknown {
  for (const alias of aliases) if (alias in item) return item[alias];
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundedScore(value: number): number {
  return Number(value.toFixed(3));
}

function percentileScores(values: Map<string, number>): Map<string, number> {
  const entries = [...values.entries()].sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
  const scores = new Map<string, number>();
  if (entries.length === 1) {
    scores.set(entries[0][0], 50);
    return scores;
  }
  for (let index = 0; index < entries.length;) {
    let end = index + 1;
    while (end < entries.length && entries[end][1] === entries[index][1]) end += 1;
    const averageIndex = (index + end - 1) / 2;
    const score = (averageIndex / (entries.length - 1)) * 100;
    for (let cursor = index; cursor < end; cursor += 1) scores.set(entries[cursor][0], score);
    index = end;
  }
  return scores;
}

function signalValue(item: TrendingCandidateInput, field: typeof MAINSTREAM_SIGNAL_FIELDS[number], verifiedFields: Set<string>): number | undefined {
  if (!SOURCE_FIELDS.has(field.key) && !verifiedFields.has(field.key)) return undefined;
  const value = firstValue(item, field.aliases);
  if (field.key === 'docsAvailable') {
    return typeof value === 'boolean' ? (value ? 100 : 0) : undefined;
  }
  const numeric = finiteNumber(value);
  return numeric === undefined || numeric < 0 ? undefined : numeric;
}

type NormalizedTrendingCandidate = {
  fullName: string;
  rank?: number;
  periodStars?: number;
  starsTotal?: number;
  forks?: number;
  updatedAt?: string;
  updatedAtMs?: number;
  aiRelevant: boolean;
  repositoryVerified: boolean;
  dedupEligible: boolean;
  minimumEvidenceSatisfied: boolean;
  evidenceFieldsVerified?: number;
  evidenceFieldsTotal?: number;
  verifiedFields: Set<string>;
  signals: Map<string, number>;
  source: TrendingCandidateInput;
};

function normalizeTrendingCandidate(item: TrendingCandidateInput): NormalizedTrendingCandidate {
  const fullNameValue = firstValue(item, ['fullName', 'full_name', 'name']);
  if (typeof fullNameValue !== 'string' || !fullNameValue.trim()) throw new Error('each trending candidate needs fullName');
  const verifiedFields = new Set(
    (Array.isArray(item.verifiedFields) ? item.verifiedFields : Array.isArray(item.verified_fields) ? item.verified_fields : [])
      .flatMap((field) => typeof field === 'string' ? [VERIFIED_FIELD_ALIASES.get(field) || field] : []),
  );
  const suppliedUnverifiedFields = [...VERIFIED_FIELD_ALIASES.entries()]
    .filter(([alias, canonical]) => alias in item && !SOURCE_FIELDS.has(canonical) && !verifiedFields.has(canonical))
    .map(([alias]) => alias);
  if (suppliedUnverifiedFields.length > 0) {
    throw new Error(`candidate ${fullNameValue.trim()} provides unverified field(s): ${suppliedUnverifiedFields.join(', ')}; list each verified field in verifiedFields only after checking its source`);
  }
  const updatedAtValue = firstValue(item, ['updatedAt', 'updated_at', 'pushedAt', 'pushed_at']);
  const updatedAt = verifiedFields.has('updatedAt') && typeof updatedAtValue === 'string' ? updatedAtValue : undefined;
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : undefined;
  const signals = new Map<string, number>();
  for (const field of MAINSTREAM_SIGNAL_FIELDS) {
    const value = signalValue(item, field, verifiedFields);
    if (value !== undefined) signals.set(field.key, value);
  }
  const evidenceFieldsVerified = finiteNumber(firstValue(item, ['evidenceFieldsVerified', 'evidence_fields_verified']));
  const evidenceFieldsTotal = finiteNumber(firstValue(item, ['evidenceFieldsTotal', 'evidence_fields_total']));
  return {
    fullName: fullNameValue.trim(),
    rank: finiteNumber(firstValue(item, ['rank', 'sourceRank', 'source_rank'])),
    periodStars: finiteNumber(firstValue(item, ['periodStars', 'period_stars'])),
    starsTotal: finiteNumber(firstValue(item, ['starsTotal', 'stars_total', 'stars'])),
    forks: finiteNumber(firstValue(item, ['forks', 'forksTotal', 'forks_total'])),
    updatedAt,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : undefined,
    aiRelevant: booleanValue(firstValue(item, ['aiRelevant', 'ai_relevant'])) === true,
    repositoryVerified: booleanValue(firstValue(item, ['repositoryVerified', 'repository_verified', 'repoVerified'])) === true,
    dedupEligible: booleanValue(firstValue(item, ['dedupEligible', 'dedup_eligible'])) === true,
    minimumEvidenceSatisfied: booleanValue(firstValue(item, ['minimumEvidenceSatisfied', 'minimum_evidence_satisfied', 'evidenceComplete', 'evidence_complete'])) === true,
    evidenceFieldsVerified,
    evidenceFieldsTotal,
    verifiedFields,
    signals,
    source: item,
  };
}

function evidenceScore(candidate: NormalizedTrendingCandidate): number {
  if (candidate.evidenceFieldsVerified !== undefined && candidate.evidenceFieldsTotal !== undefined && candidate.evidenceFieldsTotal > 0) {
    return boundedScore((candidate.evidenceFieldsVerified / candidate.evidenceFieldsTotal) * 100);
  }
  return 50;
}

function sourceRankScore(candidate: NormalizedTrendingCandidate, visibleCount: number): number {
  if (candidate.rank === undefined) return 50;
  return boundedScore((100 * (visibleCount - candidate.rank)) / Math.max(1, visibleCount - 1));
}

function compareDescending(left: number, right: number): number {
  return right - left;
}

function compareOptionalDescending(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return right - left;
}

function compareOptionalAscending(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

function filterReasons(candidate: NormalizedTrendingCandidate, excluded: Set<string>): string[] {
  const reasons: string[] = [];
  if (!candidate.aiRelevant) reasons.push('ai_relevance_not_confirmed');
  if (!candidate.repositoryVerified) reasons.push('repository_not_verified');
  if (!candidate.dedupEligible) reasons.push('within_60_day_dedup_window');
  if (!candidate.minimumEvidenceSatisfied) reasons.push('minimum_evidence_not_satisfied');
  if (excluded.has(candidate.fullName)) reasons.push('cross_list_duplicate');
  return reasons;
}

export function rankTrendingCandidates(input: TrendingRankingInput): Record<string, unknown> {
  if (!input || (input.granularity !== 'weekly' && input.granularity !== 'monthly')) throw new Error('granularity must be weekly or monthly');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('items must be a non-empty array');
  if (!Number.isInteger(input.visibleCount) || input.visibleCount < 1) throw new Error('visibleCount must be a positive integer from the snapshot count');
  if (input.items.length !== input.visibleCount) throw new Error(`items must contain the complete visible pool: expected visibleCount ${input.visibleCount}, received ${input.items.length}`);
  const candidates = input.items.map(normalizeTrendingCandidate);
  const names = new Set<string>();
  for (const candidate of candidates) {
    if (names.has(candidate.fullName)) throw new Error(`duplicate trending candidate: ${candidate.fullName}`);
    names.add(candidate.fullName);
  }
  const excludedNames = new Set((input.excludeFullNames || []).filter((value): value is string => typeof value === 'string'));
  const visibleCount = input.visibleCount;
  const periodValues = new Map(candidates.flatMap((candidate) => candidate.periodStars === undefined ? [] : [[candidate.fullName, candidate.periodStars] as [string, number]]));
  const recencyValues = new Map(candidates.flatMap((candidate) => candidate.updatedAtMs === undefined ? [] : [[candidate.fullName, candidate.updatedAtMs] as [string, number]]));
  const mainstreamPercentiles = new Map<string, Map<string, number>>();
  for (const field of MAINSTREAM_SIGNAL_FIELDS) {
    const values = new Map(candidates.flatMap((candidate) => {
      const value = candidate.signals.get(field.key);
      return value === undefined ? [] : [[candidate.fullName, value] as [string, number]];
    }));
    mainstreamPercentiles.set(field.key, percentileScores(values));
  }
  const periodPercentiles = percentileScores(periodValues);
  const recencyPercentiles = percentileScores(recencyValues);
  const rankingRows = candidates.map((candidate) => {
    const reasons = filterReasons(candidate, excludedNames);
    const mainstreamParts = MAINSTREAM_SIGNAL_FIELDS.flatMap((field) => {
      const score = mainstreamPercentiles.get(field.key)?.get(candidate.fullName);
      return score === undefined ? [] : [score];
    });
    const mainstreamSignalScore = mainstreamParts.length ? mainstreamParts.reduce((sum, score) => sum + score, 0) / mainstreamParts.length : 50;
    const scores = {
      sourceRankScore: sourceRankScore(candidate, visibleCount),
      periodHeatScore: periodPercentiles.get(candidate.fullName) ?? 50,
      evidenceScore: evidenceScore(candidate),
      mainstreamSignalScore,
      recencyScore: recencyPercentiles.get(candidate.fullName) ?? 50,
    };
    const finalScore = scores.sourceRankScore * TRENDING_RANKING_WEIGHTS.sourceRank
      + scores.periodHeatScore * TRENDING_RANKING_WEIGHTS.periodHeat
      + scores.evidenceScore * TRENDING_RANKING_WEIGHTS.evidence
      + scores.mainstreamSignalScore * TRENDING_RANKING_WEIGHTS.mainstreamSignals
      + scores.recencyScore * TRENDING_RANKING_WEIGHTS.recency;
    return {candidate, reasons, scores, finalScore};
  });
  const eligible = rankingRows.filter((row) => row.reasons.length === 0);
  eligible.sort((left, right) => {
    return compareDescending(left.finalScore, right.finalScore)
      || compareOptionalAscending(left.candidate.rank, right.candidate.rank)
      || compareOptionalDescending(left.candidate.periodStars, right.candidate.periodStars)
      || compareDescending(left.scores.evidenceScore, right.scores.evidenceScore)
      || compareOptionalDescending(left.candidate.starsTotal, right.candidate.starsTotal)
      || compareOptionalDescending(left.candidate.updatedAtMs, right.candidate.updatedAtMs)
      || left.candidate.fullName.localeCompare(right.candidate.fullName);
  });
  const limit = input.limit ?? (input.granularity === 'weekly' ? 3 : 2);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  const toOutput = (row: typeof rankingRows[number], eligibleValue: boolean) => ({
    fullName: row.candidate.fullName,
    rank: row.candidate.rank ?? null,
    periodStars: row.candidate.periodStars ?? null,
    starsTotal: row.candidate.starsTotal ?? null,
    forks: row.candidate.forks ?? null,
    updatedAt: row.candidate.updatedAt ?? null,
    verifiedFields: [...row.candidate.verifiedFields],
    eligible: eligibleValue,
    filterReasons: row.reasons,
    scores: Object.fromEntries(Object.entries(row.scores).map(([key, value]) => [key, roundedScore(value)])),
    finalScore: roundedScore(row.finalScore),
    observedMainstreamSignals: [...row.candidate.signals.keys()],
  });
  const ranking = eligible.map((row) => toOutput(row, true));
  const excluded = rankingRows.filter((row) => row.reasons.length > 0).map((row) => toOutput(row, false));
  return {
    algorithmVersion: 'trending-ranking-v1',
    granularity: input.granularity,
    period: input.period ?? null,
    visibleCount,
    eligibleCount: ranking.length,
    excludedCount: excluded.length,
    weights: TRENDING_RANKING_WEIGHTS,
    hardFilters: ['ai_relevance', 'repository_verification', '60_day_deduplication', 'minimum_evidence'],
    normalization: 'source rank uses 100*(N-rank)/max(1,N-1); other observable numeric signals use percentile within the visible pool; missing optional signals use neutral 50',
    ranking,
    excluded,
    selected: ranking.slice(0, limit),
    shortfall: Math.max(0, limit - ranking.length),
    selectionLimit: limit,
    note: 'The score orders candidates that pass hard filters. It is not a minimum score threshold and never excludes an otherwise eligible candidate.',
  };
}

export const runGh: CommandRunner = async (args) => {
  try {
    const {stdout, stderr} = await execFileAsync('gh', args, {maxBuffer: 4 * 1024 * 1024});
    return {stdout, stderr};
  } catch (error: any) {
    const detail = String(error?.stderr || error?.message || 'unknown error').trim();
    throw new Error(`GitHub CLI request failed: ${detail}`);
  }
};

function requiredName(value: unknown, field: string): string {
  if (typeof value !== 'string' || !namePattern.test(value)) throw new Error(`${field} must be a GitHub owner or repository name`);
  return value;
}

function requiredMonth(value: unknown): string {
  if (typeof value !== 'string' || !monthPattern.test(value)) throw new Error('month must be YYYY-MM');
  return value;
}

function requiredWeek(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-W\d{2}$/.test(value)) throw new Error('week must be YYYY-Www');
  return value;
}

function expectedUtcDays(month: string): number {
  const [year, numericMonth] = month.split('-').map(Number);
  return new Date(Date.UTC(year, numericMonth, 0)).getUTCDate();
}

function json(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('GitHub CLI returned invalid JSON');
  }
}

export async function authStatus(run: CommandRunner = runGh): Promise<{authenticated: boolean; host: string; login?: string; message?: string}> {
  try {
    const {stdout} = await run(['auth', 'status', '--hostname', 'github.com', '--json', 'hosts']);
    const hosts = json(stdout).hosts;
    const accounts = Array.isArray(hosts?.['github.com']) ? hosts['github.com'] : [];
    const active = accounts.find((account: any) => account.active) || accounts[0];
    return active?.login ? {authenticated: true, host: 'github.com', login: active.login} : {authenticated: false, host: 'github.com', message: 'Run gh auth login to authorize GitHub CLI.'};
  } catch {
    return {authenticated: false, host: 'github.com', message: 'GitHub CLI is unavailable or not authenticated. Run gh auth login.'};
  }
}

function endpoint(owner: unknown, repo: unknown, suffix = ''): string {
  return `repos/${requiredName(owner, 'owner')}/${requiredName(repo, 'repo')}${suffix}`;
}

async function api(path: string, run: CommandRunner): Promise<any> {
  const {stdout} = await run(['api', '--hostname', 'github.com', '-H', 'Accept: application/vnd.github+json', path]);
  return json(stdout);
}

export async function repositoryEvidence(owner: unknown, repo: unknown, run: CommandRunner = runGh): Promise<Record<string, unknown>> {
  const data = await api(endpoint(owner, repo), run);
  return {
    fullName: data.full_name,
    url: data.html_url,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    language: data.language,
    archived: data.archived,
    disabled: data.disabled,
    defaultBranch: data.default_branch,
  };
}

export async function starHistory(owner: unknown, repo: unknown, run: CommandRunner = runGh): Promise<any[]> {
  const data = await api(endpoint(owner, repo, '/stargazers/history'), run);
  if (!Array.isArray(data)) throw new Error('GitHub star history response was not an array');
  return data;
}

export async function monthlyStarGrowth(owner: unknown, repo: unknown, month: unknown, run: CommandRunner = runGh): Promise<Record<string, unknown>> {
  const targetMonth = requiredMonth(month);
  const expectedDays = expectedUtcDays(targetMonth);
  const weeks = await starHistory(owner, repo, run);
  let added = 0;
  let days = 0;
  for (const week of weeks) {
    const start = Number(week?.week) * 1000;
    if (!Number.isFinite(start) || !Array.isArray(week?.days)) continue;
    for (let index = 0; index < week.days.length; index += 1) {
      const date = new Date(start + index * 86_400_000).toISOString().slice(0, 7);
      if (date !== targetMonth) continue;
      const count = Number(week.days[index]);
      if (Number.isFinite(count) && count >= 0) {
        added += count;
        days += 1;
      }
    }
  }
  return {
    owner: requiredName(owner, 'owner'), repo: requiredName(repo, 'repo'), month: targetMonth,
    bucketTimezone: 'UTC', addedStars: added, observedDays: days, expectedDays,
    coverageComplete: days === expectedDays,
    averagePerObservedDay: days ? Number((added / days).toFixed(3)) : null,
    source: 'GitHub /repos/{owner}/{repo}/stargazers/history via gh api',
  };
}

async function trendingSnapshot(granularity: 'weekly' | 'monthly', period: string, run: CommandRunner): Promise<Record<string, unknown>> {
  const data = await api(`repos/host452b/trending-on-github/contents/data/${granularity}/${period}.json`, run);
  if (data?.type !== 'file' || typeof data.content !== 'string') throw new Error(`GitHub ${granularity} Trending snapshot is unavailable`);
  const snapshot = json(Buffer.from(data.content.replace(/\s+/g, ''), 'base64').toString('utf8'));
  if (snapshot?.granularity !== granularity || !snapshot?.period || !Array.isArray(snapshot?.items)) {
    throw new Error(`GitHub ${granularity} Trending snapshot has an invalid schema`);
  }
  return {
    granularity,
    periodKey: period,
    source: `GitHub Trending ${granularity} snapshot via host452b/trending-on-github`,
    sourceUrl: snapshot.source_url,
    capturedAt: snapshot.run_date_utc,
    period: snapshot.period,
    count: snapshot.count,
    items: snapshot.items,
    equivalentRanking: true,
    globalTop500: false,
    note: `This is the visible ${granularity} GitHub Trending ranking and is not a global Top 500 dataset.`,
  };
}

export async function monthlyTrendingSnapshot(month: unknown, run: CommandRunner = runGh): Promise<Record<string, unknown>> {
  return trendingSnapshot('monthly', requiredMonth(month), run);
}

export async function weeklyTrendingSnapshot(week: unknown, run: CommandRunner = runGh): Promise<Record<string, unknown>> {
  return trendingSnapshot('weekly', requiredWeek(week), run);
}
