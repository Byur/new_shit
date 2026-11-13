import { z } from 'zod';
import { parseTree, printParseErrorCode, type ParseError, type Node } from 'jsonc-parser';

// Keep arbitrary JSON opaque to Vue's recursive reactive type unwrapping.
const json: z.ZodType<unknown> = z.json();
const content = z.union([z.string().trim().min(1, '内容不能为空'), z.record(z.string(), json), z.array(json)]);
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'ID 只能包含字母、数字、_、.、-')
  .refine(value => !['__proto__', 'constructor', 'prototype'].includes(value), '不能使用保留 ID');
const optionId = z.string().min(1).max(100).refine(value => value.trim().length > 0, '候选 ID 不能为空')
  .refine(value => !['__proto__', 'constructor', 'prototype'].includes(value), '不能使用保留 ID');
const instructions = content;
export const questionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('noul'), instructions, criteria: z.object({ true: json.optional(), false: json.optional() }).strict().optional() }).strict(),
  z.object({ type: z.literal('choice'), instructions, criteria: z.record(optionId, json)
    .refine(c => Object.keys(c).length >= 2 && Object.keys(c).length <= 255, 'choice 需要 2–255 个候选项') }).strict(),
  z.object({ type: z.literal('score'), instructions, criteria: z.array(content).min(2, 'score 至少需要两个等级').max(10, 'score 最多 10 个等级') }).strict(),
]);
export const requestSchema = z.object({
  model: z.enum(['clef-flash', 'clef']),
  state: content,
  questions: z.record(id, questionSchema).refine(q => Object.keys(q).length >= 1 && Object.keys(q).length <= 64, '需要 1–64 个问题'),
}).strict();

// JSON.parse silently overwrites duplicate IDs. Reject them before parsing, in both UI and API.
export function parseJson(text: string): unknown {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (errors.length || !tree) {
    const first = errors[0];
    throw new Error(first ? `JSON 格式错误：${printParseErrorCode(first.error)}（位置 ${first.offset}）` : 'JSON 不能为空');
  }
  function visit(node: Node) {
    if (node.type === 'object') {
      const seen = new Set<string>();
      for (const child of node.children || []) {
        const key = child.children?.[0]?.value as string;
        if (seen.has(key)) throw new Error(`JSON 包含重复 ID / 字段：${key}`);
        seen.add(key);
      }
    }
    node.children?.forEach(visit);
  }
  visit(tree);
  return JSON.parse(text);
}

export function parseRequest(text: string): DecisionRequest {
  return requestSchema.parse(parseJson(text));
}
export function describeError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map(i => `${i.path.join('.') || '请求'}：${i.message}`).join('；');
  return error instanceof Error ? error.message : '输入无效';
}
export type DecisionRequest = z.infer<typeof requestSchema>;
export type Question = z.infer<typeof questionSchema>;
