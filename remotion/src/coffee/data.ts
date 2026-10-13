/**
 * Reference data for the film.
 *
 * Production figures are FAO's 2023 green-coffee series (world total 11.06 Mt),
 * converted to millions of 60 kg bags for the marker scale and carried as a
 * percentage share for anything printed on screen — shares survive the
 * disagreement between FAO and USDA far better than absolute bag counts do.
 * The species split follows the ICO historical series. Altitude bands are the commercially typical ranges published
 * by the national boards / WCR rather than the absolute botanical limits; where
 * a country has genuinely distinct zones the dominant one is used. Coordinates
 * point at the producing region, not the country centroid — Sumatra rather than
 * Jakarta, Yirgacheffe rather than Addis.
 */

export type Process = 'washed' | 'natural' | 'honey' | 'wetHull' | 'mixed';

export type Origin = {
  /** ISO 3166-1 numeric, matching the Natural Earth shapes in geo.ts */
  iso: string;
  key: string;
  name: string;
  short: string;
  lon: number;
  lat: number;
  /** millions of 60 kg bags, FAO 2023 */
  bags: number;
  /** share of world green-coffee production, percent, FAO 2023 */
  share: number;
  /** share of the crop that is arabica, 0..1 */
  arabica: number;
  altLow: number;
  altHigh: number;
  process: Process;
  varieties: string;
  profile: string;
};

export const WORLD_TONNES_2023 = 11064205;
export const WORLD_SHARE_TOTAL = 100;

export const ORIGINS: Origin[] = [
  {
    iso: '76', key: 'brazil', name: '巴西', short: 'Brazil',
    lon: -45, lat: -19, bags: 56.8, share: 30.8, arabica: 0.68,
    altLow: 950, altHigh: 1150, process: 'natural',
    varieties: 'Mundo Novo、Catuai；罗布斯塔 Conilon',
    profile: '坚果、可可、低酸、醇厚。意式拼配的骨架。',
  },
  {
    iso: '704', key: 'vietnam', name: '越南', short: 'Vietnam',
    lon: 108, lat: 12.5, bags: 32.6, share: 17.7, arabica: 0.05,
    altLow: 600, altHigh: 800, process: 'natural',
    varieties: '罗布斯塔（Catimor 少量）',
    profile: '苦、木质、高咖啡因。主要进入速溶与拼配。',
  },
  {
    iso: '170', key: 'colombia', name: '哥伦比亚', short: 'Colombia',
    lon: -75.5, lat: 2.5, bags: 11.3, share: 6.2, arabica: 1,
    altLow: 1200, altHigh: 1900, process: 'washed',
    varieties: 'Castillo、Caturra、Colombia、Tabi',
    profile: '均衡、干净、焦糖甜。精品世界的标准参照物。',
  },
  {
    iso: '360', key: 'indonesia', name: '印度尼西亚', short: 'Sumatra',
    lon: 98, lat: 4, bags: 12.7, share: 6.9, arabica: 0.25,
    altLow: 1200, altHigh: 1500, process: 'wetHull',
    varieties: 'Ateng、Jember、罗布斯塔',
    profile: '低酸、厚重、草本与泥土。湿刨法的直接结果。',
  },
  {
    iso: '231', key: 'ethiopia', name: '埃塞俄比亚', short: 'Ethiopia',
    lon: 38.5, lat: 6.5, bags: 9.3, share: 5.1, arabica: 1,
    altLow: 1500, altHigh: 2200, process: 'mixed',
    varieties: '地方野生种（Heirloom）、Geisha 原产地',
    profile: '花香、柑橘、茶感。酸质最高的一档。',
  },
  {
    iso: '800', key: 'uganda', name: '乌干达', short: 'Uganda',
    lon: 34.3, lat: 1, bags: 6.4, share: 3.5, arabica: 0.15,
    altLow: 1200, altHigh: 1800, process: 'natural',
    varieties: '罗布斯塔原生种、SL 系',
    profile: '罗布斯塔中质地较干净的一支。',
  },
  {
    iso: '356', key: 'india', name: '印度', short: 'India',
    lon: 75.5, lat: 13, bags: 5.5, share: 3.0, arabica: 0.28,
    altLow: 900, altHigh: 1500, process: 'washed',
    varieties: 'Kent、S795、Catimor；Robusta Kaapi Royale',
    profile: '香料、醇厚。季风处理的豆子带咸鲜与低酸。',
  },
  {
    iso: '340', key: 'honduras', name: '洪都拉斯', short: 'Honduras',
    lon: -88, lat: 14.5, bags: 6.4, share: 3.5, arabica: 1,
    altLow: 1100, altHigh: 1700, process: 'washed',
    varieties: 'Catuai、Caturra、Pacas、Lempira',
    profile: '焦糖、柑橘、坚果。中美洲产量第一。',
  },
  {
    iso: '604', key: 'peru', name: '秘鲁', short: 'Peru',
    lon: -78.5, lat: -6, bags: 6.2, share: 3.3, arabica: 1,
    altLow: 1200, altHigh: 1900, process: 'washed',
    varieties: 'Typica、Caturra、Bourbon、Catimor',
    profile: '干净、柔和、花香，有机认证比例很高。',
  },
  {
    iso: '484', key: 'mexico', name: '墨西哥', short: 'Mexico',
    lon: -94, lat: 16.5, bags: 3.2, share: 1.8, arabica: 0.95,
    altLow: 900, altHigh: 1600, process: 'washed',
    varieties: 'Typica、Bourbon、Caturra、Maragogipe',
    profile: '坚果、可可、温和。低酸顺口。',
  },
  {
    iso: '320', key: 'guatemala', name: '危地马拉', short: 'Guatemala',
    lon: -90.5, lat: 15, bags: 3.8, share: 2.0, arabica: 1,
    altLow: 1300, altHigh: 1800, process: 'washed',
    varieties: 'Bourbon、Caturra、Catuai、Pacamara',
    profile: '烟熏、可可、香料。安提瓜的火山区风格。',
  },
  {
    iso: '558', key: 'nicaragua', name: '尼加拉瓜', short: 'Nicaragua',
    lon: -85.8, lat: 13, bags: 2.4, share: 1.3, arabica: 1,
    altLow: 1100, altHigh: 1700, process: 'washed',
    varieties: 'Caturra、Catuai、Maragogipe、JavaNica',
    profile: '干净、甜、柑橘。最近几年上升很快。',
  },
  {
    iso: '156', key: 'china', name: '中国云南', short: 'Yunnan',
    lon: 100.5, lat: 23, bags: 1.8, share: 1.0, arabica: 0.98,
    altLow: 1000, altHigh: 1600, process: 'washed',
    varieties: 'Catimor（卡蒂姆）为主，近年引入 Typica、Geisha',
    profile: '坚果、红糖、柔和酸。正从商业豆转向精品豆。',
  },
  {
    iso: '384', key: 'cotedivoire', name: '科特迪瓦', short: "Côte d'Ivoire",
    lon: -6, lat: 6.5, bags: 1.5, share: 0.8, arabica: 0.05,
    altLow: 200, altHigh: 600, process: 'natural',
    varieties: '罗布斯塔',
    profile: '低海拔罗布斯塔，主要供拼配与速溶。',
  },
  {
    iso: '188', key: 'costarica', name: '哥斯达黎加', short: 'Costa Rica',
    lon: -84, lat: 9.6, bags: 1.3, share: 0.7, arabica: 1,
    altLow: 1200, altHigh: 1800, process: 'honey',
    varieties: 'Caturra、Catuai、Villa Sarchi、Geisha',
    profile: '蜜处理的重镇。甜度高，酸质圆润。',
  },
  {
    iso: '834', key: 'tanzania', name: '坦桑尼亚', short: 'Tanzania',
    lon: 34, lat: -4, bags: 1.0, share: 0.6, arabica: 0.7,
    altLow: 1200, altHigh: 1800, process: 'washed',
    varieties: 'Kent、Bourbon、Typica、N39',
    profile: '黑加仑、番茄般的酸，接近肯尼亚但更轻。',
  },
  {
    iso: '404', key: 'kenya', name: '肯尼亚', short: 'Kenya',
    lon: 37, lat: -0.4, bags: 0.8, share: 0.4, arabica: 1,
    altLow: 1400, altHigh: 2000, process: 'washed',
    varieties: 'SL28、SL34、Ruiru 11、Batian',
    profile: '黑加仑、番茄、强烈而结构化的酸。双重水洗。',
  },
  {
    iso: '598', key: 'png', name: '巴布亚新几内亚', short: 'PNG',
    lon: 145.5, lat: -6, bags: 0.8, share: 0.4, arabica: 1,
    altLow: 1300, altHigh: 1900, process: 'washed',
    varieties: 'Typica、Arusha、Bourbon',
    profile: '干净、果味、香料。太平洋岛屿中少见的精品产区。',
  },
  {
    iso: '218', key: 'ecuador', name: '厄瓜多尔', short: 'Ecuador',
    lon: -79.2, lat: -4, bags: 0.6, share: 0.3, arabica: 0.6,
    altLow: 1200, altHigh: 2000, process: 'washed',
    varieties: 'Typica Mejorado、Caturra、Sidra',
    profile: '近年靠 Sidra 等品种打出名气。',
  },
  {
    iso: '222', key: 'elsalvador', name: '萨尔瓦多', short: 'El Salvador',
    lon: -89.5, lat: 13.8, bags: 0.5, share: 0.3, arabica: 1,
    altLow: 1200, altHigh: 1800, process: 'washed',
    varieties: 'Bourbon、Pacas、Pacamara',
    profile: 'Pacamara 的诞生地：大颗豆、巧克力与热带水果。',
  },
  {
    iso: '646', key: 'rwanda', name: '卢旺达', short: 'Rwanda',
    lon: 29.5, lat: -2, bags: 0.4, share: 0.2, arabica: 1,
    altLow: 1700, altHigh: 2100, process: 'washed',
    varieties: 'Bourbon、Jackson、BM139',
    profile: '干净、红茶、柑橘，海拔很高，豆子密度大。',
  },
  {
    iso: '108', key: 'burundi', name: '布隆迪', short: 'Burundi',
    lon: 29.6, lat: -3.3, bags: 0.2, share: 0.1, arabica: 1,
    altLow: 1400, altHigh: 1900, process: 'washed',
    varieties: 'Bourbon、Jackson',
    profile: '与卢旺达相近，莓果与茶的调性。',
  },
  {
    iso: '418', key: 'laos', name: '老挝', short: 'Laos',
    lon: 106, lat: 15, bags: 3.0, share: 1.6, arabica: 0.3,
    altLow: 800, altHigh: 1200, process: 'washed',
    varieties: '罗布斯塔、Catimor',
    profile: '波罗芬高原，主要是罗布斯塔。',
  },
  {
    iso: '764', key: 'thailand', name: '泰国', short: 'Thailand',
    lon: 98.9, lat: 18.8, bags: 0.3, share: 0.2, arabica: 0.35,
    altLow: 1000, altHigh: 1500, process: 'washed',
    varieties: 'Catimor、Caturra、Chiang Mai 系',
    profile: '北部高地，泰式精品豆的主力。',
  },
  {
    iso: '591', key: 'panama', name: '巴拿马', short: 'Panama',
    lon: -82.4, lat: 8.8, bags: 0.15, share: 0.08, arabica: 1,
    altLow: 1400, altHigh: 1800, process: 'washed',
    varieties: 'Geisha、Caturra、Catuai',
    profile: 'Geisha 的封神之地。茉莉、佛手柑、茶。',
  },
  {
    iso: '887', key: 'yemen', name: '也门', short: 'Yemen',
    lon: 44, lat: 15.3, bags: 0.5, share: 0.3, arabica: 1,
    altLow: 1500, altHigh: 2200, process: 'natural',
    varieties: 'Typica 系、Udaini',
    profile: '摩卡的发源地。野生、发酵感强、产量极低。',
  },
];

export const byKey = (key: string): Origin => {
  const found = ORIGINS.find((o) => o.key === key);
  if (!found) throw new Error(`unknown origin ${key}`);
  return found;
};

/** Marker radius scales with the square root of volume so area reads as volume. */
export const markerRadius = (bags: number) => 4 + Math.sqrt(bags) * 3.05;

/**
 * The species comparison. Caffeine and chlorogenic acid are the two compounds
 * that do double duty: they taste bitter/astringent in the cup and they are the
 * plant's chemical defence. That coincidence is the spine of the second act.
 */
export type SpeciesCompound = {
  label: string;
  /** [low, high] percent of dry weight, the range that recurs across sources */
  arabica: [number, number];
  robusta: [number, number];
  max: number;
};

/*
 * Ranges rather than point values. Published single figures for these four
 * compounds disagree by a factor of two or more between sources, so drawing one
 * number per species would claim precision that does not exist. Only caffeine
 * separates cleanly (roughly double); sucrose ranges genuinely overlap, and the
 * chart shows that overlap instead of hiding it.
 */
export const SPECIES_FACTS: SpeciesCompound[] = [
  {label: '咖啡因', arabica: [1.2, 1.5], robusta: [2.2, 2.7], max: 3.0},
  {label: '绿原酸', arabica: [5.5, 8.0], robusta: [9.0, 14.0], max: 15},
  {label: '蔗糖', arabica: [6.0, 9.0], robusta: [3.0, 7.0], max: 10},
  {label: '脂类', arabica: [15, 17], robusta: [9, 12], max: 18},
];

/** Robusta's share of world production, ICO series. */
export const ROBUSTA_SHARE: Array<[number, number]> = [
  [1990, 25],
  [2000, 33],
  [2010, 39],
  [2015, 42],
  [2020, 40],
  [2024, 44],
];

/** The lapse rate, in degrees Celsius lost per 1000 m of ascent. */
export const LAPSE_RATE = 6.5;
export const ARABICA_TEMP = [18, 22] as const;
