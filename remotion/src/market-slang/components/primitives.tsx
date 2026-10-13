import React from 'react';
import {Easing, interpolate, spring} from 'remotion';
import {LAYOUT, theme} from '../theme';

/** 0 -> 1 entrance progress with a soft overshoot, safe to call every frame. */
export const enter = (frame: number, start: number, duration = 14): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

export const pop = (frame: number, start: number, damping = 14): number =>
  spring({frame: frame - start, fps: 30, config: {damping, mass: 0.6, stiffness: 120}});

export const leave = (frame: number, end: number, duration = 12): number =>
  interpolate(frame, [end - duration, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });

export const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * Piecewise eased keyframe track. Anything driven by narration timing goes
 * through this so beats stay locked to the spoken line they belong to.
 */
export const track = (frame: number, keys: Array<[number, number]>): number => {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (frame >= f0 && frame <= f1) {
      const t = f1 === f0 ? 0 : (frame - f0) / (f1 - f0);
      return v0 + (v1 - v0) * smooth(t);
    }
  }
  return keys[keys.length - 1][1];
};

/* ------------------------------------------------------------------ */
/* Connector layer                                                     */
/* ------------------------------------------------------------------ */

export type Anchor = {x: number; y: number};

/**
 * A soft vignette placed behind floating text so it stays readable wherever the
 * chart happens to be underneath, without turning the frame into a deck of
 * opaque cards.
 */
export const textScrim = (align: 'left' | 'center' = 'left'): React.CSSProperties => ({
  background:
    align === 'left'
      ? 'linear-gradient(90deg, rgba(6,9,13,0.95) 0%, rgba(6,9,13,0.9) 58%, rgba(6,9,13,0.42) 86%, rgba(6,9,13,0) 100%)'
      : 'radial-gradient(ellipse 62% 190% at 50% 50%, rgba(6,9,13,0.95) 0%, rgba(6,9,13,0.86) 58%, rgba(6,9,13,0) 100%)',
  padding: '22px 34px',
  borderRadius: 18,
  boxSizing: 'border-box',
});

const Connector: React.FC<{
  from: Anchor;
  to: Anchor;
  color: string;
  progress: number;
  dashed?: boolean;
}> = ({from, to, color, progress, dashed}) => {
  const elbowX = from.x + (to.x - from.x) * 0.45;
  const d = `M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${to.y} L ${to.x} ${to.y}`;
  const length = Math.abs(elbowX - from.x) + Math.abs(to.y - from.y) + Math.abs(to.x - elbowX);
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? '7 7' : `${length} ${length}`}
        strokeDashoffset={dashed ? 0 : length * (1 - progress)}
        opacity={0.85}
      />
      <circle cx={to.x} cy={to.y} r={5.5 * progress} fill="none" stroke={color} strokeWidth={2.4} />
      <circle cx={to.x} cy={to.y} r={2.2 * progress} fill={color} />
    </g>
  );
};

/* ------------------------------------------------------------------ */
/* Tag: a label pinned to a point on the chart                          */
/* ------------------------------------------------------------------ */

type TagProps = {
  frame: number;
  appear: number;
  /** absolute screen position of the label box (left edge, top edge) */
  box: {left: number; top: number; width: number};
  /** the chart point this label is about, in absolute screen coordinates */
  anchor: Anchor;
  color: string;
  label: string;
  sub?: string;
  side?: 'left' | 'right';
  align?: 'left' | 'right' | 'center';
  /** 0..1 extra emphasis pulse */
  emphasis?: number;
  dashed?: boolean;
  big?: boolean;
  exitAt?: number;
};

export const Tag: React.FC<TagProps> = ({
  frame,
  appear,
  box,
  anchor,
  color,
  label,
  sub,
  side = 'right',
  align = 'left',
  emphasis = 0,
  dashed,
  big = false,
  exitAt,
}) => {
  const p = enter(frame, appear, 13);
  const fade = exitAt === undefined ? 1 : leave(frame, exitAt, 12);
  if (p <= 0 || fade <= 0) return null;

  const from: Anchor = {
    x: side === 'right' ? box.left + box.width : box.left,
    y: box.top + (big ? 34 : 26),
  };

  /*
   * The anchor rides the chart, so a pan can push it past the plot. Keeping it
   * inside means a connector never trails off toward the frame edge.
   */
  const to: Anchor = {
    x: Math.max(LAYOUT.plot.left, Math.min(LAYOUT.plot.right, anchor.x)),
    y: Math.max(LAYOUT.plot.top, Math.min(LAYOUT.plot.bottom, anchor.y)),
  };

  return (
    <>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        <Connector from={from} to={to} color={color} progress={p} dashed={dashed} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          boxSizing: 'border-box',
          transform: `translateX(${(1 - p) * (side === 'right' ? -14 : 14)}px) scale(${0.94 + p * 0.06})`,
          transformOrigin: side === 'right' ? 'left center' : 'right center',
          opacity: p * fade,
          textAlign: align,
          fontFamily: theme.font,
          background: emphasis > 0 ? `${color}22` : 'rgba(10,13,18,0.72)',
          border: `1px solid ${color}`,
          borderLeft: `5px solid ${color}`,
          borderRadius: 10,
          padding: big ? '12px 20px' : '9px 16px',
          boxShadow: emphasis > 0 ? `0 0 ${18 + emphasis * 30}px ${color}55` : 'none',
        }}
      >
        <div
          style={{
            color,
            fontSize: big ? 40 : 30,
            fontWeight: 700,
            letterSpacing: 1,
            lineHeight: 1.15,
          }}
        >
          {label}
        </div>
        {sub ? (
          <div
            style={{
              color: theme.textDim,
              fontSize: big ? 24 : 20,
              marginTop: 5,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Small chart-anchored marker                                         */
/* ------------------------------------------------------------------ */

export const Dot: React.FC<{anchor: Anchor; color: string; progress: number; r?: number}> = ({
  anchor,
  color,
  progress,
  r = 8,
}) => (
  <svg
    width={LAYOUT.width}
    height={LAYOUT.height}
    viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
    style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
  >
    <circle cx={anchor.x} cy={anchor.y} r={r * progress} fill={color} opacity={0.9} />
    <circle cx={anchor.x} cy={anchor.y} r={r * 2.6 * progress} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
  </svg>
);

/** Horizontal price ruler used for "this band" annotations. */
export const PriceBand: React.FC<{
  y: number;
  left: number;
  right: number;
  color: string;
  progress: number;
  label?: string;
}> = ({y, left, right, color, progress, label}) => (
  <svg
    width={LAYOUT.width}
    height={LAYOUT.height}
    viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
    style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
  >
    <line
      x1={left}
      x2={left + (right - left) * progress}
      y1={y}
      y2={y}
      stroke={color}
      strokeWidth={2.5}
      strokeDasharray="10 7"
      opacity={0.85}
    />
    {label ? (
      <text
        x={left + 6}
        y={y - 12}
        fill={color}
        fontFamily={theme.font}
        fontSize={21}
        opacity={progress}
      >
        {label}
      </text>
    ) : null}
  </svg>
);
