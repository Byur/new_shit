import type { Icon } from "@phosphor-icons/react";
import { ArrowRight, CheckCircle, NumberCircleOne, NumberCircleThree, NumberCircleTwo } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { CalloutArrow, HeaderBlock, HighlightBox, IconBadge, Panel } from "./components";
import { ConnectorLine, type RectBounds } from "./connectors";
import { clampEase, drawDash, enterY, revealWidth, softSpring } from "./motion";
import { COLORS, sceneAccents, SPACE, TYPOGRAPHY } from "./tokens";

export type SceneShellProps = {
  kicker: string;
  title: string;
  description: string;
  accent?: string;
  children: ReactNode;
};

export const SceneShell: React.FC<SceneShellProps> = ({ kicker, title, description, accent = COLORS.green, children }) => {
  const frame = useCurrentFrame();
  const intro = clampEase(frame, 8, 34);
  return (
    <>
      <div style={{ opacity: intro, transform: `translateY(${enterY(intro, 18)}px)` }}>
        <HeaderBlock kicker={kicker} title={title} description={description} accent={accent} />
      </div>
      {children}
    </>
  );
};

export const KeyPointScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  points: string[];
  icon: Icon;
  accent?: string;
}> = ({ kicker, title, description, points, icon, accent = COLORS.green }) => {
  const frame = useCurrentFrame();
  const p = clampEase(frame, 16, 42);
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <div style={{ position: "absolute", right: 120, top: 205, width: 820, opacity: p }}>
        <IconBadge icon={icon} label="核心判断" color={accent} style={{ width: 300, marginBottom: SPACE.lg }} />
        <Panel accent={accent} style={{ padding: 32 }}>
          {points.map((point, index) => {
            const local = clampEase(frame, 24 + index * 12, 52 + index * 12);
            return (
              <div
                key={point}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  minHeight: 78,
                  color: COLORS.text,
                  fontSize: 29,
                  fontWeight: 780,
                  opacity: local,
                  transform: `translateY(${enterY(local, 18)}px)`,
                }}
              >
                <CheckCircle size={31} color={sceneAccents[index % sceneAccents.length]} weight="duotone" />
                {point}
              </div>
            );
          })}
        </Panel>
      </div>
    </SceneShell>
  );
};

export const ComparisonScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  leftTitle: string;
  rightTitle: string;
  leftItems: string[];
  rightItems: string[];
  accent?: string;
}> = ({ kicker, title, description, leftTitle, rightTitle, leftItems, rightItems, accent = COLORS.yellow }) => {
  const frame = useCurrentFrame();
  const p = clampEase(frame, 16, 44);
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <div style={{ position: "absolute", right: 110, top: 205, width: 875, height: 515, opacity: p }}>
        {[
          { title: leftTitle, items: leftItems, color: COLORS.coral, left: 0 },
          { title: rightTitle, items: rightItems, color: COLORS.green, left: 485 },
        ].map((side, sideIndex) => (
          <Panel
            key={side.title}
            accent={side.color}
            style={{
              position: "absolute",
              left: side.left,
              top: sideIndex === 0 ? 42 : 0,
              width: 390,
              height: 392,
              padding: 30,
              transform: `translateY(${enterY(clampEase(frame, 18 + sideIndex * 10, 48 + sideIndex * 10), 28)}px)`,
            }}
          >
            <div style={{ color: side.color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 22, marginBottom: 32 }}>{side.title}</div>
            {side.items.map((item) => (
              <div key={item} style={{ color: COLORS.text, fontSize: 25, lineHeight: 1.55, marginBottom: 18 }}>
                {item}
              </div>
            ))}
          </Panel>
        ))}
        <CalloutArrow width={112} color={accent} progress={clampEase(frame, 54, 84)} style={{ position: "absolute", left: 382, top: 214 }} />
      </div>
    </SceneShell>
  );
};

export const ProcessScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  steps: string[];
  accent?: string;
}> = ({ kicker, title, description, steps, accent = COLORS.cyan }) => {
  const frame = useCurrentFrame();
  const icons = [NumberCircleOne, NumberCircleTwo, NumberCircleThree];
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <div style={{ position: "absolute", right: 110, top: 215, width: 860 }}>
        {steps.map((step, index) => {
          const local = clampEase(frame, 18 + index * 18, 52 + index * 18);
          const IconComponent = icons[index] ?? NumberCircleThree;
          return (
            <Panel
              key={step}
              accent={sceneAccents[index % sceneAccents.length]}
              style={{
                height: 106,
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "0 30px",
                marginBottom: 22,
                opacity: local,
                transform: `translateX(${enterY(local, 34)}px)`,
              }}
            >
              <IconComponent size={38} color={sceneAccents[index % sceneAccents.length]} weight="duotone" />
              <span style={{ color: COLORS.text, fontSize: 28, fontWeight: 820 }}>{step}</span>
            </Panel>
          );
        })}
      </div>
    </SceneShell>
  );
};

export const TimelineScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  events: Array<{ label: string; detail: string }>;
  accent?: string;
}> = ({ kicker, title, description, events, accent = COLORS.purple }) => {
  const frame = useCurrentFrame();
  const line = clampEase(frame, 20, 72);
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <div style={{ position: "absolute", right: 110, top: 235, width: 860, height: 410 }}>
        <svg width="860" height="370" viewBox="0 0 860 370" style={{ overflow: "visible" }}>
          <path d="M 40 185 C 220 70 320 300 500 185 S 680 90 820 185" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" {...drawDash(line)} />
          {events.map((event, index) => {
            const x = 80 + index * (700 / Math.max(1, events.length - 1));
            const y = index % 2 === 0 ? 140 : 230;
            const local = clampEase(frame, 42 + index * 14, 70 + index * 14);
            return (
              <g key={event.label} opacity={local}>
                <circle cx={x} cy={y} r="11" fill={COLORS.bg} stroke={sceneAccents[index % sceneAccents.length]} strokeWidth="5" />
                <text x={x} y={y - 34} fill={sceneAccents[index % sceneAccents.length]} fontSize="22" fontWeight="700" textAnchor="middle">
                  {event.label}
                </text>
                <text x={x} y={y + 48} fill={COLORS.muted} fontSize="18" textAnchor="middle">
                  {event.detail}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </SceneShell>
  );
};

export const BigNumberScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  number: string;
  label: string;
  accent?: string;
}> = ({ kicker, title, description, number, label, accent = COLORS.coral }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = softSpring(frame, fps, 18);
  const mark = clampEase(frame, 54, 88);
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <div style={{ position: "absolute", right: 155, top: 205, width: 720, height: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", transform: `scale(${0.82 + pulse * 0.18})` }}>
          <div style={{ color: accent, fontSize: 210, lineHeight: 1, fontWeight: 950, textAlign: "center" }}>{number}</div>
          <div style={{ color: COLORS.text, fontSize: 35, fontWeight: 820, textAlign: "center", marginTop: 20 }}>{label}</div>
          <HighlightBox width={520} height={255} color={COLORS.yellow} progress={mark} style={{ position: "absolute", left: "50%", top: -22, transform: "translateX(-50%)" }} />
        </div>
      </div>
    </SceneShell>
  );
};

export const QuoteScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  quote: string;
  source: string;
  accent?: string;
}> = ({ kicker, title, description, quote, source, accent = COLORS.blue }) => {
  const frame = useCurrentFrame();
  const p = clampEase(frame, 16, 48);
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <Panel accent={accent} style={{ position: "absolute", right: 120, top: 235, width: 815, padding: 42, opacity: p, transform: `translateY(${enterY(p, 24)}px)` }}>
        <div style={{ color: accent, fontSize: 82, lineHeight: 0.7 }}>“</div>
        <div style={{ color: COLORS.text, fontSize: 38, lineHeight: 1.45, fontWeight: 820 }}>{quote}</div>
        <div style={{ color: COLORS.muted, fontSize: 24, marginTop: 34, textAlign: "right" }}>— {source}</div>
      </Panel>
    </SceneShell>
  );
};

export const ConceptMapScene: React.FC<{
  kicker: string;
  title: string;
  description: string;
  center: string;
  nodes: string[];
  accent?: string;
}> = ({ kicker, title, description, center, nodes, accent = COLORS.green }) => {
  const frame = useCurrentFrame();
  const p = clampEase(frame, 14, 44);
  const centerBounds: RectBounds = { left: 318, top: 188, width: 250, height: 150 };
  return (
    <SceneShell kicker={kicker} title={title} description={description} accent={accent}>
      <div style={{ position: "absolute", right: 95, top: 185, width: 900, height: 590, opacity: p }}>
        <Panel accent={accent} style={{ position: "absolute", left: 318, top: 188, width: 250, height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.text, fontSize: 34, fontWeight: 900, textAlign: "center", zIndex: 2 }}>
          {center}
        </Panel>
        {nodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
          const x = 443 + Math.cos(angle) * 345;
          const y = 263 + Math.sin(angle) * 228;
          const nodeBounds: RectBounds = { left: x - 90, top: y - 34, width: 180, height: 68 };
          const local = clampEase(frame, 34 + index * 8, 62 + index * 8);
          const color = sceneAccents[index % sceneAccents.length];
          return (
            <div key={node}>
              <ConnectorLine from={centerBounds} to={nodeBounds} color={`${color}77`} progress={local} />
              <Panel accent={color} style={{ position: "absolute", left: x - 90, top: y - 34, width: 180, height: 68, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 830, opacity: local, zIndex: 1 }}>
                {node}
              </Panel>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};

export const ArrowHint: React.FC<{ text: string; progress: number }> = ({ text, progress }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, color: COLORS.yellow, fontSize: 22, fontFamily: TYPOGRAPHY.monoFamily, ...revealWidth(progress) }}>
    <ArrowRight size={25} weight="bold" />
    {text}
  </div>
);
