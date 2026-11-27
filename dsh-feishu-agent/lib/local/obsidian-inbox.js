/** Obsidian 待整理速记：按天分文件（YYYY-MM-DD.md）、按条串行追加、按消息 ID 精准撤销。 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/**
 * 格式化本地日期 `YYYY-MM-DD`（按本机时区，避免 UTC 跨天错位）。
 *
 * @param date 时刻
 * @returns 日期字符串
 */
export function localDateStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 格式化本地时间 `HH:mm`。
 *
 * @param date 时刻
 * @returns 时间字符串
 */
export function localTimeStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 清洗单条速记正文：
 * - 遵守 OTD Vault 约定：把行内 `#1`、`#2` 这类排名写法转成 `No. 1`，防止误触发 Obsidian 标签；
 * - 压平多余首尾空白；内部换行压成空格，保持单条列表项整洁。
 *
 * @param text 单条原文
 * @returns 干净文本
 */
export function sanitizeInboxItem(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/(^|[\s(（])#(\d+)\b/g, '$1No. $2')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * 生成当天速记文件的初始头（对齐 OTD Vault 的轻量 Frontmatter 约定，不写 agent 字段）。
 *
 * @param dateStr `YYYY-MM-DD`
 * @returns 初始 Markdown 正文
 */
export function buildDailyHeader(dateStr) {
  return [
    '---',
    `created: ${dateStr}`,
    `summary: 飞书随手记与待整理想法（${dateStr}）`,
    'type: quick-note',
    'status: inbox',
    'tags:',
    '  - 速记',
    '  - feishu',
    '---',
    '',
    `# ${dateStr} 飞书速记`,
    '',
  ].join('\n');
}

/**
 * 构造单条消息的唯一注释标记（Obsidian 阅读视图隐藏，用于精准撤销）。
 *
 * @param messageId 飞书消息 ID
 * @returns HTML 注释
 */
export function feishuMarker(messageId) {
  const safeId = String(messageId ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  return safeId === '' ? '' : `<!-- feishu:${safeId} -->`;
}

/**
 * 原子写文件（tmp + rename），避免并发或中断留下半截 Markdown。
 *
 * @param filePath 目标路径
 * @param content 全文
 */
async function atomicWrite(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, filePath);
}

/**
 * 建 Obsidian 速记写入器（同一文件串行化写锁）。
 *
 * @returns `{ appendItems, removeItems }`
 */
export function createObsidianInbox() {
  /** filePath → 串行 Promise 链。 */
  const locks = new Map();

  function withFileLock(filePath, job) {
    const previous = locks.get(filePath) ?? Promise.resolve();
    const next = previous.then(job, job);
    const settled = next.finally(() => {
      if (locks.get(filePath) === settled) locks.delete(filePath);
    });
    locks.set(filePath, settled);
    return next;
  }

  /**
   * 往当天文件追加一条或多条速记。
   *
   * @param options.inboxDir 速记次级目录（如 `/path/to/vault/待整理/飞书速记`）
   * @param options.items 条目文本数组
   * @param options.messageId 飞书消息 ID（用于撤销）
   * @param options.quoted 被引用消息摘要（可选）
   * @param options.now 时间（测试可注入）
   * @returns `{ ok, filePath, fileName, date, count, writtenItems, error? }`
   */
  async function appendItems({ inboxDir, items, messageId = '', quoted = '', now = new Date() }) {
    if (typeof inboxDir !== 'string' || inboxDir.trim() === '') {
      return { ok: false, error: '未配置 Obsidian 待整理目录（inboxDir）' };
    }
    const cleanItems = (Array.isArray(items) ? items : [items])
      .map((item) => sanitizeInboxItem(item))
      .filter((item) => item !== '');
    if (cleanItems.length === 0) {
      return { ok: false, error: '没有可记录的有效内容' };
    }

    const date = localDateStamp(now);
    const time = localTimeStamp(now);
    const filePath = join(inboxDir.trim(), `${date}.md`);
    const marker = feishuMarker(messageId);
    const quoteClean = sanitizeInboxItem(String(quoted ?? '').replace(/^\[引用消息\]\s*/, ''));

    return await withFileLock(filePath, async () => {
      let existing = '';
      try {
        existing = await readFile(filePath, 'utf8');
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }

      const base = existing === ''
        ? buildDailyHeader(date)
        : (existing.endsWith('\n') ? existing : `${existing}\n`);

      const lines = cleanItems.map((item) => (marker === '' ? `- ${time} ${item}` : `- ${time} ${item} ${marker}`));
      if (quoteClean !== '') {
        lines.push(`  > 引用：${quoteClean.slice(0, 240)}`);
      }
      const nextContent = `${base}${lines.join('\n')}\n`;
      await atomicWrite(filePath, nextContent);

      return {
        ok: true,
        filePath,
        fileName: basename(filePath),
        date,
        count: cleanItems.length,
        writtenItems: cleanItems,
      };
    });
  }

  /**
   * 按飞书消息 ID 精准撤销该消息写入的所有条目（含紧随其后的缩进引用行）。
   *
   * @param options.filePath 当天文件路径
   * @param options.messageId 飞书消息 ID
   * @returns `{ ok, removedCount, error? }`
   */
  async function removeItems({ filePath, messageId }) {
    const marker = feishuMarker(messageId);
    if (typeof filePath !== 'string' || filePath === '' || marker === '') {
      return { ok: false, removedCount: 0, error: '缺少撤销定位信息' };
    }

    return await withFileLock(filePath, async () => {
      let existing;
      try {
        existing = await readFile(filePath, 'utf8');
      } catch (error) {
        return { ok: false, removedCount: 0, error: error?.code === 'ENOENT' ? '目标文件不存在' : String(error?.message ?? error) };
      }

      const rawLines = existing.split('\n');
      const kept = [];
      let removedCount = 0;
      let skipIndented = false;

      for (const line of rawLines) {
        if (line.includes(marker)) {
          removedCount += 1;
          skipIndented = true;
          continue;
        }
        if (skipIndented && /^\s{2,}>/.test(line)) {
          continue;
        }
        skipIndented = false;
        kept.push(line);
      }

      if (removedCount === 0) {
        return { ok: true, removedCount: 0 };
      }

      const normalized = `${kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
      await atomicWrite(filePath, normalized);
      return { ok: true, removedCount };
    });
  }

  return { appendItems, removeItems };
}
