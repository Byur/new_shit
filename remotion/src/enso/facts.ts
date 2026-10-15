/**
 * Every number the film prints, in one place, with its source.
 *
 * Two rules govern this file, and they are the reason it exists separately from
 * the scenes:
 *
 *   1. Scenes never hard-code a figure. If a number appears on screen it comes
 *      from here, so the doc's source table and the frame cannot drift apart.
 *   2. MEASURED and SCHEMATIC are different types of thing and are not mixed.
 *      `LIVE` holds real observations with a real date and a real source.
 *      `SCHEMATIC` holds the *shape* of a historical price move, reconstructed
 *      from the literature because minute-by-minute historical quotes are not
 *      available to this project — and every schematic drawn on screen carries
 *      the badge "示意路径" so a viewer is never shown a drawn curve and told it
 *      is a quote.
 *
 * Attribution strength is recorded per fact, because the film's argument is
 * partly about attribution: `strong` means the literature broadly agrees ENSO
 * was the dominant driver, `contributing` means it was one factor among
 * several, `coincident` means the timing overlaps but causality is not
 * established. The narration is written to match these labels.
 */

export type Attribution = 'strong' | 'contributing' | 'coincident';

/* ------------------------------------------------------------------ */
/* Concentration: the door ENSO uses to reach a market                 */
/* ------------------------------------------------------------------ */

export type SupplyShare = {
  key: string;
  label: string;
  countries: string;
  /** share of the relevant world total, percent */
  share: number;
  /** what the share is OF — the denominator matters more than the number */
  of: string;
  commodity: string;
  /** decimal year of the ONI peak this share is paired with */
  source: string;
};

export const SUPPLY: SupplyShare[] = [
  {
    key: 'palm',
    label: '棕榈油',
    countries: '印尼 + 马来西亚',
    share: 85,
    of: '全球产量',
    commodity: '棕榈油',
    source: 'USDA FAS Oilseeds; 两国合计约占全球产量 85%',
  },
  {
    key: 'coal',
    label: '海运焦煤',
    countries: '澳大利亚',
    share: 60,
    of: '全球海运贸易',
    commodity: '焦煤',
    source: 'ABARES，2011 年口径：约占全球海运冶金煤市场 60%',
  },
  {
    key: 'cocoa',
    label: '可可',
    countries: '科特迪瓦 + 加纳',
    share: 60,
    of: '全球产量',
    commodity: '可可',
    source: 'ICCO 常用口径：两国合计约占全球产量 55%–60%',
  },
  {
    key: 'coffee',
    label: '阿拉比卡咖啡',
    countries: '巴西',
    share: 35,
    of: '全球阿拉比卡产量',
    commodity: '咖啡',
    source: 'USDA FAS Coffee: World Markets and Trade；巴西占全球咖啡总产约 1/3',
  },
  {
    key: 'rice',
    label: '大米出口',
    countries: '印度',
    share: 40,
    of: '全球大米出口',
    commodity: '大米',
    source: 'USDA FAS；2026-10 报道口径：印度占全球大米出口 40% 以上',
  },
];

/* ------------------------------------------------------------------ */
/* The live state of the 2026 event                                    */
/* ------------------------------------------------------------------ */

export type LiveReading = {
  value: string;
  unit?: string;
  label: string;
  /** the date the reading is for */
  asOf: string;
  source: string;
  note?: string;
};

export const LIVE = {
  /** NOAA CPC ENSO Diagnostic Discussion, 8 Oct 2026 (El Nino Advisory) */
  cpc: {
    issued: '2026-10-08',
    status: 'El Niño Advisory',
    nino34Relative: '+2.1',
    nino3: '+3.0',
    nino12: '+3.9',
    /** probability that the OND 3-month RONI exceeds +2.5 °C, i.e. historic */
    historicProbability: 83,
    historicWindow: '2026 年 10–12 月',
    probabilityByWindow: [
      {window: '9–11 月', p: 54},
      {window: '10–12 月', p: 83},
      {window: '11 月–次年 1 月', p: 70},
    ],
    source: 'NOAA CPC, ENSO Diagnostic Discussion, 2026-10-08',
    metricNote: '概率针对 RONI（相对 Niño-3.4 指数）3 个月均值 ≥ +2.5 °C',
  },
  /** WMO press release, 8 Oct 2026 */
  wmo: {
    issued: '2026-10-08',
    forecastPeak: '+3.7',
    forecastWindow: '2026 年 10–12 月',
    previousRecord: '+2.6',
    previousRecordWindow: '2015 年 11 月–2016 年 1 月',
    persistProbability: '接近 100%',
    persistThrough: '2027 年 2 月',
    quote:
      'El Niño doesn\u2019t add new heat to the planet. It releases heat the ocean has already been storing beneath the surface.',
    quoteBy: 'Celeste Saulo，WMO 秘书长，2026-10',
    source: 'WMO, Sea-surface temperatures reflect strengthening El Niño, 2026-10-08',
    metricNote: 'Niño-3.4 异常，基准期 1993–2009；与 NOAA 的 ONI 基准期不同，数字不可直接互比',
  },
  /** IRI/CCSR ENSO Quick Look, 21 Sep 2026 */
  iri: {
    issued: '2026-09-21',
    augustNino34: '+2.52',
    models: 22,
    dynamical: 13,
    statistical: 9,
    allVeryStrong: true,
    quote: 'a majority of models project Niño-3.4 values that could reach or exceed +3.0 °C',
    source: 'IRI/CCSR ENSO Quick Look and Technical Update, 2026-09-21',
  },
  /** World Bank blog, 16 Jun 2026 */
  worldBank: {
    issued: '2026-06-16',
    baselineFoodPrice: 2.5,
    baselineSource: 'World Bank Group, Commodity Markets Outlook, April 2026',
    upsideRisks: [
      '更强的厄尔尼诺',
      '更高的化肥与能源成本',
      '生物燃料需求',
      '出口限制',
    ],
    source: 'World Bank, When risks stack up: Threats to global food markets in 2026, 2026-06-16',
  },
  /** WMO warning sequence, the institutional lead time on this event */
  warningSequence: [
    {date: '2026-04-24', text: '厄尔尼诺可能性上升'},
    {date: '2026-06-02', text: '请为厄尔尼诺做准备'},
    {date: '2026-07-03', text: '预计将加强'},
    {date: '2026-07-31', text: '预计将很强'},
    {date: '2026-09-03', text: '将变得极强，推高 2027 年风险'},
  ],
  leadMonths: 5,
} as const;

/* ------------------------------------------------------------------ */
/* What has actually moved, as of 14-15 Oct 2026                       */
/* ------------------------------------------------------------------ */

export type MarketMove = {
  key: string;
  name: string;
  level: string;
  unit: string;
  /** percent change over the stated window */
  change: number;
  window: string;
  direction: 'up' | 'down';
  /** why, in the film's causal terms */
  driver: string;
  /** which of the four gates explains the direction */
  gate: 1 | 2 | 3 | 4;
  source: string;
};

export const MARKET_2026: MarketMove[] = [
  {
    key: 'sugar',
    name: '糖',
    level: '20.84',
    unit: '美分/磅',
    change: 16.2,
    window: '近 1 个月',
    direction: 'up',
    driver: '巴西中南部降雨拖慢压榨 · 印度季风偏弱 · 泰国减产 17%',
    gate: 1,
    source: '市场报价，2026-10-14',
  },
  {
    key: 'rice',
    name: '大米',
    level: '17.27',
    unit: '美元/英担',
    change: 61.5,
    window: '近 1 年',
    direction: 'up',
    driver: '印度季风为 2009 年以来最弱，降雨偏少 15%，产量下调 700 万吨',
    gate: 1,
    source: '市场报价，2026-10-15 · USDA FAS 2026-10-14',
  },
  {
    key: 'cocoa',
    name: '可可',
    level: '5735',
    unit: '美元/吨',
    change: 100,
    window: '自 2026 年 2 月低点',
    direction: 'up',
    driver: '科特迪瓦主季预计减产 17% · 加纳减产 13%',
    gate: 1,
    source: '市场报价，2026-10-14 · 路透/StoneX 预估',
  },
  {
    key: 'coffee',
    name: '阿拉比卡咖啡',
    level: '298.05',
    unit: '美分/磅',
    change: -24.5,
    window: '近 1 年',
    direction: 'down',
    driver: '巴西南部多雨，2026 年收成 6760 万袋，历史最高，同比 +19.6%',
    gate: 3,
    source: '市场报价，2026-10-14 · CONAB 2026-09-24',
  },
  {
    key: 'palm',
    name: '毛棕榈油',
    level: '4700',
    unit: '林吉特/吨',
    change: -3.8,
    window: '近 1 个月',
    direction: 'down',
    driver: '马来西亚库存 351 万吨，历史最高，连续 6 个月上升',
    gate: 3,
    source: '市场报价，2026-10-14 · MPOB 2026-09',
  },
  {
    key: 'wheat',
    name: '小麦',
    level: '668.83',
    unit: '美分/蒲式耳',
    change: -8.5,
    window: '近 1 个月',
    direction: 'down',
    driver: '一年上涨 33%，但当月回落：这一轮涨势来自能源与化肥，不是厄尔尼诺',
    gate: 4,
    source: '市场报价，2026-10-15',
  },
];

/* ------------------------------------------------------------------ */
/* Schematic historical price paths                                    */
/* ------------------------------------------------------------------ */

/**
 * A drawn shape, NOT a quote. `basis` records exactly what anchors it, so the
 * on-screen curve can always be traced back to a sentence in the doc.
 */
export type SchematicPath = {
  key: string;
  title: string;
  /** value axis label for the drawn series */
  unit: string;
  /** the year span the x axis covers */
  from: number;
  to: number;
  /** [fraction of the x span, value] */
  points: Array<[number, number]>;
  /** the one number from the literature that the shape is pinned to */
  anchors: Array<{at: string; value: string}>;
  basis: string;
  attribution: Attribution;
  attributionNote: string;
};

export const SCHEMATIC: Record<string, SchematicPath> = {
  usWheat: {
    key: 'usWheat',
    title: '美国小麦价格',
    unit: '美元 / 蒲式耳',
    from: 1972,
    to: 1974.2,
    points: [
      [0, 1.51],
      [0.18, 1.9],
      [0.34, 2.4],
      [0.5, 2.9],
      [0.64, 3.4],
      [0.78, 4.4],
      [0.9, 5.6],
      [1, 5.7],
    ],
    anchors: [
      {at: '1972 年 8 月', value: '1.51 美元'},
      {at: '1974 年初', value: '5.5 美元以上'},
    ],
    basis: '锚定 1972-08 的 1.51 与 1974 年初的 5.5 美元以上，中间为示意插值。',
    attribution: 'coincident',
    attributionNote:
      '1972 年厄尔尼诺与苏联、萨赫勒、印度、澳大利亚同时发生的干旱同期；苏联干旱通常归于阻塞高压，未有同行评议研究把它单独归因于 ENSO。影片说的是「同一年」，不说「因为」。',
  },
  anchovy: {
    key: 'anchovy',
    title: '秘鲁鳀鱼捕捞量',
    unit: '百万吨',
    from: 1970,
    to: 1973,
    points: [
      [0, 12.4],
      [0.33, 10.3],
      [0.66, 4.4],
      [1, 2.0],
    ],
    anchors: [
      {at: '1970 年', value: '1240 万吨（峰值）'},
      {at: '1973 年', value: '不到 200 万吨'},
    ],
    basis: 'FAO / Glantz 引用的年度序列：12.277 / 10.277 / 4.447 / 2.000 百万吨。这是实测序列，不是示意。',
    attribution: 'contributing',
    attributionNote:
      'ENSO 是触发器，但过度捕捞与产能过剩是同等重要的原因；1972 年的捕捞量掩盖了本已稀薄的鱼群。影片明说两层原因。',
  },
  palmOil: {
    key: 'palmOil',
    title: '马来西亚毛棕榈油',
    unit: '林吉特 / 吨（示意）',
    from: 1997,
    to: 1998.6,
    points: [
      [0, 1150],
      [0.2, 1250],
      [0.4, 1600],
      [0.6, 2050],
      [0.78, 2400],
      [0.9, 2250],
      [1, 1900],
    ],
    anchors: [
      {at: '1997 年中', value: '约 1100–1200 林吉特/吨'},
      {at: '1998 年初', value: '约 2300–2500 林吉特/吨'},
    ],
    basis:
      '区间来自 MPOB 月度序列的二手转述，本仓库未能逐月核对原始月报，因此曲线只表达「一年多里大致翻倍」，不代表逐月报价。',
    attribution: 'contributing',
    attributionNote:
      '1997-98 的干旱与火灾是真实现象，但同期还有亚洲金融危机与货币贬值，棕榈油以林吉特计价的价格受汇率影响。影片只讲时间顺序，不宣称单一因果。',
  },
  coal: {
    key: 'coal',
    title: '优质硬焦煤季度基准价',
    unit: '美元 / 吨',
    from: 2010.6,
    to: 2011.9,
    points: [
      [0, 200],
      [0.3, 225],
      [0.52, 330],
      [0.74, 315],
      [1, 265],
    ],
    anchors: [
      {at: '2011 年 Q1', value: '约 225 美元/吨'},
      {at: '2011 年 Q2', value: '330 美元/吨（+47%）'},
      {at: '2011 年 Q4', value: '265 美元/吨'},
    ],
    basis: 'ABARES 的季度基准结算价：225 → 330 → 315 → 265，是实测结算价而非现货。',
    attribution: 'strong',
    attributionNote: '拉尼娜与昆士兰创纪录降雨的关系是 ENSO 遥相关中较稳健的一条。',
  },
  coffee2021: {
    key: 'coffee2021',
    title: '阿拉比卡咖啡',
    unit: '美分 / 磅（示意）',
    from: 2020.2,
    to: 2022.4,
    points: [
      [0, 115],
      [0.25, 120],
      [0.5, 135],
      [0.7, 175],
      [0.85, 215],
      [0.95, 250],
      [1, 230],
    ],
    anchors: [
      {at: '2020–2021 年初', value: '约 110–130 美分/磅'},
      {at: '2022 年 2 月', value: '十年新高（路透）'},
    ],
    basis:
      '路透 2022-02-09 报道「阿拉伯比卡咖啡创十年新高」是事实；具体点位与起点的逐日路径本仓库未能核对，因此曲线为示意。',
    attribution: 'contributing',
    attributionNote: '2021 年巴西干旱与 7 月霜冻都起了作用，拉尼娜是背景条件之一。',
  },
};

/* ------------------------------------------------------------------ */
/* The four gates: the film's one portable tool                        */
/* ------------------------------------------------------------------ */

export type Gate = {
  n: 1 | 2 | 3 | 4;
  title: string;
  question: string;
  counter: string;
  /** the case that shows the gate failing */
  counterCase: string;
};

export const GATES: Gate[] = [
  {
    n: 1,
    title: '雨搬到哪',
    question: '这一相的降雨，从哪个产区搬走了？',
    counter: '雨搬走的地方，不产任何可交易的东西',
    counterCase: '南太平洋岛国在厄尔尼诺年普遍偏干，但它们不在任何商品供应链上',
  },
  {
    n: 2,
    title: '谁供应',
    question: '那个产区占全球供给多少？是 5%，还是 60%？',
    counter: '产区足够分散，可以互相补位',
    counterCase:
      '小麦产自阿根廷、美国、俄罗斯、乌克兰、澳大利亚、欧盟——一个产区减产，其他产区可以顶上',
  },
  {
    n: 3,
    title: '库存多薄',
    question: '库存消费比是多少？有没有替代产地？能不能补种？',
    counter: '库存充足，一季减产被库存吸收',
    counterCase: '2026 年马来西亚棕榈油库存升到 351 万吨，历史最高，把干旱的影响吸收掉了',
  },
  {
    n: 4,
    title: '定价了多少',
    question: '预报提前多久出现？价格已经走了多少？',
    counter: '事件已被充分预报，价格提前走完',
    counterCase: '2026 年这一次，机构在预计峰值前约 5 个月就开始连续预警',
  },
];

/* ------------------------------------------------------------------ */
/* The 1972 and 2011 chains, as named links                            */
/* ------------------------------------------------------------------ */

export const CHAIN_1972 = [
  '厄尔尼诺年 · 多地同旱',
  '苏联小麦 −13%',
  '秘密采购 >1000 万吨',
  '美国小麦 1.51 → 5.5 美元',
  '1973-06 大豆出口禁运',
];

export const CHAIN_2011 = [
  '拉尼娜 · 昆士兰洪水',
  '博文盆地煤矿停产',
  '焦煤 225 → 330 美元',
  'FAO 食品价格指数 236 点',
  '食品占 CPI 30–40% 的国家',
  '政治动荡',
];

/** Food's weight in the household basket — the amplifier between prices and politics. */
export const CPI_FOOD_WEIGHT = [
  {group: '低收入国家', low: 40, high: 48, color: '#D98A3C'},
  {group: '新兴市场', low: 30, high: 40, color: '#E0A24A'},
  {group: '发达经济体', low: 10, high: 15, color: '#8FA6BE'},
];
