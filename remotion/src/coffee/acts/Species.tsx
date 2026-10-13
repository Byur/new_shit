import React from 'react';
import {L, sceneEnd, sceneStart} from '../timing';
import {enter, leave, smooth} from '../components/primitives';
import {LAYOUT, theme} from '../theme';
import {ROBUSTA_SHARE, SPECIES_FACTS} from '../data';

const LABEL_X = 480;
const BAR_X = 508;
const BAR_W = 470;
const ROW_H = 96;
const TOP = 268;

/**
 * Act one. The argument is not "arabica good, robusta bad" — it is that the two
 * compounds that taste harsh in the cup are the same two that defend the plant,
 * so the flavour penalty and the agronomic advantage are one fact seen twice.
 */
export const Species: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('species') - 4, 18), leave(frame, sceneEnd('species') + 6, 20));
  if (op <= 0.01) return null;

  const weapon = enter(frame, L('species', 7) - 6, 20);
  const verdict = enter(frame, L('species', 10) - 12, 20);
  const share = enter(frame, L('species', 12) - 8, 22);

  const cx = 1210;
  const cy = 300;
  const cw = 600;
  const ch = 340;
  const maxShare = 50;
  const px = (year: number) => cx + ((year - 1990) / 34) * cw;
  const py = (sharePct: number) => cy + ch - (sharePct / maxShare) * ch;
  const path = ROBUSTA_SHARE.map(([y, v], i) => `${i === 0 ? 'M' : 'L'}${px(y).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const drawn = smooth((frame - (L('species', 12) - 8)) / 60);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: theme.font, pointerEvents: 'none'}}>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0}}
      >
        <text x={150} y={180} fill={theme.text} fontSize={34} fontWeight={700} letterSpacing={2}>
          第一行 · 物种
        </text>
        <text x={150} y={220} fill={theme.textFaint} fontSize={22} letterSpacing={1}>
          阿拉比卡 Coffea arabica 与 罗布斯塔 Coffea canephora · 占干重百分比（文献常见区间）
        </text>

        {/* the two species, bar for bar */}
        {SPECIES_FACTS.map((fact, i) => {
          const y = TOP + i * ROW_H;
          const t = enter(frame, L('species', 2) - 6 + i * 7, 18);
          const hot = weapon > 0.01 && i < 2;
          return (
            <g key={fact.label} opacity={t}>
              <text
                x={LABEL_X}
                y={y + 46}
                fill={theme.text}
                fontSize={28}
                textAnchor="end"
                letterSpacing={2}
              >
                {fact.label}
              </text>
              {[
                {v: fact.arabica, c: theme.arabica, name: '阿拉比卡', dy: 0},
                {v: fact.robusta, c: theme.robusta, name: '罗布斯塔', dy: 34},
              ].map((b) => {
                const x0 = BAR_X + (b.v[0] / fact.max) * BAR_W * t;
                const x1 = BAR_X + (b.v[1] / fact.max) * BAR_W * t;
                return (
                  <g key={b.name}>
                    <rect x={BAR_X} y={y + b.dy} width={BAR_W} height={26} rx={4} fill="rgba(255,255,255,0.04)" />
                    <rect x={x0} y={y + b.dy} width={Math.max(4, x1 - x0)} height={26} rx={4} fill={b.c} opacity={0.9} />
                    <text
                      x={BAR_X + BAR_W + 16}
                      y={y + b.dy + 21}
                      fill={b.c}
                      fontSize={22}
                      fontFamily={theme.mono}
                    >
                      {b.v[0]}–{b.v[1]}%
                    </text>
                  </g>
                );
              })}
              {hot ? (
                <rect
                  x={BAR_X - 14}
                  y={y - 8}
                  width={(fact.arabica[1] / fact.max) * BAR_W + 300}
                  height={74}
                  rx={8}
                  fill="none"
                  stroke={theme.robusta}
                  strokeWidth={1.6}
                  strokeDasharray="7 6"
                  opacity={weapon * 0.9}
                />
              ) : null}
            </g>
          );
        })}

        <g opacity={weapon}>
          <text x={BAR_X - 14} y={TOP - 30} fill={theme.robusta} fontSize={22} letterSpacing={1}>
            苦味来源 = 化学防御 →  含量越高，越多种昆虫不吃它
          </text>
        </g>

        {/* the judgement: same fact, two readings */}
        <g opacity={verdict}>
          <rect x={150} y={688} width={986} height={112} rx={12} fill="rgba(194,91,62,0.12)" stroke={theme.robusta} strokeWidth={1.4} />
          <text x={182} y={736} fill={theme.robusta} fontSize={27} fontWeight={700} letterSpacing={1}>
            风味上的缺点
          </text>
          <text x={182} y={776} fill={theme.textDim} fontSize={22}>
            更苦、更涩、橡胶与泥土味
          </text>
          <text x={556} y={760} fill={theme.textFaint} fontSize={22} textAnchor="middle">
            同一物种
          </text>
          <text x={620} y={736} fill={theme.altitude} fontSize={27} fontWeight={700} letterSpacing={1}>
            农业上的优点
          </text>
          <text x={620} y={776} fill={theme.textDim} fontSize={21}>
            抗虫、抗病、耐热、耐旱、单产高、更便宜
          </text>
        </g>

        {/* robusta's share is not shrinking */}
        <g opacity={share}>
          <text x={cx} y={cy - 34} fill={theme.text} fontSize={25} letterSpacing={1}>
            罗布斯塔占世界产量比重
          </text>
          <text x={cx} y={cy - 4} fill={theme.textFaint} fontSize={19} fontFamily={theme.mono}>
            % · ICO 口径 · 1990–2024
          </text>
          {[0, 10, 20, 30, 40, 50].map((v) => (
            <g key={v}>
              <line x1={cx} x2={cx + cw} y1={py(v)} y2={py(v)} stroke={theme.grid} strokeWidth={1} />
              <text x={cx - 12} y={py(v) + 7} fill={theme.textFaint} fontSize={17} textAnchor="end" fontFamily={theme.mono}>
                {v}
              </text>
            </g>
          ))}
          <line
            x1={cx}
            x2={cx + cw}
            y1={py(40)}
            y2={py(40)}
            stroke={theme.robusta}
            strokeWidth={1.4}
            strokeDasharray="8 7"
            opacity={0.8}
          />
          <text x={cx + cw} y={py(40) - 12} fill={theme.robusta} fontSize={20} textAnchor="end">
            40%
          </text>
          <path d={path} fill="none" stroke={theme.arabica} strokeWidth={3} pathLength={1} strokeDasharray={`${drawn} 1`} />
          {ROBUSTA_SHARE.map(([year, v]) => (
            <g key={year} opacity={drawn > (year - 1990) / 34 ? 1 : 0}>
              <circle cx={px(year)} cy={py(v)} r={5} fill={theme.arabica} />
              <text x={px(year)} y={cy + ch + 30} fill={theme.textFaint} fontSize={17} textAnchor="middle" fontFamily={theme.mono}>
                {year}
              </text>
            </g>
          ))}
          <text x={cx + cw} y={py(44) - 18} fill={theme.text} fontSize={26} textAnchor="end" fontFamily={theme.mono}>
            约四成
          </text>
        </g>
      </svg>
    </div>
  );
};
