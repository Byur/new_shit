import { CheckCircle, House, MapPin, Package, Star, Storefront, Taxi } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBar, ProgressRail, VideoBackground } from "./design/components";
import { assertDisjointBounds, ConnectorLine, type RectBounds } from "./design/connectors";
import { COLORS, TYPOGRAPHY } from "./design/tokens";

const sceneLength = 330;
const sceneCount = 7;
export const internetRemakesIndustryDurationInFrames = sceneLength * sceneCount;

const clamp = (value: number, from: number, to: number) =>
  interpolate(value, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const enter = (frame: number, delay = 0) => clamp(frame, delay + 8, delay + 38);
const fadeOut = (frame: number) => 1 - clamp(frame, sceneLength - 24, sceneLength - 2);

const Scene: React.FC<{
  index: string;
  title: ReactNode;
  subtitle: string;
  accent: string;
  caption: string;
  children: ReactNode;
}> = ({ index, title, subtitle, accent, caption, children }) => {
  const frame = useCurrentFrame();
  const intro = enter(frame);
  return (
    <AbsoluteFill style={{ opacity: fadeOut(frame) }}>
      <VideoBackground />
      <div style={{ position: "absolute", left: 94, top: 76, width: 900, opacity: intro, transform: `translateY(${(1 - intro) * 22}px)` }}>
        <div style={{ color: accent, fontSize: 26, letterSpacing: 1.4, fontWeight: 850, marginBottom: 18 }}>{index}</div>
        <div style={{ color: COLORS.text, fontSize: 70, lineHeight: 1.1, fontWeight: 900 }}>{title}</div>
        <div style={{ color: COLORS.muted, fontSize: 28, lineHeight: 1.48, marginTop: 22, maxWidth: 800 }}>{subtitle}</div>
      </div>
      {children}
      <CaptionBar text={caption} />
      <ProgressRail durationInFrames={internetRemakesIndustryDurationInFrames} />
    </AbsoluteFill>
  );
};

const Tag: React.FC<{ text: string; color: string; style?: CSSProperties }> = ({ text, color, style }) => (
  <div
    style={{
      border: `1px solid ${color}99`,
      background: "rgba(10, 18, 34, 0.84)",
      color,
      borderRadius: 7,
      padding: "12px 18px",
      fontFamily: TYPOGRAPHY.monoFamily,
      fontSize: 21,
      fontWeight: 800,
      ...style,
    }}
  >
    {text}
  </div>
);

const Card: React.FC<{ title: string; detail: string; note?: string; color: string; icon?: React.ComponentType<{ size: number; weight: "duotone" }>; style?: CSSProperties }> = ({ title, detail, note, color, icon: Icon, style }) => (
  <div style={{ border: `1px solid ${color}80`, background: "rgba(14, 23, 40, 0.93)", borderRadius: 8, padding: 28, boxShadow: `0 0 38px ${color}18`, ...style }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, color, fontSize: 24, fontWeight: 850 }}>
      {Icon ? <Icon size={29} weight="duotone" /> : null}
      {title}
    </div>
    <div style={{ color: COLORS.text, fontSize: 27, fontWeight: 800, lineHeight: 1.35, marginTop: 18 }}>{detail}</div>
    {note ? <div style={{ color: COLORS.muted, fontSize: 19, lineHeight: 1.38, marginTop: 12 }}>{note}</div> : null}
  </div>
);

const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = enter(frame, 34);
  const lines = ["零售", "出行", "住宿", "金融", "教育"];
  const centerBounds: RectBounds = { left: 310, top: 198, width: 220, height: 140 };
  return (
    <Scene
      index="00 / THE CLAIM"
      title={<>所有传统产业，都能被互联网<br />重做一次？</>}
      subtitle="这不是一句“把门店搬到线上”的口号。它指向的是一场对行业协调方式的重写。"
      accent={COLORS.yellow}
      caption="关键不在于行业有没有 App，而在于信息、交易、履约和反馈的规则有没有被重写。"
    >
      <div style={{ position: "absolute", right: 120, top: 194, width: 790, height: 560, opacity: p }}>
        <div style={{ position: "absolute", left: 310, top: 198, width: 220, height: 140, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.yellow}`, background: "rgba(255, 209, 102, 0.10)", color: COLORS.text, fontSize: 32, fontWeight: 900, boxShadow: `0 0 70px ${COLORS.yellow}55`, zIndex: 2 }}>
          互联网
        </div>
        {lines.map((line, i) => {
          const angle = -1.15 + i * 0.57;
          const dx = Math.cos(angle) * 310;
          const dy = Math.sin(angle) * 222;
          const x = 420 + dx;
          const y = 268 + dy;
          const tagBounds: RectBounds = { left: x - 66, top: y - 26, width: 132, height: 52 };
          const local = enter(frame, 52 + i * 15);
          return (
            <div key={line}>
              <ConnectorLine from={centerBounds} to={tagBounds} color={`${COLORS.yellow}99`} progress={local} />
              <Tag text={line} color={[COLORS.cyan, COLORS.coral, COLORS.green, COLORS.purple, COLORS.blue][i]} style={{ position: "absolute", left: x - 66, top: y - 26, opacity: local, transform: `scale(${0.85 + local * 0.15})`, zIndex: 1 }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 135, bottom: 30, color: COLORS.muted, fontSize: 22, opacity: enter(frame, 145) }}>不是替代行业，而是重写行业如何协作</div>
      </div>
    </Scene>
  );
};

const OperatingSystemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const oldItems = ["靠地段被看见", "靠熟人建立信任", "靠人工撮合供需", "靠经验处理反馈"];
  const newItems = ["搜索与推荐分配注意力", "评价、支付、规则生成信任", "实时匹配与动态定价协调供需", "数据反馈持续改写下一次交易"];
  return (
    <Scene
      index="01 / WHAT CHANGES"
      title="被重做的，是行业的操作系统"
      subtitle="传统行业原本就能提供价值；互联网改变的是价值如何被发现、比较、成交和兑现。"
      accent={COLORS.cyan}
      caption="互联网最先压低的，常常不是生产成本，而是搜索、匹配、信任和沟通的成本。"
    >
      <div style={{ position: "absolute", left: 106, right: 110, top: 410, height: 335, display: "flex", gap: 90 }}>
        <div style={{ width: 680, opacity: enter(frame, 26) }}>
          <div style={{ color: COLORS.coral, fontSize: 22, fontWeight: 900, letterSpacing: 1.3, marginBottom: 20 }}>BEFORE / 局部、线下、低频</div>
          {oldItems.map((item, i) => <div key={item} style={{ color: COLORS.muted, fontSize: 26, lineHeight: 1.65, opacity: enter(frame, 42 + i * 14) }}>— {item}</div>)}
        </div>
        <div style={{ width: 760, opacity: enter(frame, 58) }}>
          <div style={{ color: COLORS.green, fontSize: 22, fontWeight: 900, letterSpacing: 1.3, marginBottom: 20 }}>AFTER / 可搜索、可计算、可反馈</div>
          {newItems.map((item, i) => <div key={item} style={{ color: COLORS.text, fontSize: 26, lineHeight: 1.65, opacity: enter(frame, 76 + i * 14) }}>+ {item}</div>)}
        </div>
        <div style={{ position: "absolute", left: 700, top: 100, width: 2, height: 230, background: COLORS.faint }} />
      </div>
    </Scene>
  );
};

const RetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = clamp(frame, 65, 210);
  const products = ["BOOK", "TOOL", "CAMERA", "NICHE PART"];
  return (
    <Scene
      index="02 / RETAIL"
      title="零售：货架，从街角扩展到全网"
      subtitle="以 Amazon 为例，变化不只是网上下单，而是把商品选择、第三方卖家、履约和广告接成同一套系统。"
      accent={COLORS.green}
      caption="原本稀缺的货架位置，被搜索和推荐替代；原本分散的商家，被市场与履约网络重新组织。"
    >
      <div style={{ position: "absolute", right: 105, top: 205, width: 850, height: 540 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 285, height: 300, border: `1px solid ${COLORS.coral}99`, background: "rgba(20, 25, 39, .92)", padding: 26, opacity: enter(frame, 22) }}>
          <Storefront size={46} color={COLORS.coral} weight="duotone" />
          <div style={{ color: COLORS.text, fontSize: 31, fontWeight: 850, marginTop: 18 }}>有限货架</div>
          <div style={{ color: COLORS.muted, fontSize: 24, lineHeight: 1.45, marginTop: 20 }}>地段决定流量<br />选品决定上限<br />库存被困在门店</div>
        </div>
        <div style={{ position: "absolute", left: 335, top: 0, width: 470, height: 300, border: `1px solid ${COLORS.green}99`, background: "rgba(15, 29, 39, .92)", padding: 28, opacity: enter(frame, 50) }}>
          <Package size={46} color={COLORS.green} weight="duotone" />
          <div style={{ color: COLORS.text, fontSize: 31, fontWeight: 850, marginTop: 18 }}>可计算的长尾货架</div>
          {products.map((product, i) => <Tag key={product} text={product} color={[COLORS.cyan, COLORS.yellow, COLORS.purple, COLORS.green][i]} style={{ display: "inline-block", margin: "18px 10px 0 0", opacity: enter(frame, 82 + i * 20) }} />)}
          <div style={{ position: "absolute", left: 18, right: 18, top: 94, height: 3, background: COLORS.yellow, opacity: 0.8, transform: `translateY(${scan * 145}px)` }} />
        </div>
        <div style={{ position: "absolute", left: 0, top: 345, width: 805, display: "flex", gap: 18, opacity: enter(frame, 166) }}>
          <Card title="自营线上销售 / 2024" detail="$247B" note="证明线上货架的需求规模。" color={COLORS.cyan} style={{ flex: 1 }} />
          <Card title="第三方卖家服务 / 2024" detail="$156B" note="佣金与履约：Amazon 在组织别人的供给。" color={COLORS.yellow} style={{ flex: 1 }} />
          <Card title="这组数要证明什么" detail="零售不只卖货" note="平台也靠流量、规则与履约网络创造收入。" color={COLORS.green} style={{ flex: 1 }} />
        </div>
      </div>
    </Scene>
  );
};

const MobilityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const route = clamp(frame, 86, 215);
  const carX = 184 + route * 390;
  return (
    <Scene
      index="03 / MOBILITY"
      title="出行：调度，从“等车”变成实时市场"
      subtitle="Uber 不是消灭车辆，而是把乘客、司机、路线、支付和评价放进一个不断学习的匹配系统。"
      accent={COLORS.coral}
      caption="当供需、位置和价格被实时连接，传统的派单、等候和空驶，开始被算法化地重新协调。"
    >
      <div style={{ position: "absolute", right: 112, top: 204, width: 850, height: 530 }}>
        <div style={{ position: "absolute", left: 10, top: 5, width: 810, height: 320, opacity: enter(frame, 26) }}>
          <svg width="810" height="320" viewBox="0 0 810 320">
            {[70, 160, 250].map((y) => <path key={y} d={`M 20 ${y} C 220 ${y - 35} 380 ${y + 38} 790 ${y - 12}`} fill="none" stroke="rgba(246,248,251,.13)" strokeWidth="2" />)}
            <path d="M 160 258 C 275 230 380 90 615 88" fill="none" stroke={COLORS.coral} strokeWidth="6" strokeDasharray="11 12" pathLength={1} strokeDashoffset={1 - route} />
            <circle cx="160" cy="258" r="18" fill={COLORS.green} opacity={enter(frame, 48)} />
            <circle cx="615" cy="88" r="18" fill={COLORS.cyan} opacity={enter(frame, 48)} />
            <circle cx={carX} cy={258 - route * 170} r="20" fill={COLORS.yellow} opacity={route} />
          </svg>
          <Tag text="RIDER" color={COLORS.green} style={{ position: "absolute", left: 105, top: 260 }} />
          <Tag text="DRIVER" color={COLORS.cyan} style={{ position: "absolute", left: 568, top: 18 }} />
          <Tag text="MATCH → ROUTE → PAY → RATE" color={COLORS.coral} style={{ position: "absolute", left: 235, top: 138, opacity: enter(frame, 110) }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", gap: 20, opacity: enter(frame, 168) }}>
          <Card title="已完成行程 / 2024" detail="11.273B" note="证明实时匹配已经是日常基础设施。" color={COLORS.coral} icon={Taxi} style={{ flex: 1 }} />
          <Card title="月活平台用户 / 2024 Q4" detail="171M" note="需求与供给必须持续、动态地平衡。" color={COLORS.cyan} icon={MapPin} style={{ flex: 1 }} />
          <Card title="这组数的另一面" detail="监管与劳动关系重谈" note="规模化协调也重新分配了责任与权利。" color={COLORS.yellow} style={{ flex: 1 }} />
        </div>
      </div>
    </Scene>
  );
};

const LodgingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const wave = clamp(frame, 84, 204);
  const homes = [
    { left: 72, top: 166, color: COLORS.cyan },
    { left: 290, top: 65, color: COLORS.green },
    { left: 570, top: 188, color: COLORS.purple },
    { left: 648, top: 42, color: COLORS.yellow },
  ];
  const trustBounds: RectBounds = { left: 315, top: 188, width: 220, height: 150 };
  assertDisjointBounds("Lodging scene nodes", [
    { name: "trust protocol", bounds: trustBounds },
    ...homes.map((home, index) => ({ name: `home ${index + 1}`, bounds: { left: home.left, top: home.top, width: 124, height: 100 } })),
  ]);
  return (
    <Scene
      index="04 / LODGING"
      title="住宿：信任，变成可携带的基础设施"
      subtitle="Airbnb 的关键不只是“住进别人家”，而是把陌生房东与陌生旅客之间难以建立的信任，产品化为身份、评价、支付和规则。"
      accent={COLORS.purple}
      caption="平台让分散的闲置供给可被看见，也让信任、税务、城市治理这些原本隐形的问题浮到台前。"
    >
      <div style={{ position: "absolute", right: 100, top: 190, width: 860, height: 560 }}>
        <div style={{ position: "absolute", left: 315, top: 188, width: 220, height: 150, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.purple}`, background: "rgba(174,139,255,.12)", opacity: enter(frame, 20), zIndex: 2 }}>
          <Star size={40} color={COLORS.yellow} weight="fill" />
          <div style={{ color: COLORS.text, fontSize: 26, fontWeight: 900 }}>信任协议</div>
        </div>
        {homes.map((home, i) => {
          const p = enter(frame, 46 + i * 18);
          const homeBounds: RectBounds = { left: home.left, top: home.top, width: 124, height: 100 };
          return (
            <div key={home.left}>
              <ConnectorLine from={homeBounds} to={trustBounds} color={`${home.color}99`} progress={p} />
              <div style={{ position: "absolute", left: home.left, top: home.top, width: 124, height: 100, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${home.color}`, background: "rgba(15,24,40,.92)", opacity: p, transform: `scale(${.82 + p * .18})`, zIndex: 1 }}><House size={44} color={home.color} weight="duotone" /></div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 122, bottom: 18, width: 616, minHeight: 118, padding: "16px 22px", border: `1px solid ${COLORS.purple}99`, background: "rgba(27, 22, 48, .92)", opacity: enter(frame, 164), transform: `scaleX(${.72 + wave * .28})`, transformOrigin: "center" }}>
          <div style={{ color: COLORS.purple, fontSize: 18, fontWeight: 850, letterSpacing: 0.8 }}>规模证据：陌生人信任可以被反复使用</div>
          <div style={{ color: COLORS.text, fontSize: 31, fontWeight: 900, marginTop: 6 }}>492M 次入住与体验预订</div>
          <div style={{ color: COLORS.muted, fontSize: 19, marginTop: 7 }}>2024 年；它说明这套身份、评价、支付与规则并非小规模试验。</div>
        </div>
      </div>
    </Scene>
  );
};

const ConsequenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const points = [
    { label: "权力重分配", detail: "流量入口、规则与数据变得稀缺", color: COLORS.coral },
    { label: "效率与规模", detail: "供需可以跨地域、更高频地匹配", color: COLORS.green },
    { label: "新的摩擦", detail: "佣金、劳动、隐私、垄断与监管", color: COLORS.yellow },
  ];
  return (
    <Scene
      index="05 / THE IMPACT"
      title="冲击不是单向的“效率提升”"
      subtitle="互联网会放大选择、压缩摩擦，也会重新分配谁拥有入口、数据和议价权。"
      accent={COLORS.yellow}
      caption="真正的变化，是价值链与权力结构一起移动：有人获得更低门槛，有人失去原有的中介位置。"
    >
      <div style={{ position: "absolute", left: 104, right: 104, top: 470, display: "flex", gap: 24 }}>
        {points.map((point, i) => <Card key={point.label} title={point.label} detail={point.detail} color={point.color} icon={CheckCircle} style={{ flex: 1, minHeight: 200, opacity: enter(frame, 28 + i * 28), transform: `translateY(${(1 - enter(frame, 28 + i * 28)) * 32}px)` }} />)}
      </div>
    </Scene>
  );
};

const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = enter(frame, 40);
  return (
    <Scene
      index="06 / A BETTER QUESTION"
      title={<>别问“这个行业能不能上网”<br />问：它的哪一段协调成本最高？</>}
      subtitle="搜索、匹配、信任、支付、履约、反馈，往往才是互联网重做传统产业的真正入口。"
      accent={COLORS.cyan}
      caption="互联网没有让实体世界消失。它让实体世界必须用新的方式被组织、被衡量，也被重新谈判。"
    >
      <div style={{ position: "absolute", right: 158, top: 314, width: 720, opacity: p }}>
        {["信息不透明？", "供需难匹配？", "信任建立太慢？", "履约无法规模化？", "反馈不能回流？"].map((question, i) => <Tag key={question} text={question} color={[COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.coral, COLORS.purple][i]} style={{ display: "inline-block", margin: "0 16px 18px 0", opacity: enter(frame, 66 + i * 18) }} />)}
        <div style={{ marginTop: 34, color: COLORS.muted, fontSize: 20, lineHeight: 1.5, opacity: enter(frame, 185) }}>DATA SOURCES: AMAZON, UBER, AIRBNB 2024 ANNUAL REPORTS</div>
      </div>
    </Scene>
  );
};

export const InternetRemakesIndustryVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={sceneLength} premountFor={fps}><OpeningScene /></Sequence>
      <Sequence from={sceneLength} durationInFrames={sceneLength} premountFor={fps}><OperatingSystemScene /></Sequence>
      <Sequence from={sceneLength * 2} durationInFrames={sceneLength} premountFor={fps}><RetailScene /></Sequence>
      <Sequence from={sceneLength * 3} durationInFrames={sceneLength} premountFor={fps}><MobilityScene /></Sequence>
      <Sequence from={sceneLength * 4} durationInFrames={sceneLength} premountFor={fps}><LodgingScene /></Sequence>
      <Sequence from={sceneLength * 5} durationInFrames={sceneLength} premountFor={fps}><ConsequenceScene /></Sequence>
      <Sequence from={sceneLength * 6} durationInFrames={sceneLength} premountFor={fps}><ClosingScene /></Sequence>
    </AbsoluteFill>
  );
};
