import React from 'react';
import {theme} from '../theme';
import {enter, leave} from './primitives';
import {Origin} from '../data';

/**
 * The altitude strip. Altitude is the variable that makes coffee geography
 * legible, so it gets one shared axis that every producing country is measured
 * against. Plotting countries on a common 0-2400 m scale is what turns "Ethiopia
 * is high, Vietnam is low" into a number the viewer can compare.
 */
export const AltitudeStrip: React.FC<{
  frame: number;
  appear: number;
  fade?: number;
  x: number;
  y: number;
  width: number;
  title?: string;
  rows: Array<{label: string; low: number; high: number; color: string; note?: string}>;
  maxAlt?: number;
  rowH?: number;
  axisNote?: string;
}> = ({frame, appear, fade, x, y, width, title, rows, maxAlt = 2400, rowH = 52, axisNote}) => {
  const t = enter(frame, appear, 16) * (fade === undefined ? 1 : leave(frame, fade, 16));
  if (t <= 0.01) return null;
  const labelW = 170;
  const axisX = x + labelW + 16;
  const axisW = width - labelW - 16 - 300;
  const px = (m: number) => axisX + (m / maxAlt) * axisW;
  const ticks: number[] = [];
  for (let m = 0; m <= maxAlt; m += 400) ticks.push(m);

  return (
    <g opacity={t} fontFamily={theme.font}>
      {title ? (
        <text x={x} y={y - 16} fill={theme.textDim} fontSize={22} letterSpacing={2}>
          {title}
        </text>
      ) : null}
      {axisNote ? (
        <text x={x + width} y={y - 16} fill={theme.altitude} fontSize={20} textAnchor="end" letterSpacing={1}>
          {axisNote}
        </text>
      ) : null}
      <line
        x1={axisX}
        x2={axisX + axisW}
        y1={y + rows.length * rowH + 4}
        y2={y + rows.length * rowH + 4}
        stroke={theme.panelEdge}
        strokeWidth={1}
      />
      {ticks.map((m) => (
        <g key={m}>
          <line
            x1={px(m)}
            x2={px(m)}
            y1={y - 4}
            y2={y + rows.length * rowH + 10}
            stroke={theme.grid}
            strokeWidth={1}
          />
          <text
            x={px(m)}
            y={y + rows.length * rowH + 36}
            fill={theme.textFaint}
            fontSize={17}
            textAnchor="middle"
            fontFamily={theme.mono}
          >
            {m === 0 ? '0 m' : m}
          </text>
        </g>
      ))}
      {rows.map((row, i) => {
        const ry = y + i * rowH;
        const w = Math.max(4, px(row.high) - px(row.low));
        return (
          <g key={row.label}>
            {i % 2 === 0 ? (
              <rect x={x} y={ry - 8} width={width} height={rowH} fill="rgba(255,255,255,0.018)" />
            ) : null}
            <text x={x + labelW} y={ry + 22} fill={theme.text} fontSize={25} textAnchor="end">
              {row.label}
            </text>
            <rect x={axisX} y={ry + 4} width={axisW} height={22} rx={3} fill="rgba(255,255,255,0.03)" />
            <rect x={px(row.low)} y={ry + 4} width={w} height={22} rx={3} fill={row.color} opacity={0.9} />
            <text
              x={px(row.high) + 12}
              y={ry + 22}
              fill={row.color}
              fontSize={21}
              fontFamily={theme.mono}
            >
              {row.low}–{row.high}
            </text>
            {row.note ? (
              <text x={x + width - 8} y={ry + 22} fill={theme.textDim} fontSize={21} textAnchor="end">
                {row.note}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

/** One country, described entirely by the four decisions. */
export const OriginCard: React.FC<{
  frame: number;
  appear: number;
  fade?: number;
  x: number;
  y: number;
  width: number;
  origin: Origin;
  accent: string;
}> = ({frame, appear, fade, x, y, width, origin, accent}) => {
  const t = enter(frame, appear, 16) * (fade === undefined ? 1 : leave(frame, fade, 16));
  if (t <= 0.01) return null;
  const species = origin.arabica >= 0.95 ? '阿拉比卡' : origin.arabica <= 0.1 ? '罗布斯塔' : '两者都有';
  const speciesColor = origin.arabica >= 0.95 ? theme.arabica : origin.arabica <= 0.1 ? theme.robusta : theme.textDim;
  const rows: Array<[string, string, string]> = [
    ['物种', species, speciesColor],
    ['品种', origin.varieties, theme.bred],
    ['海拔', `${origin.altLow}–${origin.altHigh} m`, theme.altitude],
    ['处理', PROCESS_LABEL[origin.process], PROCESS_TINT[origin.process]],
  ];

  return (
    <g opacity={t} fontFamily={theme.font} transform={`translate(0 ${(1 - t) * 14})`}>
      <rect
        x={x}
        y={y}
        width={width}
        height={196}
        rx={12}
        fill="rgba(255,255,255,0.035)"
        stroke={accent}
        strokeWidth={1.6}
        strokeOpacity={0.75}
      />
      <text x={x + 22} y={y + 42} fill={theme.text} fontSize={32} fontWeight={700} letterSpacing={2}>
        {origin.name}
      </text>
      <text x={x + width - 22} y={y + 40} fill={theme.textFaint} fontSize={20} textAnchor="end" fontFamily={theme.mono}>
        约占全球产量 {origin.share}%
      </text>
      <line x1={x + 22} x2={x + width - 22} y1={y + 58} y2={y + 58} stroke={theme.panelEdge} />
      {rows.map((row, i) => (
        <g key={row[0]}>
          <text x={x + 22} y={y + 92 + i * 25} fill={theme.textFaint} fontSize={20} letterSpacing={2}>
            {row[0]}
          </text>
          <text x={x + 92} y={y + 92 + i * 25} fill={row[2]} fontSize={21}>
            {row[1]}
          </text>
        </g>
      ))}
      <text x={x + 22} y={y + 182} fill={theme.textDim} fontSize={20}>
        {origin.profile}
      </text>
    </g>
  );
};

/** A titled badge so every act announces itself the same way. */
export const ActTitle: React.FC<{
  frame: number;
  appear: number;
  text: string;
  sub?: string;
  x?: number;
  y?: number;
}> = ({frame, appear, text, sub, x = 150, y = 150}) => {
  const t = enter(frame, appear, 16);
  if (t <= 0.01) return null;
  const w = 46 + text.length * 30 + (sub ? 0 : 0);
  return (
    <g opacity={t}>
      <rect x={x} y={y} width={w} height={sub ? 92 : 58} rx={10} fill="rgba(13,9,5,0.9)" stroke={theme.panelEdge} />
      <text x={x + 22} y={y + 40} fill={theme.text} fontSize={29} fontWeight={700} letterSpacing={2}>
        {text}
      </text>
      {sub ? (
        <text x={x + 22} y={y + 72} fill={theme.textFaint} fontSize={19} letterSpacing={1}>
          {sub}
        </text>
      ) : null}
    </g>
  );
};

export const PROCESS_LABEL: Record<string, string> = {
  washed: '水洗',
  natural: '日晒',
  honey: '蜜处理',
  wetHull: '湿刨法',
  mixed: '混合',
};

export const PROCESS_TINT: Record<string, string> = {
  washed: theme.washed,
  natural: theme.natural,
  honey: theme.honey,
  wetHull: theme.wetHull,
  mixed: theme.textDim,
};

/** A pile of labelled species markers, used where the map is only a backdrop. */
export const KeyValue: React.FC<{
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
  color: string;
  size?: number;
}> = ({x, y, width, label, value, color, size = 24}) => (
  <g>
    <text x={x} y={y} fill={theme.textFaint} fontSize={size - 3} letterSpacing={2}>
      {label}
    </text>
    <text x={x + width} y={y} fill={color} fontSize={size} textAnchor="end">
      {value}
    </text>
  </g>
);
