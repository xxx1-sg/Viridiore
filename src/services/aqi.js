/**
 * 中国环境空气质量指数（AQI）
 *
 * 为什么自己算：
 * Open-Meteo 只给欧洲 EAQI 和美国 US AQI。EAQI 的口径比国内严得多，
 * 同一片空气 55 会被标成「中等」，换成国内标准可能只是「良」；
 * 用户拿它和手机上的「38 优」一比，第一反应是这软件在编数据。
 *
 * 这里按 HJ 633-2012《环境空气质量指数（AQI）技术规定》实现：
 *   1. 每种污染物按 24 小时浓度限值表做分段线性插值，得到分指数 IAQI
 *   2. AQI = 所有 IAQI 的最大值
 *   3. AQI > 50 时，IAQI 最大的那个污染物就是首要污染物
 *
 * 浓度限值取自 HJ 633-2012 表 1。注意 CO 的单位是 mg/m³，
 * 而 API 给的是 μg/m³，转换在 splitPollutants 里做。
 */

/** [IAQI, SO2, NO2, PM10, CO(mg/m³), O3(8h), PM2.5] —— 24 小时平均浓度限值 */
const BREAKPOINTS = [
  [0, 0, 0, 0, 0, 0, 0],
  [50, 50, 40, 50, 2, 100, 35],
  [100, 150, 80, 150, 4, 160, 75],
  [150, 475, 180, 250, 14, 215, 115],
  [200, 800, 280, 350, 24, 265, 150],
  [300, 1600, 565, 420, 36, 800, 250],
  [400, 2100, 750, 500, 48, null, 350],
  [500, 2620, 940, 600, 60, null, 500]
];

/** 列序号 → 污染物键名 */
const COLUMNS = [
  { key: 'pm25', col: 6, name: 'PM2.5', unit: 'μg/m³' },
  { key: 'pm10', col: 3, name: 'PM10', unit: 'μg/m³' },
  { key: 'o3', col: 5, name: 'O₃', unit: 'μg/m³' },
  { key: 'no2', col: 2, name: 'NO₂', unit: 'μg/m³' },
  { key: 'so2', col: 1, name: 'SO₂', unit: 'μg/m³' },
  { key: 'co', col: 4, name: 'CO', unit: 'mg/m³' }
];

/** 单个污染物的分指数，线性插值 */
function iaqiOf(value, col) {
  const c = Number(value);
  if (!Number.isFinite(c) || c < 0) return null;

  for (let i = 1; i < BREAKPOINTS.length; i++) {
    const [hiAqi, ...hi] = BREAKPOINTS[i];
    const [loAqi, ...lo] = BREAKPOINTS[i - 1];
    const up = hi[col - 1];
    const down = lo[col - 1];
    if (up === null || down === null) continue; // O₃ 在 300 以上不再分级
    if (c <= up) {
      if (up === down) return hiAqi;
      return Math.round(((hiAqi - loAqi) / (up - down)) * (c - down) + loAqi);
    }
  }
  // 超出量表上限，按最高档封顶
  return 500;
}

/** AQI 分档 */
export function aqiCategory(aqi) {
  const a = Number(aqi);
  if (!Number.isFinite(a)) return { level: 0, label: '--', tone: 'none' };
  if (a <= 50) return { level: 1, label: '优', tone: 'excellent' };
  if (a <= 100) return { level: 2, label: '良', tone: 'good' };
  if (a <= 150) return { level: 3, label: '轻度污染', tone: 'light' };
  if (a <= 200) return { level: 4, label: '中度污染', tone: 'moderate' };
  if (a <= 300) return { level: 5, label: '重度污染', tone: 'heavy' };
  return { level: 6, label: '严重污染', tone: 'severe' };
}

/**
 * 由六项污染物浓度算 AQI
 *
 * @param {{pm25?:number, pm10?:number, so2?:number, no2?:number, co?:number, o3?:number}} raw
 *        co 传 μg/m³（API 原始单位），内部转 mg/m³
 * @returns {{aqi:number, category:string, level:number, tone:string,
 *            primary:string|null, pollutants:Array<{key,name,value,iaqi,unit}>}|null}
 */
export function computeAqi(raw = {}) {
  // CO 单位换算：API 给 μg/m³，国标用 mg/m³
  const values = {
    pm25: raw.pm25,
    pm10: raw.pm10,
    so2: raw.so2,
    no2: raw.no2,
    o3: raw.o3,
    co: Number.isFinite(Number(raw.co)) ? Number(raw.co) / 1000 : undefined
  };

  const scored = [];
  for (const meta of COLUMNS) {
    const v = values[meta.key];
    if (!Number.isFinite(Number(v))) continue;
    const iaqi = iaqiOf(v, meta.col);
    if (iaqi === null) continue;
    scored.push({
      key: meta.key,
      name: meta.name,
      unit: meta.unit,
      value: meta.key === 'co' ? Number(Number(v).toFixed(2)) : Math.round(Number(v)),
      iaqi
    });
  }

  if (!scored.length) return null;

  const top = scored.reduce((a, b) => (b.iaqi > a.iaqi ? b : a));
  const aqi = top.iaqi;
  const cat = aqiCategory(aqi);

  // 国标规定：AQI ≤ 50 时不报首要污染物
  const primary = aqi > 50 ? top.name : null;

  // 按分指数降序，界面可以直接照这个顺序排
  scored.sort((a, b) => b.iaqi - a.iaqi);

  return {
    aqi,
    category: cat.label,
    level: cat.level,
    tone: cat.tone,
    primary,
    pollutants: scored,
    standard: 'CN MEE'
  };
}

export { BREAKPOINTS };
