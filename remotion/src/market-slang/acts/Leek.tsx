import React from 'react';
import {View} from '../camera';
import {candles} from '../chart';
import {makeProjector} from '../components/ChartCanvas';
import {enter, track} from '../components/primitives';
import {line, sceneStart} from '../timing';
import {theme} from '../theme';

const EVENTS_PEAK_DAY = 72;

const L = (n: number) => line('leek', n).startFrame;

/** One schematic cycle, normalised to a 0..1 box: rise, plateau, fall, return. */
const CYCLE: Array<[number, number]> = [
  [0, 0.2],
  [0.12, 0.38],
  [0.26, 0.74],
  [0.36, 0.94],
  [0.46, 0.88],
  [0.56, 0.9],
  [0.68, 0.52],
  [0.8, 0.14],
  [0.9, 0.1],
  [1, 0.2],
];

const cyclePath = (x: number, y: number, w: number, h: number): string =>
  CYCLE.map(([t, v], i) => `${i === 0 ? 'M' : 'L'} ${x + t * w} ${y + (1 - v) * h}`).join(' ');

const cyclePoint = (t: number, x: number, y: number, w: number, h: number) => {
  for (let i = 0; i < CYCLE.length - 1; i++) {
    const [t0, v0] = CYCLE[i];
    const [t1, v1] = CYCLE[i + 1];
    if (t >= t0 && t <= t1) {
      const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const v = v0 + (v1 - v0) * k;
      return {x: x + t * w, y: y + (1 - v) * h};
    }
  }
  return {x, y};
};

/**
 * The cycle act. The chart is annotated once for real, then the structure is
 * lifted off it and repeated as schematic strip so "会自己重复" is something
 * the viewer sees rather than something the narration asserts. It closes by
 * taking the word apart to show the actor being quietly removed from it.
 */
export const Leek: React.FC<{frame: number; view: View}> = ({frame, view}) => {
  const p = makeProjector(view);

  const termIn = enter(frame, L(1), 14);
  const plainIn = enter(frame, L(3), 14);
  const annot = enter(frame, L(5), 16);
  const returning = enter(frame, L(9), 16);
  const strip = enter(frame, L(10), 22);
  const identity = enter(frame, L(12), 16);
  const second = enter(frame, L(14), 16);
  const cut = enter(frame, L(15), 18);
  const excuse = enter(frame, L(16), 16);

  /* the marker that walks one full cycle on the real chart */
  const walkDay = track(frame, [
    [L(5), 44],
    [L(6), EVENTS_PEAK_DAY],
    [L(7), 96],
    [L(8), 120],
    [L(9), 148],
    [L(9) + 40, EVENTS_PEAK_DAY],
    [L(10), EVENTS_PEAK_DAY],
  ]);

  const stages: Array<{n: number; title: string; sub: string; color: string}> = [
    {n: 5, title: '上涨', sub: '新账户被吸引进来', color: theme.up},
    {n: 6, title: '高位', sub: '老资金把筹码交出去', color: theme.predict},
    {n: 7, title: '下跌', sub: '新的持有人被洗出去', color: theme.down},
    {n: 8, title: '账户还在', sub: '人没走，账户也没销', color: theme.text},
  ];

  const stripX = 130;
  const stripY = 300;
  const tileW = 300;
  const tileH = 210;
  const tiles = 4;

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        {/* stage banners pinned along the real chart */}
        {annot > 0.01 && strip < 0.95 ? (
          <g opacity={annot * (1 - strip)}>
            {stages.map((s, i) => {
              const appear = enter(frame, L(s.n), 12);
              const day = [60, EVENTS_PEAK_DAY, 96, 122][i];
              const price = [10.9, 12.62, 9.5, 9.05][i];
              const ax = p.x(day);
              const ay = p.y(price);
              return (
                <g key={s.title} opacity={appear}>
                  <circle cx={ax} cy={ay} r={9} fill={s.color} />
                  <circle
                    cx={ax}
                    cy={ay}
                    r={22}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                  <text
                    x={ax}
                    y={ay - (i % 2 === 0 ? 42 : -58)}
                    textAnchor="middle"
                    fill={s.color}
                    fontFamily={theme.font}
                    fontSize={27}
                    fontWeight={700}
                  >
                    {s.title}
                  </text>
                  <text
                    x={ax}
                    y={ay - (i % 2 === 0 ? 16 : -84)}
                    textAnchor="middle"
                    fill={theme.textDim}
                    fontFamily={theme.font}
                    fontSize={21}
                  >
                    {s.sub}
                  </text>
                </g>
              );
            })}
            {/* the same person coming back for the next round */}
            <circle
              cx={p.x(walkDay)}
              cy={p.y(candles[Math.max(0, Math.min(candles.length - 1, Math.round(walkDay)))].close)}
              r={13}
              fill={theme.focus}
              opacity={returning}
            />
          </g>
        ) : null}
      </svg>

      {/* ---- the term itself ------------------------------------------- */}
      {termIn > 0.01 && strip < 0.6 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 240,
            textAlign: 'center',
            opacity: termIn * (1 - strip),
          }}
        >
          <div style={{color: theme.textFaint, fontSize: 28, letterSpacing: 7, marginBottom: 16}}>
            这套语言里最有名的一个词
          </div>
          <div style={{color: theme.text, fontSize: 118, fontWeight: 800, letterSpacing: 12}}>
            割韭菜
          </div>
        </div>
      ) : null}

      {plainIn > 0.01 && strip < 0.6 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 430,
            textAlign: 'center',
            opacity: plainIn * (1 - strip),
          }}
        >
          <div style={{color: theme.textDim, fontSize: 34, letterSpacing: 1.5}}>
            大部分人的理解是"散户又亏钱了"
          </div>
          <div
            style={{
              marginTop: 20,
              color: theme.text,
              fontSize: 40,
              letterSpacing: 2,
              opacity: enter(frame, L(4), 14),
            }}
          >
            但这三个字，比这个<span style={{color: theme.predict}}>精确得多</span>
          </div>
        </div>
      ) : null}

      {/* ---- the repeated structure ------------------------------------ */}
      {strip > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(6,9,13,${strip * 0.8})`,
            }}
          />
          <svg
            width={1920}
            height={1080}
            viewBox="0 0 1920 1080"
            style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
          >
            <g opacity={strip}>
              {Array.from({length: tiles}).map((_, i) => {
                const tx = stripX + i * tileW;
                const appear = i === 0 ? 1 : enter(frame, L(10) + i * 16, 16);
                const isFirst = i === 0;
                return (
                  <g key={i} opacity={appear}>
                    <rect
                      x={tx}
                      y={stripY}
                      width={tileW}
                      height={tileH}
                      fill="rgba(255,255,255,0.026)"
                    />
                    <rect
                      x={tx}
                      y={stripY}
                      width={tileW}
                      height={tileH}
                      fill="none"
                      stroke={isFirst ? theme.predict : theme.panelEdge}
                      strokeWidth={isFirst ? 2 : 1}
                      strokeDasharray={isFirst ? undefined : '6 6'}
                    />
                    <path
                      d={cyclePath(tx + 12, stripY + 16, tileW - 24, tileH - 32)}
                      fill="none"
                      stroke={isFirst ? theme.predict : theme.textFaint}
                      strokeWidth={isFirst ? 4 : 3}
                      strokeLinecap="round"
                    />
                    {isFirst
                      ? ([
                          [0.06, '上涨'],
                          [0.42, '高位'],
                          [0.74, '下跌'],
                        ] as Array<[number, string]>).map(([t, label]) => {
                          const pt = cyclePoint(t, tx + 12, stripY + 16, tileW - 24, tileH - 32);
                          return (
                            <text
                              key={label}
                              x={pt.x}
                              y={pt.y - 16}
                              textAnchor="middle"
                              fill={theme.text}
                              fontFamily={theme.font}
                              fontSize={22}
                            >
                              {label}
                            </text>
                          );
                        })
                      : null}
                    <text
                      x={tx + tileW / 2}
                      y={stripY + tileH + 34}
                      textAnchor="middle"
                      fill={isFirst ? theme.predict : theme.textFaint}
                      fontFamily={theme.font}
                      fontSize={24}
                    >
                      {i === 0 ? '第一轮' : i === 1 ? '下一轮' : `再下一轮`}
                    </text>
                    {i > 0 ? (
                      <text
                        x={tx + tileW / 2}
                        y={stripY + tileH + 66}
                        textAnchor="middle"
                        fill={theme.textGhost}
                        fontFamily={theme.font}
                        fontSize={19}
                      >
                        示意
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {/* the same account travelling into the next round */}
              <circle
                cx={stripX + 12 + 1 * tileW}
                cy={cyclePoint(0.06, 0, stripY + 16, tileW - 24, tileH - 32).y}
                r={12}
                fill={theme.focus}
                opacity={returning}
              />
            </g>
          </svg>

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 168,
              textAlign: 'center',
              opacity: strip,
            }}
          >
            <div style={{fontSize: 44, color: theme.text, letterSpacing: 2}}>
              韭菜的特点是，割完一茬<span style={{color: theme.predict}}>还会再长一茬</span>
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 30,
                color: theme.textDim,
                letterSpacing: 1,
                opacity: enter(frame, L(11), 14),
              }}
            >
              因为老根还在土里 —— 账户还在，人也没走
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 620,
              textAlign: 'center',
              opacity: identity,
            }}
          >
            <div style={{fontSize: 38, color: theme.textDim, letterSpacing: 2}}>
              亏钱是一次<span style={{color: theme.text}}>事故</span>
            </div>
            <div style={{marginTop: 12, fontSize: 52, color: theme.text, letterSpacing: 3}}>
              韭菜是一种<span style={{color: theme.predict}}>身份</span>
            </div>
          </div>
        </>
      ) : null}

      {/* ---- taking the actor out of the word --------------------------- */}
      {second > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(6,9,13,${second * 0.86})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 246,
              textAlign: 'center',
              opacity: second,
            }}
          >
            <div style={{color: theme.textFaint, fontSize: 28, letterSpacing: 7, marginBottom: 26}}>
              这个比喻还有第二层
            </div>
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28}}>
              <div
                style={{
                  position: 'relative',
                  width: 190,
                  height: 190,
                  border: `3px ${cut > 0.4 ? 'dashed' : 'solid'} ${theme.predict}`,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 1 - cut * 0.72,
                }}
              >
                <span style={{color: theme.predict, fontSize: 108, fontWeight: 800}}>割</span>
                {cut > 0.35 ? (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -46,
                      color: theme.predict,
                      fontSize: 24,
                      letterSpacing: 2,
                      opacity: cut,
                    }}
                  >
                    谁在割？
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  width: 260,
                  height: 190,
                  border: `3px solid ${theme.down}`,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{color: theme.down, fontSize: 76, fontWeight: 800}}>韭菜</span>
              </div>
            </div>

            <div
              style={{
                marginTop: 96,
                fontSize: 42,
                color: theme.text,
                letterSpacing: 2,
                opacity: excuse,
              }}
            >
              把一件有责任方的事，说成了自然现象
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 30,
                color: theme.textDim,
                letterSpacing: 1,
                opacity: enter(frame, L(16), 16),
              }}
            >
              说"这是自然规律"，有时候是在替拿镰刀的人免责
            </div>
          </div>
        </>
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
            opacity: enter(frame, sceneStart('leek'), 12),
          }}
        >
          第四件 · 为什么会重复
        </div>
      ) : null}
    </div>
  );
};
