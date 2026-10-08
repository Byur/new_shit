#!/usr/bin/env node
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {DEFAULT_DB_PATH, DEFAULT_EXPORT_DIR, DEFAULT_REPORT_DIR, compactPrompt, exportCompactMemory, getOverview, importWorkspace, initDatabase, openDatabase, workspaceIdFor, writeFixedReport} from './lib.ts';

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

function usage() {
  console.log(`Context Hub\n\nCommands:\n  init\n  import --source <workspace-dir> --memory <memory.md>\n  report --workspace <slug>\n  memory --workspace <slug>\n  prompt --workspace <slug>\n  stats --workspace <slug>\n\nThe importer stores metadata and normalized source items in SQLite. It does not rewrite the source workspace or automation memory.`);
}

const command = process.argv[2] ?? 'help';
const options = args(process.argv.slice(3));
const dbPath = textOption(options.db) ? path.resolve(textOption(options.db) as string) : DEFAULT_DB_PATH;

try {
  if (command === 'help' || command === '--help') {
    usage();
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
    if (command === 'report') {
      const overview = getOverview(db, workspaceId);
      const selected = options.document
        ? db.prepare('SELECT * FROM documents WHERE id = ? AND workspace_id = ?').get(options.document, workspaceId)
        : db.prepare('SELECT * FROM documents WHERE workspace_id = ? ORDER BY report_date DESC, created_at DESC LIMIT 1').get(workspaceId);
      if (!selected) throw new Error('no report found');
      const out = textOption(options.out);
      const outPath = out ? path.resolve(out) : path.join(DEFAULT_REPORT_DIR, `${path.basename(selected.source_path, '.html')}.fixed.html`);
      const written = await writeFixedReport({...selected, content: JSON.parse(selected.content_json || '{}')}, outPath);
      console.log(JSON.stringify({written, source: selected.source_path, title: selected.title, date: selected.report_date}, null, 2));
    } else if (command === 'memory') {
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
