// Daily discovery is a union of declared, bounded searches, not a global league table.
// This module validates evidence shape/time and computes selection. The caller still
// has to read the cited sources: a URL or verifiedFields is not an authenticity proof.
export const DISCOVERY_VERSION = 'discovery-v1';
const DAY = 86_400_000;
const metrics = ['stars', 'downloads', 'participants', 'recognition_events'];
const events = ['official_listing', 'integration', 'adoption'];
const requiredReviews = ['scopeRelevant', 'scopeReason', 'repositoryVerified', 'dedupEligible', 'minimumEvidenceSatisfied', 'trend', 'ecosystem'];
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const nameKey = (name: string) => name.toLowerCase();

export function dateMs(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('date must be YYYY-MM-DD');
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error('invalid calendar date');
  return ms;
}
function httpUrl(value: unknown): boolean {
  try { const u = new URL(String(value)); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function nonempty(value: unknown): boolean { return typeof value === 'string' && value.trim().length > 0; }
function count(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function repoName(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value); }

export type DiscoveryScope = {
  id: string; label: string; query: string; sourceUrl: string; observedOn: string;
  windowStart: string; windowEnd: string; metric: string; members: string[];
};
export type DiscoveryInput = {asOf: string; scopes: DiscoveryScope[]; items: any[]; limit?: number};

function trendEvidence(item: any, scope: DiscoveryScope, asOf: number) {
  const t = item.trend;
  if (!t || !httpUrl(t.sourceUrl)) throw new Error('trend_source_missing');
  const checked = dateMs(t.checkedOn);
  if (checked > asOf || asOf - checked > 7 * DAY) throw new Error('trend_check_stale_or_future');
  if (t.kind === 'attention') {
    if (t.metric !== scope.metric || t.metric === 'recognition_events') throw new Error('trend_metric_mismatch');
    if (t.windowStart !== scope.windowStart || t.windowEnd !== scope.windowEnd) throw new Error('trend_window_mismatch');
    if (dateMs(t.windowEnd) > checked) throw new Error('trend_checked_before_window_end');
    if (t.coverageComplete !== true || !count(t.added) || t.added === 0) throw new Error('positive_complete_attention_required');
    let acceleration: number | null = null;
    if (t.baseline !== undefined) {
      const b = t.baseline;
      if (!b || b.coverageComplete !== true || !count(b.added) || !httpUrl(b.sourceUrl)) throw new Error('invalid_baseline');
      const duration = dateMs(t.windowEnd) - dateMs(t.windowStart);
      if (dateMs(b.windowEnd) - dateMs(b.windowStart) !== duration || dateMs(b.windowEnd) + DAY !== dateMs(t.windowStart)) throw new Error('baseline_must_be_adjacent_equal_window');
      acceleration = t.added - b.added;
    }
    return {kind: t.kind, magnitude: t.added, acceleration, evidenceDate: t.windowEnd, sourceUrl: t.sourceUrl,
      claim: acceleration === null ? 'observed_new_attention' : acceleration > 0 ? 'attention_accelerating' : 'attention_not_accelerating'};
  }
  if (t.kind === 'recognition') {
    const occurred = dateMs(t.occurredOn);
    if (scope.metric !== 'recognition_events' || !events.includes(t.eventType) || t.independentOfProject !== true || !nonempty(t.actor) || !nonempty(t.description)) throw new Error('independent_recognition_required');
    if (occurred < dateMs(scope.windowStart) || occurred > dateMs(scope.windowEnd) || occurred > checked) throw new Error('recognition_outside_window');
    return {kind: t.kind, magnitude: 1, acceleration: null, evidenceDate: t.occurredOn, sourceUrl: t.sourceUrl, claim: 'new_external_recognition'};
  }
  throw new Error('unsupported_trend_kind');
}

export function selectDiscoveries(input: DiscoveryInput) {
  const asOf = dateMs(input.asOf);
  const limit = input.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('limit must be 1..20');
  if (!Array.isArray(input.scopes) || input.scopes.length > 20 || !Array.isArray(input.items) || input.items.length > 200) throw new Error('scopes/items must be bounded arrays (20/200)');
  const scopes = new Map<string, DiscoveryScope>();
  for (const s of input.scopes) {
    if (!s || !nonempty(s.id) || scopes.has(s.id) || !nonempty(s.label) || !nonempty(s.query) || !httpUrl(s.sourceUrl) || !metrics.includes(s.metric)) throw new Error('invalid or duplicate scope');
    const start = dateMs(s.windowStart), end = dateMs(s.windowEnd), observed = dateMs(s.observedOn);
    if (start > end || end - start >= 30 * DAY || end > asOf || asOf - end >= 30 * DAY || observed < end || observed > asOf || asOf - observed > 7 * DAY) throw new Error('scope needs a recent, observed window of at most 30 days');
    if (!Array.isArray(s.members) || s.members.length === 0 || s.members.some(n => !repoName(n)) || new Set(s.members.map(nameKey)).size !== s.members.length) throw new Error('scope members must be distinct repository names');
    scopes.set(s.id, s);
  }
  const seen = new Set<string>();
  const identities = new Map<string, string>();
  const rows = input.items.map(item => {
    if (!item || !repoName(item.fullName)) throw new Error('candidate fullName must be owner/repo');
    const scope = scopes.get(item.scopeId);
    const key = `${item.scopeId}:${nameKey(item.fullName)}`;
    if (!scope || !scope.members.some(n => nameKey(n) === nameKey(item.fullName)) || seen.has(key)) throw new Error('candidate scope membership invalid or duplicated');
    seen.add(key);
    const identity = JSON.stringify([item.repositoryVerified, item.dedupEligible, String(item.ecosystem ?? '').trim().toLowerCase()]);
    const oldIdentity = identities.get(nameKey(item.fullName));
    if (oldIdentity !== undefined && oldIdentity !== identity) throw new Error('conflicting repository/dedup/ecosystem facts across scopes');
    identities.set(nameKey(item.fullName), identity);
    const reviewed = new Set(item.verifiedFields ?? []);
    for (const field of requiredReviews) if (field in item && !reviewed.has(field)) throw new Error(`unverified field: ${item.fullName}.${field}`);
    const reasons: string[] = [];
    if (item.scopeRelevant !== true || !nonempty(item.scopeReason)) reasons.push('scope_relevance_not_confirmed');
    if (item.repositoryVerified !== true) reasons.push('repository_not_verified');
    if (item.dedupEligible !== true) reasons.push('within_dedup_window_or_unchecked');
    if (item.minimumEvidenceSatisfied !== true || !Array.isArray(item.evidenceUrls) || !item.evidenceUrls.length || item.evidenceUrls.some(u => !httpUrl(u))) reasons.push('minimum_evidence_not_satisfied');
    if (!nonempty(item.ecosystem)) reasons.push('ecosystem_not_identified');
    let evidence: ReturnType<typeof trendEvidence> | null = null;
    try { evidence = trendEvidence(item, scope, asOf); } catch (error) { reasons.push(error instanceof Error ? error.message : 'invalid_trend'); }
    return {fullName: item.fullName, scopeId: scope.id, scopeLabel: scope.label, ecosystem: String(item.ecosystem ?? '').trim().toLowerCase(), scopeReason: item.scopeReason,
      eligible: reasons.length === 0, filterReasons: reasons, evidence, trend: item.trend ?? null, evidenceUrls: item.evidenceUrls ?? [], localPosition: null as number | null, comparedCount: 0};
  });
  for (const s of scopes.values()) for (const name of s.members) {
    if (!seen.has(`${s.id}:${nameKey(name)}`)) throw new Error(`complete declared scope required: missing ${name}`);
  }
  const compare = (a: typeof rows[number], b: typeof rows[number]) =>
    b.evidence!.magnitude - a.evidence!.magnitude
    || (b.evidence!.acceleration ?? 0) - (a.evidence!.acceleration ?? 0)
    || compareText(b.evidence!.evidenceDate, a.evidence!.evidenceDate)
    || compareText(nameKey(a.fullName), nameKey(b.fullName));
  // Rank comparable observations before dedup; historical coverage must not improve a local rank.
  for (const s of scopes.values()) {
    const comparable = rows.filter(r => r.scopeId === s.id && r.evidence).sort(compare);
    comparable.forEach((r, i) => { r.localPosition = i + 1; r.comparedCount = comparable.length; });
  }
  const remaining = rows.filter(r => r.eligible);
  const selected: Array<typeof rows[number] & {selectionOrder: number}> = [];
  const selectedNames = new Set<string>(), ecosystemCounts = new Map<string, number>(), scopeCounts = new Map<string, number>();
  while (remaining.some(r => !selectedNames.has(nameKey(r.fullName))) && selected.length < limit) {
    const available = remaining.filter(r => !selectedNames.has(nameKey(r.fullName)));
    available.sort((a, b) =>
      (ecosystemCounts.get(a.ecosystem) ?? 0) - (ecosystemCounts.get(b.ecosystem) ?? 0)
      || (scopeCounts.get(a.scopeId) ?? 0) - (scopeCounts.get(b.scopeId) ?? 0)
      || a.localPosition! - b.localPosition!
      || compareText(b.evidence!.evidenceDate, a.evidence!.evidenceDate)
      || compareText(a.scopeId, b.scopeId)
      || compareText(nameKey(a.fullName), nameKey(b.fullName)));
    const pick = available[0];
    selected.push({...pick, selectionOrder: selected.length + 1});
    selectedNames.add(nameKey(pick.fullName));
    ecosystemCounts.set(pick.ecosystem, (ecosystemCounts.get(pick.ecosystem) ?? 0) + 1);
    scopeCounts.set(pick.scopeId, (scopeCounts.get(pick.scopeId) ?? 0) + 1);
  }
  return {algorithmVersion: DISCOVERY_VERSION, asOf: input.asOf, selectionLimit: limit, scopes: input.scopes,
    eligibleCount: new Set(remaining.map(r => nameKey(r.fullName))).size, selected, shortfall: limit - selected.length,
    ranking: remaining.sort((a,b) => compareText(a.scopeId,b.scopeId) || a.localPosition! - b.localPosition!),
    excluded: rows.filter(r => !r.eligible).sort((a,b) => compareText(a.scopeId,b.scopeId) || compareText(nameKey(a.fullName),nameKey(b.fullName))),
    policy: 'Recent evidenced attention or independent recognition required. Within each declared scope: absolute increment, then equal-window increment change, evidence date, canonical name. Across scopes: least represented ecosystem, least represented scope, local position, date, scope ID, name. No global popularity score; no size/age bonus. Local position is only within the compared observations, not a field-wide rank.',
    verificationBoundary: 'Caller verifies source content and scope semantics. Service validates structure, dates, coverage, arithmetic, declared completeness and deterministic selection; it does not authenticate cited pages.'};
}
