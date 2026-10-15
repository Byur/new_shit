import React from 'react';
import {Easing, interpolate} from 'remotion';
import type {SchematicPath} from '../facts';
import {theme} from '../theme';
import {enter} from './primitives';

/**
 * A drawn price path, with its own honesty label.
 *
 * Historical intraday quotes are not available to this project, so these curves
 * are SHAPES reconstructed from the literature — anchored on the two or three
 * points that a source actually states, and interpolated in between. The
 * component therefore refuses to be ambiguous about it: `示意路径` is part of
 * the panel, not a footnote, and `anchors` are the values a viewer could check.
 *
 * Measured 2026 levels are printed as numbers elsewhere, never as a drawn
 * historical curve.
 */
export const PricePanel: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  box: {left: number; top: number; width: number; height: number};
  path: SchematicPath;
  /** 0..1 draw-in of the curve */
  progress: number;
  /** index into `path.points` to emphasise, if any */
  emphasisIndex?: number;
  /** a second series drawn for comparison, normalised to the same box */
  compare?: {points: Array<[number, number]>; color: string; label: string};
  accent?: string;
  /** override the provenance chip; measured series say so instead of 示意 */
  badge?: string;
}> = ({frame, appear, exitAt, box, path, progress, emphasisIndex, compare, accent = theme.price, badge}) => {
  const p = enter(frame, appear, 14);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - 12, exitAt], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.cubic),
        });
  const a = p * fade;
  if (a <= 0.01) return null;

  const padL = 58;
  const padR = 22;
  const padT = 52;
  const padB = 42;
  const w = box.width - padL - padR;
  const h = box.height - padT - padB;

  const allValues = [...path.points.map(([, v]) => v), ...(compare?.points.map(([, v]) => v) ?? [])];
  const vMin = Math.min(...allValues);
  const vMax = Math.max(...allValues);
  const span = vMax - vMin || 1;
  const lo = vMin - span * 0.12;
  const hi = vMax + span * 0.12;

  const X = (t: number) => box.left + padL + t * w;
  const Y = (v: number) => box.top + padT + (1 - (v - lo) / (hi - lo)) * h;

  const lineOf = (pts: Array<[number, number]>) =>
    pts.map(([t, v], i) => `${i === 0 ? 'M' : 'L'} ${X(t)} ${Y(v)}`).join(' ');

  /* the draw-in clip spans the plot; progress reveals it left to right */
  const clipId = `pp-clip-${path.key}-${Math.round(box.left)}`;

  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        boxSizing: 'border-box',
        opacity: a,
        transform: `translateY(${(1 - p) * 10}px)`,
        background: 'rgba(6,10,16,0.82)',
        border: `1px solid ${theme.panelEdge}`,
        borderRadius: 12,
        fontFamily: theme.font,
      }}
    >
      {/*
        The panel div is already offset to `box`, so the drawing surface is
        pulled back by the same amount: that makes viewBox coordinates equal
        frame coordinates, and the box.left/box.top maths above stay literal.
        Anchoring it at `inset: 0` instead would translate every mark by
        another box.left to the right.
      */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{
          position: 'absolute',
          left: -box.left,
          top: -box.top,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={box.left + padL - 4}
              y={box.top + 4}
              width={(w + 8) * Math.max(0, Math.min(1, progress))}
              height={box.height - 8}
            />
          </clipPath>
        </defs>

        {/* gridlines at the axis extremes */}
        {[0, 0.5, 1].map((f) => {
          const v = lo + (hi - lo) * f;
          const y = Y(v);
          return (
            <g key={f}>
              <line
                x1={box.left + padL - 4}
                x2={box.left + box.width - padR}
                y1={y}
                y2={y}
                stroke={theme.grid}
                strokeWidth={1}
              />
              <text
                x={box.left + padL - 12}
                y={y + 5}
                textAnchor="end"
                fill={theme.textGhost}
                fontFamily={theme.mono}
                fontSize={14}
              >
                {v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v < 10 ? 2 : 0)}
              </text>
            </g>
          );
        })}

        {/* comparison series */}
        {compare ? (
          <g clipPath={`url(#${clipId})`} opacity={0.8}>
            <path
              d={lineOf(compare.points)}
              fill="none"
              stroke={compare.color}
              strokeWidth={2}
              strokeDasharray="7 6"
            />
          </g>
        ) : null}

        {/* the main path, area + line */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={`${lineOf(path.points)} L ${X(path.points[path.points.length - 1][0])} ${box.top + padT + h} L ${X(path.points[0][0])} ${box.top + padT + h} Z`}
            fill={`${accent}1F`}
          />
          <path d={lineOf(path.points)} fill="none" stroke={accent} strokeWidth={3} strokeLinejoin="round" />
        </g>

        {/* anchor markers — the values a viewer could actually check */}
        {path.points.map(([t, v], i) => {
          const on = emphasisIndex === i;
          const dotA = progress >= t - 0.001 ? 1 : 0;
          if (dotA <= 0) return null;
          return (
            <g key={i}>
              <circle cx={X(t)} cy={Y(v)} r={on ? 6.5 : 4} fill={accent} />
              {on ? (
                <circle cx={X(t)} cy={Y(v)} r={13} fill="none" stroke={accent} strokeWidth={1.8} opacity={0.6} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* title, unit, year axis, and the honesty label */}
      <div
        style={{
          position: 'absolute',
          left: 18,
          top: 12,
          color: theme.text,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        {path.title}
        <span style={{color: theme.textFaint, fontWeight: 400, fontSize: 16, marginLeft: 10}}>
          {path.unit}
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 13,
          color: theme.textGhost,
          fontSize: 14,
          letterSpacing: 1,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 5,
          padding: '2px 8px',
        }}
      >
        {badge ?? '示意路径 · 非逐日报价'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: box.left + padL,
          bottom: 14,
          color: theme.textFaint,
          fontFamily: theme.mono,
          fontSize: 15,
        }}
      >
        {path.from}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 22,
          bottom: 14,
          color: theme.textFaint,
          fontFamily: theme.mono,
          fontSize: 15,
        }}
      >
        {path.to}
      </div>
    </div>
  );
};

/**
 * The two anchor values a drawn curve is pinned to, printed so the shape can be
 * checked against a source without leaving the frame.
 */
export const Anchors: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  path: SchematicPath;
  width?: number;
}> = ({frame, appear, exitAt, left, top, path, width = 420}) => {
  const p = enter(frame, appear, 14);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - 12, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        opacity: p * fade,
        fontFamily: theme.font,
      }}
    >
      {path.anchors.map((a) => (
        <div
          key={a.at}
          style={{display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 7}}
        >
          <span style={{color: theme.textFaint, fontSize: 17}}>{a.at}</span>
          <span
            style={{
              color: theme.price,
              fontSize: 18,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {a.value}
          </span>
        </div>
      ))}
      <div style={{color: theme.textGhost, fontSize: 14, lineHeight: 1.45, marginTop: 2}}>
        据：{path.basis}
      </div>
    </div>
  );
};
