import { ChartLineUp, StackSimple, TrendDown, TrendUp, WarningCircle } from "@phosphor-icons/react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBar, Panel, ProgressRail, VideoBackground } from "./design/components";
import { clampEase, drawDash, enterY } from "./design/motion";
import {
  ComparisonScene,
  ConceptMapScene,
  KeyPointScene,
  ProcessScene,
  QuoteScene,
  SceneShell,
} from "./design/scenes";
import { COLORS, TYPOGRAPHY, sceneAccents } from "./design/tokens";

const transitionFrames = 18;

const sceneDurations = [300, 360, 390, 450, 540, 450, 540, 480, 450, 420, 450];

export const stockJargonSystemDurationInFrames =
  sceneDurations.reduce((sum, duration) => sum + duration, 0) - transitionFrames * (sceneDurations.length - 1);

type Cue = {
  from: number;
  to: number;
  text: string;
};

const cue = (frame: number, cues: Cue[]) => cues.find((item) => frame >= item.from && frame < item.to)?.text ?? cues[cues.length - 1]?.text;

const CueCaption: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();

  return <CaptionBar text={cue(frame, cues)} />;
};

const hookCues: Cue[] = [
  { from: 0, to: 100, text: "股票群里的黑话，第一反应通常不是理解，而是被噪音淹没。" },
  { from: 100, to: 220, text: "别急着背。先看这些词在制造什么问题。" },
  { from: 220, to: 300, text: "把噪音拆开，才有可能判断它是不是事实。" },
];

const mapCues: Cue[] = [
  { from: 0, to: 120, text: "听懂股市黑话，先别急着背词。" },
  { from: 120, to: 260, text: "先把每个词放进抽屉：方向、行情、报价、下单、行为、图表、仓位、风控。" },
  { from: 260, to: 360, text: "分类之后，再把词还原成可以检查的动作。" },
];

const directionCues: Cue[] = [
  { from: 0, to: 130, text: "多头和空头，先说明你期待价格往哪边走。" },
  { from: 130, to: 270, text: "多头期待上涨；空头期待下跌，通常还涉及借入卖出。" },
  { from: 270, to: 390, text: "方向词不是建议，它只是判断交易动作的起点。" },
];

const marketCues: Cue[] = [
  { from: 0, to: 150, text: "牛市、熊市、震荡，说的是市场环境。" },
  { from: 150, to: 300, text: "它们描述大方向和波动状态，不保证下一次涨跌。" },
  { from: 300, to: 450, text: "环境词要先当背景，不能直接当成买卖按钮。" },
];

const orderBookCues: Cue[] = [
  { from: 0, to: 150, text: "买一，是买方当前最高愿意出的价格。" },
  { from: 150, to: 300, text: "卖一，是卖方当前最低愿意接受的价格。" },
  { from: 300, to: 540, text: "买一和卖一之间的缝隙叫价差，成交就发生在这条缝附近。" },
];

const orderTypeCues: Cue[] = [
  { from: 0, to: 150, text: "市价单优先速度，但成交价格不一定可控。" },
  { from: 150, to: 300, text: "限价单限制价格，但可能等不到成交。" },
  { from: 300, to: 450, text: "止损单先等待触发，再进入执行环节。" },
];

const behaviorCues: Cue[] = [
  { from: 0, to: 150, text: "追涨杀跌，是价格带着人走，不是严谨策略。" },
  { from: 150, to: 330, text: "抄底也不等于低风险，因为真正的底部只能事后确认。" },
  { from: 330, to: 540, text: "接飞刀这个词，就是在提醒快速下跌里的危险。" },
];

const chartCues: Cue[] = [
  { from: 0, to: 170, text: "图表词描述的是价格和成交量发生了什么。" },
  { from: 170, to: 330, text: "放量、缩量看成交量；突破、回踩看价格路径。" },
  { from: 330, to: 480, text: "离开周期和上下文，它们都不能直接变成信号。" },
];

const positionCues: Cue[] = [
  { from: 0, to: 150, text: "仓位，是资金暴露程度。" },
  { from: 150, to: 300, text: "加仓和减仓改变暴露，止盈和止损定义退出条件。" },
  { from: 300, to: 450, text: "这些词讨论的是风险管理，不是盈利保证。" },
];

const riskCues: Cue[] = [
  { from: 0, to: 140, text: "行话是标签，不是买卖信号。" },
  { from: 140, to: 280, text: "先确认定义，再核对数据，最后才谈判断。" },
  { from: 280, to: 420, text: "这是本期最重要的风险边界。" },
];

const slangItems = [
  { text: "满仓梭哈", color: COLORS.coral, x: 980, y: 190, rotate: -5 },
  { text: "别接飞刀", color: COLORS.yellow, x: 1320, y: 248, rotate: 3 },
  { text: "被套了", color: COLORS.purple, x: 1120, y: 355, rotate: -2 },
  { text: "追涨杀跌", color: COLORS.green, x: 1470, y: 420, rotate: 5 },
  { text: "买一卖一", color: COLORS.cyan, x: 1010, y: 520, rotate: 4 },
  { text: "放量突破", color: COLORS.blue, x: 1360, y: 595, rotate: -4 },
  { text: "止损割肉", color: COLORS.coral, x: 1165, y: 690, rotate: 2 },
];

const HookNoiseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = clampEase(frame, 86, 180);
  const settle = clampEase(frame, 150, 250);

  return (
    <>
      <SceneShell
        kicker="00 / NOISE FIRST"
        title="黑话先制造噪音"
        description="“梭哈、套牢、接飞刀”听起来像暗号。强行背词之前，先把噪音变成结构。"
        accent={COLORS.coral}
      >
        <div style={{ position: "absolute", right: 90, top: 145, width: 900, height: 660 }}>
          <Panel accent={COLORS.coral} style={{ position: "absolute", inset: 0, opacity: 0.92 }}>
            {null}
          </Panel>
          <div
            style={{
              position: "absolute",
              left: 34,
              right: 34,
              top: 32,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${COLORS.yellow}, transparent)`,
              transform: `translateY(${scan * 540}px)`,
              boxShadow: `0 0 34px ${COLORS.yellow}`,
            }}
          />
          {slangItems.map((item, index) => {
            const local = clampEase(frame, 18 + index * 10, 48 + index * 10);
            const dx = (1 - settle) * (index % 2 === 0 ? 42 : -36);
            const dy = (1 - local) * 34;
            return (
              <Panel
                key={item.text}
                accent={item.color}
                style={{
                  position: "absolute",
                  left: item.x - 935 + dx,
                  top: item.y - 130 + dy,
                  minWidth: 170,
                  height: 66,
                  padding: "0 22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: item.color,
                  fontSize: 25,
                  fontWeight: 850,
                  opacity: local,
                  transform: `rotate(${item.rotate * (1 - settle * 0.7)}deg)`,
                }}
              >
                {item.text}
              </Panel>
            );
          })}
          <Panel
            accent={COLORS.green}
            style={{
              position: "absolute",
              left: 275,
              top: 262,
              width: 350,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.text,
              fontSize: 31,
              fontWeight: 900,
              opacity: clampEase(frame, 204, 260),
            }}
          >
            噪音 → 分类 → 动作
          </Panel>
        </div>
      </SceneShell>
      <CaptionBar text={cue(frame, hookCues)} />
    </>
  );
};

const MarketMoodScene: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = clampEase(frame, 54, 132);
  const cards = [
    { label: "牛市", note: "整体偏上", color: COLORS.green },
    { label: "熊市", note: "整体偏下", color: COLORS.coral },
    { label: "震荡", note: "区间来回", color: COLORS.yellow },
  ];

  return (
    <>
      <SceneShell
        kicker="03 / MARKET MOOD"
        title="牛、熊、震荡：先当背景"
        description="行情词描述市场环境，不是对下一根 K 线的承诺。"
        accent={COLORS.cyan}
      >
        <Panel accent={COLORS.cyan} style={{ position: "absolute", right: 116, top: 214, width: 840, height: 365, padding: 28 }}>
          <svg width="780" height="215" viewBox="0 0 780 215" style={{ overflow: "visible" }}>
            <line x1="32" y1="178" x2="748" y2="178" stroke={COLORS.faint} strokeWidth="2" />
            <line x1="32" y1="30" x2="32" y2="178" stroke={COLORS.faint} strokeWidth="2" />
            <path
              d="M 40 160 C 110 115 170 70 250 82 S 390 160 485 114 S 620 62 742 48"
              fill="none"
              stroke={COLORS.cyan}
              strokeLinecap="round"
              strokeWidth="6"
              {...drawDash(draw)}
            />
            <text x="54" y="202" fill={COLORS.muted} fontSize="18">
              环境会变化，但词本身不是预测
            </text>
          </svg>
        </Panel>
        <div style={{ position: "absolute", right: 116, top: 615, width: 840, display: "flex", gap: 18 }}>
          {cards.map((card, index) => {
            const p = clampEase(frame, 86 + index * 14, 116 + index * 14);
            return (
              <Panel
                key={card.label}
                accent={card.color}
                style={{ flex: 1, height: 118, padding: "22px 26px", opacity: p, transform: `translateY(${enterY(p, 18)}px)` }}
              >
                <div style={{ color: card.color, fontSize: 30, fontWeight: 850 }}>{card.label}</div>
                <div style={{ color: COLORS.muted, fontSize: 22, marginTop: 12 }}>{card.note}</div>
              </Panel>
            );
          })}
        </div>
      </SceneShell>
      <CaptionBar text={cue(frame, marketCues)} />
    </>
  );
};

const OrderBookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const buyRows = ["买三  98.70", "买二  98.80", "买一  98.90"];
  const sellRows = ["卖一  99.10", "卖二  99.20", "卖三  99.30"];
  const spread = clampEase(frame, 118, 158);
  const trade = clampEase(frame, 186, 250);

  return (
    <>
      <SceneShell
        kicker="04 / QUOTE BOOK"
        title="买一卖一：成交缝隙"
        description="报价词不是情绪词。它们描述的是买卖双方此刻愿意接受的价格。"
        accent={COLORS.yellow}
      >
        <div style={{ position: "absolute", right: 112, top: 205, width: 860, height: 510 }}>
          <Panel accent={COLORS.green} style={{ position: "absolute", left: 0, top: 28, width: 360, height: 405, padding: 28 }}>
            <div style={{ color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 24, marginBottom: 28 }}>BUY SIDE</div>
            {buyRows.map((row, index) => {
              const p = clampEase(frame, 34 + index * 14, 68 + index * 14);
              return (
                <div
                  key={row}
                  style={{
                    height: 58,
                    marginBottom: 22,
                    padding: "13px 16px",
                    color: COLORS.text,
                    fontFamily: TYPOGRAPHY.monoFamily,
                    fontSize: 25,
                    background: `rgba(109,241,177,${0.08 + index * 0.04})`,
                    opacity: p,
                    transform: `translateX(${enterY(p, 18)}px)`,
                  }}
                >
                  {row}
                </div>
              );
            })}
          </Panel>
          <Panel accent={COLORS.coral} style={{ position: "absolute", right: 0, top: 28, width: 360, height: 405, padding: 28 }}>
            <div style={{ color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 24, marginBottom: 28 }}>SELL SIDE</div>
            {sellRows.map((row, index) => {
              const p = clampEase(frame, 42 + index * 14, 76 + index * 14);
              return (
                <div
                  key={row}
                  style={{
                    height: 58,
                    marginBottom: 22,
                    padding: "13px 16px",
                    color: COLORS.text,
                    fontFamily: TYPOGRAPHY.monoFamily,
                    fontSize: 25,
                    background: `rgba(255,128,109,${0.08 + index * 0.04})`,
                    opacity: p,
                    transform: `translateX(${-enterY(p, 18)}px)`,
                  }}
                >
                  {row}
                </div>
              );
            })}
          </Panel>
          <div style={{ position: "absolute", left: 371, top: 196, width: 116, height: 4, background: COLORS.yellow, transform: `scaleX(${spread})`, transformOrigin: "left center" }} />
          <div
            style={{
              position: "absolute",
              left: 312,
              top: 181,
              width: 238,
              height: 34,
              opacity: trade,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 15, width: 238, height: 3, background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.yellow}, ${COLORS.coral})`, transform: `scaleX(${trade})`, transformOrigin: "left center" }} />
            <div style={{ position: "absolute", left: 10 + trade * 190, top: 4, width: 24, height: 24, borderRadius: 999, background: COLORS.yellow, boxShadow: `0 0 26px ${COLORS.yellow}` }} />
            <div style={{ position: "absolute", left: 76, top: -32, color: COLORS.yellow, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 19, fontWeight: 800 }}>TRADE CROSSES</div>
          </div>
          <Panel
            accent={COLORS.yellow}
            style={{
              position: "absolute",
              left: 350,
              top: 226,
              width: 160,
              height: 104,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              opacity: spread,
            }}
          >
            <div style={{ color: COLORS.yellow, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 22 }}>SPREAD</div>
            <div style={{ color: COLORS.text, fontSize: 30, fontWeight: 850 }}>0.20</div>
          </Panel>
        </div>
      </SceneShell>
      <CaptionBar text={cue(frame, orderBookCues)} />
    </>
  );
};

const OrderTypeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    { name: "市价单", value: "优先速度", risk: "价格可能滑动", color: COLORS.coral },
    { name: "限价单", value: "限定价格", risk: "可能不成交", color: COLORS.cyan },
    { name: "止损单", value: "等待触发", risk: "触发后再执行", color: COLORS.yellow },
  ];
  return (
    <>
      <ProcessScene
        kicker="05 / ORDER TYPES"
        title="下单术语，是速度和价格的取舍"
        description="同样是“买卖”，不同订单类型关心的是不同约束。"
        steps={["市价：先成交", "限价：先价格", "止损：先触发"]}
        accent={COLORS.blue}
      />
      <div style={{ position: "absolute", right: 128, top: 575, width: 805 }}>
        {rows.map((row, index) => {
          const p = clampEase(frame, 84 + index * 14, 116 + index * 14);
          return (
            <Panel
              key={row.name}
              accent={row.color}
              style={{
                height: 58,
                marginBottom: 12,
                padding: "0 22px",
                display: "flex",
                alignItems: "center",
                opacity: p,
                transform: `translateY(${enterY(p, 14)}px)`,
              }}
            >
              <span style={{ color: row.color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 19, width: 116 }}>{row.name}</span>
              <span style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, width: 160 }}>{row.value}</span>
              <span style={{ color: COLORS.muted, fontSize: 20 }}>{row.risk}</span>
            </Panel>
          );
        })}
      </div>
      <CaptionBar text={cue(frame, orderTypeCues)} />
    </>
  );
};

const BehaviorPathScene: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = clampEase(frame, 48, 142);
  const events = [
    { label: "追涨", detail: "涨了才追入", color: COLORS.green, x: 178, y: 62, textY: 32 },
    { label: "杀跌", detail: "跌了才砍仓", color: COLORS.coral, x: 298, y: 118, textY: 168 },
    { label: "抄底", detail: "试图买低位", color: COLORS.cyan, x: 540, y: 246, textY: 302 },
    { label: "接飞刀", detail: "急跌中接手", color: COLORS.yellow, x: 428, y: 184, textY: 238 },
  ];

  return (
    <>
      <SceneShell
        kicker="06 / BEHAVIOR"
        title="追涨杀跌，不是策略"
        description="行为词说的是人在价格波动里的动作。理解它们，要先把情绪还原成动作。"
        accent={COLORS.purple}
      >
        <Panel accent={COLORS.purple} style={{ position: "absolute", right: 108, top: 194, width: 870, height: 540, padding: 28 }}>
          <div style={{ color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>PRICE PATH / behavior labels</div>
          <svg width="810" height="390" viewBox="0 0 810 390" style={{ position: "absolute", left: 30, top: 100, overflow: "visible" }}>
            <line x1="58" y1="324" x2="750" y2="324" stroke={COLORS.faint} strokeWidth="2" />
            <line x1="58" y1="34" x2="58" y2="324" stroke={COLORS.faint} strokeWidth="2" />
            <text x="58" y="352" fill={COLORS.muted} fontSize="18">
              时间
            </text>
            <text x="8" y="46" fill={COLORS.muted} fontSize="18">
              价格
            </text>
            <polyline points="58,82 178,62 298,118 428,184 540,246 650,224 738,238" fill="none" stroke={COLORS.coral} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" {...drawDash(draw)} />
            {events.map((event, index) => {
              const p = clampEase(frame, 92 + index * 16, 124 + index * 16);
              return (
                <g key={event.label} opacity={p}>
                  <line x1={event.x} y1={event.y} x2={event.x} y2={event.textY < event.y ? event.textY + 10 : event.textY - 10} stroke={event.color} strokeWidth="2" strokeDasharray="5 5" />
                  <circle cx={event.x} cy={event.y} r="8" fill={COLORS.bg} stroke={event.color} strokeWidth="4" />
                  <text x={event.x} y={event.textY} textAnchor="middle" fill={event.color} fontSize="23" fontWeight="700">
                    {event.label}
                  </text>
                  <text x={event.x} y={event.textY + (event.textY < event.y ? -25 : 30)} textAnchor="middle" fill={COLORS.muted} fontSize="17">
                    {event.detail}
                  </text>
                </g>
              );
            })}
          </svg>
        </Panel>
      </SceneShell>
      <CaptionBar text={cue(frame, behaviorCues)} />
    </>
  );
};

const ChartVerbScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = clampEase(frame, 14, 48);
  const draw = clampEase(frame, 44, 118);
  const markers = ["放量", "突破", "回踩", "缩量"];

  return (
    <>
      <KeyPointScene
        kicker="07 / CHART VERBS"
        title="图表上的动词，不等于买卖信号"
        description="它们描述价格和成交量发生了什么，但仍然需要周期、标的和上下文。"
        points={["成交量：放量 / 缩量", "价格路径：突破 / 回踩", "结论：描述先于判断"]}
        icon={ChartLineUp}
        accent={COLORS.cyan}
      />
      <Panel accent={COLORS.cyan} style={{ position: "absolute", right: 118, top: 575, width: 820, height: 190, opacity: p, padding: 20 }}>
        <svg width="780" height="130" viewBox="0 0 780 130" style={{ overflow: "visible" }}>
          <path
            d="M 20 105 C 150 92 180 30 320 48 S 455 108 590 62 S 700 40 755 36"
            fill="none"
            stroke={COLORS.cyan}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...drawDash(draw)}
          />
          {markers.map((marker, index) => {
            const x = [92, 318, 512, 684][index];
            const y = [84, 48, 80, 44][index];
            const local = clampEase(frame, 80 + index * 12, 108 + index * 12);
            return (
              <g key={marker} opacity={local}>
                <circle cx={x} cy={y} r="7" fill={COLORS.bg} stroke={COLORS.yellow} strokeWidth="4" />
                <text x={x} y={y - 20} fill={COLORS.yellow} fontSize="20" textAnchor="middle" fontWeight="700">
                  {marker}
                </text>
              </g>
            );
          })}
        </svg>
      </Panel>
      <CaptionBar text={cue(frame, chartCues)} />
    </>
  );
};

const PositionExposureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fill = clampEase(frame, 68, 126);
  const danger = clampEase(frame, 132, 172);
  const chips = [
    { label: "+ 加仓", color: COLORS.green },
    { label: "- 减仓", color: COLORS.coral },
    { label: "止盈", color: COLORS.yellow },
    { label: "止损", color: COLORS.cyan },
  ];

  return (
    <>
      <SceneShell
        kicker="08 / POSITION"
        title="仓位，先问暴露有多大"
        description="仓位语言讨论的是风险暴露。加仓、减仓、止盈、止损，都是围绕暴露和退出条件。"
        accent={COLORS.blue}
      >
        <Panel accent={COLORS.blue} style={{ position: "absolute", right: 118, top: 220, width: 820, height: 365, padding: 34 }}>
          <div style={{ color: COLORS.blue, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 24 }}>POSITION EXPOSURE</div>
          <div style={{ position: "relative", height: 44, marginTop: 50, background: COLORS.faint, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ width: `${28 + fill * 52}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.blue}, ${COLORS.purple})` }} />
            <div style={{ position: "absolute", left: "70%", top: 0, width: 3, height: "100%", background: COLORS.coral, opacity: danger, boxShadow: `0 0 24px ${COLORS.coral}` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20, marginTop: 14 }}>
            <span>0%</span>
            <span>资金暴露</span>
            <span>100%</span>
          </div>
          <div style={{ color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20, fontWeight: 800, marginTop: 28, opacity: danger }}>
            RISK THRESHOLD / 暴露越高，单次波动影响越大
          </div>
        </Panel>
        <div style={{ position: "absolute", right: 118, top: 625, width: 820, display: "flex", gap: 16 }}>
          {chips.map((chip, index) => {
            const p = clampEase(frame, 112 + index * 10, 140 + index * 10);
            return (
              <Panel
                key={chip.label}
                accent={chip.color}
                style={{
                  flex: 1,
                  height: 76,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: chip.color,
                  fontSize: 24,
                  fontWeight: 850,
                  opacity: p,
                }}
              >
                {chip.label}
              </Panel>
            );
          })}
        </div>
      </SceneShell>
      <CaptionBar text={cue(frame, positionCues)} />
    </>
  );
};

const RiskFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ["听到词", "确认定义", "核对数据", "再做判断"];
  return (
    <>
      <QuoteScene
        kicker="09 / BOUNDARY"
        title="行话是标签，不是信号"
        description="它可以帮助沟通，但不能替代数据、上下文和风险控制。"
        quote="术语只负责命名现象，不负责替你做决定。"
        source="本期风险边界"
        accent={COLORS.coral}
      />
      <div style={{ position: "absolute", right: 120, top: 575, width: 820, display: "flex", gap: 14 }}>
        {steps.map((step, index) => {
          const p = clampEase(frame, 88 + index * 10, 116 + index * 10);
          return (
            <Panel
              key={step}
              accent={index === steps.length - 1 ? COLORS.green : COLORS.yellow}
              style={{
                flex: 1,
                height: 72,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.text,
                fontSize: 21,
                fontWeight: 820,
                opacity: p,
              }}
            >
              {step}
            </Panel>
          );
        })}
      </div>
      <CaptionBar text={cue(frame, riskCues)} />
    </>
  );
};

const FinalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const mapped = [
    { word: "满仓梭哈", tag: "仓位 / 风控", color: COLORS.blue },
    { word: "接飞刀", tag: "行为 / 风险", color: COLORS.yellow },
    { word: "买一卖一", tag: "报价", color: COLORS.cyan },
    { word: "追涨杀跌", tag: "行为", color: COLORS.purple },
    { word: "放量突破", tag: "图表", color: COLORS.green },
  ];
  return (
    <>
      <SceneShell
        kicker="10 / TAKEAWAY"
        title="同一批黑话，现在能读懂"
        description="结尾回到开场：不是背更多词，而是把每个词放进问题，再还原成动作。"
        accent={COLORS.green}
      >
        <div style={{ position: "absolute", right: 115, top: 205, width: 850, height: 575 }}>
          {mapped.map((item, index) => {
            const p = clampEase(frame, 38 + index * 18, 76 + index * 18);
            return (
              <Panel
                key={item.word}
                accent={item.color}
                style={{
                  height: 72,
                  marginBottom: 18,
                  display: "grid",
                  gridTemplateColumns: "230px 1fr 190px",
                  alignItems: "center",
                  padding: "0 26px",
                  opacity: p,
                  transform: `translateX(${enterY(p, 28)}px)`,
                }}
              >
                <div style={{ color: item.color, fontSize: 26, fontWeight: 880 }}>{item.word}</div>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${item.color}, transparent)`, transform: `scaleX(${p})`, transformOrigin: "left center" }} />
                <div style={{ color: COLORS.text, fontSize: 23, fontWeight: 800, textAlign: "right" }}>{item.tag}</div>
              </Panel>
            );
          })}
          <Panel
            accent={COLORS.green}
            style={{
              position: "absolute",
              left: 110,
              right: 110,
              bottom: 0,
              height: 94,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.text,
              fontSize: 29,
              fontWeight: 900,
              opacity: clampEase(frame, 155, 210),
            }}
          >
            词语只是入口，动作和风险才是判断对象。
          </Panel>
        </div>
      </SceneShell>
      <CaptionBar
        text={cue(frame, [
          { from: 0, to: 140, text: "最后记住三个问题：谁在做什么？价格还是数量？" },
          { from: 140, to: 280, text: "这是事实描述，还是情绪表达？" },
          { from: 280, to: 420, text: "本视频仅作金融知识科普，不构成投资建议。" },
        ])}
      />
    </>
  );
};

export const StockJargonSystemVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: TYPOGRAPHY.fontFamily, overflow: "hidden" }}>
      <VideoBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations[0]} premountFor={fps}>
          <HookNoiseScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[1]} premountFor={fps}>
          <ConceptMapScene
            kicker="01 / SORT"
            title="股市黑话，先分抽屉再解释"
            description="本期不按热闹程度背词，而是把每个词放回它描述的问题。"
            center="股市黑话"
            nodes={["方向", "行情", "报价", "下单", "行为", "图表", "仓位", "风控"]}
            accent={COLORS.green}
          />
          <CueCaption cues={mapCues} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[2]} premountFor={fps}>
          <ComparisonScene
            kicker="02 / DIRECTION"
            title="多头与空头：先看方向"
            description="方向词不等于交易建议，它只是说明你期待价格往哪边走。"
            leftTitle="LONG / 多头"
            rightTitle="SHORT / 空头"
            leftItems={["买入后期待上涨", "风险来自价格下跌", "常见于现货买入"]}
            rightItems={["期待价格下跌", "常涉及借入卖出", "上涨会带来反向风险"]}
            accent={COLORS.yellow}
          />
          <CueCaption cues={directionCues} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[3]} premountFor={fps}>
          <MarketMoodScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[4]} premountFor={fps}>
          <OrderBookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[5]} premountFor={fps}>
          <OrderTypeScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[6]} premountFor={fps}>
          <BehaviorPathScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[7]} premountFor={fps}>
          <ChartVerbScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[8]} premountFor={fps}>
          <PositionExposureScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[9]} premountFor={fps}>
          <RiskFlowScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={linearTiming({ durationInFrames: transitionFrames, easing: Easing.out(Easing.cubic) })} presentation={fade()} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations[10]} premountFor={fps}>
          <FinalScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <div style={{ position: "absolute", right: 88, bottom: 42, color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}>
        STOCK JARGON SYSTEM / V4
      </div>
      <div style={{ position: "absolute", left: 88, bottom: 42, display: "flex", gap: 10 }}>
        {[TrendUp, TrendDown, WarningCircle, StackSimple].map((IconComponent, index) => (
          <IconComponent key={index} size={22} color={sceneAccents[index]} weight="duotone" />
        ))}
      </div>
      <ProgressRail durationInFrames={stockJargonSystemDurationInFrames} />
    </AbsoluteFill>
  );
};
