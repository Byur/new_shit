import React from 'react';
import {L} from '../timing';
import {enter, leave} from '../components/primitives';
import {theme} from '../theme';

const ROWS = [
  {label: '产地', value: '埃塞俄比亚 · 耶加雪菲', color: theme.text, key: false},
  {label: '品种', value: 'Heirloom 地方种', color: theme.bred, key: true},
  {label: '海拔', value: '2050 m', color: theme.altitude, key: true},
  {label: '处理法', value: '水洗', color: theme.washed, key: true},
];

/**
 * The hook turns the bag around. Everything the film will argue is already
 * printed on the back of the bag; the act's job is to make the viewer notice
 * that the line they read first is the one that explains the least.
 */
export const Hook: React.FC<{frame: number}> = ({frame}) => {
  const inT = enter(frame, L('hook', 0) - 4, 18);
  const outT = leave(frame, L('hook', 6) + 6, 20);
  const op = Math.min(inT, outT);
  if (op <= 0.01) return null;

  const frontEmphasis = 1 - enter(frame, L('hook', 3), 18);
  const strike = enter(frame, L('hook', 4), 20);
  const lift = enter(frame, L('hook', 5), 26);

  const x = 232 - lift * 60;
  const y = 214 - lift * 40;
  const w = 812 - lift * 120;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: op,
        fontFamily: theme.font,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: x - 40,
          top: y - 40,
          width: w + 80,
          padding: '28px 40px 34px',
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, rgba(24,17,11,0.96) 0%, rgba(16,11,7,0.96) 100%)',
          borderRadius: 20,
          border: `1px solid ${theme.panelEdge}`,
          boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
          transform: `scale(${1 - lift * 0.05})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          style={{
            color: theme.textFaint,
            fontSize: 19,
            letterSpacing: 6,
            marginBottom: 22,
            opacity: enter(frame, L('hook', 0) + 10, 16),
          }}
        >
          SINGLE ORIGIN · 250 g
        </div>

        {ROWS.map((row, i) => {
          const appear = i === 0 ? L('hook', 0) + 8 : L('hook', 1) + 4 + i * 9;
          const t = enter(frame, appear, 16);
          const isFront = !row.key;
          const dim = isFront ? frontEmphasis : 1 - frontEmphasis;
          const alpha = 0.34 + 0.66 * dim;
          return (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 22,
                marginBottom: 20,
                opacity: t * (row.key ? 1 : 1 - strike * 0.55),
                transform: `translateY(${(1 - t) * 10 + (row.key ? -lift * 22 : 0)}px)`,
              }}
            >
              <span
                style={{
                  width: 108,
                  color: row.key ? theme.textFaint : theme.textDim,
                  fontSize: 22,
                  letterSpacing: 4,
                  flexShrink: 0,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  position: 'relative',
                  color: row.color,
                  fontSize: isFront ? 40 : 34,
                  fontWeight: isFront ? 700 : 500,
                  opacity: alpha,
                  letterSpacing: 1,
                }}
              >
                {row.value}
                {!row.key ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: -6,
                      right: -6,
                      top: '52%',
                      height: 3,
                      background: theme.robusta,
                      transform: `scaleX(${strike})`,
                      transformOrigin: 'left center',
                      opacity: 0.85,
                    }}
                  />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      {/* the three that survive the hook become the spine of the whole film */}
      <div
        style={{
          position: 'absolute',
          left: 232,
          top: 620,
          opacity: enter(frame, L('hook', 5) + 6, 20) * (1 - lift * 0.0),
          color: theme.textDim,
          fontSize: 25,
          letterSpacing: 2,
          lineHeight: 1.7,
        }}
      >
        <div style={{opacity: enter(frame, L('hook', 7) - 20, 20), color: theme.text, fontSize: 30}}>
          产地只是一个缩写。后面三行，才是可以推的。
        </div>
      </div>
    </div>
  );
};
