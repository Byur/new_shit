import {at} from './timing';
import {theme} from './theme';
import {enter} from './components/primitives';
import type {Anomaly, Marker} from './components/WorldMap';

/**
 * What sits on the world map, per act.
 *
 * The map itself is drawn once, by EnsoVideo, and never unmounts. It is the
 * same Pacific in every chapter, so re-mounting it per act would mean two
 * copies during a scene handoff — which is exactly the kind of flash this
 * project's continuity rules exist to prevent. Acts therefore contribute
 * *decorations* only: rainfall anomalies, region highlights, and named markers,
 * all with reveal progress derived from narration lines.
 *
 * Keeping them here rather than inline in the acts also makes the film's
 * geographical claims reviewable in one place: every region the narration names
 * has a coordinate below, and nothing is pointed at that is not named.
 */

export type MapDecor = {
  anomalies: Anomaly[];
  markers: Marker[];
  highlight: Array<{iso: string; color: string; reveal: number}>;
  /** 0..1 — the "162 degrees, no land" bracket */
  span?: number;
  /** 0..1 — the equator line */
  equator?: number;
  continentLabels?: boolean;
  /** extra darkening applied under the act's own panels */
  dim?: number;
};

const EMPTY: MapDecor = {anomalies: [], markers: [], highlight: [], equator: 0};

/* ------------------------------------------------------------------ */

const teleconnect = (frame: number): MapDecor => {
  const A = (l: number) => at('teleconnect', l);
  const rows: Array<[number, number, number, number, 'wet' | 'dry', string]> = [
    [112, -2, 20, 13, 'dry', '印尼'],
    [134, -24, 20, 13, 'dry', '澳大利亚'],
    [78, 21, 16, 12, 'dry', '印度'],
    [101, 16, 12, 10, 'dry', '中南半岛'],
    [26, -22, 17, 12, 'dry', '非洲南部'],
    [-83, 9, 10, 7, 'dry', '巴拿马'],
    [200, 0, 26, 11, 'wet', '赤道中太平洋'],
    [-78, -5, 12, 10, 'wet', '秘鲁 · 厄瓜多尔'],
    [-58, -28, 16, 12, 'wet', '巴西南部'],
    [44, 6, 12, 9, 'wet', '非洲之角'],
  ];
  const inSupplyPhase = frame >= A(13);
  return {
    anomalies: inSupplyPhase
      ? []
      : rows.map(([lon, lat, rx, ry, kind], i) => ({
          lon,
          lat,
          rx,
          ry,
          kind,
          reveal: enter(frame, A(4) + i * 7, 18),
        })),
    highlight: inSupplyPhase
      ? [
          {iso: '360', color: theme.dry, reveal: enter(frame, A(14), 14)},
          {iso: '458', color: theme.dry, reveal: enter(frame, A(14), 14)},
          {iso: '036', color: theme.dry, reveal: enter(frame, A(16), 14)},
          {iso: '384', color: theme.dry, reveal: enter(frame, A(17), 14)},
          {iso: '288', color: theme.dry, reveal: enter(frame, A(17), 14)},
          {iso: '076', color: theme.wet, reveal: enter(frame, A(18), 14)},
          {iso: '356', color: theme.price, reveal: enter(frame, A(19), 14)},
        ]
      : [],
    markers: [],
    span: 0,
    equator: enter(frame, A(2), 18),
    continentLabels: false,
  };
};

const grain = (frame: number): MapDecor => {
  const A = (l: number) => at('grain', l);
  const rows: Array<[number, number, number, number, 'wet' | 'dry']> = [
    [55, 48, 22, 10, 'dry'],
    [15, 14, 20, 10, 'dry'],
    [78, 21, 15, 11, 'dry'],
    [134, -25, 18, 12, 'dry'],
    [-78, -6, 11, 9, 'wet'],
  ];
  return {
    anomalies: rows.map(([lon, lat, rx, ry, kind], i) => ({
      lon,
      lat,
      rx,
      ry,
      kind,
      reveal: enter(frame, A(1) + i * 6, 18),
    })),
    markers: [
      {lon: -78, lat: -8, label: '秘鲁外海', sub: '鳀鱼渔场', color: theme.wet, reveal: enter(frame, A(4), 14)},
      {lon: 55, lat: 50, label: '苏联小麦带', color: theme.dry, reveal: enter(frame, A(2), 14)},
      {lon: 15, lat: 16, label: '萨赫勒', color: theme.dry, reveal: enter(frame, A(2) + 6, 14)},
      {lon: -100, lat: 40, label: '美国 · 小麦出口国', color: theme.price, reveal: enter(frame, A(12), 14)},
    ],
    highlight: [],
    equator: 1,
    continentLabels: false,
    dim: 0.5,
  };
};

const palm = (frame: number): MapDecor => {
  const A = (l: number) => at('palm', l);
  return {
    anomalies: [
      {lon: 112, lat: -2, rx: 22, ry: 13, kind: 'dry', reveal: enter(frame, A(2), 18)},
      {lon: 101, lat: 16, rx: 12, ry: 10, kind: 'dry', reveal: enter(frame, A(2) + 6, 18) * 0.8},
      {lon: 114, lat: -1, rx: 9, ry: 7, kind: 'dry', reveal: enter(frame, A(3), 16) * 1.25},
    ],
    highlight: [
      {iso: '360', color: theme.dry, reveal: enter(frame, A(2), 16)},
      {iso: '458', color: theme.dry, reveal: enter(frame, A(2) + 5, 16)},
    ],
    markers: [
      {
        lon: 112,
        lat: -3,
        label: '加里曼丹 · 苏门答腊',
        sub: '1997–98 过火 400–1200 万公顷',
        color: theme.dry,
        reveal: enter(frame, A(3), 14),
      },
      {lon: 102, lat: 14, label: '中南半岛', sub: '雨季推迟', color: theme.dry, reveal: enter(frame, A(2), 14)},
    ],
    equator: 1,
    continentLabels: false,
    dim: 0.5,
  };
};

const coal = (frame: number): MapDecor => {
  const A = (l: number) => at('coal', l);
  return {
    anomalies: [{lon: 147, lat: -24, rx: 15, ry: 11, kind: 'wet', reveal: enter(frame, A(1), 18) * 1.2}],
    highlight: [{iso: '036', color: theme.wet, reveal: enter(frame, A(1), 16)}],
    markers: [
      {lon: 149, lat: -23, label: '博文盆地', sub: '澳大利亚海运焦煤的核心', color: theme.wet, reveal: enter(frame, A(2), 14)},
      {lon: 153, lat: -28, label: '布里斯班', color: theme.wet, reveal: enter(frame, A(1) + 8, 14)},
      {lon: 112, lat: -4, label: '印尼 · 煤与棕榈油', color: theme.textDim, reveal: enter(frame, A(9), 14)},
    ],
    equator: 1,
    continentLabels: false,
    dim: 0.52,
  };
};

const split = (frame: number): MapDecor => {
  const A = (l: number) => at('split', l);
  return {
    anomalies: [
      {lon: 78, lat: 21, rx: 16, ry: 12, kind: 'dry', reveal: enter(frame, A(4), 18)},
      {lon: 112, lat: -2, rx: 18, ry: 12, kind: 'dry', reveal: enter(frame, A(15), 18) * 0.75},
      {lon: -50, lat: -18, rx: 15, ry: 11, kind: 'wet', reveal: enter(frame, A(13), 18)},
      {lon: 100, lat: 14, rx: 12, ry: 10, kind: 'dry', reveal: enter(frame, A(4), 18) * 0.7},
      {lon: 30, lat: -24, rx: 14, ry: 11, kind: 'dry', reveal: enter(frame, A(4) + 6, 18) * 0.6},
    ],
    markers: [
      {lon: 78, lat: 20, label: '印度', sub: '季风 −15%', color: theme.dry, reveal: enter(frame, A(11), 14)},
      {lon: -48, lat: -14, label: '巴西', sub: '咖啡 6760 万袋 · 历史最高', color: theme.wet, labelSide: 'left' as const, reveal: enter(frame, A(13), 14)},
      {
        lon: 112,
        lat: -2,
        label: '印尼 · 马来西亚',
        sub: '库存 351 万吨 · 历史最高',
        color: theme.price,
        reveal: enter(frame, A(15), 14),
      },
    ],
    highlight: [
      {iso: '360', color: theme.dry, reveal: enter(frame, A(12), 14)},
      {iso: '356', color: theme.dry, reveal: enter(frame, A(11), 14)},
      {iso: '076', color: theme.wet, reveal: enter(frame, A(13), 14)},
      {iso: '458', color: theme.price, reveal: enter(frame, A(16), 14)},
    ],
    equator: 1,
    continentLabels: false,
    dim: 0.56,
  };
};

const live = (frame: number): MapDecor => {
  const A = (l: number) => at('live', l);
  return {
    anomalies: [{lon: 210, lat: 0, rx: 30, ry: 13, kind: 'wet', reveal: enter(frame, A(0), 20) * 1.1}],
    markers: [],
    highlight: [],
    equator: 1,
    continentLabels: false,
    dim: 0.6,
  };
};

const coda = (frame: number): MapDecor => {
  const A = (l: number) => at('coda', l);
  return {
    anomalies: [],
    highlight: [],
    markers: [],
    equator: 0,
    continentLabels: false,
    dim: enter(frame, A(0), 20) * 0.8,
  };
};

export const decorAt = (chapterId: string, frame: number): MapDecor => {
  switch (chapterId) {
    case 'teleconnect':
      return teleconnect(frame);
    case 'grain':
      return grain(frame);
    case 'palm':
      return palm(frame);
    case 'coal':
      return coal(frame);
    case 'split':
      return split(frame);
    case 'live':
      return live(frame);
    case 'coda':
      return coda(frame);
    default:
      return EMPTY;
  }
};
