import {execFile} from 'node:child_process';
import {access, constants, readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {ensureBridgeEndpoint} from './runner-host.ts';
import {resolveRuntime} from './runtime.ts';
import type {PreflightCheck, PreflightReport, RuntimePreference} from './types.ts';

const execFileAsync = promisify(execFile);

export const DEFAULT_DSH_CLI_PATH = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh';
export const DEFAULT_DSH_HOME = path.join(os.homedir(), '.dsh-context-hub');
export const DEFAULT_CODEX_AUTH_PATH = path.join(os.homedir(), '.codex', 'auth.json');

export interface JwtInspection {
  ok: boolean;
  expiresAt: string | null;
  detail: string;
}

export function inspectJwtExpiry(token: string, nowMs: number = Date.now()): JwtInspection {
  const parts = String(token || '').split('.');
  if (parts.length < 2) {
    return {ok: false, expiresAt: null, detail: 'access_token is not a JWT'};
  }
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const payload = JSON.parse(Buffer.from(`${normalized}${pad}`, 'base64').toString('utf8')) as {exp?: number};
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return {ok: true, expiresAt: null, detail: 'token present (no exp claim)'};
    }
    const expMs = payload.exp * 1000;
    const expiresAt = new Date(expMs).toISOString();
    if (expMs <= nowMs + 60_000) {
      return {ok: false, expiresAt, detail: `Codex token expired or expiring (${expiresAt})`};
    }
    return {ok: true, expiresAt, detail: `valid until ${expiresAt}`};
  } catch (error) {
    return {ok: false, expiresAt: null, detail: `JWT decode failed: ${(error as Error).message}`};
  }
}

export async function checkCodexAuthLocal(authPath: string = process.env.CODEX_AUTH_FILE || DEFAULT_CODEX_AUTH_PATH): Promise<PreflightCheck> {
  if (!existsSync(authPath)) {
    return {name: 'codex_auth', ok: false, level: 'P1', detail: `missing ${authPath}`};
  }
  try {
    const raw = JSON.parse(await readFile(authPath, 'utf8')) as {tokens?: {access_token?: string}};
    const token = raw?.tokens?.access_token;
    if (!token) {
      return {name: 'codex_auth', ok: false, level: 'P1', detail: `${authPath} has no access_token`};
    }
    const jwt = inspectJwtExpiry(token);
    return {name: 'codex_auth', ok: jwt.ok, level: 'P1', detail: jwt.detail};
  } catch (error) {
    return {name: 'codex_auth', ok: false, level: 'P1', detail: `unreadable auth file: ${(error as Error).message}`};
  }
}

export async function checkDiskFreeMb(targetPath: string, minMb: number = 1024): Promise<PreflightCheck> {
  try {
    const {stdout} = await execFileAsync('df', ['-k', targetPath], {timeout: 5000});
    const lines = stdout.trim().split(/\r?\n/);
    const cols = lines[lines.length - 1]?.trim().split(/\s+/) ?? [];
    const availKb = Number(cols[3]);
    if (!Number.isFinite(availKb)) {
      return {name: 'disk_space', ok: true, detail: 'df output unparsed (skipped)'};
    }
    const availMb = Math.floor(availKb / 1024);
    if (availMb < minMb) {
      return {name: 'disk_space', ok: false, level: 'P1', detail: `only ${availMb} MiB free (< ${minMb} MiB)`};
    }
    return {name: 'disk_space', ok: true, detail: `${availMb} MiB free`};
  } catch (error) {
    return {name: 'disk_space', ok: false, level: 'P1', detail: `df failed: ${(error as Error).message}`};
  }
}

export interface PreflightOptions {
  wizzRepoDir: string;
  materialsDir?: string;
  cliPath?: string;
  dshHome?: string;
  runtime?: RuntimePreference;
  codexAuthPath?: string;
  checkCodexAuth?: boolean;
  checkDshCli?: boolean;
}

export async function runPreflightChecks(options: PreflightOptions): Promise<PreflightReport> {
  const checks: PreflightCheck[] = [];
  const repoDir = path.resolve(options.wizzRepoDir);
  const materialsDir = options.materialsDir
    ? path.resolve(options.materialsDir)
    : process.env.WIZZ_MATERIALS
      ? path.resolve(process.env.WIZZ_MATERIALS)
      : path.join(repoDir, 'materials');

  if (!existsSync(repoDir)) {
    checks.push({name: 'workspace_mounted', ok: false, level: 'P1', detail: `WIZZ_REPO not found: ${repoDir}`});
  } else {
    checks.push({name: 'workspace_mounted', ok: true, detail: repoDir});
    checks.push(await checkDiskFreeMb(repoDir));
  }

  if (!existsSync(materialsDir)) {
    checks.push({name: 'materials_writable', ok: false, level: 'P1', detail: `WIZZ_MATERIALS not found: ${materialsDir}`});
  } else {
    try {
      await access(materialsDir, constants.R_OK | constants.W_OK);
      checks.push({name: 'materials_writable', ok: true, detail: materialsDir});
    } catch (error) {
      checks.push({name: 'materials_writable', ok: false, level: 'P1', detail: `${materialsDir}: ${(error as Error).message}`});
    }
    if (existsSync(repoDir) && !materialsDir.startsWith(`${repoDir}${path.sep}`) && materialsDir !== repoDir) {
      const matDisk = await checkDiskFreeMb(materialsDir);
      checks.push({...matDisk, name: 'materials_disk_space'});
    }
  }

  if (options.checkCodexAuth !== false) {
    checks.push(await checkCodexAuthLocal(options.codexAuthPath));
  }

  const runtimeView = options.runtime ? resolveRuntime(options.runtime) : null;

  if (options.checkDshCli !== false) {
    const cliPath = options.cliPath || process.env.CONTEXT_HUB_DSH_CLI || DEFAULT_DSH_CLI_PATH;
    // 桌面执行用的是桌面 profile 的 DSH_HOME，和 headless 的隔离 home 不是同一个。
    // 不能再用 CONTEXT_HUB_DSH_HOME 覆盖桌面默认值：那个变量是给 headless 准备的，
    // 覆盖后 desktop 任务的 dsh_home 检查的其实是另一个目录。
    const dshHome =
      options.dshHome ??
      (runtimeView?.resolved === 'desktop'
        ? path.join(os.homedir(), '.dsh')
        : process.env.CONTEXT_HUB_DSH_HOME || DEFAULT_DSH_HOME);
    checks.push({
      name: 'dsh_cli',
      ok: existsSync(cliPath),
      level: 'P1',
      detail: existsSync(cliPath) ? cliPath : `missing dsh binary at ${cliPath}`,
    });
    checks.push({
      name: 'dsh_home',
      ok: existsSync(dshHome),
      level: 'P2',
      detail: existsSync(dshHome) ? dshHome : `DSH_HOME not initialized yet: ${dshHome}`,
    });
  }

  if (runtimeView !== null) {
    const runtime = runtimeView;
    checks.push({name: 'dsh_runtime', ok: runtime.supported, level: 'P1', detail: runtime.detail});
    // 走宿主执行时，光有发现文件不够：端口可能被别的进程占用、宿主可能刚重启。
    // 这里做一次真实 health 探测，把「文件在但打不通」提前暴露给预检。
    if (runtime.resolved === 'desktop') {
      try {
        const endpoint = await ensureBridgeEndpoint(false);
        checks.push({name: 'bridge_health', ok: true, level: 'P1', detail: `${endpoint.origin}（pid ${endpoint.pid}）`});
      } catch (error) {
        checks.push({
          name: 'bridge_health',
          ok: false,
          level: 'P1',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const ok = checks.every((check) => check.ok || check.level === 'P2');
  return {ok, checkedAt: new Date().toISOString(), checks};
}

/**
 * Live image probe (`node tools/wizz-imagine.mjs doctor`).
 * Consumes 1 image generation quota: run ONLY once per day before C or on manual `doctor`.
 */
export async function runWizzImagineDoctor(wizzRepoDir: string): Promise<PreflightCheck> {
  const script = path.join(wizzRepoDir, 'tools', 'wizz-imagine.mjs');
  if (!existsSync(script)) {
    return {name: 'wizz_imagine_doctor', ok: false, level: 'P1', detail: `missing ${script}`};
  }
  try {
    const {stdout} = await execFileAsync('node', [script, 'doctor'], {
      cwd: wizzRepoDir,
      timeout: 60_000,
    });
    const parsed = JSON.parse(stdout.trim().split(/\r?\n/).pop() || '{}') as {ok?: boolean; probeStatus?: number; error?: string};
    return {
      name: 'wizz_imagine_doctor',
      ok: parsed.ok === true,
      level: 'P1',
      detail: parsed.ok ? `probeStatus=${parsed.probeStatus ?? 200}` : parsed.error || stdout.slice(0, 200),
    };
  } catch (error) {
    const err = error as {stdout?: string; stderr?: string; message: string};
    return {
      name: 'wizz_imagine_doctor',
      ok: false,
      level: 'P1',
      detail: (err.stdout || err.stderr || err.message).slice(0, 300),
    };
  }
}

export interface DshScheduleConflict {
  exists: boolean;
  activeSchedules: Array<{id: string; name: string; status: string}>;
}

export async function checkDshDesktopSchedules(
  schedulePath: string = path.join(os.homedir(), '.dsh', 'storages', 'schedule.json'),
): Promise<DshScheduleConflict> {
  if (!existsSync(schedulePath)) return {exists: false, activeSchedules: []};
  try {
    const raw = JSON.parse(await readFile(schedulePath, 'utf8'));
    const entries: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.schedules) ? raw.schedules : Object.values(raw ?? {});
    const activeSchedules: Array<{id: string; name: string; status: string}> = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const name = String(entry.name ?? entry.title ?? entry.id ?? '');
      const prompt = String(entry.prompt ?? '');
      const isWizz = /wizz|二创开题|提示词成稿|图像执行/i.test(`${name} ${prompt}`);
      if (!isWizz) continue;
      const paused = entry.paused === true || entry.enabled === false || entry.status === 'paused' || entry.status === 'disabled';
      if (!paused) {
        activeSchedules.push({
          id: String(entry.id ?? name),
          name: name || String(entry.id ?? 'unknown'),
          status: String(entry.status ?? (entry.enabled === false ? 'disabled' : 'active')),
        });
      }
    }
    return {exists: true, activeSchedules};
  } catch {
    return {exists: true, activeSchedules: []};
  }
}

/**
 * 自动化运行期间**允许**改动的目录。
 *
 * 这里用白名单而不是黑名单：守护进程无法预先枚举所有不该写的位置
 * （仓库根、docs/research、未来新增的目录），漏一个就是一次静默越界。
 * worlds/ 与 works/ 是创作档案与归档产物，流水线会正当写入。
 */
const WRITABLE_PREFIXES = ['ideas/', 'materials/', 'worlds/', 'works/'];

/**
 * 取工作区当前的 git 变更路径集合。
 *
 * 用 `-z`：路径含空格或中文时 `--porcelain` 会加引号并在 `core.quotePath` 下
 * 做八进制转义，直接切字符串会得到 `"\344\270\255..."` 这种假路径；
 * rename 还会把 `old -> new` 塞进同一行，导致新路径漏检。
 */
export async function snapshotGitStatus(repoDir: string): Promise<Set<string>> {
  try {
    const {stdout} = await execFileAsync('git', ['-c', 'core.quotePath=false', 'status', '--porcelain', '-z'], {
      cwd: repoDir,
      timeout: 10_000,
    });
    const fields = String(stdout).split('\0');
    const paths = new Set<string>();
    for (let index = 0; index < fields.length; index += 1) {
      const entry = fields[index];
      if (entry.length < 4) continue;
      const code = entry.slice(0, 2);
      const filePath = entry.slice(3);
      // rename / copy：下一个字段是原路径，这里只关心新路径，跳过它。
      if (code[0] === 'R' || code[0] === 'C') index += 1;
      paths.add(filePath);
    }
    return paths;
  } catch {
    return new Set();
  }
}

export function diffProtectedGitChanges(before: Set<string>, after: Set<string>): string[] {
  const unexpected: string[] = [];
  for (const filePath of after) {
    if (before.has(filePath)) continue;
    if (WRITABLE_PREFIXES.some((prefix) => filePath.startsWith(prefix))) continue;
    unexpected.push(filePath);
  }
  return unexpected;
}
