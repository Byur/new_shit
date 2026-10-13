import {FULL_VIEW, Highlight, MapMarker, MapView} from './components/MapCanvas';
import {ORIGINS, markerRadius} from './data';
import {theme} from './theme';
import {L, sceneEnd, sceneStart} from './timing';

/**
 * One camera for the whole film. Keyframes are anchored to narration lines, so
 * a rewritten line re-times the move automatically. Longitude and latitude
 * interpolate linearly; the zoom interpolates geometrically, which is what
 * makes a 6x push feel like a constant-rate move rather than a lurch.
 */
type Key = {frame: number; view: MapView};

const K: Key[] = [
  {frame: 0, view: FULL_VIEW},
  {frame: L('hook', 3) - 26, view: {...FULL_VIEW, span: 240}},
  {frame: L('hook', 5), view: FULL_VIEW},

  /* species and variety are argued on their own diagrams; the map stays put */
  {frame: sceneStart('variety') + 40, view: FULL_VIEW},
  {frame: sceneEnd('variety') - 30, view: FULL_VIEW},

  /* the belt, then the three altitudes that are the whole point */
  {frame: L('geography', 1) - 30, view: {...FULL_VIEW, span: 300}},
  {frame: L('geography', 1), view: {lon: 20, lat: 0, span: 300}},
  {frame: L('geography', 7), view: {lon: 20, lat: 0, span: 300}},
  {frame: L('geography', 8), view: {lon: 39, lat: 7, span: 52}},
  {frame: L('geography', 9), view: {lon: -45, lat: -19, span: 52}},
  {frame: L('geography', 10), view: {lon: 107, lat: 12, span: 52}},
  {frame: L('geography', 11), view: {lon: 32, lat: -3, span: 200}},
  {frame: L('geography', 12) - 20, view: {lon: 32, lat: -3, span: 200}},
  {frame: L('geography', 13), view: {lon: -47, lat: -21, span: 54}},
  {frame: sceneEnd('geography') + 6, view: {lon: 20, lat: 0, span: 240}},

  /* wet hulling happens in one place, so the camera goes there once */
  {frame: L('process', 9), view: {lon: 98, lat: 4, span: 44}},
  {frame: L('process', 11) + 30, view: {lon: 98, lat: 4, span: 44}},
  {frame: L('process', 12), view: FULL_VIEW},

  /* the payoff: three camps, one at a time, then all of them together */
  {frame: L('regions', 2) - 24, view: {lon: 34, lat: 4, span: 96}},
  {frame: L('regions', 3), view: {lon: 39, lat: 7, span: 50}},
  {frame: L('regions', 5), view: {lon: 37, lat: 0, span: 46}},
  {frame: L('regions', 7), view: {lon: -70, lat: 6, span: 120}},
  {frame: L('regions', 8), view: {lon: -46, lat: -19, span: 50}},
  {frame: L('regions', 10), view: {lon: -75, lat: 3, span: 50}},
  {frame: L('regions', 12), view: {lon: -87, lat: 12, span: 58}},
  {frame: L('regions', 13), view: {lon: 112, lat: 10, span: 116}},
  {frame: L('regions', 14), view: {lon: 108, lat: 12, span: 50}},
  {frame: L('regions', 16), view: {lon: 104, lat: 12, span: 78}},
  {frame: L('regions', 17), view: FULL_VIEW},
  {frame: 999999, view: FULL_VIEW},
];

const smooth = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

export const viewAt = (frame: number): MapView => {
  if (frame <= K[0].frame) return K[0].view;
  for (let i = 1; i < K.length; i++) {
    const b = K[i];
    const a = K[i - 1];
    if (frame <= b.frame) {
      const span = b.frame - a.frame;
      if (span <= 0) return b.view;
      const t = smooth((frame - a.frame) / span);
      return {
        lon: a.view.lon + (b.view.lon - a.view.lon) * t,
        lat: a.view.lat + (b.view.lat - a.view.lat) * t,
        span: Math.exp(Math.log(a.view.span) + (Math.log(b.view.span) - Math.log(a.view.span)) * t),
      };
    }
  }
  return K[K.length - 1].view;
};

/** How much of the map is showing, as opposed to serving as a dim backdrop. */
const OPACITY: Array<[number, number]> = [
  [0, 0],
  [L('hook', 3), 0],
  [L('hook', 4) + 12, 1],
  [L('hook', 5) + 20, 0.3],
  [sceneStart('species'), 0.26],
  [sceneStart('variety'), 0.24],
  [L('geography', 0), 0.24],
  [L('geography', 1) - 18, 1],
  [L('process', 0) + 20, 0.3],
  [L('process', 8) + 20, 0.3],
  [L('process', 9), 1],
  [L('process', 12) + 24, 0.3],
  [L('regions', 0), 1],
  [L('regions', 17) + 40, 0.62],
  [999999, 0.62],
];

export const mapOpacityAt = (frame: number): number => {
  if (frame <= OPACITY[0][0]) return OPACITY[0][1];
  for (let i = 1; i < OPACITY.length; i++) {
    const [f1, v1] = OPACITY[i];
    const [f0, v0] = OPACITY[i - 1];
    if (frame <= f1) {
      if (f1 === f0) return v1;
      return v0 + (v1 - v0) * smooth((frame - f0) / (f1 - f0));
    }
  }
  return OPACITY[OPACITY.length - 1][1];
};

/**
 * Country highlights are additive rather than exclusive: two origins can be lit
 * at once while the camera sits between them, and each fades on its own ramp.
 */
type Cue = {iso: string; color: string; from: number; to: number};

const hue = (iso: string, color: string, from: number, to: number): Cue => ({iso, color, from, to});

const CUES: Cue[] = [
  hue('231', '#E3A34A', L('geography', 8), L('geography', 8) + 60),
  hue('76', '#E3A34A', L('geography', 9), L('geography', 9) + 60),
  hue('704', '#E3A34A', L('geography', 10), L('geography', 10) + 60),
  hue('360', '#9C7B5E', L('process', 9), L('process', 11) + 40),
  hue('231', '#A8C46B', L('regions', 3), L('regions', 6) + 20),
  hue('404', '#A8C46B', L('regions', 5), L('regions', 6) + 20),
  hue('76', '#E3A34A', L('regions', 8), L('regions', 9) + 30),
  hue('170', '#E3A34A', L('regions', 10), L('regions', 11) + 30),
  hue('320', '#E3A34A', L('regions', 12), L('regions', 12) + 120),
  hue('188', '#E3A34A', L('regions', 12), L('regions', 12) + 120),
  hue('591', '#E3A34A', L('regions', 12), L('regions', 12) + 120),
  hue('704', '#C25B3E', L('regions', 14), L('regions', 15) + 30),
  hue('360', '#9C7B5E', L('regions', 16), L('regions', 17)),
  hue('156', '#A8C46B', L('regions', 16), L('regions', 17)),
];

const RAMP = 22;

export type {Highlight};

export const highlightsAt = (frame: number): Highlight[] => {
  const out: Highlight[] = [];
  for (const cue of CUES) {
    if (frame < cue.from - 1 || frame > cue.to + RAMP + 1) continue;
    const inT = smooth((frame - cue.from) / RAMP);
    const outT = smooth((cue.to + RAMP - frame) / RAMP);
    const opacity = Math.min(inT, outT) * 0.5;
    if (opacity > 0.004) out.push({iso: cue.iso, color: cue.color, opacity});
  }
  return out;
};

/**
 * Origin markers. Every dot is a producing country; the ones the narration is
 * currently naming get a ring and a size bump so the map is never a uniform
 * scatter of identical labels.
 */
type Focus = {key: string; from: number; to: number};

const FOCUS: Focus[] = [
  {key: 'ethiopia', from: L('geography', 8), to: L('geography', 9) - 4},
  {key: 'brazil', from: L('geography', 9), to: L('geography', 10) - 4},
  {key: 'vietnam', from: L('geography', 10), to: L('geography', 11) - 6},
  {key: 'indonesia', from: L('process', 9), to: L('process', 12) - 4},
  {key: 'ethiopia', from: L('regions', 3), to: L('regions', 5) - 6},
  {key: 'kenya', from: L('regions', 5), to: L('regions', 7) - 4},
  {key: 'brazil', from: L('regions', 8), to: L('regions', 10) - 6},
  {key: 'colombia', from: L('regions', 10), to: L('regions', 12) - 6},
  {key: 'guatemala', from: L('regions', 12), to: L('regions', 13) - 4},
  {key: 'panama', from: L('regions', 12), to: L('regions', 13) - 4},
  {key: 'vietnam', from: L('regions', 14), to: L('regions', 16) - 6},
  {key: 'indonesia', from: L('regions', 16), to: L('regions', 17) - 4},
  {key: 'china', from: L('regions', 16), to: L('regions', 17) - 4},
];

const RING_RAMP = 24;

export const markersAt = (frame: number): MapMarker[] => {
  /* before the map means anything the dots are just texture */
  const base =
    frame < L('hook', 5)
      ? 0
      : frame < sceneStart('geography')
        ? 0.34
        : frame < sceneStart('regions')
          ? 0.55
          : 0.86;

  return ORIGINS.map((o) => {
    let ring = 0;
    for (const f of FOCUS) {
      if (f.key !== o.key) continue;
      const inT = Math.min(1, Math.max(0, (frame - f.from) / RING_RAMP));
      const outT = Math.min(1, Math.max(0, (f.to - frame) / RING_RAMP));
      ring = Math.max(ring, inT * outT);
    }
    return {
      id: o.key,
      lon: o.lon,
      lat: o.lat,
      radius: markerRadius(o.bags) * (1 + ring * 0.34),
      color: o.arabica >= 0.9 ? theme.arabica : o.arabica <= 0.15 ? theme.robusta : theme.textDim,
      opacity: base * (0.5 + ring * 0.5),
      ring: ring > 0.05,
    };
  });
};
