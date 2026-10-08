import { SkillLessonVideo } from "./SkillLessonVideo";

const durations = [300, 420, 390, 450, 420, 390];
export const agentAndSkillV2DurationInFrames = durations.reduce((sum, duration) => sum + duration, 0);

export const AgentAndSkillV2Video: React.FC = () => <SkillLessonVideo config={{ footer: "AGENT + SKILL / V2", durations, beats: [
  { kicker: "00 / THE QUESTION", title: "Agent 和 Skill，分别在工作流里做什么？", description: "一个推进任务，一个提供可复用的方法。关键不在名词，而在它们怎样配合。", caption: "先分清角色与能力，才能看懂 AI 工作流为什么会更稳定。", accent: "#43d9ff", kind: "contrast", left: { label: "Agent / 角色", items: ["理解目标", "观察结果", "调用工具", "处理反馈"] }, right: { label: "Skill / 能力", items: ["说明适用范围", "给出工作顺序", "保留关键约束", "定义验收方式"] } },
  { kicker: "01 / AGENT", title: "Agent 是一个持续观察和行动的循环", description: "它不会只给出静态答案，而是在目标、工具结果和新反馈之间不断调整下一步。", caption: "Agent 的核心不是输出一次答案，而是把任务往前推进。", accent: "#43d9ff", kind: "loop", items: ["理解目标", "制定下一步", "调用工具", "观察结果", "继续调整"] },
  { kicker: "02 / SKILL", title: "Skill 为这个循环提供专业的默认路径", description: "它把某一类任务中反复有效的判断和顺序预先组织好，让执行更少依赖现场猜测。", caption: "Skill 让 Agent 在合适的场景里，从更好的起点开始。", accent: "#ae8bff", kind: "parts", items: ["触发条件", "操作步骤", "输入与工具", "质量门槛"] },
  { kicker: "03 / TOGETHER", title: "Agent 加载 Skill，再把方法落到真实任务里", description: "Skill 不替 Agent 做决策；Agent 也不必每次重新发明流程。两者组合形成可检查的执行路径。", caption: "方法进入循环，循环再用真实证据修正方法。", accent: "#6df1b1", kind: "flow", items: ["用户目标", "匹配 Skill", "执行 Agent", "检查结果", "交付与反馈"] },
  { kicker: "04 / EXAMPLE", title: "同样做视频，差别在过程是否可见", description: "没有方法时，问题往往在最后才出现；带着 Skill 时，脚本、视觉和验收都有前置检查点。", caption: "Skill 不保证没有问题，但让问题更早出现、更容易修正。", accent: "#ffd166", kind: "contrast", left: { label: "临场推进", items: ["先做再说", "画面靠感觉", "最后才审查", "返工成本高"] }, right: { label: "方法驱动", items: ["先定教学目标", "设计可见证据", "抽样检查画面", "headless 交付"] } },
  { kicker: "05 / TAKEAWAY", title: "Agent 是行动者，Skill 是可复用的能力", description: "一个保证任务继续前进，一个让前进的路径更清楚、更可靠、更容易协作。", caption: "角色负责推进，能力负责把经验留在路径里。", accent: "#6df1b1", kind: "takeaway", items: ["目标进入工作流", "Skill 提供方法", "Agent 推进执行", "结果通过检查", "经验回到下一次任务"] },
] }} />;
