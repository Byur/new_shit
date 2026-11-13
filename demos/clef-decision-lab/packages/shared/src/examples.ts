import tavern from '../../../fixtures/tavern-learning.json';
import { requestSchema, type DecisionRequest } from './schema';

export const exampleScenarios = [
  { id: 'A', label: '钱包找回', changedPath: null, description: '初始状态：希望修复友谊，昨天得到帮助，现场安全。先运行这组，作为对比基准。' },
  { id: 'B', label: '钱包被偷', changedPath: 'memory[1]', description: '相对 A 只改变 memory[1]：帮助找回钱包 → 偷走钱包。观察友好交谈意愿与社交行动的概率变化。' },
  { id: 'C', label: '暂不和解', changedPath: 'goal', description: '相对 A 只改变 goal：修复友谊 → 今天保持距离、独自休息。观察模型如何回应当前目标。' },
  { id: 'D', label: '现场危险', changedPath: 'observation.situation', description: '相对 A 只改变 observation.situation：安全安静 → 酒馆起火且有可用安全出口。观察离开必要性和行动选择。' },
] as const;
export type ExampleId = typeof exampleScenarios[number]['id'];
const baseline = requestSchema.parse(tavern);

export function exampleRequest(which: ExampleId, model: DecisionRequest['model'] = 'clef-flash'): DecisionRequest {
  const request = structuredClone(baseline);
  request.model = model;
  // The fixture is a structured state; these variants each alter exactly one leaf.
  const state = request.state as { goal: string; memory: string[]; observation: { situation: string } };
  if (which === 'B') state.memory[1] = '昨天爱丽丝偷走了艾琳的钱包，艾琳亲眼看到了这件事';
  if (which === 'C') state.goal = '今天暂时不修复关系；与爱丽丝保持距离，独自安静休息';
  if (which === 'D') state.observation.situation = '就在艾琳认出爱丽丝后的几秒内，酒馆突然起火，浓烟开始蔓延，继续停留有即时人身危险。爱丽丝被烟雾惊动，刚从邻桌起身，此刻仍在距艾琳约三米处，已经开始自行向安全出口撤离；她尚未发现艾琳，两人没有目光接触或交谈。艾琳已经坐下，茶仍在桌上；她附近的安全出口畅通，可以立即起身离开，无需接近爱丽丝或等待她。';
  return request;
}

const questionFingerprint = JSON.stringify(baseline.questions);
const stateFingerprints = new Map(exampleScenarios.map(scenario => [scenario.id, JSON.stringify(exampleRequest(scenario.id).state)]));
export function identifyExample(request: DecisionRequest) {
  if (JSON.stringify(request.questions) !== questionFingerprint) return null;
  const state = JSON.stringify(request.state);
  return exampleScenarios.find(scenario => state === stateFingerprints.get(scenario.id)) ?? null;
}
