import { useGsapTimeline } from "@remotion/gsap";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

const C = {
  bg: "#080d17",
  panel: "#111a2a",
  text: "#f6f8fb",
  muted: "#9aa9bf",
  cyan: "#43d9ff",
  green: "#6df1b1",
  yellow: "#ffd166",
  coral: "#ff806d",
  purple: "#ae8bff",
};
const FPS = 30;
const DURATION = 5400;

type Scene = { from: number; to: number; kicker: string; title: string; description: string; kind: "hook" | "agent" | "skill" | "relation" | "example" | "takeaway" };
type Cue = { from: number; to: number; text: string };

const scenes: Scene[] = [
  { from: 0, to: 600, kicker: "00 / THE QUESTION", title: "Agent 和 Skill，到底是什么关系？", description: "在 AI 工作流里，一个负责推进任务，一个负责提供可复用的方法。", kind: "hook" },
  { from: 600, to: 1500, kicker: "01 / THE AGENT", title: "Agent 是一个会推进任务的执行角色", description: "它接收目标、拆分步骤、调用工具、观察结果，并根据反馈继续行动。", kind: "agent" },
  { from: 1500, to: 2400, kicker: "02 / THE SKILL", title: "Skill 是一套可复用的工作能力", description: "它把经验、约束、工具顺序和验收方式，组织成 agent 可以加载的方法包。", kind: "skill" },
  { from: 2400, to: 3900, kicker: "03 / THE RELATION", title: "Agent 使用 Skill，把目标变成可靠路径", description: "Skill 不替 agent 做决定，而是让 agent 少猜一点，多按约定执行和检查。", kind: "relation" },
  { from: 3900, to: 4800, kicker: "04 / AN EXAMPLE", title: "做一支视频：没有 Skill 和有 Skill", description: "同一个目标，差别不只是代码多少，而是过程中有没有稳定的视觉和质量要求。", kind: "example" },
  { from: 4800, to: 5400, kicker: "05 / TAKEAWAY", title: "Agent 是角色，Skill 是能力包", description: "把它们组合起来，AI 才更像一个可协作、可检查、可复用的工作系统。", kind: "takeaway" },
];

const cues: Cue[] = [
  { from: 0, to: 180, text: "Agent 和 Skill，到底是什么关系？" },
  { from: 180, to: 390, text: "一个负责做事，一个负责提供方法。" },
  { from: 390, to: 600, text: "理解这层关系，才能看懂今天的 AI 工作流。" },
  { from: 600, to: 840, text: "Agent 是一个会推进任务的执行角色。" },
  { from: 840, to: 1080, text: "它接收目标，拆分步骤，调用工具。" },
  { from: 1080, to: 1290, text: "然后观察结果，根据反馈继续行动。" },
  { from: 1290, to: 1500, text: "重点是：Agent 是执行循环，不是一个静态答案。" },
  { from: 1500, to: 1740, text: "Skill 是一套可复用的工作能力。" },
  { from: 1740, to: 1980, text: "在 Codex、Claude Code 等 coding agent 里，它可能被叫作 Skills。" },
  { from: 1980, to: 2190, text: "在 Cursor、GitHub Copilot 等工具里，也可能以 Rules 或 Instructions 出现。" },
  { from: 2190, to: 2400, text: "它是一份 agent 可以加载的方法包。" },
  { from: 2400, to: 2700, text: "用户给 Agent 一个目标：做一支教学视频。" },
  { from: 2700, to: 3000, text: "Agent 加载合适的 Skill，获得范围和执行顺序。" },
  { from: 3000, to: 3300, text: "Skill 指导它规划脚本、视觉、工具和检查点。" },
  { from: 3300, to: 3600, text: "Agent 仍然负责判断、调用工具和处理结果。" },
  { from: 3600, to: 3900, text: "所以关系是：Agent 执行，Skill 约束并增强执行。" },
  { from: 3900, to: 4200, text: "没有 Skill：猜测、试错、返工。" },
  { from: 4200, to: 4500, text: "有了 Skill：识别、加载、执行、检查。" },
  { from: 4500, to: 4800, text: "Skill 不保证结果，但让过程更可复用。" },
  { from: 4800, to: 5100, text: "Agent 是角色，Skill 是能力包。" },
  { from: 5100, to: 5400, text: "组合起来，AI 才更像一个可检查的工作系统。" },
];

const ease = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
const currentScene = (frame: number) => scenes.find((scene) => frame >= scene.from && frame < scene.to) ?? scenes[0];
const currentCue = (frame: number) => cues.find((cue) => frame >= cue.from && frame < cue.to);

const Panel: React.FC<{ children: ReactNode; style?: CSSProperties; accent?: string; className?: string }> = ({ children, style, accent, className }) => <div className={className} style={{ border: `1px solid ${accent ? `${accent}99` : "rgba(246,248,251,0.14)"}`, background: "rgba(15,24,40,0.92)", borderRadius: 8, boxShadow: accent ? `0 0 38px ${accent}22` : "0 18px 60px rgba(0,0,0,0.2)", ...style }}>{children}</div>;

const Background: React.FC = () => <AbsoluteFill style={{ background: "radial-gradient(circle at 15% 20%, rgba(67,217,255,0.14), transparent 28%), radial-gradient(circle at 82% 76%, rgba(174,139,255,0.13), transparent 32%), #080d17" }}><AbsoluteFill style={{ opacity: 0.16, backgroundImage: "linear-gradient(rgba(246,248,251,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(246,248,251,0.08) 1px, transparent 1px)", backgroundSize: "72px 72px" }} /></AbsoluteFill>;
const Header: React.FC<{ scene: Scene }> = ({ scene }) => <div style={{ position: "absolute", left: 88, top: 72, width: 850 }}><div style={{ color: C.green, fontSize: 28, fontWeight: 800, letterSpacing: 1, marginBottom: 22 }}>{scene.kicker}</div><div style={{ color: C.text, fontSize: 66, lineHeight: 1.08, fontWeight: 900 }}>{scene.title}</div><div style={{ color: C.muted, fontSize: 29, lineHeight: 1.48, marginTop: 26, maxWidth: 810 }}>{scene.description}</div></div>;
const CaptionBar: React.FC = () => { const cue = currentCue(useCurrentFrame()); return <div style={{ position: "absolute", left: 154, right: 154, bottom: 64, minHeight: 106, display: "flex", justifyContent: "center", alignItems: "center", padding: "18px 40px", background: "rgba(3,8,20,0.94)", border: "1px solid rgba(246,248,251,0.14)", borderRadius: 8 }}><div style={{ color: "#fff", fontSize: 34, lineHeight: 1.38, textAlign: "center", fontWeight: 700 }}>{cue?.text}</div></div>; };
const Rail: React.FC = () => { const frame = useCurrentFrame(); return <div style={{ position: "absolute", left: 88, right: 88, bottom: 31, height: 3, background: "rgba(246,248,251,0.15)" }}><div style={{ width: `${(frame / DURATION) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.cyan}, ${C.green}, ${C.yellow}, ${C.coral})` }} /></div>; };

const HookVisual: React.FC<{ p: number }> = ({ p }) => {
  const ref = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => timeline.from(selector(".hook-card"), { opacity: 0, y: 35, duration: 0.5, stagger: 0.18 }, 0.2), { dependencies: [] });
  return <div ref={ref} style={{ position: "absolute", right: 120, top: 205, width: 830, height: 510, opacity: p }}><Panel className="hook-card" accent={C.coral} style={{ position: "absolute", left: 0, top: 70, width: 330, height: 330, padding: 30 }}><div style={{ color: C.coral, fontFamily: "Menlo, monospace", fontSize: 23 }}>USER / GOAL</div><div style={{ color: C.text, fontSize: 30, fontWeight: 800, marginTop: 40 }}>做一支视频</div><div style={{ color: C.muted, fontSize: 23, lineHeight: 1.5, marginTop: 30 }}>主题、受众、时长<br />风格、交付格式</div></Panel><div className="hook-card" style={{ position: "absolute", left: 354, top: 220, width: 120, height: 4, background: C.yellow, transformOrigin: "left center" }} /><Panel className="hook-card" accent={C.green} style={{ position: "absolute", right: 0, top: 20, width: 360, height: 430, padding: 30 }}><div style={{ color: C.green, fontFamily: "Menlo, monospace", fontSize: 23 }}>AI WORKFLOW</div><div style={{ color: C.text, fontSize: 30, fontWeight: 800, marginTop: 38 }}>Agent + Skill</div><div style={{ color: C.muted, fontSize: 23, lineHeight: 1.55, marginTop: 30 }}>推进任务<br />加载方法<br />调用工具<br />检查结果</div></Panel></div>;
};

const AgentVisual: React.FC<{ p: number }> = ({ p }) => {
  const ref = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => { timeline.from(selector(".agent-node"), { opacity: 0, scale: 0.78, duration: 0.38, stagger: 0.18 }, 600 / FPS + 0.18); timeline.from(selector(".agent-link"), { scaleX: 0, duration: 0.25, stagger: 0.18, transformOrigin: "left center" }, 600 / FPS + 0.55); }, { dependencies: [] });
  const nodes = [["observe", "观察结果", C.cyan], ["plan", "拆分步骤", C.yellow], ["act", "调用工具", C.coral], ["check", "检查反馈", C.green]] as const;
  return <div ref={ref} style={{ position: "absolute", right: 120, top: 215, width: 850, height: 500, opacity: p }}><div style={{ position: "absolute", left: 56, top: 235, width: 730, height: 3, background: "rgba(246,248,251,0.2)" }} />{nodes.map(([name, label, color], i) => <div key={name}><Panel className="agent-node" accent={color} style={{ position: "absolute", left: 10 + i * 205, top: i % 2 === 0 ? 80 : 290, width: 170, height: 120, padding: 20, color: C.text }}><div style={{ color, fontFamily: "Menlo, monospace", fontSize: 19 }}>{name}</div><div style={{ fontSize: 25, fontWeight: 800, marginTop: 20 }}>{label}</div></Panel>{i < nodes.length - 1 && <div className="agent-link" style={{ position: "absolute", left: 175 + i * 205, top: i % 2 === 0 ? 195 : 235, width: 35, height: 3, background: color }} />}</div>)}<div style={{ position: "absolute", right: 0, top: 16, color: C.muted, fontFamily: "Menlo, monospace", fontSize: 21 }}>AGENT = LOOP</div></div>;
};

const SkillVisual: React.FC<{ p: number }> = ({ p }) => {
  const ref = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => timeline.from(selector(".skill-part"), { opacity: 0, y: 30, duration: 0.4, stagger: 0.16 }, 1500 / FPS + 0.22), { dependencies: [] });
  const parts = [["CONTEXT", "适用范围", C.cyan], ["METHOD", "执行步骤", C.green], ["TOOLS", "工具入口", C.yellow], ["QA", "验收标准", C.coral]] as const;
  return <div ref={ref} style={{ position: "absolute", right: 108, top: 200, width: 870, height: 560, opacity: p }}><Panel accent={C.purple} style={{ position: "absolute", inset: 0, padding: 30 }}><div style={{ color: C.purple, fontFamily: "Menlo, monospace", fontSize: 22 }}>SKILL / REUSABLE CAPABILITY</div><div style={{ color: C.text, fontSize: 27, fontWeight: 800, marginTop: 18 }}>一份可加载的方法包</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, position: "absolute", left: 30, right: 30, top: 145 }}>{parts.map(([name, label, color]) => <Panel className="skill-part" key={name} accent={color} style={{ height: 130, padding: 22 }}><div style={{ color, fontFamily: "Menlo, monospace", fontSize: 20 }}>{name}</div><div style={{ color: C.text, fontSize: 27, fontWeight: 800, marginTop: 24 }}>{label}</div></Panel>)}</div><div className="skill-part" style={{ position: "absolute", left: 30, right: 30, bottom: 82, color: C.muted, fontSize: 20 }}>经验 + 约束 + 工具顺序 + 检查方式</div><div className="skill-part" style={{ position: "absolute", left: 30, right: 30, bottom: 28, color: C.text, fontSize: 18 }}>Codex / Skills    Claude Code / Skills    Cursor / Rules    Copilot / Instructions</div></Panel></div>;
};

const RelationVisual: React.FC<{ p: number }> = ({ p }) => {
  const ref = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => { timeline.from(selector(".relation-skill"), { opacity: 0, x: -90, duration: 0.5 }, 2400 / FPS + 0.22); timeline.from(selector(".relation-agent"), { opacity: 0, scale: 0.82, duration: 0.5 }, 2400 / FPS + 0.8); timeline.from(selector(".relation-output"), { opacity: 0, x: 90, duration: 0.5 }, 2400 / FPS + 1.4); timeline.from(selector(".relation-arrow"), { scaleX: 0, duration: 0.32, stagger: 0.25, transformOrigin: "left center" }, 2400 / FPS + 1.02); }, { dependencies: [] });
  return <div ref={ref} style={{ position: "absolute", right: 90, top: 220, width: 940, height: 450, opacity: p }}><Panel className="relation-skill" accent={C.purple} style={{ position: "absolute", left: 0, top: 70, width: 245, height: 260, padding: 26 }}><div style={{ color: C.purple, fontFamily: "Menlo, monospace", fontSize: 21 }}>LOAD</div><div style={{ color: C.text, fontSize: 29, fontWeight: 800, marginTop: 32 }}>Skill</div><div style={{ color: C.muted, fontSize: 21, lineHeight: 1.5, marginTop: 22 }}>范围<br />步骤<br />标准</div></Panel><div className="relation-arrow" style={{ position: "absolute", left: 255, top: 200, width: 105, height: 4, background: C.yellow }} /><Panel className="relation-agent" accent={C.green} style={{ position: "absolute", left: 360, top: 25, width: 245, height: 350, padding: 26 }}><div style={{ color: C.green, fontFamily: "Menlo, monospace", fontSize: 21 }}>EXECUTE</div><div style={{ color: C.text, fontSize: 29, fontWeight: 800, marginTop: 32 }}>Agent</div><div style={{ color: C.muted, fontSize: 21, lineHeight: 1.5, marginTop: 22 }}>理解目标<br />调用工具<br />处理反馈<br />继续推进</div></Panel><div className="relation-arrow" style={{ position: "absolute", left: 615, top: 200, width: 105, height: 4, background: C.yellow }} /><Panel className="relation-output" accent={C.cyan} style={{ position: "absolute", right: 0, top: 70, width: 245, height: 260, padding: 26 }}><div style={{ color: C.cyan, fontFamily: "Menlo, monospace", fontSize: 21 }}>CHECK</div><div style={{ color: C.text, fontSize: 29, fontWeight: 800, marginTop: 32 }}>结果</div><div style={{ color: C.muted, fontSize: 21, lineHeight: 1.5, marginTop: 22 }}>预览<br />核对<br />交付</div></Panel></div>;
};

const ExampleVisual: React.FC<{ p: number }> = ({ p }) => {
  const ref = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => { timeline.from(selector(".example-bad"), { opacity: 0, x: -55, duration: 0.45 }, 3900 / FPS + 0.2); timeline.from(selector(".example-good"), { opacity: 0, x: 55, duration: 0.45 }, 3900 / FPS + 0.55); timeline.from(selector(".example-check"), { opacity: 0, y: 22, duration: 0.35, stagger: 0.12 }, 3900 / FPS + 1.05); }, { dependencies: [] });
  return <div ref={ref} style={{ position: "absolute", right: 110, top: 205, width: 870, height: 540, opacity: p }}><Panel className="example-bad" accent={C.coral} style={{ position: "absolute", left: 0, top: 40, width: 390, height: 360, padding: 28 }}><div style={{ color: C.coral, fontFamily: "Menlo, monospace", fontSize: 21 }}>WITHOUT SKILL</div><div style={{ color: C.text, fontSize: 28, fontWeight: 800, marginTop: 30 }}>做视频</div><div style={{ color: C.muted, fontSize: 22, lineHeight: 1.6, marginTop: 26 }}>猜视觉<br />随手加动效<br />忘记字幕节奏<br />最后才看画面</div></Panel><Panel className="example-good" accent={C.green} style={{ position: "absolute", right: 0, top: 40, width: 390, height: 360, padding: 28 }}><div style={{ color: C.green, fontFamily: "Menlo, monospace", fontSize: 21 }}>WITH SKILL</div><div style={{ color: C.text, fontSize: 28, fontWeight: 800, marginTop: 30 }}>做视频</div><div style={{ color: C.muted, fontSize: 22, lineHeight: 1.6, marginTop: 26 }}>先定教学目标<br />规划视觉职责<br />逐帧预览检查<br />Headless 导出</div></Panel><div style={{ position: "absolute", left: 50, right: 50, bottom: 32, display: "flex", gap: 18 }}>{["意图", "时间", "画面", "交付"].map((x) => <Panel className="example-check" key={x} accent={C.yellow} style={{ flex: 1, height: 62, display: "flex", alignItems: "center", justifyContent: "center", color: C.yellow, fontSize: 20 }}>{x}</Panel>)}</div></div>;
};

const TakeawayVisual: React.FC<{ p: number }> = ({ p }) => { const { fps } = useVideoConfig(); const frame = useCurrentFrame(); const pulse = spring({ frame: frame - 4800, fps, config: { damping: 100, stiffness: 90 } }); return <div style={{ position: "absolute", right: 110, top: 220, width: 870, height: 460, opacity: p }}><div style={{ position: "absolute", left: 0, right: 0, top: 150, height: 4, background: C.yellow, transform: `scaleX(${pulse})`, transformOrigin: "left" }} /><Panel accent={C.green} style={{ position: "absolute", left: 0, top: 60, width: 300, height: 180, padding: 28, transform: `translateY(${(1 - pulse) * 18}px)` }}><div style={{ color: C.green, fontFamily: "Menlo, monospace", fontSize: 21 }}>ROLE</div><div style={{ color: C.text, fontSize: 32, fontWeight: 900, marginTop: 34 }}>Agent</div></Panel><Panel accent={C.purple} style={{ position: "absolute", right: 0, top: 60, width: 300, height: 180, padding: 28, transform: `translateY(${(1 - pulse) * 18}px)` }}><div style={{ color: C.purple, fontFamily: "Menlo, monospace", fontSize: 21 }}>CAPABILITY</div><div style={{ color: C.text, fontSize: 32, fontWeight: 900, marginTop: 34 }}>Skill</div></Panel><div style={{ position: "absolute", left: 250, right: 250, top: 210, color: C.muted, textAlign: "center", fontSize: 23, lineHeight: 1.5 }}>Agent 执行<br />Skill 提供方法<br />结果通过检查</div></div>; };

const Visual: React.FC<{ scene: Scene; p: number }> = ({ scene, p }) => { if (scene.kind === "hook") return <HookVisual p={p} />; if (scene.kind === "agent") return <AgentVisual p={p} />; if (scene.kind === "skill") return <SkillVisual p={p} />; if (scene.kind === "relation") return <RelationVisual p={p} />; if (scene.kind === "example") return <ExampleVisual p={p} />; return <TakeawayVisual p={p} />; };

export const agentAndSkillDurationInFrames = DURATION;
export const AgentAndSkillVideo: React.FC = () => { const frame = useCurrentFrame(); const scene = currentScene(frame); const progress = ease(frame, scene.from + 12, scene.from + 42); return <AbsoluteFill style={{ fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif", overflow: "hidden" }}><Background /><Header scene={scene} /><Visual scene={scene} p={progress} /><CaptionBar /><div style={{ position: "absolute", right: 88, bottom: 42, color: C.muted, fontFamily: "Menlo, monospace", fontSize: 18 }}>AGENT + SKILL / {String(Math.floor(frame / FPS)).padStart(3, "0")}s</div><Rail /></AbsoluteFill>; };
