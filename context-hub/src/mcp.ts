import path from 'node:path';
import {DEFAULT_DB_PATH, compactPrompt, getOverview, importWorkspace, listItems, listReports, openDatabase, workspaceIdFor, writeFixedReport} from './lib.ts';

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
export const SERVER_INFO = {name: 'context-hub', version: '0.2.0'};

const readOnly = {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false};
const writesLocalData = {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false};

export const TOOL_DEFINITIONS = [
  {
    name: 'context_hub_list_workspaces',
    description: 'List locally imported scheduled-task workspaces and their compact-memory paths.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_overview',
    description: 'Return counts, recent runs, recent reports, and memory-size metadata for one workspace.',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai'}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_get_compact_context',
    description: 'Return the minimal prompt-safe context for a workspace. Prefer this over reading raw memory or historical HTML.',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai'}, limit: {type: 'integer', minimum: 1, maximum: 500, default: 80}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_search_reports',
    description: 'Search normalized report metadata and summaries without loading original HTML.',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai'}, query: {type: 'string', default: ''}, limit: {type: 'integer', minimum: 1, maximum: 100, default: 20}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_search_sources',
    description: 'Search the permanent URL/title dedup index for a workspace.',
    inputSchema: {type: 'object', properties: {workspace: {type: 'string', default: 'ai'}, query: {type: 'string', default: ''}, limit: {type: 'integer', minimum: 1, maximum: 200, default: 40}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_get_report',
    description: 'Read one normalized report record. Full structured content is opt-in; raw source HTML is never returned by default.',
    inputSchema: {type: 'object', required: ['reportId'], properties: {workspace: {type: 'string', default: 'ai'}, reportId: {type: 'string'}, includeContent: {type: 'boolean', default: false}}, additionalProperties: false},
    annotations: readOnly,
  },
  {
    name: 'context_hub_sync_workspace',
    description: 'Import local HTML reports and automation memory into SQLite, update dedup items, compact memory, and fixed report samples.',
    inputSchema: {type: 'object', required: ['sourcePath', 'workspace', 'kind'], properties: {sourcePath: {type: 'string', description: 'Local report workspace directory'}, memoryPath: {type: 'string', description: 'Local automation memory.md path'}, workspace: {type: 'string', enum: ['ai', 'ai-trending']}, kind: {type: 'string', enum: ['deepread', 'trending', 'all']}, dbPath: {type: 'string'}}, additionalProperties: false},
    annotations: writesLocalData,
  },
  {
    name: 'context_hub_export_fixed_report',
    description: 'Render one normalized report through the fixed self-contained HTML template.',
    inputSchema: {type: 'object', required: ['reportId'], properties: {workspace: {type: 'string', default: 'ai'}, reportId: {type: 'string'}, outputPath: {type: 'string'}}, additionalProperties: false},
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
    const workspaceId = workspaceOrThrow(db, input.workspace || 'ai');
    if (name === 'context_hub_overview') return getOverview(db, workspaceId);
    if (name === 'context_hub_get_compact_context') {
      const limit = boundedInt(input.limit, 80, 500);
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
    if (name === 'context_hub_get_report') return getReport(db, workspaceId, input.reportId, input.includeContent === true);
    if (name === 'context_hub_export_fixed_report') {
      const report = getReport(db, workspaceId, input.reportId, true);
    const resolvedDbPath = input.dbPath ? path.resolve(input.dbPath) : dbPath;
    const outputPath = input.outputPath
        ? path.resolve(input.outputPath)
        : path.join(path.dirname(resolvedDbPath), 'reports', `${path.basename(report.sourcePath, '.html')}.fixed.html`);
      const written = await writeFixedReport({...report, content: report.content}, outputPath);
      return {written, reportId: report.id, title: report.title, reportDate: report.reportDate};
    }
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
