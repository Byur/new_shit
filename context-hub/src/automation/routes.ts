import type {IncomingMessage, ServerResponse} from 'node:http';
import type {AutomationScheduler} from './scheduler.ts';
import type {TaskId} from './types.ts';

function sendJson(response: ServerResponse, payload: unknown, status = 200): void {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  response.end(JSON.stringify(payload));
}

function readJsonBody(request: IncomingMessage, maxBytes = 256 * 1024): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        // 413 而不是 400：调用方要能区分「body 太大」和「JSON 语法错」。
        reject(Object.assign(new Error('request body too large'), {status: 413}));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function isAuthorized(request: IncomingMessage, expectedToken: string): boolean {
  if (!expectedToken) return false;
  const header = request.headers['x-automation-token'];
  const actual = Array.isArray(header) ? header[0] : header;
  return typeof actual === 'string' && actual === expectedToken;
}

export interface AutomationRouteContext {
  scheduler: AutomationScheduler;
  getToken?: () => string;
}

export async function handleAutomationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: AutomationRouteContext,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/automation/')) {
    return false;
  }

  const {scheduler} = context;
  const expectedToken = (context.getToken?.() ?? process.env.CONTEXT_HUB_AUTOMATION_TOKEN ?? '').trim();

  // GET 是只读的，且 Dashboard 页面直接用同源 fetch 读取，所以不加 token；
  // 写入（POST）必须带 X-Automation-Token。服务默认只绑 127.0.0.1，
  // 这个不对称是有意为之：不要把只读接口也锁上，否则页面要自己保管密钥。
  if (request.method === 'GET' && url.pathname === '/api/automation/status') {
    sendJson(response, await scheduler.getStatusSnapshot());
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/automation/runs') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 30)));
    sendJson(response, {runs: scheduler.listRuns(limit)});
    return true;
  }

  const logMatch = /^\/api\/automation\/runs\/([^/]+)\/logs$/.exec(url.pathname);
  if (request.method === 'GET' && logMatch) {
    const runKey = decodeURIComponent(logMatch[1]);
    const logs = await scheduler.getRunLogs(runKey);
    if (!logs) {
      sendJson(response, {error: `run not found: ${runKey}`}, 404);
      return true;
    }
    sendJson(response, logs);
    return true;
  }

  if (request.method === 'POST') {
    if (!expectedToken) {
      sendJson(response, {error: 'CONTEXT_HUB_AUTOMATION_TOKEN is not configured'}, 503);
      return true;
    }
    if (!isAuthorized(request, expectedToken)) {
      sendJson(response, {error: 'Unauthorized: invalid X-Automation-Token'}, 401);
      return true;
    }

    let body: Record<string, any>;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const status = (error as {status?: unknown}).status;
      sendJson(response, {error: (error as Error).message}, status === 413 ? 413 : 400);
      return true;
    }

    try {
      if (url.pathname === '/api/automation/run') {
        const taskId = String(body.task || '') as TaskId;
        const result = await scheduler.triggerManualRun(taskId, {
          dryRun: body.dryRun === true,
          // 默认顺流：手动跑一次应当能走完 A→B→C；要只跑一环就显式 follow:false。
          follow: body.follow !== false,
        });
        sendJson(response, result);
        return true;
      }
      if (url.pathname === '/api/automation/pause') {
        const taskId = String(body.task || '') as TaskId;
        sendJson(response, scheduler.pauseTask(taskId, String(body.reason || 'manual pause'), body.kill === true));
        return true;
      }
      if (url.pathname === '/api/automation/resume') {
        const taskId = String(body.task || '') as TaskId;
        sendJson(response, scheduler.resumeTask(taskId));
        return true;
      }
      if (url.pathname === '/api/automation/retry') {
        const runKey = String(body.runKey || body.runId || '');
        sendJson(response, await scheduler.retryRun(runKey));
        return true;
      }
      if (url.pathname === '/api/automation/doctor') {
        sendJson(
          response,
          await scheduler.runDoctor({
            liveImageCheck: body.liveImageCheck === true,
            feishuTest: body.feishuTest === true,
          }),
        );
        return true;
      }
    } catch (error) {
      sendJson(response, {error: (error as Error).message}, 400);
      return true;
    }
  }

  sendJson(response, {error: 'Method or route not allowed'}, 405);
  return true;
}
