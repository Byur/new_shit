import React from 'react';
import {theme} from '../theme';
import {clamp01, enter} from './primitives';

/** A plot frame with axes, ticks and a label. Every chart in the film uses it. */
export const Axes: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  xLabel: string;
  yLabel: string;
  xTicks?: Array<{v: number; label: string}>;
  yTicks?: Array<{v: number; label: string}>;
  /** data ranges: map a value to a pixel */
  xRange: [number, number];
  yRange: [number, number];
  zeroY?: boolean;
  opacity?: number;
  children?: React.ReactNode;
}> = ({x, y, w, h, xLabel, yLabel, xTicks = [], yTicks = [], xRange, yRange, zeroY, opacity = 1, children}) => {
  const sx = (v: number) => x + ((v - xRange[0]) / (xRange[1] - xRange[0])) * w;
  const sy = (v: number) => y + h - ((v - yRange[0]) / (yRange[1] - yRange[0])) * h;
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
      {yTicks.map((t) => (
        <g key={`y${t.v}`}>
          <line x1={x} x2={x + w} y1={sy(t.v)} y2={sy(t.v)} stroke={t.v === 0 && zeroY ? theme.gridStrong : theme.grid} strokeWidth={t.v === 0 && zeroY ? 1.6 : 1} />
          <text x={x - 14} y={sy(t.v) + 7} fill={theme.textFaint} fontSize={18} textAnchor="end" fontFamily={theme.mono}>
            {t.label}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t.v}`}>
          <line x1={sx(t.v)} x2={sx(t.v)} y1={y} y2={y + h} stroke={theme.grid} strokeWidth={1} />
          <text x={sx(t.v)} y={y + h + 30} fill={theme.textFaint} fontSize={18} textAnchor="middle" fontFamily={theme.mono}>
            {t.label}
          </text>
        </g>
      ))}
      <text x={x + w / 2} y={y + h + 66} fill={theme.textDim} fontSize={20} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
        {xLabel}
      </text>
      <text
        x={x - 74}
        y={y + h / 2}
        fill={theme.textDim}
        fontSize={20}
        textAnchor="middle"
        fontFamily={theme.font}
        letterSpacing={2}
        transform={`rotate(-90 ${x - 74} ${y + h / 2})`}
      >
        {yLabel}
      </text>
      {children}
      {/* expose the mapping to children through a render prop style helper */}
      <g data-x0={xRange[0]} data-y0={yRange[0]} />
    </g>
  );
};

/** Builds value->pixel mappers for a given frame, matching `Axes`. */
export const projector = (
  x: number,
  y: number,
  w: number,
  h: number,
  xRange: [number, number],
  yRange: [number, number],
) => ({
  sx: (v: number) => x + ((v - xRange[0]) / (xRange[1] - xRange[0])) * w,
  sy: (v: number) => y + h - ((v - yRange[0]) / (yRange[1] - yRange[0])) * h,
});

export const polyline = (pts: Array<[number, number]>) =>
  pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px} ${py}`).join(' ');

/**
 * The film's central argument, plotted: net torsional damping against wind speed.
 *
 * This is NOT a schematic. It is generated from the same `linearGrowth` the acts
 * animate with, so the threshold it shows is the threshold the simulation
 * crosses. The director's discipline is that any figure that is not computed must
 * be marked `示意`; this one must not be, because it is.
 */
export const StabilityDiagram: React.FC<{
  frame: number;
  appear: number;
  /**: value -> pixel from the surrounding `projector` */
  sx: (v: number) => number;
  sy: (v: number) => number;
  growth: (U: number) => number;
  xRange: [number, number];
  yRange: [number, number];
  criticalSpeed: number;
  collapseWind: number;
  /** 0..1 how far the wind cursor has travelled across the plot */
  sweep: number;
  opacity?: number;
}> = ({frame, appear, sx, sy, growth, xRange, yRange, criticalSpeed, collapseWind, sweep, opacity = 1}) => {
  const o = enter(frame, appear, 20) * opacity;
  if (o <= 0.01) return null;

  const pts: Array<[number, number]> = [];
  const N = 160;
  const maxU = sweep * xRange[1];
  for (let i = 0; i <= N; i++) {
    const U = xRange[0] + ((xRange[1] - xRange[0]) * i) / N;
    if (U > maxU) break;
    pts.push([sx(U), sy(growth(U))]);
  }
  /* the unstable side is filled, because "above the line" is the film's point */
  const fillPts: Array<[number, number]> = [[sx(criticalSpeed), sy(0)]];
  for (let i = 0; i <= N; i++) {
    const U = criticalSpeed + ((xRange[1] - criticalSpeed) * i) / N;
    if (U > maxU) break;
    fillPts.push([sx(U), sy(growth(U))]);
  }
  const fillPath =
    fillPts.length > 2
      ? polyline(fillPts) + ` L ${fillPts[fillPts.length - 1][0]} ${sy(0)} Z`
      : null;

  return (
    <g opacity={o}>
      {fillPath ? <path d={fillPath} fill={theme.energySoft} /> : null}
      <line x1={sx(criticalSpeed)} x2={sx(criticalSpeed)} y1={sy(yRange[0])} y2={sy(yRange[1])} stroke={theme.energy} strokeWidth={2} strokeDasharray="10 7" />
      <path d={polyline(pts)} fill="none" stroke={theme.steel} strokeWidth={3.4} />
      <text x={sx(criticalSpeed) + 14} y={sy(yRange[1]) + 30} fill={theme.energy} fontSize={22} letterSpacing={1}>
        临界速度 约每小时六十公里
      </text>
      {/* the wind that actually blew, for the margin */}
      {maxU >= collapseWind ? (
        <g>
          <line x1={sx(collapseWind)} x2={sx(collapseWind)} y1={sy(yRange[0])} y2={sy(yRange[1])} stroke={theme.textDim} strokeWidth={1.6} />
          <text x={sx(collapseWind) + 12} y={sy(yRange[0]) - 16} fill={theme.textDim} fontSize={21}>
            当天 每小时六十四公里
          </text>
        </g>
      ) : null}
      <text x={sx(criticalSpeed) + 16} y={sy(yRange[1]) + 90} fill={theme.textFaint} fontSize={19}>
        只高出约一成，桥就先站了一百二十九天
      </text>
    </g>
  );
};

/**
 * The aerodynamic torque as a function of twist angle.
 *
 * The slope at the origin is what decides everything: positive slope means the
 * air pushes the deck further in the direction it is already going, which is the
 * mathematical fingerprint of negative damping. Plotted from the model's own
 * coefficients, with the restoring spring drawn dashed for contrast.
 */
export const TorqueCurve: React.FC<{
  frame: number;
  appear: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  aerodynamic: (thetaDeg: number) => number;
  restoring: (thetaDeg: number) => number;
  opacity?: number;
  showRestoring?: number;
}> = ({frame, appear, sx, sy, aerodynamic, restoring, opacity = 1, showRestoring = 1}) => {
  const o = enter(frame, appear, 20) * opacity;
  if (o <= 0.01) return null;
  const aero: Array<[number, number]> = [];
  const rest: Array<[number, number]> = [];
  for (let d = -46; d <= 46; d += 2) {
    aero.push([sx(d), sy(aerodynamic(d))]);
    rest.push([sx(d), sy(restoring(d))]);
  }
  return (
    <g opacity={o}>
      <path d={polyline(rest)} fill="none" stroke={theme.inert} strokeWidth={2.2} strokeDasharray="9 7" opacity={showRestoring} />
      <path d={polyline(aero)} fill="none" stroke={theme.energy} strokeWidth={3.4} />
      {/* the same-sign region, which is the argument */}
      <line x1={sx(0)} x2={sx(0)} y1={sy(-1)} y2={sy(1)} stroke={theme.gridStrong} strokeWidth={1.4} />
    </g>
  );
};

/**
 * Work per cycle: what the air puts in against what the structure takes out. The
 * sign of the difference is the entire film, so the zero line is drawn heavy and
 * the difference curve is the brightest thing in the frame.
 */
export const EnergyBudget: React.FC<{
  frame: number;
  appear: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  airIn: (cycle: number) => number;
  structureOut: (cycle: number) => number;
  cycles: number;
  progress: number;
  opacity?: number;
}> = ({frame, appear, sx, sy, airIn, structureOut, cycles, progress, opacity = 1}) => {
  const o = enter(frame, appear, 20) * opacity;
  if (o <= 0.01) return null;
  const shown = Math.max(2, Math.round(cycles * clamp01(progress)));
  const air: Array<[number, number]> = [];
  const out: Array<[number, number]> = [];
  const net: Array<[number, number]> = [];
  for (let c = 1; c <= shown; c++) {
    const a = airIn(c);
    const b = structureOut(c);
    air.push([sx(c), sy(a)]);
    out.push([sx(c), sy(-b)]);
    net.push([sx(c), sy(a - b)]);
  }
  return (
    <g opacity={o}>
      <path d={polyline(air)} fill="none" stroke={theme.energy} strokeWidth={3} opacity={0.85} />
      <path d={polyline(out)} fill="none" stroke={theme.wind} strokeWidth={3} opacity={0.85} />
      <path d={polyline(net)} fill="none" stroke={theme.text} strokeWidth={3.6} />
    </g>
  );
};

/**
 * The broadband spectrum that demolishes the resonance account. The shape is the
 * argument: a broad, flat band with no peak means there is no rhythm to match, so
 * "it matched the bridge's frequency" cannot be the explanation. The whole thing
 * is marked `示意` by the calling act, because it is a teaching idealisation of a
 * turbulent spectrum rather than a measured record.
 */
export const SpectrumBand: React.FC<{
  frame: number;
  appear: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  fMax: number;
  energy: (f: number) => number;
  /** where the natural-frequency marker currently sits, Hz (or null) */
  markerHz: number | null;
  opacity?: number;
}> = ({frame, appear, sx, sy, fMax, energy, markerHz, opacity = 1}) => {
  const o = enter(frame, appear, 22) * opacity;
  if (o <= 0.01) return null;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 200; i++) {
    const f = (fMax * i) / 200;
    pts.push([sx(f), sy(energy(f))]);
  }
  return (
    <g opacity={o}>
      <path d={polyline(pts) + ` L ${sx(fMax)} ${sy(0)} L ${sx(0)} ${sy(0)} Z`} fill={theme.windSoft} stroke="none" />
      <path d={polyline(pts)} fill="none" stroke={theme.wind} strokeWidth={2.6} />
      {markerHz !== null ? (
        <g>
          <line x1={sx(markerHz)} x2={sx(markerHz)} y1={sy(0)} y2={sy(energy(markerHz) + 0.25)} stroke={theme.steel} strokeWidth={2.4} />
          <circle cx={sx(markerHz)} cy={sy(0)} r={6} fill={theme.steel} />
        </g>
      ) : null}
    </g>
  );
};

/** Absolute or relative amplitude envelope, used by several acts. */
export const Envelope: React.FC<{
  frame: number;
  appear: number;
  x: number;
  y: number;
  w: number;
  h: number;
  samples: number[];
  color: string;
  progress: number;
  /** index range the samples span, for the time axis */
  span: [number, number];
  opacity?: number;
}> = ({frame, appear, x, y, w, h, samples, color, progress, span, opacity = 1}) => {
  const o = enter(frame, appear, 18) * opacity;
  if (o <= 0.01 || samples.length === 0) return null;
  let peak = 1e-9;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const n = Math.max(2, Math.round(samples.length * clamp01(progress)));
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const px = x + (w * i) / (samples.length - 1);
    const py = y + h / 2 - (samples[i] / peak) * (h / 2) * 0.92;
    pts.push([px, py]);
  }
  void span;
  return (
    <g opacity={o}>
      <line x1={x} x2={x + w} y1={y + h / 2} y2={y + h / 2} stroke={theme.grid} strokeWidth={1} />
      <path d={polyline(pts)} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
    </g>
  );
};
