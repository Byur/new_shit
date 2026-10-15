import React from 'react';
import {LAYOUT, theme} from '../theme';
import {allLines} from '../timing';
import {clamp01} from './primitives';

const FADE = 8;

/**
 * The caption band. Every caption is exactly one narration line, and line
 * durations come from the synthesised audio, so text and voice cannot drift.
 * Adjacent lines cross-fade through the short gap between them.
 *
 * The band is reserved for narration for the whole film: the director's brief
 * forbids charts from intruding on it, so diagrams yield space upward instead.
 */
export const Captions: React.FC<{frame: number; hiddenFrom?: number}> = ({frame, hiddenFrom}) => {
  let active = 0;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].startFrame <= frame) active = i;
  }
  const cur = allLines[active];
  const next = allLines[active + 1];
  const blendStart = next ? next.startFrame - FADE : Number.POSITIVE_INFINITY;
  const blend = next ? clamp01((frame - blendStart) / FADE) : 0;
  const hidden = hiddenFrom !== undefined && frame >= hiddenFrom;

  const render = (entry: typeof cur | undefined, opacity: number) => {
    if (!entry || opacity <= 0.01) return null;
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: LAYOUT.caption.top,
          height: LAYOUT.caption.bottom - LAYOUT.caption.top,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: hidden ? 0 : opacity,
          pointerEvents: 'none',
          fontFamily: theme.font,
        }}
      >
        <div
          style={{
            maxWidth: 1520,
            padding: '18px 52px',
            boxSizing: 'border-box',
            borderRadius: 14,
            background: 'rgba(6,10,13,0.84)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 14px 44px rgba(0,0,0,0.55)',
            fontSize: 41,
            lineHeight: 1.38,
            letterSpacing: 0.6,
            color: theme.text,
            textAlign: 'center',
          }}
        >
          {entry.display}
        </div>
      </div>
    );
  };

  return (
    <>
      {render(cur, 1 - blend)}
      {render(next, blend)}
    </>
  );
};

/**
 * The global "this is illustrative" note.
 *
 * The film draws on two very different authorities: figures integrated from the
 * aeroelastic model in `flutter.ts`, and figures that are teaching aids with no
 * measurement behind them. The director's rule is that anything in the second
 * category carries this mark, and it is a single shared component so no act can
 * quietly present a schematic as if it were a computed result.
 *
 * Used for: the heave/torsion subtraction beat, the torsion decay curve, the
 * sliding natural-frequency argument, and the swing metaphor.
 */
export const Illustrative: React.FC<{frame: number; appear: number; opacity?: number}> = ({
  frame,
  appear,
  opacity = 1,
}) => {
  const o = clamp01((frame - appear) / 16) * opacity;
  if (o <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: LAYOUT.width - LAYOUT.safe.right,
        bottom: LAYOUT.height - LAYOUT.safe.bottom,
        fontFamily: theme.font,
        fontSize: 20,
        letterSpacing: 3,
        color: theme.textFaint,
        opacity: o * 0.9,
        pointerEvents: 'none',
      }}
    >
      示意，非模拟输出
    </div>
  );
};

/**
 * The header: the film's argument as a checklist, visible from frame one. The
 * viewer can always see how much of the case is outstanding, and — because
 * `共振解释不通` sits on the list from the start — that resonance is something
 * the film raises in order to demolish rather than a position it holds.
 */
export const Header: React.FC<{
  frame: number;
  claims: ReadonlyArray<{key: string; label: string}>;
  earned: number;
  running: string;
}> = ({frame, claims, earned, running}) => {
  void frame;
  return (
    <div
      style={{
        position: 'absolute',
        left: LAYOUT.safe.left,
        right: LAYOUT.width - LAYOUT.safe.right,
        top: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: theme.font,
        pointerEvents: 'none',
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span style={{fontSize: 27, fontWeight: 600, letterSpacing: 4, color: theme.text}}>风中的桥</span>
        <span style={{fontSize: 17, letterSpacing: 2, color: theme.textFaint}}>{running}</span>
      </div>
      <div style={{display: 'flex', gap: 10}}>
        {claims.map((c, i) => {
          const on = i < earned;
          return (
            <span
              key={c.key}
              style={{
                fontSize: 17,
                letterSpacing: 1.5,
                padding: '6px 13px',
                borderRadius: 999,
                border: `1px solid ${on ? theme.energyEdge : theme.panelEdge}`,
                background: on ? theme.energySoft : 'rgba(255,255,255,0.02)',
                color: on ? theme.energy : theme.textFaint,

              }}
            >
              {c.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** A left-edge progress rail: where in the film we are. */
export const ProgressRail: React.FC<{frame: number; total: number}> = ({frame, total}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 5, height: LAYOUT.height, background: 'rgba(255,255,255,0.045)'}}>
    <div
      style={{
        width: '100%',
        height: `${clamp01(frame / total) * 100}%`,
        background: `linear-gradient(180deg, ${theme.wind}, ${theme.energy})`,
        opacity: 0.6,
      }}
    />
  </div>
);

/**
 * A faint engineering-drawing grid. It appears for analysis and disappears for
 * narrative, which is the film's own signal that a scene has switched register
 * from "something happened" to "here is why".
 */
export const DiagramGrid: React.FC<{opacity: number; step?: number}> = ({opacity, step = 60}) => {
  if (opacity <= 0.01) return null;
  const cols: number[] = [];
  const rows: number[] = [];
  for (let x = LAYOUT.safe.left; x <= LAYOUT.safe.right; x += step) cols.push(x);
  for (let y = LAYOUT.safe.top; y <= LAYOUT.safe.bottom; y += step) rows.push(y);
  return (
    <svg
      width={LAYOUT.width}
      height={LAYOUT.height}
      viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
      style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}
    >
      {cols.map((x) => (
        <line key={`c${x}`} x1={x} x2={x} y1={LAYOUT.safe.top} y2={LAYOUT.safe.bottom} stroke={theme.grid} strokeWidth={1} />
      ))}
      {rows.map((y) => (
        <line key={`r${y}`} x1={LAYOUT.safe.left} x2={LAYOUT.safe.right} y1={y} y2={y} stroke={theme.grid} strokeWidth={1} />
      ))}
    </svg>
  );
};
