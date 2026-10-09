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
}

type DatabaseHandle = DatabaseSync;

export const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'context-hub.sqlite');
export const DEFAULT_EXPORT_DIR = path.join(PROJECT_ROOT, 'data', 'exports');

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

export function normalizeTitle(value: string = ''): string {
  return stripHtml(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function normalizeSourceUrl(value: string = ''): string {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = '';
    if (parsed.hostname.toLowerCase() === 'github.com') {
      parsed.search = '';
      parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
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
  const compactPath = await exportCompactMemory({dbPath, workspaceId, outDir: exportDir});
  const countDb = openDatabase(dbPath);
  const sourceCount = countDb.prepare('SELECT COUNT(*) AS count FROM items WHERE workspace_id = ? AND url <> \'\'').get(workspaceId).count;
  countDb.close();
  const summary = {workspaceId, kind, importedReports: inserted.length, uniqueSources: sourceCount, compactPath};
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
  return db.prepare(`SELECT d.id, d.kind, d.title, d.report_date, d.source_path, d.sha256,
      COALESCE(r.summary, '') AS summary,
      (SELECT COUNT(*) FROM links l WHERE l.document_id = d.id) AS source_count
    FROM documents d LEFT JOIN runs r ON r.id = d.run_id
    WHERE d.workspace_id = ? AND (d.title LIKE ? OR d.kind LIKE ? OR d.report_date LIKE ?)
    ORDER BY d.report_date DESC, d.created_at DESC LIMIT 100`).all(workspaceId, term, term, term)
    .map((report) => ({...report, sourceCount: report.source_count, source_count: undefined}));
}

function dateOnly(value: string): string {
  return String(value || '').slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${dateOnly(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Shanghai'}).format(new Date());
}

function sourceHistory(db: DatabaseHandle, workspaceId: string): Record<string, unknown>[] {
  return db.prepare(`WITH history AS (
      SELECT i.id, i.kind, i.provider, i.title, i.url, i.published_at,
        i.document_id AS documentId, i.updated_at AS lastUpdatedAt
      FROM items i
      WHERE i.workspace_id = ? AND i.url <> ''
      UNION
      SELECT 'report-link:' || l.id AS id, 'report-link' AS kind, '' AS provider,
        l.label AS title, l.url, '' AS published_at, l.document_id AS documentId,
        l.created_at AS lastUpdatedAt
      FROM links l
      WHERE l.workspace_id = ? AND l.url <> ''
    )
    SELECT h.id, h.kind, h.provider, h.title, h.url, h.published_at,
      h.documentId, h.lastUpdatedAt,
      MIN(d.report_date) AS firstSeenReportDate,
      MAX(d.report_date) AS lastSeenReportDate
    FROM history h
    LEFT JOIN documents d ON d.id = h.documentId
    GROUP BY h.id, h.kind, h.provider, h.title, h.url, h.published_at, h.documentId, h.lastUpdatedAt
    ORDER BY COALESCE(lastSeenReportDate, lastUpdatedAt) DESC`).all(workspaceId, workspaceId);
}

export function checkSources(db: DatabaseHandle, workspaceId: string, candidates: Array<{url: string; title?: string}>, windowDays: number = 60, asOf: string = todayInShanghai()): Record<string, unknown> {
  const boundedWindow = Math.max(1, Math.min(Number(windowDays) || 60, 366));
  const reportDate = dateOnly(asOf) || todayInShanghai();
  const cutoffDate = shiftDate(reportDate, -(boundedWindow - 1));
  const history = sourceHistory(db, workspaceId);
  const results = candidates.map((candidate) => {
    const url = String(candidate.url || '').trim();
    const urlKey = normalizeSourceUrl(url);
    const title = String(candidate.title || '').trim();
    const titleKey = normalizeTitle(title);
    const matches = history.filter((item) => normalizeSourceUrl(String(item.url || '')) === urlKey || (titleKey && normalizeTitle(String(item.title || '')) === titleKey));
    const recentMatches = matches.filter((item) => {
      const lastSeen = dateOnly(String(item.lastSeenReportDate || item.lastUpdatedAt || ''));
      return lastSeen && lastSeen >= cutoffDate && lastSeen <= reportDate;
    });
    const latestSeen = recentMatches.map((item) => dateOnly(String(item.lastSeenReportDate || item.lastUpdatedAt || ''))).sort().at(-1) || '';
    const reasons = [...new Set(recentMatches.flatMap((item) => [normalizeSourceUrl(String(item.url || '')) === urlKey ? 'url' : '', titleKey && normalizeTitle(String(item.title || '')) === titleKey ? 'title' : ''].filter(Boolean)))];
    return {
      url,
      title,
      eligible: recentMatches.length === 0,
      recentlySeen: recentMatches.length > 0,
      reasons,
      latestSeenReportDate: latestSeen || null,
      nextEligibleOn: latestSeen ? shiftDate(latestSeen, boundedWindow) : null,
      matches: recentMatches.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        provider: item.provider,
        firstSeenReportDate: item.firstSeenReportDate,
        lastSeenReportDate: item.lastSeenReportDate,
      })),
    };
  });
  return {asOf: reportDate, windowDays: boundedWindow, cutoffDate, results};
}

export async function exportCompactMemory({dbPath = DEFAULT_DB_PATH, workspaceId, outDir = DEFAULT_EXPORT_DIR}: {dbPath?: string; workspaceId: string; outDir?: string}): Promise<string> {
  const db = openDatabase(dbPath);
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
  if (!workspace) throw new Error(`workspace not found: ${workspaceId}`);
  const sourceCount = db.prepare(`SELECT COUNT(DISTINCT fingerprint) AS count FROM items WHERE workspace_id = ? AND url <> ''`).get(workspaceId).count;
  const reports = db.prepare(`SELECT kind, title, report_date, source_path FROM documents
    WHERE workspace_id = ? ORDER BY report_date DESC, created_at DESC LIMIT 10`).all(workspaceId);
  const body = [
    `# Context Hub compact memory · ${workspace.name}`,
    '',
    `workspace: ${workspace.slug}`,
    `source: ${workspace.source_path}`,
    `generated_at: ${now()}`,
    `dedup_items_in_database: ${sourceCount}`,
    '',
    '## 读取规则',
    '- 本文件只保存工作区指针和运行规则，不保存完整来源列表或历史正文。',
    '- 去重通过 Context Hub MCP 查询 SQLite：先查 URL，再查标准化标题。',
    '- 需要证据时只按 source_path 精确打开一份报告，不扫描全部历史 HTML。',
    '- 新报告由 Agent 按既有 HTML 模板生成；同步只负责索引、序列化和更新本文件。',
    '',
    '## 最近报告',
    ...reports.map((report) => `- ${report.report_date || 'unknown'} | ${report.kind} | ${report.title} | ${report.source_path}`),
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

export function compactPrompt(db: DatabaseHandle, workspaceId: string, limit: number = 20): string {
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
