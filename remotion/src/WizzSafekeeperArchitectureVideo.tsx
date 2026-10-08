import {
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Database,
  FileCode,
  FileText,
  Funnel,
  Globe,
  Graph,
  LockKey,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  UserCircle,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionBar, Panel, ProgressRail, VideoBackground } from "./design/components";
import { COLORS, TYPOGRAPHY, VIDEO } from "./design/tokens";

const FPS = 30;

const scenes = [
  { id: "OPEN", duration: 300 },
  { id: "INPUT", duration: 420 },
  { id: "SCAN", duration: 600 },
  { id: "BOUNDARY", duration: 540 },
  { id: "REVIEW", duration: 600 },
  { id: "GRAPH", duration: 480 },
  { id: "CLOSE", duration: 360 },
] as const;

export const wizzSafekeeperArchitectureDurationInFrames = scenes.reduce(
  (sum, scene) => sum + scene.duration,
  0,
);

type Cue = { from: number; to: number; text: string };

const reveal = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const draw = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const captionAt = (frame: number, cues: Cue[]) =>
  cues.find((cue) => frame >= cue.from && frame < cue.to)?.text ?? cues[cues.length - 1]?.text ?? "";

const alpha = (color: string, opacity: number) => `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;

const TopBar: React.FC<{ chapter: string }> = ({ chapter }) => (
  <div
    style={{
      position: "absolute",
      left: VIDEO.safeX,
      right: VIDEO.safeX,
      top: 34,
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${COLORS.faint}`,
      color: COLORS.text,
      fontFamily: TYPOGRAPHY.monoFamily,
      fontSize: 17,
      letterSpacing: 0.6,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${COLORS.cyan}`,
          color: COLORS.cyan,
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        WSK
      </div>
      WIZZ SKILL SAFEKEEPER / ARCHITECTURE
    </div>
    <div style={{ color: COLORS.muted }}>{chapter}</div>
  </div>
);

const SceneShell: React.FC<{
  chapter: string;
  title: ReactNode;
  description: string;
  accent?: string;
  cues: Cue[];
  children: ReactNode;
}> = ({ chapter, title, description, accent = COLORS.cyan, cues, children }) => {
  const frame = useCurrentFrame();
  const intro = reveal(frame, 8, 38);
  return (
    <AbsoluteFill style={{ color: COLORS.text, fontFamily: TYPOGRAPHY.fontFamily }}>
      <VideoBackground />
      <TopBar chapter={chapter} />
      <div
        style={{
          position: "absolute",
          left: VIDEO.safeX,
          top: 128,
          width: 820,
          opacity: intro,
          translate: `0px ${18 * (1 - intro)}px`,
        }}
      >
        <div style={{ color: accent, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18, letterSpacing: 1.4, fontWeight: 850 }}>
          {chapter}
        </div>
        <div style={{ marginTop: 16, fontSize: 64, lineHeight: 1.08, fontWeight: 900, letterSpacing: -2.5 }}>
          {title}
        </div>
        <div style={{ marginTop: 22, maxWidth: 760, color: COLORS.muted, fontSize: 26, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      {children}
      <CaptionBar text={captionAt(frame, cues)} />
      <ProgressRail durationInFrames={wizzSafekeeperArchitectureDurationInFrames} />
    </AbsoluteFill>
  );
};

const FlowLine: React.FC<{
  left: number;
  top: number;
  width: number;
  color?: string;
  progress?: number;
  dashed?: boolean;
}> = ({ left, top, width, color = COLORS.cyan, progress = 1, dashed = false }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      height: 3,
      background: dashed ? "transparent" : color,
      backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0 10px, transparent 10px 18px)` : undefined,
      transformOrigin: "left center",
      scale: `${progress} 1`,
      opacity: 0.9,
    }}
  />
);

const CodeLabel: React.FC<{ children: ReactNode; color?: string; style?: CSSProperties }> = ({ children, color = COLORS.cyan, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      minHeight: 32,
      padding: "4px 10px",
      border: `1px solid ${alpha(color, 0.7)}`,
      background: alpha(color, 0.08),
      color,
      fontFamily: TYPOGRAPHY.monoFamily,
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: 0.2,
      ...style,
    }}
  >
    {children}
  </div>
);

const StatusPill: React.FC<{ label: string; color: string; icon?: ReactNode }> = ({ label, color, icon }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 15, fontWeight: 800 }}>
    {icon}
    {label}
  </div>
);

const OpenScene: React.FC = () => {
  const frame = useCurrentFrame();
  const signal = draw(frame, 56, 194);
  const cues: Cue[] = [
    { from: 0, to: 110, text: "一个 Skill 的风险结论，究竟由谁决定？" },
    { from: 110, to: 230, text: "Wizz Skill Safekeeper 把“发现信号”和“发布结论”拆成两段。" },
    { from: 230, to: 300, text: "看懂这条边界，就看懂了它的设计架构。" },
  ];
  return (
    <SceneShell
      chapter="01 / THE QUESTION"
      title={<>把风险判断<br /><span style={{ color: COLORS.yellow }}>拆成责任链</span></>}
      description="先收集事实，再理解语境，最后把能解释的结论交给用户。"
      accent={COLORS.yellow}
      cues={cues}
    >
      <div style={{ position: "absolute", right: 110, top: 165, width: 820, height: 580 }}>
        <Panel accent={COLORS.coral} style={{ position: "absolute", left: 0, top: 80, width: 330, height: 310, padding: 28, opacity: reveal(frame, 24, 52), translate: `0px ${22 * (1 - reveal(frame, 24, 52))}px` }}>
          <StatusPill label="STATIC SIGNAL" color={COLORS.coral} icon={<Warning size={22} weight="duotone" />} />
          <div style={{ marginTop: 28, fontSize: 30, fontWeight: 850 }}>候选信号</div>
          <div style={{ marginTop: 18, color: COLORS.muted, fontSize: 21, lineHeight: 1.5 }}>规则命中、代码路径、网络迹象——先记录，不先定罪。</div>
          <CodeLabel color={COLORS.coral} style={{ marginTop: 24 }}>verificationStatus: pending</CodeLabel>
        </Panel>
        <FlowLine left={330} top={235} width={160} color={COLORS.yellow} progress={signal} />
        <Panel accent={COLORS.green} style={{ position: "absolute", right: 0, top: 0, width: 330, height: 310, padding: 28, opacity: reveal(frame, 104, 140), translate: `0px ${-22 * (1 - reveal(frame, 104, 140))}px` }}>
          <StatusPill label="AGENT REVIEWED" color={COLORS.green} icon={<CheckCircle size={22} weight="duotone" />} />
          <div style={{ marginTop: 28, fontSize: 30, fontWeight: 850 }}>可解释结论</div>
          <div style={{ marginTop: 18, color: COLORS.muted, fontSize: 21, lineHeight: 1.5 }}>逐条证据复核，关系图也要有双边事实和具体影响。</div>
          <CodeLabel color={COLORS.green} style={{ marginTop: 24 }}>review.status: completed</CodeLabel>
        </Panel>
        <div style={{ position: "absolute", left: 278, top: 415, color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17, opacity: reveal(frame, 180, 210) }}>
          scanner ≠ final verdict
        </div>
        <div style={{ position: "absolute", right: 68, top: 415, color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17, opacity: reveal(frame, 210, 245) }}>
          evidence → context → decision
        </div>
      </div>
    </SceneShell>
  );
};

const InputScene: React.FC = () => {
  const frame = useCurrentFrame();
  const inputA = reveal(frame, 22, 52);
  const inputB = reveal(frame, 90, 120);
  const merge = draw(frame, 160, 270);
  const cues: Cue[] = [
    { from: 0, to: 145, text: "第一层是输入边界：审查的对象必须先被明确地收进来。" },
    { from: 145, to: 290, text: "本地模式发现 SKILL.md；远程模式只取公开元数据和惰性快照。" },
    { from: 290, to: 420, text: "两条入口最后都变成同一种可读取、可追踪的源材料。" },
  ];
  const inputCard = (title: string, detail: string, color: string, icon: ReactNode, labels: string[], opacity: number, style?: CSSProperties) => (
    <Panel accent={color} style={{ width: 350, height: 258, padding: 24, opacity, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color }}>
        {icon}
        <div style={{ fontSize: 24, fontWeight: 850 }}>{title}</div>
      </div>
      <div style={{ marginTop: 20, color: COLORS.muted, fontSize: 19, lineHeight: 1.45 }}>{detail}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
        {labels.map((label) => <CodeLabel key={label} color={color} style={{ fontSize: 14 }}>{label}</CodeLabel>)}
      </div>
    </Panel>
  );
  return (
    <SceneShell
      chapter="02 / INPUT BOUNDARY"
      title={<>先确定<br /><span style={{ color: COLORS.cyan }}>看什么</span></>}
      description="本地目录和远程 SkillHub 候选有不同入口，但都必须先变成可审查的材料。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 92, top: 190, width: 930, height: 600 }}>
        {inputCard("本地范围", "以请求的 scope 为边界，递归发现 SKILL.md；自身包会被排除。", COLORS.cyan, <FileText size={36} weight="duotone" />, ["discover_skills", "scope"], inputA, { position: "absolute", left: 0, top: 30 })}
        {inputCard("远程快照", "先拿公开信息，再在空目录建立 inert snapshot；不会安装或运行候选 Skill。", COLORS.purple, <Globe size={36} weight="duotone" />, ["detail", "fetch", "read-only"], inputB, { position: "absolute", left: 0, top: 330 })}
        <FlowLine left={352} top={160} width={245} color={COLORS.cyan} progress={merge} />
        <FlowLine left={352} top={460} width={245} color={COLORS.purple} progress={merge} />
        <div style={{ position: "absolute", left: 600, top: 138, width: 300, height: 342, opacity: reveal(frame, 212, 248), scale: `${0.92 + reveal(frame, 212, 248) * 0.08}` }}>
          <Panel accent={COLORS.green} style={{ height: "100%", padding: 28, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Database size={44} color={COLORS.green} weight="duotone" />
            <div style={{ marginTop: 24, fontSize: 29, fontWeight: 850 }}>统一源材料</div>
            <div style={{ marginTop: 14, color: COLORS.muted, fontSize: 19, lineHeight: 1.45 }}>文件清单、文本内容、哈希与元数据，进入同一条静态分析管线。</div>
            <CodeLabel color={COLORS.green} style={{ marginTop: 24 }}>FileRecord[]</CodeLabel>
          </Panel>
        </div>
      </div>
    </SceneShell>
  );
};

const ScanScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 150, text: "扫描层做三件事：枚举文件、读取文本、把信号绑定回真实代码位置。" },
    { from: 150, to: 360, text: "audit_skill 同时看提示词、代码汇点、网络目标、凭据引用与付费表达。" },
    { from: 360, to: 600, text: "scan 输出三种材料：公共总览、技术证据，以及尚未核验的候选关系图。" },
  ];
  const steps = [
    { label: "01", name: "discover_skills", detail: "scope → Skill roots", icon: MagnifyingGlass, color: COLORS.cyan },
    { label: "02", name: "list_files", detail: "files → hashes + text", icon: FileCode, color: COLORS.blue },
    { label: "03", name: "audit_skill", detail: "rules → Finding[]", icon: Funnel, color: COLORS.yellow },
    { label: "04", name: "build_graph", detail: "candidates only", icon: Graph, color: COLORS.coral },
  ];
  const line = draw(frame, 72, 350);
  return (
    <SceneShell
      chapter="03 / STATIC SCAN"
      title={<>扫描器只负责<br /><span style={{ color: COLORS.yellow }}>收集事实</span></>}
      description="它是一个只读的证据采集器，不把规则命中直接升级成最终风险。"
      accent={COLORS.yellow}
      cues={cues}
    >
      <div style={{ position: "absolute", right: 88, top: 178, width: 950, height: 620 }}>
        <FlowLine left={62} top={207} width={810} color={COLORS.cyan} progress={line} />
        {steps.map((step, index) => {
          const local = reveal(frame, 32 + index * 54, 68 + index * 54);
          const IconComponent = step.icon;
          return (
            <div key={step.name} style={{ position: "absolute", left: index * 226, top: 0, width: 190, opacity: local, translate: `0px ${24 * (1 - local)}px` }}>
              <Panel accent={step.color} style={{ height: 256, padding: 22, position: "relative", zIndex: 1 }}>
                <div style={{ color: step.color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16, fontWeight: 900 }}>{step.label}</div>
                <IconComponent size={42} color={step.color} weight="duotone" style={{ marginTop: 28 }} />
                <div style={{ marginTop: 20, color: COLORS.text, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18, fontWeight: 850, wordBreak: "break-word" }}>{step.name}</div>
                <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 16, lineHeight: 1.35 }}>{step.detail}</div>
              </Panel>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 330, height: 194, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, opacity: reveal(frame, 300, 340) }}>
          <Panel accent={COLORS.cyan} style={{ padding: 20 }}><CodeLabel color={COLORS.cyan}>report.json</CodeLabel><div style={{ marginTop: 16, color: COLORS.muted, fontSize: 17, lineHeight: 1.4 }}>公共总览<br />状态仍是 pending</div></Panel>
          <Panel accent={COLORS.coral} style={{ padding: 20 }}><CodeLabel color={COLORS.coral}>evidence.json</CodeLabel><div style={{ marginTop: 16, color: COLORS.muted, fontSize: 17, lineHeight: 1.4 }}>技术证据<br />保留上下文</div></Panel>
          <Panel accent={COLORS.yellow} style={{ padding: 20, borderStyle: "dashed" }}><CodeLabel color={COLORS.yellow}>candidateGraph</CodeLabel><div style={{ marginTop: 16, color: COLORS.muted, fontSize: 17, lineHeight: 1.4 }}>关系候选<br />不是最终图</div></Panel>
        </div>
        <div style={{ position: "absolute", right: 8, bottom: 12, color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17, opacity: reveal(frame, 470, 510) }}>
          candidate ≠ verdict
        </div>
      </div>
    </SceneShell>
  );
};

const BoundaryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const split = draw(frame, 65, 230);
  const left = reveal(frame, 168, 214);
  const right = reveal(frame, 238, 284);
  const cues: Cue[] = [
    { from: 0, to: 155, text: "第二条边界，是技术证据和用户报告的分离。" },
    { from: 155, to: 340, text: "evidence.json 保留细节；report.json 与 index.html 只展示安全、可读的公共层。" },
    { from: 340, to: 540, text: "这不是隐藏事实，而是避免未经核验的代码片段直接变成用户结论。" },
  ];
  return (
    <SceneShell
      chapter="04 / PUBLIC BOUNDARY"
      title={<>证据可以很深，<br /><span style={{ color: COLORS.purple }}>结论必须可读</span></>}
      description="同一份扫描结果被拆成两种输出：供 Agent 核验的技术层，和供用户理解的公共层。"
      accent={COLORS.purple}
      cues={cues}
    >
      <div style={{ position: "absolute", right: 90, top: 190, width: 950, height: 590 }}>
        <div style={{ position: "absolute", left: 430, top: 74, width: 4, height: 390, background: COLORS.purple, transformOrigin: "top center", scale: `1 ${split}` }} />
        <Panel accent={COLORS.coral} style={{ position: "absolute", left: 0, top: 0, width: 390, height: 430, padding: 28, opacity: left, translate: `0px ${20 * (1 - left)}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: COLORS.coral }}><LockKey size={34} weight="duotone" /><span style={{ fontSize: 25, fontWeight: 850 }}>技术证据层</span></div>
          <CodeLabel color={COLORS.coral} style={{ marginTop: 28 }}>evidence.json</CodeLabel>
          <div style={{ marginTop: 22, color: COLORS.muted, fontSize: 18, lineHeight: 1.55 }}>完整证据 ID<br />源码位置与上下文<br />网络目标与受影响资源<br />候选强度与触发条件</div>
          <div style={{ marginTop: 26, color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16 }}>Agent-only detail</div>
        </Panel>
        <Panel accent={COLORS.green} style={{ position: "absolute", right: 0, top: 0, width: 390, height: 430, padding: 28, opacity: right, translate: `0px ${20 * (1 - right)}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: COLORS.green }}><ShieldCheck size={34} weight="duotone" /><span style={{ fontSize: 25, fontWeight: 850 }}>公共报告层</span></div>
          <CodeLabel color={COLORS.green} style={{ marginTop: 28 }}>report.json + index.html</CodeLabel>
          <div style={{ marginTop: 22, color: COLORS.muted, fontSize: 18, lineHeight: 1.55 }}>能力与数据<br />触发时机与影响<br />Agent 核验状态<br />下一步建议与关系图</div>
          <div style={{ marginTop: 26, color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16 }}>public-safe summary</div>
        </Panel>
        <div style={{ position: "absolute", left: 366, top: 450, width: 140, textAlign: "center", color: COLORS.purple, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 15, opacity: reveal(frame, 290, 330) }}>sanitize + explain</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 5, display: "flex", justifyContent: "center", opacity: reveal(frame, 350, 390) }}><CodeLabel color={COLORS.yellow}>pending-agent-review → 不可直接发布</CodeLabel></div>
      </div>
    </SceneShell>
  );
};

const ReviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gate = spring({ frame: frame - 270, fps, config: { damping: 120, stiffness: 110, mass: 0.75 } });
  const pass = reveal(frame, 350, 410);
  const cues: Cue[] = [
    { from: 0, to: 165, text: "真正的结论发生在第二阶段：Agent 逐条读证据，补回上下文和不确定性。" },
    { from: 165, to: 350, text: "review 不只检查风险标签，还强制验证证据覆盖、关系维度和资源边。" },
    { from: 350, to: 600, text: "缺证据、缺关系核验或图边不合规，合并就会被拒绝。通过后才进入 reviewed report。" },
  ];
  return (
    <SceneShell
      chapter="05 / AGENT REVIEW GATE"
      title={<>把候选信号<br /><span style={{ color: COLORS.green }}>变成可解释结论</span></>}
      description="Agent 不是替扫描器贴标签，而是承担语义核验、关系判断和发布前的责任。"
      accent={COLORS.green}
      cues={cues}
    >
      <div style={{ position: "absolute", right: 76, top: 178, width: 980, height: 600 }}>
        <Panel accent={COLORS.coral} style={{ position: "absolute", left: 0, top: 40, width: 240, height: 350, padding: 22, opacity: reveal(frame, 25, 55) }}>
          <StatusPill label="INPUT" color={COLORS.coral} icon={<Warning size={21} weight="duotone" />} />
          <div style={{ marginTop: 28, fontSize: 25, fontWeight: 850 }}>候选证据</div>
          {[
            "finding IDs 全量覆盖",
            "原文与代码上下文",
            "candidateGraph",
          ].map((item, index) => <div key={item} style={{ marginTop: 20 - index * 2, paddingTop: 13, borderTop: `1px solid ${COLORS.faint}`, color: COLORS.muted, fontSize: 17 }}>{item}</div>)}
        </Panel>
        <FlowLine left={241} top={212} width={88} color={COLORS.yellow} progress={draw(frame, 90, 235)} />
        <div style={{ position: "absolute", left: 330, top: 0, width: 260, height: 440, opacity: reveal(frame, 120, 165), scale: `${0.9 + reveal(frame, 120, 165) * 0.1}` }}>
          <Panel accent={COLORS.yellow} style={{ height: "100%", padding: 26, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", color: COLORS.yellow }}><CircleNotch size={58} weight="duotone" /></div>
            <div style={{ marginTop: 24, fontSize: 28, fontWeight: 850 }}>Agent Review Gate</div>
            <CodeLabel color={COLORS.yellow} style={{ marginTop: 26, justifyContent: "center" }}>review_command</CodeLabel>
            <div style={{ marginTop: 25, color: COLORS.muted, fontSize: 18, lineHeight: 1.55 }}>validate_evidence_review<br />validate_relationship_review<br />validate_review_graph</div>
          </Panel>
        </div>
        <FlowLine left={590} top={212} width={150} color={COLORS.green} progress={draw(frame, 230, 350)} />
        <Panel accent={COLORS.green} style={{ position: "absolute", right: 0, top: 40, width: 240, height: 350, padding: 22, opacity: pass, translate: `0px ${24 * (1 - pass)}px` }}>
          <StatusPill label="PUBLISHED" color={COLORS.green} icon={<CheckCircle size={21} weight="duotone" />} />
          <div style={{ marginTop: 28, fontSize: 25, fontWeight: 850 }}>Reviewed report</div>
          {[
            "evidenceCoverage: complete",
            "graph.status: agent-reviewed",
            "public-safe resources",
          ].map((item, index) => <div key={item} style={{ marginTop: 20 - index * 2, paddingTop: 13, borderTop: `1px solid ${COLORS.faint}`, color: COLORS.muted, fontSize: 17 }}>{item}</div>)}
        </Panel>
        <div style={{ position: "absolute", left: 235, bottom: 18, width: 500, height: 70, border: `1px dashed ${COLORS.coral}`, opacity: reveal(frame, 300, 345), display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16 }}>
          <XCircle size={23} weight="duotone" /> missing coverage → reject merge
        </div>
        <div style={{ position: "absolute", left: 770, top: 485, color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17, opacity: gate }}>gate passed</div>
      </div>
    </SceneShell>
  );
};

const GraphScene: React.FC = () => {
  const frame = useCurrentFrame();
  const graph = reveal(frame, 50, 150);
  const edges = draw(frame, 120, 260);
  const cues: Cue[] = [
    { from: 0, to: 150, text: "关系图也遵守同一条原则：候选边先收集，核验后的边才公开。" },
    { from: 150, to: 315, text: "Skill 节点可以连接到能力重叠、外部站点、凭据等资源，但每条边都要有来源和影响解释。" },
    { from: 315, to: 480, text: "最后，图和报告一起回到用户界面：看见边界，而不是被一个颜色吓住。" },
  ];
  const nodes = [
    { x: 320, y: 210, r: 48, label: "Skill", color: COLORS.green },
    { x: 145, y: 118, r: 30, label: "domain", color: COLORS.cyan },
    { x: 505, y: 122, r: 30, label: "credential", color: COLORS.coral },
    { x: 555, y: 328, r: 30, label: "overlap", color: COLORS.yellow },
    { x: 125, y: 360, r: 30, label: "Skill B", color: COLORS.purple },
  ];
  return (
    <SceneShell
      chapter="06 / REVIEWED GRAPH"
      title={<>把关系显出来，<br /><span style={{ color: COLORS.cyan }}>把证据留在边上</span></>}
      description="图不是装饰，而是把共享资源、能力重叠与行为交互变成可追踪的结构。"
      accent={COLORS.cyan}
      cues={cues}
    >
      <div style={{ position: "absolute", right: 90, top: 184, width: 960, height: 600 }}>
        <Panel accent={COLORS.cyan} style={{ position: "absolute", left: 0, top: 0, width: 640, height: 500, opacity: graph }}>
          <div style={{ position: "absolute", left: 24, top: 20, display: "flex", alignItems: "center", gap: 12 }}><Graph size={26} color={COLORS.cyan} weight="duotone" /><span style={{ color: COLORS.cyan, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17 }}>reviewed relationship graph</span></div>
          <svg width="640" height="500" viewBox="0 0 640 500" style={{ position: "absolute", inset: 0 }}>
            <line x1="320" y1="210" x2="145" y2="118" stroke={COLORS.cyan} strokeWidth="4" strokeDasharray="12 9" strokeDashoffset={Math.round((1 - edges) * 160)} opacity="0.8" />
            <line x1="320" y1="210" x2="505" y2="122" stroke={COLORS.coral} strokeWidth="4" strokeDasharray="12 9" strokeDashoffset={Math.round((1 - edges) * 160)} opacity="0.8" />
            <line x1="320" y1="210" x2="555" y2="328" stroke={COLORS.yellow} strokeWidth="4" strokeDasharray="12 9" strokeDashoffset={Math.round((1 - edges) * 160)} opacity="0.8" />
            <line x1="320" y1="210" x2="125" y2="360" stroke={COLORS.purple} strokeWidth="4" strokeDasharray="12 9" strokeDashoffset={Math.round((1 - edges) * 160)} opacity="0.8" />
            {nodes.map((node) => (
              <g key={node.label} opacity={reveal(frame, 145 + node.r, 185 + node.r)}>
                <circle cx={node.x} cy={node.y} r={node.r} fill={COLORS.panelStrong} stroke={node.color} strokeWidth={node.label === "Skill" ? 5 : 3} />
                <text x={node.x} y={node.y + 6} fill={node.color} fontSize={node.label === "Skill" ? 22 : 15} fontWeight="800" textAnchor="middle">{node.label}</text>
              </g>
            ))}
          </svg>
        </Panel>
        <Panel accent={COLORS.yellow} style={{ position: "absolute", right: 0, top: 38, width: 270, height: 360, padding: 24, opacity: reveal(frame, 270, 320), translate: `0px ${20 * (1 - reveal(frame, 270, 320))}px` }}>
          <CodeLabel color={COLORS.yellow}>edge policy</CodeLabel>
          <div style={{ marginTop: 22, fontSize: 23, fontWeight: 850 }}>发布一条边之前</div>
          {["看双方源代码", "写具体影响", "给出置信度", "隐藏敏感标识"].map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, color: COLORS.muted, fontSize: 17 }}><CheckCircle size={20} color={COLORS.green} weight="duotone" />{item}</div>)}
        </Panel>
        <div style={{ position: "absolute", left: 0, bottom: 20, color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16, opacity: reveal(frame, 350, 390) }}>candidateGraph → agent-reviewed graph</div>
      </div>
    </SceneShell>
  );
};

const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const line = draw(frame, 78, 220);
  const cues: Cue[] = [
    { from: 0, to: 120, text: "这套架构把安全判断拆成一条可复核的责任链。" },
    { from: 120, to: 245, text: "本地工具采集事实，Agent 理解语境，界面解释结论。" },
    { from: 245, to: 360, text: "最终处置权仍留给用户：先看清，再安心使用。" },
  ];
  const steps = [
    { title: "Collector", detail: "采集事实", icon: MagnifyingGlass, color: COLORS.cyan },
    { title: "Agent", detail: "核验语境", icon: Sparkle, color: COLORS.yellow },
    { title: "Report", detail: "解释边界", icon: ClipboardText, color: COLORS.green },
    { title: "User", detail: "保留处置权", icon: UserCircle, color: COLORS.purple },
  ];
  return (
    <SceneShell
      chapter="07 / RESPONSIBILITY CHAIN"
      title={<>先看清边界，<br /><span style={{ color: COLORS.green }}>再决定是否使用</span></>}
      description="Wizz Skill Safekeeper 的核心不是替用户做决定，而是让决定有证据、有上下文、可追踪。"
      accent={COLORS.green}
      cues={cues}
    >
      <div style={{ position: "absolute", right: 82, top: 214, width: 980, height: 510 }}>
        <FlowLine left={90} top={145} width={800} color={COLORS.green} progress={line} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, position: "absolute", left: 0, right: 0, top: 60 }}>
          {steps.map((step, index) => {
            const local = reveal(frame, 34 + index * 40, 66 + index * 40);
            const IconComponent = step.icon;
            return <Panel key={step.title} accent={step.color} style={{ height: 220, padding: 22, textAlign: "center", opacity: local, translate: `0px ${28 * (1 - local)}px`, zIndex: 1 }}><IconComponent size={44} color={step.color} weight="duotone" /><div style={{ marginTop: 24, fontSize: 27, fontWeight: 850 }}>{step.title}</div><div style={{ marginTop: 12, color: COLORS.muted, fontSize: 18 }}>{step.detail}</div></Panel>;
          })}
        </div>
        <div style={{ position: "absolute", left: 120, right: 120, bottom: 0, height: 92, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, border: `1px solid ${alpha(COLORS.green, 0.55)}`, background: alpha(COLORS.green, 0.08), color: COLORS.green, opacity: reveal(frame, 220, 260) }}>
          <ShieldCheck size={40} weight="duotone" />
          <span style={{ fontSize: 31, fontWeight: 850 }}>evidence → context → user choice</span>
        </div>
      </div>
    </SceneShell>
  );
};

const sceneComponents = [OpenScene, InputScene, ScanScene, BoundaryScene, ReviewScene, GraphScene, CloseScene] as const;

export const WizzSafekeeperArchitectureVideo: React.FC = () => {
  let offset = 0;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
      }}
    >
      {scenes.map((scene, index) => {
        const Scene = sceneComponents[index];
        const from = offset;
        offset += scene.duration;
        return <Sequence key={scene.id} from={from} durationInFrames={scene.duration} premountFor={FPS}><Scene /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
