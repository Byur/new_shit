import {createServer} from 'node:http';
import type {ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {DEFAULT_DB_PATH, compactPrompt, getOverview, initDatabase, listItems, listReports, openDatabase, workspaceIdFor} from './lib.ts';

const port = Number(process.env.CONTEXT_HUB_PORT || 4321);
const publicDir = path.resolve(new URL('../public', import.meta.url).pathname);
const dbPath = process.env.CONTEXT_HUB_DB ? path.resolve(process.env.CONTEXT_HUB_DB) : DEFAULT_DB_PATH;
await initDatabase(dbPath);
const db = openDatabase(dbPath);
const workspaceId = workspaceIdFor(db, process.env.CONTEXT_HUB_WORKSPACE || 'ai');

const mime = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml'};
function sendJson(response: ServerResponse, payload: unknown, status = 200): void {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  response.end(JSON.stringify(payload));
}
async function sendFile(response: ServerResponse, filePath: string): Promise<void> {
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {'content-type': mime[path.extname(filePath)] || 'application/octet-stream'});
    response.end(content);
  } catch {
    sendJson(response, {error: 'Not found'}, 404);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (!workspaceId) return sendJson(response, {error: 'No workspace imported yet. Run npm run import -- --source ...'}, 503);
  if (url.pathname === '/api/overview') return sendJson(response, getOverview(db, workspaceId));
  if (url.pathname === '/api/reports') return sendJson(response, listReports(db, workspaceId, url.searchParams.get('q') || ''));
  if (url.pathname === '/api/items') return sendJson(response, listItems(db, workspaceId, url.searchParams.get('q') || ''));
  if (url.pathname === '/api/prompt') return sendJson(response, {workspace: process.env.CONTEXT_HUB_WORKSPACE || 'ai', prompt: compactPrompt(db, workspaceId, Number(url.searchParams.get('limit') || 80))});
  if (url.pathname === '/api/workspaces') return sendJson(response, db.prepare('SELECT id, slug, name, source_path, status, schedule FROM workspaces ORDER BY updated_at DESC').all());
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return sendJson(response, {error: 'Forbidden'}, 403);
  return sendFile(response, filePath);
});

server.listen(port, '127.0.0.1', () => console.log(`Context Hub dashboard: http://127.0.0.1:${port}`));
process.on('SIGINT', () => {db.close(); server.close();});
