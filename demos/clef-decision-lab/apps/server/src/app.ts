import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { parseRequest, describeError } from '../../../packages/shared/src/schema';
import { ProviderError, runCloudflare } from './providers/cloudflare';

export function createApp(credentials: { accountId: string; token: string }, options: Parameters<typeof runCloudflare>[2] = {}) {
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    // Local only. Reject cross-origin writes, including hostile pages targeting localhost.
    const origin = c.req.header('Origin');
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):(5173|3000)$/.test(origin)) {
      return c.json({ error: { code: 'FORBIDDEN_ORIGIN', message: '仅允许本地实验台调用。' } }, 403);
    }
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 256 * 1024, onError: c => c.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: '请求不能超过 256 KiB。' } }, 413) }));
  app.get('/api/health', c => c.json({ ready: Boolean(credentials.accountId && credentials.token), provider: 'Cloudflare Workers AI', timeoutMs: 30000 }));
  app.post('/api/decisions/run', async c => {
    let input;
    try { input = parseRequest(await c.req.text()); } catch (error) {
      return c.json({ error: { code: 'INVALID_INPUT', message: describeError(error) } }, 400);
    }
    try {
      return c.json(await runCloudflare(input, credentials, { ...options, signal: c.req.raw.signal }));
    } catch (error) {
      const safe = error instanceof ProviderError ? error : new ProviderError('INTERNAL_ERROR', '本地代理出现错误，请重试。', 500);
      return new Response(JSON.stringify({ error: safe.toJSON() }), { status: safe.status, headers: { 'Content-Type': 'application/json' } });
    }
  });
  app.notFound(c => c.json({ error: { code: 'NOT_FOUND', message: '接口不存在。' } }, 404));
  return app;
}
