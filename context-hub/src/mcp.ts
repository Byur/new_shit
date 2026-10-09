import path from 'node:path';
import {DEFAULT_DB_PATH, checkSources, compactPrompt, getOverview, importWorkspace, listItems, listReports, openDatabase, workspaceIdFor} from './lib.ts';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
};

type McpResponse = Record<string, any> | Record<string, any>[] | null;
type McpOptions = {dbPath?: string; headers?: Record<string, string | undefined>};

export const LEGACY_PROTOCOL_VERSION = '2025-11-25';
export const MODERN_PROTOCOL_VERSION = '2026-07-28';
export const SERVER_INFO = {name: 'context-hub', version: '0.3.0'};

const readOnly = {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false};
const writesLocalData = {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false};

export const TOOL_DEFINITIONS = [
  {
    name: 'context_hub_list_workspaces',
    description: '列出已导入的定时任务工作区及其源目录、automation、memory 和 compact context 路径。',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_overview',
    description: '返回一个工作区的运行数、报告数、来源数、最近报告和 memory/compact metadata；不读取报告正文。',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai', description: '工作区 slug，例如 ai 或 ai-trending。'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_get_compact_context',
    description: '返回工作区的最小可注入上下文，包括近期报告指针和有限来源索引；不要用它替代完整 memory 或历史 HTML。',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai', description: '工作区 slug，例如 ai 或 ai-trending。'}, limit: {type: 'integer', minimum: 1, maximum: 100, default: 20, description: '返回的近期来源条数上限。'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_search_reports',
    description: '按标题、类型或日期搜索报告 metadata/summary；不加载原始 HTML，适合定位单份历史报告。',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai', description: '工作区 slug。'}, query: {type: 'string', default: '', description: '匹配标题、报告类型或日期的关键词；留空返回最近报告。'}, limit: {type: 'integer', minimum: 1, maximum: 100, default: 20, description: '返回结果数量上限。'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_search_sources',
    description: '在工作区的永久 URL/title 来源索引中搜索来源；索引同时包含报告链接和序列化来源记录，返回 metadata，不读取报告正文。',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai', description: '工作区 slug。'}, query: {type: 'string', default: '', description: '匹配来源标题、URL 或 provider 的关键词；留空返回最近来源。'}, limit: {type: 'integer', minimum: 1, maximum: 200, default: 40, description: '返回结果数量上限。'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_check_sources',
    description: '批量检查候选 URL/title 是否在工作区排重窗口内出现；报告链接和序列化来源记录都属于权威历史，任一在窗口内匹配都会返回 eligible=false。返回 eligible、匹配记录、最近出现日期和 nextEligibleOn，不返回报告正文。',
    inputSchema: {type: 'object', required: ['candidates'], properties: {workspace: {type: 'string', default: 'ai-trending', description: '用于排重的工作区 slug。'}, candidates: {type: 'array', minItems: 1, maxItems: 50, description: '待检查候选；每项必须有 URL，可选标题用于标准化标题匹配。', items: {type: 'object', required: ['url'], properties: {url: {type: 'string', description: '候选来源的规范 URL。'}, title: {type: 'string', description: '候选标题；可选，用于 URL 不同但标题相同的匹配。'}}, additionalProperties: false}}, windowDays: {type: 'integer', minimum: 1, maximum: 366, default: 60, description: '向当前日期回看的排重天数。'}, asOf: {type: 'string', description: '可选的核验日期，格式 YYYY-MM-DD；省略时使用当前 Asia/Shanghai 日期。'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_get_report',
    description: '读取一份已索引报告的 metadata；仅在 includeContent=true 时返回解析后的结构化内容，默认不返回原始 HTML。',
    inputSchema: {type: 'object', required: ['reportId'], properties: {workspace: {type: 'string', default: 'ai', description: '报告所属工作区 slug。'}, reportId: {type: 'string', description: 'context_hub_search_reports 或 overview 返回的报告 ID。'}, includeContent: {type: 'boolean', default: false, description: '是否附带解析后的结构化正文；只为复盘单份报告时开启。'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_sync_workspace',
    description: '将 Agent 生成的 HTML 和 automation memory 导入 SQLite，幂等更新报告/来源索引，并重写 compact memory 指针；不渲染或修改 HTML。',
    inputSchema: {type: 'object', required: ['sourcePath', 'workspace', 'kind'], properties: {sourcePath: {type: 'string', description: '包含报告 HTML 的本地工作区目录。'}, memoryPath: {type: 'string', description: 'automation memory.md 的本地路径；可选。'}, workspace: {type: 'string', enum: ['ai', 'ai-trending'], description: '目标工作区 slug。'}, kind: {type: 'string', enum: ['deepread', 'trending', 'all'], description: '导入类型；决定报告解析和索引范围。'}, dbPath: {type: 'string', description: 'SQLite 文件绝对路径；省略时使用服务默认数据库。'}}, additionalProperties: false},
    annotations: writesLocalData,
  },
];

function jsonResult(id: JsonRpcRequest['id'], result: any): Record<string, any> {
  return {jsonrpc: '2.0', id, result};
}

function jsonError(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown): Record<string, any> {
  return {jsonrpc: '2.0', id, error: {code, message, ...(data === undefined ? {} : {data})}};
}

function textToolResult(value: unknown, isError = false): Record<string, any> {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return {content: [{type: 'text', text}], ...(isError ? {isError: true} : {})};
}

function workspaceOrThrow(db: any, slug: string = 'ai'): string {
  const id = workspaceIdFor(db, slug);
  if (!id) throw new Error(`workspace not found: ${slug}; sync it first`);
  return id;
}

function boundedInt(value: unknown, fallback: number, maximum: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, maximum);
}

function getReport(db: any, workspaceId: string, reportId: string, includeContent: boolean): Record<string, any> {
  const row = db.prepare(`SELECT id, workspace_id, kind, source_path, title, report_date, content_json, sha256, created_at, updated_at
    FROM documents WHERE id = ? AND workspace_id = ?`).get(reportId, workspaceId);
  if (!row) throw new Error(`report not found: ${reportId}`);
  const result = {id: row.id, workspaceId: row.workspace_id, kind: row.kind, sourcePath: row.source_path, title: row.title, reportDate: row.report_date, sha256: row.sha256, createdAt: row.created_at, updatedAt: row.updated_at};
  if (includeContent) result.content = JSON.parse(row.content_json || '{}');
  return result;
}

async function callTool(name: string, args: Record<string, any>, {dbPath = DEFAULT_DB_PATH}: McpOptions = {}): Promise<any> {
  const input = args && typeof args === 'object' ? args : {};
  if (name === 'context_hub_sync_workspace') {
    if (!input.sourcePath || !input.workspace || !input.kind) throw new Error('sourcePath, workspace, and kind are required');
    return importWorkspace({
      sourceDir: path.resolve(input.sourcePath),
      memoryPath: input.memoryPath ? path.resolve(input.memoryPath) : undefined,
      dbPath: input.dbPath ? path.resolve(input.dbPath) : dbPath,
      workspaceSlug: input.workspace,
      kind: input.kind,
    });
  }

  const db = openDatabase(input.dbPath ? path.resolve(input.dbPath) : dbPath);
  try {
    if (name === 'context_hub_list_workspaces') {
      return db.prepare(`SELECT id, slug, name, source_path AS sourcePath, automation_id AS automationId, status, schedule, memory_path AS memoryPath
        FROM workspaces ORDER BY updated_at DESC`).all();
    }
    const workspaceSlug = name === 'context_hub_check_sources' ? input.workspace || 'ai-trending' : input.workspace || 'ai';
    const workspaceId = workspaceOrThrow(db, workspaceSlug);
    if (name === 'context_hub_overview') return getOverview(db, workspaceId);
    if (name === 'context_hub_get_compact_context') {
      const limit = boundedInt(input.limit, 20, 100);
      const snapshot = db.prepare(`SELECT source_path AS sourcePath, source_chars AS sourceChars, item_count AS itemCount,
        compact_path AS compactPath, compact_sha256 AS compactSha256, created_at AS createdAt
        FROM memory_snapshots WHERE workspace_id = ? LIMIT 1`).get(workspaceId) ?? null;
      return {workspace: input.workspace || 'ai', snapshot, prompt: compactPrompt(db, workspaceId, limit)};
    }
    if (name === 'context_hub_search_reports') {
      const results = listReports(db, workspaceId, String(input.query || ''));
      return {workspace: input.workspace || 'ai', results: results.slice(0, boundedInt(input.limit, 20, 100))};
    }
    if (name === 'context_hub_search_sources') {
      const results = listItems(db, workspaceId, String(input.query || ''));
      return {workspace: input.workspace || 'ai', results: results.slice(0, boundedInt(input.limit, 40, 200))};
    }
    if (name === 'context_hub_check_sources') {
      const candidates = Array.isArray(input.candidates) ? input.candidates : [];
      if (!candidates.length) throw new Error('candidates must contain at least one URL');
      if (candidates.length > 50) throw new Error('candidates cannot contain more than 50 entries');
      return {workspace: workspaceSlug, ...checkSources(db, workspaceId, candidates, input.windowDays, input.asOf)};
    }
    if (name === 'context_hub_get_report') return getReport(db, workspaceId, input.reportId, input.includeContent === true);
    throw new Error(`unknown tool: ${name}`);
  } finally {
    db.close();
  }
}

function negotiatedProtocol(request: JsonRpcRequest): string {
  const requested = request?.params?.protocolVersion;
  if (requested === MODERN_PROTOCOL_VERSION || requested === LEGACY_PROTOCOL_VERSION) return requested;
  return LEGACY_PROTOCOL_VERSION;
}

function validateHeaders(request: JsonRpcRequest, headers: Record<string, string | undefined> = {}): void {
  const methodHeader = headers['mcp-method'];
  if (methodHeader && methodHeader !== request.method) throw new Error(`Mcp-Method header does not match ${request.method}`);
  if (headers['mcp-name']) {
    const expected = request.method === 'tools/call' ? request.params?.name : request.params?.uri;
    if (expected && headers['mcp-name'] !== expected) throw new Error('Mcp-Name header does not match request target');
  }
  const version = headers['mcp-protocol-version'];
  if (version && ![LEGACY_PROTOCOL_VERSION, MODERN_PROTOCOL_VERSION].includes(version)) throw new Error(`unsupported MCP protocol version: ${version}`);
}

export async function handleMcpRequest(request: JsonRpcRequest | JsonRpcRequest[] | unknown, options: McpOptions = {}): Promise<McpResponse> {
  if (Array.isArray(request)) {
    const responses = [];
    for (const entry of request) {
      const response = await handleMcpRequest(entry, options);
      if (response !== null) responses.push(response);
    }
    return responses;
  }
  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return jsonError(request?.id ?? null, -32600, 'Invalid JSON-RPC request');
  try {
    validateHeaders(request, options.headers);
    if (request.method === 'notifications/initialized' || request.method === 'notifications/cancelled') return null;
    if (request.method === 'ping') return jsonResult(request.id ?? null, {});
    if (request.method === 'server/discover') return jsonResult(request.id ?? null, {protocolVersions: [MODERN_PROTOCOL_VERSION, LEGACY_PROTOCOL_VERSION], serverInfo: SERVER_INFO, capabilities: {tools: {listChanged: false}}});
    if (request.method === 'initialize') return jsonResult(request.id ?? null, {protocolVersion: negotiatedProtocol(request), capabilities: {tools: {listChanged: false}}, serverInfo: SERVER_INFO, instructions: 'Use context_hub_get_compact_context before reading historical reports.'});
    if (request.method === 'tools/list') return jsonResult(request.id ?? null, {tools: TOOL_DEFINITIONS});
    if (request.method === 'tools/call') {
      const name = request.params?.name;
      const result = await callTool(name, request.params?.arguments ?? {}, options);
      return jsonResult(request.id ?? null, textToolResult(result));
    }
    return jsonError(request.id ?? null, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    if (request.method === 'tools/call') return jsonResult(request.id ?? null, textToolResult(error instanceof Error ? error.message : String(error), true));
    return jsonError(request.id ?? null, -32602, error instanceof Error ? error.message : String(error));
  }
}
