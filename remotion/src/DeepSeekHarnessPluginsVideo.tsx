import { Audio } from "@remotion/media";
import type { Caption } from "@remotion/captions";
import React from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle,
  CircleNotch,
  Compass,
  Database,
  FileText,
  Globe,
  GitBranch,
  MagnifyingGlass,
  Plug,
  ShieldCheck,
  TerminalWindow,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, RADIUS, TYPOGRAPHY, VIDEO } from "./design/tokens";

const FPS = 30;
const DURATION_SECONDS = 204;
export const deepSeekHarnessPluginsDurationInFrames = DURATION_SECONDS * FPS;

const sceneStarts = [0, 12, 39, 47, 71, 84, 107, 129, 152, 183];
const sceneEnds = [12, 39, 47, 71, 84, 107, 129, 152, 183, 204];

const captions: Caption[] = [
  { text: "一个 Agent，除了模型，还需要什么？答案可能不是再换一个模型，而是把能力装配起来。", startMs: 0, endMs: 12000, timestampMs: 6000, confidence: 1 },
  { text: "这就是 DeepSeek Harness，简称 dsh。它是 DeepSeek AI 开源的代理运行时。", startMs: 12000, endMs: 21000, timestampMs: 16500, confidence: 1 },
  { text: "基于 Cordis，它把工具、会话、沙箱、子 Agent 和界面都做成可组合的插件。", startMs: 21000, endMs: 30000, timestampMs: 25500, confidence: 1 },
  { text: "官方仍把它标为 developer preview，版本可能发生不兼容变化。", startMs: 30000, endMs: 39000, timestampMs: 34500, confidence: 1 },
  { text: "我们沿着一条任务轨道，看五个常见选择。", startMs: 39000, endMs: 47000, timestampMs: 43000, confidence: 1 },
  { text: "第一站是 Bash：执行命令，并返回标准输出、错误和退出标记。", startMs: 47000, endMs: 56000, timestampMs: 51500, confidence: 1 },
  { text: "它可以接本地执行器，也可以接沙箱执行器；后台任务还需要继续装配。", startMs: 56000, endMs: 65000, timestampMs: 60500, confidence: 1 },
  { text: "重点不是能执行，而是结果留下了可判断的边界。", startMs: 65000, endMs: 71000, timestampMs: 68000, confidence: 1 },
  { text: "第二站是 Web：先搜索当前信息，再读取具体页面；结果会保留来源 URL。", startMs: 71000, endMs: 82000, timestampMs: 76500, confidence: 1 },
  { text: "返回内容属于外部、不可信数据。检索能力越强，来源和边界就越重要。", startMs: 82000, endMs: 84000, timestampMs: 83000, confidence: 1 },
  { text: "第三站是 MCP 资源：先配置 server，再列出资源或模板，最后按 URI 读取。", startMs: 84000, endMs: 95000, timestampMs: 89500, confidence: 1 },
  { text: "资源按需进入会话；没有配置服务器时，这些工具也不会凭空出现。", startMs: 95000, endMs: 107000, timestampMs: 101000, confidence: 1 },
  { text: "第四站是 Subagent：把一个任务交给子 Agent，再收回结果或继续对话。", startMs: 107000, endMs: 118000, timestampMs: 112500, confidence: 1 },
  { text: "它不是单包魔法，还需要 provider 和对应工具一起装配。", startMs: 118000, endMs: 129000, timestampMs: 123500, confidence: 1 },
  { text: "第五站来自社区：AgentTeams 创建带依赖的任务和成员，并在 Web UI 里观察团队。", startMs: 129000, endMs: 142000, timestampMs: 135500, confidence: 1 },
  { text: "它不是官方内置能力；当前 README 给出的配对是 0.1.22 对 0.2.0-rc.2。", startMs: 142000, endMs: 152000, timestampMs: 147000, confidence: 1 },
  { text: "挑插件记住三步：原始仓库和包名、维护信号、权限与宿主兼容性。", startMs: 152000, endMs: 166000, timestampMs: 159000, confidence: 1 },
  { text: "热门只代表可见度，不等于安全或稳定。", startMs: 166000, endMs: 183000, timestampMs: 174500, confidence: 1 },
  { text: "DeepSeek Harness 让能力成为可以替换、组合和追踪的模块。模型负责思考，Harness 负责接入真实环境。", startMs: 183000, endMs: 204000, timestampMs: 193500, confidence: 1 },
];

const clampProgress = (frame: number, start: number, end: number, easing = Easing.bezier(0.16, 1, 0.3, 1)) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

const currentCaption = (frame: number) => {
  const ms = (frame / FPS) * 1000;
  return captions.find((caption) => ms >= caption.startMs && ms < caption.endMs)?.text ?? captions[captions.length - 1].text;
};

const fadeIn = (progress: number, distance = 24) => ({
  opacity: interpolate(progress, [0, 1], [0.68, 1]),
  translate: `0px ${interpolate(progress, [0, 1], [distance, 0])}px`,
});

const Background: React.FC<{ accentColor?: string }> = ({ accentColor = COLORS.cyan }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle at 14% 18%, ${accentColor}18 0%, transparent 30%), radial-gradient(circle at 86% 78%, ${COLORS.purple}16 0%, transparent 34%), linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bg2} 58%, #11192a 100%)`,
    }}
  >
    <AbsoluteFill
      style={{
        opacity: 0.16,
        backgroundImage: "linear-gradient(rgba(246,248,251,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(246,248,251,0.08) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
      }}
    />
    <div style={{ position: "absolute", left: -220, top: -260, width: 760, height: 760, border: `1px solid ${accentColor}22`, borderRadius: "50%" }} />
    <div style={{ position: "absolute", right: -260, bottom: -360, width: 900, height: 900, border: `1px solid ${COLORS.purple}20`, borderRadius: "50%" }} />
  </AbsoluteFill>
);

const SceneChrome: React.FC<{ index: number; eyebrow: string; title: string; description: string; color: string }> = ({ index, eyebrow, title, description, color }) => (
  <>
    <div style={{ position: "absolute", left: VIDEO.safeX, top: 56, color, fontSize: 22, letterSpacing: 2.4, fontWeight: 900, textTransform: "uppercase" }}>{eyebrow}</div>
    <div style={{ position: "absolute", right: VIDEO.safeX, top: 56, color: COLORS.muted, fontSize: 20, fontFamily: TYPOGRAPHY.monoFamily }}>DSH / FIELD GUIDE / 0{index + 1}</div>
    <div style={{ position: "absolute", left: VIDEO.safeX, top: 104, color: COLORS.text, fontSize: 56, fontWeight: 900, lineHeight: 1.05 }}>{title}</div>
    <div style={{ position: "absolute", left: VIDEO.safeX, top: 178, color: COLORS.muted, fontSize: 25, lineHeight: 1.35, width: 930 }}>{description}</div>
  </>
);

const Rail: React.FC<{ active: number; color: string }> = ({ active, color }) => (
  <div style={{ position: "absolute", left: 148, right: 148, top: 274, display: "flex", alignItems: "center", gap: 0 }}>
    {Array.from({ length: 5 }).map((_, index) => (
      <React.Fragment key={index}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: index <= active ? color : COLORS.panelStrong, border: `2px solid ${index <= active ? color : COLORS.muted}66`, boxShadow: index === active ? `0 0 0 10px ${color}1c, 0 0 26px ${color}88` : "none" }} />
        {index < 4 ? <div style={{ flex: 1, height: 2, background: index < active ? `${color}bb` : COLORS.faint }} /> : null}
      </React.Fragment>
    ))}
  </div>
);

const Tag: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = COLORS.muted, style }) => (
  <div style={{ border: `1px solid ${color}66`, color, background: `${color}12`, borderRadius: 999, padding: "9px 16px", fontSize: 18, fontWeight: 800, fontFamily: TYPOGRAPHY.monoFamily, whiteSpace: "nowrap", ...style }}>{children}</div>
);

const Card: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = COLORS.cyan, style }) => (
  <div style={{ border: `1px solid ${color}55`, background: "rgba(10, 18, 32, 0.94)", borderRadius: RADIUS.md, boxShadow: `0 22px 60px ${color}12`, ...style }}>{children}</div>
);

const DotField: React.FC<{ color: string; count?: number; style?: React.CSSProperties }> = ({ color, count = 10, style }) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}>
    {Array.from({ length: count }).map((_, index) => {
      const x = (index * 83 + 12) % 96;
      const y = (index * 47 + 9) % 88;
      return <div key={index} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: index % 3 === 0 ? 5 : 3, height: index % 3 === 0 ? 5 : 3, borderRadius: "50%", background: color, opacity: index % 3 === 0 ? 0.44 : 0.23 }} />;
    })}
  </div>
);

const HookScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 0, 24);
  const pulse = 0.84 + Math.sin(frame / 8) * 0.08;
  return (
    <>
      <Background accentColor={COLORS.cyan} />
      <DotField color={COLORS.cyan} count={18} />
      <div style={{ position: "absolute", left: 148, top: 138, color: COLORS.cyan, fontSize: 24, letterSpacing: 3, fontWeight: 900 }}>THE AGENT IS NOT THE WHOLE SYSTEM</div>
      <div style={{ position: "absolute", left: 148, top: 192, color: COLORS.text, fontSize: 82, fontWeight: 900, lineHeight: 1.03, width: 810 }}>把能力装配起来。</div>
      <div style={{ position: "absolute", left: 151, top: 390, color: COLORS.muted, fontSize: 28, width: 610, lineHeight: 1.5 }}>模型负责思考，Harness 负责把思考接到真实环境里。</div>
      <div style={{ position: "absolute", left: 1030, top: 300, width: 310, height: 310, borderRadius: "50%", border: `2px solid ${COLORS.cyan}`, background: "rgba(67,217,255,0.08)", boxShadow: `0 0 80px ${COLORS.cyan}32`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", scale: interpolate(p, [0, 1], [0.86, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1) }) }}>
        <Brain size={62} color={COLORS.cyan} weight="duotone" />
        <div style={{ marginTop: 18, color: COLORS.text, fontSize: 30, fontWeight: 900 }}>MODEL</div>
        <div style={{ color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16, marginTop: 8 }}>reason / decide</div>
      </div>
      {[{ x: 945, y: 350 }, { x: 1338, y: 350 }, { x: 970, y: 610 }, { x: 1315, y: 610 }].map((point, index) => (
        <div key={index} style={{ position: "absolute", left: point.x, top: point.y, width: 88, height: 88, borderRadius: "50%", border: `2px dashed ${COLORS.green}bb`, color: COLORS.green, background: "rgba(109,241,177,0.06)", display: "flex", alignItems: "center", justifyContent: "center", opacity: p, scale: pulse }}>
          <Plug size={28} weight="bold" />
        </div>
      ))}
      <Tag color={COLORS.green} style={{ position: "absolute", left: 1030, top: 660, opacity: p }}>PLUGGABLE CAPABILITIES</Tag>
      <div style={{ position: "absolute", left: 1452, top: 890, color: COLORS.muted, fontSize: 18, fontFamily: TYPOGRAPHY.monoFamily }}>DEEPSEEK HARNESS / dsh</div>
    </>
  );
};

const IdentityScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 12 * FPS, 12 * FPS + 30);
  return (
    <>
      <Background accentColor={COLORS.green} />
      <SceneChrome index={1} eyebrow="IDENTITY" title="DeepSeek Harness / dsh" description="DeepSeek AI 的开源代理运行时：一切能力都可以成为可替换的插件。" color={COLORS.green} />
      <div style={{ position: "absolute", left: 220, top: 390, width: 520, height: 300, border: `1px solid ${COLORS.green}66`, borderRadius: RADIUS.md, background: "rgba(7,16,25,0.88)", padding: 30 }}>
        <Tag color={COLORS.green}>CORDIS KERNEL</Tag>
        <div style={{ color: COLORS.text, fontSize: 40, fontWeight: 900, marginTop: 28 }}>mount / unmount</div>
        <div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.45, marginTop: 16 }}>服务与事件让插件协作，配置决定能力组合。</div>
        <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}><Tag color={COLORS.cyan}>services</Tag><Tag color={COLORS.purple}>events</Tag><Tag color={COLORS.yellow}>config</Tag></div>
      </div>
      <div style={{ position: "absolute", left: 980, top: 342, width: 560, height: 410, border: `1px solid ${COLORS.cyan}4c`, borderRadius: "50%", transform: "rotate(-12deg)", opacity: 0.9 }} />
      {[{ x: 1010, y: 400, label: "tools", color: COLORS.cyan }, { x: 1330, y: 380, label: "sessions", color: COLORS.purple }, { x: 1070, y: 620, label: "sandbox", color: COLORS.yellow }, { x: 1370, y: 615, label: "ui", color: COLORS.green }].map((item, index) => (
        <Card key={item.label} color={item.color} style={{ position: "absolute", left: item.x, top: item.y, width: 220, height: 100, padding: 22, opacity: interpolate(p, [index * 0.13, Math.min(1, index * 0.13 + 0.42)], [0.62, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: `${interpolate(p, [0, 1], [index % 2 ? 26 : -26, 0])}px 0px` }}>
          <div style={{ color: item.color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16 }}>PLUGIN / 0{index + 1}</div>
          <div style={{ color: COLORS.text, fontSize: 27, fontWeight: 900, marginTop: 13 }}>{item.label}</div>
        </Card>
      ))}
      <Card color={COLORS.coral} style={{ position: "absolute", left: 1255, top: 814, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14 }}><Warning size={26} color={COLORS.coral} weight="fill" /><span style={{ color: COLORS.text, fontSize: 20, fontWeight: 800 }}>DEVELOPER PREVIEW / BREAKING CHANGES</span></Card>
    </>
  );
};

const MapScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 39 * FPS, 39 * FPS + 28);
  const items = [
    { name: "BASH", icon: TerminalWindow, color: COLORS.cyan },
    { name: "WEB", icon: Globe, color: COLORS.green },
    { name: "MCP", icon: Database, color: COLORS.yellow },
    { name: "SUBAGENT", icon: UsersThree, color: COLORS.purple },
    { name: "AGENTTEAMS", icon: GitBranch, color: COLORS.coral },
  ];
  return (
    <>
      <Background accentColor={COLORS.yellow} />
      <SceneChrome index={2} eyebrow="THE ROUTE" title="五个能力，沿同一条任务轨道" description="把名词变成动作：落地、求证、取上下文、分工，再扩展。" color={COLORS.yellow} />
      <div style={{ position: "absolute", left: 150, right: 150, top: 560, height: 4, background: COLORS.faint }} />
      <Card color={COLORS.text} style={{ position: "absolute", left: 160, top: 492, width: 190, height: 146, padding: 24 }}><Compass size={34} color={COLORS.text} weight="duotone" /><div style={{ color: COLORS.text, fontSize: 24, fontWeight: 900, marginTop: 16 }}>GOAL</div><div style={{ color: COLORS.muted, fontSize: 16, marginTop: 5 }}>目标进入</div></Card>
      {items.map((item, index) => {
        const x = 430 + index * 230;
        const IconComponent = item.icon;
        return <div key={item.name} style={{ position: "absolute", left: x, top: 500, width: 210, opacity: interpolate(p, [index * 0.14, Math.min(1, index * 0.14 + 0.38)], [0.12, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: `${interpolate(p, [0, 1], [0, 22 * (index % 2 ? -1 : 1)])}px 0px` }}><div style={{ width: 76, height: 76, borderRadius: "50%", border: `2px solid ${item.color}`, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: `0 0 30px ${item.color}33` }}><IconComponent size={34} color={item.color} weight="duotone" /></div><div style={{ textAlign: "center", color: COLORS.text, fontSize: 20, fontWeight: 900, marginTop: 18 }}>{item.name}</div><div style={{ height: 2, background: item.color, width: "100%", marginTop: 22, opacity: 0.55 }} /></div>;
      })}
      <Card color={COLORS.green} style={{ position: "absolute", right: 160, top: 492, width: 190, height: 146, padding: 24 }}><CheckCircle size={34} color={COLORS.green} weight="duotone" /><div style={{ color: COLORS.text, fontSize: 24, fontWeight: 900, marginTop: 16 }}>RESULT</div><div style={{ color: COLORS.muted, fontSize: 16, marginTop: 5 }}>可验证回传</div></Card>
    </>
  );
};

const BashScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 47 * FPS, 47 * FPS + 36);
  return (
    <>
      <Background accentColor={COLORS.cyan} />
      <SceneChrome index={3} eyebrow="01 / OFFICIAL CORE" title="Bash：让 Agent 把意图落到系统" description="官方 `dsh-tool-bash` 暴露 bash，并把命令结果变成可判断的事件。" color={COLORS.cyan} />
      <Rail active={0} color={COLORS.cyan} />
      <Card color={COLORS.cyan} style={{ position: "absolute", left: 170, top: 405, width: 540, height: 280, padding: 30, ...fadeIn(p) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: COLORS.cyan, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}><TerminalWindow size={26} /> command / fresh shell</div>
        <div style={{ marginTop: 32, color: COLORS.text, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 28 }}><span style={{ color: COLORS.green }}>$</span> inspect --workspace</div>
        <div style={{ marginTop: 24, color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20 }}>running → output → exit marker</div>
      </Card>
      <ArrowRight size={62} color={COLORS.cyan} weight="bold" style={{ position: "absolute", left: 765, top: 510, opacity: p }} />
      <Card color={COLORS.green} style={{ position: "absolute", left: 900, top: 405, width: 540, height: 280, padding: 30, ...fadeIn(p, -18) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}><CheckCircle size={26} /> result / inspectable</div>
        <div style={{ marginTop: 30, color: COLORS.text, fontSize: 27, fontWeight: 900 }}>stdout / stderr / exit code</div>
        <div style={{ marginTop: 22, color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20 }}>[exit code: 0]</div>
        <div style={{ marginTop: 26, display: "flex", gap: 12 }}><Tag color={COLORS.green}>local</Tag><Tag color={COLORS.yellow}>sandbox</Tag><Tag color={COLORS.purple}>jobs</Tag></div>
      </Card>
      <div style={{ position: "absolute", left: 220, top: 770, width: 1240, height: 70, border: `1px dashed ${COLORS.yellow}88`, borderRadius: 10, background: `${COLORS.yellow}08`, display: "flex", alignItems: "center", padding: "0 26px", gap: 18 }}><ShieldCheck size={30} color={COLORS.yellow} weight="duotone" /><span style={{ color: COLORS.yellow, fontSize: 21, fontWeight: 800 }}>边界证据：执行器 / 沙箱 / 后台任务都是独立装配点</span></div>
    </>
  );
};

const WebScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 71 * FPS, 71 * FPS + 36);
  return (
    <>
      <Background accentColor={COLORS.green} />
      <SceneChrome index={4} eyebrow="02 / OFFICIAL CORE" title="Web：发现信息，也留下来源" description="`dsh-tool-web` 把搜索与抓取拆成两个清晰的工具。" color={COLORS.green} />
      <Rail active={1} color={COLORS.green} />
      <Card color={COLORS.green} style={{ position: "absolute", left: 150, top: 410, width: 420, height: 250, padding: 28, ...fadeIn(p) }}>
        <div style={{ color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}>web_search</div>
        <div style={{ marginTop: 28, color: COLORS.text, fontSize: 28, fontWeight: 900 }}>DeepSeek Harness docs</div>
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12, color: COLORS.muted, fontSize: 19 }}><MagnifyingGlass size={28} color={COLORS.green} /> current / relevant / cited</div>
      </Card>
      <ArrowRight size={50} color={COLORS.green} weight="bold" style={{ position: "absolute", left: 610, top: 508, opacity: p }} />
      <Card color={COLORS.yellow} style={{ position: "absolute", left: 700, top: 410, width: 400, height: 250, padding: 28, ...fadeIn(p, -14) }}>
        <div style={{ color: COLORS.yellow, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}>web_fetch</div>
        <div style={{ marginTop: 28, color: COLORS.text, fontSize: 27, fontWeight: 900 }}>read the page</div>
        <div style={{ marginTop: 28, color: COLORS.muted, fontSize: 19, lineHeight: 1.4 }}>全文进入上下文，主动内容被过滤。</div>
      </Card>
      <ArrowRight size={50} color={COLORS.yellow} weight="bold" style={{ position: "absolute", left: 1140, top: 508, opacity: p }} />
      <Card color={COLORS.cyan} style={{ position: "absolute", left: 1230, top: 410, width: 430, height: 250, padding: 28, ...fadeIn(p, -22) }}>
        <div style={{ color: COLORS.cyan, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}>Sources</div>
        <div style={{ marginTop: 24, color: COLORS.text, fontSize: 20, lineHeight: 1.7, fontFamily: TYPOGRAPHY.monoFamily }}>github.com<br />deepseek-harness.github.io<br />deepseek.com</div>
        <Tag color={COLORS.coral} style={{ marginTop: 16, display: "inline-flex" }}><Warning size={17} weight="fill" /> external / untrusted</Tag>
      </Card>
    </>
  );
};

const McpScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 84 * FPS, 84 * FPS + 36);
  return (
    <>
      <Background accentColor={COLORS.yellow} />
      <SceneChrome index={5} eyebrow="03 / OFFICIAL CORE" title="MCP 资源：按需打开上下文" description="`dsh-mcp-resources` 只读已配置 server 的资源，不凭空创造连接。" color={COLORS.yellow} />
      <Rail active={2} color={COLORS.yellow} />
      <Card color={COLORS.yellow} style={{ position: "absolute", left: 150, top: 408, width: 390, height: 310, padding: 28, ...fadeIn(p) }}>
        <Tag color={COLORS.yellow}>CONFIGURED SERVER</Tag>
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 15, color: COLORS.text, fontSize: 28, fontWeight: 900 }}><Database size={34} color={COLORS.yellow} weight="duotone" /> research-db</div>
        <div style={{ marginTop: 30, color: COLORS.muted, fontSize: 19, lineHeight: 1.5 }}>scope / explicit server / on demand</div>
      </Card>
      <div style={{ position: "absolute", left: 595, top: 452, width: 510, height: 225, padding: 26, borderLeft: `2px solid ${COLORS.yellow}66`, borderRight: `2px solid ${COLORS.yellow}66` }}>
        {["list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"].map((name, index) => <div key={name} style={{ height: 54, marginBottom: 14, border: `1px solid ${COLORS.yellow}4c`, background: `${COLORS.yellow}0d`, borderRadius: 8, display: "flex", alignItems: "center", padding: "0 18px", color: COLORS.text, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17, opacity: interpolate(p, [index * 0.15, Math.min(1, index * 0.15 + 0.34)], [0.62, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: `0px ${interpolate(p, [0, 1], [20 * (index + 1), 0])}px` }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.yellow, marginRight: 13 }} />{name}</div>)}
      </div>
      <Card color={COLORS.cyan} style={{ position: "absolute", left: 1170, top: 408, width: 500, height: 310, padding: 28, ...fadeIn(p, -18) }}>
        <div style={{ color: COLORS.cyan, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}>SESSION LOG / resource result</div>
        <div style={{ marginTop: 28, color: COLORS.text, fontSize: 23, fontWeight: 800 }}>MCP server: research-db</div>
        <div style={{ marginTop: 20, color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 16, lineHeight: 1.7 }}>uri: resource://brief/latest<br />mime: text/markdown<br />text: loaded on demand</div>
        <div style={{ marginTop: 18, color: COLORS.green, fontSize: 18, fontWeight: 800 }}>no server → no tools</div>
      </Card>
    </>
  );
};

const SubagentScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 107 * FPS, 107 * FPS + 36);
  return (
    <>
      <Background accentColor={COLORS.purple} />
      <SceneChrome index={6} eyebrow="04 / OFFICIAL CORE" title="Subagent：把一个问题拆成几条路" description="服务、provider、工具三者共同组成可委派的子 Agent 能力。" color={COLORS.purple} />
      <Rail active={3} color={COLORS.purple} />
      <Card color={COLORS.purple} style={{ position: "absolute", left: 180, top: 452, width: 340, height: 180, padding: 26, ...fadeIn(p) }}><UsersThree size={42} color={COLORS.purple} weight="duotone" /><div style={{ color: COLORS.text, fontSize: 30, fontWeight: 900, marginTop: 20 }}>PARENT AGENT</div><div style={{ color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17, marginTop: 10 }}>delegate(task)</div></Card>
      <div style={{ position: "absolute", left: 560, top: 528, width: 360, height: 2, background: COLORS.purple, transform: "rotate(-18deg)", transformOrigin: "left center", opacity: p }} />
      <div style={{ position: "absolute", left: 560, top: 528, width: 360, height: 2, background: COLORS.purple, transform: "rotate(18deg)", transformOrigin: "left center", opacity: p }} />
      <Card color={COLORS.cyan} style={{ position: "absolute", left: 880, top: 370, width: 300, height: 145, padding: 22, ...fadeIn(p, 22) }}><Tag color={COLORS.cyan}>provider / spawn</Tag><div style={{ color: COLORS.text, fontSize: 27, fontWeight: 900, marginTop: 20 }}>Research child</div></Card>
      <Card color={COLORS.green} style={{ position: "absolute", left: 880, top: 590, width: 300, height: 145, padding: 22, ...fadeIn(p, 30) }}><Tag color={COLORS.green}>provider / spawn</Tag><div style={{ color: COLORS.text, fontSize: 27, fontWeight: 900, marginTop: 20 }}>Test child</div></Card>
      <ArrowRight size={54} color={COLORS.purple} weight="bold" style={{ position: "absolute", left: 1240, top: 518, opacity: p }} />
      <Card color={COLORS.yellow} style={{ position: "absolute", left: 1330, top: 452, width: 350, height: 180, padding: 26, ...fadeIn(p, -20) }}><CheckCircle size={42} color={COLORS.yellow} weight="duotone" /><div style={{ color: COLORS.text, fontSize: 28, fontWeight: 900, marginTop: 18 }}>RESULT MERGED</div><div style={{ color: COLORS.muted, fontSize: 17, marginTop: 10 }}>one-shot or continuable</div></Card>
      <Tag color={COLORS.coral} style={{ position: "absolute", left: 655, top: 794 }}><Warning size={17} weight="fill" /> service alone is not enough</Tag>
    </>
  );
};

const CommunityScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 129 * FPS, 129 * FPS + 36);
  return (
    <>
      <Background accentColor={COLORS.coral} />
      <SceneChrome index={7} eyebrow="05 / COMMUNITY" title="AgentTeams：把生态接进来" description="社区插件可以把单 Agent 扩展成有依赖关系的协作团队。" color={COLORS.coral} />
      <Rail active={4} color={COLORS.coral} />
      <Card color={COLORS.coral} style={{ position: "absolute", left: 160, top: 410, width: 560, height: 300, padding: 28, ...fadeIn(p) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><GitBranch size={34} color={COLORS.coral} weight="duotone" /><Tag color={COLORS.coral}>COMMUNITY / ORIGINAL REPO</Tag></div>
        <div style={{ color: COLORS.text, fontSize: 38, fontWeight: 900, marginTop: 26 }}>@nanmicoder/dsh-agent-teams</div>
        <div style={{ color: COLORS.muted, fontSize: 21, lineHeight: 1.45, marginTop: 18 }}>captain · members · dependency-aware tasks · Web UI</div>
        <div style={{ marginTop: 25, display: "flex", gap: 14 }}><Tag color={COLORS.green}>0.1.22</Tag><Tag color={COLORS.yellow}>DSH 0.2.0-rc.2</Tag></div>
      </Card>
      <div style={{ position: "absolute", left: 930, top: 405, width: 700, height: 310 }}>
        <div style={{ position: "absolute", left: 270, top: 0, width: 170, height: 72, border: `1px solid ${COLORS.coral}88`, background: `${COLORS.coral}18`, borderRadius: 12, color: COLORS.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, fontWeight: 900, opacity: p }}>CAPTAIN</div>
        {[
          { left: 0, top: 175, text: "research", color: COLORS.cyan },
          { left: 255, top: 175, text: "build", color: COLORS.green },
          { left: 510, top: 175, text: "review", color: COLORS.yellow },
        ].map((item) => <div key={item.text} style={{ position: "absolute", left: item.left, top: item.top, width: 170, height: 74, border: `1px solid ${item.color}77`, background: `${item.color}12`, borderRadius: 12, color: COLORS.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: TYPOGRAPHY.monoFamily, fontSize: 19, opacity: interpolate(p, [0, 1], [0.68, 1]), translate: `0px ${interpolate(p, [0, 1], [24, 0])}px` }}>{item.text}</div>)}
        <svg width="700" height="310" style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}><path d="M355 72 L85 175 M355 72 L340 175 M355 72 L595 175" fill="none" stroke={COLORS.coral} strokeWidth="3" strokeDasharray="8 10" opacity={interpolate(p, [0, 1], [0.68, 1])} /></svg>
      </div>
      <Tag color={COLORS.coral} style={{ position: "absolute", left: 985, top: 770 }}><Warning size={17} weight="fill" /> community ≠ official / pin versions</Tag>
    </>
  );
};

const RulesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 152 * FPS, 152 * FPS + 40);
  const checks = [
    { icon: FileText, title: "原始仓库", body: "准确包名 / README / source", color: COLORS.cyan },
    { icon: CircleNotch, title: "维护信号", body: "release / activity / matrix", color: COLORS.green },
    { icon: ShieldCheck, title: "权限与兼容", body: "shell / network / scripts", color: COLORS.yellow },
  ];
  return (
    <>
      <Background accentColor={COLORS.cyan} />
      <SceneChrome index={8} eyebrow="THE FILTER" title="热门只是起点，不是结论" description="先验证来源，再判断维护，最后核对权限和宿主版本。" color={COLORS.cyan} />
      <div style={{ position: "absolute", left: 150, top: 425, right: 150, height: 305, display: "flex", gap: 24 }}>
        {checks.map((check, index) => { const IconComponent = check.icon; return <Card key={check.title} color={check.color} style={{ flex: 1, padding: 30, opacity: interpolate(p, [index * 0.16, Math.min(1, index * 0.16 + 0.38)], [0.65, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: `0px ${interpolate(p, [0, 1], [42 * (index + 1), 0])}px` }}><IconComponent size={44} color={check.color} weight="duotone" /><div style={{ color: COLORS.text, fontSize: 30, fontWeight: 900, marginTop: 28 }}>{check.title}</div><div style={{ color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18, lineHeight: 1.6, marginTop: 14 }}>{check.body}</div><div style={{ marginTop: 38, height: 4, background: check.color, width: `${76 - index * 14}%`, borderRadius: 99 }} /></Card>; })}
      </div>
      <div style={{ position: "absolute", left: 350, top: 800, right: 350, height: 68, background: `${COLORS.coral}10`, border: `1px solid ${COLORS.coral}66`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 15, color: COLORS.coral, fontSize: 23, fontWeight: 900, opacity: p }}><Warning size={28} weight="fill" /> 星数高 ≠ 安全 / 稳定 / 适合你的 profile</div>
    </>
  );
};

const OutroScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampProgress(frame, 183 * FPS, 183 * FPS + 40);
  return (
    <>
      <Background accentColor={COLORS.green} />
      <DotField color={COLORS.green} count={22} />
      <div style={{ position: "absolute", left: 148, top: 104, color: COLORS.green, fontSize: 23, letterSpacing: 3, fontWeight: 900 }}>DEEPSEEK HARNESS / dsh</div>
      <div style={{ position: "absolute", left: 148, top: 170, color: COLORS.text, fontSize: 70, fontWeight: 900 }}>模型是灵魂，插件是轨道。</div>
      <div style={{ position: "absolute", left: 148, top: 278, color: COLORS.muted, fontSize: 27, lineHeight: 1.45, width: 740 }}>把能力拆成可替换、可组合、可追踪的模块，Agent 才能真正进入真实环境。</div>
      <div style={{ position: "absolute", left: 148, top: 470, width: 1620, height: 170, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: interpolate(p, [0, 1], [0.68, 1]) }}>
        <div style={{ width: 280, height: 128, border: `1px solid ${COLORS.cyan}88`, background: `${COLORS.cyan}12`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.text, fontSize: 30, fontWeight: 900 }}>MODEL</div>
        <ArrowRight size={56} color={COLORS.green} weight="bold" />
        <div style={{ width: 380, height: 128, border: `1px solid ${COLORS.green}88`, background: `${COLORS.green}12`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.text, fontSize: 30, fontWeight: 900 }}>PLUGIN RAIL</div>
        <ArrowRight size={56} color={COLORS.green} weight="bold" />
        <div style={{ width: 280, height: 128, border: `1px solid ${COLORS.yellow}88`, background: `${COLORS.yellow}12`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.text, fontSize: 30, fontWeight: 900 }}>WORLD</div>
      </div>
      <div style={{ position: "absolute", left: 148, top: 760, color: COLORS.muted, fontSize: 17, lineHeight: 1.65, fontFamily: TYPOGRAPHY.monoFamily }}>SOURCES / deepseek.com/harness · github.com/deepseek-ai/deepseek-harness · github.com/NanmiCoder/dsh-agent-teams</div>
      <div style={{ position: "absolute", right: 150, top: 805, color: COLORS.green, fontSize: 18, fontFamily: TYPOGRAPHY.monoFamily }}>FACTS CHECKED / 2026-10-07</div>
    </>
  );
};

const sceneComponents = [HookScene, IdentityScene, MapScene, BashScene, WebScene, McpScene, SubagentScene, CommunityScene, RulesScene, OutroScene] as const;

export const DeepSeekHarnessPluginsVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneIndex = Math.min(sceneStarts.length - 1, sceneStarts.findIndex((start, index) => frame / fps < sceneEnds[index]) < 0 ? sceneStarts.length - 1 : sceneStarts.findIndex((start, index) => frame / fps < sceneEnds[index]));
  const Scene = sceneComponents[sceneIndex];
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: TYPOGRAPHY.fontFamily,
        scale: 1.004,
      }}
    >
      <Scene frame={frame} />
      <Audio src={staticFile("deepseek-harness-plugins-narration.wav")} volume={1} premountFor={fps} />
      <div style={{ position: "absolute", left: 148, right: 148, bottom: 28, height: 3, background: COLORS.faint }}><div style={{ width: `${(frame / deepSeekHarnessPluginsDurationInFrames) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.yellow}, ${COLORS.coral}, ${COLORS.purple})` }} /></div>
      <div style={{ position: "absolute", left: 150, right: 150, bottom: 60, minHeight: 104, padding: "18px 42px", border: `1px solid ${COLORS.faint}`, borderRadius: RADIUS.md, background: "rgba(3,8,20,0.94)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: COLORS.text, fontSize: TYPOGRAPHY.caption, fontWeight: 750, lineHeight: 1.34, textAlign: "center", maxWidth: 1520 }}>{currentCaption(frame)}</div>
      </div>
      <div style={{ position: "absolute", right: 150, top: 100, color: COLORS.muted, fontSize: 16, fontFamily: TYPOGRAPHY.monoFamily }}>1920×1080 / 30 FPS</div>
    </AbsoluteFill>
  );
};
