import {
  ArrowRight,
  Browser,
  Check,
  CheckCircle,
  Code,
  Coins,
  FileText,
  Fingerprint,
  Globe,
  Key,
  LockKey,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  UserCircle,
  Warning,
  X,
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

const FPS = 30;
const W = 1920;
const H = 1080;

const C = {
  paper: "#f4f0e8",
  paperStrong: "#fffdf8",
  paperMuted: "#e9e4da",
  ink: "#18211e",
  inkSoft: "#52615c",
  line: "#cfc8bc",
  lineStrong: "#968f84",
  teal: "#176b67",
  tealSoft: "#dceae6",
  coral: "#ad4f32",
  coralSoft: "#f3e2d9",
  yellow: "#e4b94e",
  yellowSoft: "#f6ebc9",
  blue: "#365f88",
  blueSoft: "#dee8f1",
};

const FONT = 'Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const SERIF = 'Georgia, "Songti SC", "STSong", serif';
const MONO = 'Menlo, Monaco, Consolas, monospace';

const scenes = [
  { id: "OPEN", duration: 420 },
  { id: "ORIGIN", duration: 720 },
  { id: "SCOPE", duration: 690 },
  { id: "ARCHITECTURE", duration: 840 },
  { id: "RULES", duration: 960 },
  { id: "FIELD", duration: 780 },
  { id: "INTERFACE", duration: 810 },
  { id: "POSITIONING", duration: 750 },
  { id: "CLOSE", duration: 450 },
] as const;

export const wizzSkillKeeperStoryDurationInFrames = scenes.reduce(
  (sum, scene) => sum + scene.duration,
  0,
);

type Cue = { from: number; to: number; text: string };

const clamp = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const reveal = (frame: number, delay = 0, length = 28) => clamp(frame, delay, delay + length);

const scenePresence = (frame: number, duration: number) =>
  Math.min(clamp(frame, 0, 18), 1 - clamp(frame, duration - 20, duration - 1));

const cueAt = (frame: number, cues: Cue[]) =>
  cues.find((cue) => frame >= cue.from && frame < cue.to)?.text ?? cues[cues.length - 1]?.text ?? "";

const PaperBackground: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.paper }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 15 }, (_, index) => (
        <line
          key={index}
          x1="0"
          x2={W}
          y1={82 + index * 72}
          y2={82 + index * 72}
          stroke={C.ink}
          strokeOpacity="0.025"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 24 }, (_, index) => (
        <circle
          key={index}
          cx={58 + ((index * 173) % 1810)}
          cy={46 + ((index * 257) % 980)}
          r={(index % 3) + 0.8}
          fill={C.ink}
          fillOpacity="0.025"
        />
      ))}
    </svg>
  </AbsoluteFill>
);

const BrandBar: React.FC<{ chapter: string; index: string }> = ({ chapter, index }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      top: 34,
      height: 46,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${C.line}`,
      color: C.ink,
      fontFamily: FONT,
      fontSize: 17,
      fontWeight: 750,
      letterSpacing: 0.2,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${C.ink}`,
          color: C.teal,
          fontFamily: MONO,
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        WK
      </div>
      Wizz Skill Keeper · 设计纪实
    </div>
    <div style={{ color: C.inkSoft, fontFamily: MONO, fontSize: 14 }}>
      {index} / {chapter}
    </div>
  </div>
);

const CaptionBar: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      left: 250,
      right: 250,
      bottom: 48,
      height: 116,
      padding: "18px 34px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderTop: `4px solid ${C.ink}`,
      borderBottom: `1px solid ${C.lineStrong}`,
      backgroundColor: C.paperStrong,
      color: C.ink,
      fontFamily: FONT,
      fontSize: 30,
      fontWeight: 760,
      lineHeight: 1.45,
      textAlign: "center",
    }}
  >
    {text}
  </div>
);

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 22,
        height: 3,
        backgroundColor: C.line,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, (frame / wizzSkillKeeperStoryDurationInFrames) * 100)}%`,
          backgroundColor: C.teal,
        }}
      />
    </div>
  );
};

const SceneShell: React.FC<{
  duration: number;
  index: string;
  chapter: string;
  title: ReactNode;
  intro: string;
  cues: Cue[];
  children: ReactNode;
}> = ({ duration, index, chapter, title, intro, cues, children }) => {
  const frame = useCurrentFrame();
  const presence = scenePresence(frame, duration);
  const heading = reveal(frame, 6, 34);
  return (
    <AbsoluteFill style={{ opacity: presence, fontFamily: FONT, color: C.ink }}>
      <PaperBackground />
      <BrandBar chapter={chapter} index={index} />
      <div
        style={{
          position: "absolute",
          left: 88,
          top: 116,
          width: 770,
          opacity: heading,
          transform: `translateY(${(1 - heading) * 18}px)`,
        }}
      >
        <div style={{ color: C.coral, fontFamily: MONO, fontSize: 17, fontWeight: 850, letterSpacing: 1.5 }}>
          CHAPTER {index}
        </div>
        <div style={{ marginTop: 14, fontFamily: SERIF, fontSize: 62, fontWeight: 650, lineHeight: 1.08, letterSpacing: -2.2 }}>
          {title}
        </div>
        <div style={{ marginTop: 20, maxWidth: 720, color: C.inkSoft, fontSize: 24, lineHeight: 1.52 }}>
          {intro}
        </div>
      </div>
      {children}
      <CaptionBar text={cueAt(frame, cues)} />
      <Progress />
    </AbsoluteFill>
  );
};

const Paper: React.FC<{
  children: ReactNode;
  style?: CSSProperties;
  accent?: string;
}> = ({ children, style, accent }) => (
  <div
    style={{
      backgroundColor: C.paperStrong,
      border: `1px solid ${accent ?? C.lineStrong}`,
      borderTopWidth: accent ? 4 : 1,
      borderRadius: 2,
      boxShadow: "0 18px 48px rgba(29,36,32,0.08)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Label: React.FC<{ text: string; color?: string; style?: CSSProperties }> = ({ text, color = C.teal, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      minHeight: 30,
      padding: "4px 8px",
      border: `1px solid ${color}`,
      color,
      fontFamily: MONO,
      fontSize: 13,
      fontWeight: 900,
      letterSpacing: 0.8,
      ...style,
    }}
  >
    {text}
  </div>
);

const Stamp: React.FC<{ text: string; color?: string; progress?: number; style?: CSSProperties }> = ({
  text,
  color = C.teal,
  progress = 1,
  style,
}) => (
  <div
    style={{
      display: "grid",
      placeItems: "center",
      minWidth: 164,
      height: 58,
      padding: "0 16px",
      border: `3px double ${color}`,
      color,
      fontFamily: MONO,
      fontSize: 17,
      fontWeight: 950,
      letterSpacing: 1.2,
      opacity: progress,
      transform: `rotate(-4deg) scale(${0.82 + progress * 0.18})`,
      ...style,
    }}
  >
    {text}
  </div>
);

const EvidenceThread: React.FC<{
  points: Array<[number, number]>;
  progress: number;
  color?: string;
  width?: number;
}> = ({ points, progress, color = C.teal, width = 5 }) => {
  const d = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
    </svg>
  );
};

const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const dossier = spring({ frame: frame - 18, fps: FPS, config: { damping: 110, stiffness: 100, mass: 0.8 } });
  const thread = clamp(frame, 104, 260);
  const tabs = [
    { label: "FILES", icon: FileText, color: C.blue },
    { label: "SITES", icon: Globe, color: C.teal },
    { label: "KEYS", icon: Key, color: C.coral },
    { label: "PAID", icon: Coins, color: C.yellow },
  ];
  const cues: Cue[] = [
    { from: 0, to: 130, text: "当 Agent 通过 Skill 读取文件、访问站点、调用账号与付费服务，风险不再只藏在代码里。" },
    { from: 130, to: 270, text: "提示词怎样施压、费用何时披露、权限怎样被解释，同样会改变用户的决定。" },
    { from: 270, to: 420, text: "这是一段把真实安全审查，变成可复用 Skill 守门方法的故事。" },
  ];
  return (
    <SceneShell
      duration={420}
      index="00"
      chapter="OPENING"
      title={<>一次审查，如何长成<br />一套 Skill 守门方法</>}
      intro="从真实案例出发，把零散风险变成可采集、可复核、可解释的审查系统。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 110, top: 148, width: 850, height: 690 }}>
        <Paper style={{ position: "absolute", left: 88, top: 36, width: 690, height: 510, transform: `rotate(-2deg) translateY(${(1 - dossier) * 44}px)`, opacity: dossier, padding: 38 }} accent={C.ink}>
          <Label text="THIRD-PARTY SKILL" color={C.coral} />
          <div style={{ marginTop: 30, fontFamily: SERIF, fontSize: 48, fontWeight: 650, lineHeight: 1.1 }}>能力入口，也可能是风险入口</div>
          <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {tabs.map(({ label, icon: Icon, color }, index) => {
              const local = reveal(frame, 70 + index * 24, 28);
              return (
                <div key={label} style={{ height: 92, padding: 18, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 14, opacity: local, transform: `translateY(${(1 - local) * 20}px)` }}>
                  <Icon size={32} color={color} weight="duotone" />
                  <div><div style={{ color, fontFamily: MONO, fontSize: 13, fontWeight: 900 }}>{label}</div><div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{["本地文件", "外部站点", "账号密钥", "费用操作"][index]}</div></div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 24, padding: "15px 18px", borderLeft: `5px solid ${C.coral}`, backgroundColor: C.coralSoft, color: C.ink, fontSize: 20, fontWeight: 750 }}>
            安全问题 = 代码能力 + 提示词影响 + 数据去向 + 用户授权
          </div>
        </Paper>
        <EvidenceThread points={[[0, 638], [210, 638], [210, 584], [620, 584], [620, 532], [792, 532]]} progress={thread} />
        <Stamp text="先看证据" progress={reveal(frame, 270, 26)} style={{ position: "absolute", right: 8, bottom: 86 }} />
      </div>
    </SceneShell>
  );
};

const OriginScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 170, text: "故事从一个内容创作 Skill 开始：注册、积分、趋势查询与违禁词检测被绑在同一条工作流里。" },
    { from: 170, to: 350, text: "静态检查发现了内容外发、账号密钥读取、URL 抓取和营销引导，但单个敏感词仍不足以下结论。" },
    { from: 350, to: 530, text: "文档说会上传原始文案，代码却只发送来源字段。审查必须同时看声明、代码、调用点与数据流。" },
    { from: 530, to: 720, text: "第一条教程原则因此出现：风险判断不是匹配关键词，而是把证据连接成一条可验证的路径。" },
  ];
  const evidence = [
    { title: "说明文档", detail: "注册 / 免费积分 / 趋势查询", icon: FileText, color: C.blue },
    { title: "代码能力", detail: "读取 Key / 抓取 URL / 发起请求", icon: Code, color: C.coral },
    { title: "真实调用点", detail: "payload / endpoint / TLS / trigger", icon: MagnifyingGlass, color: C.teal },
  ];
  const thread = clamp(frame, 88, 420);
  return (
    <SceneShell
      duration={720}
      index="01"
      chapter="THE ORIGIN"
      title={<>问题先在一个<br />第三方 Skill 里露出形状</>}
      intro="真正推动产品诞生的，是披露不足、权限不清、营销诱导与实现漂移同时出现。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 104, top: 154, width: 880, height: 690 }}>
        <div style={{ display: "flex", gap: 18, paddingTop: 22 }}>
          {evidence.map(({ title, detail, icon: Icon, color }, index) => {
            const local = reveal(frame, 34 + index * 32, 30);
            return (
              <Paper key={title} accent={color} style={{ width: 274, height: 214, padding: 22, opacity: local, transform: `translateY(${(1 - local) * 24}px)` }}>
                <Icon size={34} color={color} weight="duotone" />
                <div style={{ marginTop: 18, fontSize: 24, fontWeight: 850 }}>{title}</div>
                <div style={{ marginTop: 12, color: C.inkSoft, fontSize: 18, lineHeight: 1.45 }}>{detail}</div>
              </Paper>
            );
          })}
        </div>
        <svg width="880" height="150" viewBox="0 0 880 150" style={{ marginTop: 4 }}>
          <path d="M 138 12 L 138 62 L 440 62 L 440 112" fill="none" stroke={C.blue} strokeWidth="4" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - thread} />
          <path d="M 440 12 L 440 112" fill="none" stroke={C.coral} strokeWidth="4" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - thread} />
          <path d="M 742 12 L 742 62 L 440 62" fill="none" stroke={C.teal} strokeWidth="4" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - thread} />
          <circle cx="440" cy="112" r="11" fill={C.paperStrong} stroke={C.ink} strokeWidth="4" opacity={thread} />
        </svg>
        <Paper accent={C.yellow} style={{ position: "absolute", left: 110, right: 110, top: 366, minHeight: 186, padding: 26, opacity: reveal(frame, 210, 34) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Label text="EVIDENCE CHAIN" color={C.yellow} />
              <div style={{ marginTop: 16, fontFamily: SERIF, fontSize: 32, fontWeight: 650 }}>声明 → 实现 → 调用点 → 数据流</div>
            </div>
            <Stamp text="不可跳步" color={C.coral} progress={reveal(frame, 400, 26)} />
          </div>
          <div style={{ marginTop: 20, color: C.inkSoft, fontSize: 19 }}>网址不是外传；函数名不是恶意；文档也不能替代码证明运行事实。</div>
        </Paper>
      </div>
    </SceneShell>
  );
};

const ScopeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 170, text: "第一阶段没有追求包办一切，而是主动把范围做窄：本地、只读、静态、可追溯。" },
    { from: 170, to: 340, text: "默认报告先讲影响与行动；路径、源码、域名和凭据名留在独立证据文件中。" },
    { from: 340, to: 510, text: "运行时沙箱、网络拦截和自动处置暂不进入第一阶段，因为它们会改变权限与威胁模型。" },
    { from: 510, to: 690, text: "第二条教程原则：好用的 MVP 不是什么都做，而是把最关键的判断链做完整。" },
  ];
  const selected = ["本地只读扫描", "纯前端交互报告", "默认通俗说明", "技术证据隔离", "只建议、不代执行"];
  const rejected = ["运行时沙箱", "网络拦截", "自动卸载", "一键隔离"];
  return (
    <SceneShell
      duration={690}
      index="02"
      chapter="SCOPE"
      title={<>第一阶段只做一件事：<br />把证据讲清楚</>}
      intro="可见、可解释、不可擅自处置；这比“功能很多”更重要。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 116, top: 160, width: 850, height: 670, display: "grid", gridTemplateColumns: "1.12fr .88fr", gap: 22 }}>
        <Paper accent={C.teal} style={{ padding: 28, height: 470, opacity: reveal(frame, 24, 32) }}>
          <Label text="PHASE 1 / KEEP" />
          <div style={{ marginTop: 22, fontFamily: SERIF, fontSize: 34, fontWeight: 650 }}>保留：能够闭环的核心</div>
          <div style={{ marginTop: 18 }}>
            {selected.map((item, index) => {
              const local = reveal(frame, 62 + index * 30, 24);
              return <div key={item} style={{ height: 57, display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.line}`, opacity: local }}><CheckCircle size={27} color={C.teal} weight="fill" /><span style={{ fontSize: 22, fontWeight: 780 }}>{item}</span></div>;
            })}
          </div>
        </Paper>
        <Paper accent={C.coral} style={{ padding: 28, height: 470, opacity: reveal(frame, 50, 32) }}>
          <Label text="NOT YET" color={C.coral} />
          <div style={{ marginTop: 22, fontFamily: SERIF, fontSize: 34, fontWeight: 650 }}>延后：会扩大权限边界</div>
          <div style={{ marginTop: 18 }}>
            {rejected.map((item, index) => {
              const local = reveal(frame, 88 + index * 34, 24);
              return <div key={item} style={{ height: 65, display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.line}`, opacity: local }}><X size={25} color={C.coral} weight="bold" /><span style={{ position: "relative", color: C.inkSoft, fontSize: 22, fontWeight: 750 }}><span style={{ position: "absolute", left: -2, right: -2, top: "52%", height: 2, backgroundColor: C.coral }} />{item}</span></div>;
            })}
          </div>
        </Paper>
        <div style={{ gridColumn: "1 / -1", height: 94, display: "flex", alignItems: "center", justifyContent: "center", borderTop: `4px solid ${C.ink}`, borderBottom: `1px solid ${C.lineStrong}`, backgroundColor: C.paperStrong, opacity: reveal(frame, 360, 30), fontFamily: SERIF, fontSize: 35, fontWeight: 650 }}>
          可见 · 可解释 · 不擅自处置
        </div>
      </div>
    </SceneShell>
  );
};

const ArchitectureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 180, text: "最重要的转向，是承认扫描器没有资格给出最终答案。" },
    { from: 180, to: 390, text: "扫描器擅长找文件、调用点、提示词片段和候选关系；它不擅长理解意图、语境与真实影响。" },
    { from: 390, to: 610, text: "Agent 必须逐条复核证据，区分能力、影响与意图，再生成风险等级、建议和关系图。" },
    { from: 610, to: 840, text: "正式报告还要求证据 ID 完整覆盖：缺失、多余或关系未复核，流程就不能越过门槛。" },
  ];
  const flow = clamp(frame, 130, 560);
  const graph = reveal(frame, 510, 80);
  const stages = [
    { x: 0, width: 230, color: C.blue, kicker: "STAGE 1", title: "扫描器采证", lines: ["文件 / YAML", "调用点 / 数据流", "候选信号"] },
    { x: 310, width: 250, color: C.teal, kicker: "STAGE 2", title: "Agent 核验", lines: ["语境", "真实影响", "误报与不确定性"] },
    { x: 650, width: 230, color: C.yellow, kicker: "OUTPUT", title: "正式报告", lines: ["等级 / 置信度", "具体建议", "核验关系图"] },
  ];
  return (
    <SceneShell
      duration={840}
      index="03"
      chapter="ARCHITECTURE"
      title={<>扫描器采证，<br />Agent 才能下结论</>}
      intro="candidate 不是 verdict；关系图也必须来自核验后的判断。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 78, top: 156, width: 960, height: 700 }}>
        <EvidenceThread points={[[0, 372], [230, 372], [310, 372], [560, 372], [650, 372], [880, 372]]} progress={flow} width={6} />
        {stages.map((stage, index) => {
          const local = reveal(frame, 34 + index * 70, 34);
          return (
            <Paper key={stage.title} accent={stage.color} style={{ position: "absolute", left: stage.x, top: 105, width: stage.width, height: 330, padding: 24, opacity: local, transform: `translateY(${(1 - local) * 28}px)`, zIndex: 2 }}>
              <Label text={stage.kicker} color={stage.color} />
              <div style={{ marginTop: 24, fontFamily: SERIF, fontSize: 32, fontWeight: 650 }}>{stage.title}</div>
              <div style={{ marginTop: 22 }}>
                {stage.lines.map((line) => <div key={line} style={{ padding: "9px 0", borderBottom: `1px solid ${C.line}`, color: C.inkSoft, fontSize: 18 }}>{line}</div>)}
              </div>
              {index === 1 ? <Stamp text="语义门槛" progress={reveal(frame, 400, 26)} style={{ position: "absolute", right: 16, bottom: 18, minWidth: 124, height: 48, fontSize: 14 }} /> : null}
            </Paper>
          );
        })}
        <div style={{ position: "absolute", left: 82, top: 490, display: "flex", gap: 14, opacity: reveal(frame, 420, 36) }}>
          {["candidateTags", "candidateSeverity", "pending-agent-review"].map((field) => <Label key={field} text={field} color={C.coral} />)}
        </div>
        <ArrowRight size={34} color={C.teal} weight="bold" style={{ position: "absolute", left: 452, top: 493, opacity: graph }} />
        <div style={{ position: "absolute", right: 20, top: 474, width: 330, height: 126, opacity: graph }}>
          <svg width="330" height="126" viewBox="0 0 330 126">
            <line x1="65" y1="60" x2="168" y2="27" stroke={C.teal} strokeWidth="3" />
            <line x1="65" y1="60" x2="178" y2="98" stroke={C.teal} strokeWidth="3" />
            <line x1="168" y1="27" x2="273" y2="64" stroke={C.yellow} strokeWidth="3" />
            <circle cx="65" cy="60" r="24" fill={C.paperStrong} stroke={C.teal} strokeWidth="4" />
            <circle cx="168" cy="27" r="17" fill={C.paperStrong} stroke={C.blue} strokeWidth="4" />
            <circle cx="178" cy="98" r="17" fill={C.paperStrong} stroke={C.coral} strokeWidth="4" />
            <circle cx="273" cy="64" r="20" fill={C.paperStrong} stroke={C.yellow} strokeWidth="4" />
          </svg>
          <div style={{ textAlign: "center", color: C.inkSoft, fontFamily: MONO, fontSize: 13 }}>AGENT-VERIFIED GRAPH</div>
        </div>
      </div>
    </SceneShell>
  );
};

const RulesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 180, text: "规则不是越多越安全。真正困难的是定义：什么证据足以让系统说重话。" },
    { from: 180, to: 380, text: "本地读取若只服务声明功能，不外发、不进入不可信执行链，就只记录能力，不计风险。" },
    { from: 380, to: 580, text: "商业诱导可以独立升高严重度；但高风险仍不自动等于隔离，处置必须看现实伤害路径。" },
    { from: 580, to: 770, text: "执行任意代码必须证明不可信输入能到达宿主执行入口。固定打开本地报告，不属于任意代码执行。" },
    { from: 770, to: 960, text: "内容进入 HTML 先叫渲染边界；只有能推导出突破方式、触发路径与缺失防护，才能称为不安全。" },
  ];
  const rules = [
    { old: "只要读取本地信息，就算风险", next: "仅本地消费 → 记录能力背景", color: C.blue },
    { old: "只有已经扣费，诱导才严重", next: "强制注册 / 免费积分 → 可独立升高风险", color: C.yellow },
    { old: "看到 subprocess 就是任意执行", next: "必须证明不可信输入 → 可达执行入口", color: C.coral },
    { old: "数据进 HTML 就是不安全", next: "先标记渲染边界；完整证明后再升级", color: C.teal },
    { old: "高风险直接隔离", next: "先验证伤害、触发路径与温和控制是否失效", color: C.inkSoft },
  ];
  return (
    <SceneShell
      duration={960}
      index="04"
      chapter="RULES"
      title={<>安全规则的价值，<br />在于限制结论</>}
      intro="目标不是少报，而是只在证据足够时，才使用严重标签与强处置建议。"
      cues={cues}
    >
      <Paper style={{ position: "absolute", right: 92, top: 144, width: 940, height: 660, padding: 26 }} accent={C.ink}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1.16fr", alignItems: "center", height: 52, borderBottom: `2px solid ${C.ink}`, color: C.inkSoft, fontFamily: MONO, fontSize: 14, fontWeight: 850 }}>
          <div>容易误判的旧逻辑</div><div /><div>最终证据门槛</div>
        </div>
        {rules.map((rule, index) => {
          const local = reveal(frame, 50 + index * 105, 32);
          const redline = reveal(frame, 105 + index * 105, 36);
          return (
            <div key={rule.old} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 70px 1.16fr", alignItems: "center", minHeight: 105, borderBottom: `1px solid ${C.line}`, opacity: local }}>
              <div style={{ position: "relative", paddingRight: 12, color: C.inkSoft, fontSize: 20, lineHeight: 1.42 }}>
                <div style={{ position: "absolute", left: 0, right: 10, top: "50%", height: 3, backgroundColor: C.coral, transform: `scaleX(${redline})`, transformOrigin: "left" }} />
                {rule.old}
              </div>
              <ArrowRight size={28} color={rule.color} weight="bold" style={{ opacity: redline }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.ink, fontSize: 20, lineHeight: 1.42, fontWeight: 790 }}>
                <Check size={24} color={rule.color} weight="bold" />
                {rule.next}
              </div>
            </div>
          );
        })}
        <Stamp text="证据优先" progress={reveal(frame, 700, 30)} style={{ position: "absolute", right: 32, bottom: 24 }} />
      </Paper>
    </SceneShell>
  );
};

const FieldScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 190, text: "真实目录让理论规则接受反向校准。一个地图 Skill 最初被判成高风险和任意代码执行。" },
    { from: 190, to: 390, text: "重新取证发现，它只是用固定参数打开自己生成的 HTML；没有不可信输入控制宿主命令。" },
    { from: 390, to: 590, text: "任意执行标签被撤销，渲染问题降为中性的内容边界，整体风险也随证据回落。" },
    { from: 590, to: 780, text: "另一项 Skill 因账号密钥传输、关闭 TLS 校验与反复商业引导，仍有独立证据支撑较高风险。" },
  ];
  const correction = reveal(frame, 220, 60);
  return (
    <SceneShell
      duration={780}
      index="05"
      chapter="FIELD TEST"
      title={<>真实对象，<br />会反过来修正规则</>}
      intro="审查器不是裁判席上的终点；它必须允许证据推翻自己。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 92, top: 154, width: 940, height: 660, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Paper accent={C.blue} style={{ padding: 26, height: 520, opacity: reveal(frame, 26, 34) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Label text="CASE A" color={C.blue} /><Globe size={34} color={C.blue} weight="duotone" /></div>
          <div style={{ marginTop: 22, fontFamily: SERIF, fontSize: 32, fontWeight: 650 }}>地图与本地报告</div>
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ padding: "8px 12px", backgroundColor: C.coralSoft, color: C.coral, fontSize: 20, fontWeight: 850, opacity: 1 - correction * 0.72 }}>HIGH / 任意代码执行</div>
            <ArrowRight size={28} color={C.teal} weight="bold" style={{ opacity: correction }} />
            <div style={{ padding: "8px 12px", backgroundColor: C.tealSoft, color: C.teal, fontSize: 20, fontWeight: 850, opacity: correction }}>LOW / 保留并提示</div>
          </div>
          <div style={{ marginTop: 24, padding: 18, border: `1px solid ${C.line}`, backgroundColor: C.paper }}>
            <div style={{ color: C.inkSoft, fontFamily: MONO, fontSize: 14 }}>TRACE</div>
            <div style={{ marginTop: 12, fontSize: 19, lineHeight: 1.55 }}><code>open / xdg-open</code><br />→ 固定生成的 <code>output/map.html</code><br />→ 无不可信输入控制宿主命令</div>
          </div>
          <Stamp text="撤销重判" progress={correction} style={{ position: "absolute", left: 250, bottom: 38, minWidth: 132, height: 50, fontSize: 14 }} />
        </Paper>
        <Paper accent={C.coral} style={{ padding: 26, height: 520, opacity: reveal(frame, 68, 34) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Label text="CASE B" color={C.coral} /><Warning size={34} color={C.coral} weight="duotone" /></div>
          <div style={{ marginTop: 22, fontFamily: SERIF, fontSize: 32, fontWeight: 650 }}>内容创作与外部平台</div>
          <div style={{ marginTop: 24 }}>
            {[
              [Key, "API Key 与查询条件外发"],
              [LockKey, "部分路径关闭 TLS 校验"],
              [Coins, "注册、积分、订阅反复引导"],
            ].map(([Icon, text], index) => {
              const IconComponent = Icon as typeof Key;
              return <div key={text as string} style={{ minHeight: 74, display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.line}`, opacity: reveal(frame, 380 + index * 55, 30) }}><IconComponent size={29} color={C.coral} weight="duotone" /><span style={{ fontSize: 20, fontWeight: 780 }}>{text as string}</span></div>;
            })}
          </div>
          <div style={{ marginTop: 22, padding: "13px 16px", borderLeft: `5px solid ${C.coral}`, backgroundColor: C.coralSoft, fontSize: 19, lineHeight: 1.45 }}>较高风险仍成立，但处置建议必须说明限制什么、何时确认。</div>
        </Paper>
      </div>
    </SceneShell>
  );
};

const InterfaceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 190, text: "HTML 不是报告外壳。它是防止技术结论再次误导普通用户的最后一层。" },
    { from: 190, to: 390, text: "扫描卡片只保留总览，详细分析进入抽屉；风险标签按数据、执行、提示和费用分组。" },
    { from: 390, to: 600, text: "关系图常驻，但只能显示 Agent 核验后的边；没有关系，也应成为用户能感知的结论。" },
    { from: 600, to: 810, text: "交互用克制的 2 像素圆角、8 像素节奏、低饱和强调色和明确的复核引导，减少恐慌与歧义。" },
  ];
  const drawer = reveal(frame, 310, 54);
  const graph = reveal(frame, 420, 60);
  const flow = clamp(frame, 550, 740);
  return (
    <SceneShell
      duration={810}
      index="06"
      chapter="INTERFACE"
      title={<>界面也必须遵守<br />“证据不过度”</>}
      intro="信息层级、状态文案与动效，都在影响用户如何理解风险。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 72, top: 130, width: 1000, height: 700 }}>
        <Paper style={{ position: "absolute", left: 0, top: 28, width: 930, height: 590, overflow: "hidden" }} accent={C.ink}>
          <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: `1px solid ${C.line}`, backgroundColor: C.paper }}>
            <div style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: C.coral }} />
            <div style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: C.yellow }} />
            <div style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: C.teal }} />
            <div style={{ marginLeft: 16, color: C.inkSoft, fontFamily: MONO, fontSize: 13 }}>WIZZ SKILL KEEPER / REVIEWED REPORT</div>
          </div>
          <div style={{ padding: 22, width: 620 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", borderBottom: `2px solid ${C.ink}`, paddingBottom: 14 }}><div><div style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 650 }}>扫描结果</div><div style={{ color: C.inkSoft, fontSize: 15 }}>2 Skills · Agent 核验完成</div></div><Label text="证据充分" /></div>
            {[{ name: "skill-map", risk: "LOW", color: C.teal }, { name: "content-helper", risk: "HIGH", color: C.coral }].map((item, index) => <div key={item.name} style={{ marginTop: 14, height: 108, padding: 16, border: `1px solid ${index === 1 ? C.coral : C.line}`, backgroundColor: C.paperStrong, opacity: reveal(frame, 46 + index * 34, 26) }}><div style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ fontSize: 20 }}>{item.name}</strong><Label text={item.risk} color={item.color} /></div><div style={{ marginTop: 14, display: "flex", gap: 8 }}><Label text={index ? "外部站点" : "本地读取"} color={index ? C.coral : C.blue} /><Label text={index ? "费用与承诺" : "内容边界"} color={index ? C.yellow : C.teal} /></div></div>)}
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, opacity: graph }}>
              <div style={{ border: `1px solid ${C.line}`, padding: 14 }}><div style={{ color: C.inkSoft, fontSize: 13 }}>关系视图</div><svg width="240" height="105" viewBox="0 0 240 105"><line x1="52" y1="52" x2="126" y2="27" stroke={C.teal} strokeWidth="3" /><line x1="52" y1="52" x2="146" y2="83" stroke={C.coral} strokeWidth="3" /><circle cx="52" cy="52" r="18" fill={C.paperStrong} stroke={C.teal} strokeWidth="3" /><circle cx="126" cy="27" r="13" fill={C.paperStrong} stroke={C.blue} strokeWidth="3" /><circle cx="146" cy="83" r="13" fill={C.paperStrong} stroke={C.coral} strokeWidth="3" /></svg></div>
              <div style={{ border: `1px solid ${C.line}`, padding: 14 }}><div style={{ color: C.inkSoft, fontSize: 13 }}>风险维度</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 14 }}>{["数据", "执行", "提示", "费用"].map((tag, i) => <div key={tag} style={{ padding: 8, backgroundColor: [C.blueSoft, C.tealSoft, C.coralSoft, C.yellowSoft][i], fontSize: 14, fontWeight: 800 }}>{tag}</div>)}</div></div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 54, right: 0, width: 326, bottom: 0, padding: 22, borderLeft: `1px solid ${C.lineStrong}`, backgroundColor: C.paperStrong, transform: `translateX(${(1 - drawer) * 330}px)` }}>
            <Label text="DETAIL DRAWER" />
            <div style={{ marginTop: 22, fontFamily: SERIF, fontSize: 29, fontWeight: 650 }}>详细分析</div>
            <div style={{ marginTop: 18, color: C.inkSoft, fontSize: 16, lineHeight: 1.5 }}>把证据讲成普通用户能理解的影响、触发条件与下一步。</div>
            {["能力与数据", "风险判断", "具体建议"].map((item, index) => <div key={item} style={{ marginTop: 16, padding: 13, border: `1px solid ${C.line}`, opacity: reveal(frame, 350 + index * 38, 24) }}>{item}</div>)}
            <div style={{ position: "absolute", left: 22, right: 22, bottom: 24, height: 54, display: "grid", placeItems: "center", border: `2px solid ${C.teal}`, color: C.teal, fontWeight: 850 }}>请求 Agent 复核</div>
          </div>
          <div style={{ position: "absolute", right: 18, bottom: 18, width: 292, height: 62, border: `2px solid ${C.teal}`, opacity: drawer }} />
        </Paper>
        <EvidenceThread points={[[930, 165], [968, 165], [968, 520], [934, 520]]} progress={flow} color="#74b8b4" width={4} />
      </div>
    </SceneShell>
  );
};

const PositioningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cues: Cue[] = [
    { from: 0, to: 180, text: "最终定位不是替用户判断一切的安全裁判，而是在使用前帮助用户看清边界的 Skill 守门人。" },
    { from: 180, to: 360, text: "传播先讲必要性：文件、账号、外部站点与付费操作已经进入 Agent 的日常工作流。" },
    { from: 360, to: 560, text: "营销不靠恐惧。未知不等于危险，能力信号也不等于恶意；每句重话都要有证据支撑。" },
    { from: 560, to: 750, text: "验证也从扫得快转向证据是否被完整理解。先看清，再安心使用。" },
  ];
  const metrics = [
    { value: "25 / 25", label: "合成风险标签最终命中", color: C.teal },
    { value: "0 / 3", label: "安全对照误报", color: C.blue },
    { value: "20 / 20", label: "当前回归测试", color: C.coral },
    { value: "2 STAGES", label: "扫描采证 + Agent 核验", color: C.yellow },
  ];
  return (
    <SceneShell
      duration={750}
      index="07"
      chapter="POSITIONING"
      title={<>守门，而不是<br />替用户做决定</>}
      intro="定位决定了产品如何表达风险，也决定了它如何获得信任。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 86, top: 160, width: 960, height: 670 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            [ShieldCheck, "守门人", "审查、解释与提醒，不自动处置", C.teal],
            [Sparkle, "先讲必要性", "先说明为什么需要审查，再介绍能力", C.yellow],
            [Warning, "不靠恐惧", "未知不等于危险，能力不等于恶意", C.coral],
            [UserCircle, "用户语言优先", "中文默认，报告跟随用户语言", C.blue],
          ].map(([Icon, title, detail, color], index) => {
            const IconComponent = Icon as typeof ShieldCheck;
            return <Paper key={title as string} accent={color as string} style={{ height: 132, padding: 20, display: "flex", gap: 16, opacity: reveal(frame, 30 + index * 40, 28) }}><IconComponent size={34} color={color as string} weight="duotone" /><div><div style={{ fontSize: 22, fontWeight: 850 }}>{title as string}</div><div style={{ marginTop: 8, color: C.inkSoft, fontSize: 16, lineHeight: 1.38 }}>{detail as string}</div></div></Paper>;
          })}
        </div>
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: `1px solid ${C.lineStrong}`, borderBottom: `1px solid ${C.lineStrong}`, opacity: reveal(frame, 300, 36) }}>
          {metrics.map((metric, index) => <div key={metric.value} style={{ minHeight: 142, padding: 18, borderLeft: index ? `1px solid ${C.line}` : undefined }}><div style={{ color: metric.color, fontFamily: MONO, fontSize: 29, fontWeight: 900 }}>{metric.value}</div><div style={{ marginTop: 12, color: C.inkSoft, fontSize: 14, lineHeight: 1.4 }}>{metric.label}</div></div>)}
        </div>
        <div style={{ marginTop: 22, height: 78, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", backgroundColor: C.ink, color: C.paperStrong, opacity: reveal(frame, 520, 34) }}><span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 650 }}>先看清，再安心使用。</span><Fingerprint size={39} color="#74b8b4" weight="duotone" /></div>
      </div>
    </SceneShell>
  );
};

const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lock = spring({ frame: frame - 230, fps, config: { damping: 100, stiffness: 90, mass: 0.8 } });
  const cues: Cue[] = [
    { from: 0, to: 150, text: "这套方法最后形成了一条清楚的责任链。" },
    { from: 150, to: 310, text: "本地工具负责收集事实，Agent 负责理解语境，界面负责解释结论。" },
    { from: 310, to: 450, text: "处置权仍留给用户。它守住的不只是 Skill 的安全，也是用户对 Agent 结论的信任。" },
  ];
  const steps = [
    { title: "本地工具", detail: "采集事实", icon: MagnifyingGlass, color: C.blue },
    { title: "Agent", detail: "理解语境", icon: Sparkle, color: C.teal },
    { title: "界面", detail: "解释结论", icon: Browser, color: C.yellow },
    { title: "用户", detail: "保留处置权", icon: UserCircle, color: C.coral },
  ];
  const line = clamp(frame, 96, 290);
  return (
    <SceneShell
      duration={450}
      index="08"
      chapter="TAKEAWAY"
      title={<>一条可信的责任链，<br />比一个聪明的标签更重要</>}
      intro="安全判断被拆成可检查的步骤，用户也不必把决定权交给另一个高优先级工具。"
      cues={cues}
    >
      <div style={{ position: "absolute", right: 88, top: 198, width: 980, height: 610 }}>
        <EvidenceThread points={[[64, 250], [280, 250], [500, 250], [720, 250], [930, 250]]} progress={line} width={6} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, position: "absolute", left: 0, right: 0, top: 120 }}>
          {steps.map(({ title, detail, icon: Icon, color }, index) => {
            const local = reveal(frame, 30 + index * 42, 28);
            return <Paper key={title} accent={color} style={{ height: 240, padding: 22, textAlign: "center", opacity: local, transform: `translateY(${(1 - local) * 28}px)`, zIndex: 2 }}><Icon size={42} color={color} weight="duotone" /><div style={{ marginTop: 22, fontFamily: SERIF, fontSize: 30, fontWeight: 650 }}>{title}</div><div style={{ marginTop: 12, color: C.inkSoft, fontSize: 18 }}>{detail}</div></Paper>;
          })}
        </div>
        <div style={{ position: "absolute", left: 110, right: 110, top: 410, height: 98, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, backgroundColor: C.ink, color: C.paperStrong, opacity: reveal(frame, 220, 30), transform: `scale(${0.94 + lock * 0.06})` }}><ShieldCheck size={43} color="#74b8b4" weight="duotone" /><span style={{ fontFamily: SERIF, fontSize: 35, fontWeight: 650 }}>先看清，再安心使用。</span></div>
      </div>
    </SceneShell>
  );
};

const sceneComponents = [
  OpeningScene,
  OriginScene,
  ScopeScene,
  ArchitectureScene,
  RulesScene,
  FieldScene,
  InterfaceScene,
  PositioningScene,
  ClosingScene,
] as const;

export const WizzSkillKeeperStoryVideo: React.FC = () => {
  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      {scenes.map((scene, index) => {
        const Component = sceneComponents[index];
        const from = offset;
        offset += scene.duration;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.duration} premountFor={FPS}>
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
