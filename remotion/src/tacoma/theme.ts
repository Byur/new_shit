/**
 * Visual identity for 《风中的桥》.
 *
 * The film runs on two visual tracks that share one palette but not one
 * brightness: the **archive track** (the past — real 1940 photographs, cool
 * sepia) and the **diagram track** (the analysis — a dark engineering drawing).
 * Archive material is evidence; diagrams are mechanism. They never impersonate
 * each other.
 *
 * The colour discipline that matters most is that orange means *energy entering
 * the structure* and nothing else. Wind is a neutral grey-blue, deliberately not
 * alarming, because "the wind was not strong" is one of the film's two central
 * claims and the palette has to agree with it.
 */

export const LAYOUT = {
  width: 1920,
  height: 1080,
  /** the content grid; nothing meaningful is drawn outside it */
  safe: {left: 88, right: 1832, top: 72, bottom: 1016},
  /** the caption band, always reserved for narration */
  caption: {top: 892, bottom: 1016},
  /** where act titles announce themselves */
  title: {x: 148, y: 156},
  /** the standard chart frame */
  plot: {left: 300, top: 268, right: 1640, bottom: 812},
} as const;

export const PLOT_W = LAYOUT.plot.right - LAYOUT.plot.left;
export const PLOT_H = LAYOUT.plot.bottom - LAYOUT.plot.top;

export const theme = {
  /* the diagram track sits on a lit engineering drawing, never pure black */
  bgTop: '#101820',
  bgMid: '#0B1014',
  bgBottom: '#080B0E',

  /** the bridge's own colour: cold steel */
  steel: '#B7C4CC',
  steelDim: 'rgba(183,196,204,0.42)',
  steelGhost: 'rgba(183,196,204,0.16)',
  steelDeep: '#7C8A94',

  /** information that is present but not yet active */
  inert: '#63717C',

  /**
   * Energy entering the structure. Used for the aerodynamic torque, the work
   * done per cycle, and the region above the critical speed — nothing else.
   */
  energy: '#FF6A2A',
  energySoft: 'rgba(255,106,42,0.16)',
  energyEdge: 'rgba(255,106,42,0.55)',

  /** wind and airflow, always neutral: the wind was not the drama */
  wind: '#8FA3B4',
  windSoft: 'rgba(143,163,180,0.20)',

  /** the successful path — the 1950 replacement, and the one tick in act 3 */
  fix: '#6BE3A0',
  fixSoft: 'rgba(107,227,160,0.16)',

  /** archive track: cool sepia, darkened, never colourised */
  archive: '#C9AE92',
  archiveDim: '#8A7660',

  text: '#E6EDF3',
  textDim: 'rgba(230,237,243,0.62)',
  textFaint: 'rgba(230,237,243,0.34)',
  textGhost: 'rgba(230,237,243,0.14)',

  panel: 'rgba(255,255,255,0.030)',
  panelEdge: 'rgba(255,255,255,0.095)',
  grid: 'rgba(255,255,255,0.055)',
  gridStrong: 'rgba(255,255,255,0.11)',
  axis: 'rgba(255,255,255,0.22)',

  font: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,sans-serif',
  /** numbers and units read as instrument output, so they get a monospace face */
  mono: '"SF Mono","Menlo","Consolas","PingFang SC",monospace',
} as const;

/**
 * The three shapes the bridge takes, and where each is allowed to appear. Keeping
 * this as a named table rather than ad-hoc geometry is what makes the cross
 * section a genuine continuity anchor: the same object returns in act after act,
 * and by the last act the viewer has watched it change meaning five times.
 */
export const BRIDGE = {
  /** real deck width of the 1940 span, m */
  deckWidth: 11.9,
  /** stiffening girder depth of the 1940 span, m */
  girderDepth: 2.4,
  /** stiffening truss depth of the 1950 span, m */
  trussDepth: 10.0,
  /** main span, m */
  mainSpan: 853.4,
  /** the critical wind speed the model derives, m/s */
  criticalSpeed: 16.0,
  /** wind speed recorded at the collapse, m/s */
  /** 42 mph, Farquharson's figure, as quoted by ASCE and the 1940 press */
  collapseWind: 18.8,
} as const;
