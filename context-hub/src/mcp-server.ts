import {createServer} from 'node:http';
import type {IncomingMessage, Server, ServerResponse} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {DatabaseSync} from 'node:sqlite';
import {loadEnvFiles} from './env-file.ts';
import {DEFAULT_DB_PATH, initDatabase} from './lib.ts';
import {handleMcpRequest} from './mcp.ts';
import {handleGithubMcpRequest} from './github-mcp.ts';

export interface McpServerOptions {
  port?: number;
  host?: string;
  dbPath?: string;
  db?: DatabaseSync;
  maxBodyBytes?: number;
}

export interface McpServerHandle {
  server: Server;
  port: number;
  listen: () => Promise<number>;
  close: () => Promise<void>;
}

function headers(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name');
  response.setHeader('access-control-expose-headers', 'MCP-Protocol-Version');
}

function sendJson(response: ServerResponse, payload: unknown, status = 200): void {
  headers(response);
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  response.end(JSON.stringify(payload));
}

function readBody(request: IncomingMessage, maxBodyBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBodyBytes) {
        reject(new Error('request body too large'));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

export function createMcpServer(options: McpServerOptions = {}): McpServerHandle {
  const port = options.port ?? Number(process.env.CONTEXT_HUB_MCP_PORT || 7777);
  const host = options.host ?? '127.0.0.1';
  const dbPath = options.dbPath ? path.resolve(options.dbPath) : DEFAULT_DB_PATH;
  const maxBodyBytes = options.maxBodyBytes ?? 2 * 1024 * 1024;

  const server = createServer(async (request, response) => {
    headers(response);
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const handler = requestUrl.pathname === '/mcp' ? handleMcpRequest : requestUrl.pathname === '/github/mcp' ? handleGithubMcpRequest : null;
    if (!handler) return sendJson(response, {error: 'MCP endpoints are /mcp and /github/mcp'}, 404);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === 'GET') {
      response.writeHead(405, {allow: 'POST, OPTIONS'});
      response.end();
      return;
    }
    if (request.method !== 'POST') return sendJson(response, {error: 'Use POST /mcp'}, 405);
    let payload: any;
    try {
      payload = JSON.parse(await readBody(request, maxBodyBytes));
    } catch (error) {
      return sendJson(response, {jsonrpc: '2.0', id: null, error: {code: -32700, message: error instanceof SyntaxError ? 'Parse error' : (error as Error).message}}, 400);
    }
    const result = requestUrl.pathname === '/mcp'
      ? await handleMcpRequest(payload, {dbPath, db: options.db, headers: request.headers as Record<string, string | undefined>})
      : await handler(payload);
    if (result === null || (Array.isArray(result) && result.length === 0)) {
      response.writeHead(202);
      response.end();
      return;
    }
    const protocolVersion = request.headers['mcp-protocol-version'] || payload?.params?.protocolVersion;
    if (protocolVersion) response.setHeader('MCP-Protocol-Version', String(protocolVersion));
    sendJson(response, result);
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
      if (!server.listening) return resolve();
      server.close(() => resolve());
    });
  }

  return {server, port, listen, close};
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  await loadEnvFiles({info: (message) => console.log(message), warn: (message) => console.warn(message)});
  const dbPath = process.env.CONTEXT_HUB_DB ? path.resolve(process.env.CONTEXT_HUB_DB) : DEFAULT_DB_PATH;
  await initDatabase(dbPath);
  const handle = createMcpServer({dbPath});
  handle.server.on('error', (error) => {
    console.error(`Context Hub MCP server error: ${error.message}`);
    process.exitCode = 1;
  });
  await handle.listen();
  console.log(`Context Hub MCP server: http://127.0.0.1:${handle.port}/mcp (GitHub CLI data: /github/mcp)`);
  const shutdown = () => {
    void handle.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
