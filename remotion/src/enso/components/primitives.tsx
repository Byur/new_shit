import React from 'react';
import {Easing, interpolate, spring} from 'remotion';
import {theme} from '../theme';

/* ------------------------------------------------------------------ */
/* Time                                                               */
/* ------------------------------------------------------------------ */

/** 0 -> 1 entrance progress with a soft ease-out, safe to call every frame. */
export const enter = (frame: number, start: number, duration = 14): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

/** A slight overshoot, for things that should feel placed rather than faded in. */
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

/** Linear (un-eased) version, for cursors that should keep a constant speed. */
export const trackLinear = (frame: number, keys: Array<[number, number]>): number => {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (frame >= f0 && frame <= f1) {
      const t = f1 === f0 ? 0 : (frame - f0) / (f1 - f0);
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
};

/**
 * A single 0->1->0 pulse, used to make a specific word land on a specific
 * object without leaving anything behind.
 */
export const pulse = (frame: number, start: number, up = 8, hold = 10, down = 14): number =>
  interpolate(
    frame,
    [start, start + up, start + up + hold, start + up + hold + down],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)},
  );

/* ------------------------------------------------------------------ */
/* Text backing                                                       */
/* ------------------------------------------------------------------ */

/**
 * A soft vignette placed behind floating text so it stays readable wherever the
 * instrument happens to be underneath, without turning the frame into a deck of
 * opaque cards.
 */
export const textScrim = (align: 'left' | 'center' = 'left'): React.CSSProperties => ({
  background:
    align === 'left'
      ? 'linear-gradient(90deg, rgba(4,7,12,0.95) 0%, rgba(4,7,12,0.9) 58%, rgba(4,7,12,0.4) 86%, rgba(4,7,12,0) 100%)'
      : 'radial-gradient(ellipse 62% 190% at 50% 50%, rgba(4,7,12,0.95) 0%, rgba(4,7,12,0.86) 58%, rgba(4,7,12,0) 100%)',
  padding: '22px 34px',
  borderRadius: 18,
  boxSizing: 'border-box',
});

/* ------------------------------------------------------------------ */
/* Connector layer                                                    */
/* ------------------------------------------------------------------ */

export type Anchor = {x: number; y: number};
export type Box = {left: number; top: number; width: number; height: number};

/**
 * Where a leader line should leave a label box, given where it is going.
 * Anchoring on the box EDGE (not its centre) is what keeps a connector from
 * appearing to pass through the words it is annotating.
 */
export const edgeAnchor = (box: Box, towards: Anchor): Anchor => {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  if (dx === 0 && dy === 0) return {x: cx, y: cy};
  const hw = box.width / 2;
  const hh = box.height / 2;
  // scale the direction vector until it touches the box boundary
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const s = Math.min(sx, sy);
  return {x: cx + dx * s, y: cy + dy * s};
};

/**
 * A leader line from a label box edge to a target, drawn in as `progress` rises
 * and clipped so it can never overshoot its own length.
 */
export const Leader: React.FC<{
  box: Box;
  to: Anchor;
  color: string;
  progress: number;
  dashed?: boolean;
  /** 0..1 extra bow, for routing a line around something */
  bow?: number;
}> = ({box, to, color, progress, dashed, bow = 0}) => {
  const from = edgeAnchor(box, to);
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.y - from.y;
  const dy = to.x - from.x;
  const norm = Math.hypot(dx, dy) || 1;
  const cx = mx + (dx / norm) * bow * 60;
  const cy = my - (dy / norm) * bow * 60;
  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? '7 7' : undefined}
        pathLength={1}
        strokeDashoffset={dashed ? 0 : 1 - progress}
        opacity={0.85}
      />
      {!dashed ? (
        <circle cx={to.x} cy={to.y} r={5.5 * progress} fill="none" stroke={color} strokeWidth={2.4} />
      ) : null}
      <circle cx={to.x} cy={to.y} r={2.4 * progress} fill={color} />
    </g>
  );
};

/** A full-frame SVG layer for connectors, so acts don't each re-declare one. */
export const Overlay: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg
    width={1920}
    height={1080}
    viewBox="0 0 1920 1080"
    style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
  >
    {children}
  </svg>
);

/* ------------------------------------------------------------------ */
/* Callout: a labelled box with a leader back to the thing it names    */
/* ------------------------------------------------------------------ */

export type CalloutProps = {
  frame: number;
  appear: number;
  exitAt?: number;
  box: Box;
  /** absolute screen point this callout is about; omit for a free-floating card */
  anchor?: Anchor;
  color?: string;
  label: string;
  sub?: string;
  /** `value` is rendered large in the money colour */
  value?: string;
  valueUnit?: string;
  emphasis?: number;
  dashed?: boolean;
  /** put the label text on the right of a large value instead of under it */
  compact?: boolean;
  opacity?: number;
  bow?: number;
};

export const Callout: React.FC<CalloutProps> = ({
  frame,
  appear,
  exitAt,
  box,
  anchor,
  color = theme.panelEdge,
  label,
  sub,
  value,
  valueUnit,
  emphasis = 0,
  dashed,
  compact,
  opacity = 1,
  bow = 0,
}) => {
  const p = enter(frame, appear, 13);
  const fade = exitAt === undefined ? 1 : leave(frame, exitAt, 12);
  const a = p * fade * opacity;
  if (a <= 0.01) return null;

  return (
    <>
      {anchor ? (
        <Overlay>
          <Leader box={box} to={anchor} color={color} progress={p} dashed={dashed} bow={bow} />
        </Overlay>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          boxSizing: 'border-box',
          transform: `translateY(${(1 - p) * 8}px) scale(${0.96 + p * 0.04})`,
          transformOrigin: 'left center',
          opacity: a,
          fontFamily: theme.font,
          background: emphasis > 0 ? `${color}20` : 'rgba(6,10,16,0.82)',
          border: `1px solid ${color}`,
          borderLeft: `4px solid ${color}`,
          borderRadius: 10,
          padding: '10px 16px 11px',
          boxShadow:
            emphasis > 0 ? `0 0 ${16 + emphasis * 34}px ${color}55` : '0 10px 30px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'baseline' : 'stretch',
          gap: compact ? 12 : 0,
          justifyContent: 'center',
        }}
      >
        {value ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              order: compact ? 0 : -1,
            }}
          >
            <span
              style={{
                color: theme.price,
                fontSize: 40,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 0.5,
                lineHeight: 1.05,
              }}
            >
              {value}
            </span>
            {valueUnit ? (
              <span style={{color: theme.priceDim, fontSize: 20, letterSpacing: 0.5}}>{valueUnit}</span>
            ) : null}
          </div>
        ) : null}
        <div style={{minWidth: 0}}>
          <div style={{color, fontSize: 24, fontWeight: 700, letterSpacing: 0.8, lineHeight: 1.2}}>
            {label}
          </div>
          {sub ? (
            <div
              style={{
                color: theme.textDim,
                fontSize: 19,
                marginTop: 4,
                lineHeight: 1.32,
                letterSpacing: 0.3,
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */

export const Dot: React.FC<{anchor: Anchor; color: string; progress: number; r?: number}> = ({
  anchor,
  color,
  progress,
  r = 7,
}) => (
  <Overlay>
    <circle cx={anchor.x} cy={anchor.y} r={r * progress} fill={color} opacity={0.95} />
    <circle
      cx={anchor.x}
      cy={anchor.y}
      r={(r * 2.7 + 4) * progress}
      fill="none"
      stroke={color}
      strokeWidth={2}
      opacity={0.45}
    />
  </Overlay>
);

/** A section heading that sits inside the stage rather than the header bar. */
export const StageKicker: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  text: string;
  color?: string;
  size?: number;
}> = ({frame, appear, exitAt, left, top, text, color = theme.text, size = 27}) => {
  const p = enter(frame, appear, 12);
  const fade = exitAt === undefined ? 1 : leave(frame, exitAt, 12);
  if (p * fade <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        fontFamily: theme.font,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: 2.5,
        color,
        opacity: p * fade,
        transform: `translateX(${(1 - p) * -12}px)`,
        textShadow: '0 2px 18px rgba(0,0,0,0.85)',
      }}
    >
      {text}
    </div>
  );
};

/** A thin labelled rule, for axes and thresholds. */
export const Rule: React.FC<{
  x1: number;
  x2: number;
  y: number;
  color: string;
  progress?: number;
  width?: number;
  dashed?: boolean;
  label?: string;
  labelSide?: 'left' | 'right';
}> = ({x1, x2, y, color, progress = 1, width = 1.5, dashed, label, labelSide = 'left'}) => (
  <Overlay>
    <line
      x1={x1}
      x2={x1 + (x2 - x1) * progress}
      y1={y}
      y2={y}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? '6 6' : undefined}
      opacity={0.9}
    />
    {label ? (
      <text
        x={labelSide === 'left' ? x1 : x1 + (x2 - x1) * progress}
        y={y - 8}
        textAnchor={labelSide === 'left' ? 'start' : 'end'}
        fill={color}
        fontFamily={theme.font}
        fontSize={17}
        opacity={progress}
      >
        {label}
      </text>
    ) : null}
  </Overlay>
);
