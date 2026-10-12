import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Series,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "Arial, PingFang SC, Microsoft YaHei, sans-serif";
const BG = "#0b1118";
const PAPER = "#f2eadb";
const MUTED = "#9aa7ad";
const CYAN = "#55d9d0";
const CORAL = "#ff766b";
const YELLOW = "#f4cc67";
const PURPLE = "#b49aff";

const sceneDurations = {
  hook: 240,
  sameTrace: 480,
  volume: 450,
  intent: 510,
  priceLimit: 420,
  costBasis: 450,
  decoder: 540,
} as const;

export const stockSlangDurationInFrames = Object.values(sceneDurations).reduce(
  (sum, duration) => sum + duration,
  0,
);

const stockSlangScenes = {
  hook: "有人说：“这是洗盘，主力马上拉升。”先别急，把一句股市黑话拆成可观察的动作。",
  sameTrace: "同一条价格线，可以被套上三种故事：追高是上涨后才买，接飞刀是下跌中接住，抄底是把低价当成了转折线。它们描述买入位置，不是未来一定怎么走。",
  volume: "放量只说明这段时间成交更活跃。每一笔成交同时有买方和卖方，所以它不能单独证明资金净流入；还要继续看价格、时间和其他证据。",
  intent: "“洗盘”和“出货”说的是意图。你能看到价格和成交变化，却不能只凭一段走势确认谁在做什么。把事实、解释和结论分开，猜测就不会伪装成证据。",
  priceLimit: "涨停、跌停首先是交易规则设置的当日价格边界，说明交易受限，不等于后面一定继续同方向；具体边界会因市场、品种和规则而异。",
  costBasis: "套牢是价格低于你的持仓成本，解套只是回到成本附近。它是个人账户的状态，不是市场给出的信号；同一只股票，不同人的解套线也不同。",
  decoder: "听到黑话时先问四句：发生了什么，机制是什么，哪部分只是推断，还缺什么证据。这样你听懂的是信息，而不是情绪。",
} as const;

export const stockSlangNarration = Object.values(stockSlangScenes).join("\n");

const titleStyle: CSSProperties = {
  fontFamily: FONT,
  color: PAPER,
  fontWeight: 800,
  letterSpacing: "-0.055em",
};

const bodyStyle: CSSProperties = {
  fontFamily: FONT,
  color: PAPER,
  fontWeight: 500,
  letterSpacing: "-0.02em",
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const intro = (frame: number, start = 0, duration = 18) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const exit = (frame: number, duration: number, startOffset = 0) =>
  interpolate(frame, [duration - 20 - startOffset, duration - startOffset], [1, 0], {
    easing: Easing.bezier(0.7, 0, 0.84, 0),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const draw = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Grid = () => (
  <AbsoluteFill
    style={{
      backgroundColor: BG,
      backgroundImage:
        "linear-gradient(rgba(108, 140, 145, 0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(108, 140, 145, 0.075) 1px, transparent 1px)",
      backgroundSize: "64px 64px",
    }}
  >
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(39, 89, 96, 0.25), transparent 52%), linear-gradient(180deg, rgba(5, 9, 14, 0.1), rgba(5, 9, 14, 0.64))",
      }}
    />
  </AbsoluteFill>
);

const CornerMarks = () => (
  <>
    <div style={{position: "absolute", top: 36, left: 58, width: 32, height: 2, backgroundColor: CYAN}} />
    <div style={{position: "absolute", top: 36, left: 58, width: 2, height: 32, backgroundColor: CYAN}} />
    <div style={{position: "absolute", right: 58, bottom: 38, width: 32, height: 2, backgroundColor: CORAL}} />
    <div style={{position: "absolute", right: 58, bottom: 38, width: 2, height: 32, backgroundColor: CORAL}} />
  </>
);

const TopBar = ({chapter}: {readonly chapter: string}) => (
  <div
    style={{
      position: "absolute",
      left: 92,
      right: 92,
      top: 54,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      color: MUTED,
      fontFamily: FONT,
      fontSize: 22,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
    }}
  >
    <span style={{color: PAPER}}>MARKET DECODER / 股市黑话解码器</span>
    <span style={{display: "flex", alignItems: "center", gap: 18}}>
      <span style={{color: CYAN}}>CH. {chapter}</span>
      <span style={{width: 5, height: 5, borderRadius: 5, backgroundColor: CORAL}} />
      <span>仅作科普</span>
    </span>
  </div>
);

const CaptionBand = ({
  label,
  children,
  accent = CYAN,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly accent?: string;
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        left: 92,
        right: 92,
        bottom: 62,
        display: "flex",
        alignItems: "flex-start",
        gap: 26,
        opacity: interpolate(frame, [0, 12, durationInFrames - 20, durationInFrames], [0.78, 1, 1, 0], {
          easing: ease,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div style={{width: 9, minHeight: 56, borderRadius: 8, backgroundColor: accent}} />
      <div style={{maxWidth: 1510}}>
        <div
          style={{
            ...bodyStyle,
            marginBottom: 8,
            color: accent,
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "0.11em",
          }}
        >
          {label}
        </div>
        <div style={{...bodyStyle, fontSize: 41, lineHeight: 1.25}}>{children}</div>
      </div>
    </div>
  );
};

const SceneTitle = ({
  eyebrow,
  title,
  detail,
  accent = CYAN,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail?: string;
  readonly accent?: string;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 92,
        top: 154,
        opacity: interpolate(frame, [0, 18], [0.78, 1], {
          easing: ease,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `${interpolate(frame, [0, 18], [10, 0], {easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px 0px`,
      }}
    >
      <div style={{...bodyStyle, color: accent, fontSize: 24, letterSpacing: "0.16em", marginBottom: 18}}>{eyebrow}</div>
      <div style={{...titleStyle, fontSize: 82, lineHeight: 1.02}}>{title}</div>
      {detail ? <div style={{...bodyStyle, marginTop: 18, color: MUTED, fontSize: 30}}>{detail}</div> : null}
    </div>
  );
};

const Chip = ({
  children,
  x,
  y,
  color,
  rotate = 0,
  delay = 0,
}: {
  readonly children: ReactNode;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly rotate?: number;
  readonly delay?: number;
}) => {
  const frame = useCurrentFrame();
  const p = intro(frame, delay, 20);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: "14px 20px 16px",
        border: `2px solid ${color}`,
        color,
        backgroundColor: "rgba(11, 17, 24, 0.92)",
        fontFamily: FONT,
        fontSize: 30,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        rotate: `${rotate + interpolate(p, [0, 1], [-4, 0])}deg`,
        translate: `0px ${interpolate(p, [0, 1], [28, 0])}px`,
        opacity: p,
        boxShadow: `8px 8px 0 rgba(11, 17, 24, 0.8)`,
      }}
    >
      {children}
    </div>
  );
};

const HookScene = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const lineProgress = draw(frame, 24, 64);
  const titleOpacity = intro(frame, 92, 22);
  return (
    <AbsoluteFill>
      <TopBar chapter="00 / HOOK" />
      <CornerMarks />
      <Chip x={180} y={286} color={YELLOW} rotate={-4} delay={18}>主力在洗盘</Chip>
      <Chip x={1450} y={300} color={CORAL} rotate={5} delay={34}>明天起飞</Chip>
      <Chip x={300} y={660} color={PURPLE} rotate={3} delay={48}>放量突破</Chip>
      <Chip x={1330} y={680} color={CYAN} rotate={-5} delay={62}>抄底机会</Chip>
      <svg width="1920" height="1080" style={{position: "absolute", inset: 0}} viewBox="0 0 1920 1080">
        <path d="M170 590 C340 590 360 540 490 540 S680 650 800 552 S1010 400 1140 465 S1300 710 1450 560 S1650 462 1770 492" fill="none" stroke={CYAN} strokeWidth="6" opacity={0.95} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - lineProgress} />
        <circle cx="1140" cy="465" r="11" fill={CORAL} opacity={lineProgress} />
        <circle cx="1450" cy="560" r="11" fill={YELLOW} opacity={lineProgress} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 430,
          textAlign: "center",
          opacity: titleOpacity,
          scale: interpolate(titleOpacity, [0, 1], [0.86, 1], {output: "perceptual-scale"}),
        }}
      >
        <div style={{...titleStyle, fontSize: 122}}>黑话 <span style={{color: CORAL}}>≠</span> 证据</div>
        <div style={{...bodyStyle, marginTop: 24, color: MUTED, fontSize: 34}}>先把一句话拆回：发生了什么？</div>
      </div>
      <CaptionBand label="先问一层" accent={YELLOW}>{stockSlangScenes.hook}</CaptionBand>
      <div style={{position: "absolute", left: 92, bottom: 30, color: MUTED, fontFamily: FONT, fontSize: 18, opacity: exit(frame, durationInFrames)}}>A VISUAL EXPLAINER ABOUT MARKET LANGUAGE</div>
    </AbsoluteFill>
  );
};

const tracePoints = [
  [150, 650],
  [320, 600],
  [490, 540],
  [650, 320],
  [820, 410],
  [1010, 270],
  [1180, 460],
  [1340, 545],
  [1500, 705],
  [1740, 570],
] as const;

const Trace = ({progress, color = CYAN}: {readonly progress: number; readonly color?: string}) => {
  const path = tracePoints.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <svg width="1920" height="1080" style={{position: "absolute", inset: 0}} viewBox="0 0 1920 1080">
      <path d={path} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} />
      {tracePoints.map(([x, y], index) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 3 || index === 8 ? 12 : 6} fill={index === 3 ? CORAL : index === 8 ? YELLOW : color} opacity={progress} />
      ))}
    </svg>
  );
};

const TraceTag = ({
  text,
  x,
  y,
  color,
  delay,
  align = "left",
}: {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly delay: number;
  readonly align?: "left" | "right";
}) => {
  const frame = useCurrentFrame();
  const p = intro(frame, delay, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "right" ? "flex-end" : "flex-start",
        gap: 8,
        opacity: p,
        translate: `${interpolate(p, [0, 1], [align === "right" ? 20 : -20, 0])}px ${interpolate(p, [0, 1], [16, 0])}px`,
      }}
    >
      <div style={{...bodyStyle, color, fontSize: 38, fontWeight: 800}}>{text}</div>
      <div style={{width: 120, height: 3, backgroundColor: color, opacity: 0.8}} />
    </div>
  );
};

const SameTraceScene = () => {
  const frame = useCurrentFrame();
  const traceProgress = draw(frame, 30, 90);
  return (
    <AbsoluteFill>
      <TopBar chapter="01 / POSITION" />
      <CornerMarks />
      <SceneTitle eyebrow="同一条线 / SAME TRACE" title="先看位置，再看故事" detail="黑话经常描述“你站在哪里”，不是替你预测终点。" />
      <Trace progress={traceProgress} />
      <TraceTag text="追高" x={690} y={400} color={CORAL} delay={126} />
      <TraceTag text="接飞刀" x={1080} y={610} color={PURPLE} delay={156} align="right" />
      <TraceTag text="抄底" x={1450} y={760} color={YELLOW} delay={186} align="right" />
      <div style={{position: "absolute", right: 104, top: 876, color: MUTED, fontFamily: FONT, fontSize: 22, letterSpacing: "0.1em", textAlign: "right", opacity: intro(frame, 220, 18)}}>位置描述 / 不是预测</div>
      <CaptionBand label="把名词还原成动作" accent={CORAL}>{stockSlangScenes.sameTrace}</CaptionBand>
    </AbsoluteFill>
  );
};

const TradeParticle = ({
  side,
  delay,
  color,
}: {
  readonly side: "left" | "right";
  readonly delay: number;
  readonly color: string;
}) => {
  const frame = useCurrentFrame();
  const p = draw(frame, delay, 36);
  const x = side === "left" ? interpolate(p, [0, 1], [280, 830]) : interpolate(p, [0, 1], [1640, 1090]);
  const y = side === "left" ? interpolate(p, [0, 1], [394, 500]) : interpolate(p, [0, 1], [394, 500]);
  return <circle cx={x} cy={y} r={10} fill={color} opacity={interpolate(p, [0, 0.8, 1], [0, 1, 0.2])} />;
};

const VolumeScene = () => {
  const frame = useCurrentFrame();
  const barProgress = draw(frame, 86, 54);
  const exchangeProgress = intro(frame, 24, 20);
  return (
    <AbsoluteFill>
      <TopBar chapter="02 / VOLUME" />
      <CornerMarks />
      <SceneTitle eyebrow="放量 / VOLUME" title="成交得更多，不等于钱只往一边流" detail="量是发生了多少交易，不是自动生成的结论。" accent={YELLOW} />
      <div style={{position: "absolute", left: 168, top: 420, width: 360, height: 160, border: `2px solid ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center", color: CYAN, fontFamily: FONT, fontSize: 38, fontWeight: 800, opacity: exchangeProgress}}>买方</div>
      <div style={{position: "absolute", right: 168, top: 420, width: 360, height: 160, border: `2px solid ${CORAL}`, display: "flex", alignItems: "center", justifyContent: "center", color: CORAL, fontFamily: FONT, fontSize: 38, fontWeight: 800, opacity: exchangeProgress}}>卖方</div>
      <svg width="1920" height="1080" style={{position: "absolute", inset: 0}} viewBox="0 0 1920 1080">
        <line x1="560" y1="500" x2="1360" y2="500" stroke={MUTED} strokeWidth="2" strokeDasharray="8 14" opacity={exchangeProgress} />
        {Array.from({length: 7}).map((_, index) => <TradeParticle key={index} side={index % 2 === 0 ? "left" : "right"} delay={50 + index * 18} color={index % 2 === 0 ? CYAN : CORAL} />)}
        <rect x="820" y="405" width="280" height="190" rx="8" fill="rgba(242, 234, 219, 0.06)" stroke={PAPER} strokeWidth="2" opacity={exchangeProgress} />
        <text x="960" y="490" fill={PAPER} fontFamily={FONT} fontSize="34" fontWeight="800" textAnchor="middle" opacity={exchangeProgress}>交易所</text>
        <text x="960" y="540" fill={MUTED} fontFamily={FONT} fontSize="22" textAnchor="middle" opacity={exchangeProgress}>一买一卖 = 一笔成交</text>
      </svg>
      <div style={{position: "absolute", left: 720, top: 720, width: 480, height: 140, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 18, opacity: barProgress}}>
        {[34, 54, 76, 108, 138, 176].map((height, index) => <div key={height} style={{width: 42, height: height * barProgress, backgroundColor: index > 3 ? YELLOW : "rgba(244, 204, 103, 0.35)"}} />)}
      </div>
      <div style={{position: "absolute", left: 1230, top: 724, color: YELLOW, fontFamily: FONT, fontSize: 40, fontWeight: 800, opacity: barProgress}}>成交量 ↑</div>
      <div style={{position: "absolute", left: 1230, top: 786, color: MUTED, fontFamily: FONT, fontSize: 28, opacity: barProgress}}>不是“净流入 ↑”</div>
      <CaptionBand label="把统计量和解释分开" accent={YELLOW}>{stockSlangScenes.volume}</CaptionBand>
    </AbsoluteFill>
  );
};

const IntentScene = () => {
  const frame = useCurrentFrame();
  const chartProgress = draw(frame, 28, 78);
  const splitProgress = intro(frame, 124, 20);
  return (
    <AbsoluteFill>
      <TopBar chapter="03 / INTENT" />
      <CornerMarks />
      <SceneTitle eyebrow="洗盘 / 出货" title="最危险的词，是把意图说成事实" detail="走势可以被观察，意图不能只凭一段走势确认。" accent={PURPLE} />
      <div style={{position: "absolute", left: 125, top: 370, width: 860, height: 350, borderTop: `2px solid rgba(242, 234, 219, 0.25)`, borderBottom: `2px solid rgba(242, 234, 219, 0.25)`, opacity: splitProgress}}>
        <div style={{...bodyStyle, position: "absolute", top: -45, left: 0, fontSize: 22, color: CYAN, letterSpacing: "0.12em"}}>能观察到</div>
        <svg width="860" height="350" viewBox="0 0 860 350">
          <path d="M20 250 C140 212 190 80 300 120 S445 290 555 194 S650 160 820 80" fill="none" stroke={CYAN} strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - chartProgress} />
          <line x1="20" y1="292" x2="820" y2="292" stroke={MUTED} strokeWidth="2" strokeDasharray="7 10" opacity={0.5} />
          <text x="20" y="330" fill={MUTED} fontFamily={FONT} fontSize="21">价格波动 / 成交变化 / 时间顺序</text>
        </svg>
      </div>
      <div style={{position: "absolute", right: 154, top: 370, width: 640, height: 350, borderTop: `2px solid rgba(242, 234, 219, 0.25)`, borderBottom: `2px solid rgba(242, 234, 219, 0.25)`, opacity: splitProgress}}>
        <div style={{...bodyStyle, position: "absolute", top: -45, left: 0, fontSize: 22, color: CORAL, letterSpacing: "0.12em"}}>仍然是推断</div>
        <div style={{position: "absolute", left: 0, top: 82, color: PAPER, fontFamily: FONT, fontSize: 45, fontWeight: 800}}>“主力正在洗盘”</div>
        <div style={{position: "absolute", left: 0, top: 162, color: MUTED, fontFamily: FONT, fontSize: 28, lineHeight: 1.55}}>同样一段回撤，<br />也可能被讲成“出货”。</div>
        <div style={{position: "absolute", right: 20, bottom: 28, color: CORAL, fontFamily: FONT, fontSize: 62, fontWeight: 800}}>?</div>
      </div>
      <div style={{position: "absolute", left: 940, top: 760, color: PURPLE, fontFamily: FONT, fontSize: 29, letterSpacing: "0.08em", opacity: intro(frame, 170, 18)}}>事实 → 解释 → 结论</div>
      <CaptionBand label="不要让叙事替代证据" accent={PURPLE}>{stockSlangScenes.intent}</CaptionBand>
    </AbsoluteFill>
  );
};

const PriceLimitScene = () => {
  const frame = useCurrentFrame();
  const railProgress = intro(frame, 20, 22);
  const tokenProgress = draw(frame, 64, 78);
  const tokenY = interpolate(tokenProgress, [0, 0.45, 0.72, 1], [705, 390, 690, 470], {easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return (
    <AbsoluteFill>
      <TopBar chapter="04 / RULE" />
      <CornerMarks />
      <SceneTitle eyebrow="涨停 / 跌停" title="边界是规则，不是预言" detail="价格被限制时，先读规则，再读情绪。" accent={CORAL} />
      <div style={{position: "absolute", left: 270, right: 270, top: 420, height: 320, opacity: railProgress}}>
        <div style={{position: "absolute", left: 0, top: 0, width: 1380, height: 2, backgroundColor: CORAL}} />
        <div style={{position: "absolute", left: 0, bottom: 0, width: 1380, height: 2, backgroundColor: CYAN}} />
        <div style={{...bodyStyle, position: "absolute", left: 0, top: -42, color: CORAL, fontSize: 28, fontWeight: 800}}>当日价格边界 / 上方</div>
        <div style={{...bodyStyle, position: "absolute", left: 0, bottom: -48, color: CYAN, fontSize: 28, fontWeight: 800}}>当日价格边界 / 下方</div>
        <div style={{position: "absolute", left: 0, top: 42, width: 2, height: 236, backgroundColor: "rgba(242, 234, 219, 0.18)"}} />
        <div style={{position: "absolute", right: 0, top: 42, width: 2, height: 236, backgroundColor: "rgba(242, 234, 219, 0.18)"}} />
        <div style={{position: "absolute", left: 650, top: tokenY - 420, width: 78, height: 78, borderRadius: 78, backgroundColor: PAPER, color: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 28, fontWeight: 900, scale: interpolate(tokenProgress, [0, 0.15, 1], [0.72, 1, 1], {output: "perceptual-scale"})}}>价</div>
        <div style={{position: "absolute", left: 720, top: tokenY - 382, width: 270, height: 2, backgroundColor: PAPER, transformOrigin: "left center", scale: `${interpolate(tokenProgress, [0, 0.3, 1], [0, 0.3, 1])} 1`}} />
      </div>
      <div style={{position: "absolute", right: 290, top: 470, color: CORAL, fontFamily: FONT, fontSize: 34, fontWeight: 800, opacity: intro(frame, 150, 18)}}>涨停 ≠ 永远上涨</div>
      <div style={{position: "absolute", right: 290, top: 536, color: CYAN, fontFamily: FONT, fontSize: 34, fontWeight: 800, opacity: intro(frame, 176, 18)}}>跌停 ≠ 永远下跌</div>
      <CaptionBand label="先读规则，再读叙事" accent={CORAL}>{stockSlangScenes.priceLimit}</CaptionBand>
    </AbsoluteFill>
  );
};

const CostBasisScene = () => {
  const frame = useCurrentFrame();
  const chartProgress = draw(frame, 28, 72);
  const crossProgress = draw(frame, 170, 58);
  const priceY = interpolate(crossProgress, [0, 0.48, 1], [632, 504, 415], {easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return (
    <AbsoluteFill>
      <TopBar chapter="05 / COST" />
      <CornerMarks />
      <SceneTitle eyebrow="套牢 / 解套" title="同一只股票，每个人的线都不同" detail="它描述你的成本关系，不是市场信号。" accent={YELLOW} />
      <svg width="1920" height="1080" style={{position: "absolute", inset: 0}} viewBox="0 0 1920 1080">
        <path d="M170 650 C330 620 420 590 540 610 S740 690 860 570 S1070 505 1190 530 S1400 580 1720 390" fill="none" stroke={CYAN} strokeWidth="7" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - chartProgress} />
        <line x1="160" y1="500" x2="1760" y2="500" stroke={YELLOW} strokeWidth="3" strokeDasharray="10 12" opacity={crossProgress} />
        <text x="160" y="470" fill={YELLOW} fontFamily={FONT} fontSize="29" fontWeight="800" opacity={crossProgress}>我的成本线</text>
        <circle cx="1280" cy={priceY} r="16" fill={PAPER} opacity={crossProgress} />
        <line x1="1280" y1={priceY} x2="1280" y2="500" stroke={PAPER} strokeWidth="2" strokeDasharray="5 8" opacity={crossProgress} />
      </svg>
      <div style={{position: "absolute", left: 230, top: 735, color: CORAL, fontFamily: FONT, fontSize: 42, fontWeight: 800, opacity: intro(frame, 106, 18)}}>套牢</div>
      <div style={{position: "absolute", left: 1260, top: 392, color: YELLOW, fontFamily: FONT, fontSize: 42, fontWeight: 800, opacity: crossProgress}}>解套</div>
      <div style={{position: "absolute", left: 1260, top: 450, color: MUTED, fontFamily: FONT, fontSize: 25, opacity: crossProgress}}>回到你的成本附近</div>
      <CaptionBand label="把个人状态还给个人" accent={YELLOW}>{stockSlangScenes.costBasis}</CaptionBand>
    </AbsoluteFill>
  );
};

const Question = ({
  index,
  question,
  answer,
  x,
  y,
  accent,
  delay,
}: {
  readonly index: string;
  readonly question: string;
  readonly answer: string;
  readonly x: number;
  readonly y: number;
  readonly accent: string;
  readonly delay: number;
}) => {
  const frame = useCurrentFrame();
  const p = intro(frame, delay, 20);
  return (
    <div style={{position: "absolute", left: x, top: y, width: 620, minHeight: 128, opacity: p, translate: `0px ${interpolate(p, [0, 1], [26, 0])}px`}}>
      <div style={{display: "flex", alignItems: "center", gap: 18, marginBottom: 10}}>
        <div style={{width: 44, height: 44, borderRadius: 44, backgroundColor: accent, color: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 23, fontWeight: 900}}>{index}</div>
        <div style={{...titleStyle, fontSize: 36}}>{question}</div>
      </div>
      <div style={{...bodyStyle, color: MUTED, fontSize: 25, marginLeft: 62}}>{answer}</div>
    </div>
  );
};

const DecoderScene = () => {
  const frame = useCurrentFrame();
  const coreProgress = draw(frame, 18, 44);
  const labelOpacity = exit(frame, 540, 80);
  return (
    <AbsoluteFill>
      <TopBar chapter="06 / DECODE" />
      <CornerMarks />
      <SceneTitle eyebrow="四问解码器 / TAKEAWAY" title="别急着接受黑话" detail="先把故事拆成：事实、机制、推断、证据。" accent={CYAN} />
      <div style={{position: "absolute", left: 830, top: 312, width: 250, height: 250, border: `2px solid ${CYAN}`, borderRadius: 250, opacity: coreProgress, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: CYAN, fontFamily: FONT, fontSize: 34, fontWeight: 800, lineHeight: 1.2, rotate: `${interpolate(coreProgress, [0, 1], [-18, 0])}deg`}}>黑话<br />解码</div>
      <Question index="01" question="发生了什么？" answer="价格、成交、规则，先说可观察的事。" x={120} y={360} accent={CORAL} delay={72} />
      <Question index="02" question="机制是什么？" answer="谁在什么条件下，做了什么交易？" x={1190} y={360} accent={YELLOW} delay={96} />
      <Question index="03" question="哪部分是推断？" answer="意图、主力、必涨，常常不是直接事实。" x={120} y={680} accent={PURPLE} delay={120} />
      <Question index="04" question="还缺什么证据？" answer="时间、对照、风险，决定结论能走多远。" x={1190} y={680} accent={CYAN} delay={144} />
      <div style={{position: "absolute", left: 770, top: 690, color: MUTED, fontFamily: FONT, fontSize: 25, letterSpacing: "0.08em", opacity: labelOpacity}}>把“听起来像内幕”还原成可检查的问题</div>
      <CaptionBand label="把情绪还给语言，把判断还给证据" accent={CYAN}>{stockSlangScenes.decoder}</CaptionBand>
      <div style={{position: "absolute", left: 92, bottom: 30, color: CYAN, fontFamily: FONT, fontSize: 18, letterSpacing: "0.12em", opacity: labelOpacity}}>SEE THE DATA / NAME THE UNKNOWN</div>
    </AbsoluteFill>
  );
};

export const StockSlangExplainerVideo = () => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT }} from={-289}>
      <Grid />
      <Series>
        <Series.Sequence name="00 Hook" durationInFrames={sceneDurations.hook} premountFor={fps}>
          <HookScene />
        </Series.Sequence>
        <Series.Sequence name="01 Same trace" durationInFrames={sceneDurations.sameTrace} premountFor={fps}>
          <SameTraceScene />
        </Series.Sequence>
        <Series.Sequence name="02 Volume" durationInFrames={sceneDurations.volume} premountFor={fps}>
          <VolumeScene />
        </Series.Sequence>
        <Series.Sequence name="03 Intent" durationInFrames={sceneDurations.intent} premountFor={fps}>
          <IntentScene />
        </Series.Sequence>
        <Series.Sequence name="04 Rule" durationInFrames={sceneDurations.priceLimit} premountFor={fps}>
          <PriceLimitScene />
        </Series.Sequence>
        <Series.Sequence name="05 Cost" durationInFrames={sceneDurations.costBasis} premountFor={fps}>
          <CostBasisScene />
        </Series.Sequence>
        <Series.Sequence name="06 Decoder" durationInFrames={sceneDurations.decoder} premountFor={fps}>
          <DecoderScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
