import React, {useEffect, useMemo, useRef, useState} from 'react';
import {staticFile, useDelayRender} from 'remotion';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource, Map as MapLibreMap} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {LAYOUT, MAP_H, MAP_W, theme} from '../theme';
import type {Highlight, MapMarker, MapView, Projector} from './MapCanvas';
import {CUES} from '../camera';

/**
 * The MapLibre variant of the map, built to the `remotion-maps` MapLibre
 * technique. Same props as the SVG `MapCanvas`, so the acts do not know which
 * backend is underneath.
 *
 * Differences that matter, relative to the SVG map:
 *  - the basemap is a real vector-tile map (coastlines, country fills and names
 *    come from the provider, not from a baked Natural Earth module)
 *  - the projection is the engine's Web Mercator, not plate carree, so a line of
 *    constant latitude is no longer a horizontal line and the tropics band is no
 *    longer geometrically comparable across latitudes
 *  - the camera is expressed as centre + zoom rather than centre + longitude span
 *  - every frame has to wait for the tile engine to go idle before Remotion may
 *    capture it, so the composition is slower to render and needs single
 *    concurrency plus ANGLE
 */

/* The provider's demo style: free, no API key, and — the reason it is usable here
   at all — it ships a `countries` polygon layer with `ADM0_A3`, which is what
   makes ISO-filtered highlighting possible without uploading our own polygons.
   Most production basemap schemas do not have that layer.
 *
 * The render therefore needs the network: this style, its glyph PBFs and its
 * vector tiles, all 1.3 MB of them. Baking them locally was tried and backed out
 * — it saved only ~19 % of render time, because the network was never the
 * bottleneck. See docs/map-backend-comparison.md. */
export const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/**
 * The demo style is a light pastel basemap, which is the opposite of this film:
 * it would turn the map from the darkest element in the frame into the brightest
 * one. Restyling the provider's own layers is the documented way to fix that, and
 * it is what a production film would do with a licensed style.
 *
 * Two things are deliberately NOT recoloured. Country name labels stay on, because
 * real label placement with collision and halo is something the SVG map does not
 * attempt at all. And the tile data itself is untouched: the coastline is still
 * the provider's, so this is a genuine basemap and not a redrawn one.
 */
const BASEMAP_RECOLOR: Array<[string, string, string | number]> = [
  ['background', 'background-color', theme.ocean],
  ['coastline', 'line-color', theme.landEdge],
  ['coastline', 'line-blur', 0],
  ['coastline', 'line-width', 1],
  ['countries-fill', 'fill-color', theme.land],
  ['countries-boundary', 'line-color', theme.landEdge],
  ['countries-boundary', 'line-opacity', 0.3],
  ['countries-boundary', 'line-width', 0.6],
  ['crimea-fill', 'fill-color', theme.land],
  /* the tropics are already the subject of act three; draw them in the film's
     belt colour rather than the provider's blue */
  ['geolines', 'line-color', theme.beltEdge],
  ['geolines', 'line-opacity', 0.2],
  ['geolines', 'line-width', 1],
  ['geolines-label', 'text-color', theme.textFaint],
  ['geolines-label', 'text-halo-color', 'rgba(0,0,0,0.8)'],
  ['countries-label', 'text-color', theme.textDim],
  ['countries-label', 'text-halo-color', 'rgba(0,0,0,0.85)'],
  ['countries-label', 'text-halo-width', 1.6],
];

const TILE_SIZE = 512;

/* The map container is MAP_W px wide, so the zoom that shows `span` degrees of
   longitude across it is fixed by the engine's own world size. */
const zoomForSpan = (span: number) =>
  Math.log2((MAP_W * 360) / (span * TILE_SIZE));

const mercatorY = (lat: number) => {
  const clamped = Math.max(-85.051129, Math.min(85.051129, lat));
  const r = (clamped * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
};

/**
 * A closed-form Web Mercator projector matching what MapLibre draws.
 *
 * This exists because the acts need to place annotations synchronously during
 * render, while the engine only knows its camera after an effect has run. Asking
 * the map would put the overlays one frame behind the tiles. Reimplementing the
 * projection removes the lag but reintroduces exactly the failure the SVG map
 * cannot have: two projections that have to be kept in agreement by hand.
 */
export const makeMercatorProjector = (view: MapView): Projector => {
  const worldSize = TILE_SIZE * Math.pow(2, zoomForSpan(view.span));
  const cx = ((view.lon + 180) / 360) * worldSize;
  const cy = mercatorY(view.lat) * worldSize;
  return (lon, lat) => ({
    x: LAYOUT.map.left + MAP_W / 2 + (((lon + 180) / 360) * worldSize - cx),
    y: LAYOUT.map.top + MAP_H / 2 + (mercatorY(lat) * worldSize - cy),
  });
};

/**
 * Natural Earth numeric ids (what the cues are written in) to the tile schema's
 * `ADM0_A3`. The vector tiles carry no numeric id, so this translation is
 * unavoidable when moving the highlights onto the engine.
 */
const ADM0_A3: Record<string, string> = {
  '156': 'CHN',
  '170': 'COL',
  '188': 'CRI',
  '231': 'ETH',
  '320': 'GTM',
  '360': 'IDN',
  '404': 'KEN',
  '591': 'PAN',
  '704': 'VNM',
  '076': 'BRA',
};

const cueLayerId = (i: number) => `coffee-hl-${i}`;
const SRC_ORIGINS = 'coffee-origins';
const SRC_BELT = 'coffee-belt';
const SRC_BELT_EDGE = 'coffee-belt-edge-src';
const LYR_BELT_FILL = 'coffee-belt-fill';
const LYR_BELT_EDGE = 'coffee-belt-edge';
const LYR_MARKER_RING = 'coffee-marker-ring';
const LYR_MARKER_DOT = 'coffee-marker-dot';

const BELT_FC = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-180, 23.5],
            [180, 23.5],
            [180, -23.5],
            [-180, -23.5],
            [-180, 23.5],
          ],
        ],
      },
    },
  ],
};

const BELT_EDGE_FC = {
  type: 'FeatureCollection' as const,
  features: [23.5, -23.5].map((lat) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-180, lat],
        [180, lat],
      ],
    },
  })),
};

const originsFC = (markers: MapMarker[]) => ({
  type: 'FeatureCollection' as const,
  features: markers.map((m) => ({
    type: 'Feature' as const,
    properties: {
      color: m.color,
      r: m.radius,
      o: m.opacity ?? 1,
      ring: m.ring ? 1 : 0,
    },
    geometry: {type: 'Point' as const, coordinates: [m.lon, m.lat]},
  })),
});

export const MapCanvasGL: React.FC<{
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
  showBelt = true,
  beltOpacity = 1,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const lastCamRef = useRef<string>('');
  const [ready, setReady] = useState(false);
  const {delayRender, continueRender} = useDelayRender();

  const markerData = useMemo(() => originsFC(markers), [markers]);

  /* --- mount once; the map is never unmounted (see the SVG notes) --------- */
  useEffect(() => {
    /* The map instance is bound to a DOM node, so the container must stay
       mounted for the whole film. The SVG map is stateless and can safely
       return null when it is invisible; this one cannot, and an early return
       here would leave the boot handle below uncleared forever. */
    if (mapRef.current) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const bootHandle = delayRender('MapLibre map load');

    /* MapLibre ships its worker in its own dist, so the blob-importing-unpkg
       trick is not needed and would put a third-party CDN in the render path. */
    maplibregl.setWorkerUrl(staticFile('maplibre-gl-worker.mjs'));

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: [view.lon, view.lat],
      zoom: zoomForSpan(view.span),
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: {preserveDrawingBuffer: true},
    });
    mapRef.current = map;

    map.on('load', () => {
      for (const [layerId, prop, value] of BASEMAP_RECOLOR) {
        if (map.getLayer(layerId)) {
          /* layer ids come from the provider's style, so the property name
             cannot be narrowed to a literal union at compile time */
          map.setPaintProperty(layerId, prop as never, value as never);
        }
      }

      /* Belt goes under the basemap's own land so the tint behaves like the SVG
         version, where the band is drawn over the ocean and under the coastline. */
      map.addSource(SRC_BELT, {type: 'geojson', data: BELT_FC});
      map.addLayer(
        {
          id: LYR_BELT_FILL,
          type: 'fill',
          source: SRC_BELT,
          paint: {'fill-color': theme.belt, 'fill-opacity': beltOpacity},
        },
        'coastline',
      );
      map.addSource(SRC_BELT_EDGE, {type: 'geojson', data: BELT_EDGE_FC});
      map.addLayer(
        {
          id: LYR_BELT_EDGE,
          type: 'line',
          source: SRC_BELT_EDGE,
          paint: {
            'line-color': theme.beltEdge,
            'line-width': 1.4,
            'line-dasharray': [7, 6],
          },
        },
        'coastline',
      );

      /* one fill layer per cue: colour is a property of the cue, not of the
         country, and two cues for one country may legitimately overlap */
      CUES.forEach((cue, i) => {
        /* same normalisation as the SVG map: a miss here would silently skip
           creating the layer, which is invisible in review */
        const adm = ADM0_A3[cue.iso.padStart(3, '0')];
        if (!adm) {
          throw new Error(`MapCanvasGL: no ADM0_A3 for ISO ${cue.iso}`);
        }
        map.addLayer({
          id: cueLayerId(i),
          type: 'fill',
          source: 'maplibre',
          'source-layer': 'countries',
          filter: ['==', ['get', 'ADM0_A3'], adm],
          paint: {'fill-color': cue.color, 'fill-opacity': 0},
        });
      });

      map.addSource(SRC_ORIGINS, {type: 'geojson', data: originsFC([])});
      map.addLayer({
        id: LYR_MARKER_RING,
        type: 'circle',
        source: SRC_ORIGINS,
        filter: ['==', ['get', 'ring'], 1],
        paint: {
          'circle-radius': ['+', ['get', 'r'], 7],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 1.6,
          'circle-stroke-opacity': 0.5,
        },
      });
      map.addLayer({
        id: LYR_MARKER_DOT,
        type: 'circle',
        source: SRC_ORIGINS,
        paint: {
          'circle-radius': ['get', 'r'],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'o'],
          'circle-stroke-color': 'rgba(0,0,0,0.45)',
          'circle-stroke-width': 1,
        },
      });

      map.jumpTo({
        center: [view.lon, view.lat],
        zoom: zoomForSpan(view.span),
        bearing: 0,
        pitch: 0,
      });
      lastCamRef.current = `${view.lon}|${view.lat}|${view.span}`;

      map.once('idle', () => {
        setReady(true);
        continueRender(bootHandle);
      });
    });

    map.on('error', (e) => {
      console.error('[MapCanvasGL]', e?.error ?? e);
    });

    /* deliberately no map.remove(): the skill warns it fights Remotion's
       render lifecycle */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- per-frame: camera, data, paint; then wait for the engine ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const handle = delayRender('MapLibre frame');

    const camKey = `${view.lon.toFixed(4)}|${view.lat.toFixed(4)}|${view.span.toFixed(4)}`;
    if (camKey !== lastCamRef.current) {
      map.jumpTo({
        center: [view.lon, view.lat],
        zoom: zoomForSpan(view.span),
        bearing: 0,
        pitch: 0,
      });
      lastCamRef.current = camKey;
    }

    (map.getSource(SRC_ORIGINS) as GeoJSONSource | undefined)?.setData(markerData);

    CUES.forEach((cue, i) => {
      if (!map.getLayer(cueLayerId(i))) return;
      const hit = highlights.find((h) => h.iso === cue.iso);
      map.setPaintProperty(cueLayerId(i), 'fill-opacity', hit ? hit.opacity : 0);
    });

    if (map.getLayer(LYR_BELT_FILL)) {
      map.setPaintProperty(LYR_BELT_FILL, 'fill-opacity', showBelt ? beltOpacity : 0);
    }

    /* Deliberately no cleanup that resolves the handle early: resolving before
       `idle` would let Remotion capture the canvas mid-tile-load, which is the
       exact shimmer the moving-map guidance warns about. */
    map.once('idle', () => continueRender(handle));
    map.triggerRepaint();
  }, [
    ready,
    view,
    markerData,
    highlights,
    showBelt,
    beltOpacity,
    delayRender,
    continueRender,
  ]);

  /* Below this the map is not readable, so it is hidden — but not unmounted. */
  const visible = opacity > 0.005;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: LAYOUT.map.left,
          top: LAYOUT.map.top,
          width: MAP_W,
          height: MAP_H,
          borderRadius: 10,
          overflow: 'hidden',
          opacity: visible ? opacity : 0,
          backgroundColor: theme.ocean,
        }}
      >
        <div
          ref={containerRef}
          style={{position: 'absolute', inset: 0, width: MAP_W, height: MAP_H}}
        />
      </div>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
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
        <text
          x={LAYOUT.map.right - 10}
          y={LAYOUT.map.bottom - 9}
          textAnchor="end"
          fontSize={15}
          fill={theme.textFaint}
          opacity={0.5}
          fontFamily={theme.font}
        >
          底图 MapLibre demo tiles · Natural Earth（公有领域）
        </text>
      </svg>
    </>
  );
};
