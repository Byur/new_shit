import {at, line, sceneStart} from './timing';

/**
 * A viewport is a window onto the simulated series. Every act shares the same
 * world; the camera only ever pans and zooms it. That is what keeps the piece
 * continuous — there is one chart for the whole video, not one per scene.
 */
export type View = {d0: number; d1: number; p0: number; p1: number};

export type CamKey = {
  /** Frame at which the camera has ARRIVED at this framing. */
  at: number;
  view: View;
  /** Opacity of the chip-distribution panel, 0..1 */
  chips: number;
  /** How far the chart recedes behind an overlay, 0..1 */
  dim: number;
};

const V = (d0: number, d1: number, p0: number, p1: number): View => ({d0, d1, p0, p1});

export const VIEW = {
  /** the whole "present" — series stops at today */
  full: V(-6, 138, 6.35, 13.15),
  /** the long dense trading band around 10 */
  band: V(2, 46, 8.45, 11.95),
  /** the run up to the peak */
  peak: V(46, 90, 10.15, 13.15),
  /** the whole arc: buy at 10, run to 12.36, fall to 8.16 */
  arc: V(12, 110, 7.55, 13.2),
  /** the 12.36 -> 8.16 decline */
  leg: V(60, 108, 7.25, 13.15),
  /** the later slide, where the 6.8 scenario lives */
  slide: V(90, 152, 6.25, 10.9),
  /** the rebound back into the old cost band */
  rebound: V(84, 140, 6.9, 11.35),
  /** present + three months of hindsight */
  future: V(92, 214, 6.15, 11.9),
  /** wide enough to tile the cycle beside itself */
  wide: V(-4, 214, 6.0, 13.5),
} as const;

const MOVE = 24; // frames a camera move takes

export const CAMERA: CamKey[] = [
  {at: 0, view: VIEW.full, chips: 0, dim: 0},

  /* ---- hook: one static frame, the quote does the work ------------- */
  {at: sceneStart('hook'), view: VIEW.full, chips: 0, dim: 0},

  /* ---- trade: follow one holder through the whole story ------------ */
  {at: sceneStart('trade'), view: VIEW.full, chips: 0, dim: 0},
  {at: at('trade', 3), view: VIEW.band, chips: 0, dim: 0},
  {at: at('trade', 4), view: VIEW.band, chips: 0, dim: 0},
  {at: at('trade', 5), view: VIEW.peak, chips: 0, dim: 0},
  {
    at: at('trade', 5) + Math.round(line('trade', 5).frames * 0.5),
    view: VIEW.arc,
    chips: 0,
    dim: 0,
  },
  {at: at('trade', 6), view: VIEW.leg, chips: 0, dim: 0},
  {at: at('trade', 12), view: VIEW.leg, chips: 0, dim: 0},
  {at: at('trade', 17), view: VIEW.slide, chips: 0, dim: 0},
  {at: at('trade', 20), view: VIEW.full, chips: 0, dim: 0},

  /* ---- pressure: bring in the chip distribution -------------------- */
  {at: sceneStart('pressure'), view: VIEW.full, chips: 0, dim: 0},
  {at: at('pressure', 1), view: VIEW.band, chips: 1, dim: 0},
  {at: at('pressure', 4), view: VIEW.leg, chips: 1, dim: 0},
  {at: at('pressure', 5), view: VIEW.rebound, chips: 1, dim: 0},
  {at: at('pressure', 10), view: VIEW.rebound, chips: 1, dim: 0},
  {at: at('pressure', 13), view: VIEW.rebound, chips: 1, dim: 0},

  /* ---- duallabel: the same leg again, then three months later ------- */
  {at: sceneStart('duallabel'), view: VIEW.full, chips: 0, dim: 0},
  {at: at('duallabel', 2), view: VIEW.leg, chips: 0, dim: 0},
  {at: at('duallabel', 14), view: VIEW.future, chips: 0, dim: 0},
  {at: at('duallabel', 17), view: VIEW.future, chips: 0, dim: 0},

  /* ---- pairs: the chart steps back, the montage takes over ---------- */
  {at: sceneStart('pairs'), view: VIEW.full, chips: 0, dim: 1},
  {at: at('pairs', 8), view: VIEW.full, chips: 0, dim: 1},

  /* ---- leek: wide, so the cycle can be tiled beside itself ---------- */
  {at: sceneStart('leek'), view: VIEW.future, chips: 0, dim: 0},
  {at: at('leek', 4), view: VIEW.wide, chips: 0, dim: 0},
  {at: at('leek', 16), view: VIEW.full, chips: 0, dim: 0},

  /* ---- coda: everything back in frame ------------------------------- */
  {at: sceneStart('coda'), view: VIEW.full, chips: 0, dim: 0},
  {at: at('coda', 12), view: VIEW.full, chips: 0, dim: 0},
];

export type Camera = {view: View; chips: number; dim: number};

const smooth = (t: number): number => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpView = (a: View, b: View, t: number): View => ({
  d0: lerp(a.d0, b.d0, t),
  d1: lerp(a.d1, b.d1, t),
  p0: lerp(a.p0, b.p0, t),
  p1: lerp(a.p1, b.p1, t),
});

export const cameraAt = (frame: number): Camera => {
  let i = 0;
  while (i + 1 < CAMERA.length && CAMERA[i + 1].at <= frame) i++;
  const key = CAMERA[i];
  const prev = i === 0 ? key : CAMERA[i - 1];
  const raw = i === 0 ? 1 : (frame - (key.at - MOVE)) / MOVE;
  const t = smooth(Math.max(0, Math.min(1, raw)));
  return {
    view: lerpView(prev.view, key.view, t),
    chips: lerp(prev.chips, key.chips, t),
    dim: lerp(prev.dim, key.dim, t),
  };
};

/**
 * How far the series has been "confirmed" by hindsight. Before the three-month
 * reveal the days after today are drawn as hollow, unresolved bars.
 */
export const futureRevealAt = (frame: number): number => {
  const start = at('duallabel', 14);
  return smooth(Math.max(0, Math.min(1, (frame - start) / 34)));
};
