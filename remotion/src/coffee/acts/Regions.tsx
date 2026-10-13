import React from 'react';
import {L, sceneEnd, sceneStart} from '../timing';
import {enter, leave} from '../components/primitives';
import {LAYOUT, theme} from '../theme';
import {Projector} from '../components/MapCanvas';
import {ActTitle, OriginCard} from '../components/panels';
import {byKey} from '../data';

const SLOT_X = [150, 986];
const CARD_W = 820;
const CARD_Y = 656;

type Booking = {slot: number; key: string; from: number; to: number};

/**
 * The payoff act. Every country is described by the same four rows the film has
 * spent six minutes establishing, so by the end the viewer is reading the answer
 * off the card before the card finishes drawing.
 */
const BOOKINGS: Booking[] = [
  {slot: 0, key: 'ethiopia', from: L('regions', 3) - 18, to: L('regions', 7) - 8},
  {slot: 1, key: 'kenya', from: L('regions', 5) - 18, to: L('regions', 7) - 8},
  {slot: 0, key: 'brazil', from: L('regions', 8) - 18, to: L('regions', 12) - 10},
  {slot: 1, key: 'colombia', from: L('regions', 10) - 18, to: L('regions', 12) - 10},
  {slot: 0, key: 'guatemala', from: L('regions', 12) - 8, to: L('regions', 13) - 2},
  {slot: 1, key: 'panama', from: L('regions', 12) - 8, to: L('regions', 13) - 2},
  {slot: 0, key: 'vietnam', from: L('regions', 14) - 18, to: L('regions', 16) - 16},
  {slot: 0, key: 'china', from: L('regions', 16) - 10, to: L('regions', 17) - 6},
  {slot: 1, key: 'indonesia', from: L('regions', 16) - 18, to: L('regions', 17) - 6},
];

const CAMPS = [
  {name: '非洲', from: L('regions', 2) - 16, to: L('regions', 7) - 8, lon: 34, lat: 6, color: theme.wild},
  {name: '拉丁美洲', from: L('regions', 7) - 16, to: L('regions', 13) - 4, lon: -75, lat: 10, color: theme.arabica},
  {name: '亚太', from: L('regions', 13) - 16, to: L('regions', 17) - 4, lon: 108, lat: 20, color: theme.robusta},
];

export const Regions: React.FC<{frame: number; project: Projector}> = ({frame, project}) => {
  const op = Math.min(enter(frame, sceneStart('regions') - 4, 18), leave(frame, sceneEnd('regions') + 6, 20));
  if (op <= 0.01) return null;

  const active = BOOKINGS.filter((b) => frame >= b.from - 18 && frame <= b.to + 20);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: theme.font, pointerEvents: 'none'}}>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0}}
      >
        <ActTitle frame={frame} appear={sceneStart('regions') - 10} text="回到地图" sub="三大阵营，一套解释" />

        {CAMPS.map((c) => {
          const t = enter(frame, c.from, 20) * leave(frame, c.to, 20);
          if (t <= 0.01) return null;
          const p = project(c.lon, c.lat);
          const lx = Math.min(Math.max(p.x, LAYOUT.map.left + 120), LAYOUT.map.right - 120);
          const ly = Math.min(Math.max(p.y - 26, LAYOUT.map.top + 54), LAYOUT.map.bottom - 26);
          return (
            <g key={c.name} opacity={t}>
              <text
                x={lx}
                y={ly}
                fill={c.color}
                fontSize={30}
                fontWeight={700}
                letterSpacing={4}
                textAnchor="middle"
              >
                {c.name}
              </text>
              <line
                x1={lx - 70}
                x2={lx + 70}
                y1={ly + 16}
                y2={ly + 16}
                stroke={c.color}
                strokeWidth={2}
                opacity={0.7}
              />
            </g>
          );
        })}

        {/* while only Vietnam is on the left, the right slot carries the camp */}
        <g opacity={enter(frame, L('regions', 14) - 14, 16) * leave(frame, L('regions', 16) - 22, 16)}>
          <rect x={SLOT_X[1]} y={CARD_Y} width={CARD_W} height={196} rx={12} fill="rgba(194,91,62,0.07)" stroke={theme.robusta} strokeWidth={1.5} strokeOpacity={0.7} />
          <text x={SLOT_X[1] + 24} y={CARD_Y + 44} fill={theme.robusta} fontSize={30} fontWeight={700} letterSpacing={3}>
            亚太阵营
          </text>
          <line x1={SLOT_X[1] + 24} x2={SLOT_X[1] + CARD_W - 24} y1={CARD_Y + 62} y2={CARD_Y + 62} stroke={theme.panelEdge} />
          {[
            '越南 · 世界第二大产国，几乎全是罗布斯塔',
            '印度尼西亚 · 湿刨法带来的低酸与厚重',
            '中国云南 · 卡蒂姆为主，正从商业豆转向精品',
            '巴布亚新几内亚 · 太平洋上少见的干净水洗豆',
          ].map((line, i) => (
            <text key={line} x={SLOT_X[1] + 24} y={CARD_Y + 98 + i * 28} fill={theme.textDim} fontSize={21}>
              {line}
            </text>
          ))}
        </g>

        {active.map((b) => {
          const o = byKey(b.key);
          return (
            <OriginCard
              key={`${b.slot}-${b.key}`}
              frame={frame}
              appear={b.from}
              fade={b.to}
              x={SLOT_X[b.slot]}
              y={CARD_Y}
              width={CARD_W}
              origin={o}
              accent={o.arabica >= 0.9 ? theme.arabica : o.arabica <= 0.15 ? theme.robusta : theme.wild}
            />
          );
        })}
      </svg>
    </div>
  );
};
