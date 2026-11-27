import {createHash, randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile, rm, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {promisify} from 'node:util';
import * as Lark from '@larksuiteoapi/node-sdk';

const execFileAsync = promisify(execFile);

export const CARD_MAX_BYTES = 30 * 1024;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const SEND_MIN_INTERVAL_MS = 220;
export const SEND_MAX_ATTEMPTS = 3;
export const SEND_RETRY_BASE_MS = 500;

export interface FeishuCredentials {
  appId: string;
  appSecret: string;
}

export interface FeishuClientLike {
  im: {
    message: {
      create: (payload: {
        params: {receive_id_type: string};
        data: {receive_id: string; msg_type: string; content: string; uuid?: string};
      }) => Promise<any>;
    };
    v1: {
      image: {
        create: (payload: {data: {image_type: string; image: Buffer}}) => Promise<any>;
      };
    };
  };
}

export interface FeishuNotifierOptions {
  db?: DatabaseSync;
  getCredentials?: () => FeishuCredentials;
  getChatId?: () => Promise<string>;
  clientFactory?: (creds: FeishuCredentials) => FeishuClientLike;
  compressImage?: (srcPath: string) => Promise<Buffer>;
  statePath?: string;
  logger?: {info: (msg: string) => void; warn: (msg: string) => void};
}

export interface SuccessNotifyInput {
  runKey: string;
  dateLabel: string;
  durationMs: number;
  batches: Array<{
    batch: string;
    character?: string;
    work?: string;
    style?: string;
    durationMs?: number;
    status: 'done' | 'failed' | 'skipped';
  }>;
  images: Array<{path: string; label: string}>;
  maxImages?: number;
  failures?: Array<{node: string; reason: string}>;
}

export interface FailureNotifyInput {
  runKey: string;
  taskId: string;
  node: string;
  reason: string;
  retryInfo: string;
  chainStatus: string;
  logDir: string;
  level?: 'P1' | 'P2';
}

export interface AlertNotifyInput {
  runKey?: string | null;
  level: 'P1' | 'P2';
  kind: string;
  title: string;
  signal: string;
  scope: string;
  action: string;
  dedupeKey?: string;
  dedupeWindowMinutes?: number;
}

/**
 * 取第一个非空环境变量值。
 *
 * @param keys 候选变量名（按优先级）
 * @returns 去空白后的值，全部为空时返回空串
 */
function firstNonEmpty(...keys: string[]): string {
  for (const key of keys) {
    const value = (process.env[key] ?? '').trim();
    if (value !== '') return value;
  }
  return '';
}

export function resolveFeishuCredentials(): FeishuCredentials {
  return {
    // 与 dsh-feishu-agent 统一用 FEISHU_AGENT_*；保留旧名回退，避免升级时告警静默失效。
    appId: firstNonEmpty('FEISHU_AGENT_APP_ID', 'DSH_FEISHU_AGENT_APP_ID', 'FEISHU_APP_ID'),
    appSecret: firstNonEmpty('FEISHU_AGENT_APP_SECRET', 'DSH_FEISHU_AGENT_APP_SECRET', 'FEISHU_APP_SECRET'),
  };
}

export async function resolveFeishuChatId(
  statePath: string = path.join(os.homedir(), '.dsh', 'feishu-agent', 'state.json'),
): Promise<string> {
  const fromEnv = (process.env.CONTEXT_HUB_FEISHU_CHAT_ID || '').trim();
  if (fromEnv) return fromEnv;
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(await readFile(statePath, 'utf8')) as Record<string, any>;
      if (typeof state?.ownerChatId === 'string' && state.ownerChatId.trim() !== '') {
        return state.ownerChatId.trim();
      }
      if (state?.bindings && typeof state.bindings === 'object') {
        // 新版 state 的 key 形如 `appId:tenantKey:oc_xxx:-`，直接取 value.chatId 最稳。
        for (const value of Object.values(state.bindings)) {
          const chatId = typeof (value as any)?.chatId === 'string' ? (value as any).chatId.trim() : '';
          if (chatId.startsWith('oc_')) return chatId;
        }
        for (const key of Object.keys(state.bindings)) {
          const segment = key.split(':').find((part) => part.startsWith('oc_'));
          if (segment !== undefined) return segment;
        }
      }
      if (state?.chats && typeof state.chats === 'object') {
        for (const value of Object.values(state.chats)) {
          const chatId = typeof (value as any)?.chatId === 'string' ? (value as any).chatId.trim() : '';
          if (chatId.startsWith('oc_')) return chatId;
        }
        const firstChat = Object.keys(state.chats).find((key) => key.startsWith('oc_'));
        if (firstChat) return firstChat;
      }
    } catch {
      // fall back to default
    }
  }
  // 没有 env、也没有本机 state 时就没有收件人：调用方跳过发送，不要在源码里写死个人 chat_id。
  return '';
}

export function cardBytes(card: unknown): number {
  return new TextEncoder().encode(JSON.stringify(card)).length;
}

export function buildJson2Card({
  title,
  color = 'grey',
  elements,
}: {
  title: string;
  color?: string;
  elements: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  return {
    schema: '2.0',
    config: {update_multi: true, wide_screen_mode: true},
    header: {
      template: color,
      title: {tag: 'plain_text', content: title},
    },
    body: {
      direction: 'vertical',
      elements,
    },
  };
}

function isFeishuOk(response: any): boolean {
  if (response === null || response === undefined) return false;
  if (response.code === undefined) return response.data !== undefined || response.image_key !== undefined || response.message_id !== undefined;
  return response.code === 0;
}

function defaultClientFactory(creds: FeishuCredentials): FeishuClientLike {
  return new Lark.Client({
    appId: creds.appId,
    appSecret: creds.appSecret,
    domain: Lark.Domain.Feishu,
  }) as unknown as FeishuClientLike;
}

async function compressImageWithSips(srcPath: string): Promise<Buffer> {
  const tmpFile = path.join(os.tmpdir(), `context-hub-img-${randomUUID()}.jpg`);
  try {
    await execFileAsync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', srcPath, '--out', tmpFile], {
      timeout: 30_000,
    });
    let info = await stat(tmpFile);
    if (info.size > IMAGE_MAX_BYTES) {
      await execFileAsync('sips', ['-Z', '2048', '-s', 'formatOptions', '75', tmpFile], {timeout: 30_000});
      info = await stat(tmpFile);
    }
    return await readFile(tmpFile);
  } finally {
    await rm(tmpFile, {force: true}).catch(() => {});
  }
}

export class FeishuNotifier {
  private readonly db?: DatabaseSync;
  private readonly getCredentials: () => FeishuCredentials;
  private readonly getChatId: () => Promise<string>;
  private readonly clientFactory: (creds: FeishuCredentials) => FeishuClientLike;
  private readonly compressImage: (srcPath: string) => Promise<Buffer>;
  private readonly logger: {info: (msg: string) => void; warn: (msg: string) => void};
  private client: FeishuClientLike | null = null;
  private clientKey = '';
  private readonly lastSendAt = new Map<string, number>();
  private readonly sendGates = new Map<string, Promise<void>>();

  constructor(options: FeishuNotifierOptions = {}) {
    this.db = options.db;
    this.getCredentials = options.getCredentials ?? resolveFeishuCredentials;
    this.getChatId = options.getChatId ?? (() => resolveFeishuChatId(options.statePath));
    this.clientFactory = options.clientFactory ?? defaultClientFactory;
    this.compressImage = options.compressImage ?? compressImageWithSips;
    this.logger = options.logger ?? {
      info: (msg) => console.log(`[feishu] ${msg}`),
      warn: (msg) => console.warn(`[feishu] ${msg}`),
    };
  }

  private getClient(): FeishuClientLike | null {
    const creds = this.getCredentials();
    if (!creds.appId || !creds.appSecret) return null;
    const key = `${creds.appId}:${creds.appSecret}`;
    if (this.client && this.clientKey === key) return this.client;
    this.client = this.clientFactory(creds);
    this.clientKey = key;
    return this.client;
  }

  /**
   * 取收件 chat_id；没有配置时打一条 warn 并返回 null（调用方跳过发送）。
   *
   * @param describe 日志里的动作名
   * @returns chat_id 或 null
   */
  private async resolveChatId(describe: string): Promise<string | null> {
    const chatId = await this.getChatId();
    if (!chatId) {
      this.logger.warn(`${describe}跳过：没有可用的飞书 chat_id（设置 CONTEXT_HUB_FEISHU_CHAT_ID）`);
      return null;
    }
    return chatId;
  }

  private async throttle(chatId: string): Promise<void> {
    const prevGate = this.sendGates.get(chatId) ?? Promise.resolve();
    const gate = prevGate
      .catch(() => {})
      .then(async () => {
        const last = this.lastSendAt.get(chatId) ?? 0;
        const wait = last + SEND_MIN_INTERVAL_MS - Date.now();
        if (wait > 0) await delay(wait);
        this.lastSendAt.set(chatId, Date.now());
      });
    this.sendGates.set(chatId, gate.catch(() => {}));
    await gate;
  }

  private async callWithRetry<T>(fn: (client: FeishuClientLike) => Promise<T>, describe: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`${describe}跳过：飞书凭据未配置`);
      return null;
    }
    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fn(client);
        if (isFeishuOk(response)) return response;
        this.logger.warn(`${describe}被飞书拒绝: ${JSON.stringify(response).slice(0, 300)}`);
        return null;
      } catch (error) {
        if (attempt === SEND_MAX_ATTEMPTS) {
          this.logger.warn(`${describe}失败（已重试 ${attempt} 次）: ${(error as Error).message}`);
          return null;
        }
        await delay(SEND_RETRY_BASE_MS * attempt);
      }
    }
    return null;
  }

  async sendCard(card: Record<string, unknown>, uuidSeed?: string): Promise<string | null> {
    const chatId = await this.resolveChatId('发送飞书卡片');
    if (chatId === null) return null;
    await this.throttle(chatId);
    const uuid = uuidSeed ? createHash('sha256').update(uuidSeed).digest('hex').slice(0, 36) : undefined;
    const res = await this.callWithRetry(
      (client) =>
        client.im.message.create({
          params: {receive_id_type: 'chat_id'},
          data: {receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card), ...(uuid ? {uuid} : {})},
        }),
      `发送飞书卡片(${chatId})`,
    );
    return res?.data?.message_id ?? res?.message_id ?? null;
  }

  async sendImageKey(imageKey: string): Promise<string | null> {
    const chatId = await this.resolveChatId('发送飞书图片');
    if (chatId === null) return null;
    await this.throttle(chatId);
    const res = await this.callWithRetry(
      (client) =>
        client.im.message.create({
          params: {receive_id_type: 'chat_id'},
          data: {receive_id: chatId, msg_type: 'image', content: JSON.stringify({image_key: imageKey})},
        }),
      `发送飞书图片(${chatId})`,
    );
    return res?.data?.message_id ?? res?.message_id ?? null;
  }

  async uploadImage(filePath: string): Promise<{ok: boolean; imageKey?: string; error?: string}> {
    if (!existsSync(filePath)) return {ok: false, error: `file not found: ${filePath}`};
    let buffer: Buffer;
    try {
      const info = await stat(filePath);
      if (info.size > IMAGE_MAX_BYTES) {
        buffer = await this.compressImage(filePath);
      } else {
        buffer = await readFile(filePath);
      }
    } catch (error) {
      return {ok: false, error: (error as Error).message};
    }

    const res = await this.callWithRetry(
      (client) => client.im.v1.image.create({data: {image_type: 'message', image: buffer}}),
      `上传图片(${path.basename(filePath)})`,
    );
    const key = res?.image_key ?? res?.data?.image_key;
    if (!key) return {ok: false, error: 'im.v1.image.create failed or im:resource missing'};
    return {ok: true, imageKey: String(key)};
  }

  private isDeduplicated(dedupeKey: string, windowMinutes: number): boolean {
    if (!this.db || !dedupeKey) return false;
    const cutoff = new Date(Date.now() - windowMinutes * 60_000).toISOString();
    const row = this.db
      .prepare('SELECT id FROM automation_alerts WHERE dedupe_key = ? AND sent_at >= ? LIMIT 1')
      .get(dedupeKey, cutoff) as {id: string} | undefined;
    return Boolean(row);
  }

  private recordAlert(runKey: string | null | undefined, level: 'P1' | 'P2', kind: string, dedupeKey?: string): void {
    if (!this.db) return;
    this.db
      .prepare('INSERT INTO automation_alerts (id, run_key, level, kind, dedupe_key, sent_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`alt-${randomUUID().slice(0, 12)}`, runKey ?? null, level, kind, dedupeKey ?? null, new Date().toISOString());
  }

  async notifySuccess(input: SuccessNotifyInput): Promise<{sent: boolean; uploadedImages: number; degradedImages: boolean}> {
    const maxImages = input.maxImages ?? 9;
    const doneCount = input.batches.filter((b) => b.status === 'done').length;
    const failCount = input.batches.filter((b) => b.status === 'failed').length;
    const skipCount = input.batches.filter((b) => b.status === 'skipped').length;
    const durationMin = (input.durationMs / 60_000).toFixed(1);

    const lines: string[] = [
      `**链路耗时**：${durationMin} 分钟 ｜ **批次数**：成功 ${doneCount} / 失败 ${failCount} / 跳过 ${skipCount}`,
    ];
    for (const batch of input.batches) {
      const label = [batch.work, batch.character].filter(Boolean).join(' ');
      const dur = batch.durationMs !== undefined ? `（${(batch.durationMs / 60_000).toFixed(1)}m）` : '';
      lines.push(`- \`${batch.batch}\` ${label || ''} · ${batch.style || '-'} · **${batch.status}**${dur}`.trim());
    }
    if (input.failures && input.failures.length > 0) {
      lines.push('', '**失败明细**：');
      for (const failure of input.failures) {
        lines.push(`- \`${failure.node}\`：${failure.reason}`);
      }
    }

    const selectedImages = input.images.slice(0, maxImages);
    const overflowImages = input.images.slice(maxImages);
    const uploaded: Array<{imageKey: string; label: string; path: string}> = [];
    const fallbackPaths: string[] = [];

    for (const image of selectedImages) {
      const up = await this.uploadImage(image.path);
      if (up.ok && up.imageKey) {
        uploaded.push({imageKey: up.imageKey, label: image.label, path: image.path});
      } else {
        fallbackPaths.push(`${image.label}: \`${image.path}\` (${up.error || 'upload failed'})`);
      }
    }
    for (const extra of overflowImages) {
      fallbackPaths.push(`${extra.label} (超出${maxImages}张上限): \`${extra.path}\``);
    }

    if (fallbackPaths.length > 0) {
      lines.push('', '**成品图路径（降级/超出）**：', ...fallbackPaths.map((p) => `- ${p}`));
    }
    lines.push('', `查看日志：\`context-hub automation logs ${input.runKey}\``);

    const baseElements: Array<Record<string, unknown>> = [{tag: 'markdown', content: lines.join('\n')}];
    const embeddedElements = [
      ...baseElements,
      ...uploaded.map((item) => ({
        tag: 'img',
        img_key: item.imageKey,
        alt: {tag: 'plain_text', content: item.label},
      })),
    ];

    const title = `Wizz 链路完成 · ${input.dateLabel}`;
    const color = failCount > 0 ? 'orange' : 'green';
    let card = buildJson2Card({title, color, elements: embeddedElements});

    let splitFollowup = false;
    if (cardBytes(card) > CARD_MAX_BYTES) {
      card = buildJson2Card({title, color, elements: baseElements});
      splitFollowup = true;
    }

    const msgId = await this.sendCard(card, `success:${input.runKey}`);
    if (splitFollowup && msgId) {
      for (const item of uploaded) {
        await this.sendImageKey(item.imageKey);
      }
    }
    return {
      sent: Boolean(msgId),
      uploadedImages: uploaded.length,
      degradedImages: fallbackPaths.length > 0,
    };
  }

  async notifyFailure(input: FailureNotifyInput): Promise<boolean> {
    const level = input.level ?? 'P1';
    const content = [
      `**失败节点**：\`${input.node}\``,
      `**失败原因**：${input.reason}`,
      `**重试情况**：${input.retryInfo}`,
      `**链状态**：${input.chainStatus}`,
      `**建议动作**：\`context-hub automation run ${input.taskId}\` ｜ \`context-hub automation logs ${input.runKey}\``,
      `**日志路径**：\`${input.logDir}\``,
    ].join('\n');

    const card = buildJson2Card({
      title: `[${level}] Wizz 自动化失败 · ${input.taskId}`,
      color: level === 'P1' ? 'red' : 'orange',
      elements: [{tag: 'markdown', content}],
    });
    const sent = await this.sendCard(card, `fail:${input.runKey}:${input.node}`);
    // 只有真的发出去了才记去重键：否则「配置错 / 网络断」会被永久当成「已通知过」。
    if (sent) this.recordAlert(input.runKey, level, 'failure', `fail:${input.runKey}:${input.node}`);
    return Boolean(sent);
  }

  async notifyAlert(input: AlertNotifyInput): Promise<boolean> {
    const dedupeKey = input.dedupeKey ?? `${input.level}:${input.kind}:${input.runKey ?? 'global'}`;
    const windowMin = input.dedupeWindowMinutes ?? 60;
    if (this.isDeduplicated(dedupeKey, windowMin)) {
      return false;
    }
    const content = [
      `**信号**：${input.signal}`,
      `**影响范围**：${input.scope}`,
      `**立即动作**：${input.action}`,
      ...(input.runKey ? [`**相关 runId**：\`${input.runKey}\``] : []),
    ].join('\n');
    const card = buildJson2Card({
      title: `[${input.level}] ${input.title}`,
      color: input.level === 'P1' ? 'red' : 'orange',
      elements: [{tag: 'markdown', content}],
    });
    const sent = await this.sendCard(card);
    // 同上：发送失败不写去重记录，下一次 tick 还能重试。
    if (sent) this.recordAlert(input.runKey, input.level, input.kind, dedupeKey);
    return Boolean(sent);
  }
}
