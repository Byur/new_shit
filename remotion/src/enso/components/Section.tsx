import React from 'react';
import {interpolate} from 'remotion';
import {theme} from '../theme';

/**
 * The equatorial Pacific, in section.
 *
 * This is the film's one piece of apparatus. Almost every mechanism claim is
 * made by changing its state rather than by cutting to a new diagram, and the
 * state is not authored — it is read from the real ONI value at the cursor
 * (see state.ts). The viewer therefore sees the record and the ocean move
 * together, and can check one against the other.
 *
 * Geometry, and what is and is not to scale — this matters, so it is stated
 * here and in the on-screen disclosure rather than implied:
 *
 *   - HORIZONTAL is real. The section spans 100°E to 285°E (75°W), i.e. the
 *     Maritime Continent to the South American margin. Land blocks and place
 *     ticks sit at their true longitudes, and the fact that the equator crosses
 *     NO land between Borneo (117.5°E) and Ecuador (279.8°E) is a real property
 *     of the planet, not a drawing choice.
 *   - VERTICAL is real to 400 m at 1 px per metre, so the thermocline depths in
 *     metres can be read straight off the axis.
 *   - The atmosphere above the surface line is NOT to scale; it is an
 *     explanatory band that has to carry the Walker circulation.
 *   - The wind arrows are drawn short because a 7 m/s trade wind cannot be
 *     drawn to scale either. Their LENGTH is proportional to wind strength, so
 *     within the drawing they are comparable to each other.
 *   - Sea level: the western Pacific really does stand about half a metre
 *     higher than the eastern. Half a metre is 0.5 px in this projection, so
 *     it is annotated rather than drawn.
 */

export const SECTION_W = 1680;
export const SECTION_H = 620;
export const SURFACE_Y = 190;
/** px per metre below the surface line */
export const DEPTH_PX = 1;
export const DEPTH_MAX = 400;
export const LON_W = 100;
export const LON_E = 285;

export const lonToX = (lon: number): number =>
  ((Math.max(LON_W, Math.min(LON_E, lon)) - LON_W) / (LON_E - LON_W)) * SECTION_W;
export const depthToY = (d: number): number => SURFACE_Y + d * DEPTH_PX;

/* ------------------------------------------------------------------ */
/* The response model                                                  */
/* ------------------------------------------------------------------ */

/**
 * Every geometric response is a linear function of ONI in °C, anchored on
 * published values for the neutral state and calibrated so that a +2.4 event
 * (1997-98, 2015-16) and a -2.0 event (1973-74) land where the literature puts
 * them: thermocline nearly flat under a strong El Niño, steeply tilted under a
 * strong La Niña. It is a simplification — the real response is neither linear
 * nor zonally uniform — and the doc says so.
 */
export const response = (oni: number) => {
  const o = Math.max(-2.4, Math.min(3.0, oni));
  return {
    /** eastern edge of the warm pool, °E. Neutral ≈ 155, strong El Niño ≈ 208 */
    warmEdge: 155 + 22 * o,
    /** western limit of the warm pool, °E — retracts as the pool slides east */
    warmStart: 100,
    /** thermocline depth at the western end of the basin, metres */
    thermoWest: 165 - 30 * o,
    /** thermocline depth at the eastern end, metres */
    thermoEast: 48 + 30 * o,
    /** normalised trade-wind strength; 1 = neutral, →0 = collapsed, can reverse */
    wind: Math.max(0.06, 1 - 0.52 * o),
    /** sign of the wind: negative means the trades have reversed to westerly */
    windSign: 1 - 0.52 * o < 0 ? -1 : 1,
    /** coastal upwelling off Peru; 1 = neutral */
    upwell: Math.max(0.06, 1 - 0.62 * o),
    /** how far the convection has followed the warm pool, 0..1 */
    convection: Math.max(0, Math.min(1, (o + 0.6) / 2.6)),
  };
};

/* ------------------------------------------------------------------ */
/* Land, at real longitudes                                            */
/* ------------------------------------------------------------------ */

/** Islands on the western margin, drawn as tapered silhouettes. */
const ISLANDS: Array<{lon: number; w: number; h: number; name?: string}> = [
  {lon: 102, w: 5.5, h: 46, name: '苏门答腊'},
  {lon: 114, w: 9, h: 58, name: '婆罗洲'},
  {lon: 121, w: 4, h: 34},
  {lon: 140, w: 12, h: 52, name: '新几内亚'},
  {lon: 167, w: 1.2, h: 12},
];

const PLACE_TICKS: Array<{lon: number; label: string; strong?: boolean}> = [
  {lon: 100, label: '100°E', strong: true},
  {lon: 114, label: '婆罗洲'},
  {lon: 140, label: '新几内亚'},
  {lon: 167, label: '瑙鲁'},
  {lon: 180, label: '日期变更线', strong: true},
  {lon: 203, label: '圣诞岛'},
  {lon: 270, label: '加拉帕戈斯'},
  {lon: 280, label: '厄瓜多尔', strong: true},
];

const Island: React.FC<{lon: number; w: number; h: number}> = ({lon, w, h}) => {
  const cx = lonToX(lon);
  const hw = (w / 2) * (SECTION_W / (LON_E - LON_W));
  const d = `M ${cx - hw} ${SURFACE_Y + 6}
             Q ${cx - hw * 0.75} ${SURFACE_Y - h * 0.72} ${cx - hw * 0.18} ${SURFACE_Y - h}
             Q ${cx + hw * 0.3} ${SURFACE_Y - h * 0.82} ${cx + hw * 0.62} ${SURFACE_Y - h * 0.36}
             Q ${cx + hw * 0.9} ${SURFACE_Y - h * 0.1} ${cx + hw} ${SURFACE_Y + 8} Z`;
  return <path d={d} fill={theme.land} stroke={theme.landEdge} strokeWidth={1.1} />;
};

/* ------------------------------------------------------------------ */
/* Clouds and rain                                                     */
/* ------------------------------------------------------------------ */

const Convection: React.FC<{x: number; scale: number; frame: number; opacity: number}> = ({
  x,
  scale,
  frame,
  opacity,
}) => {
  if (opacity <= 0.01 || scale <= 0.02) return null;
  const drift = Math.sin(frame / 34) * 5;
  const cx = x + drift;
  const top = SURFACE_Y - 30 - 78 * scale;
  return (
    <g opacity={opacity}>
      {/* the rising column */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path
            d={`M ${cx - 16 + i * 16} ${SURFACE_Y - 8} L ${cx - 16 + i * 16} ${top + 16}`}
            stroke={theme.wet}
            strokeWidth={1.6}
            opacity={0.32}
          />
          <path
            d={`M ${cx - 21 + i * 16} ${top + 30} L ${cx - 16 + i * 16} ${top + 16} L ${cx - 11 + i * 16} ${top + 30}`}
            fill="none"
            stroke={theme.wet}
            strokeWidth={1.6}
            opacity={0.42}
          />
        </g>
      ))}
      {/* cloud mass */}
      {[
        [-46, 0.6],
        [-14, 1],
        [20, 0.82],
        [52, 0.55],
      ].map(([dx, s], i) => (
        <ellipse
          key={i}
          cx={cx + dx * scale}
          cy={top + 14 + (i % 2) * 7}
          rx={36 * s * scale + 12}
          ry={15 * s * scale + 5}
          fill="rgba(150,190,225,0.30)"
        />
      ))}
      {/* rain */}
      {Array.from({length: 11}).map((_, i) => {
        const rx = cx - 74 * scale + i * 15 * scale;
        const phase = ((frame * 1.7 + i * 37) % 46) / 46;
        return (
          <line
            key={i}
            x1={rx}
            x2={rx - 3}
            y1={SURFACE_Y - 8 - phase * 30}
            y2={SURFACE_Y - 20 - phase * 30}
            stroke={theme.wet}
            strokeWidth={1.6}
            opacity={0.5 * (1 - phase)}
          />
        );
      })}
    </g>
  );
};

/* ------------------------------------------------------------------ */

export type SectionProps = {
  frame: number;
  /** the real ONI value in °C at the film's cursor */
  oni: number;
  opacity?: number;
  /** independent reveal controls, so acts can introduce the parts in order */
  windReveal?: number;
  thermoReveal?: number;
  upwellReveal?: number;
  rainReveal?: number;
  /** the Walker circulation cell, drawn only once the rain has been explained */
  walkerReveal?: number;
  /** place ticks along the surface */
  ticksReveal?: number;
  /** highlight the unbroken water between the two margins */
  fetchReveal?: number;
  /** dim everything slightly when text has to sit on top */
  dim?: number;
  /** a pulse on the thermocline, for the beat where it flattens */
  thermoPulse?: number;
  /** a pulse on the upwelling, for the beat where the cold water stops */
  upwellPulse?: number;
};

export const Section: React.FC<SectionProps> = ({
  frame,
  oni,
  opacity = 1,
  windReveal = 0,
  thermoReveal = 0,
  upwellReveal = 0,
  rainReveal = 0,
  walkerReveal = 0,
  ticksReveal = 0,
  fetchReveal = 0,
  dim = 0,
  thermoPulse = 0,
  upwellPulse = 0,
}) => {
  const r = response(oni);
  if (opacity <= 0.01) return null;

  const warmX = lonToX(r.warmEdge);
  const thermoPath = `M 0 ${depthToY(r.thermoWest)}
    C ${SECTION_W * 0.22} ${depthToY(r.thermoWest * 0.92 + r.thermoEast * 0.08)}
      ${SECTION_W * 0.55} ${depthToY(r.thermoWest * 0.4 + r.thermoEast * 0.6)}
      ${SECTION_W} ${depthToY(r.thermoEast)}`;
  const warmPath = `${thermoPath} L ${SECTION_W} ${SURFACE_Y} L 0 ${SURFACE_Y} Z`;

  /* Trade winds: right-to-left arrows, length proportional to strength. */
  const windBase = 74;
  const windLen = windBase * r.wind * (r.windSign < 0 ? -1 : 1);
  const windRows = [0, 1, 2];

  return (
    <div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0}}
      >
        <defs>
          <linearGradient id="enso-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.oceanTop} />
            <stop offset="55%" stopColor={theme.oceanDeep} />
            <stop offset="100%" stopColor="#020509" />
          </linearGradient>
          <linearGradient id="enso-warm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF5A2E" stopOpacity={0.5} />
            <stop offset="72%" stopColor="#FF8A46" stopOpacity={0.34} />
            <stop offset="100%" stopColor="#FFA768" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="enso-cold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.cold} stopOpacity={0.36} />
            <stop offset="100%" stopColor={theme.cold} stopOpacity={0.03} />
          </linearGradient>
          <clipPath id="enso-section-clip">
            <rect x={0} y={0} width={SECTION_W} height={SECTION_H} />
          </clipPath>
          <clipPath id="enso-below-surface">
            <rect x={0} y={SURFACE_Y} width={SECTION_W} height={SECTION_H - SURFACE_Y} />
          </clipPath>
        </defs>

        <g transform="translate(120 150)" clipPath="url(#enso-section-clip)">
          {/* ---------------- water body ---------------- */}
          <rect x={0} y={SURFACE_Y} width={SECTION_W} height={SECTION_H - SURFACE_Y} fill="url(#enso-water)" />

          {/* the warm layer, from the surface down to the thermocline */}
          <g clipPath="url(#enso-below-surface)">
            <path d={warmPath} fill="url(#enso-warm)" opacity={thermoReveal} />
          </g>

          {/* the cold tongue: cold water reaching the surface in the east */}
          <g clipPath="url(#enso-below-surface)" opacity={0.9}>
            <rect
              x={lonToX(232)}
              y={SURFACE_Y}
              width={SECTION_W - lonToX(232)}
              height={depthToY(r.thermoEast) - SURFACE_Y}
              fill="url(#enso-cold)"
              opacity={thermoReveal}
            />
          </g>

          {/* depth grid */}
          {[100, 200, 300, 400].map((d) => (
            <g key={d}>
              <line
                x1={0}
                x2={SECTION_W}
                y1={depthToY(d)}
                y2={depthToY(d)}
                stroke={theme.grid}
                strokeWidth={1}
                opacity={thermoReveal * 0.9}
              />
              <text
                x={SECTION_W - 6}
                y={depthToY(d) - 6}
                textAnchor="end"
                fill={theme.textGhost}
                fontFamily={theme.mono}
                fontSize={14}
                opacity={thermoReveal}
              >
                {d} m
              </text>
            </g>
          ))}

          {/* ---------------- thermocline ---------------- */}
          <g opacity={interpolate(thermoReveal, [0, 1], [0, 1])}>
            <path
              d={thermoPath}
              fill="none"
              stroke={theme.focus}
              strokeWidth={2 + thermoPulse * 2.4}
              strokeDasharray="11 7"
              opacity={0.55 + thermoPulse * 0.4}
            />
            <text
              x={SECTION_W * 0.34}
              y={depthToY((r.thermoWest * 0.62 + r.thermoEast * 0.38)) - 14}
              fill={theme.text}
              fontFamily={theme.font}
              fontSize={19}
              fontWeight={600}
              opacity={0.85}
            >
              温跃层
            </text>
          </g>

          {/* ---------------- warm pool edge ---------------- */}
          <g opacity={thermoReveal}>
            <line
              x1={warmX}
              x2={warmX}
              y1={SURFACE_Y - 4}
              y2={depthToY(Math.max(r.thermoWest, r.thermoEast) * 0.55)}
              stroke={theme.warm}
              strokeWidth={2}
              strokeDasharray="6 5"
              opacity={0.8}
            />
            <text
              x={warmX + 10}
              y={SURFACE_Y + 30}
              fill={theme.warm}
              fontFamily={theme.font}
              fontSize={19}
              fontWeight={700}
            >
              暖池东界
            </text>
          </g>

          {/* ---------------- upwelling off Peru ---------------- */}
          <g opacity={upwellReveal}>
            {[0, 1, 2, 3, 4].map((i) => {
              const x = lonToX(272 + i * 3.2);
              const strength = Math.max(0, r.upwell - 0.1);
              const rise = 26 * strength * (1 + upwellPulse * 0.5);
              return (
                <g key={i} opacity={0.25 + 0.75 * Math.min(1, strength)}>
                  <path
                    d={`M ${x} ${SURFACE_Y + 96} C ${x} ${SURFACE_Y + 60} ${x - 5} ${SURFACE_Y + 40} ${x - 4} ${SURFACE_Y + 96 - rise - 40}`}
                    fill="none"
                    stroke={theme.cold}
                    strokeWidth={2.2}
                    opacity={0.75}
                  />
                  <path
                    d={`M ${x - 10} ${SURFACE_Y + 96 - rise - 28} L ${x - 4} ${SURFACE_Y + 96 - rise - 42} L ${x + 2} ${SURFACE_Y + 96 - rise - 27}`}
                    fill="none"
                    stroke={theme.cold}
                    strokeWidth={2.2}
                    opacity={0.85}
                  />
                </g>
              );
            })}
            <text
              x={lonToX(281)}
              y={SURFACE_Y + 128}
              textAnchor="end"
              fill={theme.cold}
              fontFamily={theme.font}
              fontSize={18}
              fontWeight={600}
              opacity={0.9}
            >
              涌升
            </text>
          </g>

          {/* ---------------- trade winds ---------------- */}
          <g opacity={windReveal}>
            {windRows.map((row) => {
              const y = 40 + row * 34;
              const len = windLen * (1 - row * 0.12);
              const xStart = SECTION_W * 0.66 - row * 60;
              const dir = len < 0 ? -1 : 1;
              return (
                <g key={row} opacity={0.32 + 0.5 * Math.min(1, r.wind)}>
                  <line
                    x1={xStart}
                    x2={xStart + len}
                    y1={y}
                    y2={y}
                    stroke={r.windSign < 0 ? theme.warm : theme.neutral}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${xStart + len} ${y} l ${-12 * dir} -7 M ${xStart + len} ${y} l ${-12 * dir} 7`}
                    fill="none"
                    stroke={r.windSign < 0 ? theme.warm : theme.neutral}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
            <text
              x={SECTION_W * 0.66 + 10}
              y={26}
              fill={r.windSign < 0 ? theme.warm : theme.textDim}
              fontFamily={theme.font}
              fontSize={19}
              fontWeight={600}
            >
              {r.windSign < 0 ? '西风异常（信风反向）' : '东南信风'}
            </text>
          </g>

          {/* ---------------- Walker circulation ---------------- */}
          <g opacity={walkerReveal}>
            <path
              d={`M ${warmX} ${SURFACE_Y - 26}
                  C ${warmX} ${SURFACE_Y - 150} ${lonToX(262)} ${SURFACE_Y - 150} ${lonToX(262)} ${SURFACE_Y - 26}`}
              fill="none"
              stroke={theme.textDim}
              strokeWidth={2}
              strokeDasharray="9 7"
              opacity={0.6}
            />
            <path
              d={`M ${lonToX(262)} ${SURFACE_Y - 40} l -8 14 l 16 0 Z`}
              fill={theme.textDim}
              opacity={0.6}
            />
            <text
              x={(warmX + lonToX(262)) / 2}
              y={SURFACE_Y - 156}
              textAnchor="middle"
              fill={theme.textDim}
              fontFamily={theme.font}
              fontSize={19}
              letterSpacing={1}
            >
              沃克环流
            </text>
          </g>

          {/* ---------------- convection ---------------- */}
          <Convection
            x={Math.min(SECTION_W - 120, warmX - 40)}
            scale={0.45 + r.convection * 0.75}
            frame={frame}
            opacity={rainReveal}
          />

          {/* subsidence over the cold tongue */}
          <g opacity={rainReveal * 0.85}>
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M ${lonToX(250 + i * 8)} ${SURFACE_Y - 96 - i * 14} l 0 34`}
                stroke={theme.dry}
                strokeWidth={2}
                opacity={0.5}
              />
            ))}
            <text
              x={lonToX(262)}
              y={SURFACE_Y - 128}
              textAnchor="middle"
              fill={theme.dry}
              fontFamily={theme.font}
              fontSize={18}
              fontWeight={600}
            >
              下沉 · 少雨
            </text>
          </g>

          {/* ---------------- the unbroken fetch ---------------- */}
          <g opacity={fetchReveal}>
            <line
              x1={lonToX(118)}
              x2={lonToX(280)}
              y1={SURFACE_Y - 10}
              y2={SURFACE_Y - 10}
              stroke={theme.focus}
              strokeWidth={2.4}
              opacity={0.75}
            />
            {[118, 280].map((lon) => (
              <line
                key={lon}
                x1={lonToX(lon)}
                x2={lonToX(lon)}
                y1={SURFACE_Y - 18}
                y2={SURFACE_Y - 2}
                stroke={theme.focus}
                strokeWidth={2.4}
                opacity={0.75}
              />
            ))}
            <text
              x={(lonToX(118) + lonToX(280)) / 2}
              y={SURFACE_Y - 20}
              textAnchor="middle"
              fill={theme.focus}
              fontFamily={theme.font}
              fontSize={24}
              fontWeight={700}
              letterSpacing={1.5}
            >
              赤道上连续 162 个经度 · 中间没有陆地
            </text>
          </g>

          {/* ---------------- sea surface ---------------- */}
          <line
            x1={0}
            x2={SECTION_W}
            y1={SURFACE_Y}
            y2={SURFACE_Y}
            stroke={theme.focus}
            strokeWidth={1.8}
            opacity={0.42}
          />

          {/* ---------------- land ---------------- */}
          {ISLANDS.map((is) => (
            <Island key={is.lon} lon={is.lon} w={is.w} h={is.h} />
          ))}
          {/* the South American margin and the Andes */}
          <g>
            <path
              d={`M ${lonToX(279.8)} ${SURFACE_Y + 8}
                  L ${lonToX(283)} ${SURFACE_Y - 96}
                  L ${lonToX(285.4)} ${SURFACE_Y - 132}
                  L ${SECTION_W} ${SURFACE_Y - 118}
                  L ${SECTION_W} ${SURFACE_Y + 10} Z`}
              fill={theme.land}
              stroke={theme.landEdge}
              strokeWidth={1.2}
            />
            <text
              x={SECTION_W - 12}
              y={SURFACE_Y - 142}
              textAnchor="end"
              fill={theme.textFaint}
              fontFamily={theme.font}
              fontSize={17}
            >
              安第斯
            </text>
          </g>

          {/* ---------------- place ticks ---------------- */}
          <g opacity={ticksReveal}>
            {PLACE_TICKS.map((t) => {
              const x = lonToX(t.lon);
              return (
                <g key={t.lon}>
                  <line
                    x1={x}
                    x2={x}
                    y1={SURFACE_Y + 2}
                    y2={SURFACE_Y + 12}
                    stroke={t.strong ? theme.axis : theme.gridStrong}
                    strokeWidth={1.4}
                  />
                  <text
                    x={x}
                    y={SURFACE_Y + 30}
                    textAnchor="middle"
                    fill={t.strong ? theme.textFaint : theme.textGhost}
                    fontFamily={theme.font}
                    fontSize={15}
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>

        {/* a soft darkening so overlays stay readable without hiding the section */}
        <rect x={0} y={0} width={1920} height={1080} fill="#03060B" opacity={dim * 0.62} />
      </svg>
    </div>
  );
};
