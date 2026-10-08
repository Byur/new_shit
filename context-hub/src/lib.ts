import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

export type WorkspaceSlug = 'ai' | 'ai-trending';
export type ImportKind = 'deepread' | 'trending' | 'all';

export interface SourceLink {
  url: string;
  label: string;
}

export interface SourceItem {
  kind: string;
  provider: string;
  title: string;
  url: string;
  fingerprint: string;
  publishedAt?: string;
}

export interface ReportSection {
  title: string;
  paragraphs: string[];
  bullets: string[];
  headings: string[];
}

export interface ParsedReport {
  title: string;
  hero: string;
  kind: string;
  reportDate: string;
  summary: string;
  sections: ReportSection[];
  headings: string[];
  items: SourceItem[];
  links: SourceLink[];
  paragraphCount: number;
  h2Count: number;
}

export interface MemoryData {
  body: string;
  sha256: string;
  entries: SourceItem[];
}

export interface ImportWorkspaceOptions {
  sourceDir: string;
  memoryPath?: string;
  dbPath?: string;
  workspaceSlug?: WorkspaceSlug | string;
  kind?: ImportKind;
}

export interface ImportSummary {
  workspaceId: string;
  kind: ImportKind;
  importedReports: number;
  uniqueSources: number;
  compactPath: string;
  fixedReportPaths: string[];
}

type DatabaseHandle = DatabaseSync;

export const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'context-hub.sqlite');
export const DEFAULT_EXPORT_DIR = path.join(PROJECT_ROOT, 'data', 'exports');
export const DEFAULT_REPORT_DIR = path.join(PROJECT_ROOT, 'data', 'reports');

const now = () => new Date().toISOString();
const digest = (value) => createHash('sha256').update(value).digest('hex');
const idFor = (prefix, value) => `${prefix}-${digest(value).slice(0, 20)}`;

export function openDatabase(dbPath: string = DEFAULT_DB_PATH): DatabaseHandle {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`);
  return db;
}

export async function initDatabase(dbPath: string = DEFAULT_DB_PATH): Promise<void> {
  await mkdir(path.dirname(dbPath), {recursive: true});
  const db = openDatabase(dbPath);
  const schema = await readFile(path.join(PROJECT_ROOT, 'schema.sql'), 'utf8');
  db.exec(schema);
  db.close();
}

function decodeEntities(value = '') {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)));
}

export function stripHtml(value: string = ''): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function allMatches(source, expression) {
  return [...source.matchAll(expression)].map((match) => match[1] ?? '').map(stripHtml).filter(Boolean);
}

function attributeValue(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? decodeEntities(match[1]) : '';
}

function providerFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('openai')) return 'OpenAI';
    if (host.includes('google') || host.includes('deepmind')) return 'Google / Gemini';
    if (host.includes('anthropic')) return 'Anthropic';
    if (host.includes('github')) return 'GitHub';
    return host;
  } catch {
    return 'Unknown';
  }
}

function dateFromName(filePath, fallback = '') {
  const match = path.basename(filePath).match(/(20\d{2}-\d{2}-\d{2})/);
  return match?.[1] ?? fallback;
}

function kindFromName(filePath) {
  const name = path.basename(filePath);
  if (name.startsWith('ai-tech-deepread-')) return 'deepread';
  if (name.startsWith('ai-trending-')) return 'trending';
  return 'legacy';
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function parseHtmlReport(sourcePath: string, html: string): ParsedReport {
  const title = allMatches(html, /<title[^>]*>([\s\S]*?)<\/title>/gi)[0] || path.basename(sourcePath);
  const h1 = allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi)[0] || title;
  const h2 = allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  const paragraphs = allMatches(html, /<p[^>]*>([\s\S]*?)<\/p>/gi);
  const headings = allMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi);
  const sections = [];
  const sectionExpression = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|<\/main>|<\/article>|$)/gi;
  for (const match of html.matchAll(sectionExpression)) {
    const body = match[2] ?? '';
    sections.push({
      title: stripHtml(match[1]),
      paragraphs: allMatches(body, /<p[^>]*>([\s\S]*?)<\/p>/gi).slice(0, 8),
      bullets: allMatches(body, /<li[^>]*>([\s\S]*?)<\/li>/gi).slice(0, 8),
      headings: allMatches(body, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).slice(0, 8),
    });
  }

  const anchors = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const url = attributeValue(match[1], 'href');
    if (!/^https?:\/\//i.test(url)) continue;
    anchors.push({url, label: stripHtml(match[2]) || url});
  }
  const links = uniqueBy(anchors, (item) => item.url);
  const items = links.map((link) => ({
    kind: 'source',
    provider: providerFor(link.url),
    title: link.label,
    url: link.url,
    fingerprint: digest(link.url),
  }));
  const firstParagraphs = paragraphs.filter((paragraph) => !/^(来源|source|dedup|排重)/i.test(paragraph));
  return {
    title,
    hero: h1,
    kind: kindFromName(sourcePath),
    reportDate: dateFromName(sourcePath),
    summary: firstParagraphs.slice(0, 2).join(' '),
    sections: sections.length ? sections : h2.map((heading) => ({title: heading, paragraphs: [], bullets: [], headings: []})),
    headings,
    items,
    links,
    paragraphCount: paragraphs.length,
    h2Count: h2.length,
  };
}

export async function readAndParseReport(sourcePath: string): Promise<{html: string; sha256: string; parsed: ParsedReport}> {
  const html = await readFile(sourcePath, 'utf8');
  return {html, sha256: digest(html), parsed: parseHtmlReport(sourcePath, html)};
}

export async function parseMemory(memoryPath?: string): Promise<MemoryData | null> {
  if (!memoryPath || !existsSync(memoryPath)) return null;
  const body = await readFile(memoryPath, 'utf8');
  const entries = [];
  for (const line of body.split(/\r?\n/)) {
    const cleanLine = line.trim();
    const urls = cleanLine.match(/https?:\/\/[^\s)]+/g) ?? [];
    const repo = cleanLine.match(/^-\s*`([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)`/);
    const candidates = urls.length ? urls : (repo ? [`https://github.com/${repo[1]}`] : []);
    for (const rawUrl of candidates) {
      const url = rawUrl.replace(/[.,;]+$/, '');
      const match = cleanLine.match(/^-\s*([^,]+),\s*([^,]*),\s*`([^`]+)`/);
      entries.push({
        kind: 'memory-source',
        provider: match?.[1]?.trim() || providerFor(url),
        title: match?.[3]?.trim() || repo?.[1] || cleanLine.replace(/^-\s*/, '').slice(0, 160),
        publishedAt: match?.[2]?.trim() || '',
        url,
        fingerprint: digest(url),
      });
    }
  }
  return {body, sha256: digest(body), entries: uniqueBy(entries, (item) => item.url)};
}

function upsertProject(db, project) {
  const timestamp = now();
  db.prepare(`INSERT INTO projects(id, slug, name, root_path, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, root_path=excluded.root_path, updated_at=excluded.updated_at`)
    .run(project.id, project.slug, project.name, project.rootPath, timestamp, timestamp);
}

function upsertWorkspace(db, workspace) {
  const timestamp = now();
  db.prepare(`INSERT INTO workspaces(id, project_id, slug, name, source_path, automation_id, schedule, status, prompt, memory_path, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, slug) DO UPDATE SET name=excluded.name, source_path=excluded.source_path,
      automation_id=excluded.automation_id, schedule=excluded.schedule, status=excluded.status,
      prompt=excluded.prompt, memory_path=excluded.memory_path, updated_at=excluded.updated_at`)
    .run(workspace.id, workspace.projectId, workspace.slug, workspace.name, workspace.sourcePath,
      workspace.automationId, workspace.schedule, workspace.status, workspace.prompt, workspace.memoryPath,
      timestamp, timestamp);
}

function upsertRun(db, run) {
  const timestamp = now();
  db.prepare(`INSERT INTO runs(id, workspace_id, run_key, kind, run_date, status, source_path, input_chars, output_chars, summary, metadata_json, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, run_key) DO UPDATE SET kind=excluded.kind, run_date=excluded.run_date,
      status=excluded.status, source_path=excluded.source_path, input_chars=excluded.input_chars,
      output_chars=excluded.output_chars, summary=excluded.summary, metadata_json=excluded.metadata_json`)
    .run(run.id, run.workspaceId, run.runKey, run.kind, run.runDate, run.status, run.sourcePath,
      run.inputChars, run.outputChars, run.summary, run.metadataJson, timestamp);
}

function upsertDocument(db, document) {
  const timestamp = now();
  const existing = db.prepare('SELECT id FROM documents WHERE workspace_id = ? AND source_path = ?')
    .get(document.workspaceId, document.sourcePath);
  const id = existing?.id ?? document.id;
  db.prepare(`INSERT INTO documents(id, workspace_id, run_id, kind, source_path, title, report_date, content_json, sha256, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, source_path) DO UPDATE SET run_id=excluded.run_id, kind=excluded.kind,
      title=excluded.title, report_date=excluded.report_date, content_json=excluded.content_json,
      sha256=excluded.sha256, updated_at=excluded.updated_at`)
    .run(id, document.workspaceId, document.runId, document.kind, document.sourcePath, document.title,
      document.reportDate, document.contentJson, document.sha256, timestamp, timestamp);
  return id;
}

function replaceDocumentRelations(db, documentId, workspaceId, report) {
  db.prepare('DELETE FROM links WHERE document_id = ?').run(documentId);
  const insertLink = db.prepare(`INSERT OR IGNORE INTO links(id, workspace_id, document_id, url, label, fingerprint, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?)`);
  for (const link of report.links) {
    insertLink.run(idFor('link', `${workspaceId}:${documentId}:${link.url}`), workspaceId, documentId,
      link.url, link.label, digest(link.url), now());
  }
}

function upsertItems(db, workspaceId, documentId, items) {
  const statement = db.prepare(`INSERT INTO items(id, workspace_id, document_id, kind, provider, title, url, published_at, fingerprint, payload_json, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, fingerprint) DO UPDATE SET document_id=COALESCE(items.document_id, excluded.document_id),
      provider=excluded.provider, title=excluded.title, url=excluded.url, published_at=excluded.published_at,
      payload_json=excluded.payload_json, updated_at=excluded.updated_at`);
  for (const item of items) {
    statement.run(idFor('item', `${workspaceId}:${item.fingerprint}`), workspaceId, documentId, item.kind,
      item.provider ?? '', item.title ?? '', item.url ?? '', item.publishedAt ?? '', item.fingerprint,
      JSON.stringify(item), now(), now());
  }
}

export async function importWorkspace({sourceDir, memoryPath, dbPath = DEFAULT_DB_PATH, workspaceSlug = 'ai', kind = 'all'}: ImportWorkspaceOptions): Promise<ImportSummary> {
  await initDatabase(dbPath);
  const db = openDatabase(dbPath);
  const files = await readdir(sourceDir);
  const htmlFiles = files.filter((name) => name.endsWith('.html') && /^ai-(trending|tech-deepread)-/.test(name))
    .filter((name) => kind === 'all' || kindFromName(name) === kind).sort();
  const memory = await parseMemory(memoryPath);
  const projectId = idFor('project', sourceDir);
  const workspaceId = idFor('workspace', `${sourceDir}:${workspaceSlug}`);
  upsertProject(db, {id: projectId, slug: 'optimized', name: '优化是个好事', rootPath: sourceDir});
  const workspaceProfile = workspaceSlug === 'ai-trending'
    ? {
      name: 'AI Trending 每日推送',
      automationId: 'ai-trending',
      schedule: '每天 10:30（Asia/Shanghai）',
      prompt: '从 GitHub weekly Trending 与月度 stars top 500 中筛选 AI 应用/工程开源库，维护两个月排重窗口并生成每日 HTML。',
    }
    : {
      name: 'AI 技术博客精读',
      automationId: 'ai',
      schedule: '周一至周五 11:00（Asia/Shanghai）',
      prompt: '从 OpenAI / Gemini / Anthropic 官方与研究员来源中选择新文章，生成中文精读 HTML，并永久排重。',
    };
  upsertWorkspace(db, {
    id: workspaceId,
    projectId,
    slug: workspaceSlug,
    name: workspaceProfile.name,
    sourcePath: sourceDir,
    automationId: workspaceProfile.automationId,
    schedule: workspaceProfile.schedule,
    status: 'paused',
    prompt: workspaceProfile.prompt,
    memoryPath: memoryPath ?? '',
  });

  const inserted = [];
  db.exec('BEGIN');
  try {
    for (const fileName of htmlFiles) {
      const sourcePath = path.join(sourceDir, fileName);
      const {sha256, parsed} = await readAndParseReport(sourcePath);
      const reportId = idFor('run', `${workspaceId}:${fileName}`);
      upsertRun(db, {
        id: reportId,
        workspaceId,
        runKey: fileName,
        kind: parsed.kind,
        runDate: parsed.reportDate,
        status: 'imported',
        sourcePath,
        inputChars: memory?.body.length ?? 0,
        outputChars: (await readFile(sourcePath, 'utf8')).length,
        summary: parsed.summary,
        metadataJson: JSON.stringify({paragraphCount: parsed.paragraphCount, h2Count: parsed.h2Count}),
      });
      const documentId = upsertDocument(db, {
        id: idFor('document', `${workspaceId}:${sourcePath}`),
        workspaceId,
        runId: reportId,
        kind: parsed.kind,
        sourcePath,
        title: parsed.title,
        reportDate: parsed.reportDate,
        contentJson: JSON.stringify(parsed),
        sha256,
      });
      replaceDocumentRelations(db, documentId, workspaceId, parsed);
      upsertItems(db, workspaceId, documentId, parsed.items);
      inserted.push({documentId, sourcePath, ...parsed});
    }
    if (memory?.entries.length) upsertItems(db, workspaceId, null, memory.entries);
    db.prepare(`INSERT INTO memory_snapshots(id, workspace_id, source_path, source_sha256, source_chars, item_count, compact_path, compact_sha256, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, source_path) DO UPDATE SET source_sha256=excluded.source_sha256,
        source_chars=excluded.source_chars, item_count=excluded.item_count, compact_path=excluded.compact_path,
        compact_sha256=excluded.compact_sha256, created_at=excluded.created_at`)
      .run(idFor('memory', `${workspaceId}:${memoryPath ?? 'none'}`), workspaceId, memoryPath ?? '', memory?.sha256 ?? '',
        memory?.body.length ?? 0, memory?.entries.length ?? 0, '', '', now());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  db.close();
  const exportDir = path.join(path.dirname(dbPath), 'exports');
  const reportDir = path.join(path.dirname(dbPath), 'reports');
  const compactPath = await exportCompactMemory({dbPath, workspaceId, outDir: exportDir});
  const latestByKind = new Map();
  for (const report of inserted) {
    const previous = latestByKind.get(report.kind);
    if (!previous || report.reportDate > previous.reportDate) latestByKind.set(report.kind, report);
  }
  const fixedReportPaths = [];
  for (const report of latestByKind.values()) {
    fixedReportPaths.push(await writeFixedReport(report, path.join(reportDir, `${path.basename(report.sourcePath, '.html')}.fixed.html`)));
  }
  const countDb = openDatabase(dbPath);
  const sourceCount = countDb.prepare('SELECT COUNT(*) AS count FROM items WHERE workspace_id = ? AND url <> \'\'').get(workspaceId).count;
  countDb.close();
  const summary = {workspaceId, kind, importedReports: inserted.length, uniqueSources: sourceCount, compactPath, fixedReportPaths};
  return summary;
}

export function workspaceIdFor(db: DatabaseHandle, slug: string = 'ai'): string | null {
  return db.prepare('SELECT id FROM workspaces WHERE slug = ?').get(slug)?.id ?? null;
}

export function getOverview(db: DatabaseHandle, workspaceId: string | null = null): Record<string, unknown> {
  const workspace = workspaceId
    ? db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId)
    : db.prepare('SELECT * FROM workspaces ORDER BY updated_at DESC LIMIT 1').get();
  if (!workspace) return {workspace: null, counts: {}, recentRuns: [], recentReports: [], memory: null};
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM runs WHERE workspace_id = ?) AS runs,
    (SELECT COUNT(*) FROM documents WHERE workspace_id = ?) AS documents,
    (SELECT COUNT(*) FROM items WHERE workspace_id = ?) AS items,
    (SELECT COUNT(DISTINCT url) FROM items WHERE workspace_id = ? AND url <> '') AS uniqueSources,
    (SELECT COALESCE(source_chars, 0) FROM memory_snapshots WHERE workspace_id = ? LIMIT 1) AS memoryChars,
    (SELECT COALESCE(compact_sha256, '') FROM memory_snapshots WHERE workspace_id = ? LIMIT 1) AS compactHash`)
    .get(workspace.id, workspace.id, workspace.id, workspace.id, workspace.id, workspace.id);
  const recentRuns = db.prepare(`SELECT id, run_key, kind, run_date, status, output_chars, summary
    FROM runs WHERE workspace_id = ? ORDER BY run_date DESC, created_at DESC LIMIT 8`).all(workspace.id);
  const recentReports = db.prepare(`SELECT id, kind, title, report_date, source_path, sha256
    FROM documents WHERE workspace_id = ? ORDER BY report_date DESC, created_at DESC LIMIT 12`).all(workspace.id);
  const memory = db.prepare(`SELECT source_path, source_chars, item_count, compact_path, compact_sha256, created_at
    FROM memory_snapshots WHERE workspace_id = ? LIMIT 1`).get(workspace.id) ?? null;
  return {workspace, counts, recentRuns, recentReports, memory};
}

export function listItems(db: DatabaseHandle, workspaceId: string, query: string = ''): Record<string, unknown>[] {
  const term = `%${query}%`;
  return db.prepare(`SELECT id, kind, provider, title, url, published_at, document_id
    FROM items WHERE workspace_id = ? AND (title LIKE ? OR url LIKE ? OR provider LIKE ?)
    ORDER BY updated_at DESC LIMIT 200`).all(workspaceId, term, term, term);
}

export function listReports(db: DatabaseHandle, workspaceId: string, query: string = ''): Record<string, unknown>[] {
  const term = `%${query}%`;
  return db.prepare(`SELECT id, kind, title, report_date, source_path, sha256, content_json
    FROM documents WHERE workspace_id = ? AND (title LIKE ? OR kind LIKE ? OR report_date LIKE ?)
    ORDER BY report_date DESC, created_at DESC LIMIT 100`).all(workspaceId, term, term, term)
    .map((report) => ({...report, content: JSON.parse(report.content_json || '{}'), content_json: undefined}));
}

export async function exportCompactMemory({dbPath = DEFAULT_DB_PATH, workspaceId, outDir = DEFAULT_EXPORT_DIR}: {dbPath?: string; workspaceId: string; outDir?: string}): Promise<string> {
  const db = openDatabase(dbPath);
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
  if (!workspace) throw new Error(`workspace not found: ${workspaceId}`);
  const items = db.prepare(`SELECT provider, title, url, published_at, MIN(created_at) AS first_seen
    FROM items WHERE workspace_id = ? AND url <> '' GROUP BY fingerprint ORDER BY first_seen ASC`).all(workspaceId);
  const reports = db.prepare(`SELECT kind, title, report_date, source_path FROM documents
    WHERE workspace_id = ? ORDER BY report_date DESC, created_at DESC LIMIT 10`).all(workspaceId);
  const body = [
    `# Context Hub compact memory · ${workspace.name}`,
    '',
    `workspace: ${workspace.slug}`,
    `source: ${workspace.source_path}`,
    `generated_at: ${now()}`,
    `dedup_items: ${items.length}`,
    '',
    '## 读取规则',
    '- 定时任务只读取本文件，不读取历史 HTML 正文。',
    '- 去重优先匹配 URL，其次匹配标准化标题；需要正文时再按 source_path 精确打开单个报告。',
    '- 新运行结束后只追加新的结构化 item 和一行 run 摘要。',
    '',
    '## 最近报告',
    ...reports.map((report) => `- ${report.report_date || 'unknown'} | ${report.kind} | ${report.title} | ${report.source_path}`),
    '',
    '## 永久排重来源',
    ...items.map((item) => `- ${item.provider || 'Unknown'} | ${item.title || 'Untitled'} | ${item.url} | first_seen=${item.first_seen}`),
    '',
  ].join('\n');
  await mkdir(outDir, {recursive: true});
  const outPath = path.join(outDir, `${workspace.slug}-memory.compact.md`);
  await writeFile(outPath, body, 'utf8');
  db.prepare(`UPDATE memory_snapshots SET compact_path = ?, compact_sha256 = ?, created_at = ? WHERE workspace_id = ?`)
    .run(outPath, digest(body), now(), workspaceId);
  db.close();
  return outPath;
}

export function compactPrompt(db: DatabaseHandle, workspaceId: string, limit: number = 80): string {
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
  const items = db.prepare(`SELECT provider, title, url FROM items WHERE workspace_id = ? AND url <> ''
    ORDER BY updated_at DESC LIMIT ?`).all(workspaceId, limit);
  const reports = db.prepare(`SELECT kind, title, report_date, source_path FROM documents WHERE workspace_id = ?
    ORDER BY report_date DESC LIMIT 5`).all(workspaceId);
  return [
    `Context Hub workspace=${workspace?.slug ?? 'unknown'}`,
    'Use URL/title deduplication against the following compact index. Do not load historical HTML unless a single report is needed.',
    `Recent reports: ${reports.map((item) => `${item.report_date} ${item.title}`).join(' | ')}`,
    'Known sources:',
    ...items.map((item) => `- ${item.provider || 'Unknown'} | ${item.title || 'Untitled'} | ${item.url}`),
  ].join('\n');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}

export function renderFixedReport(report: Partial<ParsedReport> & Record<string, any>): string {
  const sections = (report.content?.sections ?? report.sections ?? []).filter((section) => section.title);
  const items = report.content?.items ?? report.items ?? [];
  const summary = report.content?.summary ?? report.summary ?? '';
  const hero = report.content?.hero ?? report.hero ?? report.title ?? 'Untitled report';
  const date = report.reportDate ?? report.content?.reportDate ?? '';
  const kind = report.kind ?? report.content?.kind ?? 'report';
  const sectionHtml = sections.map((section, index) => `
      <section class="chapter">
        <aside class="chapter-aside">
          <div class="chapter-no">Chapter ${String(index + 1).padStart(2, '0')}</div>
          <h2>${escapeHtml(section.title)}</h2>
        </aside>
        <div class="chapter-body">
          ${(section.paragraphs ?? []).slice(0, 6).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
          ${(section.bullets ?? []).length ? `<ul>${section.bullets.slice(0, 6).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
        </div>
      </section>`).join('');
  const itemHtml = items.slice(0, 12).map((item) => `<li><span>${escapeHtml(item.provider || 'Source')}</span><a href="${escapeHtml(item.url)}">${escapeHtml(item.title || item.url)}</a></li>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="Context Hub fixed report template v1">
  <title>${escapeHtml(report.title || 'Context Hub Report')}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <main class="wrap">
    <article class="frame">
      <header class="topbar"><div><b>Context Hub</b> / ${escapeHtml(kind)}</div><div>${escapeHtml(date)} · fixed template v1</div></header>
      <section class="hero">
        <div class="hero-copy"><div><div class="eyebrow">Serialized report / ${escapeHtml(kind)}</div><h1>${escapeHtml(hero)}</h1><p class="hero-note">${escapeHtml(summary || '本报告由结构化数据生成，正文与排重索引分离保存。')}</p></div><div class="caption">${escapeHtml(report.title || '')}</div></div>
        <aside class="hero-meta"><div class="identity"><div class="name">Structured archive</div><div class="role">${sections.length} chapters · ${items.length} source links · hash ${escapeHtml((report.sha256 || '').slice(0, 12))}</div></div><p class="statement">历史内容可以被检索、去重和复用，但不会再作为下一次任务的默认上下文。</p></aside>
      </section>
      ${sectionHtml}
      <section class="chapter sources-chapter"><aside class="chapter-aside"><div class="chapter-no">Evidence Index</div><h2>Sources</h2><p>来源链接以结构化 item 保存，正文只在需要时打开。</p></aside><div class="chapter-body"><ul class="source-list">${itemHtml || '<li><span>Empty</span>No external source links were extracted.</li>'}</ul></div></section>
      <footer class="footer"><strong>Context Hub · fixed template v1</strong><span>生成时间 ${escapeHtml(now())} · source path ${escapeHtml(report.sourcePath || '')}</span></footer>
    </article>
  </main>
</body>
</html>`;
}

export async function writeFixedReport(report: Partial<ParsedReport> & Record<string, any>, outPath: string): Promise<string> {
  await mkdir(path.dirname(outPath), {recursive: true});
  await writeFile(outPath, renderFixedReport(report), 'utf8');
  return outPath;
}

const REPORT_CSS = `
:root{--bg:#f4f1eb;--paper:#fbfaf6;--ink:#171512;--muted:#6c665e;--line:#d8d0c3;--accent:#8f1d16;--deep:#171412;--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:radial-gradient(circle at 16% 0%,rgba(143,29,22,.08),transparent 28%),linear-gradient(180deg,#f8f6f1 0%,var(--bg) 58%,#eee8dc 100%);font-family:ui-serif,"Iowan Old Style","Times New Roman","Noto Serif SC","Songti SC",serif;line-height:1.72}body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(17,16,14,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(17,16,14,.028) 1px,transparent 1px);background-size:56px 56px;mask-image:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.08))}a{color:inherit;text-decoration:none;border-bottom:1px solid rgba(143,29,22,.35);overflow-wrap:anywhere}.wrap{position:relative;z-index:1;max-width:var(--max);margin:0 auto;padding:52px 28px 80px}.frame{border:1px solid var(--line);background:rgba(251,250,246,.78);box-shadow:0 34px 100px rgba(48,38,25,.12)}.topbar{display:flex;justify-content:space-between;gap:24px;padding:24px 28px;border-bottom:1px solid var(--line);font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:var(--muted);letter-spacing:.08em}.topbar b{color:var(--ink)}.hero{display:grid;grid-template-columns:1.05fr .95fr;min-height:520px;border-bottom:1px solid var(--line)}.hero-copy{padding:68px 62px 52px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid var(--line)}.eyebrow,.chapter-no{font:800 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}h1{margin:28px 0 0;font-size:68px;line-height:.98;letter-spacing:-.055em;font-weight:500;overflow-wrap:anywhere}.hero-note{max-width:650px;margin:36px 0 0;font-size:20px;line-height:1.78;color:#322d27}.caption{font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:#9c9388;text-transform:uppercase;letter-spacing:.08em}.hero-meta{padding:68px 52px 52px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(244,241,235,.4))}.identity{border-left:4px solid var(--accent);padding-left:22px}.identity .name{font-size:30px;font-weight:700}.identity .role{margin-top:12px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:var(--muted);overflow-wrap:anywhere}.statement{font-size:23px;line-height:1.58;margin:58px 0 0;color:#211d19}.chapter{display:grid;grid-template-columns:300px 1fr;border-bottom:1px solid var(--line)}.chapter-aside{padding:44px 34px;border-right:1px solid var(--line)}h2{margin:18px 0 0;font-size:34px;line-height:1.12;letter-spacing:-.045em;font-weight:500;overflow-wrap:anywhere}.chapter-aside p{margin:18px 0 0;color:var(--muted);font-size:15px}.chapter-body{padding:44px 54px;min-width:0}.chapter-body p{max-width:74ch;margin:0 0 18px;font-size:17px;color:#39332d}.chapter-body p:first-child{font-size:21px;line-height:1.7;color:#2c2721}.chapter-body ul,.source-list{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:12px}.chapter-body li{position:relative;padding-left:24px;color:#3c352e}.chapter-body li:before{content:"";position:absolute;left:0;top:.8em;width:9px;height:1px;background:var(--accent)}.sources-chapter .chapter-body{background:rgba(255,255,255,.28)}.source-list li{display:grid;grid-template-columns:150px 1fr;gap:24px;border-top:1px solid var(--line);padding:13px 0 0;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.source-list li:before{display:none}.source-list span{color:var(--accent);font-weight:700}.footer{display:flex;justify-content:space-between;gap:24px;padding:24px 28px;background:var(--deep);color:#f8f3ea;font:12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.footer span{color:rgba(248,243,234,.65);overflow-wrap:anywhere}@media(max-width:920px){.hero,.chapter{grid-template-columns:1fr}.hero-copy,.chapter-aside{border-right:0}.hero-copy{border-bottom:1px solid var(--line)}h1{font-size:56px}.footer{display:grid}.source-list li{grid-template-columns:1fr;gap:4px}}@media(max-width:560px){.wrap{padding:20px 12px 48px}.topbar{display:block}.topbar div+div{margin-top:10px}.hero-copy,.hero-meta,.chapter-body,.chapter-aside{padding:34px 24px}h1{font-size:43px}.hero-note,.chapter-body p:first-child{font-size:18px}.statement{font-size:20px}.chapter-body p{font-size:16px}.footer{padding:22px 24px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
