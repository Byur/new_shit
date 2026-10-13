/**
 * Deterministic simulated market data for the explainer.
 *
 * This is NOT real market data. It is a fixed, hand-shaped price path used so
 * that every teaching beat can point at an actual event on screen: a dense
 * trading band at 10, a run to 12.36, a decline to 8.16, a rebound that stalls
 * exactly at the old cost band, and a later slide to 6.88.
 *
 * `TODAY` splits the series: days after it are the future, drawn only when the
 * narration stops talking about now and starts talking about hindsight.
 */

export const DAYS = 200;
export const TODAY = 136;
export const PRICE_MIN = 6.2;
export const PRICE_MAX = 13.2;

export type Candle = {
  day: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Hand-placed turning points of the simulated path. */
const ANCHORS: Array<[number, number]> = [
  [0, 10.06],
  [10, 9.86],
  [20, 10.14],
  [30, 9.9],
  [36, 10.08],
  [48, 10.86],
  [60, 11.74],
  [72, 12.36],
  [80, 11.42],
  [90, 9.66],
  [100, 8.16],
  [106, 8.62],
  [112, 9.18],
  [122, 9.74],
  [128, 10.02],
  [134, 9.62],
  [142, 8.64],
  [150, 7.62],
  [158, 6.88],
  [163, 7.04],
  [170, 6.72],
  [180, 6.9],
  [190, 6.6],
  [199, 6.78],
];

const anchorAt = (day: number): number => {
  const d = Math.max(0, Math.min(DAYS - 1, day));
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [d0, p0] = ANCHORS[i];
    const [d1, p1] = ANCHORS[i + 1];
    if (d >= d0 && d <= d1) {
      const t = d1 === d0 ? 0 : (d - d0) / (d1 - d0);
      const eased = t * t * (3 - 2 * t);
      return p0 + (p1 - p0) * eased;
    }
  }
  return ANCHORS[ANCHORS.length - 1][1];
};

const rnd = (i: number, seed: number): number => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const buildCandles = (): Candle[] => {
  const out: Candle[] = [];
  for (let d = 0; d < DAYS; d++) {
    const base = anchorAt(d);
    const slope = anchorAt(d + 1) - anchorAt(d - 1);
    const amp = 0.042 + Math.min(0.085, Math.abs(slope) * 0.85);
    const close = base + (rnd(d, 1) - 0.5) * amp * 1.7;
    const prev = d === 0 ? base : out[d - 1].close;
    const open = prev + (rnd(d, 2) - 0.5) * amp * 0.85;
    const wick = amp * (0.45 + rnd(d, 3) * 0.9);
    const high = Math.max(open, close) + wick * 0.72;
    const low = Math.min(open, close) - wick * 0.72;

    let volume = 0.55 + rnd(d, 4) * 0.5;
    if (d <= 36) {
      volume *= 2.35; // the dense trading band around 10
    } else if (d >= 72 && d <= 100) {
      volume *= 1.8; // the heavy decline
    } else if (d >= 120 && d <= 130) {
      volume *= 1.35; // the rebound into the old cost band
    } else if (d > TODAY) {
      volume *= 0.85;
    }

    out.push({day: d, open, high, low, close, volume});
  }
  return out;
};

export const candles: Candle[] = buildCandles();

export const closePath: number[] = candles.map((c) => c.close);

/** Keys where the narration makes a claim about the chart. */
export const EVENTS = {
  bandStart: 8,
  bandEnd: 36,
  costBand: 10,
  peakDay: 72,
  peakPrice: 12.36,
  lowDay: 100,
  lowPrice: 8.16,
  reboundLow: 100,
  reboundHigh: 128,
  stallPrice: 10,
  breakDay: 134,
  slideDay: 158,
  slidePrice: 6.88,
  crossDay: 88, // where the 10 band is decisively lost on the way down
} as const;

/* ------------------------------------------------------------------ */
/* 筹码分布 — chip distribution                                        */
/* ------------------------------------------------------------------ */

export const CHIP_BUCKETS = 70;
export const CHIP_SIZE = (PRICE_MAX - PRICE_MIN) / CHIP_BUCKETS;

export const priceToBucket = (price: number): number =>
  Math.max(0, Math.min(CHIP_BUCKETS - 1, Math.floor((price - PRICE_MIN) / CHIP_SIZE)));

export const bucketPrice = (bucket: number): number => PRICE_MIN + (bucket + 0.5) * CHIP_SIZE;

/**
 * Chips still held, by price, as of a given day. Older volume decays, so the
 * peak drifts toward whatever price has recently traded — except that a long
 * dense band leaves a stubborn, slowly fading hill exactly at its own price.
 */
export const chipDistribution = (asOfDay: number, decay = 0.9885): number[] => {
  const out: number[] = new Array(CHIP_BUCKETS).fill(0);
  const last = Math.max(0, Math.min(DAYS - 1, Math.floor(asOfDay)));
  for (let d = 0; d <= last; d++) {
    const c = candles[d];
    const w = c.volume * Math.pow(decay, last - d);
    const lo = priceToBucket(c.low);
    const hi = priceToBucket(c.high);
    const mid = (lo + hi) / 2;
    const span = Math.max(1, hi - lo);
    for (let b = lo; b <= hi; b++) {
      const t = 1 - Math.abs(b - mid) / (span + 0.35);
      out[b] += w * Math.max(0.22, t);
    }
  }
  return out;
};

export const chipPeakBucket = (dist: number[]): number => {
  let best = 0;
  for (let i = 1; i < dist.length; i++) {
    if (dist[i] > dist[best]) best = i;
  }
  return best;
};

export const chipMax = (dist: number[]): number => Math.max(0.0001, ...dist);

/** Share of the chip mass sitting above a price — the "trapped" pile. */
export const chipMassAbove = (dist: number[], price: number): number => {
  const from = priceToBucket(price);
  let total = 0;
  let above = 0;
  for (let i = 0; i < dist.length; i++) {
    total += dist[i];
    if (i >= from) above += dist[i];
  }
  if (total <= 0) return 0;
  return above / total;
};
