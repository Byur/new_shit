#!/usr/bin/env node
/**
 * Bake Natural Earth 110m coastlines into a static TypeScript module.
 *
 * The source files are TopoJSON (delta-encoded integer arcs). We decode them,
 * project to a plate carrée "world space" that the map camera can pan and zoom
 * inside, drop points that would land inside the same pixel, and emit SVG path
 * strings. Everything downstream is static data, so this runs once and the
 * result is committed.
 *
 * Usage: node scripts/build-geo.mjs [--out <file>] [--window lon0,lon1,lat0,lat1] [--width <n>]
 *
 * Defaults reproduce src/coffee/geo.ts exactly. The ENSO piece asks for the
 * opposite view of the planet: a Pacific-centred window, so the ocean the film
 * is about sits in the middle of the frame instead of being cut in half.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const CACHE = path.join(PKG, '.cache/geo');

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

/**
 * The window: everything from the Pacific coast of Mexico across to New
 * Guinea, and 45 degrees either side of the equator. The coffee belt lives
 * well inside this, and cutting the empty Pacific keeps the aspect ratio
 * usable instead of wasting a third of the width on open water.
 */
const WINDOW = (() => {
  const raw = argOf('--window', null);
  if (!raw) return {lon0: -130, lon1: 170, lat0: -45, lat1: 45};
  const [lon0, lon1, lat0, lat1] = raw.split(',').map(Number);
  return {lon0, lon1, lat0, lat1};
})();
const OUT = path.resolve(PKG, argOf('--out', 'src/coffee/geo.ts'));
const WORLD_W = Number(argOf('--width', 2000));

/**
 * Pacifying a world map cuts the planet somewhere, and for a Pacific-centred
 * window the cut lands in the mid-Atlantic at 25°W. Natural Earth stores
 * longitudes as -180..180, so every vertex west of the cut would project to a
 * negative x and the whole Americas would silently vanish off the left edge.
 *
 * With --wrap, each closed ring is first *unwrapped* (each vertex expressed as
 * the longitude nearest its predecessor, so a ring is continuous even if it
 * crosses ±180) and then translated by whole turns until it sits inside the
 * window. Off-window geometry is then clipped by the renderer.
 */
const WRAP = process.argv.includes('--wrap');

const unwrapRing = (points) => {
  if (!WRAP || points.length === 0) return points;
  const out = [points[0].slice()];
  for (let i = 1; i < points.length; i++) {
    let lon = points[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (prev - lon > 180) lon += 360;
    out.push([lon, points[i][1]]);
  }
  // translate the whole ring by whole turns until it is inside the window
  let shift = 0;
  const first = out[0][0];
  if (first < WINDOW.lon0) {
    shift = Math.ceil((WINDOW.lon0 - first) / 360) * 360;
  } else if (first >= WINDOW.lon0 + 360) {
    shift = -Math.ceil((first - (WINDOW.lon0 + 360)) / 360) * 360;
  }
  return shift === 0 ? out : out.map(([lon, lat]) => [lon + shift, lat]);
};
const WORLD_H = Math.round((WORLD_W * (WINDOW.lat1 - WINDOW.lat0)) / (WINDOW.lon1 - WINDOW.lon0));

/** Points closer together than this (in world units) are collapsed. */
const EPSILON = 0.45;
/** Rings smaller than this bounding box are dropped entirely. */
const MIN_EXTENT = 1.2;

const project = (lon, lat) => [
  ((lon - WINDOW.lon0) / (WINDOW.lon1 - WINDOW.lon0)) * WORLD_W,
  ((WINDOW.lat1 - lat) / (WINDOW.lat1 - WINDOW.lat0)) * WORLD_H,
];

const decode = (topo, objectName) => {
  const {scale, translate} = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  /**
   * Returns the ring's vertices as [lon, lat]. With --wrap each ring is first
   * made continuous across ±180 and then translated by whole turns until it sits
   * inside the window. Without that step every vertex west of WINDOW.lon0 keeps
   * its raw longitude, and for a Pacific-centred window that silently pushes the
   * entire Americas off the left edge of the world space: the map still draws,
   * QA still sees ink, and the only symptom is that the basin the film is about
   * is empty ocean.
   */
  const ringOf = (indexes) => {
    const points = [];
    for (const index of indexes) {
      const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
      for (let i = points.length === 0 ? 0 : 1; i < arc.length; i++) points.push(arc[i]);
    }
    return unwrapRing(points);
  };

  const polygonsOf = (geometry) => {
    if (geometry.type === 'Polygon') return [geometry.arcs.map(ringOf)];
    if (geometry.type === 'MultiPolygon') {
      return geometry.arcs.map((polygon) => polygon.map(ringOf));
    }
    return [];
  };

  const object = topo.objects[objectName];
  const geometries =
    object.type === 'GeometryCollection' ? object.geometries : [object];

  return geometries.map((geometry) => ({
    id: geometry.id === undefined ? null : String(geometry.id),
    name: geometry.properties?.name ?? null,
    polygons: polygonsOf(geometry),
  }));
};

const simplify = (ring) => {
  const out = [];
  for (const [lon, lat] of ring) {
    const point = project(lon, lat);
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) < EPSILON
    ) {
      continue;
    }
    out.push(point);
  }
  return out;
};

const boundsOf = (ring) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

const pathOf = (polygons) => {
  const parts = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const points = simplify(ring);
      if (points.length < 4) continue;
      const [x0, y0, x1, y1] = boundsOf(points);
      if (x1 - x0 < MIN_EXTENT && y1 - y0 < MIN_EXTENT) continue;
      let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
      for (let i = 1; i < points.length; i++) {
        d += `L${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
      }
      parts.push(`${d}Z`);
    }
  }
  return parts.join('');
};

const wrapPath = (d, indent) => {
  if (d.length <= 92) return JSON.stringify(d);
  const chunks = [];
  let index = 0;
  while (index < d.length) {
    chunks.push(d.slice(index, index + 88));
    index += 88;
  }
  return `[\n${chunks.map((c) => `${indent}  ${JSON.stringify(c)},`).join('\n')}\n${indent}].join('')`;
};

const main = () => {
  const land = decode(
    JSON.parse(fs.readFileSync(path.join(CACHE, 'land-110m.json'), 'utf8')),
    'land',
  );
  const countries = decode(
    JSON.parse(fs.readFileSync(path.join(CACHE, 'countries-110m.json'), 'utf8')),
    'countries',
  );

  const landPaths = land.map((g) => pathOf(g.polygons)).filter(Boolean);

  const entries = [];
  for (const country of countries) {
    if (!country.id) continue;
    const d = pathOf(country.polygons);
    if (!d) continue;
    const all = country.polygons.flat();
    let bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of all) {
      const b = boundsOf(simplify(ring));
      if (b[2] - b[0] < MIN_EXTENT && b[3] - b[1] < MIN_EXTENT) continue;
      bbox = [
        Math.min(bbox[0], b[0]),
        Math.min(bbox[1], b[1]),
        Math.max(bbox[2], b[2]),
        Math.max(bbox[3], b[3]),
      ];
    }
    if (!Number.isFinite(bbox[0])) continue;
    entries.push({
      id: country.id,
      name: country.name ?? country.id,
      d,
      bbox: bbox.map((v) => Number(v.toFixed(1))),
    });
  }

  entries.sort((a, b) => Number(a.id) - Number(b.id));

  const lines = [];
  lines.push('/*');
  lines.push(' * Generated by scripts/build-geo.mjs — do not edit by hand.');
  lines.push(' *');
  lines.push(' * Coastlines and borders from Natural Earth 1:110m (public domain),');
  lines.push(' * via the world-atlas TopoJSON distribution, decoded and projected to');
  lines.push(' * a plate carrée world space. The projection is deliberately');
  lines.push(' * equirectangular: on screen a horizontal line is a line of constant');
  lines.push(` * latitude, which is exactly the fact ${argOf('--about', 'the coffee belt is about')}.`);
  lines.push(' */');
  lines.push('');
  lines.push('/** The geographic window the world space covers. */');
  lines.push(
    `export const WINDOW = ${JSON.stringify(WINDOW)} as const;`,
  );
  lines.push('');
  lines.push(`export const WORLD_W = ${WORLD_W};`);
  lines.push(`export const WORLD_H = ${WORLD_H};`);
  lines.push('');
  lines.push('/** Project longitude/latitude into world space. */');
  lines.push('export const projectLonLat = (lon: number, lat: number): [number, number] => [');
  lines.push('  ((lon - WINDOW.lon0) / (WINDOW.lon1 - WINDOW.lon0)) * WORLD_W,');
  lines.push('  ((WINDOW.lat1 - lat) / (WINDOW.lat1 - WINDOW.lat0)) * WORLD_H,');
  lines.push('];');
  lines.push('');
  lines.push(`export const LAND: string[] = [`);
  for (const d of landPaths) lines.push(`  ${wrapPath(d, '  ')},`);
  lines.push('];');
  lines.push('');
  lines.push('export type CountryShape = {');
  lines.push('  name: string;');
  lines.push('  d: string;');
  lines.push('  bbox: [number, number, number, number];');
  lines.push('};');
  lines.push('');
  lines.push('export const COUNTRIES: Record<string, CountryShape> = {');
  for (const e of entries) {
    lines.push(`  '${e.id}': {`);
    lines.push(`    name: ${JSON.stringify(e.name)},`);
    lines.push(`    d: ${wrapPath(e.d, '    ')},`);
    lines.push(`    bbox: [${e.bbox.join(', ')}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  fs.mkdirSync(path.dirname(OUT), {recursive: true});
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`world space ${WORLD_W} x ${WORLD_H}`);
  console.log(`land rings ${landPaths.length}, countries ${entries.length}`);
  console.log(`wrote ${path.relative(PKG, OUT)} (${kb} KB)`);
};

main();
