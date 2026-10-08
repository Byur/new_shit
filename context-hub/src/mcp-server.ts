import {createServer} from 'node:http';
import type {IncomingMessage, ServerResponse} from 'node:http';
import path from 'node:path';
import {DEFAULT_DB_PATH, initDatabase} from './lib.ts';
import {handleMcpRequest} from './mcp.ts';

const port = Number(process.env.CONTEXT_HUB_MCP_PORT || 7777);
const dbPath = process.env.CONTEXT_HUB_DB ? path.resolve(process.env.CONTEXT_HUB_DB) : DEFAULT_DB_PATH;
const maxBodyBytes = 2 * 1024 * 1024;

await initDatabase(dbPath);

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

function readBody(request: IncomingMessage): Promise<string> {
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

const server = createServer(async (request, response) => {
  headers(response);
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (requestUrl.pathname !== '/mcp') return sendJson(response, {error: 'MCP endpoint is /mcp'}, 404);
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
    payload = JSON.parse(await readBody(request));
  } catch (error) {
    return sendJson(response, {jsonrpc: '2.0', id: null, error: {code: -32700, message: error instanceof SyntaxError ? 'Parse error' : error.message}}, 400);
  }
  const result = await handleMcpRequest(payload, {dbPath, headers: request.headers});
  if (result === null || (Array.isArray(result) && result.length === 0)) {
    response.writeHead(202);
    response.end();
    return;
  }
  const protocolVersion = request.headers['mcp-protocol-version'] || payload?.params?.protocolVersion;
  if (protocolVersion) response.setHeader('MCP-Protocol-Version', protocolVersion);
  sendJson(response, result);
});

server.on('error', (error) => {
  console.error(`Context Hub MCP server error: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => console.log(`Context Hub MCP server: http://127.0.0.1:${port}/mcp`));

function close() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
