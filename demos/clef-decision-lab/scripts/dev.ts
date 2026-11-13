import { config } from '../apps/server/src/env';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
// Do not pass Cloudflare credentials to the Vite child process.
const webEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLOUDFLARE_')));
const children = [
  Bun.spawn(['bun', '--watch', 'apps/server/src/index.ts'], { cwd: root, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
  Bun.spawn(['bun', '--no-env-file', 'run', 'web'], { cwd: root, env: { ...webEnv, LAB_API_PORT: String(config.port) }, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
];
const stop = () => children.forEach(child => child.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
await Promise.race(children.map(child => child.exited));
stop();
