import React from 'react';
import {LAYOUT, theme} from '../theme';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Ramps 0 -> 1 over `dur` frames starting at `start`. */
export const enter = (frame: number, start: number, dur = 14) =>
  smooth((frame - start) / dur);

/** Ramps 1 -> 0, reaching 0 at `end`. */
export const leave = (frame: number, end: number, dur = 12) =>
  smooth((end - frame) / dur);

export const pop = (frame: number, start: number, dur = 16) => {
  const t = enter(frame, start, dur);
  return 0.94 + t * 0.06;
};

/** Piecewise eased interpolation over [frame, value] keys. */
export const track = (frame: number, keys: Array<[number, number]>): number => {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) {
      if (f1 === f0) return v1;
      return v0 + (v1 - v0) * smooth((frame - f0) / (f1 - f0));
    }
  }
  return keys[keys.length - 1][1];
};

/**
 * Floating text over the map gets a soft vignette rather than a card, so the
 * geography behind it stays legible as geography.
 */
export const textScrim = (align: 'left' | 'center' = 'left'): React.CSSProperties => ({
  background:
    align === 'left'
      ? 'linear-gradient(90deg, rgba(14,10,6,0.96) 0%, rgba(14,10,6,0.9) 56%, rgba(14,10,6,0.4) 86%, rgba(14,10,6,0) 100%)'
      : 'radial-gradient(ellipse 62% 200% at 50% 50%, rgba(14,10,6,0.96) 0%, rgba(14,10,6,0.86) 58%, rgba(14,10,6,0) 100%)',
  padding: '22px 34px',
  borderRadius: 18,
  boxSizing: 'border-box',
});

/** A horizontal comparison bar with a label and a value, used for chemistry. */
export const MeasureBar: React.FC<{
  x: number;
  y: number;
  width: number;
  label: string;
  value: number;
  max: number;
  color: string;
  frame: number;
  appear: number;
  unit?: string;
  digits?: number;
  height?: number;
  compare?: {value: number; color: string};
}> = ({
  x,
  y,
  width,
  label,
  value,
  max,
  color,
  frame,
  appear,
  unit = '',
  digits = 1,
  height = 26,
  compare,
}) => {
  const t = enter(frame, appear, 20);
  const full = (value / max) * width;
  const cmpFull = compare ? (compare.value / max) * width : 0;
  return (
    <g>
      <text
        x={x}
        y={y + height * 0.78}
        fill={theme.textDim}
        fontFamily={theme.font}
        fontSize={24}
        textAnchor="end"
      >
        {label}
      </text>
      <rect
        x={x + 18}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill="rgba(255,255,255,0.04)"
      />
      {compare ? (
        <rect
          x={x + 18}
          y={y}
          width={cmpFull * t}
          height={height}
          rx={4}
          fill={compare.color}
          opacity={0.25}
        />
      ) : null}
      <rect x={x + 18} y={y} width={full * t} height={height} rx={4} fill={color} />
      <text
        x={x + 18 + width + 16}
        y={y + height * 0.78}
        fill={color}
        fontFamily={theme.mono}
        fontSize={24}
        opacity={t}
      >
        {value.toFixed(digits)}
        {unit}
      </text>
    </g>
  );
};

/** An elbow leader from a floating label to a point on the map. */
export const Leader: React.FC<{
  from: {x: number; y: number};
  to: {x: number; y: number};
  color: string;
  progress?: number;
  dashed?: boolean;
}> = ({from, to, color, progress = 1, dashed}) => {
  if (progress <= 0.01) return null;
  const elbowX = from.x + (to.x - from.x) * 0.45;
  const d = `M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${to.y} L ${to.x} ${to.y}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeDasharray={dashed ? '8 7' : undefined}
      opacity={0.85 * progress}
      strokeDashoffset={(1 - progress) * 40}
    />
  );
};

/** A bordered label that hangs off a map point without covering it. */
export const Callout: React.FC<{
  frame: number;
  appear: number;
  box: {left: number; top: number; width?: number};
  anchor?: {x: number; y: number};
  color: string;
  label: string;
  sub?: string;
  right?: string;
  opacity?: number;
  emphasis?: number;
  leader?: boolean;
}> = ({
  frame,
  appear,
  box,
  anchor,
  color,
  label,
  sub,
  right,
  opacity = 1,
  emphasis = 0,
  leader = true,
}) => {
  const t = enter(frame, appear, 14);
  const o = t * opacity;
  if (o <= 0.01) return null;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: o}}>
      {leader && anchor ? (
        <svg
          width={LAYOUT.width}
          height={LAYOUT.height}
          viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
          style={{position: 'absolute', inset: 0}}
        >
          <Leader
            from={{
              x: anchor.x > box.left + (box.width ?? 260) ? box.left + (box.width ?? 260) : box.left + (box.width ?? 260) / 2,
              y: anchor.x > box.left + (box.width ?? 260) ? box.top + 30 : box.top,
            }}
            to={anchor}
            color={color}
            progress={t}
          />
          <circle cx={anchor.x} cy={anchor.y} r={6} fill="none" stroke={color} strokeWidth={2.2} />
        </svg>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          boxSizing: 'border-box',
          fontFamily: theme.font,
          background: 'rgba(16,11,7,0.94)',
          border: `2px solid ${color}`,
          borderRadius: 12,
          padding: '13px 20px',
          transform: `translateY(${(1 - t) * 12}px)`,
          boxShadow: emphasis > 0 ? `0 0 ${14 + emphasis * 28}px ${color}55` : 'none',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{color, fontSize: 27, fontWeight: 700, letterSpacing: 1}}>{label}</span>
          {right ? (
            <span style={{marginLeft: 'auto', color: theme.textDim, fontSize: 21, fontFamily: theme.mono}}>
              {right}
            </span>
          ) : null}
        </div>
        {sub ? (
          <div style={{color: theme.textDim, fontSize: 21, marginTop: 7, lineHeight: 1.45}}>{sub}</div>
        ) : null}
      </div>
    </div>
  );
};
