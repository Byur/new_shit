import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {handleMcpRequest, TOOL_DEFINITIONS} from '../src/mcp.ts';
import {importWorkspace, initDatabase, openDatabase} from '../src/lib.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'context-hub-mcp-'));
const source = path.join(root, 'workspace');
const dbPath = path.join(root, 'data', 'context-hub.sqlite');
await mkdir(source, {recursive: true});
await writeFile(path.join(source, 'ai-tech-deepread-2026-08-05.html'), '<title>Demo</title><h1>主线</h1><h2>章节</h2><p>内容</p><a href="https://openai.com/test">来源</a>');
await writeFile(path.join(source, 'ai-trending-2026-08-05.html'), '<title>Trend</title><h1>趋势</h1><h2>项目</h2><p>内容</p><a href="https://github.com/example/repo">Example Repo</a>');
await writeFile(path.join(root, 'memory.md'), '- OpenAI, 2026-08-05, `Demo`, https://openai.com/test\n');
await initDatabase(dbPath);
await importWorkspace({sourceDir: source, memoryPath: path.join(root, 'memory.md'), dbPath, workspaceSlug: 'ai', kind: 'deepread'});
await importWorkspace({sourceDir: source, dbPath, workspaceSlug: 'ai-trending', kind: 'trending'});

test('MCP advertises deterministic tools and discovery', async () => {
  const response = await handleMcpRequest({jsonrpc: '2.0', id: 1, method: 'tools/list'}, {dbPath});
  assert.equal(response.result.tools.length, TOOL_DEFINITIONS.length);
  assert.deepEqual(response.result.tools.map((tool) => tool.name), TOOL_DEFINITIONS.map((tool) => tool.name));
  assert.equal(response.result.tools.some((tool) => tool.name === 'context_hub_export_fixed_report'), false);
  const discovery = await handleMcpRequest({jsonrpc: '2.0', id: 2, method: 'server/discover'}, {dbPath});
  assert.ok(discovery.result.protocolVersions.includes('2026-07-28'));
});

test('MCP returns compact context and structured report search', async () => {
  const context = await handleMcpRequest({jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'context_hub_get_compact_context', arguments: {workspace: 'ai', limit: 5}}}, {dbPath});
  assert.match(context.result.content[0].text, /Known sources/);
  const reports = await handleMcpRequest({jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'context_hub_search_reports', arguments: {workspace: 'ai', query: 'Demo'}}}, {dbPath});
  assert.match(reports.result.content[0].text, /Demo/);
  assert.doesNotMatch(reports.result.content[0].text, /content_json/);
});

test('MCP checks trending candidates against a bounded dedup window', async () => {
  const response = await handleMcpRequest({jsonrpc: '2.0', id: 6, method: 'tools/call', params: {name: 'context_hub_check_sources', arguments: {
    candidates: [
      {url: 'https://github.com/example/repo/', title: 'Example Repo'},
      {url: 'https://github.com/fork/repo', title: 'Example Repo'},
      {url: 'https://github.com/new/project', title: 'New Project'},
    ],
    asOf: '2026-08-20',
    windowDays: 60,
  }}}, {dbPath});
  const checked = JSON.parse(response.result.content[0].text);
  assert.equal(checked.workspace, 'ai-trending');
  assert.equal(checked.results[0].eligible, false);
  assert.deepEqual(checked.results[0].reasons, ['url', 'title']);
  assert.equal(checked.results[0].latestSeenReportDate, '2026-08-05');
  assert.equal(checked.results[1].eligible, false);
  assert.deepEqual(checked.results[1].reasons, ['title']);
  assert.equal(checked.results[2].eligible, true);
});

test('MCP keeps report links authoritative when an item dedup row was removed', async () => {
  const db = openDatabase(dbPath);
  const workspaceId = db.prepare("select id from workspaces where slug = 'ai-trending'").get().id;
  db.prepare('delete from items where workspace_id = ? and url = ?').run(workspaceId, 'https://github.com/example/repo');
  db.close();

  const response = await handleMcpRequest({jsonrpc: '2.0', id: 7, method: 'tools/call', params: {name: 'context_hub_check_sources', arguments: {
    candidates: [{url: 'https://github.com/example/repo', title: 'Example Repo'}],
    asOf: '2026-08-20',
    windowDays: 60,
  }}}, {dbPath});
  const checked = JSON.parse(response.result.content[0].text);
  assert.equal(checked.results[0].eligible, false);
  assert.deepEqual(checked.results[0].reasons, ['url', 'title']);
  assert.equal(checked.results[0].latestSeenReportDate, '2026-08-05');
});

test('MCP exposes tool failures as isError results', async () => {
  const response = await handleMcpRequest({jsonrpc: '2.0', id: 5, method: 'tools/call', params: {name: 'context_hub_get_report', arguments: {workspace: 'ai', reportId: 'missing'}}}, {dbPath});
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /report not found/);
});
