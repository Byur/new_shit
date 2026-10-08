import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CaptionBar, Panel, ProgressRail, VideoBackground } from "./design/components";
import { clampEase, enterY } from "./design/motion";
import { COLORS, TYPOGRAPHY, VIDEO } from "./design/tokens";

type VisualKind = "contrast" | "parts" | "flow" | "loop" | "takeaway";

export type LessonBeat = {
  kicker: string;
  title: string;
  description: string;
  caption: string;
  accent: string;
  kind: VisualKind;
  left?: { label: string; items: string[] };
  right?: { label: string; items: string[] };
  items?: string[];
};

export type LessonConfig = {
  beats: LessonBeat[];
  durations: number[];
  footer: string;
};

const sceneAt = (frame: number, durations: number[]) => {
  let cursor = 0;
  for (let index = 0; index < durations.length; index += 1) {
    if (frame < cursor + durations[index]) return { index, localFrame: frame - cursor };
    cursor += durations[index];
  }
  return { index: durations.length - 1, localFrame: durations[durations.length - 1] - 1 };
};

const Header: React.FC<{ beat: LessonBeat; frame: number }> = ({ beat, frame }) => {
  const p = clampEase(frame, 8, 34);
  return <div style={{ position: "absolute", left: VIDEO.safeX, top: VIDEO.safeTop, width: 900, opacity: p, transform: `translateY(${enterY(p, 20)}px)` }}>
    <div style={{ color: beat.accent, fontSize: TYPOGRAPHY.kicker, fontWeight: 850, letterSpacing: 1, marginBottom: 22 }}>{beat.kicker}</div>
    <div style={{ color: COLORS.text, fontSize: TYPOGRAPHY.title, lineHeight: 1.08, fontWeight: 900 }}>{beat.title}</div>
    <div style={{ color: COLORS.muted, fontSize: TYPOGRAPHY.subtitle, lineHeight: 1.48, marginTop: 26, maxWidth: 820 }}>{beat.description}</div>
  </div>;
};

const Shell: React.FC<{ beat: LessonBeat; frame: number; children: ReactNode }> = ({ beat, frame, children }) => <><Header beat={beat} frame={frame} />{children}<CaptionBar text={beat.caption} /></>;

const Comparison: React.FC<{ beat: LessonBeat; frame: number }> = ({ beat, frame }) => {
  const left = beat.left ?? { label: "BEFORE", items: [] };
  const right = beat.right ?? { label: "AFTER", items: [] };
  return <div style={{ position: "absolute", right: 112, top: 220, width: 870, height: 500, display: "flex", gap: 42 }}>
    {[{ ...left, color: COLORS.coral, from: 30 }, { ...right, color: COLORS.green, from: 66 }].map((side) => {
      const p = clampEase(frame, side.from, side.from + 42);
      return <Panel key={side.label} accent={side.color} style={{ flex: 1, height: 365, padding: 28, opacity: p, transform: `translateY(${enterY(p, 20)}px)` }}>
        <div style={{ color: side.color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>{side.label}</div>
        {side.items.map((item, index) => <div key={item} style={{ color: index === 0 ? COLORS.text : COLORS.muted, fontSize: 25, fontWeight: index === 0 ? 850 : 700, marginTop: 28, opacity: clampEase(frame, side.from + 16 + index * 14, side.from + 44 + index * 14) }}>{String(index + 1).padStart(2, "0")} / {item}</div>)}
      </Panel>;
    })}
  </div>;
};

const Parts: React.FC<{ beat: LessonBeat; frame: number }> = ({ beat, frame }) => <Panel accent={beat.accent} style={{ position: "absolute", right: 116, top: 208, width: 850, height: 505, padding: 30 }}>
  <div style={{ color: beat.accent, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>CAPABILITY PACKAGE</div>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 28 }}>{(beat.items ?? []).map((item, index) => {
    const p = clampEase(frame, 32 + index * 18, 66 + index * 18);
    const color = [COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple][index % 4];
    return <Panel key={item} accent={color} style={{ height: 150, padding: 22, opacity: p, transform: `translateY(${enterY(p, 18)}px)` }}><div style={{ color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 19 }}>0{index + 1}</div><div style={{ color: COLORS.text, fontSize: 27, fontWeight: 850, marginTop: 30 }}>{item}</div></Panel>;
  })}</div>
</Panel>;

const Flow: React.FC<{ beat: LessonBeat; frame: number; loop?: boolean }> = ({ beat, frame, loop }) => {
  const items = beat.items ?? [];
  const p = clampEase(frame, 32, 172);
  return <div style={{ position: "absolute", right: 96, top: 250, width: 920, height: 355 }}>
    <div style={{ position: "absolute", left: 68, right: loop ? 140 : 68, top: 150, height: 4, background: COLORS.faint }} />
    <div style={{ position: "absolute", left: 68, top: 150, width: (loop ? 710 : 784) * p, height: 4, background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.yellow}, ${COLORS.coral})` }} />
    {items.map((item, index) => {
      const local = clampEase(frame, 30 + index * 28, 66 + index * 28);
      const color = [COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.coral, COLORS.purple][index % 5];
      const count = Math.max(1, items.length - 1);
      const left = 20 + index * (800 / count);
      return <div key={item} style={{ position: "absolute", left, top: index % 2 === 0 ? 34 : 188, width: 150, opacity: local, transform: `translateY(${enterY(local, 18)}px)` }}><Panel accent={color} style={{ height: 92, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 14px", textAlign: "center", color, fontSize: 23, fontWeight: 850 }}>{item}</Panel></div>;
    })}
    {loop && <div style={{ position: "absolute", right: 20, top: 108, color: COLORS.purple, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 22, opacity: p }}>↺ FEEDBACK</div>}
  </div>;
};

const Takeaway: React.FC<{ beat: LessonBeat; frame: number }> = ({ beat, frame }) => {
  const p = clampEase(frame, 42, 130);
  return <div style={{ position: "absolute", right: 120, top: 225, width: 850, height: 420 }}>
    <Panel accent={beat.accent} style={{ position: "absolute", inset: 0, padding: 30, opacity: p, transform: `translateY(${enterY(p, 18)}px)` }}>
      <div style={{ color: beat.accent, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>TAKEAWAY / REPLAY</div>
      {(beat.items ?? []).map((item, index) => <div key={item} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 18, alignItems: "center", marginTop: 30, opacity: clampEase(frame, 56 + index * 18, 88 + index * 18) }}><div style={{ color: [COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple][index % 4], fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20 }}>0{index + 1}</div><div style={{ color: COLORS.text, fontSize: 27, fontWeight: 820 }}>{item}</div></div>)}
    </Panel>
  </div>;
};

export const SkillLessonVideo: React.FC<{ config: LessonConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { index, localFrame } = sceneAt(frame, config.durations);
  const beat = config.beats[index];
  let visual: ReactNode;
  if (beat.kind === "contrast") visual = <Comparison beat={beat} frame={localFrame} />;
  else if (beat.kind === "parts") visual = <Parts beat={beat} frame={localFrame} />;
  else if (beat.kind === "flow") visual = <Flow beat={beat} frame={localFrame} />;
  else if (beat.kind === "loop") visual = <Flow beat={beat} frame={localFrame} loop />;
  else visual = <Takeaway beat={beat} frame={localFrame} />;
  return <AbsoluteFill style={{ fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif", overflow: "hidden" }}><VideoBackground /><Shell beat={beat} frame={localFrame}>{visual}</Shell><div style={{ position: "absolute", right: VIDEO.safeX, bottom: 42, color: COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 17 }}>{config.footer}</div><ProgressRail durationInFrames={config.durations.reduce((sum, duration) => sum + duration, 0)} /></AbsoluteFill>;
};
