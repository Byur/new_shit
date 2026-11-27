/** 本地 Ollama HTTP 客户端：意图分类（JSON Schema + think:false）与健康探测。 */

/** 默认本地 Ollama 地址。 */
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

/** 默认保活时长：与 Route 2 复用同一个 Qwen 模型，避免频繁重载显存/内存。 */
export const DEFAULT_KEEP_ALIVE = '30m';

/**
 * 规范化基础 URL（去掉末尾斜杠）。
 *
 * @param baseUrl 配置的基础地址
 * @returns 规范化 URL
 */
export function normalizeBaseUrl(baseUrl) {
  const raw = typeof baseUrl === 'string' && baseUrl.trim() !== '' ? baseUrl.trim() : DEFAULT_OLLAMA_BASE_URL;
  return raw.replace(/\/+$/, '');
}

/**
 * 从 Ollama 响应正文里提取 JSON 对象：兼容偶尔包裹的 markdown 代码块。
 *
 * @param content 助手输出文本
 * @returns 解析后的对象；解析失败返回 undefined
 */
export function parseJsonObject(content) {
  if (typeof content !== 'string') return undefined;
  const trimmed = content.trim();
  if (trimmed === '') return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // 尝试提取 ```json ... ``` 或首尾大括号片段。
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced !== null ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 建 Ollama 轻量客户端。
 *
 * @param options.fetchImpl 可注入的 fetch（测试用，默认 `globalThis.fetch`）
 * @returns 客户端句柄：`chatJson()`、`healthCheck()`
 */
export function createOllamaClient({ fetchImpl = globalThis.fetch } = {}) {
  /**
   * 调 `/api/chat` 获取结构化 JSON 输出。
   *
   * 显式传 `think: false` 关闭 Qwen3 默认思考链，保证分类在数百毫秒内完成。
   *
   * @param options.baseUrl Ollama 地址
   * @param options.model 模型名（如 `qwen3:8b`）
   * @param options.messages 对话消息数组
   * @param options.schema JSON Schema（传给 Ollama `format`）
   * @param options.timeoutMs 超时毫秒数
   * @param options.keepAlive 保活时长
   * @returns `{ ok, data?, raw?, durationMs, error? }`
   */
  async function chatJson({
    baseUrl = DEFAULT_OLLAMA_BASE_URL,
    model,
    messages,
    schema,
    timeoutMs = 3000,
    keepAlive = DEFAULT_KEEP_ALIVE,
  }) {
    if (typeof fetchImpl !== 'function') {
      return { ok: false, durationMs: 0, error: '当前运行环境缺少 fetch' };
    }
    if (typeof model !== 'string' || model.trim() === '') {
      return { ok: false, durationMs: 0, error: '未配置 Ollama 分类模型' };
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(200, Number(timeoutMs) || 3000));
    timer.unref?.();
    try {
      const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: model.trim(),
          stream: false,
          think: false,
          keep_alive: keepAlive,
          ...(schema !== undefined ? { format: schema } : {}),
          options: { temperature: 0 },
          messages,
        }),
      });
      if (!response.ok) {
        return {
          ok: false,
          durationMs: Date.now() - startedAt,
          error: `Ollama HTTP ${response.status}`,
        };
      }
      const payload = await response.json();
      const raw = String(payload?.message?.content ?? '');
      const data = parseJsonObject(raw);
      if (data === undefined) {
        return {
          ok: false,
          raw,
          durationMs: Date.now() - startedAt,
          error: 'Ollama 返回内容不是合法 JSON 对象',
        };
      }
      return { ok: true, data, raw, durationMs: Date.now() - startedAt };
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: aborted ? `Ollama 分类超时（${timeoutMs}ms）` : String(error?.message ?? error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 探测 Ollama 是否在线及已拉取的模型列表（`/router status` 用）。
   *
   * @param options.baseUrl Ollama 地址
   * @param options.timeoutMs 超时毫秒数
   * @returns `{ ok, models?, error? }`
   */
  async function healthCheck({ baseUrl = DEFAULT_OLLAMA_BASE_URL, timeoutMs = 1500 } = {}) {
    if (typeof fetchImpl !== 'function') return { ok: false, error: '缺少 fetch' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(200, Number(timeoutMs) || 1500));
    timer.unref?.();
    try {
      const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
      const payload = await response.json();
      const models = Array.isArray(payload?.models)
        ? payload.models.map((item) => String(item?.name ?? '')).filter((name) => name !== '')
        : [];
      return { ok: true, models };
    } catch (error) {
      return { ok: false, error: error?.name === 'AbortError' ? '连接超时' : String(error?.message ?? error) };
    } finally {
      clearTimeout(timer);
    }
  }

  return { chatJson, healthCheck };
}
