import React from 'react';
import {monthToCalendar} from '../oni';
import {LAYOUT, theme} from '../theme';
import {enter} from './primitives';

/**
 * The chrome. It carries three things and nothing else:
 *
 *   - which chapter the viewer is in,
 *   - the source of whatever is on screen right now (so a figure can always be
 *     traced),
 *   - and a standing disclosure of how to read the section, because the section
 *     is a diagram, not a photograph.
 *
 * The live ONI readout deliberately lives on the strip, not here, so the number
 * and the curve it belongs to are never separated.
 */
export const Header: React.FC<{
  frame: number;
  chapter: string;
  chapterIndex: number;
  chapterCount: number;
  source: string;
  /** the ONI value being shown, for the phase chip; null hides the chip */
  oni: number | null;
}> = ({frame, chapter, chapterIndex, chapterCount, source, oni}) => {
  const isWarm = (oni ?? 0) >= 0;
  const chipColor = oni === null ? theme.neutral : isWarm ? theme.warm : theme.cold;

  return (
    <div
      style={{
        position: 'absolute',
        left: LAYOUT.header.left,
        right: 1920 - LAYOUT.header.right,
        top: LAYOUT.header.top,
        pointerEvents: 'none',
        fontFamily: theme.font,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
          <span style={{color: theme.text, fontSize: 27, fontWeight: 700, letterSpacing: 1.5}}>
            厄尔尼诺与拉尼娜
          </span>
          <span style={{color: theme.textFaint, fontSize: 17, letterSpacing: 1}}>
            一台重新分配降雨的机器
          </span>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: enter(frame, 20, 20)}}>
          <span
            style={{
              color: theme.textFaint,
              fontSize: 15,
              border: `1px solid ${theme.panelEdge}`,
              borderRadius: 999,
              padding: '4px 12px',
              letterSpacing: 0.6,
            }}
          >
            {source}
          </span>
          <span
            style={{
              color: theme.textGhost,
              fontSize: 15,
              border: `1px solid rgba(255,255,255,0.06)`,
              borderRadius: 999,
              padding: '4px 12px',
              letterSpacing: 0.6,
            }}
          >
            剖面色带为示意模型 · 位置与强度按真实海温指数驱动
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 10,
          height: 30,
          opacity: enter(frame, 8, 16),
        }}
      >
        <span style={{color: theme.textFaint, fontFamily: theme.mono, fontSize: 15, letterSpacing: 1}}>
          {String(chapterIndex + 1).padStart(2, '0')}/{String(chapterCount).padStart(2, '0')}
        </span>
        <span
          style={{
            width: 26,
            height: 2,
            background: chipColor,
            opacity: 0.8,
          }}
        />
        <span style={{color: theme.textDim, fontSize: 19, letterSpacing: 2, fontWeight: 600}}>
          {chapter}
        </span>

        {oni !== null ? (
          <span
            style={{
              marginLeft: 8,
              color: chipColor,
              fontSize: 16,
              border: `1px solid ${chipColor}66`,
              background: `${chipColor}14`,
              borderRadius: 6,
              padding: '2px 10px',
              letterSpacing: 0.8,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isWarm ? '厄尔尼诺相位' : '拉尼娜相位'} · {isWarm ? '+' : '−'}
            {Math.abs(oni).toFixed(2)} °C
          </span>
        ) : (
          <span
            style={{
              marginLeft: 8,
              color: theme.textFaint,
              fontSize: 16,
              border: `1px solid ${theme.panelEdge}`,
              borderRadius: 6,
              padding: '2px 10px',
              letterSpacing: 0.8,
            }}
          >
            常年状态
          </span>
        )}
      </div>
    </div>
  );
};

/** A negative-value-safe clamp used by the strip labels. */
export const monthLabel = (month: number): string => {
  const c = monthToCalendar(Math.round(month));
  return `${c.year}-${String(c.month).padStart(2, '0')}`;
};
