import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { useGsapTimeline } from "@remotion/gsap";
import type { CSSProperties, ReactNode } from "react";

const C = {
  bg: "#080d17",
  panel: "#111a2a",
  panel2: "#162238",
  text: "#f6f8fb",
  muted: "#9aa9bf",
  cyan: "#43d9ff",
  green: "#6df1b1",
  yellow: "#ffd166",
  coral: "#ff806d",
  purple: "#ae8bff",
};

const FPS = 30;
const DURATION = 6600;

type Scene = {
  from: number;
  to: number;
  kicker: string;
  title: string;
  description: string;
  kind: "hook" | "map" | "direction" | "market" | "quote" | "orders" | "behavior" | "position" | "chart" | "risk" | "close";
};

type Cue = { from: number; to: number; text: string };

const scenes: Scene[] = [
  { from: 0, to: 480, kicker: "00 / LISTEN IN", title: "“梭哈、套牢、接飞刀”到底在说什么？", description: "股票群里的高频行话，先翻译成人话，再判断它是不是事实。", kind: "hook" },
  { from: 480, to: 900, kicker: "01 / THE MAP", title: "先按问题分组，不按热闹背词", description: "方向、行情、下单、行为、图表、风控，六个抽屉足够装下大部分高频表达。", kind: "map" },
  { from: 900, to: 1500, kicker: "02 / DIRECTION", title: "多头与空头：你在押涨，还是押跌？", description: "做多通常是买入后期待上涨；做空涉及借入并卖出，期待下跌后再买回。", kind: "direction" },
  { from: 1500, to: 2040, kicker: "03 / MARKET MOOD", title: "牛、熊、震荡：说的是环境，不是单只股票", description: "牛市偏上涨，熊市偏下跌；震荡则是价格在区间里来回。它们都是描述，不是保证。", kind: "market" },
  { from: 2040, to: 2580, kicker: "04 / ORDER BOOK", title: "买一、卖一、价差：成交发生在缝隙里", description: "买方最高愿意出的价格是 bid，卖方最低愿意接受的价格是 ask，两者差额就是 spread。", kind: "quote" },
  { from: 2580, to: 3180, kicker: "05 / ORDER TYPES", title: "市价、限价、止损：速度和价格的取舍", description: "市价单偏向尽快成交；限价单限定价格；止损单触发后通常转成市价单。", kind: "orders" },
  { from: 3180, to: 3720, kicker: "06 / BEHAVIOR", title: "追涨杀跌，不是交易策略的同义词", description: "它描述的是被价格带着走的行为。抄底也不等于低风险，接飞刀强调下跌趋势中的危险。", kind: "behavior" },
  { from: 3720, to: 4320, kicker: "07 / POSITION", title: "仓位、加仓、减仓：先问风险暴露有多大", description: "仓位是资金暴露程度；加仓和减仓改变暴露。止盈、止损是预先定义退出条件的动作。", kind: "position" },
  { from: 4320, to: 4920, kicker: "08 / CHART TALK", title: "放量、缩量、突破、回踩：图表上的动词", description: "它们描述成交量和价格的变化过程，必须结合周期、标的和上下文理解。", kind: "chart" },
  { from: 4920, to: 5700, kicker: "09 / BOUNDARY", title: "行话是标签，不是买卖信号", description: "同一个词，在不同市场、平台和语境里可能含义不同。先确认定义，再核对数据，最后才谈判断。", kind: "risk" },
  { from: 5700, to: 6600, kicker: "10 / TAKEAWAY", title: "听懂黑话，先把它还原成动作", description: "谁在做什么？价格还是数量？描述事实，还是表达情绪？这三问，比背更多词更有用。", kind: "close" },
];

const cues: Cue[] = [
  { from: 0, to: 210, text: "“梭哈、套牢、接飞刀”到底在说什么？" },
  { from: 210, to: 480, text: "先翻译成人话，再判断它是不是事实。" },
  { from: 480, to: 690, text: "六个抽屉：方向、行情、下单、行为、图表、风控。" },
  { from: 690, to: 900, text: "先分类，才能避免把情绪词当成技术词。" },
  { from: 900, to: 1110, text: "多头：期待上涨。空头：期待下跌。" },
  { from: 1110, to: 1320, text: "做多常见路径是买入后等待上涨。" },
  { from: 1320, to: 1500, text: "做空涉及借入并卖出，之后再买回归还。" },
  { from: 1500, to: 1680, text: "牛市偏上涨，熊市偏下跌。" },
  { from: 1680, to: 1860, text: "震荡：价格在区间里来回。" },
  { from: 1860, to: 2040, text: "它们描述环境，不是对下一根 K 线的保证。" },
  { from: 2040, to: 2220, text: "买一是买方当前最高报价，卖一是卖方当前最低报价。" },
  { from: 2220, to: 2400, text: "两者之间的差额，就是价差。" },
  { from: 2400, to: 2580, text: "成交要跨过这条缝隙，报价也会持续变化。" },
  { from: 2580, to: 2790, text: "市价单：优先速度，不保证成交价格。" },
  { from: 2790, to: 3000, text: "限价单：限定价格，但可能等不到成交。" },
  { from: 3000, to: 3180, text: "止损单：达到触发价后，通常转成市价单。" },
  { from: 3180, to: 3360, text: "追涨杀跌：价格上涨就追，价格下跌就砍。" },
  { from: 3360, to: 3540, text: "抄底：尝试在下跌后买入，但底部事后才知道。" },
  { from: 3540, to: 3720, text: "接飞刀：在快速下跌中贸然接手，风险更直观。" },
  { from: 3720, to: 3930, text: "仓位，是你对某个标的的资金暴露程度。" },
  { from: 3930, to: 4140, text: "加仓增加暴露，减仓降低暴露。" },
  { from: 4140, to: 4320, text: "止盈和止损，都是退出条件，不是盈利保证。" },
  { from: 4320, to: 4500, text: "放量：成交量相对增加。缩量：成交量相对减少。" },
  { from: 4500, to: 4680, text: "突破：价格穿过被关注的区间或位置。" },
  { from: 4680, to: 4920, text: "回踩：突破后回到原位置附近重新观察。" },
  { from: 4920, to: 5160, text: "行话是标签，不是买卖信号。" },
  { from: 5160, to: 5400, text: "同一个词，可能因市场、平台和语境而变化。" },
  { from: 5400, to: 5700, text: "先确认定义，再核对数据，最后才谈判断。" },
  { from: 5700, to: 5910, text: "谁在做什么？价格还是数量？" },
  { from: 5910, to: 6120, text: "这是事实描述，还是情绪表达？" },
  { from: 6120, to: 6420, text: "听懂黑话的终点，是把它还原成可检查的动作。" },
  { from: 6420, to: 6600, text: "本视频仅作金融知识科普，不构成投资建议。" },
];

const ease = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
const currentScene = (frame: number) => scenes.find((s) => frame >= s.from && frame < s.to) ?? scenes[0];
const currentCue = (frame: number) => cues.find((cue) => frame >= cue.from && frame < cue.to);

const Panel: React.FC<{ children: ReactNode; style?: CSSProperties; accent?: string; className?: string }> = ({ children, style, accent, className }) => (
  <div className={className} style={{ border: `1px solid ${accent ? `${accent}99` : "rgba(246,248,251,0.14)"}`, background: "rgba(15,24,40,0.9)", borderRadius: 8, boxShadow: accent ? `0 0 38px ${accent}22` : "0 18px 60px rgba(0,0,0,0.22)", ...style }}>{children}</div>
);

const Background: React.FC = () => {
  return <AbsoluteFill style={{ background: "radial-gradient(circle at 15% 20%, rgba(67,217,255,0.14), transparent 28%), radial-gradient(circle at 82% 76%, rgba(174,139,255,0.13), transparent 32%), #080d17" }}>
    <AbsoluteFill style={{ opacity: 0.18, backgroundImage: "linear-gradient(rgba(246,248,251,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(246,248,251,0.08) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
  </AbsoluteFill>;
};

const Header: React.FC<{ scene: Scene; opacity: number }> = ({ scene, opacity }) => <div style={{ position: "absolute", left: 88, top: 72, width: 850, opacity, transform: `translateY(${(1 - opacity) * 18}px)` }}>
  <div style={{ color: C.green, fontSize: 28, fontWeight: 800, letterSpacing: 1, marginBottom: 22 }}>{scene.kicker}</div>
  <div style={{ color: C.text, fontSize: 68, lineHeight: 1.08, fontWeight: 900 }}>{scene.title}</div>
  <div style={{ color: C.muted, fontSize: 30, lineHeight: 1.48, marginTop: 26, maxWidth: 800 }}>{scene.description}</div>
</div>;

const CaptionBar: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = currentCue(frame);
  return <div style={{ position: "absolute", left: 154, right: 154, bottom: 64, minHeight: 106, display: "flex", justifyContent: "center", alignItems: "center", padding: "18px 40px", background: "rgba(3,8,20,0.92)", border: "1px solid rgba(246,248,251,0.14)", borderRadius: 8 }}><div style={{ color: "#fff", fontSize: 34, lineHeight: 1.38, textAlign: "center", fontWeight: 700 }}>{cue?.text}</div></div>;
};

const Rail: React.FC = () => { const frame = useCurrentFrame(); return <div style={{ position: "absolute", left: 88, right: 88, bottom: 31, height: 3, background: "rgba(246,248,251,0.15)" }}><div style={{ width: `${(frame / DURATION) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.cyan}, ${C.green}, ${C.yellow}, ${C.coral})` }} /></div>; };

const HookVisual: React.FC<{ p: number }> = ({ p }) => <div style={{ position: "absolute", right: 120, top: 190, width: 760, height: 600, opacity: p }}>
  <Panel accent={C.coral} style={{ position: "absolute", left: 0, top: 80, width: 330, height: 360, padding: 30, transform: `rotate(-${2 + p * 2}deg)` }}><div style={{ color: C.coral, fontSize: 24, fontWeight: 800 }}>CHAT / 09:41</div><div style={{ color: C.text, fontSize: 32, fontWeight: 800, marginTop: 35 }}>“满仓梭哈”</div><div style={{ color: C.muted, fontSize: 22, lineHeight: 1.55, marginTop: 28 }}>“打板”<br />“被套了”<br />“别接飞刀”</div></Panel>
  <div style={{ position: "absolute", left: 330, top: 255, width: 92, height: 4, background: C.yellow, transform: `scaleX(${p})`, transformOrigin: "left" }} />
  <Panel accent={C.green} style={{ position: "absolute", right: 0, top: 20, width: 340, height: 470, padding: 30, transform: `translateY(${(1 - p) * 28}px)` }}><div style={{ color: C.green, fontSize: 24, fontWeight: 800 }}>PLAIN LANGUAGE</div><div style={{ color: C.text, fontSize: 29, lineHeight: 1.55, marginTop: 38 }}>资金暴露<br />交易动作<br />风险边界</div><div style={{ color: C.cyan, fontFamily: "Menlo, monospace", fontSize: 22, marginTop: 42 }}>label → meaning</div></Panel>
</div>;

const MapVisual: React.FC<{ p: number }> = ({ p }) => { const labels = ["方向", "行情", "下单", "行为", "图表", "风控"]; return <div style={{ position: "absolute", right: 115, top: 180, width: 850, height: 600, opacity: p }}><div style={{ position: "absolute", left: 280, top: 160, width: 250, height: 250, borderRadius: "50%", border: `2px solid ${C.cyan}`, background: "rgba(67,217,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: C.text, fontSize: 30, fontWeight: 900, textAlign: "center", boxShadow: `0 0 52px ${C.cyan}22` }}>股票<br />行话</div>{labels.map((label, i) => { const a = (Math.PI * 2 * i) / labels.length - Math.PI / 2; const color = [C.cyan, C.green, C.yellow, C.coral, C.purple, C.muted][i]; const x = 405 + Math.cos(a) * 350; const y = 285 + Math.sin(a) * 235; const q = ease(p, i * 0.08, 0.35 + i * 0.08); return <div key={label}><div style={{ position: "absolute", left: 405, top: 284, width: 230, height: 2, background: `${color}88`, transformOrigin: "left", transform: `rotate(${a}rad) scaleX(${q})` }} /><Panel accent={color} style={{ position: "absolute", left: x - 82, top: y - 30, width: 164, height: 60, display: "flex", justifyContent: "center", alignItems: "center", color, fontSize: 25, opacity: q, transform: `translateY(${(1 - q) * 18}px)` }}>{label}</Panel></div>; })}</div>; };

const DirectionVisual: React.FC<{ p: number }> = ({ p }) => {
  const timelineRef = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    const sceneStart = 900 / FPS;
    timeline.from(selector(".direction-card"), { opacity: 0, x: -70, duration: 0.45, stagger: 0.22 }, sceneStart + 0.2);
    timeline.from(selector(".direction-arrow"), { scaleX: 0, duration: 0.5, transformOrigin: "left center" }, sceneStart + 0.72);
  }, { dependencies: [] });
  return <div ref={timelineRef} style={{ position: "absolute", right: 105, top: 220, width: 860, height: 500, opacity: p }}>
    <Panel className="direction-card" accent={C.green} style={{ position: "absolute", left: 0, top: 30, width: 350, height: 330, padding: 28 }}><div style={{ color: C.green, fontFamily: "Menlo, monospace", fontSize: 24 }}>LONG / 多头</div><div style={{ color: C.text, fontSize: 32, fontWeight: 800, marginTop: 34 }}>买入 → 期待上涨</div><div style={{ color: C.muted, fontSize: 22, marginTop: 32 }}>价格上涨，持仓价值可能增加</div></Panel>
    <Panel className="direction-card" accent={C.coral} style={{ position: "absolute", right: 0, top: 145, width: 350, height: 330, padding: 28 }}><div style={{ color: C.coral, fontFamily: "Menlo, monospace", fontSize: 24 }}>SHORT / 空头</div><div style={{ color: C.text, fontSize: 32, fontWeight: 800, marginTop: 34 }}>借入卖出 → 期待下跌</div><div style={{ color: C.muted, fontSize: 22, marginTop: 32 }}>上涨方向也会带来反向风险</div></Panel>
    <div className="direction-arrow" style={{ position: "absolute", left: 330, top: 220, width: 200, height: 3, background: `linear-gradient(90deg, ${C.green}, ${C.yellow}, ${C.coral})`, transformOrigin: "left" }} />
    <div style={{ position: "absolute", left: 390, top: 170, color: C.yellow, fontFamily: "Menlo, monospace", fontSize: 23 }}>direction</div>
  </div>;
};

const MarketVisual: React.FC<{ p: number }> = ({ p }) => { const wave = Array.from({ length: 16 }, (_, i) => { const x = i * 47; const y = 190 - Math.sin(i * 0.9) * (i < 6 ? 38 : i < 11 ? 15 : 32) - (i < 6 ? i * 3 : i > 11 ? (i - 11) * 6 : 0); return `${x},${y}`; }).join(" "); return <div style={{ position: "absolute", right: 112, top: 210, width: 860, height: 480, opacity: p }}><Panel accent={C.cyan} style={{ position: "absolute", inset: 0, padding: 28 }}><div style={{ color: C.muted, fontFamily: "Menlo, monospace", fontSize: 22 }}>MARKET CONTEXT / description</div><div style={{ position: "absolute", left: 36, right: 36, top: 96, height: 250, borderBottom: "1px solid rgba(246,248,251,0.18)", borderLeft: "1px solid rgba(246,248,251,0.18)" }}><svg width="780" height="250" viewBox="0 0 780 250"><polyline points={wave} fill="none" stroke={C.cyan} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `translate(20px, ${p * 35}px) scale(${0.95 + p * 0.05})` }} /></svg></div><div style={{ position: "absolute", left: 44, bottom: 28, display: "flex", gap: 52, color: C.text, fontSize: 24 }}><span style={{ color: C.green }}>牛市 / 偏上</span><span style={{ color: C.coral }}>熊市 / 偏下</span><span style={{ color: C.yellow }}>震荡 / 区间</span></div></Panel></div>; };

const QuoteVisual: React.FC<{ p: number }> = ({ p }) => <div style={{ position: "absolute", right: 135, top: 215, width: 820, height: 450, opacity: p }}><Panel style={{ position: "absolute", left: 0, top: 0, width: 350, height: 400, padding: 28 }} accent={C.green}><div style={{ color: C.green, fontFamily: "Menlo, monospace", fontSize: 24 }}>BUY SIDE</div>{["买三  98.7", "买二  98.8", "买一  98.9"].map((x, i) => <div key={x} style={{ marginTop: 30, height: 38, padding: "7px 12px", background: `rgba(109,241,177,${0.07 + i * 0.04})`, color: C.text, fontFamily: "Menlo, monospace", fontSize: 22 }}>{x}</div>)}</Panel><Panel style={{ position: "absolute", right: 0, top: 0, width: 350, height: 400, padding: 28 }} accent={C.coral}><div style={{ color: C.coral, fontFamily: "Menlo, monospace", fontSize: 24 }}>SELL SIDE</div>{["卖一  99.1", "卖二  99.2", "卖三  99.3"].map((x, i) => <div key={x} style={{ marginTop: 30, height: 38, padding: "7px 12px", background: `rgba(255,128,109,${0.07 + i * 0.04})`, color: C.text, fontFamily: "Menlo, monospace", fontSize: 22 }}>{x}</div>)}</Panel><div style={{ position: "absolute", left: 355, top: 166, width: 110, textAlign: "center", color: C.yellow, fontFamily: "Menlo, monospace", fontSize: 21, opacity: p }}>spread<br />0.2</div></div>;

const OrdersVisual: React.FC<{ p: number }> = ({ p }) => {
  const timelineRef = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    const sceneStart = 2580 / FPS;
    timeline.from(selector(".order-row"), { opacity: 0, y: 48, duration: 0.38, stagger: 0.2 }, sceneStart + 0.18);
  }, { dependencies: [] });
  const rows = [["市价单", "快", C.coral], ["限价单", "定价", C.cyan], ["止损单", "触发", C.yellow]] as const;
  return <div ref={timelineRef} style={{ position: "absolute", right: 120, top: 220, width: 850, height: 460, opacity: p }}><div style={{ display: "flex", flexDirection: "column", gap: 18 }}>{rows.map(([name, tag, color], i) => <Panel className="order-row" key={name} accent={color} style={{ height: 108, padding: "25px 28px", display: "flex", alignItems: "center" }}><div style={{ color, fontSize: 28, fontWeight: 850, width: 180 }}>{name}</div><div style={{ color: C.text, fontSize: 25 }}>{tag}</div><div style={{ marginLeft: "auto", color: C.muted, fontSize: 21 }}>{i === 0 ? "成交价不保证" : i === 1 ? "可能不成交" : "触发后再执行"}</div></Panel>)}</div><div style={{ position: "absolute", left: 0, right: 0, bottom: 0, color: C.muted, fontFamily: "Menlo, monospace", fontSize: 21 }}>speed ↔ price certainty</div></div>;
};

const BehaviorVisual: React.FC<{ p: number }> = ({ p }) => {
  const timelineRef = useGsapTimeline<SVGSVGElement>(({ timeline, selector }) => {
    const sceneStart = 3180 / FPS;
    timeline.from(selector(".behavior-step"), { opacity: 0, y: 18, duration: 0.32, stagger: 0.18 }, sceneStart + 0.35);
  }, { dependencies: [] });
  const points = "58,78 180,52 286,108 398,176 510,246 620,214 730,228";
  const steps = [
    { label: "追涨", detail: "上涨时追入", color: C.green, x: 180, y: 52, textY: 28 },
    { label: "杀跌", detail: "下跌时砍仓", color: C.coral, x: 286, y: 108, textY: 154 },
    { label: "接飞刀", detail: "急跌中贸然买入", color: C.yellow, x: 398, y: 176, textY: 222 },
    { label: "抄底", detail: "尝试买在低位", color: C.cyan, x: 510, y: 246, textY: 292 },
  ];
  return <div style={{ position: "absolute", right: 108, top: 178, width: 870, height: 590, opacity: p }}>
    <Panel accent={C.coral} style={{ position: "absolute", inset: 0, padding: 28 }}>
      <div style={{ color: C.muted, fontFamily: "Menlo, monospace", fontSize: 21 }}>PRICE PATH / BEHAVIOR</div>
      <div style={{ color: C.text, fontSize: 24, marginTop: 14 }}>同一条下跌路径上，可能出现不同的跟随行为</div>
      <svg ref={timelineRef} width="810" height="360" viewBox="0 0 810 360" style={{ position: "absolute", left: 30, top: 98, overflow: "visible" }}>
        <line x1="58" y1="318" x2="750" y2="318" stroke="rgba(246,248,251,0.22)" strokeWidth="2" />
        <line x1="58" y1="28" x2="58" y2="318" stroke="rgba(246,248,251,0.22)" strokeWidth="2" />
        <text x="58" y="344" fill={C.muted} fontSize="18">时间 →</text>
        <text x="8" y="42" fill={C.muted} fontSize="18">价格</text>
        <polyline points={points} fill="none" stroke={C.coral} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />
        {steps.map((step, index) => <g key={step.label} className="behavior-step">
          <line x1={step.x} y1={step.y} x2={step.x} y2={step.textY < step.y ? step.textY + 10 : step.textY - 10} stroke={step.color} strokeWidth="2" strokeDasharray="5 5" />
          <circle cx={step.x} cy={step.y} r="8" fill={C.bg} stroke={step.color} strokeWidth="4" />
          <text x={step.x} y={step.textY} textAnchor="middle" fill={step.color} fontSize="23" fontWeight="700">{index + 1}. {step.label}</text>
          <text x={step.x} y={step.textY + (step.textY < step.y ? -25 : 30)} textAnchor="middle" fill={C.muted} fontSize="17">{step.detail}</text>
        </g>)}
      </svg>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 28, color: C.muted, fontSize: 20 }}>行为描述 ≠ 交易策略    底部只能事后确认，急跌中接刀风险更高</div>
    </Panel>
  </div>;
};

const PositionVisual: React.FC<{ p: number }> = ({ p }) => <div style={{ position: "absolute", right: 120, top: 215, width: 830, height: 480, opacity: p }}><Panel accent={C.purple} style={{ position: "absolute", left: 0, top: 0, width: 390, height: 410, padding: 30 }}><div style={{ color: C.purple, fontFamily: "Menlo, monospace", fontSize: 24 }}>POSITION</div><div style={{ color: C.text, fontSize: 26, marginTop: 38 }}>资金暴露</div><div style={{ height: 32, marginTop: 26, background: "rgba(246,248,251,0.12)" }}><div style={{ width: `${25 + p * 58}%`, height: "100%", background: C.purple }} /></div><div style={{ color: C.muted, fontSize: 21, marginTop: 18 }}>0% ← 仓位 → 100%</div><div style={{ display: "flex", gap: 18, marginTop: 44 }}><span style={{ color: C.green }}>+ 加仓</span><span style={{ color: C.coral }}>− 减仓</span></div></Panel><Panel accent={C.yellow} style={{ position: "absolute", right: 0, top: 72, width: 380, height: 300, padding: 30 }}><div style={{ color: C.yellow, fontFamily: "Menlo, monospace", fontSize: 24 }}>EXIT RULES</div><div style={{ color: C.text, fontSize: 28, lineHeight: 1.55, marginTop: 35 }}>止盈：达到条件退出<br />止损：超出承受退出</div><div style={{ color: C.muted, fontSize: 20, marginTop: 26 }}>预先定义 ≠ 保证结果</div></Panel></div>;

const ChartVisual: React.FC<{ p: number }> = ({ p }) => <div style={{ position: "absolute", right: 105, top: 205, width: 870, height: 500, opacity: p }}><Panel accent={C.cyan} style={{ position: "absolute", inset: 0, padding: 30 }}><div style={{ color: C.cyan, fontFamily: "Menlo, monospace", fontSize: 23 }}>PRICE + VOLUME / verbs</div><div style={{ position: "absolute", left: 34, top: 92, width: 790, height: 210, borderBottom: "1px solid rgba(246,248,251,0.2)" }}><svg width="790" height="210" viewBox="0 0 790 210" style={{ overflow: "visible" }}><polyline points="40,178 420,70 540,83 720,79" fill="none" stroke={C.cyan} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} /><circle cx="420" cy="70" r="5" fill={C.yellow} opacity={p} /><circle cx="540" cy="83" r="5" fill={C.cyan} opacity={p} /><text x="392" y="48" fill={C.yellow} fontSize="21">突破</text><text x="608" y="112" fill={C.cyan} fontSize="21">回踩</text></svg></div><div style={{ display: "flex", gap: 34, position: "absolute", left: 36, bottom: 34, color: C.text, fontSize: 24 }}><span style={{ color: C.green }}>放量 ↑</span><span style={{ color: C.muted }}>缩量 ↓</span><span style={{ color: C.yellow }}>突破</span><span style={{ color: C.cyan }}>回踩</span></div></Panel></div>;

const RiskVisual: React.FC<{ p: number }> = ({ p }) => <div style={{ position: "absolute", right: 125, top: 210, width: 840, height: 500, opacity: p }}><div style={{ position: "absolute", left: 0, top: 110, width: 840, height: 120, display: "flex", alignItems: "center", justifyContent: "space-between" }}>{[["听到词", C.cyan], ["确认定义", C.green], ["核对数据", C.yellow], ["再做判断", C.coral]].map(([label, color], i) => <div key={String(label)} style={{ display: "flex", alignItems: "center" }}><Panel accent={String(color)} style={{ width: 160, height: 96, display: "flex", alignItems: "center", justifyContent: "center", color: String(color), fontSize: 24, fontWeight: 800, opacity: ease(p, i * 0.12, 0.42 + i * 0.12) }}>{label}</Panel>{i < 3 && <div style={{ width: 42, height: 3, background: C.muted }} />}</div>)}</div><Panel accent={C.coral} style={{ position: "absolute", left: 105, top: 290, width: 630, height: 105, padding: "22px 30px", color: C.text, fontSize: 25, textAlign: "center" }}>术语 ≠ 信号 ≠ 结论</Panel></div>;

const CloseVisual: React.FC<{ p: number }> = ({ p }) => <div style={{ position: "absolute", right: 110, top: 205, width: 850, height: 520, opacity: p }}><div style={{ display: "flex", flexDirection: "column", gap: 18 }}>{["谁在做什么？", "价格还是数量？", "事实，还是情绪？"].map((text, i) => <Panel key={text} accent={[C.cyan, C.yellow, C.green][i]} style={{ height: 96, padding: "22px 32px", display: "flex", alignItems: "center", color: C.text, fontSize: 30, fontWeight: 800, transform: `translateX(${(1 - p) * 30}px)` }}><span style={{ color: [C.cyan, C.yellow, C.green][i], fontFamily: "Menlo, monospace", marginRight: 30 }}>0{i + 1}</span>{text}</Panel>)}</div><div style={{ color: C.muted, fontSize: 22, lineHeight: 1.55, marginTop: 32, textAlign: "center" }}>把黑话还原成可检查的动作，<br />才是真正听懂。</div></div>;

const Visual: React.FC<{ scene: Scene; p: number }> = ({ scene, p }) => {
  if (scene.kind === "hook") return <HookVisual p={p} />;
  if (scene.kind === "map") return <MapVisual p={p} />;
  if (scene.kind === "direction") return <DirectionVisual p={p} />;
  if (scene.kind === "market") return <MarketVisual p={p} />;
  if (scene.kind === "quote") return <QuoteVisual p={p} />;
  if (scene.kind === "orders") return <OrdersVisual p={p} />;
  if (scene.kind === "behavior") return <BehaviorVisual p={p} />;
  if (scene.kind === "position") return <PositionVisual p={p} />;
  if (scene.kind === "chart") return <ChartVisual p={p} />;
  if (scene.kind === "risk") return <RiskVisual p={p} />;
  return <CloseVisual p={p} />;
};

export const stockJargonDurationInFrames = DURATION;

export const StockJargonVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = currentScene(frame);
  const presence = 1;
  const visualProgress = ease(frame, scene.from + 12, scene.from + 42);
  return <AbsoluteFill style={{ fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif", overflow: "hidden" }}><Background /><Header scene={scene} opacity={presence} /><div style={{ opacity: presence }}><Visual scene={scene} p={visualProgress} /></div><CaptionBar /><div style={{ position: "absolute", right: 88, bottom: 42, color: C.muted, fontFamily: "Menlo, monospace", fontSize: 18 }}>STOCK JARGON / {String(Math.floor(frame / FPS)).padStart(3, "0")}s</div><Rail /></AbsoluteFill>;
};
