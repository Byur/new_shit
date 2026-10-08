import { SkillLessonVideo } from "./SkillLessonVideo";

const durations = [300, 390, 420, 420, 390, 390];
export const skillConceptV2DurationInFrames = durations.reduce((sum, duration) => sum + duration, 0);

export const SkillConceptV2Video: React.FC = () => <SkillLessonVideo config={{ footer: "SKILL CONCEPTS / V2", durations, beats: [
  { kicker: "00 / THE PROBLEM", title: "为什么经验总在下一次任务里失效？", description: "如果经验只留在人的记忆或一次对话中，下次任务依然要从头猜。", caption: "真正缺的不是更多提示，而是能被重新调用的工作方法。", accent: "#ff806d", kind: "contrast", left: { label: "一次性经验", items: ["散在聊天记录", "依赖临场想起", "难以复查边界", "无法稳定复用"] }, right: { label: "可加载 Skill", items: ["适用条件明确", "步骤可以执行", "验收可以复查", "持续迭代积累"] } },
  { kicker: "01 / THE IDEA", title: "Skill 是被组织好的工作能力", description: "它不是长提示词，也不是单个脚本；它把方法、边界和检查放在同一份可读取的结构里。", caption: "Skill 的价值在于把隐性经验，变成显性的可执行约定。", accent: "#ae8bff", kind: "parts", items: ["何时适用", "怎样推进", "调用哪些工具", "如何验收"] },
  { kicker: "02 / FROM EXPERIENCE", title: "把一次做对，变成下一次的起点", description: "经验先被提炼为判断，再被写成流程，最后通过真实任务继续校正。", caption: "Skill 不是冻结规则，而是让经验有一个能持续修订的容器。", accent: "#43d9ff", kind: "flow", items: ["真实任务", "提炼判断", "写成 Skill", "再次调用", "回收改进"] },
  { kicker: "03 / BOUNDARY", title: "Skill 提供方法，不替人承担判断", description: "面对新证据、冲突条件或模糊需求，Agent 和人仍需判断该不该继续、怎样调整。", caption: "方法降低猜测，不会取消思考。", accent: "#ffd166", kind: "contrast", left: { label: "Skill 负责", items: ["范围与边界", "默认步骤", "工具顺序", "验收口径"] }, right: { label: "执行者负责", items: ["理解目标", "处理例外", "评估证据", "做出取舍"] } },
  { kicker: "04 / ASSET", title: "团队资产不是文档堆，而是可运行的约定", description: "一份真正有用的 Skill 会在任务发生时被读取、执行、验证，并在问题中继续变好。", caption: "被实际使用和检验，才让知识从说明变成能力。", accent: "#6df1b1", kind: "loop", items: ["任务触发", "加载方法", "执行与检查", "发现缺口", "更新 Skill"] },
  { kicker: "05 / TAKEAWAY", title: "让经验留下来，也让下一次更快开始", description: "当知识能被加载、执行和审查，复杂工作就不必每次从空白重新发明。", caption: "Skill 的终点不是一份文件，而是更稳定的协作能力。", accent: "#6df1b1", kind: "takeaway", items: ["把经验写清楚", "把边界留出来", "把检查做进去", "让每次任务继续改进"] },
] }} />;
