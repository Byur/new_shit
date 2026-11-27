import {createServer} from 'node:http';
import type {Server, ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {handleAutomationRoute} from './automation/routes.ts';
import type {AutomationRouteContext} from './automation/routes.ts';
import {loadEnvFiles} from './env-file.ts';
import {DEFAULT_DB_PATH, compactPrompt, getOverview, initDatabase, listItems, listReports, openDatabase, workspaceIdFor} from './lib.ts';

export interface DashboardServerOptions {
  port?: number;
  host?: string;
  dbPath?: string;
  db?: DatabaseSync;
  workspaceSlug?: string;
  publicDir?: string;
  automation?: AutomationRouteContext;
}

export interface DashboardServerHandle {
  server: Server;
  port: number;
  listen: () => Promise<number>;
  close: () => Promise<void>;
}

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

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

export function createDashboardServer(options: DashboardServerOptions = {}): DashboardServerHandle {
  const port = options.port ?? Number(process.env.CONTEXT_HUB_PORT || 4321);
  const host = options.host ?? '127.0.0.1';
  const publicDir = options.publicDir ?? path.resolve(new URL('../public', import.meta.url).pathname);
  const dbPath = options.dbPath ? path.resolve(options.dbPath) : DEFAULT_DB_PATH;
  const ownsDb = !options.db;
  const db = options.db ?? openDatabase(dbPath);
  const workspaceSlug = options.workspaceSlug || process.env.CONTEXT_HUB_WORKSPACE || 'ai';

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    // Health check & automation APIs MUST bypass the workspaceId guard (work even on an empty DB).
    if (url.pathname === '/healthz') {
      return sendJson(response, {ok: true, service: 'context-hub', pid: process.pid, now: new Date().toISOString()});
    }

    if (url.pathname.startsWith('/api/automation/')) {
      if (!options.automation) {
        return sendJson(response, {error: 'Automation scheduler is not active in standalone dashboard mode; run npm run serve'}, 503);
      }
      await handleAutomationRoute(request, response, url, options.automation);
      return;
    }

    if (url.pathname === '/automation' || url.pathname === '/automation/' || url.pathname === '/automation.html') {
      return sendFile(response, path.join(publicDir, 'automation.html'));
    }
    if (url.pathname === '/automation.js' || url.pathname === '/styles.css') {
      return sendFile(response, path.join(publicDir, url.pathname.slice(1)));
    }

    if (url.pathname.startsWith('/api/')) {
      const workspaceId = workspaceIdFor(db, workspaceSlug);
      if (!workspaceId) return sendJson(response, {error: 'No workspace imported yet. Run npm run import -- --source ...'}, 503);
      if (url.pathname === '/api/overview') return sendJson(response, getOverview(db, workspaceId));
      if (url.pathname === '/api/reports') return sendJson(response, listReports(db, workspaceId, url.searchParams.get('q') || ''));
      if (url.pathname === '/api/items') return sendJson(response, listItems(db, workspaceId, url.searchParams.get('q') || ''));
      if (url.pathname === '/api/prompt') {
        return sendJson(response, {workspace: workspaceSlug, prompt: compactPrompt(db, workspaceId, Number(url.searchParams.get('limit') || 80))});
      }
      if (url.pathname === '/api/workspaces') {
        return sendJson(response, db.prepare('SELECT id, slug, name, source_path, status, schedule FROM workspaces ORDER BY updated_at DESC').all());
      }
      return sendJson(response, {error: 'Not found'}, 404);
    }

    const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
    const filePath = path.resolve(publicDir, relative);
    if (!filePath.startsWith(publicDir)) return sendJson(response, {error: 'Forbidden'}, 403);
    return sendFile(response, filePath);
  });

  function listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        const address = server.address();
        resolve(typeof address === 'object' && address ? address.port : port);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });
  }

  function close(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        if (ownsDb) db.close();
        resolve();
      };
      if (!server.listening) return done();
      server.close(() => done());
    });
  }

  return {server, port, listen, close};
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  await loadEnvFiles({info: (message) => console.log(message), warn: (message) => console.warn(message)});
  const dbPath = process.env.CONTEXT_HUB_DB ? path.resolve(process.env.CONTEXT_HUB_DB) : DEFAULT_DB_PATH;
  await initDatabase(dbPath);
  const handle = createDashboardServer({dbPath});
  await handle.listen();
  console.log(`Context Hub dashboard: http://127.0.0.1:${handle.port}`);
  const shutdown = () => {
    void handle.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
