import {authStatus, monthlyStarGrowth, monthlyTrendingSnapshot, rankTrendingCandidates, repositoryEvidence, starHistory, weeklyTrendingSnapshot} from './github-cli.ts';

type JsonRpcRequest = {jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, any>};

const readOnly = {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true};
const ownerSchema = {type: 'string', description: 'GitHub 用户名或组织名'};
const repoSchema = {type: 'string', description: 'GitHub 仓库名，不含 owner/ 前缀'};
const trendingCandidateSchema = {
  type: 'object',
  required: ['fullName'],
  properties: {
    fullName: {type: 'string', description: '仓库全名，格式为 owner/repo。'},
    verifiedFields: {type: 'array', items: {type: 'string'}, description: '本条目中除榜单原生字段外，实际已从 GitHub、Context Hub 或仓库资料核验的字段名。工具只使用列在这里的辅助字段；不要把未核验字段加入请求。'},
    rank: {type: 'number', description: '候选在来源榜单中的名次；没有名次时省略。'},
    periodStars: {type: 'number', description: '目标时间窗口内新增 stars。'},
    starsTotal: {type: 'number', description: '当前总 stars。'},
    forks: {type: 'number', description: '当前 forks 数。'},
    updatedAt: {type: 'string', description: '最近更新时间，ISO 8601 字符串；只有在 verifiedFields 包含 updatedAt 时才参与排序。'},
    aiRelevant: {type: 'boolean', description: '调用方对 AI 相关性的核验结果。'},
    repositoryVerified: {type: 'boolean', description: '调用方对仓库身份和仓库证据的核验结果。'},
    dedupEligible: {type: 'boolean', description: '调用方基于 Context Hub 排重结果判定的可入选状态。'},
    minimumEvidenceSatisfied: {type: 'boolean', description: '调用方判定项目已达到最低事实证据要求。'},
    evidenceFieldsVerified: {type: 'number', description: '已核验的证据字段数量。'},
    evidenceFieldsTotal: {type: 'number', description: '计划核验的证据字段总数。'},
    maturityDays: {type: 'number', description: '仓库从创建到当前的天数；只有在 verifiedFields 包含 maturityDays 时才参与排序。'},
    docsAvailable: {type: 'boolean', description: '是否有可用文档或 README；只有在 verifiedFields 包含 docsAvailable 时才参与排序。'},
    releaseCount90d: {type: 'number', description: '近 90 天 release 数量；只有在 verifiedFields 包含 releaseCount90d 时才参与排序。'},
    communitySignals: {type: 'number', description: '可观察社区信号值，由调用方提供；只有在 verifiedFields 包含 communitySignals 时才参与排序。'},
    adoptionSignals: {type: 'number', description: '可观察采用信号值，由调用方提供；只有在 verifiedFields 包含 adoptionSignals 时才参与排序。'},
  },
  additionalProperties: true,
};

const rankedCandidateSchema = {
  type: 'object',
  properties: {
    fullName: {type: 'string', description: '仓库全名。'},
    rank: {type: ['number', 'null'], description: '来源榜单名次。'},
    periodStars: {type: ['number', 'null'], description: '窗口新增 stars。'},
    starsTotal: {type: ['number', 'null'], description: '总 stars。'},
    forks: {type: ['number', 'null'], description: 'forks 数。'},
    updatedAt: {type: ['string', 'null'], description: '最近更新时间。'},
    eligible: {type: 'boolean', description: '是否通过资格判断并进入 ranking。'},
    filterReasons: {type: 'array', items: {type: 'string'}, description: '未入选时的资格或跨榜排除原因。'},
    scores: {type: 'object', description: '各排序信号的归一化分项。'},
    finalScore: {type: 'number', description: '服务端综合排序分。'},
    observedMainstreamSignals: {type: 'array', items: {type: 'string'}, description: '本候选实际提供的主流度信号字段。'},
  },
  additionalProperties: true,
};

const rankOutputSchema = {
  type: 'object',
  properties: {
    algorithmVersion: {type: 'string', description: '服务端算法版本标识。'},
    granularity: {type: 'string', enum: ['weekly', 'monthly']},
    period: {type: ['string', 'null'], description: '调用方传入的来源窗口。'},
    visibleCount: {type: 'integer', description: '来源快照返回的完整可见候选数量；必须与 items.length 相等，用于阻止只提交部分榜单后仍然排序。'},
    eligibleCount: {type: 'integer', description: '通过资格判断的候选数量。'},
    excludedCount: {type: 'integer', description: '被资格判断或跨榜排除的候选数量。'},
    weights: {type: 'object', description: '当前服务端使用的排序权重。'},
    hardFilters: {type: 'array', items: {type: 'string'}, description: '当前服务端使用的资格字段。'},
    normalization: {type: 'string', description: '当前服务端的归一化说明。'},
    ranking: {type: 'array', items: rankedCandidateSchema, description: '按综合排序分排列的合格候选。'},
    excluded: {type: 'array', items: rankedCandidateSchema, description: '未进入合格排序的候选及原因。'},
    selected: {type: 'array', items: rankedCandidateSchema, description: '按 limit 截取的最终候选。'},
    shortfall: {type: 'integer', description: '目标数量减去合格候选数量后的缺口，最小为 0。'},
    selectionLimit: {type: 'integer', description: '本次实际使用的选择数量。'},
    note: {type: 'string', description: '关于分数用途和选择边界的服务端说明。'},
  },
  additionalProperties: true,
};

const repositoryEvidenceOutputSchema = {
  type: 'object',
  properties: {
    fullName: {type: 'string'}, url: {type: 'string'}, description: {type: ['string', 'null']},
    createdAt: {type: ['string', 'null']}, updatedAt: {type: ['string', 'null']}, pushedAt: {type: ['string', 'null']},
    stars: {type: ['integer', 'null']}, forks: {type: ['integer', 'null']}, openIssues: {type: ['integer', 'null']},
    language: {type: ['string', 'null']}, archived: {type: ['boolean', 'null']}, disabled: {type: ['boolean', 'null']}, defaultBranch: {type: ['string', 'null']},
  },
  additionalProperties: true,
};

const snapshotOutputSchema = {
  type: 'object',
  properties: {
    granularity: {type: 'string', enum: ['weekly', 'monthly']}, periodKey: {type: 'string'},
    source: {type: 'string'}, sourceUrl: {type: 'string'}, capturedAt: {type: 'string'},
    period: {type: 'object', description: '快照覆盖的实际起止日期。'}, count: {type: 'integer'},
    items: {type: 'array', description: '快照中实际可见的候选条目。'}, equivalentRanking: {type: 'boolean'}, globalTop500: {type: 'boolean'}, note: {type: 'string'},
  },
  additionalProperties: true,
};

export const GITHUB_TOOL_DEFINITIONS = [
  {name: 'github_cli_auth_status', description: '检查本地 GitHub CLI 是否已登录 github.com。返回 authenticated、host、login 或 message；不返回 token，也不接受参数。', outputSchema: {type: 'object', properties: {authenticated: {type: 'boolean'}, host: {type: 'string'}, login: {type: 'string'}, message: {type: 'string'}}, additionalProperties: true}, inputSchema: {type: 'object', properties: {}, additionalProperties: false}, annotations: readOnly},
  {name: 'github_repo_evidence', description: '通过 gh api 读取一个公开仓库的基础事实，供项目身份和社区规模核验。返回 fullName、url、description、createdAt、updatedAt、pushedAt、stars、forks、openIssues、language、archived、disabled 和 defaultBranch；不会读取 README，也不会返回 token。', outputSchema: repositoryEvidenceOutputSchema, inputSchema: {type: 'object', required: ['owner', 'repo'], properties: {owner: ownerSchema, repo: repoSchema}, additionalProperties: false}, annotations: readOnly},
  {name: 'github_star_history', description: '通过 GitHub stargazers/history 读取一个仓库的原始 star-history 聚合桶。返回每个周桶的起点和每日数量，适合进一步计算时间窗口变化；它不提供全局排名。', outputSchema: {type: 'array', items: {type: 'object', additionalProperties: true}}, inputSchema: {type: 'object', required: ['owner', 'repo'], properties: {owner: ownerSchema, repo: repoSchema}, additionalProperties: false}, annotations: readOnly},
  {name: 'github_monthly_star_growth', description: '从 UTC 每日 star-history 桶中统计一个仓库指定月份的新增 stars。返回 addedStars、observedDays、expectedDays、coverageComplete 和 averagePerObservedDay；coverageComplete=false 时只能作为不完整观测，不能用于完整月度增长比较。', outputSchema: {type: 'object', properties: {owner: {type: 'string'}, repo: {type: 'string'}, month: {type: 'string'}, bucketTimezone: {type: 'string'}, addedStars: {type: 'number'}, observedDays: {type: 'integer'}, expectedDays: {type: 'integer'}, coverageComplete: {type: 'boolean'}, averagePerObservedDay: {type: ['number', 'null']}, source: {type: 'string'}}, additionalProperties: true}, inputSchema: {type: 'object', required: ['owner', 'repo', 'month'], properties: {owner: ownerSchema, repo: repoSchema, month: {type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: '目标月份，格式 YYYY-MM；按 UTC 日历月统计。'}}, additionalProperties: false}, annotations: readOnly},
  {name: 'github_monthly_trending_snapshot', description: '读取指定完整自然月的可见 GitHub Trending 月榜快照。返回实际来源、capturedAt、period、count 和 items；它是可见的月度星标增长等价排名，不是全局 Top 500，也不会补齐未返回项目。', outputSchema: snapshotOutputSchema, inputSchema: {type: 'object', required: ['month'], properties: {month: {type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: '目标完整自然月，格式 YYYY-MM。'}}, additionalProperties: false}, annotations: readOnly},
  {name: 'github_weekly_trending_snapshot', description: '读取指定 ISO 周的可见 GitHub Trending 周榜快照。用于实时周榜不可访问或过期时的有界兜底；返回实际 period、capturedAt、count 和 items，不代表完整 Top 30。', outputSchema: snapshotOutputSchema, inputSchema: {type: 'object', required: ['week'], properties: {week: {type: 'string', pattern: '^\\d{4}-W\\d{2}$', description: '目标 ISO 周，格式 YYYY-Www，例如 2026-W40。'}}, additionalProperties: false}, annotations: readOnly},
  {name: 'github_rank_trending_candidates', description: '在 MCP 服务端对完整可见榜单候选执行唯一的 Trending 选择。调用方必须把快照 count 作为 visibleCount，并提交 count 对应的全部 items；缺项会直接报错。每项的榜单原生字段可直接使用，更新时间、成熟度、文档、release、社区/采用信号以及资格判断等辅助字段，只有列入 verifiedFields 才会被接受或参与排序，未核验字段会直接报错。算法先应用 AI 相关性、仓库核验、60 天排重、最低证据和跨榜排除；对剩余候选按来源名次 45%、窗口热度 25%、证据完整度 15%、主流信号 10%、新鲜度 5%加权，缺失可选信号按中性值处理，并用确定性规则解决并列。分数只负责综合排序，不设最低分门槛；默认 weekly 选 3 个、monthly 选 2 个，limit 可覆盖。返回完整 ranking、excluded、selected、scores、weights、shortfall 和算法版本，调用方不要重算或改写。', outputSchema: rankOutputSchema, inputSchema: {type: 'object', required: ['granularity', 'visibleCount', 'items'], properties: {granularity: {type: 'string', enum: ['weekly', 'monthly'], description: '候选榜单类型；weekly 默认选择 3 个，monthly 默认选择 2 个。'}, period: {type: 'string', description: '可选的来源窗口标识，只作为结果 metadata 保存。'}, visibleCount: {type: 'integer', minimum: 1, description: '必须直接取自快照返回的 count，且必须等于 items.length。'}, items: {type: 'array', minItems: 1, description: '完整可见候选列表，不是调用方挑出的子集；每项必须有 fullName 和 verifiedFields。rank、periodStars、starsTotal、forks 可作为榜单快照原生字段，其他已提供字段必须先核验并列入 verifiedFields。', items: {...trendingCandidateSchema, required: ['fullName', 'verifiedFields']}}, excludeFullNames: {type: 'array', description: '跨榜排除列表；其中的 owner/repo 全名不会进入 selected。', items: {type: 'string'}}, limit: {type: 'integer', minimum: 1, description: '可选的最终选择数量；省略时使用 granularity 对应的默认值。'}}, additionalProperties: false}, annotations: readOnly},
];

function result(id: JsonRpcRequest['id'], value: any) { return {jsonrpc: '2.0', id, result: value}; }
function error(id: JsonRpcRequest['id'], code: number, message: string) { return {jsonrpc: '2.0', id, error: {code, message}}; }
function toolResult(value: unknown, isError = false) { return {content: [{type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2)}], ...(isError ? {isError: true} : {})}; }

async function call(name: string, args: Record<string, any>) {
  if (name === 'github_cli_auth_status') return authStatus();
  if (name === 'github_repo_evidence') return repositoryEvidence(args.owner, args.repo);
  if (name === 'github_star_history') return starHistory(args.owner, args.repo);
  if (name === 'github_monthly_star_growth') return monthlyStarGrowth(args.owner, args.repo, args.month);
  if (name === 'github_monthly_trending_snapshot') return monthlyTrendingSnapshot(args.month);
  if (name === 'github_weekly_trending_snapshot') return weeklyTrendingSnapshot(args.week);
  if (name === 'github_rank_trending_candidates') return rankTrendingCandidates(args);
  throw new Error(`unknown tool: ${name}`);
}

export async function handleGithubMcpRequest(request: JsonRpcRequest | unknown): Promise<Record<string, any> | null> {
  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return error((request as any)?.id ?? null, -32600, 'Invalid JSON-RPC request');
  if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') return null;
  if (request.method === 'ping') return result(request.id ?? null, {});
  if (request.method === 'initialize') return result(request.id ?? null, {protocolVersion: request.params?.protocolVersion || '2026-07-28', capabilities: {tools: {listChanged: false}}, serverInfo: {name: 'github-cli-data', version: '0.1.0'}, instructions: 'Read-only GitHub CLI wrapper. It never returns or stores authentication tokens.'});
  if (request.method === 'tools/list') return result(request.id ?? null, {tools: GITHUB_TOOL_DEFINITIONS});
  if (request.method !== 'tools/call') return error(request.id ?? null, -32601, `Method not found: ${request.method}`);
  try {
    return result(request.id ?? null, toolResult(await call(request.params?.name, request.params?.arguments ?? {})));
  } catch (cause) {
    return result(request.id ?? null, toolResult(cause instanceof Error ? cause.message : String(cause), true));
  }
}
