import React from 'react';
import {L, sceneEnd, sceneStart} from '../timing';
import {enter, leave} from '../components/primitives';
import {LAYOUT, theme} from '../theme';
import {ActTitle} from '../components/panels';

const ATTRIBUTES = [
  '干湿香', '风味', '余韵', '酸质', '醇厚度',
  '一致性', '平衡感', '干净度', '甜感', '整体评价',
];

const QUESTIONS = [
  {q: '什么物种', hint: '阿拉比卡 / 罗布斯塔', color: theme.arabica},
  {q: '什么品种', hint: 'Typica 系 / Bourbon 系 / 杂交', color: theme.bred},
  {q: '长在多高', hint: '海拔 × 纬度 → 年均温', color: theme.altitude},
  {q: '怎么处理', hint: '水洗 / 日晒 / 蜜处理 / 湿刨', color: theme.washed},
];

/**
 * The close. A score is somebody else's tongue; the four rows on the back of
 * the bag are something the viewer can now reason with unaided, which is the
 * only promise the film made at the top and therefore the only one it has to
 * keep.
 */
export const Coda: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(
    enter(frame, sceneStart('coda') - 4, 18),
    leave(frame, sceneEnd('coda') + 10, 24),
  );
  if (op <= 0.01) return null;

  const scale = enter(frame, L('coda', 1) - 12, 22);
  const premium = enter(frame, L('coda', 3) - 8, 18);
  const contrast = enter(frame, L('coda', 4) - 8, 20);
  const questions = enter(frame, L('coda', 6) - 18, 22);
  const close = enter(frame, L('coda', 8), 22);

  const ax = 300;
  const aw = 1320;
  const ay = 350;
  const px = (score: number) => ax + ((score - 60) / 40) * aw;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: theme.font, pointerEvents: 'none'}}>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0}}
      >
        <ActTitle frame={frame} appear={sceneStart('coda') - 10} text="收束" sub="分数是别人的舌头，四行字是你能自己推的" />

        {/* the cupping scale, and the line that turns flavour into money */}
        <g opacity={scale}>
          <text x={ax} y={ay - 46} fill={theme.text} fontSize={26} letterSpacing={2}>
            SCA 杯测 · 十项评分加总，满分 100
          </text>
          <text x={ax} y={ay - 18} fill={theme.textFaint} fontSize={18} letterSpacing={1}>
            2024 年起 SCA 已改用 Coffee Value Assessment；80 分线沿用旧协议
          </text>
          <defs>
            <linearGradient id="scoreScale" x1="0" x2="1">
              <stop offset="0%" stopColor={theme.textFaint} />
              <stop offset="50%" stopColor={theme.arabica} />
              <stop offset="100%" stopColor={theme.score} />
            </linearGradient>
          </defs>
          <rect x={ax} y={ay} width={aw} height={30} rx={6} fill="url(#scoreScale)" opacity={0.32} />
          <rect x={ax} y={ay} width={aw * ((80 - 60) / 40)} height={30} rx={6} fill={theme.score} opacity={0.55} />
          <rect x={px(80)} y={ay - 16} width={3} height={62} fill={theme.score} />
          <text x={px(80)} y={ay - 28} fill={theme.score} fontSize={30} fontWeight={700} textAnchor="middle">
            80 · 精品咖啡线
          </text>
          {[60, 70, 80, 90, 100].map((s) => (
            <text key={s} x={px(s)} y={ay + 60} fill={theme.textFaint} fontSize={20} textAnchor="middle" fontFamily={theme.mono}>
              {s}
            </text>
          ))}
          {ATTRIBUTES.map((a, i) => (
            <g key={a} opacity={enter(frame, L('coda', 1) - 6 + i * 4, 14)}>
              <rect x={ax + i * 132} y={ay + 88} width={120} height={38} rx={8} fill="rgba(255,255,255,0.04)" stroke={theme.panelEdge} />
              <text x={ax + i * 132 + 60} y={ay + 114} fill={theme.textDim} fontSize={19} textAnchor="middle">
                {a}
              </text>
            </g>
          ))}
        </g>

        <g opacity={premium}>
          <text x={ax + aw} y={ay + 60} fill={theme.price} fontSize={22} textAnchor="end">
            分数 → 溢价 → 拍卖价
          </text>
          <text x={ax} y={ay + 176} fill={theme.textDim} fontSize={22}>
            分数是行业把主观风味变成可交易数字的方式：同一批生豆，分差 3 分，成交价可能差一倍。
          </text>
        </g>

        {/* what the viewer gets to keep */}
        <g opacity={contrast}>
          <rect x={150} y={548} width={800} height={104} rx={12} fill="rgba(255,255,255,0.02)" stroke={theme.panelEdge} />
          <text x={182} y={590} fill={theme.textFaint} fontSize={22} letterSpacing={1}>
            杯测分数
          </text>
          <text x={182} y={626} fill={theme.textDim} fontSize={23}>
            是别人的舌头给出的结论，你无法复算
          </text>
          <rect x={966} y={548} width={840} height={104} rx={12} fill="rgba(227,163,74,0.09)" stroke={theme.arabica} strokeWidth={1.4} />
          <text x={998} y={590} fill={theme.arabica} fontSize={22} letterSpacing={1}>
            背面那四行
          </text>
          <text x={998} y={626} fill={theme.text} fontSize={23}>
            是你可以自己推的因果链
          </text>
        </g>

        {/* the four questions, which are the film in one line */}
        <g opacity={questions}>
          {QUESTIONS.map((q, i) => {
            const t = enter(frame, L('coda', 6) - 16 + i * 10, 18);
            const x = 150 + i * 424;
            return (
              <g key={q.q} opacity={t}>
                <rect x={x} y={690} width={396} height={128} rx={12} fill={`${q.color}14`} stroke={q.color} strokeWidth={1.6} />
                <text x={x + 24} y={738} fill={q.color} fontSize={30} fontWeight={700} letterSpacing={2}>
                  {q.q}
                </text>
                <text x={x + 24} y={782} fill={theme.textDim} fontSize={19}>
                  {q.hint}
                </text>
              </g>
            );
          })}
        </g>

        <g opacity={close}>
          <text x={960} y={944} fill={theme.text} fontSize={46} textAnchor="middle" letterSpacing={4} fontWeight={700}>
            产地只是一个缩写
          </text>
          <text x={960} y={1004} fill={theme.textDim} fontSize={27} textAnchor="middle" letterSpacing={2}>
            真正决定风味的，是那个缩写背后没有写出来的东西
          </text>
        </g>
      </svg>
    </div>
  );
};
