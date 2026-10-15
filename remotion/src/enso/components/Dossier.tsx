import React from 'react';
import {Easing, interpolate} from 'remotion';
import {theme} from '../theme';
import {enter} from './primitives';

/**
 * The pieces the four historical dossiers share.
 *
 * Each dossier asks the same three questions in the same order — what moved,
 * what physically caused it, and which gate decided whether it reached a price
 * — so the furniture is shared and only the content differs. That is what lets
 * a viewer compare 1972 with 2011 instead of collecting two stories.
 */

/* ------------------------------------------------------------------ */
/* A causal chain, revealed one link at a time                         */
/* ------------------------------------------------------------------ */

export const Chain: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  links: string[];
  color?: string;
  /** frames between successive links */
  step?: number;
  width?: number;
  orientation?: 'row' | 'column';
  /** highlight the link the narration is currently on */
  focus?: number | null;
}> = ({frame, appear, exitAt, left, top, links, color = theme.price, step = 16, width = 1620, orientation = 'row', focus = null}) => {
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - 12, exitAt], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.cubic),
        });
  if (fade <= 0.01) return null;

  const isRow = orientation === 'row';
  const gapCount = links.length - 1;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: isRow ? width : undefined,
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        alignItems: 'stretch',
        gap: isRow ? 0 : 8,
        opacity: fade,
        fontFamily: theme.font,
      }}
    >
      {links.map((l, i) => {
        const p = enter(frame, appear + i * step, 12);
        const on = focus === null || focus === i;
        if (p <= 0.01) {
          return isRow ? (
            <div key={l} style={{flex: 1}} />
          ) : (
            <div key={l} style={{height: 46}} />
          );
        }
        return (
          <React.Fragment key={l}>
            {i > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isRow ? 34 : undefined,
                  height: isRow ? undefined : 18,
                  flex: isRow ? '0 0 34px' : undefined,
                  opacity: enter(frame, appear + i * step, 10),
                  color,
                }}
              >
                {isRow ? (
                  <svg width={30} height={16} viewBox="0 0 30 16">
                    <line x1={0} y1={8} x2={20} y2={8} stroke={color} strokeWidth={2} />
                    <path d="M 20 3 L 29 8 L 20 13 Z" fill={color} />
                  </svg>
                ) : (
                  <svg width={16} height={16} viewBox="0 0 16 16">
                    <line x1={8} y1={0} x2={8} y2={10} stroke={color} strokeWidth={2} />
                    <path d="M 3 9 L 8 16 L 13 9 Z" fill={color} />
                  </svg>
                )}
              </div>
            ) : null}
            <div
              style={{
                flex: isRow ? 1 : undefined,
                minWidth: 0,
                boxSizing: 'border-box',
                padding: isRow ? '12px 14px' : '9px 14px',
                borderRadius: 9,
                background: on ? `${color}18` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${on ? color : theme.panelEdge}`,
                opacity: p * (focus === null || on ? 1 : 0.4),
                transform: `translateY(${(1 - p) * 8}px)`,
              }}
            >
              <div
                style={{
                  color: on ? theme.text : theme.textDim,
                  fontSize: isRow ? 20 : 19,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  letterSpacing: 0.4,
                }}
              >
                {l}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {!isRow && gapCount < 0 ? null : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* A big number with its provenance                                    */
/* ------------------------------------------------------------------ */

export const Stat: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  width?: number;
  value: string;
  unit?: string;
  label: string;
  sub?: string;
  color?: string;
  /** emphasise the number with a glow for one beat */
  flash?: number;
}> = ({frame, appear, exitAt, left, top, width = 330, value, unit, label, sub, color = theme.price, flash = 0}) => {
  const p = enter(frame, appear, 13);
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
        transform: `translateY(${(1 - p) * 9}px)`,
        borderLeft: `4px solid ${color}`,
        background: 'rgba(6,10,16,0.8)',
        borderRadius: '0 10px 10px 0',
        padding: '11px 16px 12px',
        boxSizing: 'border-box',
        fontFamily: theme.font,
        boxShadow: flash > 0 ? `0 0 ${18 + flash * 40}px ${color}44` : undefined,
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 7}}>
        <span
          style={{
            color,
            fontSize: 42,
            fontWeight: 700,
            lineHeight: 1.02,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 0.4,
          }}
        >
          {value}
        </span>
        {unit ? <span style={{color: `${color}AA`, fontSize: 19}}>{unit}</span> : null}
      </div>
      <div style={{color: theme.text, fontSize: 20, marginTop: 5, lineHeight: 1.28, fontWeight: 600}}>
        {label}
      </div>
      {sub ? (
        <div style={{color: theme.textFaint, fontSize: 16, marginTop: 3, lineHeight: 1.38}}>{sub}</div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* A horizontal share bar: how much of the world one place supplies    */
/* ------------------------------------------------------------------ */

export const ShareBar: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  width: number;
  label: string;
  who: string;
  share: number;
  of: string;
  color: string;
  progress: number;
}> = ({frame, appear, exitAt, left, top, width, label, who, share, of, color, progress}) => {
  const p = enter(frame, appear, 13);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - 12, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  const filled = width * (share / 100) * Math.max(0, Math.min(1, progress));

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
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <span style={{color: theme.text, fontSize: 21, fontWeight: 700}}>{label}</span>
        <span style={{color: theme.textFaint, fontSize: 17}}>{who}</span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 26,
          marginTop: 7,
          borderRadius: 5,
          background: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: filled,
            background: `linear-gradient(90deg, ${color}CC, ${color}77)`,
            borderRight: `2px solid ${color}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            color: theme.text,
            fontSize: 17,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {share}%
          <span style={{color: theme.textFaint, fontWeight: 400, marginLeft: 7, fontSize: 15}}>{of}</span>
        </div>
      </div>
    </div>
  );
};

/** A left-aligned label used to name the region a dossier is about. */
export const Kicker: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  text: string;
  color?: string;
  size?: number;
}> = ({frame, appear, exitAt, left, top, text, color = theme.text, size = 30}) => {
  const p = enter(frame, appear, 12);
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
        opacity: p * fade,
        transform: `translateX(${(1 - p) * -12}px)`,
        fontFamily: theme.font,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: 2.4,
        color,
      }}
    >
      {text}
    </div>
  );
};
