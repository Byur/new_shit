import { createApp } from './app';
import { config } from './env';
const app = createApp(config);
const server = Bun.serve({ hostname: '127.0.0.1', port: config.port, fetch: app.fetch, idleTimeout: 40 });
console.log(`Clef API: http://127.0.0.1:${server.port} · credentials ${config.accountId && config.token ? 'configured' : 'missing'}`);
