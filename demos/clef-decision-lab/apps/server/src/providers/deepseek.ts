export type WritingMode = 'propose' | 'phrase' | 'conversation';

export interface WritingRequest {
  mode: WritingMode;
  model: 'deepseek-flash';
  state: Record<string, unknown>;
  task: Record<string, unknown>;
}

export class WritingProviderError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function runDeepSeek(
  input: WritingRequest,
  apiKey: string,
  options: { signal?: AbortSignal; timeoutMs?: number; fetcher?: typeof fetch } = {},
) {
  if (!apiKey) throw new WritingProviderError('NOT_CONFIGURED', '服务端缺少 DEEPSEEK_API_KEY。', 503);

  const system = input.mode === 'conversation'
    ? `你负责为鲍勃写下一条自然、具体的回复，并更新轻量对话状态。

输入契约：完整历史只在 state.conversation.messages 中出现一次。每项有 speaker 和 text：speaker=player 是玩家，speaker=bob 是鲍勃。state.conversation.dialogue_state 是摘要，可能不完整；以原始消息为准。

角色指代：每条消息中的“我/你”都以该条消息的 speaker 为准。玩家消息里的“我”是玩家，鲍勃消息里的“我”是鲍勃。准确保留每个行动的执行者；不得把玩家答应做的事改成鲍勃要做，也不得反过来。

决策模型给出的 selected_intent 是建议，不是事实。如果它与玩家原话、消息中的明确分工或角色事实矛盾，优先遵守原始消息和角色事实，选择最小幅度的调整，并在返回的 intent 中说明调整。对待回答问题，也要根据历史原文和当前玩家发言自行判断；不要把其他模型的分类当作已证实事实。已回答的问题不得重复追问；只在仍缺少会改变鲍勃选择的关键信息时追问。

本实验台只推进对话，不执行物理行动。鲍勃可以说自己打算或承诺去做某事，但不得把尚未模拟的移动、观察或结果写成已经发生。区分玩家明确说过的内容、鲍勃说过的内容、角色推测和未执行的计划。

dialogue_state 必须是更新后的完整累计状态。pending_questions 只列鲍勃明确提出且仍未回答的问题；answered_details 保留玩家明确表达的信息，并保留行动者；bob_commitments 只记录鲍勃亲口说出的承诺，不表示承诺已执行。必须返回 JSON 对象，字段为 speech (string)、intent (string)、dialogue_state ({summary: string, pending_questions: string[], answered_details: string[], bob_commitments: string[]})、next_candidates ({id: string, intent: string}[])。next_candidates 是下一轮可重新评估的建议，不是事实或已执行行动，返回 2–4 项；id 使用小写字母、数字和下划线。只输出 JSON，不输出推理过程。`
    : input.mode === 'propose'
    ? '你负责当前角色这一刻的行动提案。只能使用输入状态中的个人记录。检查候选是否确实不足；可以提出候选之外的新做法，也可以选择澄清或暂缓。给出角色自己能发起的单个第一步、此刻可说的一句话和需要真实发生的后续条件。不得替他人作决定，不得假定未观察到的事实。必须返回 JSON 对象，字段为 plan_type (new|reuse|defer)、intent (string)、first_step ({type: say|move|observe|wait|ask|defer, target: string|null, content: string})、speech (string)、continuation_condition (string)、schedule_change (null 或 {operation: replace, from: string, to: string, commitment_quote: string, reason: string})、basis_refs (string[])、assumptions (string[])。没有明确承诺时 schedule_change 必须为 null。commitment_quote 必须是 speech 中逐字连续出现的文本。只输出 JSON，不输出推理过程。'
    : '你负责为已经选定的意图写一句角色能说的话，并给出落实该意图的单个第一步。只使用输入状态中的个人记录。不得改变所选意图，不得替他人作决定、增加承诺或把尚未发生的行动写成事实。必须返回 JSON 对象，字段为 plan_type (phrase)、intent (string)、first_step ({type: say|move|observe|wait|ask|defer, target: string|null, content: string})、speech (string)、continuation_condition (string)、schedule_change (null 或 {operation: replace, from: string, to: string, commitment_quote: string, reason: string})、basis_refs (string[])、assumptions (string[])。日程变更只能在台词明确承诺时提出；没有明确承诺时 schedule_change 必须为 null。commitment_quote 必须是 speech 中逐字连续出现的文本。只输出 JSON，不输出推理过程。若意图和事实无法相容，设置 plan_type 为 invalid 并说明原因。';

  const startedAt = performance.now();
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 60_000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  try {
    const response = await (options.fetcher ?? fetch)('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: input.mode === 'conversation' ? 1800 : 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ mode: input.mode, state: input.state, task: input.task }) },
        ],
      }),
      signal,
    });
    const payload = await response.json() as Record<string, any>;
    if (!response.ok || payload.error) {
      const status = response.status || 502;
      const code = status === 401 || status === 403 ? 'AUTH_ERROR' : status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR';
      throw new WritingProviderError(code, `DeepSeek 请求失败（HTTP ${status}）。`, status);
    }
    const choice = payload.choices?.[0];
    return {
      runId: crypto.randomUUID(),
      provider: 'DeepSeek',
      model: input.model,
      mode: input.mode,
      requestedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      request: { system, user: { mode: input.mode, state: input.state, task: input.task } },
      finishReason: choice?.finish_reason ?? null,
      content: choice?.message?.content ?? '',
      reasoningMode: 'disabled',
      usage: payload.usage ?? null,
      raw: payload,
    };
  } catch (error) {
    if (error instanceof WritingProviderError) throw error;
    if (options.signal?.aborted || timeout.aborted) {
      throw new WritingProviderError(options.signal?.aborted ? 'CANCELLED' : 'TIMEOUT', 'DeepSeek 请求已取消或超时。', options.signal?.aborted ? 499 : 504);
    }
    throw new WritingProviderError('NETWORK_ERROR', '无法连接 DeepSeek，请检查网络后重试。', 502);
  }
}
