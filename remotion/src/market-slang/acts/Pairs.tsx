import React from 'react';
import {View} from '../camera';
import {enter} from '../components/primitives';
import {line, sceneStart} from '../timing';
import {theme} from '../theme';

const L = (n: number) => line('pairs', n).startFrame;

type Bar = {o: number; h: number; l: number; c: number};

/** Schematic candle shapes. These are illustrations, not market data. */
const PULLBACK: Bar[] = [
  {o: 20, h: 30, l: 18, c: 28},
  {o: 28, h: 40, l: 26, c: 38},
  {o: 38, h: 48, l: 36, c: 46},
  {o: 46, h: 50, l: 42, c: 44},
  {o: 44, h: 46, l: 36, c: 38},
  {o: 38, h: 40, l: 29, c: 31},
  {o: 31, h: 33, l: 20, c: 21},
  {o: 21, h: 23, l: 9, c: 11},
];

const BREAKOUT: Bar[] = [
  {o: 24, h: 28, l: 22, c: 26},
  {o: 26, h: 29, l: 23, c: 24},
  {o: 24, h: 27, l: 22, c: 25},
  {o: 25, h: 28, l: 23, c: 24},
  {o: 24, h: 46, l: 23, c: 45},
  {o: 52, h: 56, l: 50, c: 51},
  {o: 51, h: 52, l: 28, c: 30},
];

const TOP: Bar[] = [
  {o: 12, h: 20, l: 10, c: 18},
  {o: 18, h: 34, l: 17, c: 32},
  {o: 32, h: 50, l: 31, c: 47},
  {o: 47, h: 52, l: 43, c: 45},
  {o: 45, h: 50, l: 42, c: 48},
  {o: 48, h: 52, l: 44, c: 46},
  {o: 46, h: 49, l: 41, c: 43},
  {o: 43, h: 47, l: 40, c: 45},
  {o: 45, h: 48, l: 38, c: 40},
];

const MiniChart: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  bars: Bar[];
  /** indices of bars to outline, with the colour to outline them in */
  marks: Array<{from: number; to: number; color: string; opacity: number; label: string}>;
}> = ({x, y, w, h, bars, marks}) => {
  const values = bars.reduce<number[]>((acc, b) => acc.concat([b.h, b.l]), []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = 10;
  const bw = (w - pad * 2) / bars.length;
  const py = (v: number) => y + pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2);

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="rgba(255,255,255,0.03)" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill="none"
        stroke={theme.panelEdge}
        strokeWidth={1}
      />
      {marks.map((m, i) =>
        m.opacity > 0.01 ? (
          <g key={i} opacity={m.opacity}>
            <rect
              x={x + pad + m.from * bw - 3}
              y={y + 6}
              width={(m.to - m.from + 1) * bw + 6}
              height={h - 12}
              rx={8}
              fill={m.color}
              opacity={0.13}
            />
            <rect
              x={x + pad + m.from * bw - 3}
              y={y + 6}
              width={(m.to - m.from + 1) * bw + 6}
              height={h - 12}
              rx={8}
              fill="none"
              stroke={m.color}
              strokeWidth={2}
            />
          </g>
        ) : null,
      )}
      {bars.map((b, i) => {
        const up = b.c >= b.o;
        const cx = x + pad + i * bw + bw / 2;
        const color = up ? theme.up : theme.down;
        const top = Math.min(py(b.o), py(b.c));
        const bh = Math.max(2, Math.abs(py(b.c) - py(b.o)));
        return (
          <g key={i}>
            <line
              x1={cx}
              x2={cx}
              y1={py(b.h)}
              y2={py(b.l)}
              stroke={color}
              strokeWidth={2}
              opacity={0.9}
            />
            <rect
              x={cx - bw * 0.3}
              y={top}
              width={bw * 0.6}
              height={bh}
              fill={color}
              rx={1.5}
            />
          </g>
        );
      })}
    </g>
  );
};

const PairLabel: React.FC<{
  x: number;
  y: number;
  w: number;
  term: string;
  read: string;
  color: string;
  opacity: number;
  action: string;
  actionOpacity: number;
}> = ({x, y, w, term, read, color, opacity, action, actionOpacity}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      opacity,
      transform: `translateY(${(1 - opacity) * 14}px)`,
      borderLeft: `5px solid ${color}`,
      background: 'rgba(9,12,17,0.86)',
      borderRadius: 10,
      padding: '12px 18px',
      boxSizing: 'border-box',
    }}
  >
    <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
      <span style={{color, fontSize: 34, fontWeight: 800, letterSpacing: 1}}>{term}</span>
      <span style={{color: theme.textDim, fontSize: 22}}>{read}</span>
    </div>
    <div
      style={{
        marginTop: 6,
        color,
        fontSize: 21,
        letterSpacing: 1,
        opacity: actionOpacity,
      }}
    >
      {action}
    </div>
  </div>
);

/**
 * A rhythm act: the same three pictures, each named twice. It exists to show
 * that the double-naming is a property of the language, not of one chart.
 */
export const Pairs: React.FC<{frame: number; view: View}> = ({frame}) => {
  const header = enter(frame, sceneStart('pairs'), 14);
  const a1 = enter(frame, L(1), 12);
  const a2 = enter(frame, L(2), 12);
  const b1 = enter(frame, L(3), 12);
  const b2 = enter(frame, L(4), 12);
  const c1 = enter(frame, L(5), 12);
  const c2 = enter(frame, L(5) + 26, 12);
  const verdict = enter(frame, L(6), 14);
  const turn = enter(frame, L(7), 14);
  const final = enter(frame, L(8), 16);

  const panelW = 500;
  const panelH = 270;
  const gap = 60;
  const startX = (1920 - (panelW * 3 + gap * 2)) / 2;
  const topY = 268;

  const vignettes: Array<{
    bars: Bar[];
    warmTerm: string;
    warmRead: string;
    coldTerm: string;
    coldRead: string;
    warmOpacity: number;
    coldOpacity: number;
    markA: [number, number];
    markB: [number, number];
  }> = [
    {
      bars: PULLBACK,
      warmTerm: '洗盘',
      warmRead: '上涨途中的回调',
      coldTerm: '破位',
      coldRead: '跌破关键位置',
      warmOpacity: a1,
      coldOpacity: a2,
      markA: [3, 5],
      markB: [6, 7],
    },
    {
      bars: BREAKOUT,
      warmTerm: '突破',
      warmRead: '一根放量涨停',
      coldTerm: '诱多',
      coldRead: '第二天高开低走',
      warmOpacity: b1,
      coldOpacity: b2,
      markA: [4, 4],
      markB: [5, 6],
    },
    {
      bars: TOP,
      warmTerm: '蓄势',
      warmRead: '高位横着不动',
      coldTerm: '筑顶',
      coldRead: '同一个横盘',
      warmOpacity: c1,
      coldOpacity: c2,
      markA: [3, 4],
      markB: [5, 8],
    },
  ];

  const panelScale = 1 - final * 0.14;
  const panelDrop = final * 0.35;

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(6,9,13,${0.55 + final * 0.25})`,
        }}
      />

      {header > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 150,
            textAlign: 'center',
            opacity: header * (1 - final * 0.6),
          }}
        >
          <div style={{color: theme.text, fontSize: 44, letterSpacing: 2}}>
            这种结构，在这门语言里到处都是
          </div>
        </div>
      ) : null}

      {vignettes.map((v, i) => {
        const x = startX + i * (panelW + gap);
        const opacity = Math.max(v.warmOpacity, v.coldOpacity);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: topY,
              width: panelW,
              opacity: opacity * (1 - final * 0.45),
              transform: `scale(${panelScale}) translateY(${panelDrop * 120}px)`,
              transformOrigin: 'center top',
            }}
          >
            <svg width={panelW} height={panelH} viewBox={`0 0 ${panelW} ${panelH}`}>
              <MiniChart
                x={0}
                y={0}
                w={panelW}
                h={panelH}
                bars={v.bars}
                marks={[
                  {
                    from: v.markA[0],
                    to: v.markA[1],
                    color: theme.predict,
                    opacity: v.warmOpacity * 0.9,
                    label: v.warmTerm,
                  },
                  {
                    from: v.markB[0],
                    to: v.markB[1],
                    color: theme.describe,
                    opacity: v.coldOpacity * 0.9,
                    label: v.coldTerm,
                  },
                ]}
              />
            </svg>
            <PairLabel
              x={0}
              y={panelH + 18}
              w={panelW}
              term={v.warmTerm}
              read={v.warmRead}
              color={theme.predict}
              opacity={v.warmOpacity}
              action="→ 让你拿着，甚至加仓"
              actionOpacity={verdict}
            />
            <PairLabel
              x={0}
              y={panelH + 122}
              w={panelW}
              term={v.coldTerm}
              read={v.coldRead}
              color={theme.describe}
              opacity={v.coldOpacity}
              action="→ 让你赶紧走"
              actionOpacity={verdict}
            />
          </div>
        );
      })}

      {verdict > 0.01 && final < 0.5 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 892,
            textAlign: 'center',
            opacity: verdict,
          }}
        >
          <div style={{fontSize: 40, color: theme.text, letterSpacing: 2}}>
            同一个画面，两个词，一个让你买，一个让你卖
          </div>
        </div>
      ) : null}

      {final > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 300,
            textAlign: 'center',
            opacity: final,
            transform: `translateY(${(1 - final) * 18}px)`,
          }}
        >
          <div style={{fontSize: 46, color: theme.textDim, letterSpacing: 3}}>
            选哪个词，不取决于图
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 68,
              color: theme.text,
              fontWeight: 800,
              letterSpacing: 4,
              opacity: turn,
            }}
          >
            取决于说话的人，<span style={{color: theme.predict}}>想让你干什么</span>
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          right: 96,
          top: 128,
          color: theme.textFaint,
          fontSize: 22,
          letterSpacing: 2,
          opacity: 0.75 * (1 - final * 0.7),
        }}
      >
        示意图形 · 非真实行情
      </div>
    </div>
  );
};
