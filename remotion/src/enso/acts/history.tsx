import React from 'react';
import {interpolate} from 'remotion';
import {at, sceneEnd} from '../timing';
import {theme} from '../theme';
import {CHAIN_1972, CHAIN_2011, CPI_FOOD_WEIGHT, SCHEMATIC, SUPPLY} from '../facts';
import {Anchors, PricePanel} from '../components/PricePanel';
import {Chain, Kicker, Stat} from '../components/Dossier';
import {enter} from '../components/primitives';

export type ActProps = {frame: number};

const OUT = 16;

const Page: React.FC<{
  frame: number;
  appear: number;
  exitAt?: number;
  left: number;
  top: number;
  width: number;
  title: string;
  lines: string[];
  color?: string;
}> = ({frame, appear, exitAt, left, top, width, title, lines, color = theme.text}) => {
  const p = enter(frame, appear, 15);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        opacity: p * fade,
        transform: `translateY(${(1 - p) * 10}px)`,
        background: 'rgba(6,10,17,0.9)',
        border: `1px solid ${theme.panelEdge}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 12,
        padding: '16px 20px 18px',
        boxSizing: 'border-box',
        fontFamily: theme.font,
      }}
    >
      <div style={{color, fontSize: 22, fontWeight: 800, letterSpacing: 1.6, marginBottom: 10}}>{title}</div>
      {lines.map((l, i) => (
        <div
          key={l}
          style={{
            color: theme.textDim,
            fontSize: 18,
            lineHeight: 1.5,
            marginBottom: 7,
            opacity: enter(frame, appear + 6 + i * 7, 12),
            paddingLeft: 14,
            position: 'relative',
          }}
        >
          <span style={{position: 'absolute', left: 0, color: `${color}88`}}>·</span>
          {l}
        </div>
      ))}
    </div>
  );
};

/* ================================================================== */
/* 4. grain — 1972                                                     */
/* ================================================================== */

export const Grain: React.FC<ActProps> = ({frame}) => {
  const A = (l: number) => at('grain', l);

  return (
    <>

      <Kicker
        frame={frame}
        appear={A(0)}
        left={140}
        top={150}
        text="1972 · 厄尔尼诺相位"
        color={theme.warm}
        size={28}
      />

      <Stat
        frame={frame}
        appear={A(2)}
        exitAt={A(11)}
        left={140}
        top={212}
        width={420}
        value="−13%"
        label="苏联小麦产量"
        sub="同一年，苏联、萨赫勒、印度、澳大利亚同时减产。这不是一个国家的问题。"
        color={theme.dry}
      />

      <Stat
        frame={frame}
        appear={A(5)}
        exitAt={A(11)}
        left={140}
        top={392}
        width={420}
        value="1240 → 440"
        unit="万吨"
        label="秘鲁鳀鱼捕捞量，1970 → 1972"
        sub="1971 年还有 1030 万吨。1973 年不到 200 万吨。"
        color={theme.wet}
      />

      <Page
        frame={frame}
        appear={A(8)}
        exitAt={A(11)}
        left={140}
        top={576}
        width={420}
        title="一个崩盘，两层原因"
        color={theme.wet}
        lines={[
          '表层：厄尔尼诺 —— 冷水不再涌升，鱼群离开',
          '底层：船队早已过度捕捞，鱼群本就稀薄',
          '1972 年的捕捞量，掩盖了一支过大的船队',
        ]}
      />

      {/* the measured catch series — this one is data, not a sketch */}
      <PricePanel
        frame={frame}
        appear={A(4)}
        exitAt={A(11) - 4}
        box={{left: 612, top: 212, width: 640, height: 336}}
        path={SCHEMATIC.anchovy}
        progress={enter(frame, A(4) + 6, 34)}
        emphasisIndex={2}
        accent={theme.wet}
        badge="实测年度序列 · FAO / Glantz"
      />
      <Anchors
        frame={frame}
        appear={A(6)}
        exitAt={A(11) - 4}
        left={612}
        top={558}
        width={640}
        path={SCHEMATIC.anchovy}
      />

      <Page
        frame={frame}
        appear={A(12)}
        exitAt={A(17)}
        left={1288}
        top={212}
        width={512}
        title="1972 年 7 月的那笔采购"
        color={theme.price}
        lines={[
          '苏联在几周内买走一千万吨以上的小麦',
          '订单分散在几家私人粮商手里，成交后才公开',
          '买方知道自己缺粮，卖方不知道自己在被买空',
          '结果：本就偏薄的库存，遇上一次集中的突然采购',
        ]}
      />

      <PricePanel
        frame={frame}
        appear={A(12)}
        exitAt={A(17) - 4}
        box={{left: 612, top: 212, width: 640, height: 336}}
        path={SCHEMATIC.usWheat}
        progress={enter(frame, A(12) + 8, 40)}
        emphasisIndex={6}
        badge="示意路径 · 锚定两个可核对的点位"
      />
      <Anchors
        frame={frame}
        appear={A(14)}
        exitAt={A(17) - 4}
        left={612}
        top={558}
        width={640}
        path={SCHEMATIC.usWheat}
      />

      <Stat
        frame={frame}
        appear={A(16)}
        exitAt={A(17) - 4}
        left={1288}
        top={560}
        width={512}
        value="60"
        unit="天"
        label="1973 年 6 月起，美国对大豆实施出口禁运"
        sub="出口限制是这本书里反复出现的一页：它会把其他所有冲击放大。"
        color={theme.dry}
      />

      <Chain
        frame={frame}
        appear={A(17)}
        exitAt={sceneEnd('grain') + 30}
        left={120}
        top={756}
        width={1680}
        links={CHAIN_1972}
        color={theme.price}
        focus={frame >= A(19) ? (frame >= A(20) ? (frame >= A(21) ? 4 : 3) : 2) : null}
      />

      <Page
        frame={frame}
        appear={A(20)}
        exitAt={sceneEnd('grain') + 30}
        left={612}
        top={212}
        width={640}
        title="第一道与第二道闸门"
        color={theme.price}
        lines={[
          '库存有多薄 —— 决定了冲击能不能被吸收',
          '供给有多集中 —— 决定了一个产地能不能被替代',
          '干旱只是扣动了扳机，弹匣里得有子弹',
        ]}
      />
    </>
  );
};

/* ================================================================== */
/* 5. palm — 1997                                                      */
/* ================================================================== */

const ForecastCompare: React.FC<{frame: number; appear: number; exitAt?: number}> = ({frame, appear, exitAt}) => {
  const p = enter(frame, appear, 15);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  const rows = [
    {
      y: '1982–83',
      bar: '事件已经发生，模式才把它认出来',
      lead: '预报提前量 ≈ 0（事后归因）',
      color: theme.dry,
      widthFrac: 0.04,
    },
    {
      y: '1997–98',
      bar: '模式提前数月抓住，期货先动，产量后动',
      lead: '预报提前量 ≈ 3–6 个月',
      color: theme.wet,
      widthFrac: 0.78,
    },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 612,
        top: 212,
        width: 640,
        height: 336,
        opacity: p * fade,
        transform: `translateY(${(1 - p) * 10}px)`,
        background: 'rgba(6,10,17,0.93)',
        border: `1px solid ${theme.panelEdge}`,
        borderRadius: 12,
        padding: '18px 22px',
        boxSizing: 'border-box',
        fontFamily: theme.font,
      }}
    >
      <div style={{color: theme.text, fontSize: 22, fontWeight: 800, letterSpacing: 1.4}}>
        同一台机器，两种被认识的方式
      </div>
      <div style={{color: theme.textFaint, fontSize: 16, marginTop: 6, marginBottom: 20}}>
        这才是 1997 与 1982 最大的差别 —— 不是海温，是提前量
      </div>
      {rows.map((r, i) => {
        const rp = enter(frame, appear + 10 + i * 16, 14);
        return (
          <div key={r.y} style={{marginBottom: 26, opacity: rp}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
              <span style={{color: r.color, fontSize: 25, fontWeight: 800, letterSpacing: 1}}>{r.y}</span>
              <span style={{color: theme.textFaint, fontSize: 17}}>{r.lead}</span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 26,
                marginTop: 8,
                borderRadius: 5,
                background: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${r.widthFrac * 100}%`,
                  height: '100%',
                  background: `${r.color}44`,
                  borderRight: `2px solid ${r.color}`,
                }}
              />
            </div>
            <div style={{color: theme.textDim, fontSize: 17, marginTop: 6}}>{r.bar}</div>
          </div>
        );
      })}
      <div style={{color: theme.textGhost, fontSize: 15, lineHeight: 1.45}}>
        1982–83 超强事件的预报失败，是 ENSO 预报研究转向的主要推动力之一。据：NOAA CPC · Barnston et al. 2012
      </div>
    </div>
  );
};

export const Palm: React.FC<ActProps> = ({frame}) => {
  const A = (l: number) => at('palm', l);
  const palm = SUPPLY.find((x) => x.key === 'palm')!;

  return (
    <>

      <Kicker frame={frame} appear={A(0)} left={140} top={150} text="1997 · 厄尔尼诺相位" color={theme.warm} size={28} />

      <Stat
        frame={frame}
        appear={A(4)}
        exitAt={A(8)}
        left={140}
        top={212}
        width={420}
        value="400–1200"
        unit="万公顷"
        label="过火面积估计区间"
        sub="最常被引用的是 970 万公顷（印尼政府 / ADB–BAPPENAS 1999）。这种量级的估计差异，本身就是气候归因的常态。"
        color={theme.dry}
      />

      <Stat
        frame={frame}
        appear={A(2)}
        exitAt={A(8)}
        left={140}
        top={452}
        width={420}
        value={`${palm.share}%`}
        label={`${palm.countries} · 全球棕榈油产量份额`}
        sub="集中度高，是第一道和第二道闸门都打开的地方。"
        color={theme.price}
      />

      <Page
        frame={frame}
        appear={A(6)}
        exitAt={A(8)}
        left={140}
        top={620}
        width={420}
        title="为什么这回该看时间"
        color={theme.price}
        lines={['干旱是物理事件，价格是预期事件', '两者之间的时差，就是市场的空间']}
      />

      <PricePanel
        frame={frame}
        appear={A(6)}
        exitAt={A(8) - 4}
        box={{left: 612, top: 212, width: 640, height: 336}}
        path={SCHEMATIC.palmOil}
        progress={enter(frame, A(6) + 6, 34)}
        emphasisIndex={4}
        badge="示意路径 · 锚定区间"
      />
      <Anchors
        frame={frame}
        appear={A(7)}
        exitAt={A(8) - 4}
        left={612}
        top={558}
        width={640}
        path={SCHEMATIC.palmOil}
      />

      <ForecastCompare frame={frame} appear={A(8)} exitAt={A(13)} />

      <Page
        frame={frame}
        appear={A(13)}
        exitAt={A(16)}
        left={612}
        top={212}
        width={640}
        title="由此得到一个反直觉的结论"
        color={theme.price}
        lines={[
          '被提前预报的强事件，价格冲击可能反而更小 —— 大家已经站好了位置',
          '没被预报到的中等事件，可能造成更大的意外',
          '真正定价的不是「有多强」，而是「有多意外」',
        ]}
      />

      <Stat
        frame={frame}
        appear={A(16)}
        exitAt={sceneEnd('palm') + 24}
        left={1288}
        top={212}
        width={512}
        value="+0.56"
        unit="°C"
        label="1998 年全球平均气温，相对 1961–90"
        sub="当时有记录（1860 年起）以来最热的一年，超过 1997 年的 +0.43 °C。NOAA CPC 原话：极强的 1997/98 暖事件「贡献显著」。在多数记录里，这个值要到 2005–2010 年才被超过。"
        color={theme.warm}
      />

      <Page
        frame={frame}
        appear={A(17)}
        exitAt={sceneEnd('palm') + 24}
        left={1288}
        top={500}
        width={512}
        title="释放，而不是制造"
        color={theme.warm}
        lines={[
          '厄尔尼诺不向系统注入新的热',
          '它把海洋次表层已经储存的热释放到大气',
          '所以一次强厄尔尼诺之后，往往跟着一个气温纪录',
        ]}
      />
    </>
  );
};

/* ================================================================== */
/* 6. coal — 2010-11                                                   */
/* ================================================================== */

const FoodWeightBars: React.FC<{frame: number; appear: number; exitAt?: number}> = ({frame, appear, exitAt}) => {
  const p = enter(frame, appear, 15);
  const fade =
    exitAt === undefined
      ? 1
      : interpolate(frame, [exitAt - OUT, exitAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p * fade <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 612,
        top: 200,
        width: 1188,
        opacity: p * fade,
        transform: `translateY(${(1 - p) * 10}px)`,
        background: 'rgba(6,10,17,0.93)',
        border: `1px solid ${theme.panelEdge}`,
        borderRadius: 14,
        padding: '22px 30px 24px',
        boxSizing: 'border-box',
        fontFamily: theme.font,
      }}
    >
      <div style={{color: theme.text, fontSize: 29, fontWeight: 800, letterSpacing: 2}}>
        同一个国际粮价涨幅，落在不同的篮子里
      </div>
      <div style={{color: theme.textFaint, fontSize: 18, marginTop: 7}}>
        食品在家庭消费中的权重 —— 这是从「商品变贵」走到「社会变贵」的传导系数
      </div>
      <div style={{marginTop: 24}}>
        {CPI_FOOD_WEIGHT.map((g, i) => {
          const gp = enter(frame, appear + 10 + i * 10, 13);
          const w = 700;
          return (
            <div key={g.group} style={{display: 'flex', alignItems: 'center', gap: 20, height: 74, opacity: gp}}>
              <div style={{width: 150, color: theme.textDim, fontSize: 21, textAlign: 'right'}}>{g.group}</div>
              <div
                style={{
                  position: 'relative',
                  width: w,
                  height: 32,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${g.low}%`,
                    width: `${g.high - g.low}%`,
                    top: 0,
                    bottom: 0,
                    background: `linear-gradient(90deg, ${g.color}DD, ${g.color}88)`,
                    borderLeft: `2px solid ${g.color}`,
                    borderRight: `2px solid ${g.color}`,
                    borderRadius: 4,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: theme.text,
                    fontSize: 19,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {g.low}–{g.high}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{color: theme.textGhost, fontSize: 16, marginTop: 18, lineHeight: 1.5}}>
        据：CEPII WP 2012-33；世界银行《Inflation in Emerging and Developing Economies》第 6 章。区间为近似值，口径随国家与年份变化。
      </div>
    </div>
  );
};

export const Coal: React.FC<ActProps> = ({frame}) => {
  const A = (l: number) => at('coal', l);
  const coal = SUPPLY.find((x) => x.key === 'coal')!;

  return (
    <>

      <Kicker frame={frame} appear={A(0)} left={140} top={150} text="2010–11 拉尼娜相位" color={theme.cold} size={28} />

      <Stat
        frame={frame}
        appear={A(3)}
        exitAt={A(11)}
        left={140}
        top={212}
        width={420}
        value={`${coal.share}%`}
        label="澳大利亚占全球海运冶金煤市场"
        sub="物理中断落在一个集中度极高的供给上，这是第二道闸门。"
        color={theme.wet}
      />

      <Stat
        frame={frame}
        appear={A(1)}
        exitAt={A(11)}
        left={140}
        top={392}
        width={420}
        value="±0%"
        label="需求端的变化"
        sub="这一次没有需求故事，只有物理中断：矿被淹、铁路断、港口停。"
        color={theme.textDim}
      />

      <Page
        frame={frame}
        appear={A(7)}
        exitAt={A(11)}
        left={140}
        top={560}
        width={420}
        title="为什么这个例子干净"
        color={theme.wet}
        lines={[
          '拉尼娜→昆士兰创纪录降雨，是较稳健的遥相关',
          '一个产区、一种商品、一条供应链断口',
          '价格反应可以在季度结算价上被直接读到',
        ]}
      />

      <PricePanel
        frame={frame}
        appear={A(4)}
        exitAt={A(11) - 4}
        box={{left: 612, top: 212, width: 620, height: 336}}
        path={SCHEMATIC.coal}
        progress={enter(frame, A(4) + 8, 40)}
        emphasisIndex={2}
        accent={theme.wet}
        badge="实测季度基准结算价 · ABARES"
      />
      <Anchors
        frame={frame}
        appear={A(5)}
        exitAt={A(11) - 4}
        left={612}
        top={558}
        width={620}
        path={SCHEMATIC.coal}
      />

      <Stat
        frame={frame}
        appear={A(6)}
        exitAt={A(11) - 4}
        left={1260}
        top={212}
        width={540}
        value="−32%"
        label="2011 年第一季度，澳大利亚焦煤出口环比"
        sub="同比 −23%。供给损失约占全球焦煤供应 5%，约 1200–1300 万吨。"
        color={theme.wet}
      />

      <Stat
        frame={frame}
        appear={A(10)}
        exitAt={A(11) - 4}
        left={1260}
        top={404}
        width={540}
        value="236"
        unit="点"
        label="2011 年 2 月 FAO 食品价格指数"
        sub="1990 年有统计以来的最高值（当月发布口径，基数 2002–04=100）。FAO 其后已重定基，2022 年 3 月的峰值在以 2014–16 为基数的序列上约为 159–160。"
        color={theme.price}
      />

      <FoodWeightBars frame={frame} appear={A(12)} exitAt={sceneEnd('coal') + 30} />

      <Chain
        frame={frame}
        appear={A(19)}
        exitAt={sceneEnd('coal') + 30}
        left={120}
        top={760}
        width={1680}
        links={CHAIN_2011}
        color={theme.price}
        focus={frame >= A(19) ? Math.min(5, Math.floor((frame - A(19)) / 26)) : null}
      />
    </>
  );
};
