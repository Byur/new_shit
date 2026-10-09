import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {importWorkspace, openDatabase, parseHtmlReport} from '../src/lib.ts';

test('parser extracts normalized report data without preserving layout noise', () => {
  const html = '<title>Demo · 2026-08-05</title><h1>主线</h1><h2>章节一</h2><p>摘要</p><a href="https://openai.com/test">来源一</a>';
  const parsed = parseHtmlReport('/tmp/ai-tech-deepread-2026-08-05.html', html);
  assert.equal(parsed.reportDate, '2026-08-05');
  assert.equal(parsed.sections[0].title, '章节一');
  assert.equal(parsed.items[0].provider, 'OpenAI');
  assert.equal(parsed.items[0].url, 'https://openai.com/test');
});

test('import creates SQLite records and compact pointers without rendering HTML', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'context-hub-'));
  const source = path.join(root, 'workspace');
  const output = path.join(root, 'data');
  const dbPath = path.join(output, 'test.sqlite');
  await (await import('node:fs/promises')).mkdir(source, {recursive: true});
  await writeFile(path.join(source, 'ai-tech-deepread-2026-08-05.html'), '<title>Demo</title><h1>主线</h1><h2>章节一</h2><p>内容</p><a href="https://anthropic.com/test">Anthropic</a>');
  await writeFile(path.join(source, 'ai-trending-2026-08-05.html'), '<title>Trend</title><h1>趋势</h1><h2>章节二</h2><p>趋势内容</p><a href="https://github.com/example/repo">Repo</a>');
  const memoryPath = path.join(root, 'memory.md');
  await writeFile(memoryPath, '- Anthropic, 2026-08-05, `Demo`, https://anthropic.com/test\n');
  const result = await importWorkspace({sourceDir: source, memoryPath, dbPath});
  assert.equal(result.importedReports, 2);
  const db = openDatabase(dbPath);
  assert.equal(db.prepare('select count(*) as count from documents').get().count, 2);
  assert.equal(db.prepare('select count(*) as count from items').get().count, 2);
  db.close();
  const compact = await readFile(result.compactPath, 'utf8');
  assert.match(compact, /dedup_items_in_database: 2/);
  assert.match(compact, /通过 Context Hub MCP 查询 SQLite/);
  assert.doesNotMatch(compact, /https:\/\/anthropic\.com\/test/);
  assert.equal(existsSync(path.join(output, 'reports')), false);
});
