/**
 * 大气物理量计算
 *
 * 为什么要有这一层：
 * 原版追光打分是 `100 - 云量*0.5 - 降雨*0.8` 这种拍脑袋的线性权重，
 * 与云海形成的真实机制无关。云海不是"湿度高 + 云量适中"，
 * 而是"云层生成在你脚下"——这件事由抬升凝结高度（LCL）决定，可以被算出来。
 *
 * 用到的公式都是教科书级别、可手算复核的，没有任何黑箱：
 *   · Magnus 公式：饱和水汽压
 *   · 露点反解：Td = f(T, RH)
 *   · LCL ≈ 125 m/°C ×（T − Td）：抬升凝结高度，即云底高度
 *   · 位温近似：判断气层是否稳定
 */

/** 饱和水汽压（hPa），Magnus 公式，适用 −45 ~ 60 ℃ */
export const satVaporPressure = (t) => 6.112 * Math.exp((17.62 * t) / (243.12 + t));

/**
 * 露点温度（℃）
 * @param {number} t 气温
 * @param {number} rh 相对湿度（%）
 */
export function dewPoint(t, rh) {
  const R = Math.max(1, Math.min(100, Number(rh) || 60));
  const gamma = Math.log(R / 100) + (17.62 * t) / (243.12 + t);
  return (243.12 * gamma) / (17.62 - gamma);
}

/**
 * 温度露点差 T − Td（℃）
 * 越小空气越接近饱和。0 附近即为雾。
 */
export function dewSpread(t, rh) {
  return Math.max(0, t - dewPoint(t, rh));
}

/**
 * 抬升凝结高度（m，相对测站地面）
 * 经验式 LCL ≈ 125 × (T − Td)。这是"云底在哪"的一阶估计。
 */
export function liftingCondensationLevel(t, rh) {
  return 125 * dewSpread(t, rh);
}

/** 云底绝对海拔（m） */
export function cloudBaseAltitude(t, rh, stationElevation = 30) {
  return stationElevation + liftingCondensationLevel(t, rh);
}

/** 位温（K）：θ = T(K) × (1000/p)^0.286 */
export function potentialTemp(t, pressureHpa) {
  const p = Number(pressureHpa);
  if (!Number.isFinite(p) || p < 500 || p > 1100) return null;
  return (t + 273.15) * Math.pow(1000 / p, 0.286);
}

/**
 * 逆温强度代理指标（0—1）
 *
 * 真实逆温层需要探空资料（850 hPa 温度），免费天气 API 拿不到。
 * 这里用两个可观测的代理量合成，并在 UI 上如实标注为"估算"：
 *   1. 晴夜辐射降温 —— 昼夜温差大 + 夜间少云，地面冷却快，易形成贴地逆温
 *   2. 静风 —— 风速小则湍流弱，逆温层不被打破
 *
 * @param {{dtr:number, cloudNight:number, windScale:number}} p
 *        dtr 昼夜温差（℃）、cloudNight 夜间云量（%）、windScale 风力（级）
 */
export function inversionIndex({ dtr, cloudNight, windScale }) {
  const radiative = clamp01((dtr - 4) / 9); // 温差 4 ℃ 起步，13 ℃ 满分
  const clear = clamp01((70 - cloudNight) / 50); // 云量越低越好
  const calm = clamp01((5 - windScale) / 4); // 5 级风以上无逆温
  return clamp01(0.45 * radiative + 0.3 * clear + 0.25 * calm);
}

/**
 * 大气稳定度（0—1），1 为极稳定
 * 与逆温指数同源，但额外考虑湿度：湿空气密度小，更易分层
 */
export function stability({ dtr, cloudNight, windScale, humidity }) {
  const inv = inversionIndex({ dtr, cloudNight, windScale });
  const moist = clamp01((Number(humidity) - 60) / 35);
  return clamp01(0.75 * inv + 0.25 * moist);
}

/** 由天气代码与降水量反推日降水概率（和风 7 日预报不提供 PoP） */
export function estimatePop({ precip, text = '', code = 0 }) {
  const mm = Number(precip) || 0;
  if (mm >= 10) return 95;
  if (mm >= 3) return 82;
  if (mm >= 0.5) return 65;
  const c = Number(code) || 0;
  if (c >= 300 && c <= 399) return 70; // 雨
  if (c >= 400 && c <= 499) return 60; // 雪
  if (/雨|雪|雷/.test(text)) return 55;
  if (/阴/.test(text)) return 28;
  if (/多云|晴间/.test(text)) return 12;
  return 4;
}

/** 把 "3-4" 这样的风力区间取中值 */
export function windScaleNum(v) {
  const s = String(v ?? '');
  const nums = s.match(/\d+(\.\d+)?/g);
  if (!nums || !nums.length) return 3;
  const vals = nums.map(Number);
  return vals.length > 1 ? (vals[0] + vals[1]) / 2 : vals[0];
}

export const clamp01 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

/** sigmoid / logit，概率模型的左右手 */
export const sigmoid = (x) => 1 / (1 + Math.exp(-clamp(x, -20, 20)));
export const logit = (p) => {
  const q = clamp(p, 0.01, 0.99);
  return Math.log(q / (1 - q));
};

export const round1 = (v) => Math.round(Number(v) * 10) / 10;
