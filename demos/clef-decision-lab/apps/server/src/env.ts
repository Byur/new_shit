import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const root = resolve(import.meta.dir, '../../..');
const read = (path: string) => existsSync(path) ? parse(readFileSync(path)) : {};
// Only server code imports this module. Never expose the account/token through /health.
const values = { ...read(resolve(root, '../../.env')), ...read(resolve(root, '.env')), ...process.env };
export const config = {
  accountId: values.CLOUDFLARE_ACCOUNT_ID || '',
  token: values.CLOUDFLARE_AUTH_TOKEN || '',
  port: Number(values.PORT || 3000),
};
