/**
 * Visual identity for the market-slang explainer.
 *
 * The whole piece lives inside one continuous A-share style quotation screen:
 * a candle chart, a price ruler, and a chip-distribution panel (筹码分布) that
 * shares the chart's price axis. Colour follows mainland convention: red is up,
 * green is down. Two extra semantic colours carry the argument of the video:
 * `describe` marks what is observable, `predict` marks somebody's claim about
 * the future. Almost every teaching beat is one of those two colours landing on
 * the same piece of chart.
 */

export const theme = {
  bg: '#0A0D12',
  bgTop: '#0E131A',
  bgBottom: '#070A0E',
  panel: 'rgba(255,255,255,0.026)',
  panelEdge: 'rgba(255,255,255,0.075)',
  grid: 'rgba(255,255,255,0.05)',
  gridStrong: 'rgba(255,255,255,0.1)',
  axis: 'rgba(255,255,255,0.26)',
  axisText: 'rgba(232,236,242,0.44)',
  text: '#E9EDF3',
  textDim: 'rgba(233,237,243,0.62)',
  textFaint: 'rgba(233,237,243,0.34)',
  textGhost: 'rgba(233,237,243,0.16)',
  up: '#F0453F',
  upSoft: 'rgba(240,69,63,0.16)',
  down: '#17B978',
  downSoft: 'rgba(23,185,120,0.16)',
  describe: '#93A1B5',
  describeSoft: 'rgba(147,161,181,0.14)',
  predict: '#E9B44C',
  predictSoft: 'rgba(233,180,76,0.14)',
  focus: '#FFFFFF',
  font: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,sans-serif',
  mono: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace',
} as const;

export const LAYOUT = {
  width: 1920,
  height: 1080,
  plot: {left: 96, top: 156, right: 1546, bottom: 868},
  chips: {left: 1572, right: 1836},
  header: {top: 34, bottom: 118},
  caption: {top: 906, bottom: 1046},
} as const;

export const PLOT_W = LAYOUT.plot.right - LAYOUT.plot.left;
export const PLOT_H = LAYOUT.plot.bottom - LAYOUT.plot.top;
