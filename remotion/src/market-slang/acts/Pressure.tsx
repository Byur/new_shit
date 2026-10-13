import React from 'react';
import {View} from '../camera';
import {chipDistribution, EVENTS, priceToBucket, TODAY} from '../chart';
import {makeProjector} from '../components/ChartCanvas';
import {enter, textScrim} from '../components/primitives';
import {line, sceneStart} from '../timing';
import {theme} from '../theme';

const L = (n: number) => line('pressure', n).startFrame;

const massInBand = (asOf: number, lo: number, hi: number): number => {
  const dist = chipDistribution(asOf);
  const total = dist.reduce((a, b) => a + b, 0);
  let inBand = 0;
  for (let b = priceToBucket(lo); b <= priceToBucket(hi); b++) inBand += dist[b];
  return total <= 0 ? 0 : inBand / total;
};

/**
 * The mechanism act. The previous act established that jargon names a
 * position; this one shows that positions are not just vocabulary — a crowd
 * with the same cost creates a real, visible ceiling.
 */
export const Pressure: React.FC<{frame: number; view: View}> = ({frame, view}) => {
  const p = makeProjector(view);

  const inBand = enter(frame, L(1), 16);
  const chipCall = enter(frame, L(3) + 6, 16);
  const trapped = enter(frame, L(4), 16);
  const ceiling = enter(frame, L(5) + 10, 18);
  const sells = enter(frame, L(7), 14);
  const pressure = enter(frame, L(9), 16);
  const distribution = enter(frame, L(10), 16);
  const final = enter(frame, L(13), 16);

  const bandMass = massInBand(EVENTS.reboundHigh, EVENTS.costBand - 0.25, EVENTS.costBand + 0.25);
  const trappedMass = massInBand(EVENTS.lowDay, EVENTS.lowPrice, EVENTS.costBand);

  const bandRect = {
    x0: p.x(EVENTS.bandStart),
    x1: p.x(EVENTS.bandEnd),
    y0: p.y(EVENTS.costBand + 0.4),
    y1: p.y(EVENTS.costBand - 0.4),
  };

  const ceilingY = p.y(EVENTS.costBand);

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        {/* the dense trading band at 10 */}
        {inBand > 0.01 ? (
          <g opacity={inBand}>
            <rect
              x={bandRect.x0}
              y={Math.min(bandRect.y0, bandRect.y1)}
              width={bandRect.x1 - bandRect.x0}
              height={Math.abs(bandRect.y1 - bandRect.y0)}
              fill={trapped > 0.5 ? theme.down : theme.predict}
              opacity={0.22}
              rx={4}
            />
            <line
              x1={bandRect.x0}
              x2={bandRect.x1}
              y1={ceilingY}
              y2={ceilingY}
              stroke={trapped > 0.5 ? theme.down : theme.predict}
              strokeWidth={2}
              strokeDasharray="8 6"
              opacity={0.8}
            />
          </g>
        ) : null}

        {/* the ceiling over the rebound */}
        {ceiling > 0.01 ? (
          <g opacity={ceiling}>
            <line
              x1={p.x(EVENTS.lowDay + 4)}
              x2={p.x(TODAY + 6)}
              y1={ceilingY}
              y2={ceilingY}
              stroke={theme.predict}
              strokeWidth={4}
              strokeDasharray="12 8"
            />
            {[112, 120, 128].map((day, i) => {
              const ax = p.x(day);
              const appear = enter(frame, L(6) + i * 8, 10);
              return (
                <g key={day} opacity={appear}>
                  <line
                    x1={ax}
                    y1={ceilingY + 62}
                    x2={ax}
                    y2={ceilingY + 14}
                    stroke={theme.predict}
                    strokeWidth={3}
                  />
                  <path
                    d={`M ${ax - 9} ${ceilingY + 24} L ${ax} ${ceilingY + 10} L ${ax + 9} ${ceilingY + 24}`}
                    fill="none"
                    stroke={theme.predict}
                    strokeWidth={3}
                  />
                </g>
              );
            })}
          </g>
        ) : null}

        {/* sellers arriving exactly at break-even */}
        {sells > 0.01 ? (
          <g opacity={sells}>
            {[118, 124, 130, 134].map((day, i) => {
              const ax = p.x(day);
              const appear = enter(frame, L(7) + i * 7, 9);
              return (
                <g key={day} opacity={appear}>
                  <rect
                    x={ax - 22}
                    y={ceilingY - 44}
                    width={44}
                    height={34}
                    rx={6}
                    fill="rgba(9,12,17,0.9)"
                    stroke={theme.down}
                    strokeWidth={2}
                  />
                  <text
                    x={ax}
                    y={ceilingY - 20}
                    textAnchor="middle"
                    fill={theme.down}
                    fontFamily={theme.font}
                    fontSize={22}
                    fontWeight={700}
                  >
                    卖
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}

        {/* the chip panel being introduced */}
        {distribution > 0.01 ? (
          <g opacity={distribution * 0.9}>
            <rect
              x={1546}
              y={ceilingY - 26}
              width={290}
              height={52}
              rx={8}
              fill="rgba(9,12,17,0.9)"
              stroke={theme.describe}
              strokeWidth={1.6}
            />
            <text
              x={1691}
              y={ceilingY + 8}
              textAnchor="middle"
              fill={theme.describe}
              fontFamily={theme.mono}
              fontSize={24}
            >
              {(bandMass * 100).toFixed(0)}% 压在这里
            </text>
          </g>
        ) : null}
      </svg>

      {/* ---- L0: the claim --------------------------------------------- */}
      {frame < L(1) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 380,
            textAlign: 'center',
            opacity: enter(frame, L(0) - 4, 12),
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 62, color: theme.text, letterSpacing: 3}}>
            位置会<span style={{color: theme.predict}}>直接改变价格</span>
          </div>
        </div>
      ) : null}

      {/* ---- the dense band -------------------------------------------- */}
      {inBand > 0.01 && chipCall < 0.99 ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 236,
            width: 760,
            opacity: inBand * (1 - chipCall),
            ...textScrim('left'),
          }}
        >
          <div style={{color: theme.predict, fontSize: 40, fontWeight: 700, letterSpacing: 1}}>
            10 块附近，横了很久
          </div>
          <div style={{marginTop: 12, color: theme.textDim, fontSize: 27, lineHeight: 1.5}}>
            大量成交发生在同一个价位 —— 很多人的成本就是 10 块
          </div>
        </div>
      ) : null}

      {/* ---- the trapped pile ------------------------------------------ */}
      {trapped > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 236,
            width: 820,
            opacity: trapped,
            ...textScrim('left'),
          }}
        >
          <div style={{color: theme.down, fontSize: 40, fontWeight: 700, letterSpacing: 1}}>
            跌到 8 块，这批人全部套牢
          </div>
          <div style={{marginTop: 12, color: theme.textDim, fontSize: 27, lineHeight: 1.5}}>
            {(trappedMass * 100).toFixed(0)}% 的筹码压在水下，等着回本
          </div>
        </div>
      ) : null}

      {/* ---- the ceiling ------------------------------------------------- */}
      {ceiling > 0.01 && final < 0.99 ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 380,
            width: 880,
            opacity: ceiling,
            ...textScrim('left'),
          }}
        >
          <div style={{color: theme.predict, fontSize: 38, fontWeight: 700, letterSpacing: 1}}>
            反弹到 10 块，就是撞上自己的成本线
          </div>
        </div>
      ) : null}

      {frame >= L(6) && frame < L(9) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 200,
            textAlign: 'center',
            opacity: enter(frame, L(6), 12) * 0.95,
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 48, color: theme.text, letterSpacing: 2}}>你猜会发生什么？</div>
        </div>
      ) : null}

      {frame >= L(8) && frame < L(10) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 470,
            width: 560,
            opacity: enter(frame, L(8), 12),
            ...textScrim('left'),
          }}
        >
          <div style={{fontSize: 36, color: theme.text, letterSpacing: 1.5}}>
            不是想赚钱，是想<span style={{color: theme.down}}>回本</span>
          </div>
        </div>
      ) : null}

      {/* ---- pressure ---------------------------------------------------- */}
      {frame >= L(9) && frame < L(10) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 620,
            textAlign: 'center',
            opacity: pressure * (1 - enter(frame, L(10), 12)),
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 44, color: theme.text, letterSpacing: 2}}>
            集中的卖盘，就形成了<span style={{color: theme.predict}}>压力</span>
          </div>
        </div>
      ) : null}

      {/* ---- chip distribution explained --------------------------------- */}
      {frame >= L(10) && frame < L(12) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 250,
            width: 860,
            opacity: enter(frame, L(10), 14),
            ...textScrim('left'),
          }}
        >
          <div style={{color: theme.describe, fontSize: 38, fontWeight: 700, letterSpacing: 1}}>
            筹码分布图，画的就是这件事
          </div>
          <div style={{marginTop: 14, color: theme.textDim, fontSize: 27, lineHeight: 1.5}}>
            每个价位的横条，代表还有多少筹码没解套
          </div>
        </div>
      ) : null}

      {/* ---- final ------------------------------------------------------- */}
      {final > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 214,
            textAlign: 'center',
            opacity: final,
            transform: `translateY(${(1 - final) * 16}px)`,
            ...textScrim('center'),
          }}
        >
          <div style={{fontSize: 40, color: theme.textDim, letterSpacing: 2, marginBottom: 14}}>
            所以价格往上走，是在跟一群急着回本的人较劲
          </div>
          <div style={{fontSize: 58, color: theme.text, letterSpacing: 3}}>
            压力位不是玄学，它是<span style={{color: theme.predict}}>一群人的成本线</span>
          </div>
        </div>
      ) : null}

      {frame < L(1) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 128,
            color: theme.textFaint,
            fontSize: 24,
            letterSpacing: 6,
            opacity: enter(frame, sceneStart('pressure'), 12),
          }}
        >
          第二件 · 位置为什么能改变价格
        </div>
      ) : null}
    </div>
  );
};
