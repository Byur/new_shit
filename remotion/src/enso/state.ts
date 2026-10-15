import {atYearMonth, ONI, ONI_MONTHS} from './oni';
import {at, sceneStart} from './timing';
import {track, trackLinear} from './components/primitives';

/** Interpolated ONI at a (possibly fractional) month index. */
export const oniAt = (month: number): number => {
  const m = Math.max(0, Math.min(ONI_MONTHS - 1, month));
  const i = Math.floor(m);
  const j = Math.min(ONI_MONTHS - 1, i + 1);
  return ONI[i] + (ONI[j] - ONI[i]) * (m - i);
};

/**
 * The whole film's state, in one function.
 *
 * Every channel is a keyframe track anchored to a narration line, so a change
 * of wording re-times the entire instrument on the next narration build. The
 * important property is that `month` is not an animation curve — it is the
 * position of the cursor in the real 1950-2026 ONI record, and `oni` is read
 * out of that record. The cross-section, the map's rainfall anomalies and the
 * strip's readout all consume the same value, so they cannot disagree with each
 * other or with the data.
 *
 * Where an act needs a beat that only it uses, the act derives it locally from
 * `at()`; this file owns only the shared instrument.
 */

export type EnsoState = {
  /** fractional month index into the ONI record: the film's cursor */
  month: number;
  /** the real ONI value at the cursor, °C */
  oni: number;
  /** 0..1 — the cursor's presence on the strip */
  cursor: number;
  /** 0..1 — how much of the 1950-2026 record has been drawn in */
  drawn: number;
  /** 0..1 — the equatorial cross-section */
  section: number;
  /** 0..1 — the Pacific-centred world map */
  map: number;
  wind: number;
  thermo: number;
  upwell: number;
  rain: number;
  walker: number;
  ticks: number;
  fetch: number;
  /** the "162 degrees, no land" bracket on the map */
  span: number;
  /** 0..1 — the map's rainfall-anomaly layer */
  anomalies: number;
  /** 0..1 — the map's supply-concentration layer */
  supply: number;
  /** 0..1 — extra darkening so overlays stay readable */
  dim: number;
};

const H = (line: number) => at('hook', line);
const M = (line: number) => at('machine', line);
const T = (line: number) => at('teleconnect', line);

/** A real neutral stretch used for the "normal year" opening of the machine act. */
const NEUTRAL_MONTH = atYearMonth(1996, 4);

const MONTH_KEYS: Array<[number, number]> = [
  [0, 0],
  [H(6), ONI_MONTHS - 1],
  [M(0), NEUTRAL_MONTH],
  /* the 1997-98 El Nino, run forward on the real record */
  [M(15), atYearMonth(1996, 10)],
  [M(16), atYearMonth(1997, 3)],
  [M(17), atYearMonth(1997, 6)],
  [M(18), atYearMonth(1997, 9)],
  [M(19), atYearMonth(1997, 11)],
  [M(20), atYearMonth(1997, 12)],
  [M(21), atYearMonth(1998, 2)],
  [M(22), atYearMonth(1998, 4)],
  /* the mirror: the 2010-11 La Nina */
  [M(23), atYearMonth(2010, 6)],
  [M(24), atYearMonth(2010, 10)],
  [M(25), atYearMonth(2011, 1)],
  [M(26), atYearMonth(2011, 2)],
  /*
   * The oscillator, shown on the most extreme swing in the record: the 1972-73
   * El Nino (+1.84) flipping to the strongest La Nina since 1950 (-2.04) within
   * twelve months. Nothing needs to be invented to make the point.
   */
  [M(27), atYearMonth(1972, 6)],
  [M(33), atYearMonth(1974, 2)],
  [M(41), atYearMonth(2015, 12)],
  [T(0), atYearMonth(1997, 11)],
  [T(20), atYearMonth(1997, 11)],
  [at('grain', 0), atYearMonth(1972, 3)],
  [at('grain', 9), atYearMonth(1972, 12)],
  [at('grain', 15), atYearMonth(1973, 6)],
  [at('grain', 22), atYearMonth(1974, 2)],
  [at('palm', 0), atYearMonth(1997, 4)],
  [at('palm', 2), atYearMonth(1997, 9)],
  [at('palm', 8), atYearMonth(1998, 2)],
  [at('palm', 18), atYearMonth(1998, 8)],
  [at('coal', 0), atYearMonth(2010, 6)],
  [at('coal', 1), atYearMonth(2010, 12)],
  [at('coal', 5), atYearMonth(2011, 4)],
  [at('coal', 20), atYearMonth(2011, 9)],
  [at('split', 0), atYearMonth(2026, 2)],
  [at('split', 2), atYearMonth(2026, 8)],
  [at('split', 23), atYearMonth(2026, 8)],
  [at('live', 0), atYearMonth(2026, 8)],
  [at('live', 22), atYearMonth(2026, 8)],
  [at('coda', 0), atYearMonth(2026, 8)],
];

export const stateAt = (frame: number): EnsoState => {
  const month = trackLinear(frame, MONTH_KEYS);

  return {
    month,
    oni: oniAt(month),

    cursor: track(frame, [
      [0, 0],
      [H(7), 0],
      [H(9), 1],
    ]),

    drawn: trackLinear(frame, [
      [0, 0],
      [H(1), 0.34],
      [H(3), 0.7],
      [H(6), 1],
    ]),

    /*
     * Which of the two views owns the frame. The handoff from section to map is
     * a crossfade, never a cut, because both describe the same object.
     */
    section: track(frame, [
      [0, 0],
      [H(10), 0],
      [H(12) + 40, 0.5],
      [M(0), 0.96],
      [T(0), 0.96],
      [T(2), 0.1],
      [at('grain', 0), 0],
    ]),

    map: track(frame, [
      [0, 0],
      [T(0), 0],
      [T(3), 1],
      [at('live', 22), 1],
      [at('coda', 0), 0.34],
    ]),

    /* the section's parts, introduced in the order the argument needs them */
    ticks: track(frame, [
      [0, 0],
      [H(11), 0],
      [M(2), 1],
    ]),
    fetch: track(frame, [
      [0, 0],
      [M(1), 0],
      [M(3), 1],
      [M(4), 1],
      [M(6), 0.4],
    ]),
    wind: track(frame, [
      [0, 0],
      [M(4), 0],
      [M(6), 1],
    ]),
    thermo: track(frame, [
      [0, 0],
      [M(5), 0],
      [M(8), 1],
    ]),
    upwell: track(frame, [
      [0, 0],
      [M(7), 0],
      [M(10), 1],
    ]),
    rain: track(frame, [
      [0, 0],
      [M(10), 0],
      [M(14), 1],
    ]),
    walker: track(frame, [
      [0, 0],
      [M(13), 0],
      [M(15), 1],
      [M(26), 1],
      [M(28), 0.35],
    ]),

    span: track(frame, [
      [0, 0],
      [T(0), 0],
      [T(2), 1],
      [T(4), 0],
    ]),

    anomalies: track(frame, [
      [0, 0],
      [T(4), 0],
      [T(9), 1],
      [at('grain', 0), 0],
      [at('grain', 1), 0],
      [at('grain', 3), 1],
      [at('palm', 0), 0],
      [at('palm', 2), 1],
      [at('coal', 0), 0],
      [at('coal', 1), 1],
      [at('split', 0), 0],
      [at('split', 4), 1],
      [at('live', 0), 1],
    ]),

    supply: track(frame, [
      [0, 0],
      [T(13), 0],
      [T(18), 1],
      [at('grain', 0), 0.35],
    ]),

    dim: track(frame, [
      [0, 0],
      [M(34), 0],
      [M(36), 0.55],
      [T(0), 0.1],
      [at('grain', 0), 0.42],
    ]),
  };
};

/* ------------------------------------------------------------------ */
/* Strip decorations                                                   */
/* ------------------------------------------------------------------ */

/**
 * The episode the current act is inside, drawn as a window on the record. Each
 * entry is anchored to its act's first line; the reveal ramps so the window
 * never appears in a single frame.
 */
export type StripWindow = {from: number; to: number; color: string; reveal: number};

const WINDOWS: Array<{from: number; to: number; color: string; start: number; full: number}> = [
  {from: 1996.9, to: 1998.6, color: '#FF6A3D', start: M(15), full: M(17)},
  {from: 2010.4, to: 2011.5, color: '#2FB6E8', start: M(23), full: M(24)},
  {from: 1972.2, to: 1974.4, color: '#FF6A3D', start: M(27), full: M(30)},
  {from: 1997.2, to: 1998.6, color: '#FF6A3D', start: T(4), full: T(6)},
  {from: 1972.2, to: 1974.4, color: '#FF6A3D', start: at('grain', 0), full: at('grain', 2)},
  {from: 1997.2, to: 1998.8, color: '#FF6A3D', start: at('palm', 0), full: at('palm', 2)},
  {from: 2010.4, to: 2011.6, color: '#2FB6E8', start: at('coal', 0), full: at('coal', 2)},
  /*
    A 2020.7-2022.4 La Nina entry used to sit here. It shared `start` with the
    2023-24 entry below, and `stripWindowAt` keeps the last entry at or before
    the frame, so it could never be selected - and the narration never mentions
    2020-2022 anyway. Removed. Keep `start` values distinct: a later entry that
    shares one silently wins and the earlier window becomes unreachable.
  */
  {from: 2023.3, to: 2024.5, color: '#FF6A3D', start: at('split', 0), full: at('split', 1)},
  {from: 2026.2, to: 2026.8, color: '#FF6A3D', start: at('live', 0), full: at('live', 2)},
];

export const stripWindowAt = (frame: number): StripWindow | null => {
  let best: StripWindow | null = null;
  for (const w of WINDOWS) {
    if (frame < w.start) continue;
    const reveal = track(frame, [
      [w.start, 0],
      [w.full, 1],
    ]);
    /* a later window supersedes an earlier one once it has started */
    if (!best || w.start >= (best as StripWindow & {start?: number}).start!) {
      best = {...w, reveal};
    }
  }
  return best;
};

/** The dashed target zone drawn on the record for the live 2026 forecast. */
export const forecastZoneAt = (frame: number) => {
  const reveal = track(frame, [
    [at('live', 8), 0],
    [at('live', 10), 1],
  ]);
  if (reveal <= 0.01) return null;
  return {from: 2.5, to: 3.1, label: '工业时代以来最强阈值 · RONI ≥ +2.5', reveal};
};

/** Chapter metadata used by the header. */
export const CHAPTERS = [
  {id: 'hook', title: '两个同时成立的数字', source: 'NOAA CPC 2026-10-08 · WMO 2026-10-08 · 世界银行 2026-06-16'},
  {id: 'machine', title: '机器：一万八千公里没有陆地', source: 'NOAA CPC ONI (ERSSTv5, 1991–2020 基准) · 1950–2026'},
  {id: 'teleconnect', title: '雨从哪儿搬到了哪儿', source: 'WMO 季节展望 2026-10 · NOAA CPC · USDA FAS'},
  {id: 'grain', title: '1972：一次干旱与一场抢购', source: 'FAO · Glantz · CESifo WP 7037 · USDA'},
  {id: 'palm', title: '1997：市场交易的是预报', source: 'MPOB · NOAA CPC · ADB–BAPPENAS 1999'},
  {id: 'coal', title: '2011：从煤矿到街头', source: 'ABARES · FAO · IMF WP/11/62 · Reuters'},
  {id: 'split', title: '2026：同一个厄尔尼诺，两个方向', source: 'CONAB · MPOB · USDA FAS · 市场报价 2026-10'},
  {id: 'live', title: '现在：五个月的提前量', source: 'WMO · NOAA CPC · IRI · 世界银行 · Allianz Research'},
  {id: 'coda', title: '四个问题', source: 'NOAA CPC ONI · 1950–2026'},
] as const;

export const chapterIndexAt = (frame: number): number => {
  let idx = 0;
  CHAPTERS.forEach((c, i) => {
    if (sceneStart(c.id) <= frame) idx = i;
  });
  return idx;
};
