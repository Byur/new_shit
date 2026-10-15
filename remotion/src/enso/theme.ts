/**
 * Visual identity for the ENSO explainer.
 *
 * The subject is heat moving through water, so the piece is built on two
 * colour systems that never mix, and keeping them apart is the whole point:
 *
 *   1. A THERMAL system, used only on the ocean. `warm` is an El Niño anomaly,
 *      `cold` is a La Niña anomaly, `neutral` is the 1991-2020 normal. Because
 *      the ocean is drawn as one continuous cross-section, the viewer reads the
 *      state of the Pacific off a single hue without a legend.
 *   2. A RAINFALL system, used only on land. `wet` is rising air and rain,
 *      `dry` is sinking air and drought. Deliberately not red/blue, because
 *      red already means "warm water" and the two encodings would collide at
 *      exactly the moment the film needs them to be distinguishable: the
 *      teleconnection map, where the same phase makes one place wet and
 *      another dry.
 *
 * `price` is the only colour that means money. It appears on a price series, on
 * the four gates, and nowhere else, so its arrival on screen is itself a beat.
 */
export const theme = {
  /* --- ground ------------------------------------------------------- */
  bgTop: '#070C14',
  bgMid: '#05080D',
  bgBottom: '#03050A',
  panel: 'rgba(255,255,255,0.026)',
  panelEdge: 'rgba(255,255,255,0.085)',
  grid: 'rgba(255,255,255,0.05)',
  gridStrong: 'rgba(255,255,255,0.11)',
  axis: 'rgba(255,255,255,0.24)',
  axisText: 'rgba(226,236,248,0.46)',

  /* --- type --------------------------------------------------------- */
  text: '#E8EEF6',
  textDim: 'rgba(232,238,246,0.64)',
  textFaint: 'rgba(232,238,246,0.36)',
  textGhost: 'rgba(232,238,246,0.16)',

  /* --- 1. thermal: the ocean only ----------------------------------- */
  warm: '#FF6A3D',
  warmMid: '#F08A4B',
  warmDeep: '#B8371A',
  warmSoft: 'rgba(255,106,61,0.16)',
  cold: '#2FB6E8',
  coldMid: '#5FC9E8',
  coldDeep: '#12658C',
  coldSoft: 'rgba(47,182,232,0.16)',
  neutral: '#6F8296',
  neutralSoft: 'rgba(111,130,150,0.14)',

  /* the water body itself */
  oceanTop: '#0B1A28',
  oceanDeep: '#050B12',
  thermocline: 'rgba(255,255,255,0.42)',

  /* --- 2. rainfall: land only --------------------------------------- */
  wet: '#3E9BE0',
  wetSoft: 'rgba(62,155,224,0.20)',
  dry: '#D98A3C',
  drySoft: 'rgba(217,138,60,0.20)',

  /* --- geography ---------------------------------------------------- */
  land: '#1E2A38',
  landEdge: '#38485B',
  landHot: '#2B3A4B',
  border: 'rgba(255,255,255,0.07)',

  /* --- money -------------------------------------------------------- */
  price: '#F0D98A',
  priceSoft: 'rgba(240,217,138,0.14)',
  priceDim: 'rgba(240,217,138,0.45)',

  /* --- focus -------------------------------------------------------- */
  focus: '#FFFFFF',

  font: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,sans-serif',
  mono: '"SF Mono","Menlo","Consolas","PingFang SC",monospace',
} as const;

/**
 * Every box below uses ONE convention: `left`/`right`/`top`/`bottom` are
 * ABSOLUTE COORDINATES on the 1920x1080 canvas, not insets. Widths are derived
 * (`right - left`), and a component that needs an inset writes `1920 - right`.
 *
 * The header used to be the single exception — `{left: 96, right: 96}` as
 * insets — while `Header.tsx` converted it as if it were a coordinate. That
 * produced `right: 1920 - 96 = 1824` next to `left: 96`, i.e. a container
 * 1920 - 96 - 1824 = 0 px wide. Every chrome string inside it was squeezed to
 * its min-content width and wrapped one CJK character per line: the chapter
 * title rendered as eight stacked characters, the subtitle as eleven, the
 * section disclaimer as twenty-four. Nothing is vertical in the source, and no
 * pixel check could see it — the ink stayed inside the safe box and the frame
 * ink ratio was unchanged. Nothing about a zero-width container is visible in
 * the pixels; it only shows up if you measure the real DOM.
 *
 * So: every box in this file is absolute, never an inset pair.
 */
export const LAYOUT = {
  width: 1920,
  height: 1080,
  header: {left: 96, top: 30, right: 1824, bottom: 128},
  /** everything that is not chrome happens in here */
  stage: {left: 96, top: 140, right: 1824, bottom: 826},
  /** the 1950-2026 ONI record: the film's clock */
  strip: {left: 120, top: 840, right: 1800, bottom: 946},
  caption: {top: 960, bottom: 1052},
} as const;

export const STAGE_W = LAYOUT.stage.right - LAYOUT.stage.left;
export const STAGE_H = LAYOUT.stage.bottom - LAYOUT.stage.top;
export const STRIP_W = LAYOUT.strip.right - LAYOUT.strip.left;
export const STRIP_H = LAYOUT.strip.bottom - LAYOUT.strip.top;

/**
 * The vertical range of the ONI strip, in °C. Asymmetric because the record is
 * asymmetric: the strongest La Niña since 1950 is -2.04 (Dec 1973) while the
 * strongest El Niño is +2.59 (Dec 2015) — and the 2026 event is still climbing
 * into headroom that has to exist before the forecast can be drawn in it.
 */
export const ONI_MIN = -2.6;
export const ONI_MAX = 3.2;
