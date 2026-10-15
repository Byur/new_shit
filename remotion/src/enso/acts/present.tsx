import React from 'react';
import {Easing, interpolate} from 'remotion';
import {at, sceneEnd} from '../timing';
import {theme} from '../theme';
import {LIVE, MARKET_2026} from '../facts';
import {Gates} from '../components/Gates';
import {Kicker, Stat} from '../components/Dossier';
import {enter} from '../components/primitives';

export type ActProps = {frame: number};

const OUT = 16;

const fadeOut = (frame: number, exitAt?: number) =>
  exitAt === undefined
    ? 1
    : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
      });

/* ================================================================== */
/* 7. split — one El Nino, two directions                              */
/* ================================================================== */

const MarketBoard: React.FC<{frame: number; appear: number; exitAt?: number}> = ({frame, appear, exitAt}) => {
  const fade = fadeOut(frame, exitAt);
  if (fade <= 0.01) return null;

  const up = MARKET_2026.filter((m) => m.change > 0);
  const down = MARKET_2026.filter((m) => m.change <= 0);

  const Column: React.FC<{title: string; color: string; rows: typeof MARKET_2026; side: 'left' | 'right'}> = ({
    title,
    color,
    rows,
    side,
  }) => (
    <div style={{width: 800}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
          opacity: enter(frame, appear + (side === 'left' ? 0 : 6), 14),
        }}
      >
        <span style={{color, fontSize: 30, fontWeight: 800, letterSpacing: 2}}>{title}</span>
        <span style={{height: 2, flex: 1, background: `${color}55`}} />
      </div>
      {rows.map((m, i) => {
        const p = enter(frame, appear + 8 + i * 9 + (side === 'left' ? 0 : 5), 13);
        return (
          <div
            key={m.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 16px',
              marginBottom: 9,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${theme.panelEdge}`,
              borderLeft: `4px solid ${color}`,
              opacity: p * fade,
              transform: `translateX(${(1 - p) * (side === 'left' ? -14 : 14)}px)`,
            }}
          >
            <div style={{width: 176}}>
              <div style={{color: theme.text, fontSize: 23, fontWeight: 700, letterSpacing: 0.6}}>{m.name}</div>
              <div style={{color: theme.textGhost, fontSize: 15, fontVariantNumeric: 'tabular-nums'}}>
                {m.level} {m.unit}
              </div>
            </div>
            <div
              style={{
                width: 116,
                color,
                fontSize: 30,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -0.5,
              }}
            >
              {m.change > 0 ? '+' : ''}
              {m.change.toFixed(1)}%
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{color: theme.textDim, fontSize: 15, lineHeight: 1.35}}>{m.driver}</div>
              <div style={{color: theme.textGhost, fontSize: 14, marginTop: 3}}>{m.window}</div>
            </div>
            <div
              style={{
                color: theme.textGhost,
                fontSize: 15,
                border: `1px solid ${theme.panelEdge}`,
                borderRadius: 5,
                padding: '1px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              闸门 {['①', '②', '③', '④'][m.gate - 1]}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 186,
        width: 1680,
        display: 'flex',
        gap: 80,
        fontFamily: theme.font,
        opacity: fade,
      }}
    >
      <Column title="涨" color={theme.dry} rows={up} side="left" />
      <Column title="跌" color={theme.wet} rows={down} side="right" />
    </div>
  );
};

export const Split: React.FC<ActProps> = ({frame}) => {
  const A = (l: number) => at('split', l);

  return (
    <>

      <Kicker
        frame={frame}
        appear={A(1)}
        exitAt={A(11)}
        left={140}
        top={148}
        text="2026 · 1950 年以来最强厄尔尼诺的开头"
        color={theme.warm}
        size={28}
      />

      <MarketBoard frame={frame} appear={A(3)} exitAt={A(11)} />

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 760,
          width: 1680,
          textAlign: 'center',
          opacity: enter(frame, A(8), 18) * fadeOut(frame, A(11)),
          fontFamily: theme.font,
        }}
      >
        <div style={{color: theme.warm, fontSize: 36, fontWeight: 800, letterSpacing: 3}}>
          厄尔尼诺不制造涨价 · 它只做一件事：搬雨
        </div>
      </div>

      {/* the explanation: same phase, three different outcomes */}
      <Stat
        frame={frame}
        appear={A(11)}
        exitAt={A(18)}
        left={140}
        top={200}
        width={520}
        value="−15%"
        label="2026 年印度季风降雨距平"
        sub="2009 年以来最弱。印度占全球大米出口 40% 以上，产量下调约 700 万吨，因此大米涨 61.5%。"
        color={theme.dry}
      />

      <Stat
        frame={frame}
        appear={A(13)}
        exitAt={A(18)}
        left={140}
        top={404}
        width={520}
        value="+19.6%"
        label="2026 年巴西咖啡收成，6760 万袋，历史最高"
        sub="雨被搬到了这里。所以同样在这一年，阿拉比卡咖啡同比跌 24.5%。"
        color={theme.wet}
      />

      <Stat
        frame={frame}
        appear={A(16)}
        exitAt={A(18)}
        left={140}
        top={608}
        width={520}
        value="351"
        unit="万吨"
        label="2026 年 9 月马来西亚棕榈油库存，历史最高"
        sub="雨确实少了，但库存连续 6 个月上升，把干旱的影响吸收掉了。所以棕榈油不涨。"
        color={theme.price}
      />

      <div
        style={{
          position: 'absolute',
          left: 740,
          top: 200,
          width: 460,
          opacity: enter(frame, A(9), 16) * fadeOut(frame, A(18)),
          fontFamily: theme.font,
          background: 'rgba(6,10,17,0.9)',
          border: `1px solid ${theme.panelEdge}`,
          borderRadius: 12,
          padding: '18px 22px',
        }}
      >
        <div style={{color: theme.text, fontSize: 23, fontWeight: 800, letterSpacing: 1.4, marginBottom: 12}}>
          价格看到的，是三道减法
        </div>
        {[
          '雨被搬走的产区：减产 → 上行压力',
          '雨被搬到的产区：增产 → 下行压力',
          '两者相抵之后，再减去库存能吸收的部分',
        ].map((t, i) => (
          <div
            key={t}
            style={{
              color: theme.textDim,
              fontSize: 19,
              lineHeight: 1.45,
              marginBottom: 10,
              opacity: enter(frame, A(9) + i * 9, 13),
            }}
          >
            {i + 1}. {t}
          </div>
        ))}
      </div>

      {/* the tool */}
      <Gates
        frame={frame}
        appear={A(18)}
        exitAt={sceneEnd('split') + 34}
        box={{left: 120, top: 178, width: 1120}}
        /*
          `lit` counts introduced gates, so it has to follow the line that
          introduces them. A(21) is "第三，库存有多薄。第四，市场提前定价了
          多少。" — two gates in one line, exactly like A(20)'s "第一…第二…".
          Lighting only three there left the fourth gate dimmed to 0.4 opacity
          for the whole five seconds in which the narration names it.
        */
        lit={frame >= A(21) ? 4 : frame >= A(20) ? 2 : 1}
        focus={frame >= A(20) && frame < A(21) ? 1 : frame >= A(21) && frame < A(22) ? 2 : frame >= A(22) && frame < A(23) ? 3 : null}
        title="一次气候冲击要走到价格上，必须连过四道闸门"
      />

      <div
        style={{
          position: 'absolute',
          left: 1290,
          top: 214,
          width: 510,
          opacity: enter(frame, A(22), 16) * fadeOut(frame, sceneEnd('split') + 34),
          fontFamily: theme.font,
        }}
      >
        <div style={{color: theme.price, fontSize: 26, fontWeight: 800, letterSpacing: 1.4, marginBottom: 14}}>
          缺任何一道，它可能什么都不发生
        </div>
        <div style={{color: theme.textDim, fontSize: 19, lineHeight: 1.55, marginBottom: 16}}>
          反过来也成立：只有第三、第四道闸门同时关着，一个被充分预报的强事件才可能几乎不留下价格痕迹。
          2026 年的咖啡和棕榈油，就是这两道闸门关着的样子。
        </div>
        <div style={{color: theme.textFaint, fontSize: 17, lineHeight: 1.5}}>
          注意「涨」和「跌」不是这一相的两个方向，而是同一场雨在不同产区的两个结果。这就是为什么用「厄尔尼诺利好什么」来问问题，永远得不到答案。
        </div>
      </div>
    </>
  );
};

/* ================================================================== */
/* 8. live — the forecast, and what it can and cannot say              */
/* ================================================================== */

const WarnTimeline: React.FC<{frame: number; appear: number; exitAt?: number}> = ({frame, appear, exitAt}) => {
  const fade = fadeOut(frame, exitAt);
  if (fade <= 0.01) return null;
  const seq = LIVE.warningSequence;
  const W = 1380;
  const step = W / (seq.length - 1);

  return (
    <div
      style={{
        position: 'absolute',
        left: 200,
        top: 190,
        width: 1560,
        opacity: fade,
        fontFamily: theme.font,
      }}
    >
      <div style={{color: theme.text, fontSize: 28, fontWeight: 800, letterSpacing: 2}}>
        机构的提前量：世界气象组织的连续预警
      </div>
      <div style={{position: 'relative', height: 250, marginTop: 30}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 96,
            width: W * enter(frame, appear + 6, 30),
            height: 2,
            background: `${theme.warm}88`,
          }}
        />
        {seq.map((w, i) => {
          const p = enter(frame, appear + 10 + i * 11, 14);
          const x = i * step;
          return (
            <div key={w.date} style={{position: 'absolute', left: x, top: 0, width: 220, opacity: p}}>
              <div
                style={{
                  position: 'absolute',
                  left: -5,
                  top: 90,
                  width: 12,
                  height: 12,
                  borderRadius: 12,
                  background: theme.warm,
                  boxShadow: `0 0 14px ${theme.warm}`,
                }}
              />
              <div
                style={{
                  color: theme.warm,
                  fontFamily: theme.mono,
                  fontSize: 18,
                  marginTop: 114,
                  letterSpacing: 0.5,
                }}
              >
                {w.date}
              </div>
              <div style={{color: theme.textDim, fontSize: 17, marginTop: 6, lineHeight: 1.4, width: 208}}>
                {w.text}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          opacity: enter(frame, appear + 66, 18),
          marginTop: -14,
        }}
      >
        <span style={{color: theme.price, fontSize: 34, fontWeight: 800, letterSpacing: 1}}>
          约 5 个月
        </span>
        <span style={{height: 2, width: 900, background: `${theme.price}55`}} />
        <span style={{color: theme.textFaint, fontSize: 18}}>
          从第一次公开预警，到预计的 12 月峰值
        </span>
      </div>
      {/* Every row needs its own entry gate. The container's `opacity` is only
          an exit envelope (fadeOut), so a row without `enter` renders at full
          opacity for the whole act — which is how this source line ended up on
          screen during the RiskCards and attribution beats. */}
      <div
        style={{
          color: theme.textGhost,
          fontSize: 16,
          marginTop: 14,
          lineHeight: 1.5,
          opacity: enter(frame, appear + 66, 18),
        }}
      >
        据：WMO 新闻稿序列 2026-04-24 / 06-02 / 07-03 / 07-31 / 09-03。这五个月，就是市场可以提前定价的时间。
      </div>
    </div>
  );
};

const RiskCards: React.FC<{frame: number; appear: number; exitAt?: number}> = ({frame, appear, exitAt}) => {
  const fade = fadeOut(frame, exitAt);
  if (fade <= 0.01) return null;
  return (
    <div style={{position: 'absolute', left: 200, top: 200, width: 1520, opacity: fade, fontFamily: theme.font}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 20,
          opacity: enter(frame, appear, 16),
        }}
      >
        <span style={{color: theme.text, fontSize: 30, fontWeight: 800, letterSpacing: 2}}>
          世界银行的基准是 2.5%，然后它列了四个上行风险
        </span>
      </div>
      <div style={{display: 'flex', gap: 22, marginTop: 34}}>
        {LIVE.worldBank.upsideRisks.map((r, i) => {
          const p = enter(frame, appear + 8 + i * 12, 14);
          return (
            <div
              key={r}
              style={{
                flex: 1,
                padding: '26px 22px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${theme.panelEdge}`,
                borderTop: `3px solid ${theme.dry}`,
                opacity: p,
                transform: `translateY(${(1 - p) * 12}px)`,
              }}
            >
              <div style={{color: theme.dry, fontSize: 34, fontWeight: 800}}>{['①', '②', '③', '④'][i]}</div>
              <div style={{color: theme.text, fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1.35}}>
                {r}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 34,
          color: theme.textDim,
          fontSize: 21,
          lineHeight: 1.55,
          opacity: enter(frame, appear + 60, 16),
        }}
      >
        任何一个单独出现，市场都能消化。麻烦的是它们同时出现 —— 因为出口限制会放大其他所有冲击。
      </div>
      <div
        style={{
          color: theme.textGhost,
          fontSize: 17,
          marginTop: 18,
          lineHeight: 1.5,
          opacity: enter(frame, appear + 72, 18),
        }}
      >
        据：世界银行，2026-06-16；基准值来自 2026 年 4 月 Commodity Markets Outlook。2008 与 2022 年的经验都是：一旦有国家开始禁止出口，价格会跳得比基本面更高。
      </div>
    </div>
  );
};

export const Live: React.FC<ActProps> = ({frame}) => {
  const A = (l: number) => at('live', l);

  return (
    <>

      <WarnTimeline frame={frame} appear={A(4)} exitAt={A(11)} />

      <RiskCards frame={frame} appear={A(11)} exitAt={A(17)} />

      {/* the honest attribution section */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 196,
          width: 740,
          opacity: enter(frame, A(17), 16) * fadeOut(frame, sceneEnd('live') + 30),
          fontFamily: theme.font,
          background: 'rgba(6,10,17,0.92)',
          border: `1px solid ${theme.panelEdge}`,
          borderRadius: 14,
          padding: '22px 26px',
        }}
      >
        <div style={{color: theme.textFaint, fontSize: 18, letterSpacing: 3}}>归因 · 说一句诚实的话</div>
        <div style={{color: theme.textDim, fontSize: 21, lineHeight: 1.55, marginTop: 14}}>
          安联研究指出，过去每一次超级厄尔尼诺期间，标普 500 都是上涨的。涨的原因是宏观环境，不是气候。
        </div>
        <div style={{color: theme.textDim, fontSize: 21, lineHeight: 1.55, marginTop: 14}}>
          他们还发现，粮食进口国在厄尔尼诺峰值之后 12 到 18 个月会跑输大盘 —— 但这个信号仍然太弱，不足以单独归因于厄尔尼诺。
        </div>
        <div style={{color: theme.price, fontSize: 24, fontWeight: 800, lineHeight: 1.5, marginTop: 20}}>
          更准确的说法是：厄尔尼诺通常不是危机的起因，它是那个把其他风险叠加上去的放大器。
        </div>
        <div style={{color: theme.textGhost, fontSize: 15, marginTop: 14, lineHeight: 1.45}}>
          据：Allianz Research / Ludovic Subran 通讯，2026-07-15（转载口径）；IMF 相关估算。原文页面 403，本片按二手转述标注。
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1000,
          top: 196,
          width: 800,
          opacity: enter(frame, A(17), 16) * fadeOut(frame, sceneEnd('live') + 30),
          fontFamily: theme.font,
        }}
      >
        <Stat
          frame={frame}
          appear={A(18)}
          left={0}
          top={0}
          width={800}
          value="+2.16"
          unit="°C"
          label="2026 年 8 月 ONI —— 920 个月里第十高，而且还在上升"
          sub="比它高的九个月全部来自 1997–98 与 2015–16 两次事件：最高是 2015 年 12 月的 +2.59，1997 年 12 月是 +2.37。"
          color={theme.warm}
        />
        <Stat
          frame={frame}
          appear={A(19)}
          left={0}
          top={210}
          width={800}
          value="+2.1 / +2.16 / +2.52 / +3.7"
          label="同一个 8 月，四个不同的数字"
          sub="CPC 的 RONI 是 +2.1，ONI 是 +2.16，IRI 的 Niño-3.4 是 +2.52，WMO 以 1993–2009 为基准的 OND 预测是 +3.7。差别来自基准期与指数定义，不是观测分歧。"
          color={theme.price}
        />
        <div
          style={{
            marginTop: 18,
            color: theme.textDim,
            fontSize: 20,
            lineHeight: 1.55,
            opacity: enter(frame, A(21), 16),
          }}
        >
          所以，看到任何一个厄尔尼诺强度数字时，先问一句：
          <span style={{color: theme.price, fontWeight: 700}}>它用的是哪个基准期、哪个指数？</span>
          这是本片希望你从今以后都会问的第一个问题。
        </div>
      </div>
    </>
  );
};

/* ================================================================== */
/* 9. coda — four questions                                            */
/* ================================================================== */

export const Coda: React.FC<ActProps> = ({frame}) => {
  const A = (l: number) => at('coda', l);

  return (
    <>

      <div
        style={{
          position: 'absolute',
          left: 1440,
          top: 190,
          width: 360,
          opacity: enter(frame, A(3), 16) * fadeOut(frame, A(9)),
          fontFamily: theme.font,
        }}
      >
        {[
          '这一相的雨，从哪个产区搬走',
          '那个产区占全球供给多少 —— 5% 还是 60%',
          '库存有多薄，能不能补种或换产地',
          '预报提前多久出现，价格已经走了多少',
        ].map((t, i) => (
          <div
            key={t}
            style={{
              color: theme.textFaint,
              fontSize: 18,
              lineHeight: 1.5,
              marginBottom: 18,
              paddingLeft: 12,
              borderLeft: `2px solid ${['#FF6A3D', '#F0D98A', '#3E9BE0', '#D98A3C'][i]}66`,
              opacity: enter(frame, A(3) + i * 10, 13),
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
          textAlign: 'center',
          opacity: enter(frame, A(9), 18),
          fontFamily: theme.font,
        }}
      >
        <div style={{color: theme.price, fontSize: 40, fontWeight: 800, letterSpacing: 3, lineHeight: 1.5}}>
          这台机器是气候系统里可预报性最高的现象之一
        </div>
        <div style={{color: theme.text, fontSize: 40, fontWeight: 800, letterSpacing: 3, marginTop: 14}}>
          但它预报的是概率，不是命运
        </div>
        <div
          style={{
            width: 220,
            height: 2,
            background: `${theme.textGhost}`,
            margin: '44px auto',
          }}
        />
        <div style={{color: theme.textDim, fontSize: 32, letterSpacing: 3, lineHeight: 1.6, opacity: enter(frame, A(11), 18)}}>
          它不制造热 · 它只是把海洋里储存的热
          <br />
          重新分配一次
        </div>
        <div style={{color: theme.warm, fontSize: 48, fontWeight: 800, letterSpacing: 6, marginTop: 40, opacity: enter(frame, A(12), 20)}}>
          而它重新分配的，最后是雨
        </div>
        <div style={{color: theme.text, fontSize: 40, fontWeight: 700, letterSpacing: 5, marginTop: 22, opacity: enter(frame, A(13), 20)}}>
          以及跟着雨走的，那一切
        </div>
      </div>
    </>
  );
};
