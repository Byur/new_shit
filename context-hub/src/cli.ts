#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateArchivedMarkdown, validateTrendingReport} from './report-contract.ts';
import {loadEnvFiles} from './env-file.ts';
import {DEFAULT_DB_PATH, DEFAULT_EXPORT_DIR, compactPrompt, exportCompactMemory, getOverview, importWorkspace, initDatabase, openDatabase, workspaceIdFor} from './lib.ts';

type CliOptions = Record<string, string | boolean>;

function args(argv: string[]): CliOptions {
  const output: CliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    output[key] = argv[index + 1]?.startsWith('--') ? true : (argv[index + 1] ?? true);
    if (output[key] !== true) index += 1;
  }
  return output;
}

function textOption(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function runAutomationCli(subArgs: string[]): Promise<void> {
  const sub = subArgs[0] ?? 'status';
  const rest = subArgs.slice(1);
  const positional = rest.filter((token) => !token.startsWith('--'));
  const flags = args(rest);
  const port = Number(process.env.CONTEXT_HUB_PORT || 4321);
  const baseUrl = (process.env.CONTEXT_HUB_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, '');

  const callHttp = async (method: 'GET' | 'POST', route: string, body?: unknown) => {
    const headers: Record<string, string> = {};
    if (method === 'POST') {
      headers['content-type'] = 'application/json';
      // loadEnvFiles() 已在启动时执行，这里直接读进程环境，避免再解析一遍 env 文件。
      const token = (process.env.CONTEXT_HUB_AUTOMATION_TOKEN || '').trim();
      if (token) headers['x-automation-token'] = token;
    }
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers,
      ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    }
    return parsed;
  };

  if (sub === 'status') {
    console.log(JSON.stringify(await callHttp('GET', '/api/automation/status'), null, 2));
    return;
  }
  if (sub === 'runs') {
    const limit = textOption(flags.limit) || '30';
    console.log(JSON.stringify(await callHttp('GET', `/api/automation/runs?limit=${encodeURIComponent(limit)}`), null, 2));
    return;
  }
  if (sub === 'logs') {
    const runKey = positional[0] || textOption(flags.run);
    if (!runKey) throw new Error('logs requires <runId>');
    console.log(JSON.stringify(await callHttp('GET', `/api/automation/runs/${encodeURIComponent(runKey)}/logs`), null, 2));
    return;
  }
  if (sub === 'run') {
    const task = positional[0] || textOption(flags.task);
    if (!task) throw new Error('run requires <task> (wizz-a | wizz-b | wizz-c)');
    console.log(
      JSON.stringify(
        await callHttp('POST', '/api/automation/run', {
          task,
          dryRun: flags['dry-run'] === true,
          // 默认顺流走完 A→B→C；--no-follow 只跑当前这一环。
          follow: flags['no-follow'] !== true,
        }),
        null,
        2,
      ),
    );
    return;
  }
  if (sub === 'pause') {
    const task = positional[0] || textOption(flags.task);
    if (!task) throw new Error('pause requires <task>');
    console.log(JSON.stringify(await callHttp('POST', '/api/automation/pause', {task, reason: textOption(flags.reason) || 'manual pause', kill: flags.kill === true}), null, 2));
    return;
  }
  if (sub === 'resume') {
    const task = positional[0] || textOption(flags.task);
    if (!task) throw new Error('resume requires <task>');
    console.log(JSON.stringify(await callHttp('POST', '/api/automation/resume', {task}), null, 2));
    return;
  }
  if (sub === 'retry') {
    const runKey = positional[0] || textOption(flags.run);
    if (!runKey) throw new Error('retry requires <runId>');
    console.log(JSON.stringify(await callHttp('POST', '/api/automation/retry', {runKey}), null, 2));
    return;
  }
  if (sub === 'doctor') {
    console.log(JSON.stringify(await callHttp('POST', '/api/automation/doctor', {liveImageCheck: flags.live === true, feishuTest: flags.feishu === true}), null, 2));
    return;
  }
  throw new Error(`unknown automation subcommand: ${sub}; use status|runs|logs|run|pause|resume|retry|doctor`);
}

function usage() {
  console.log(`Context Hub

Commands:
  init
  import --source <workspace-dir> --memory <memory.md>
  memory --workspace <slug>
  prompt --workspace <slug>
  stats --workspace <slug>
  validate-report --file <report.html> [--selection <service-response.json>] [--markdown <archive.md>]
  automation <status|runs|logs|run|pause|resume|retry|doctor> [options]

The importer stores metadata and normalized source items in SQLite. It does not render reports or rewrite the source workspace or automation memory.`);
}

const command = process.argv[2] ?? 'help';
// 和 serve 一致：先加载 ~/.config/context-hub/env 与仓库根 .env（只补未设置的键）。
// 日志走 stderr，避免污染 stdout 上的 JSON 输出。
await loadEnvFiles({info: (message) => console.error(message), warn: (message) => console.error(message)});

const options = args(process.argv.slice(3));
const dbPath = textOption(options.db) ? path.resolve(textOption(options.db) as string) : DEFAULT_DB_PATH;

try {
  if (command === 'help' || command === '--help') {
    usage();
  } else if (command === 'automation') {
    await runAutomationCli(process.argv.slice(3));
  } else if (command === 'validate-report') {
    const file = textOption(options.file);
    if (!file) throw new Error('--file is required');
    const sourcePath = path.resolve(file);
    const selectionFile = textOption(options.selection);
    const selection = selectionFile ? JSON.parse(await readFile(selectionFile, 'utf8')) : undefined;
    const report = validateTrendingReport(sourcePath, await readFile(sourcePath, 'utf8'), selection);
    const markdownFile = textOption(options.markdown);
    if (markdownFile) validateArchivedMarkdown(await readFile(markdownFile, 'utf8'), report, sourcePath);
    console.log(JSON.stringify({valid:true, schemaVersion:report.schemaVersion,reportDate:report.reportDate,projectCount:report.projects.length,selectionChecked:!!selectionFile,markdownChecked:!!markdownFile},null,2));
  } else if (command === 'init') {
    await initDatabase(dbPath);
    console.log(`initialized ${dbPath}`);
  } else if (command === 'import') {
    const source = textOption(options.source);
    if (!source) throw new Error('--source is required');
    const memory = textOption(options.memory);
    const summary = await importWorkspace({sourceDir: path.resolve(source), memoryPath: memory ? path.resolve(memory) : undefined, dbPath, workspaceSlug: textOption(options.workspace) || 'ai', kind: (textOption(options.kind) || 'all') as 'deepread' | 'trending' | 'all'});
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const db = openDatabase(dbPath);
    const slug = options.workspace || 'ai';
    const workspaceId = workspaceIdFor(db, slug);
    if (!workspaceId) throw new Error(`workspace not found: ${slug}; run import first`);
    if (command === 'memory') {
      db.close();
      const out = textOption(options.out);
      console.log(await exportCompactMemory({dbPath, workspaceId, outDir: out ? path.resolve(out) : DEFAULT_EXPORT_DIR}));
      process.exit(0);
    } else if (command === 'prompt') {
      console.log(compactPrompt(db, workspaceId, Number(options.limit || 80)));
    } else if (command === 'stats') {
      console.log(JSON.stringify(getOverview(db, workspaceId), null, 2));
    } else {
      usage();
    }
    db.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
