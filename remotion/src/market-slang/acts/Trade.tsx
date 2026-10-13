import React from 'react';
import {View} from '../camera';
import {candles, EVENTS} from '../chart';
import {makeProjector} from '../components/ChartCanvas';
import {enter, textScrim, track} from '../components/primitives';
import {line, sceneStart} from '../timing';
import {LAYOUT, PLOT_H, PLOT_W, theme} from '../theme';

const priceAt = (day: number): number =>
  candles[Math.max(0, Math.min(candles.length - 1, Math.round(day)))].close;

const L = (n: number) => line('trade', n).startFrame;

const PANEL = {left: 150, top: 632, width: 390};

/**
 * A holder is a physical position parked at a cost price. It is presented as a
 * panel staked to a point on the chart, so it never wanders off screen when the
 * camera pans, and it never covers the candle it is talking about.
 */
const HolderPanel: React.FC<{
  anchor: {x: number; y: number};
  color: string;
  name: string;
  detail: string;
  status: string;
  opacity: number;
  emphasis?: number;
}> = ({anchor, color, name, detail, status, opacity, emphasis = 0}) => {
  if (opacity <= 0.01) return null;

  /* the anchor rides the chart, so a pan can push it out of the plot */
  const ax = Math.max(LAYOUT.plot.left, Math.min(LAYOUT.plot.right, anchor.x));
  const ay = Math.max(LAYOUT.plot.top, Math.min(LAYOUT.plot.bottom, anchor.y));

  const exitRight = ax > PANEL.left + PANEL.width;
  const from = exitRight
    ? {x: PANEL.left + PANEL.width, y: PANEL.top + 44}
    : {x: PANEL.left + PANEL.width * 0.5, y: PANEL.top};
  const elbowX = from.x + (ax - from.x) * 0.42;

  return (
    <>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity}}
      >
        {exitRight ? (
          <path
            d={`M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${ay} L ${ax} ${ay}`}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            opacity={0.85}
          />
        ) : (
          <path
            d={`M ${from.x} ${from.y} L ${from.x} ${ay} L ${ax} ${ay}`}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            opacity={0.85}
          />
        )}
        <circle cx={ax} cy={ay} r={6} fill="none" stroke={color} strokeWidth={2.4} />
        <circle cx={ax} cy={ay} r={2.6} fill={color} />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: PANEL.left,
          top: PANEL.top,
          width: PANEL.width,
          opacity,
          transform: `translateY(${(1 - opacity) * 14}px)`,
          fontFamily: theme.font,
          background: 'rgba(9,12,17,0.93)',
          border: `2px solid ${color}`,
          borderRadius: 14,
          padding: '14px 20px',
          boxShadow:
            emphasis > 0
              ? `0 0 ${16 + emphasis * 30}px ${color}66`
              : '0 12px 34px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: color,
              display: 'inline-block',
            }}
          />
          <span style={{color: theme.text, fontSize: 28, fontWeight: 700}}>{name}</span>
          <span style={{color: theme.textDim, fontSize: 21, fontFamily: theme.mono}}>{detail}</span>
        </div>
        <div style={{color, fontSize: 26, marginTop: 10, fontWeight: 700, letterSpacing: 1}}>
          {status}
        </div>
      </div>
    </>
  );
};

export const Trade: React.FC<{frame: number; view: View}> = ({frame, view}) => {
  const p = makeProjector(view);

  const buyFrame = L(4);
  const holderDay = track(frame, [
    [buyFrame, 22],
    [L(5), 22],
    [L(5) + Math.round(line('trade', 5).frames * 0.5), EVENTS.peakDay],
    [L(6), EVENTS.lowDay],
    [L(16), EVENTS.lowDay],
    [L(17) + 22, 152],
    [L(20), 152],
  ]);

  const cost = 10.0;
  const mark = priceAt(holderDay);
  const pnl = (mark - cost) / cost;
  const underwater = mark < cost;

  const blockIn = enter(frame, buyFrame + 4, 14);
  const gapIn = enter(frame, L(6), 14);
  const thesisOut = enter(frame, L(4) + 6, 14);
  const heIn = enter(frame, L(13), 14);

  const bx = p.x(holderDay);
  const by = p.y(cost);
  const marketY = p.y(mark);
  const costLineEnd = frame >= L(10) ? Math.min(holderDay, EVENTS.lowDay) : holderDay;

  const statusFor = (): string => {
    if (frame < L(6)) return '刚买完';
    if (frame < L(10)) return `浮亏 ${(pnl * 100).toFixed(1)}% · 套牢`;
    if (frame < L(12)) return '卖出 8.16';
    return `已了结 · 实亏 ${(pnl * 100).toFixed(1)}%`;
  };

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      {/* ---- chart-anchored geometry, clipped to the plot ---------------- */}
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        <defs>
          <clipPath id="tradePlotClip">
            <rect x={LAYOUT.plot.left} y={LAYOUT.plot.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>
        <g clipPath="url(#tradePlotClip)">
          {blockIn > 0.01 ? (
            <line
              x1={p.x(14)}
              x2={p.x(costLineEnd)}
              y1={by}
              y2={by}
              stroke={theme.textDim}
              strokeWidth={2.4}
              strokeDasharray="9 7"
              opacity={0.75 * blockIn}
            />
          ) : null}
          {gapIn > 0.01 ? (
            <g opacity={gapIn}>
              <line x1={bx} x2={bx} y1={by} y2={marketY} stroke={theme.down} strokeWidth={3} />
              <line
                x1={bx - 13}
                x2={bx + 13}
                y1={marketY}
                y2={marketY}
                stroke={theme.down}
                strokeWidth={3}
              />
            </g>
          ) : null}
          {frame >= L(17) ? (
            (() => {
              const draw = enter(frame, L(17), 22);
              const x1 = p.x(EVENTS.lowDay) + (p.x(EVENTS.slideDay) - p.x(EVENTS.lowDay)) * draw;
              const labelX = Math.min(x1 + 14, LAYOUT.plot.right - 210);
              return (
                <g>
                  <line
                    x1={p.x(EVENTS.lowDay)}
                    y1={p.y(EVENTS.lowPrice)}
                    x2={x1}
                    y2={p.y(EVENTS.slidePrice)}
                    stroke={theme.predict}
                    strokeWidth={3}
                    strokeDasharray="10 8"
                    opacity={0.9 * draw}
                  />
                  <text
                    x={labelX}
                    y={p.y(EVENTS.slidePrice) + 8}
                    fill={theme.predict}
                    fontFamily={theme.font}
                    fontSize={25}
                    opacity={draw}
                  >
                    如果跌到 6.88
                  </text>
                </g>
              );
            })()
          ) : null}
        </g>
      </svg>

      {/* ---- L1-L4: what jargon actually compresses --------------------- */}
      {frame < L(4) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 320,
            textAlign: 'center',
            opacity: enter(frame, L(1) - 6, 14) * (1 - enter(frame, L(3), 14)),
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 72, color: theme.text, letterSpacing: 3}}>黑话就是专业术语</div>
          <div
            style={{
              marginTop: 30,
              fontSize: 40,
              color: theme.textDim,
              letterSpacing: 2,
              opacity: enter(frame, L(2), 10),
            }}
          >
            学会术语就能看得更准 —— <span style={{color: theme.down}}>其实不是</span>
          </div>
        </div>
      ) : null}

      {frame >= L(3) && thesisOut < 0.99 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 392,
            textAlign: 'center',
            opacity: enter(frame, L(3), 14) * (1 - thesisOut),
            transform: `scale(${0.95 + enter(frame, L(3), 14) * 0.05})`,
            ...textScrim('center'),
          }}
        >
          <div style={{color: theme.textFaint, fontSize: 32, letterSpacing: 8, marginBottom: 20}}>
            黑话压缩的不是知识
          </div>
          <div style={{color: theme.predict, fontSize: 104, fontWeight: 800, letterSpacing: 12}}>
            是位置
          </div>
        </div>
      ) : null}

      {blockIn > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: p.x(14) + 10,
            top: by - 46,
            color: theme.textDim,
            fontSize: 22,
            fontFamily: theme.mono,
            letterSpacing: 1,
            opacity: blockIn,
          }}
        >
          成本 10.00
        </div>
      ) : null}

      {/* ---- 你 · 1000 股 ------------------------------------------------ */}
      <HolderPanel
        anchor={{x: bx, y: by}}
        color={frame >= L(6) ? theme.down : theme.up}
        name="你"
        detail={`1000 股 @ ${cost.toFixed(2)}`}
        status={statusFor()}
        opacity={blockIn}
        emphasis={frame >= L(7) && frame < L(10) ? 0.9 : 0}
      />

      {blockIn > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(bx + 16, LAYOUT.plot.right - 230),
            top: marketY - 16,
            color: underwater ? theme.down : theme.up,
            fontSize: 26,
            fontFamily: theme.mono,
            opacity: enter(frame, L(5) + 10, 12),
            whiteSpace: 'nowrap',
          }}
        >
          {mark.toFixed(2)} {underwater ? '▼' : '▲'} {(pnl * 100).toFixed(1)}%
        </div>
      ) : null}

      {/* ---- 割肉 -------------------------------------------------------- */}
      {frame >= L(10) ? (
        <div
          style={{
            position: 'absolute',
            left: 620,
            top: 452,
            opacity: enter(frame, L(10), 12) * (1 - heIn * 0.6),
          }}
        >
          <div
            style={{
              display: 'inline-block',
              border: `2px solid ${theme.down}`,
              color: theme.down,
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: 1,
              background: 'rgba(9,12,17,0.9)',
            }}
          >
            割肉 · 把浮亏变成实亏
          </div>
        </div>
      ) : null}

      {/* ---- 他 buys the identical lot ----------------------------------- */}
      <HolderPanel
        anchor={{x: p.x(EVENTS.lowDay), y: p.y(EVENTS.lowPrice)}}
        color={theme.up}
        name="他"
        detail={`1000 股 @ ${EVENTS.lowPrice.toFixed(2)}`}
        status={
          frame < L(17)
            ? '抄底'
            : frame < L(18) + 12
              ? '还在拿着'
              : `浮亏 ${(((EVENTS.slidePrice - EVENTS.lowPrice) / EVENTS.lowPrice) * 100).toFixed(1)}% · 套牢`
        }
        opacity={heIn}
        emphasis={frame >= L(15) && frame < L(17) ? 0.85 : 0}
      />

      {/* ---- same print, two names --------------------------------------- */}
      {frame >= L(15) && frame < L(17) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 208,
            textAlign: 'center',
            opacity: enter(frame, L(15), 14) * (1 - enter(frame, L(17), 12)),
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 42, color: theme.text, letterSpacing: 2}}>
            同一笔成交 · <span style={{color: theme.down}}>割肉</span> 和{' '}
            <span style={{color: theme.up}}>抄底</span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 31,
              color: theme.textDim,
              opacity: enter(frame, L(16), 12),
              letterSpacing: 1,
            }}
          >
            价格一样，方向相反，名字也相反
          </div>
        </div>
      ) : null}

      {frame >= L(20) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 236,
            textAlign: 'center',
            opacity: enter(frame, L(20), 16),
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 46, color: theme.textDim, letterSpacing: 2}}>
            这件事，当时谁也看不出来
          </div>
        </div>
      ) : null}

      {/* ---- act label ---------------------------------------------------- */}
      {frame < L(3) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 128,
            color: theme.textFaint,
            fontSize: 24,
            letterSpacing: 6,
            opacity: enter(frame, sceneStart('trade'), 12),
          }}
        >
          第一件 · 一笔交易，四个名字
        </div>
      ) : null}
    </div>
  );
};
