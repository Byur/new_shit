import React from 'react';
import {L, sceneEnd, sceneStart} from '../timing';
import {enter, leave} from '../components/primitives';
import {LAYOUT, theme} from '../theme';

const COL = [150, 430, 710, 990, 1270, 1550];
const ROW = [210, 290, 370, 450, 530, 610, 690, 770];
const NW = 214;
const NH = 56;

const N = {
  wild: L('variety', 2) - 10,
  yemen: L('variety', 2) + 26,
  trunks: L('variety', 4) - 10,
  fan: L('variety', 6) - 12,
  rust: L('variety', 7) - 12,
  timor: L('variety', 8) - 10,
  catimor: L('variety', 9) - 8,
  modern: L('variety', 10) - 6,
  paradox: L('variety', 11) - 10,
  geishaApp: L('variety', 12) - 10,
  geishaWin: L('variety', 13) - 12,
  close: L('variety', 14) - 4,
};

type Node = {
  id: string;
  col: number;
  row: number;
  title: string;
  sub: string;
  color: string;
  appear: number;
  hot?: number;
  stub?: string;
};

const NODES: Node[] = [
  {id: 'wild', col: 0, row: 2, title: '埃塞俄比亚野生种群', sub: '上万种地方种', color: theme.wild, appear: N.wild, hot: N.wild},
  {id: 'yemen', col: 1, row: 2, title: '也门', sub: '17 世纪向外传播', color: theme.wild, appear: N.yemen},
  {id: 'typica', col: 2, row: 0, title: '铁皮卡 Typica', sub: '主干 · 经爪哇到美洲', color: theme.bred, appear: N.trunks, hot: N.trunks},
  {id: 'bourbon', col: 2, row: 3, title: '波旁 Bourbon', sub: '主干 · 留尼汪岛', color: theme.bred, appear: N.trunks + 10, hot: N.trunks + 10},
  {id: 'marago', col: 3, row: 0, title: '马拉戈吉佩', sub: '巨型豆突变', color: theme.bred, appear: N.fan},
  {id: 'pacas', col: 3, row: 1, title: '帕卡斯 Pacas', sub: '矮化突变 · 萨尔瓦多', color: theme.bred, appear: N.fan + 6},
  {id: 'mundonovo', col: 3, row: 2, title: '蒙多诺沃', sub: 'Typica × Bourbon', color: theme.bred, appear: N.fan + 12},
  {id: 'caturra', col: 3, row: 4, title: '卡杜拉 Caturra', sub: '矮化突变 · 高产', color: theme.bred, appear: N.fan + 18, hot: N.catimor - 30},
  {id: 'sl', col: 3, row: 5, title: 'SL28 / SL34', sub: '肯尼亚本地选育', color: theme.wild, appear: N.fan + 26},
  {id: 'pacamara', col: 4, row: 1, title: '帕卡马拉', sub: 'Pacas × Maragogipe', color: theme.bred, appear: N.fan + 34},
  {id: 'catuai', col: 4, row: 3, title: '卡杜艾 Catuai', sub: 'Mundo Novo × Caturra', color: theme.bred, appear: N.fan + 40},
  {id: 'geisha', col: 4, row: 5, title: '格莎 Geisha', sub: '埃塞俄比亚地方种', color: theme.wild, appear: N.geishaApp, hot: N.geishaApp, stub: '1930 年代经肯尼亚选育'},
  {id: 'geishaPa', col: 5, row: 5, title: '巴拿马翡翠庄园', sub: '2004 年夺冠 · 拍卖价纪录', color: theme.score, appear: N.geishaWin, hot: N.geishaWin},
  {id: 'robusta', col: 2, row: 7, title: '罗布斯塔', sub: '另一个物种', color: theme.robusta, appear: N.rust},
  {id: 'timor', col: 3, row: 7, title: '帝汶杂交', sub: '阿拉比卡 × 罗布斯塔', color: theme.robusta, appear: N.timor, hot: N.timor},
  {id: 'catimor', col: 4, row: 7, title: '卡蒂姆 Catimor', sub: 'Timor Hybrid × Caturra', color: theme.robusta, appear: N.catimor, hot: N.catimor},
  {id: 'modern', col: 5, row: 7, title: '卡斯蒂略 / 哥伦比亚种', sub: 'Ruiru 11 · Batian · 全球推广', color: theme.robusta, appear: N.modern},
];

const at = (id: string) => {
  const n = NODES.find((x) => x.id === id)!;
  return {x: COL[n.col], y: ROW[n.row]};
};
const L0 = (id: string) => at(id).x + NW;
const R0 = (id: string) => at(id).x;
const MY = (id: string) => at(id).y + NH / 2;
const M = (a: string, b: string) => `M${L0(a)} ${MY(a)} L${R0(b)} ${MY(b)}`;
const C = (a: string, b: string, bow = 70) =>
  `M${L0(a)} ${MY(a)} C${L0(a) + bow} ${MY(a)}, ${R0(b) - bow} ${MY(b)}, ${R0(b)} ${MY(b)}`;

const LINKS: Array<{d: string; appear: number; color: string}> = [
  {d: M('wild', 'yemen'), appear: N.yemen - 6, color: theme.wild},
  {d: C('yemen', 'typica', 100), appear: N.trunks - 20, color: theme.wild},
  {d: C('yemen', 'bourbon', 100), appear: N.trunks - 10, color: theme.wild},
  {d: M('typica', 'marago'), appear: N.fan - 10, color: theme.bred},
  {d: C('bourbon', 'pacas', 80), appear: N.fan - 4, color: theme.bred},
  {d: C('typica', 'mundonovo', 70), appear: N.fan + 4, color: theme.bred},
  {d: C('bourbon', 'mundonovo', 70), appear: N.fan + 6, color: theme.bred},
  {d: C('bourbon', 'caturra', 80), appear: N.fan + 10, color: theme.bred},
  {d: C('marago', 'pacamara', 60), appear: N.fan + 28, color: theme.bred},
  {d: M('pacas', 'pacamara'), appear: N.fan + 30, color: theme.bred},
  {d: C('mundonovo', 'catuai', 60), appear: N.fan + 36, color: theme.bred},
  {d: C('caturra', 'catuai', 60), appear: N.fan + 38, color: theme.bred},
  {d: C('bourbon', 'sl', 110), appear: N.fan + 46, color: theme.wild},
  {d: M('geisha', 'geishaPa'), appear: N.geishaWin - 6, color: theme.wild},
  {d: M('robusta', 'timor'), appear: N.timor, color: theme.robusta},
  {d: M('timor', 'catimor'), appear: N.catimor - 6, color: theme.robusta},
  {
    d: `M${at('caturra').x + NW / 2} ${at('caturra').y + NH} C${at('caturra').x + NW / 2} ${MY('catimor')}, ${R0('catimor') - 70} ${MY('catimor')}, ${R0('catimor')} ${MY('catimor')}`,
    appear: N.catimor - 6,
    color: theme.bred,
  },
  {d: M('catimor', 'modern'), appear: N.modern - 6, color: theme.robusta},
];

/** The left bottom corner is free of nodes, so the beat commentary lives there. */
const NOTES: Array<{at: number; end: number; head: string; body: string; color: string}> = [
  {at: N.rust, end: N.timor, head: '1970 年代 · 叶锈病传入美洲', body: '十来年里扩散到几乎所有产区，育种目标从风味转向抗病。', color: theme.robusta},
  {at: N.timor, end: N.modern, head: '帝汶杂交 × 卡杜拉 = 卡蒂姆', body: '抗锈病、高产，被全球产区大规模推广。', color: theme.robusta},
  {at: N.paradox, end: N.geishaApp, head: '抗病 ↑ ／ 杯测分数 ↓', body: '那一点罗布斯塔血缘，正是分数偏低的最可能原因。', color: theme.robusta},
  {at: N.geishaApp, end: N.close, head: '反例 · 格莎 Geisha', body: '在中美洲的种质库躺了几十年，没人愿意种。', color: theme.wild},
  {at: N.geishaWin, end: N.close, head: '2004 年 · 巴拿马翡翠庄园', body: '种到 1600 米之后拿下冠军，拍卖价从此刷新纪录。', color: theme.score},
];

export const Variety: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('variety') - 4, 18), leave(frame, sceneEnd('variety') + 6, 20));
  if (op <= 0.01) return null;

  const neck = enter(frame, N.yemen - 8, 18);
  const close = enter(frame, N.close - 6, 20);
  const note = NOTES.filter((n) => frame >= n.at - 12).slice(-1)[0];

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: theme.font, pointerEvents: 'none'}}>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0}}
      >
        <text x={150} y={172} fill={theme.text} fontSize={30} fontWeight={700} letterSpacing={2}>
          第二行 · 品种：两条主干，和一个抗病悖论
        </text>

        <g opacity={neck}>
          <text x={150} y={ROW[0] + 86} fill={theme.wild} fontSize={21} letterSpacing={1}>
            遗传瓶颈
          </text>
          <text x={150} y={ROW[0] + 116} fill={theme.textDim} fontSize={19}>
            上万种 → 极少数几棵
          </text>
        </g>

        {LINKS.map((l, i) => {
          const t = enter(frame, l.appear, 20);
          if (t <= 0.01) return null;
          return (
            <path
              key={i}
              d={l.d}
              fill="none"
              stroke={l.color}
              strokeWidth={2.2}
              opacity={0.5 * t}
              pathLength={1}
              strokeDasharray={`${t} 1`}
            />
          );
        })}

        {/* the disease that reshaped the gene pool, marked as a bracket */}
        <g opacity={enter(frame, N.rust - 4, 20)}>
          <path
            d={`M990 758 L990 748 L1764 748 L1764 758`}
            fill="none"
            stroke={theme.robusta}
            strokeWidth={1.6}
            opacity={0.7}
          />
          <text x={990} y={738} fill={theme.robusta} fontSize={20} letterSpacing={1}>
            抗病分支 · 起点是帝汶岛上阿拉比卡与罗布斯塔的自然杂交
          </text>
        </g>

        {NODES.map((n) => {
          const t = enter(frame, n.appear, 16);
          if (t <= 0.01) return null;
          const x = COL[n.col];
          const y = ROW[n.row];
          const hot = n.hot !== undefined ? enter(frame, n.hot, 16) * (1 - enter(frame, n.hot + 70, 30) * 0.4) : 0;
          return (
            <g key={n.id} opacity={t}>
              <rect
                x={x}
                y={y}
                width={NW}
                height={NH}
                rx={9}
                fill="rgba(16,11,7,0.95)"
                stroke={n.color}
                strokeWidth={1.5 + hot * 1.5}
                strokeOpacity={0.55 + hot * 0.45}
              />
              <text x={x + 14} y={y + 24} fill={n.color} fontSize={20} fontWeight={600}>
                {n.title}
              </text>
              <text x={x + 14} y={y + 45} fill={theme.textDim} fontSize={15.5}>
                {n.sub}
              </text>
              {n.stub ? (
                <g opacity={0.7}>
                  <line x1={x - 54} x2={x} y1={y + NH / 2} y2={y + NH / 2} stroke={theme.wild} strokeWidth={1.3} strokeDasharray="5 5" />
                  <text x={x - 62} y={y + NH / 2 - 11} fill={theme.wild} fontSize={16} textAnchor="end">
                    {n.stub}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* beat commentary, pinned to the one region of the canvas no node touches */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 660,
          width: 540,
          opacity: note ? 1 : 0,
        }}
      >
        {note ? (
          <div
            key={note.head}
            style={{
              borderLeft: `3px solid ${note.color}`,
              paddingLeft: 22,
              opacity: enter(frame, note.at - 8, 16),
            }}
          >
            <div style={{color: note.color, fontSize: 26, fontWeight: 700, letterSpacing: 1}}>{note.head}</div>
            <div style={{color: theme.textDim, fontSize: 21, marginTop: 10, lineHeight: 1.5}}>{note.body}</div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 800,
          opacity: close,
          fontSize: 27,
          letterSpacing: 1,
          transform: `translateY(${(1 - close) * 12}px)`,
        }}
      >
        <span style={{color: theme.bred}}>品种决定风味的上限</span>
        <span style={{color: theme.textFaint, margin: '0 12px'}}>·</span>
        <span style={{color: theme.altitude}}>海拔负责兑现</span>
      </div>
    </div>
  );
};
