import React from 'react';
import {View} from '../camera';
import {CHIP_BUCKETS, CHIP_SIZE, bucketPrice, chipMax} from '../chart';
import {LAYOUT, PLOT_H, theme} from '../theme';
import {Projector} from './ChartCanvas';

type Props = {
  view: View;
  dist: number[];
  progress: number;
  opacity: number;
  /** price band to emphasise, e.g. the trapped cost area */
  emphasis?: [number, number];
  /** draw the migrating peak marker */
  showPeak?: boolean;
};

export const ChipPanel: React.FC<Props> = ({
  view,
  dist,
  progress,
  opacity,
  emphasis,
  showPeak = true,
}) => {
  const p: Projector = {
    x: (day: number) => LAYOUT.plot.left + (day / (view.d1 - view.d0)) * (LAYOUT.chips.right - LAYOUT.plot.left),
    y: (price: number) =>
      LAYOUT.plot.top + (1 - (price - view.p0) / (view.p1 - view.p0)) * PLOT_H,
    barWidth: 1,
  };
  const max = chipMax(dist);
  const width = LAYOUT.chips.right - LAYOUT.chips.left;
  const bandH = Math.max(1.5, (PLOT_H / (view.p1 - view.p0)) * CHIP_SIZE - 1);

  let peakBucket = 0;
  for (let i = 1; i < dist.length; i++) {
    if (dist[i] > dist[peakBucket]) peakBucket = i;
  }

  return (
    <g opacity={opacity}>
      <rect
        x={LAYOUT.chips.left}
        y={LAYOUT.plot.top}
        width={width}
        height={PLOT_H}
        fill={theme.panel}
      />
      <rect
        x={LAYOUT.chips.left}
        y={LAYOUT.plot.top}
        width={width}
        height={PLOT_H}
        fill="none"
        stroke={theme.panelEdge}
        strokeWidth={1}
      />
      <text
        x={LAYOUT.chips.left}
        y={LAYOUT.plot.top - 18}
        fill={theme.textFaint}
        fontFamily={theme.font}
        fontSize={19}
      >
        筹码分布
      </text>

      {emphasis ? (
        <rect
          x={LAYOUT.chips.left}
          y={p.y(emphasis[1])}
          width={width}
          height={Math.max(2, p.y(emphasis[0]) - p.y(emphasis[1]))}
          fill={theme.describe}
          opacity={0.1}
        />
      ) : null}

      {dist.map((value, i) => {
        const price = bucketPrice(i);
        if (price < view.p0 || price > view.p1) return null;
        const y = p.y(price);
        const w = (value / max) * width * progress;
        if (w < 0.6) return null;
        const inEmphasis = emphasis ? price >= emphasis[0] && price <= emphasis[1] : false;
        return (
          <rect
            key={i}
            x={LAYOUT.chips.left + 1}
            y={y - bandH / 2}
            width={Math.max(0, w - 2)}
            height={bandH}
            rx={1}
            fill={inEmphasis ? theme.predict : theme.describe}
            opacity={inEmphasis ? 0.82 : 0.44}
          />
        );
      })}

      {showPeak && progress > 0.8 ? (
        <g>
          <line
            x1={LAYOUT.chips.left}
            x2={LAYOUT.chips.right}
            y1={p.y(bucketPrice(peakBucket))}
            y2={p.y(bucketPrice(peakBucket))}
            stroke={theme.predict}
            strokeWidth={1.6}
            strokeDasharray="5 5"
            opacity={0.75}
          />
        </g>
      ) : null}

      <text
        x={LAYOUT.chips.left}
        y={LAYOUT.plot.bottom + 34}
        fill={theme.textFaint}
        fontFamily={theme.font}
        fontSize={18}
      >
        每个价位的持仓量
      </text>
    </g>
  );
};

export const chipBucketCount = CHIP_BUCKETS;
