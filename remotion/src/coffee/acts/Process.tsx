import React from 'react';
import {L, sceneEnd, sceneStart} from '../timing';
import {enter, leave} from '../components/primitives';
import {LAYOUT, theme} from '../theme';
import {ActTitle} from '../components/panels';

const COL_X = [150, 570, 990, 1410];
const COL_W = 396;

type Method = {
  key: string;
  name: string;
  en: string;
  color: string;
  appear: number;
  accent: number;
  steps: string[];
  water: string;
  risk: string;
  bars: [number, number, number, number]; // acidity, sweetness, body, ferment risk (0-5)
};

const BAR_LABELS = ['酸度', '甜度', '醇厚度', '发酵风险'];

const METHODS: Method[] = [
  {
    key: 'washed',
    name: '水洗',
    en: 'Washed / Wet',
    color: theme.washed,
    appear: L('process', 2) - 18,
    accent: L('process', 3) - 6,
    steps: ['采收当天去皮去果胶', '发酵槽浸泡 12–36 小时', '清水洗去残留果胶', '晒干或机干至含水 11%'],
    water: '传统水洗 ≈ 39 L / kg 干羊皮豆',
    risk: '换机械去胶机可降到 ≈ 0.6 L',
    bars: [4, 2, 2, 1],
  },
  {
    key: 'natural',
    name: '日晒',
    en: 'Natural / Dry',
    color: theme.natural,
    appear: L('process', 4) - 14,
    accent: L('process', 6) - 6,
    steps: ['整颗果实不做处理', '铺开日晒 2–4 周', '定时翻动，防霉防发酵过度', '干燥后一次性脱壳'],
    water: '几乎不耗水',
    risk: '最依赖天气，翻晒不及时就发霉',
    bars: [2, 4, 4, 4],
  },
  {
    key: 'honey',
    name: '蜜处理',
    en: 'Honey',
    color: theme.honey,
    appear: L('process', 7) - 14,
    accent: L('process', 8) - 6,
    steps: ['只去掉果皮', '按保留果胶的量分黄 / 红 / 黑', '带着果胶晒干', '干燥后脱壳'],
    water: '耗水量低于水洗',
    risk: '介于水洗和日晒之间的连续区间',
    bars: [3, 4, 3, 3],
  },
  {
    key: 'wetHull',
    name: '湿刨法',
    en: 'Giling Basah',
    color: theme.wetHull,
    appear: L('process', 9) - 16,
    accent: L('process', 11) - 6,
    steps: ['去皮，短时间发酵', '只晒到含水 40–45%', '趁湿刨掉羊皮纸壳', '再晒干至含水 13% 左右'],
    water: '耗水量低于水洗',
    risk: '印尼雨季的产物：来不及晒干',
    bars: [1, 2, 5, 3],
  },
];

/**
 * Act four. Same tree, same day, four different beans. The columns are stage
 * diagrams rather than photos, and the bar rows underneath are the reason the
 * act exists: the four routes move acidity, sweetness, body and risk in
 * measurably different directions.
 */
export const Process: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('process') - 4, 18), leave(frame, sceneEnd('process') + 6, 20));
  if (op <= 0.01) return null;

  const decision = enter(frame, L('process', 1) - 12, 20);
    const anaer = enter(frame, L('process', 12) - 14, 20);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: theme.font, pointerEvents: 'none'}}>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0}}
      >
        <ActTitle frame={frame} appear={sceneStart('process') - 10} text="第四行 · 处理法" sub="同一棵树，四个版本" />

        {/* the deadline that forces the choice */}
        <g opacity={decision}>
          <rect x={150} y={254} width={716} height={64} rx={10} fill="rgba(111,168,220,0.12)" stroke={theme.washed} strokeWidth={1.3} />
          <text x={176} y={295} fill={theme.text} fontSize={24} letterSpacing={1}>
            果子摘下之后 24 小时内必须做出选择
          </text>
        </g>

        {METHODS.map((m, ci) => {
          const x = COL_X[ci];
          const t = enter(frame, m.appear, 18);
          if (t <= 0.01) return null;
          const focus = enter(frame, m.accent, 16) * 0.5 + 0.5;
          return (
            <g key={m.key} opacity={t}>
              <rect
                x={x}
                y={330}
                width={COL_W}
                height={534}
                rx={12}
                fill="rgba(255,255,255,0.026)"
                stroke={m.color}
                strokeWidth={1.2 + focus}
                strokeOpacity={0.45 + focus * 0.4}
              />
              <rect x={x} y={330} width={COL_W} height={62} rx={12} fill={`${m.color}22`} />
              <text x={x + 20} y={370} fill={m.color} fontSize={30} fontWeight={700} letterSpacing={2}>
                {m.name}
              </text>
              <text x={x + COL_W - 20} y={368} fill={theme.textFaint} fontSize={17} textAnchor="end" fontFamily={theme.mono}>
                {m.en}
              </text>

              {m.steps.map((s, si) => {
                const st = enter(frame, m.appear + 8 + si * 7, 16);
                const sy = 400 + si * 52;
                return (
                  <g key={s} opacity={st}>
                    <circle cx={x + 30} cy={sy + 4} r={11} fill="none" stroke={m.color} strokeWidth={1.6} />
                    <text x={x + 30} y={sy + 10} fill={m.color} fontSize={15} textAnchor="middle" fontFamily={theme.mono}>
                      {si + 1}
                    </text>
                    <text x={x + 52} y={sy + 11} fill={theme.textDim} fontSize={21}>
                      {s}
                    </text>
                    {si < 3 ? (
                      <line x1={x + 30} x2={x + 30} y1={sy + 18} y2={sy + 50} stroke={m.color} strokeWidth={1.2} opacity={0.35} />
                    ) : null}
                  </g>
                );
              })}

              <text x={x + 20} y={616} fill={theme.textFaint} fontSize={16} letterSpacing={1}>
                风味倾向（典型描述，非普适排名）
              </text>

              {m.bars.map((v, bi) => {
                const by = 626 + bi * 36;
                const bt = enter(frame, m.accent + bi * 5, 16);
                return (
                  <g key={BAR_LABELS[bi]} opacity={bt}>
                    <text x={x + 20} y={by + 17} fill={theme.textFaint} fontSize={18} letterSpacing={1}>
                      {BAR_LABELS[bi]}
                    </text>
                    <rect x={x + 122} y={by + 2} width={COL_W - 156} height={18} rx={3} fill="rgba(255,255,255,0.045)" />
                    <rect x={x + 122} y={by + 2} width={((COL_W - 156) * v) / 5} height={18} rx={3} fill={m.color} />
                  </g>
                );
              })}

              <line x1={x + 20} x2={x + COL_W - 20} y1={788} y2={788} stroke={theme.panelEdge} />
              <text x={x + 20} y={814} fill={theme.textDim} fontSize={19}>
                {m.water}
              </text>
              <text x={x + 20} y={842} fill={theme.textFaint} fontSize={18}>
                {m.risk}
              </text>
            </g>
          );
        })}

        {/* the fifth route, which is a control system rather than a technique */}
        <g opacity={anaer}>
          <rect x={890} y={254} width={916} height={64} rx={10} fill="rgba(201,139,176,0.10)" stroke={theme.bred} strokeWidth={1.2} />
          <text x={914} y={295} fill={theme.bred} fontSize={24} fontWeight={700} letterSpacing={1}>
            第五种 · 厌氧发酵
          </text>
          <text x={1178} y={295} fill={theme.textDim} fontSize={21}>
            装进密封罐，控温控时发酵 —— 风味从听天由命变成可调参数
          </text>
        </g>

      </svg>
    </div>
  );
};
