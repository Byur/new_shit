import React from 'react';
import {Easing, interpolate} from 'remotion';
import {at, sceneEnd} from '../timing';
import {theme} from '../theme';
import {LIVE, SUPPLY} from '../facts';
import {Kicker, ShareBar, Stat} from '../components/Dossier';
import {enter, pop, pulse, textScrim} from '../components/primitives';

export type ActProps = {frame: number};

const OUT = 16;

/* ================================================================== */
/* 1. hook — two numbers that are both true                            */
/* ================================================================== */

const Headline: React.FC<{
  frame: number;
  appear: number;
  exitAt: number;
  left: number;
  top: number;
  width: number;
  value: string;
  unit?: string;
  label: string;
  sub: string;
  color: string;
  flash?: number;
}> = ({frame, appear, exitAt, left, top, width, value, unit, label, sub, color, flash = 0}) => {
  const p = pop(frame, appear);
  const fade = interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  if (p * fade <= 0.01) return null;
  const glow = flash > 0 ? 0.5 + 0.5 * Math.sin(flash * Math.PI * 2) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        boxSizing: 'border-box',
        opacity: p * fade,
        transform: `scale(${0.94 + p * 0.06})`,
        fontFamily: theme.font,
        background: 'rgba(7,11,18,0.86)',
        border: `1px solid ${color}55`,
        borderTop: `3px solid ${color}`,
        borderRadius: 14,
        padding: '24px 30px 26px',
        boxShadow: `0 20px 60px rgba(0,0,0,0.6)${glow > 0 ? `, 0 0 ${28 + glow * 46}px ${color}55` : ''}`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
        <span
          style={{
            color,
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: -1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {unit ? <span style={{color: `${color}BB`, fontSize: 34, fontWeight: 600}}>{unit}</span> : null}
      </div>
      <div style={{color: theme.text, fontSize: 27, fontWeight: 700, marginTop: 14, lineHeight: 1.3}}>
        {label}
      </div>
      <div style={{color: theme.textFaint, fontSize: 19, marginTop: 8, lineHeight: 1.45}}>{sub}</div>
    </div>
  );
};

const Beat: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  text: string;
  sub?: string;
  top?: number;
  color?: string;
  size?: number;
}> = ({frame, appear, exitAt, text, sub, top = 400, color = theme.text, size = 62}) => {
  const p = enter(frame, appear, 16);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        top,
        textAlign: 'center',
        opacity: p * fade,
        transform: `translateY(${(1 - p) * 14}px)`,
        fontFamily: theme.font,
      }}
    >
      <div
        style={{
          color,
          fontSize: size,
          fontWeight: 800,
          letterSpacing: 3,
          lineHeight: 1.28,
          ...textScrim(),
        }}
      >
        {text}
      </div>
      {sub ? (
        <div
          style={{
            color: theme.textDim,
            fontSize: 27,
            marginTop: 20,
            letterSpacing: 1.4,
            lineHeight: 1.5,
            ...textScrim(),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};


/**
 * The film's one title beat. It exists because the narration opens 0.8 s in, and
 * a near-empty frame is the wrong way to spend that second: the viewer should
 * meet the subject and the data source before the first claim arrives.
 */
const Opening: React.FC<{frame: number}> = ({frame}) => {
  const a = interpolate(frame, [0, 4, 62, 88], [1, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (a <= 0.01) return null;
  const rise = interpolate(frame, [0, 26], [16, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        top: 318,
        textAlign: 'center',
        opacity: a,
        transform: `translateY(${rise}px)`,
        fontFamily: theme.font,
      }}
    >
      <div style={{color: theme.text, fontSize: 92, fontWeight: 800, letterSpacing: 8}}>
        厄尔尼诺与拉尼娜
      </div>
      <div style={{color: theme.textDim, fontSize: 34, letterSpacing: 5, marginTop: 24}}>
        一台重新分配降雨的机器
      </div>
      <div
        style={{
          width: 260,
          height: 2,
          background: `${theme.warm}66`,
          margin: '38px auto 30px',
        }}
      />
      <div style={{color: theme.textFaint, fontSize: 21, letterSpacing: 2}}>
        1950 – 2026 · 海温记录驱动的剖面与地图
      </div>
    </div>
  );
};

export const Hook: React.FC<ActProps> = ({frame}) => {
  return (
    <>
      <Opening frame={frame} />
      <Stat
        frame={frame}
        appear={at('hook', 0) + 46}
        exitAt={at('hook', 8)}
        left={150}
        top={228}
        width={520}
        value="2026-10-08"
        label="美国气候预测中心发布厄尔尼诺公告"
        sub="Niño-3.4 相对指数 +2.1 °C · 概率针对 RONI 三个月均值 ≥ +2.5 °C"
        color={theme.warm}
      />

      <Headline
        frame={frame}
        appear={at('hook', 1)}
        exitAt={at('hook', 9)}
        left={150}
        top={392}
        width={700}
        value="83"
        unit="%"
        label="本次事件达到「历史级」的概率"
        sub={`10–12 月窗口 · 概率随窗口变化：9–11 月 ${LIVE.cpc.probabilityByWindow[0].p}%，10–12 月 ${LIVE.cpc.historicProbability}%，11 月–次年 1 月 ${LIVE.cpc.probabilityByWindow[2].p}%`}
        color={theme.warm}
        flash={pulse(frame, at('hook', 2), 30)}
      />

      <Headline
        frame={frame}
        appear={at('hook', 4)}
        exitAt={at('hook', 9)}
        left={1070}
        top={392}
        width={700}
        value="2.5"
        unit="%"
        label="世界银行对 2026 年粮食价格的基准预测"
        sub="2026-04  Commodity Markets Outlook · 同一份报告写着「风险牢牢偏向上行」"
        color={theme.price}
        flash={pulse(frame, at('hook', 5), 30)}
      />

      {/* the gap, drawn */}
      {(() => {
        const a = enter(frame, at('hook', 6), 14) * (1 - interpolate(frame, [at('hook', 8) - OUT, at('hook', 8)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
        if (a <= 0.01) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: 880,
              top: 392,
              width: 160,
              opacity: a,
              textAlign: 'center',
              fontFamily: theme.font,
            }}
          >
            <svg width={160} height={120} viewBox="0 0 160 120">
              <line x1={80} y1={6} x2={80} y2={114} stroke={theme.textGhost} strokeWidth={1.6} strokeDasharray="6 6" />
              <path d="M 80 6 L 74 18 M 80 6 L 86 18" stroke={theme.textGhost} strokeWidth={1.6} />
              <path d="M 80 114 L 74 102 M 80 114 L 86 102" stroke={theme.textGhost} strokeWidth={1.6} />
            </svg>
            <div style={{color: theme.textDim, fontSize: 22, letterSpacing: 4, marginTop: -4}}>
              落差
            </div>
          </div>
        );
      })()}

      <Beat
        frame={frame}
        appear={at('hook', 8)}
        exitAt={at('hook', 11) - 10}
        top={352}
        text="先说一个几乎所有人都搞错的点"
        color={theme.text}
        size={54}
      />

      <Beat
        frame={frame}
        appear={at('hook', 10)}
        exitAt={at('hook', 11)}
        top={330}
        text="不是两种灾害 · 是同一台机器的两个档位"
        sub="厄尔尼诺不是地球发烧，拉尼娜也不是地球着凉"
        color={theme.warm}
        size={58}
      />

      <Beat
        frame={frame}
        appear={at('hook', 11)}
        top={352}
        text="它不生产热 · 它只做一件事：重新分配"
        sub="重新分配的，最后是雨 —— 以及跟着雨走的钱"
        color={theme.text}
        size={54}
      />
    </>
  );
};

/* ================================================================== */
/* 2. machine — the cross-section                                      */
/* ================================================================== */

const EpisodeTag: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  text: string;
  note: string;
  color: string;
}> = ({frame, appear, exitAt, text, note, color}) => {
  const p = enter(frame, appear, 13);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 150,
        opacity: p * fade,
        transform: `translateX(${(1 - p) * -16}px)`,
        borderLeft: `4px solid ${color}`,
        paddingLeft: 16,
        fontFamily: theme.font,
      }}
    >
      <div style={{color, fontSize: 34, fontWeight: 800, letterSpacing: 2.5}}>{text}</div>
      <div style={{color: theme.textFaint, fontSize: 18, marginTop: 5, letterSpacing: 0.6}}>{note}</div>
    </div>
  );
};

/**
 * The predictability panel.
 *
 * The numbers are variance explained for the following November-January
 * Niño-3.4, by the month the forecast was initialised (Barnston et al. 2012,
 * BAMS 93:631-651, 20-model hindcast 2002-2011). They are the reason a market
 * has anything to price at all, so they get a graphic rather than an adjective.
 */
const SkillPanel: React.FC<{frame: number; appear: number; exitAt?: number}> = ({frame, appear, exitAt}) => {
  const rows = [
    {init: '2–4 月初始', skill: 33, label: '≤ 33%（上限）', note: '统计模式接近 0：这是预报的空档', color: theme.dry},
    {init: '5 月初始', skill: 50, label: '50%', note: '刚跨过春季障碍，技巧有限', color: '#C79A5A'},
    {init: '7–8 月初始', skill: 75, label: '75%', note: '事件已成形，技巧回升', color: '#8FB07A'},
    {init: '10 月初始', skill: 90, label: '90%', note: '能解释次年 11 月–1 月海温变化的九成', color: theme.wet},
  ];
  const p = enter(frame, appear, 16);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 300,
        top: 168,
        width: 1320,
        opacity: p * fade,
        transform: `translateY(${(1 - p) * 12}px)`,
        background: 'rgba(6,10,17,0.93)',
        border: `1px solid ${theme.panelEdge}`,
        borderRadius: 14,
        padding: '24px 32px 26px',
        fontFamily: theme.font,
        boxShadow: '0 24px 70px rgba(0,0,0,0.66)',
      }}
    >
      <div style={{color: theme.text, fontSize: 30, fontWeight: 800, letterSpacing: 2}}>
        同一个模式，不同的起报月份，技巧差一倍
      </div>
      <div style={{color: theme.textFaint, fontSize: 18, marginTop: 7, lineHeight: 1.45}}>
        预报技巧：模式能解释次年 11 月–1 月 Niño-3.4 海温变化的百分比 · 20 个模式 2002–2011 年回报检验
      </div>

      <div style={{marginTop: 22}}>
        {rows.map((r, i) => {
          const rp = enter(frame, appear + 8 + i * 9, 12);
          const barW = 660 * (r.skill / 100) * rp;
          return (
            <div key={r.init} style={{display: 'flex', alignItems: 'center', gap: 18, height: 74}}>
              <div style={{width: 170, color: theme.textDim, fontSize: 21, textAlign: 'right'}}>{r.init}</div>
              <div
                style={{
                  position: 'relative',
                  width: 660,
                  height: 30,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: barW,
                    height: '100%',
                    background: `linear-gradient(90deg, ${r.color}CC, ${r.color}66)`,
                    borderRight: `2px solid ${r.color}`,
                  }}
                />
              </div>
              <div
                style={{
                  width: 96,
                  color: r.color,
                  fontSize: 27,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  opacity: rp,
                }}
              >
                {r.label}
              </div>
              <div style={{flex: 1, color: theme.textFaint, fontSize: 17, opacity: rp, lineHeight: 1.35}}>
                {r.note}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{color: theme.textGhost, fontSize: 16, marginTop: 16, lineHeight: 1.5}}>
        春季可预报性障碍：北半球春季太平洋海温梯度最弱、海气耦合最松，预报准确率出现低谷。它是一段低谷，不是一堵墙。
        <br />
        据：Barnston et al. 2012, BAMS 93:631–651 · NOAA Climate.gov（L'Heureux, 2015）· Ehsan et al. 2024, npj Clim. Atmos. Sci.
      </div>
    </div>
  );
};

export const Machine: React.FC<ActProps> = ({frame}) => {
  const elNinoTag =
    frame >= at('machine', 15) && frame < at('machine', 23)
      ? {text: '1997–98 厄尔尼诺', note: '光标正沿真实海温记录行进 · 1997 年 12 月达到 +2.37 °C', color: theme.warm}
      : frame >= at('machine', 23) && frame < at('machine', 27)
        ? {text: '2010–11 拉尼娜', note: '同一台机器换到另一档 · 2011 年 1 月低至 −1.57 °C', color: theme.cold}
        : frame >= at('machine', 27) && frame < at('machine', 34)
          ? {
              text: '1972 → 1974',
              note: '记录里最剧烈的换档：1972 年 11 月的 +1.84 °C，到 1973 年 12 月的 −2.04 °C，相隔 13 个月',
              color: theme.warm,
            }
          : null;

  const monotony = frame >= at('machine', 2) && frame < at('machine', 15);

  return (
    <>
      {monotony ? (
        <Kicker
          frame={frame}
          appear={at('machine', 2)}
          exitAt={at('machine', 15) - 8}
          left={120}
          top={152}
          text="赤道剖面 · 从苏门答腊到南美洲西岸"
          color={theme.textDim}
          size={24}
        />
      ) : null}

      {elNinoTag ? (
        <EpisodeTag
          frame={frame}
          appear={
            frame < at('machine', 23) ? at('machine', 15) : frame < at('machine', 27) ? at('machine', 23) : at('machine', 27)
          }
          exitAt={
            frame < at('machine', 23)
              ? at('machine', 23)
              : frame < at('machine', 27)
                ? at('machine', 27)
                : at('machine', 34) - 6
          }
          text={elNinoTag.text}
          note={elNinoTag.note}
          color={elNinoTag.color}
        />
      ) : null}

      {/* the oscillator beat: show the swing magnitude as a number, not a vibe */}
      <Stat
        frame={frame}
        appear={at('machine', 29)}
        exitAt={at('machine', 34) - 6}
        left={1320}
        top={150}
        width={480}
        value="+1.84 → −2.04"
        unit="°C"
        label="同一次换档，12 个月，3.88 °C"
        sub="正反馈把它推过去，延迟的负反馈把它拉回来 —— 这就是振荡器"
        color={theme.cold}
      />

      <SkillPanel frame={frame} appear={at('machine', 35)} exitAt={sceneEnd('machine') + 40} />

      <Stat
        frame={frame}
        appear={at('machine', 38)}
        exitAt={sceneEnd('machine') + 40}
        left={300}
        top={640}
        width={520}
        value="≈6"
        unit="个月"
        label="有真实技巧的预报时效"
        sub="有效技巧约半年，超过 9 个月明显退化。能被提前看到，但看不远 —— 市场就是围着这一点转的。"
        color={theme.price}
      />
    </>
  );
};

/* ================================================================== */
/* 3. teleconnect — the same rain, on a map of suppliers               */
/* ================================================================== */

const ANOMALIES = [
  {lon: 112, lat: -2, rx: 20, ry: 13, kind: 'dry' as const, label: '印尼'},
  {lon: 134, lat: -24, rx: 20, ry: 13, kind: 'dry' as const, label: '澳大利亚'},
  {lon: 78, lat: 21, rx: 16, ry: 12, kind: 'dry' as const, label: '印度'},
  {lon: 101, lat: 16, rx: 12, ry: 10, kind: 'dry' as const, label: '中南半岛'},
  {lon: 26, lat: -22, rx: 17, ry: 12, kind: 'dry' as const, label: '非洲南部'},
  {lon: -83, lat: 9, rx: 10, ry: 7, kind: 'dry' as const, label: '巴拿马'},
  {lon: 200, lat: 0, rx: 26, ry: 11, kind: 'wet' as const, label: '赤道中太平洋'},
  {lon: -78, lat: -5, rx: 12, ry: 10, kind: 'wet' as const, label: '秘鲁 · 厄瓜多尔'},
  {lon: -58, lat: -28, rx: 16, ry: 12, kind: 'wet' as const, label: '巴西南部'},
  {lon: 44, lat: 6, rx: 12, ry: 9, kind: 'wet' as const, label: '非洲之角'},
];

const SHARE_FOR_MAP: Record<string, {left: number; top: number}> = {
  palm: {left: 140, top: 200},
  coal: {left: 140, top: 300},
  cocoa: {left: 140, top: 400},
  coffee: {left: 140, top: 500},
  rice: {left: 140, top: 600},
};

export const Teleconnect: React.FC<ActProps> = ({frame}) => {
  return (
    <>
      {frame < at('teleconnect', 4) ? (
        <Kicker
          frame={frame}
          appear={at('teleconnect', 1)}
          exitAt={at('teleconnect', 4) - 6}
          left={140}
          top={200}
          text="同一场雨 · 换了一张地图看"
          color={theme.textDim}
          size={26}
        />
      ) : null}

      {/* the rainfall ledger: who dries, who floods */}
      <div
        style={{
          position: 'absolute',
          left: 1440,
          top: 150,
          width: 360,
          opacity: enter(frame, at('teleconnect', 6), 16) * (1 - enter(frame, at('teleconnect', 13), 14)),
          fontFamily: theme.font,
        }}
      >
        <div style={{color: theme.text, fontSize: 22, fontWeight: 800, letterSpacing: 1.6, marginBottom: 12}}>
          一次强厄尔尼诺的雨账本
        </div>
        {ANOMALIES.map((a, i) => {
          const p = enter(frame, at('teleconnect', 6) + i * 5, 12);
          return (
            <div
              key={a.label}
              style={{display: 'flex', alignItems: 'center', gap: 9, opacity: p, marginBottom: 7}}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 9,
                  background: a.kind === 'wet' ? theme.wet : theme.dry,
                  flex: '0 0 9px',
                }}
              />
              <span style={{color: theme.textDim, fontSize: 18, width: 132}}>{a.label}</span>
              <span style={{color: a.kind === 'wet' ? theme.wet : theme.dry, fontSize: 17, fontWeight: 700}}>
                {a.kind === 'wet' ? '偏湿' : '偏干'}
              </span>
            </div>
          );
        })}
        <div style={{color: theme.textGhost, fontSize: 15, marginTop: 10, lineHeight: 1.45}}>
          据：WMO 季节气候展望 2026-10 · NOAA CPC · 非洲之角为反例：1997 与 2023 年均为偏湿
        </div>
      </div>

      {/* the concentration ledger: the door into a market */}
      {frame >= at('teleconnect', 13) ? (
        <>
          <Kicker
            frame={frame}
            appear={at('teleconnect', 13)}
            left={140}
            top={148}
            text="经济地图：这台机器的入口是集中度"
            color={theme.price}
            size={26}
          />
          {SUPPLY.map((sh, i) => {
            const box = SHARE_FOR_MAP[sh.key];
            if (!box) return null;
            return (
              <ShareBar
                key={sh.key}
                frame={frame}
                appear={at('teleconnect', 14) + i * 9}
                left={box.left}
                top={box.top}
                width={820}
                label={sh.label}
                who={sh.countries}
                share={sh.share}
                of={sh.of}
                color={sh.key === 'coal' ? theme.cold : theme.price}
                progress={enter(frame, at('teleconnect', 14) + i * 9 + 4, 22)}
              />
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 1030,
              top: 200,
              width: 440,
              color: theme.textFaint,
              fontSize: 17,
              lineHeight: 1.55,
              fontFamily: theme.font,
              opacity: enter(frame, at('teleconnect', 14), 18),
            }}
          >
            分母比分子重要。
            <br />
            「占全球产量 60%」和「占全球出口 40%」是两件事：产量可以被库存吸收，出口不能。
            <br />
            <br />
            当一个产区同时满足「份额高」和「库存薄」，一次海温变化才有机会走到价格上。
          </div>
        </>
      ) : null}
    </>
  );
};
