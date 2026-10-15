import React from 'react';
import {interpolate, Easing} from 'remotion';
import {LAYOUT, theme} from '../theme';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Ramps 0 -> 1 over `dur` frames starting at `start`. */
export const enter = (frame: number, start: number, dur = 14) => smooth((frame - start) / dur);

/** Ramps 1 -> 0, reaching 0 at `end`. */
export const leave = (frame: number, end: number, dur = 12) => smooth((end - frame) / dur);

/** An entrance gated by a range: 0 outside, 1 inside, eased at both ends. */
export const window_ = (frame: number, from: number, to: number, dur = 14) =>
  Math.min(enter(frame, from, dur), leave(frame, to, dur));

/**
 * The film never uses elastic easing — the director's brief forbids bounce and
 * overshoot, because a bridge tearing itself apart should not look jaunty. This
 * is the only non-trivial curve in the film, used for data points settling.
 */
export const settle = (frame: number, start: number, dur = 18): number =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

/** Piecewise eased interpolation over [frame, value] keys. */
export const track = (frame: number, keys: Array<[number, number]>): number => {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [bf, bv] = keys[i];
    const [af, av] = keys[i - 1];
    if (frame <= bf) {
      const span = bf - af;
      if (span <= 0) return bv;
      return av + (bv - av) * smooth((frame - af) / span);
    }
  }
  return keys[keys.length - 1][1];
};

/**
 * The uniform act title. Every act announces itself the same way, which is what
 * lets the film change visual register between archive and diagram without the
 * viewer losing their place.
 */
export const ActTitle: React.FC<{frame: number; appear: number; text: string; sub?: string}> = ({
  frame,
  appear,
  text,
  sub,
}) => {
  const o = enter(frame, appear, 16);
  if (o <= 0.01) return null;
  return (
    <g opacity={o}>
      <text
        x={LAYOUT.title.x}
        y={LAYOUT.title.y}
        fill={theme.text}
        fontSize={40}
        fontWeight={600}
        letterSpacing={2}
        fontFamily={theme.font}
      >
        {text}
      </text>
      {sub ? (
        <text
          x={LAYOUT.title.x}
          y={LAYOUT.title.y + 42}
          fill={theme.textFaint}
          fontSize={22}
          letterSpacing={3}
          fontFamily={theme.font}
        >
          {sub}
        </text>
      ) : null}
      <line
        x1={LAYOUT.title.x}
        x2={LAYOUT.title.x + 92}
        y1={LAYOUT.title.y + 66}
        y2={LAYOUT.title.y + 66}
        stroke={theme.energy}
        strokeWidth={3}
        opacity={0.75}
      />
    </g>
  );
};

/** A hairline rule used to separate a panel's heading from its body. */
export const Rule: React.FC<{x: number; y: number; w: number; color?: string; opacity?: number}> = ({
  x,
  y,
  w,
  color = theme.panelEdge,
  opacity = 1,
}) => <line x1={x} x2={x + w} y1={y} y2={y} stroke={color} strokeWidth={1} opacity={opacity} />;

/** A key/value readout. Numbers are the film's evidence, so they get the mono face. */
export const Readout: React.FC<{
  x: number;
  y: number;
  label: string;
  value: string;
  color?: string;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  opacity?: number;
}> = ({x, y, label, value, color = theme.text, size = 26, anchor = 'start', opacity = 1}) => (
  <g opacity={opacity}>
    <text
      x={x}
      y={y}
      fill={theme.textFaint}
      fontSize={17}
      letterSpacing={3}
      textAnchor={anchor}
      fontFamily={theme.font}
    >
      {label}
    </text>
    <text
      x={x}
      y={y + size + 12}
      fill={color}
      fontSize={size}
      fontFamily={theme.mono}
      textAnchor={anchor}
    >
      {value}
    </text>
  </g>
);

/** A labelled box, the film's standard container for a diagram. */
export const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  edge?: string;
  children?: React.ReactNode;
}> = ({x, y, w, h, opacity = 1, edge = theme.panelEdge, children}) => (
  <g opacity={opacity}>
    <rect x={x} y={y} width={w} height={h} rx={12} fill={theme.panel} stroke={edge} strokeWidth={1.2} />
    {children}
  </g>
);

/**
 * The film's only recurring wind language: a streamline. Scene joins are made by
 * a streamline leaving one side of frame and entering the next from the same
 * side, so the wind is the one thing that is continuous across the whole film.
 *
 * `energy` switches the stroke from neutral grey-blue to the signal orange that
 * the palette reserves for "this air is doing work on the bridge".
 */
export const Streamline: React.FC<{
  d: string;
  opacity?: number;
  energy?: boolean;
  width?: number;
  dashed?: boolean;
}> = ({d, opacity = 1, energy = false, width = 2, dashed = false}) => (
  <path
    d={d}
    fill="none"
    stroke={energy ? theme.energy : theme.wind}
    strokeWidth={width}
    strokeLinecap="round"
    opacity={opacity}
    strokeDasharray={dashed ? '10 8' : undefined}
  />
);

/**
 * A streamline that flows: dashes advance along the path with the frame, so the
 * viewer reads direction rather than just shape.
 */
export const FlowingStreamline: React.FC<{
  d: string;
  frame: number;
  speed?: number;
  opacity?: number;
  energy?: boolean;
  width?: number;
}> = ({d, frame, speed = 1.4, opacity = 1, energy = false, width = 2}) => (
  <path
    d={d}
    fill="none"
    stroke={energy ? theme.energy : theme.wind}
    strokeWidth={width}
    strokeLinecap="round"
    opacity={opacity}
    strokeDasharray="14 16"
    strokeDashoffset={-frame * speed}
  />
);

/**
 * A horizontal bar that grows to a value. Used for the span-length ranking and
 * for any comparison where the point is relative size.
 */
export const GrowBar: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  progress: number;
  color: string;
  opacity?: number;
}> = ({x, y, w, h, progress, color, opacity = 1}) => (
  <rect x={x} y={y} width={Math.max(0, w * clamp01(progress))} height={h} rx={3} fill={color} opacity={opacity} />
);

/** A dashed reference line with a label — the film's way of marking a threshold. */
export const ThresholdLine: React.FC<{
  x1: number;
  x2: number;
  y: number;
  label: string;
  color: string;
  opacity?: number;
  labelAbove?: boolean;
  anchor?: 'start' | 'middle' | 'end';
}> = ({x1, x2, y, label, color, opacity = 1, labelAbove = true, anchor = 'start'}) => (
  <g opacity={opacity}>
    <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={1.6} strokeDasharray="12 8" />
    <text
      x={anchor === 'end' ? x2 : anchor === 'middle' ? (x1 + x2) / 2 : x1}
      y={labelAbove ? y - 12 : y + 28}
      fill={color}
      fontSize={21}
      letterSpacing={1}
      textAnchor={anchor}
      fontFamily={theme.font}
    >
      {label}
    </text>
  </g>
);
