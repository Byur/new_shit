import React from 'react';
import {interpolate} from 'remotion';
import {ONI, ONI_MONTHS, ONI_START_YEAR, monthToCalendar} from '../oni';
import {oniAt} from '../state';
import {LAYOUT, ONI_MAX, ONI_MIN, STRIP_H, STRIP_W, theme} from '../theme';

/**
 * The film's clock.
 *
 * Every act reads its state off this one object: a 1950-2026 record of the
 * Oceanic Niño Index, drawn as a two-colour column trace. It is not decoration
 * and it is not a chart the narrator refers to — the cursor's position IS the
 * cross-section's state, so "the warm pool moved east in late 1997" and "the
 * cursor is standing in late 1997" are the same statement. That is what makes
 * the film's mechanism claims auditable: the viewer can see the cursor standing
 * where the record actually stands.
 *
 * Source: NOAA CPC, ERSSTv5, Niño-3.4, 1991-2020 base. See oni.ts.
 */

const x0 = LAYOUT.strip.left;
const x1 = LAYOUT.strip.right;
const y0 = LAYOUT.strip.top;
const y1 = LAYOUT.strip.bottom;

const plotTop = y0 + 16;
const plotBottom = y1 - 8;

export const monthToX = (m: number): number =>
  x0 + (Math.max(0, Math.min(ONI_MONTHS - 1, m)) / (ONI_MONTHS - 1)) * (x1 - x0);

export const oniToY = (v: number): number =>
  plotBottom - ((Math.max(ONI_MIN, Math.min(ONI_MAX, v)) - ONI_MIN) / (ONI_MAX - ONI_MIN)) * (plotBottom - plotTop);

export const yearToMonth = (year: number): number =>
  Math.max(0, Math.min(ONI_MONTHS - 1, (year - ONI_START_YEAR) * 12));

export const ZERO_Y = oniToY(0);

export type EventPin = {
  /** decimal year, e.g. 1997.9 */
  year: number;
  label: string;
  color: string;
  side: 'above' | 'below';
};

const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export const OniStrip: React.FC<{
  /** fractional month index of the cursor; null hides the cursor */
  cursor: number | null;
  /** 0..1 how much of the record has been drawn (the hook draws it live) */
  drawn?: number;
  /** pins that have been planted so far */
  pins?: EventPin[];
  /**
   * A translucent window marking the episode the current act is inside.
   * `reveal` is part of the contract: `stripWindowAt` returns a ramped reveal so
   * the window fades in rather than appearing in one frame. Omitting it here is
   * what let the value be computed and then silently dropped.
   */
  window?: {from: number; to: number; color: string; reveal: number} | null;
  /** dashed target zone for the 2026 forecast, in ONI units */
  forecastZone?: {from: number; to: number; label: string} | null;
  opacity?: number;
  /** a short label drawn at the left of the strip */
  caption?: string;
}> = ({
  cursor,
  drawn = 1,
  pins = [],
  window: win = null,
  forecastZone = null,
  opacity = 1,
  caption,
}) => {
  const clipW = (x1 - x0 + 40) * Math.max(0, Math.min(1, drawn));

  const columns: React.ReactNode[] = [];
  if (drawn > 0) {
    for (let m = 0; m < ONI_MONTHS; m++) {
      const v = ONI[m];
      const x = monthToX(m);
      if (x - x0 > clipW) break;
      const y = oniToY(v);
      const positive = v >= 0;
      columns.push(
        <rect
          key={m}
          x={x - 0.95}
          y={Math.min(y, ZERO_Y)}
          width={1.9}
          height={Math.max(0.9, Math.abs(ZERO_Y - y))}
          fill={positive ? theme.warm : theme.cold}
          opacity={positive ? 0.72 : 0.72}
        />,
      );
    }
  }

  const cursorMonth = cursor === null ? null : Math.max(0, Math.min(ONI_MONTHS - 1, cursor));
  const cursorX = cursorMonth === null ? 0 : monthToX(cursorMonth);
  const cursorV = cursorMonth === null ? 0 : oniAt(cursorMonth);
  const cursorY = oniToY(cursorV);
  const cal = cursorMonth === null ? null : monthToCalendar(Math.round(cursorMonth));
  const cursorVisible = cursorMonth !== null && cursorMonth <= ONI_MONTHS - 1 && cursorMonth >= 0;
  const readoutOnLeft = cursorX > x0 + (x1 - x0) * 0.72;

  return (
    <div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <clipPath id="oni-reveal">
            <rect x={x0 - 20} y={y0 - 4} width={clipW} height={STRIP_H + 20} />
          </clipPath>
          <clipPath id="oni-plot">
            <rect x={x0 - 20} y={y0 - 4} width={STRIP_W + 40} height={STRIP_H + 20} />
          </clipPath>
        </defs>

        {/* the band the record sits in */}
        <rect
          x={x0 - 20}
          y={y0 - 4}
          width={STRIP_W + 40}
          height={STRIP_H + 20}
          fill="rgba(255,255,255,0.014)"
          stroke={theme.panelEdge}
          strokeWidth={1}
          rx={6}
        />

        {/* decade grid */}
        {DECADES.map((dec) => {
          const x = monthToX(yearToMonth(dec));
          return (
            <g key={dec}>
              <line
                x1={x}
                x2={x}
                y1={plotTop - 6}
                y2={plotBottom + 4}
                stroke={theme.grid}
                strokeWidth={1}
              />
              <text
                x={x + 5}
                y={y1 + 2}
                fill={theme.textFaint}
                fontFamily={theme.mono}
                fontSize={15}
              >
                {dec}
              </text>
            </g>
          );
        })}

        {/* +/-0.5 event threshold */}
        {[0.5, -0.5].map((v) => (
          <line
            key={v}
            x1={x0}
            x2={x1}
            y1={oniToY(v)}
            y2={oniToY(v)}
            stroke={theme.gridStrong}
            strokeWidth={1}
            strokeDasharray="5 7"
          />
        ))}

        {/* zero */}
        <line x1={x0} x2={x1} y1={ZERO_Y} y2={ZERO_Y} stroke={theme.axis} strokeWidth={1.4} />

        <g clipPath="url(#oni-reveal)">
          <g clipPath="url(#oni-plot)">{columns}</g>
        </g>

        {/*
          The episode currently under discussion. `win.reveal` is the ramp that
          state.ts computes (`[start, 0], [full, 1]`) precisely so this window
          never appears in a single frame; it was computed and then dropped, so
          the 40%-alpha stroke popped. The group carries the ramp now.
        */}
        {win ? (
          <g opacity={win.reveal}>
            <rect
              x={monthToX(yearToMonth(win.from))}
              y={plotTop - 8}
              width={Math.max(2, monthToX(yearToMonth(win.to)) - monthToX(yearToMonth(win.from)))}
              height={plotBottom - plotTop + 16}
              fill={`${win.color}14`}
              stroke={`${win.color}66`}
              strokeWidth={1.2}
              rx={4}
            />
          </g>
        ) : null}

        {/* the forecast target zone (2026) */}
        {forecastZone ? (
          <g>
            <rect
              x={monthToX(ONI_MONTHS - 3)}
              y={oniToY(forecastZone.to)}
              width={monthToX(ONI_MONTHS - 1) - monthToX(ONI_MONTHS - 3)}
              height={oniToY(forecastZone.from) - oniToY(forecastZone.to)}
              fill="rgba(255,106,61,0.16)"
              stroke={theme.warm}
              strokeWidth={1.2}
              strokeDasharray="5 4"
              rx={3}
            />
            {/*
              The top-right band of the strip already carries the 2023-24 and
              2026 pin labels and the live readout. Anchoring this label to the
              top of the dashed zone (oniToY(to) - 8) put it on top of all
              three at full opacity. It now sits in the clear row between the
              readout's date caption and the year ticks, which measured empty.
            */}
            <text
              x={monthToX(ONI_MONTHS - 1)}
              y={plotBottom - 22}
              textAnchor="end"
              fill={theme.warm}
              fontFamily={theme.font}
              fontSize={16}
            >
              {forecastZone.label}
            </text>
          </g>
        ) : null}

        {/* event pins */}
        {pins.map((pin) => {
          const x = monthToX(yearToMonth(pin.year));
          const up = pin.side === 'above';
          /*
            The live readout travels with the cursor and is 220px wide, so it
            lands on top of whichever event pin the cursor is standing on — and
            the film walks the cursor through 1973, 1998 and 2024 in turn. The
            label yields to the readout instead of the other way round: the
            readout carries the number, the label is a name for it.
          */
          const labelFade = cursorVisible
            ? interpolate(Math.abs(x - cursorX), [190, 300], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 1;
          return (
            <g key={`${pin.year}-${pin.label}`}>
              <line
                x1={x}
                x2={x}
                y1={up ? plotTop - 10 : plotBottom + 2}
                y2={up ? plotTop - 2 : plotBottom + 10}
                stroke={pin.color}
                strokeWidth={2}
              />
              <circle cx={x} cy={up ? plotTop - 13 : plotBottom + 13} r={3.4} fill={pin.color} />
              <text
                x={x}
                y={up ? plotTop - 18 : plotBottom + 28}
                textAnchor="middle"
                opacity={labelFade}
                fill={pin.color}
                fontFamily={theme.font}
                fontSize={16}
                fontWeight={600}
              >
                {pin.label}
              </text>
            </g>
          );
        })}

        {/* cursor */}
        {cursorVisible ? (
          <g>
            <line
              x1={cursorX}
              x2={cursorX}
              y1={plotTop - 10}
              y2={plotBottom + 10}
              stroke={theme.focus}
              strokeWidth={1.6}
              opacity={0.9}
            />
            <circle cx={cursorX} cy={cursorY} r={5.5} fill={theme.focus} />
            <circle
              cx={cursorX}
              cy={cursorY}
              r={11}
              fill="none"
              stroke={theme.focus}
              strokeWidth={1.6}
              opacity={0.5}
            />
          </g>
        ) : null}
      </svg>

      {/* the strip's own readout, placed on whichever side has room */}
      {cursorVisible && cal ? (
        <div
          style={{
            position: 'absolute',
            left: readoutOnLeft ? cursorX - 236 : cursorX + 16,
            top: y0 - 2,
            width: 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: readoutOnLeft ? 'flex-end' : 'flex-start',
            fontFamily: theme.font,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: cursorV >= 0 ? theme.warm : theme.cold,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0.4,
              lineHeight: 1.05,
              textShadow: '0 2px 12px rgba(0,0,0,0.9)',
            }}
          >
            {cursorV >= 0 ? '+' : '−'}
            {Math.abs(cursorV).toFixed(2)}
            <span style={{fontSize: 16, color: theme.textFaint, marginLeft: 6}}>°C</span>
          </div>
          <div
            style={{
              fontSize: 15,
              color: theme.textFaint,
              fontFamily: theme.mono,
              marginTop: 2,
            }}
          >
            {cal.year}-{String(cal.month).padStart(2, '0')} · ONI
          </div>
        </div>
      ) : null}

      {caption ? (
        <div
          style={{
            position: 'absolute',
            left: x0,
            top: y0 - 24,
            fontFamily: theme.font,
            fontSize: 16,
            letterSpacing: 2,
            color: theme.textFaint,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};
