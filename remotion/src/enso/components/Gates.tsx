import React from 'react';
import {GATES} from '../facts';
import {theme} from '../theme';
import {enter} from './primitives';

/**
 * The four gates.
 *
 * This is the film's only portable artefact: the thing a viewer is meant to be
 * able to carry out of the video and apply to a forecast they meet later. It is
 * therefore built once and reused, and its wording never changes between its
 * first appearance and the recap — a tool that gets rephrased is not a tool.
 *
 * `state` is what makes it an argument rather than a list: a gate that is open
 * for a given case is drawn open, and a gate that is shut is drawn shut, so the
 * same object can explain both why coffee fell and why rice rose.
 */

export type GateState = 'neutral' | 'open' | 'shut';

export const Gates: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  box: {left: number; top: number; width: number};
  /** how many gates have been introduced so far, 0..4 */
  lit: number;
  /** per-gate verdict for the case on screen */
  states?: GateState[];
  /** show the "if this gate is shut" counter-case text */
  showCounter?: boolean;
  /** emphasise the gate the narration is currently on */
  focus?: number | null;
  compact?: boolean;
  title?: string;
}> = ({frame, appear, exitAt, box, lit, states, showCounter = false, focus = null, compact = false, title}) => {
  const rowH = compact ? 74 : 92;
  const gap = compact ? 8 : 12;

  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        opacity: enter(frame, appear, 14),
        fontFamily: theme.font,
      }}
    >
      {title ? (
        <div
          style={{
            color: theme.textFaint,
            fontSize: 18,
            letterSpacing: 3,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      ) : null}

      {GATES.map((g, i) => {
        const on = i < lit;
        const st: GateState = states?.[i] ?? 'neutral';
        const isFocus = focus === i;
        const accent =
          st === 'open' ? theme.wet : st === 'shut' ? theme.dry : on ? theme.price : theme.textGhost;
        const rowAppear = appear + i * 5;
        const p = enter(frame, rowAppear, 12);
        const fade =
          exitAt === undefined
            ? 1
            : Math.max(0, Math.min(1, (exitAt - frame) / 12));

        return (
          <div
            key={g.n}
            style={{
              position: 'relative',
              height: rowH,
              marginBottom: gap,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '10px 18px',
              borderRadius: 10,
              background: isFocus ? `${accent}1C` : 'rgba(255,255,255,0.022)',
              border: `1px solid ${isFocus ? accent : theme.panelEdge}`,
              borderLeft: `4px solid ${on ? accent : 'rgba(255,255,255,0.1)'}`,
              opacity: p * fade * (on ? 1 : 0.4),
              transform: `translateX(${(1 - p) * -14}px)`,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                flex: '0 0 40px',
                borderRadius: 40,
                border: `2px solid ${on ? accent : 'rgba(255,255,255,0.14)'}`,
                color: on ? accent : theme.textGhost,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 21,
                fontWeight: 700,
              }}
            >
              {['①', '②', '③', '④'][i]}
            </div>

            <div style={{flex: 1, minWidth: 0}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
                <span style={{color: on ? theme.text : theme.textGhost, fontSize: 24, fontWeight: 700, letterSpacing: 1.5}}>
                  {g.title}
                </span>
                {st !== 'neutral' ? (
                  <span
                    style={{
                      color: accent,
                      fontSize: 16,
                      border: `1px solid ${accent}77`,
                      borderRadius: 5,
                      padding: '1px 8px',
                      letterSpacing: 1,
                    }}
                  >
                    {st === 'open' ? '已打开' : '关着'}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  color: on ? theme.textDim : theme.textGhost,
                  fontSize: compact ? 18 : 20,
                  marginTop: 4,
                  lineHeight: 1.3,
                }}
              >
                {g.question}
              </div>
              {showCounter && on ? (
                <div style={{color: theme.textGhost, fontSize: 16, marginTop: 3, lineHeight: 1.3}}>
                  这一关的处理：{g.counterCase}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
