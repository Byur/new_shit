import React from 'react';
import {View} from '../camera';
import {candles, DAYS, TODAY} from '../chart';
import {LAYOUT, PLOT_H, PLOT_W, theme} from '../theme';

export type Projector = {
  x: (day: number) => number;
  y: (price: number) => number;
  barWidth: number;
};

export const makeProjector = (view: View): Projector => ({
  x: (day: number) => LAYOUT.plot.left + ((day - view.d0) / (view.d1 - view.d0)) * PLOT_W,
  y: (price: number) => LAYOUT.plot.top + (1 - (price - view.p0) / (view.p1 - view.p0)) * PLOT_H,
  barWidth: Math.max(2.2, Math.min(17, (PLOT_W / (view.d1 - view.d0)) * 0.58)),
});

const niceStep = (raw: number): number => {
  const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
  for (const c of candidates) {
    if (c >= raw) return c;
  }
  return 10;
};

type Zone = {
  days?: [number, number];
  prices?: [number, number];
  color: string;
  opacity?: number;
  dashed?: boolean;
};

type Props = {
  view: View;
  /** 0 = the future is still unwritten, 1 = hindsight has settled it */
  futureReveal: number;
  zones?: Zone[];
  /** Optional close-price emphasis line drawn over the candles */
  line?: {color: string; width: number; opacity: number; fromDay?: number; toDay?: number};
  /** Dim everything drawn here, used when an overlay takes over */
  opacity?: number;
  /** Highlight a single day's bar with a halo */
  haloDay?: number;
  haloColor?: string;
  children?: React.ReactNode;
};

export const ChartCanvas: React.FC<Props> = ({
  view,
  futureReveal,
  zones = [],
  line,
  opacity = 1,
  haloDay,
  haloColor = theme.focus,
  children,
}) => {
  const p = makeProjector(view);
  const priceStep = niceStep((view.p1 - view.p0) / 7);

  const priceTicks: number[] = [];
  const startTick = Math.ceil(view.p0 / priceStep) * priceStep;
  for (let v = startTick; v <= view.p1 + 1e-6; v += priceStep) {
    priceTicks.push(Number(v.toFixed(4)));
  }

  const dayTicks: number[] = [];
  for (let d = 0; d <= DAYS; d += 20) {
    if (d >= view.d0 && d <= view.d1) dayTicks.push(d);
  }
  if (view.d0 <= TODAY && TODAY <= view.d1 && dayTicks.indexOf(TODAY) === -1) {
    dayTicks.push(TODAY);
  }
  dayTicks.sort((a, b) => a - b);

  /*
   * A tick whose tick mark falls outside the plot would paint its label into
   * the margins (and, near the right edge, off the frame). Only ticks the plot
   * actually contains get drawn.
   */
  const visibleTicks = dayTicks.filter((day) => {
    const x = p.x(day);
    return x >= LAYOUT.plot.left + 12 && x <= LAYOUT.plot.right - 12;
  });

  const cw = p.barWidth;

  return (
    <svg
      width={LAYOUT.width}
      height={LAYOUT.height}
      viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
      style={{position: 'absolute', inset: 0, opacity}}
    >
      <defs>
        <clipPath id="plotClip">
          <rect
            x={LAYOUT.plot.left - 8}
            y={LAYOUT.plot.top - 14}
            width={PLOT_W + 16}
            height={PLOT_H + 28}
          />
        </clipPath>
        <linearGradient id="futureFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.focus} stopOpacity={0.5} />
          <stop offset="100%" stopColor={theme.focus} stopOpacity={0.05} />
        </linearGradient>
      </defs>

      {/* plot panel */}
      <rect
        x={LAYOUT.plot.left}
        y={LAYOUT.plot.top}
        width={PLOT_W}
        height={PLOT_H}
        fill={theme.panel}
      />

      {/* price grid */}
      {priceTicks.map((price) => {
        const y = p.y(price);
        return (
          <g key={`pg${price}`}>
            <line
              x1={LAYOUT.plot.left}
              x2={LAYOUT.plot.right}
              y1={y}
              y2={y}
              stroke={Math.abs(price - Math.round(price)) < 1e-6 ? theme.gridStrong : theme.grid}
              strokeWidth={1}
            />
            <text
              x={LAYOUT.plot.left - 18}
              y={y + 6}
              textAnchor="end"
              fill={theme.axisText}
              fontFamily={theme.mono}
              fontSize={20}
            >
              {price.toFixed(priceStep < 0.5 ? 2 : 1)}
            </text>
          </g>
        );
      })}

      {/* day grid */}
      {visibleTicks.map((day) => {
        const x = p.x(day);
        const rel = day - TODAY;
        const isToday = rel === 0;
        return (
          <g key={`dg${day}`}>
            <line
              x1={x}
              x2={x}
              y1={LAYOUT.plot.top}
              y2={LAYOUT.plot.bottom}
              stroke={isToday ? 'rgba(233,180,76,0.55)' : theme.grid}
              strokeWidth={isToday ? 2 : 1}
              strokeDasharray={isToday ? '6 6' : undefined}
            />
            <text
              x={x}
              y={LAYOUT.plot.bottom + 34}
              textAnchor="middle"
              fill={isToday ? theme.predict : theme.axisText}
              fontFamily={theme.mono}
              fontSize={19}
            >
              {isToday ? '今天' : rel > 0 ? `+${rel}` : `${rel}`}
            </text>
          </g>
        );
      })}

      <g clipPath="url(#plotClip)">
        {/* annotation zones sit under the price data */}
        {zones.map((zone, i) => {
          const d0 = zone.days ? zone.days[0] : view.d0 - 10;
          const d1 = zone.days ? zone.days[1] : view.d1 + 10;
          const p0 = zone.prices ? zone.prices[0] : view.p0 - 1;
          const p1 = zone.prices ? zone.prices[1] : view.p1 + 1;
          const x0 = p.x(d0);
          const x1 = p.x(d1);
          const y0 = p.y(p1);
          const y1 = p.y(p0);
          return (
            <rect
              key={`z${i}`}
              x={Math.min(x0, x1)}
              y={Math.min(y0, y1)}
              width={Math.abs(x1 - x0)}
              height={Math.abs(y1 - y0)}
              fill={zone.color}
              opacity={zone.opacity ?? 1}
              stroke={zone.dashed ? zone.color : undefined}
              strokeDasharray={zone.dashed ? '8 8' : undefined}
              strokeWidth={zone.dashed ? 2 : 0}
            />
          );
        })}

        {/* candles: settled history first, unresolved future second */}
        {candles.map((c) => {
          if (c.day < view.d0 - 2 || c.day > view.d1 + 2) return null;
          const isFuture = c.day > TODAY;
          const x = p.x(c.day);
          const up = c.close >= c.open;
          const color = up ? theme.up : theme.down;
          const yOpen = p.y(c.open);
          const yClose = p.y(c.close);
          const top = Math.min(yOpen, yClose);
          const bodyH = Math.max(1.6, Math.abs(yClose - yOpen));
          return (
            <g key={`c${c.day}`} opacity={isFuture ? 0.16 + 0.84 * futureReveal : 1}>
              {haloDay === c.day ? (
                <rect
                  x={x - cw}
                  y={p.y(c.high) - 16}
                  width={cw * 2}
                  height={p.y(c.low) - p.y(c.high) + 32}
                  rx={6}
                  fill={haloColor}
                  opacity={0.16}
                />
              ) : null}
              <line
                x1={x}
                x2={x}
                y1={p.y(c.high)}
                y2={p.y(c.low)}
                stroke={color}
                strokeWidth={Math.max(1.2, cw * 0.14)}
                opacity={isFuture ? 0.7 : 1}
              />
              {isFuture && futureReveal < 0.55 ? (
                <rect
                  x={x - cw / 2}
                  y={top}
                  width={cw}
                  height={bodyH}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                />
              ) : (
                <rect x={x - cw / 2} y={top} width={cw} height={bodyH} fill={color} rx={1} />
              )}
            </g>
          );
        })}

        {line ? (
          <polyline
            points={candles
              .filter((c) => c.day >= (line.fromDay ?? 0) && c.day <= (line.toDay ?? DAYS - 1))
              .map((c) => `${p.x(c.day)},${p.y(c.close)}`)
              .join(' ')}
            fill="none"
            stroke={line.color}
            strokeWidth={line.width}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={line.opacity}
          />
        ) : null}

        {children}
      </g>

      {/* plot frame */}
      <rect
        x={LAYOUT.plot.left}
        y={LAYOUT.plot.top}
        width={PLOT_W}
        height={PLOT_H}
        fill="none"
        stroke={theme.panelEdge}
        strokeWidth={1}
      />

      <text
        x={LAYOUT.plot.left}
        y={LAYOUT.plot.bottom + 62}
        fill={theme.textFaint}
        fontFamily={theme.font}
        fontSize={18}
      >
        交易日（以今天为原点）
      </text>
    </svg>
  );
};
