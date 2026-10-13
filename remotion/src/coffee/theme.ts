export const LAYOUT = {
  width: 1920,
  height: 1080,
  /** the map sits here; its aspect (1686/506 = 3.333) matches the world window */
  map: {left: 150, top: 140, right: 1836, bottom: 646},
  /** the strip under the map where per-origin detail lands */
  detail: {left: 150, top: 674, right: 1836, bottom: 884},
  header: {left: 96, right: 84, top: 34, bottom: 118},
  caption: {left: 906, right: 1046},
} as const;

export const MAP_W = LAYOUT.map.right - LAYOUT.map.left;
export const MAP_H = LAYOUT.map.bottom - LAYOUT.map.top;

/**
 * A warm, coffee-shaped palette. Deliberately not the same one as the market
 * piece: this is about a physical product, so the whole thing sits on roasted
 * browns rather than the near-black blue of a trading screen.
 */
export const theme = {
  bgTop: '#171009',
  bgMid: '#100B07',
  bgBottom: '#0A0705',

  text: '#F2EAE0',
  textDim: '#BCAF9F',
  textFaint: '#80766A',

  /** the two species */
  arabica: '#E3A34A',
  robusta: '#C25B3E',

  /** altitude, and everything that follows from temperature */
  altitude: '#7FB2A8',

  /** the four processing routes */
  washed: '#6FA8DC',
  natural: '#E0B84B',
  honey: '#D98E4A',
  wetHull: '#9C7B5E',

  /** genetics: the wild Ethiopian pool and the bred varieties */
  wild: '#A8C46B',
  bred: '#C98BB0',

  /** money and scores */
  score: '#8FB3E0',
  price: '#D9C27A',

  /* the map has to read as land-over-ocean before anything is drawn on it */
  ocean: '#150F0A',
  land: '#4E3E2C',
  landEdge: '#75604A',
  border: 'rgba(255,255,255,0.09)',
  belt: 'rgba(227,163,74,0.07)',
  beltEdge: 'rgba(227,163,74,0.5)',

  panel: 'rgba(255,255,255,0.028)',
  panelEdge: 'rgba(255,255,255,0.10)',
  grid: 'rgba(255,255,255,0.055)',

  font: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,sans-serif',
  mono: '"SF Mono","Menlo","Consolas","PingFang SC",monospace',
} as const;

export const SPECIES_COLOR = {
  arabica: theme.arabica,
  robusta: theme.robusta,
  both: theme.text,
} as const;

export const PROCESS_COLOR: Record<string, string> = {
  washed: theme.washed,
  natural: theme.natural,
  honey: theme.honey,
  wetHull: theme.wetHull,
  mixed: theme.textDim,
};
