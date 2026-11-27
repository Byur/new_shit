import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {RunEnvelope, TaskConfig, UnitResultContract, UnitType} from './types.ts';

// 必须用 fileURLToPath：URL.pathname 会把空格等字符保留成 %20，模板路径就找不到了。
export const CONTEXT_HUB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export interface LoadedTaskDoc {
  body: string;
  hash: string;
  sourcePaths: string[];
}

/**
 * 读任务书全文。
 *
 * 一次运行只给一个会话，编排（开题 / 派发 / 终审 / 入队）由任务书自己描述，
 * 所以这里不再按时段切小节——切小节会让模型看不到「父子会话分工」这类全局条款。
 *
 * @param task 任务配置
 * @param wizzRepoDir 工作区绝对路径
 * @returns 任务书正文与内容哈希
 */
export async function loadTaskDocBody(task: TaskConfig, wizzRepoDir: string): Promise<LoadedTaskDoc> {
  const docAbs = path.resolve(wizzRepoDir, task.promptDoc);
  const text = await readFile(docAbs, 'utf8');
  if (text.trim() === '') throw new Error(`任务书为空: ${docAbs}`);
  return {body: text.trim(), hash: sha256Text(text), sourcePaths: [docAbs]};
}

export function formatShanghaiTime(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  // 某些 locale/hour12=false 组合在午夜会给出 24:00:00，归一成 00。
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}+08:00`;
}

export function buildResultContractInstruction(unitType: UnitType): string {
  const common = `你的最后一条回复末尾必须输出一个合法的 \`\`\`json 代码块：
{"status":"ok|partial|failed","summary":"一句话","failed_nodes":[{"node":"<task>/<batch>/<jobKey>/<phase>","job_key":"...","batch":"...","phase":"...","reason":"...","retryable":false}]}
status 必须如实反映结果：任一必要产物缺失或任一批次失败且未补偿成功，就写 partial 或 failed，不要为了好看写 ok。`;

  switch (unitType) {
    case 'a-run':
      return `${common}
并附带汇总字段：
- enqueued_batches: 实际入队的批次数（整数，必须与队列里新增的 todo 批次一致）
- proposals: [{"batch":"YYYYMMDD-slug","slug":"ascii-slug","work":"《作品》","character":"角色"}]
- blocked_ideas: [{"ideaId":"...","reason":"..."}]（仅当想法与创作共识冲突时填写）
注意：入队由你在本会话内完成（wizz-ideas claim/done/release、wizz-case init、wizz-queue enqueue）；严禁另行写 materials/_failures.log 或 materials/_pending_issue.md。`;
    case 'b-run':
      return `${common}
并附带汇总字段：
- batches: {"done":N,"failed":M}
- batch_rows: [{"batch":"YYYYMMDD-slug","style":"风格档","status":"done|failed"}]
- jobs: [{"jobKey":"...","verdict":"通过|有条件通过|否决","style":"...","status":"done|failed"}]
注意：批次收口（complete）与 ideas 状态由你按任务书处理；失败节点只通过本契约回报。`;
    case 'c-run':
      return `${common}
并附带汇总字段：
- batches: {"done":N,"failed":M}
- batch_rows: [{"batch":"YYYYMMDD-slug","style":"风格档","status":"done|failed"}]
- delivery_images: [{"path":"绝对路径.png","label":"批次 restrained/overload 说明"}]（只列 final 交付图，最多 8 张）
- feedback_count: 本轮看图反馈总次数
注意：批次 finish、wizz-case verify、失败快照以外的收口动作都由你按任务书处理。`;
  }
}

export function buildRunEnvelope(envelope: RunEnvelope): string {
  const lines: string[] = [
    '## 运行信封（由 context-hub 守护进程注入，优先级高于任务书旧编排条款）',
    `- runId: ${envelope.runId}`,
    `- unitId: ${envelope.unitId}`,
    `- taskId: ${envelope.taskId}`,
    `- unitType: ${envelope.unitType}`,
    `- 触发时刻（Asia/Shanghai）: ${envelope.triggeredAt}`,
    `- 工作区绝对路径: ${envelope.workspaceDir}`,
  ];
  if (envelope.materialsRoot) {
    lines.push(`- 物料根路径 (WIZZ_MATERIALS): ${envelope.materialsRoot}`);
    lines.push(
      '  - **本会话的进程环境里没有 `WIZZ_MATERIALS`**（桌面宿主的环境在 App 启动时就固定了）；',
    );
    lines.push(
      '    所有 `node tools/wizz-*.mjs` 调用都要带 `WIZZ_MATERIALS=' +
        envelope.materialsRoot +
        '` 前缀，或显式传 `--materials ' +
        envelope.materialsRoot +
        '`。不写就会静默回退到仓库内的 `materials/`，写到错误的卷上。',
    );
    lines.push('  - 该目录已通过运行时授权登记为额外可写根；子会话不会自动继承，派发时必须把绝对路径写进 prompt。');
  }
  if (envelope.batch) lines.push(`- 当前批次 batch: ${envelope.batch}`);
  if (envelope.materialsDir) lines.push(`- 当前案例目录 materialsDir: ${envelope.materialsDir}`);
  if (envelope.layout) lines.push(`- 批次布局 layout: ${envelope.layout}`);
  lines.push(
    `- 时长预算: 硬超时 ${envelope.timeoutMinutes} 分钟。宿主轮次仍在运行时不计停滞——**运行时长本身不是失败条件**；只有「既没在跑、也没有交答案」才会被判停滞（${envelope.stalledMinutes} 分钟）。`,
  );
  if (envelope.mode === 'inline') {
    lines.push(
      '- 执行器约束: 当前运行在 `dsh --profile headless` 的一次性 CLI 进程里，**不存在** `session_spawn` / `session_wait` / `session_send`；必须在本会话内顺序完成全部批次，不要等子会话。',
    );
  } else {
    const limit = envelope.concurrency && envelope.concurrency > 0 ? envelope.concurrency : 1;
    lines.push(
      `- 执行器约束: 当前运行在桌面宿主会话里，**可以**用 \`session_spawn\` / \`session_wait\` / \`session_send\` 建子会话。**并发所有权在本会话**（守护进程一次运行只建这一个会话）：同时运行的子会话上限 ${limit} 个，完成一个补派一个。子会话看不到你的上下文，prompt 必须自包含。`,
    );
  }
  lines.push(
    '- **覆盖条款（严禁并发写全局文件）**: **严禁直接写入或修改 `materials/_failures.log` 和 `materials/_pending_issue.md`**；所有失败节点与原因必须通过下方结果契约 JSON 返回，由守护进程单点汇总落盘。',
  );
  if (envelope.recentSummary) {
    lines.push('', '### 近 3 日批次提示词首段 / 防撞车摘要', envelope.recentSummary);
  }
  if (envelope.snapshot && Object.keys(envelope.snapshot).length > 0) {
    lines.push('', '### 本轮队列 / 想法快照', '```json', JSON.stringify(envelope.snapshot, null, 2), '```');
  }
  lines.push('', '### 结果契约（必须遵守）', buildResultContractInstruction(envelope.unitType));
  return lines.join('\n');
}

export function assembleUnitPrompt(unitBody: string, envelope: RunEnvelope, roundParamsText = ''): string {
  const parts = [unitBody.trim()];
  if (roundParamsText.trim() !== '') {
    parts.push(`## 本轮参数\n${roundParamsText.trim()}`);
  }
  parts.push(buildRunEnvelope(envelope));
  return parts.join('\n\n---\n\n');
}

/**
 * 取最后一段 ```json 代码块；没有代码块时退化为扫描最后一个顶层 JSON 对象。
 *
 * 收尾围栏前不要求换行：模型经常在 EOF 直接写 ``` 结束。
 */
export function parseResultContract(text: string): {contract: UnitResultContract | null; error?: string} {
  const source = String(text || '').trim();
  if (!source) return {contract: null, error: 'empty output'};

  const fenceRegex = /```(?:json)?[ \t]*\r?\n([\s\S]*?)```/gi;
  const blocks: string[] = [];
  for (const match of source.matchAll(fenceRegex)) {
    if (match[1]?.trim()) blocks.push(match[1].trim());
  }

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(blocks[i]);
      if (isValidContract(parsed)) return {contract: normalizeContract(parsed)};
    } catch {
      // try earlier block
    }
  }

  const lastBrace = source.lastIndexOf('}');
  if (lastBrace > 0) {
    for (let start = source.lastIndexOf('{', lastBrace); start >= 0; start = source.lastIndexOf('{', start - 1)) {
      const candidate = source.slice(start, lastBrace + 1);
      if (!candidate.includes('"status"')) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (isValidContract(parsed)) return {contract: normalizeContract(parsed)};
      } catch {
        // continue searching
      }
    }
  }

  return {contract: null, error: 'no valid result contract json block found'};
}

function isValidContract(value: unknown): value is UnitResultContract {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ['ok', 'partial', 'failed'].includes(String(record.status));
}

function normalizeContract(contract: UnitResultContract): UnitResultContract {
  return {...contract, summary: typeof contract.summary === 'string' ? contract.summary : ''};
}
