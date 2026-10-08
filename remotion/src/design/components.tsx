import { Rect } from "@remotion/shapes";
import type { Icon } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, RADIUS, SPACE, TYPOGRAPHY, VIDEO } from "./tokens";

export const VideoBackground: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(circle at 15% 20%, rgba(67,217,255,0.14), transparent 28%), radial-gradient(circle at 84% 78%, rgba(174,139,255,0.14), transparent 32%), linear-gradient(135deg, #080d17 0%, #101827 60%, #121827 100%)",
    }}
  >
    <AbsoluteFill
      style={{
        opacity: 0.16,
        backgroundImage:
          "linear-gradient(rgba(246,248,251,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(246,248,251,0.08) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
      }}
    />
  </AbsoluteFill>
);

export const Panel: React.FC<{
  children: ReactNode;
  accent?: string;
  style?: CSSProperties;
}> = ({ children, accent, style }) => (
  <div
    style={{
      border: `1px solid ${accent ? `${accent}99` : COLORS.faint}`,
      background: "rgba(15, 24, 40, 0.92)",
      borderRadius: RADIUS.md,
      boxShadow: accent ? `0 0 38px ${accent}22` : "0 18px 60px rgba(0,0,0,0.22)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const HeaderBlock: React.FC<{
  kicker: string;
  title: string;
  description: string;
  accent?: string;
  style?: CSSProperties;
}> = ({ kicker, title, description, accent = COLORS.green, style }) => (
  <div style={{ position: "absolute", left: VIDEO.safeX, top: VIDEO.safeTop, width: 860, ...style }}>
    <div
      style={{
        color: accent,
        fontSize: TYPOGRAPHY.kicker,
        fontWeight: 850,
        letterSpacing: 1,
        marginBottom: 22,
      }}
    >
      {kicker}
    </div>
    <div style={{ color: COLORS.text, fontSize: TYPOGRAPHY.title, lineHeight: 1.08, fontWeight: 900 }}>
      {title}
    </div>
    <div
      style={{
        color: COLORS.muted,
        fontSize: TYPOGRAPHY.subtitle,
        lineHeight: 1.48,
        marginTop: 26,
        maxWidth: 810,
      }}
    >
      {description}
    </div>
  </div>
);

export const CaptionBar: React.FC<{ text?: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      left: 154,
      right: 154,
      bottom: VIDEO.captionBottom,
      minHeight: VIDEO.captionHeight,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "18px 40px",
      background: "rgba(3,8,20,0.94)",
      border: `1px solid ${COLORS.faint}`,
      borderRadius: RADIUS.md,
    }}
  >
    <div style={{ color: "#fff", fontSize: TYPOGRAPHY.caption, lineHeight: 1.38, textAlign: "center", fontWeight: 750 }}>
      {text}
    </div>
  </div>
);

export const ProgressRail: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: VIDEO.safeX, right: VIDEO.safeX, bottom: 31, height: 3, background: COLORS.faint }}>
      <div
        style={{
          width: `${Math.min(100, (frame / durationInFrames) * 100)}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.yellow}, ${COLORS.coral})`,
        }}
      />
    </div>
  );
};

export const IconBadge: React.FC<{
  icon: Icon;
  label: string;
  color: string;
  style?: CSSProperties;
}> = ({ icon: IconComponent, label, color, style }) => (
  <Panel
    accent={color}
    style={{
      height: 84,
      display: "flex",
      alignItems: "center",
      gap: SPACE.md,
      padding: "0 24px",
      color,
      ...style,
    }}
  >
    <IconComponent size={34} weight="duotone" />
    <span style={{ color: COLORS.text, fontSize: 24, fontWeight: 800 }}>{label}</span>
  </Panel>
);

export const HighlightBox: React.FC<{
  width: number;
  height: number;
  color?: string;
  progress?: number;
  style?: CSSProperties;
}> = ({ width, height, color = COLORS.yellow, progress = 1, style }) => (
  <div style={{ width, height, ...style }}>
    <Rect
      width={width}
      height={height}
      cornerRadius={8}
      stroke={color}
      strokeWidth={4}
      fill="transparent"
      strokeDasharray="1"
      strokeDashoffset={1 - progress}
      pathLength={1}
      style={{ overflow: "visible" }}
    />
  </div>
);

export const CalloutArrow: React.FC<{
  width: number;
  color?: string;
  progress?: number;
  style?: CSSProperties;
}> = ({ width, color = COLORS.yellow, progress = 1, style }) => (
  <svg width={width} height="40" viewBox={`0 0 ${width} 40`} style={{ overflow: "visible", ...style }}>
    <path
      d={`M 4 20 L ${width - 16} 20`}
      fill="none"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
    <path d={`M ${width - 20} 8 L ${width - 4} 20 L ${width - 20} 32`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={progress} />
  </svg>
);
