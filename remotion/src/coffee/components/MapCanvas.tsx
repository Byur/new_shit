import React from 'react';
import {
  COUNTRIES,
  LAND,
  projectLonLat,
  WINDOW,
  WORLD_H,
  WORLD_W,
} from '../geo';
import {LAYOUT, MAP_H, MAP_W, theme} from '../theme';

/**
 * The camera reads as a centre plus a zoom level rather than a bounding box.
 * The latitude span is derived from the plot's aspect and the world's aspect,
 * so the projection stays plate carrée at every zoom: a line of constant
 * latitude is always a horizontal line on screen. That property is the whole
 * reason for choosing this projection.
 */
export type MapView = {lon: number; lat: number; span: number};

export const FULL_VIEW: MapView = {lon: 20, lat: 0, span: 300};

const worldX = (lon: number) =>
  ((lon - WINDOW.lon0) / (WINDOW.lon1 - WINDOW.lon0)) * WORLD_W;
const worldY = (lat: number) =>
  ((WINDOW.lat1 - lat) / (WINDOW.lat1 - WINDOW.lat0)) * WORLD_H;

/** Screen-space transform for the current view: translate then scale. */
export const viewTransform = (view: MapView) => {
  const visibleWorldW = (view.span / (WINDOW.lon1 - WINDOW.lon0)) * WORLD_W;
  const scale = MAP_W / visibleWorldW;
  const cx = worldX(view.lon);
  const cy = worldY(view.lat);
  return {
    scale,
    tx: LAYOUT.map.left + MAP_W / 2 - cx * scale,
    ty: LAYOUT.map.top + MAP_H / 2 - cy * scale,
  };
};

/** Visible latitude span for a view — used to label the frame honestly. */
export const viewLatSpan = (view: MapView) =>
  (MAP_H / (MAP_W / ((view.span / 300) * WORLD_W)) / WORLD_H) * 90;

export const project = (view: MapView, lon: number, lat: number) => {
  const {scale, tx, ty} = viewTransform(view);
  return {x: tx + worldX(lon) * scale, y: ty + worldY(lat) * scale};
};

/**
 * Longitude/latitude to absolute composition coordinates.
 *
 * The acts take this rather than a `MapView` so that the projection can come
 * from whichever renderer is drawing the map. The SVG map supplies a closed-form
 * plate carree function; a tile engine has to supply its own, because the tiles
 * and the annotations must agree or the annotations drift off the geography.
 */
export type Projector = (lon: number, lat: number) => {x: number; y: number};

/**
 * Natural Earth ids are numeric and zero-padded to three digits, but a cue
 * naturally gets written as `'76'`. Normalising here rather than at the call
 * sites is deliberate: a lookup miss draws nothing at all, which reads as
 * "that country simply was not highlighted" and is invisible in review. Brazil
 * was silently un-highlighted in two acts for exactly this reason.
 */
const isoKey = (iso: string) => iso.padStart(3, '0');

export type MapMarker = {
  id: string;
  lon: number;
  lat: number;
  radius: number;
  color: string;
  opacity?: number;
  ring?: boolean;
};

export type Highlight = {iso: string; color: string; opacity: number};

export const MapCanvas: React.FC<{
  view: MapView;
  opacity?: number;
  highlights?: Highlight[];
  markers?: MapMarker[];
  showBorders?: boolean;
  showBelt?: boolean;
  beltOpacity?: number;
  children?: React.ReactNode;
}> = ({
  view,
  opacity = 1,
  highlights = [],
  markers = [],
  showBorders = true,
  showBelt = true,
  beltOpacity = 1,
  children,
}) => {
  if (opacity <= 0.005) return null;
  const {scale, tx, ty} = viewTransform(view);
  const latin = viewLatSpan(view);

  const beltTop = worldY(23.5);
  const beltBottom = worldY(-23.5);

  /* only label the graticule when there is room for it */
  const lonStep = latin > 55 ? 30 : latin > 26 ? 15 : 10;
  const latStep = latin > 55 ? 15 : latin > 26 ? 10 : 5;

  const lonLines: number[] = [];
  for (let lon = -180; lon <= 180; lon += lonStep) lonLines.push(lon);
  const latLines: number[] = [];
  for (let lat = -45; lat <= 45; lat += latStep) latLines.push(lat);

  const visibleLon = {
    from: view.lon - view.span / 2,
    to: view.lon + view.span / 2,
  };

  return (
    <svg
      width={LAYOUT.width}
      height={LAYOUT.height}
      viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
      style={{position: 'absolute', inset: 0, opacity}}
    >
      <defs>
        <clipPath id="mapClip">
          <rect
            x={LAYOUT.map.left}
            y={LAYOUT.map.top}
            width={MAP_W}
            height={MAP_H}
            rx={10}
          />
        </clipPath>
        <radialGradient id="mapGlow" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor={theme.arabica} stopOpacity={0.06} />
          <stop offset="100%" stopColor={theme.arabica} stopOpacity={0} />
        </radialGradient>
      </defs>

      <rect
        x={LAYOUT.map.left}
        y={LAYOUT.map.top}
        width={MAP_W}
        height={MAP_H}
        rx={10}
        fill={theme.ocean}
      />
      <rect
        x={LAYOUT.map.left}
        y={LAYOUT.map.top}
        width={MAP_W}
        height={MAP_H}
        rx={10}
        fill="url(#mapGlow)"
      />

      <g clipPath="url(#mapClip)">
        {/* the coffee belt: the tropics, and nothing else is the point */}
        {showBelt ? (
          <g opacity={beltOpacity}>
            <rect
              x={0}
              y={beltTop}
              width={WORLD_W}
              height={beltBottom - beltTop}
              fill={theme.belt}
              transform={`translate(${tx} ${ty}) scale(${scale})`}
            />
            {[23.5, -23.5].map((lat) => (
              <line
                key={lat}
                x1={0}
                x2={WORLD_W}
                y1={worldY(lat)}
                y2={worldY(lat)}
                stroke={theme.beltEdge}
                strokeWidth={1.4}
                strokeDasharray="10 9"
                transform={`translate(${tx} ${ty}) scale(${scale})`}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}

        {/* graticule */}
        <g opacity={0.55}>
          {lonLines
            .filter((lon) => lon >= visibleLon.from - 40 && lon <= visibleLon.to + 40)
            .map((lon) => (
              <line
                key={`lon${lon}`}
                x1={tx + worldX(lon) * scale}
                x2={tx + worldX(lon) * scale}
                y1={LAYOUT.map.top}
                y2={LAYOUT.map.bottom}
                stroke={lon === 0 ? theme.grid : 'rgba(255,255,255,0.035)'}
                strokeWidth={1}
              />
            ))}
          {latLines.map((lat) => (
            <line
              key={`lat${lat}`}
              x1={LAYOUT.map.left}
              x2={LAYOUT.map.right}
              y1={ty + worldY(lat) * scale}
              y2={ty + worldY(lat) * scale}
              stroke={lat === 0 ? theme.grid : 'rgba(255,255,255,0.035)'}
              strokeWidth={1}
            />
          ))}
        </g>

        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {LAND.map((d, i) => (
            <path
              key={`land${i}`}
              d={d}
              fill={theme.land}
              stroke={theme.landEdge}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              fillRule="evenodd"
            />
          ))}

          {showBorders
            ? Object.entries(COUNTRIES).map(([id, shape]) => (
                <path
                  key={`b${id}`}
                  d={shape.d}
                  fill="none"
                  stroke={theme.border}
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                  fillRule="evenodd"
                />
              ))
            : null}

          {highlights.map((h) =>
            COUNTRIES[isoKey(h.iso)] ? (
              <path
                key={`h${h.iso}${h.color}`}
                d={COUNTRIES[isoKey(h.iso)].d}
                fill={h.color}
                fillOpacity={h.opacity}
                stroke={h.color}
                strokeWidth={1.6}
                strokeOpacity={Math.min(1, h.opacity * 2.4)}
                vectorEffect="non-scaling-stroke"
                fillRule="evenodd"
              />
            ) : null,
          )}
        </g>

        {/* origin markers are projected per frame so they keep a fixed size */}
        {markers.map((m) => {
          const p = project(view, m.lon, m.lat);
          if (
            p.x < LAYOUT.map.left - 30 ||
            p.x > LAYOUT.map.right + 30 ||
            p.y < LAYOUT.map.top - 30 ||
            p.y > LAYOUT.map.bottom + 30
          ) {
            return null;
          }
          const o = m.opacity ?? 1;
          return (
            <g key={m.id} opacity={o}>
              {m.ring ? (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={m.radius + 7}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={1.6}
                  opacity={0.5}
                />
              ) : null}
              <circle cx={p.x} cy={p.y} r={m.radius} fill={m.color} opacity={0.9} />
              <circle
                cx={p.x}
                cy={p.y}
                r={m.radius}
                fill="none"
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={1}
              />
            </g>
          );
        })}
      </g>

      {/* frame */}
      <rect
        x={LAYOUT.map.left}
        y={LAYOUT.map.top}
        width={MAP_W}
        height={MAP_H}
        rx={10}
        fill="none"
        stroke={theme.panelEdge}
        strokeWidth={1.2}
      />

      {children}
    </svg>
  );
};

export const projectLon = (lon: number) => projectLonLat(lon, 0)[0];
