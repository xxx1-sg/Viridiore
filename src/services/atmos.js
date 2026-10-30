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

/** 直接用露点算 LCL，不需要再反解湿度 */
export function lclFromDewPoint(t, td) {
  const a = Number(t);
  const b = Number(td);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return 125 * Math.max(0, a - b);
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
 * 两层之间的温度直减率（℃/km）
 * 正数表示气温随高度下降（正常），负数表示随高度升高（逆温）。
 * 干绝热递减率 9.8，湿绝热约 6，实际大气平均 6.5。
 */
export function lapseRate(tLow, zLow, tHigh, zHigh) {
  const dz = (Number(zHigh) - Number(zLow)) / 1000;
  if (!Number.isFinite(dz) || dz < 0.05) return null;
  const dt = Number(tLow) - Number(tHigh);
  if (!Number.isFinite(dt)) return null;
  return dt / dz;
}

/**
 * 由真实气压层数据判定逆温
 *
 * 这是 v2.2 最重要的改动。之前没有 850 hPa 温度，逆温只能用
 * "昼夜温差 + 夜间云量 + 风力"打一个 0—1 的代理分；现在 Open-Meteo
 * 直接给出 925 hPa（约 750 m）与 850 hPa（约 1500 m）的温度与位势高度，
 * 于是"有没有逆温、逆温层多厚、底在哪"变成了可以手算复核的量：
 *
 *   直减率 < 0      → 绝对逆温：温度随高度升高，暖盖已经形成
 *   直减率 < 4      → 强稳定：云层向上发展被压制，容易成"海"
 *   直减率 < 6.5    → 偏稳定：比标准大气稳定
 *   直减率 ≥ 6.5    → 不稳定：对流活跃，云会立起来变成积云
 *
 * @param {{t2m:number, z2m:number, t925:number, z925:number, t850:number, z850:number}} s
 * @returns {{index:number, lapseLow:number|null, lapseMid:number|null, base:number|null,
 *            absolute:boolean, label:string, note:string}}
 */
export function inversionProfile(s = {}) {
  const t2m = Number(s.t2m);
  const z2m = Number(s.z2m) || Number(s.stationElevation) || 25;
  const t925 = Number(s.t925);
  const z925 = Number(s.z925);
  const t850 = Number(s.t850);
  const z850 = Number(s.z850);

  const segments = [];
  const l1 = lapseRate(t2m, z2m, t925, z925);
  if (l1 !== null) segments.push({ lapse: l1, top: z925, tag: '925' });
  const l2 = lapseRate(t925, z925, t850, z850);
  if (l2 !== null) segments.push({ lapse: l2, top: z850, tag: '850' });
  const l0 = lapseRate(t2m, z2m, t850, z850);
  if (l0 !== null) segments.push({ lapse: l0, top: z850, tag: 'all' });

  if (!segments.length) {
    return {
      index: 0,
      lapseLow: null,
      lapseMid: null,
      base: null,
      absolute: false,
      label: '未知',
      note: '缺少高空层结数据',
      available: false
    };
  }

  // 取最稳定的一段（直减率最小）作为逆温判据
  const coldest = segments.reduce((a, b) => (b.lapse < a.lapse ? b : a));

  // 6.5 ℃/km 为中性参照：每低 1 ℃/km 加一点稳定度，−2.5 时打满
  const index = clamp01((6.5 - coldest.lapse) / 9);
  const absolute = coldest.lapse < 0;

  const label =
    coldest.lapse < 0 ? '逆温' : coldest.lapse < 3 ? '强逆温倾向' : coldest.lapse < 5.5 ? '偏稳定' : coldest.lapse < 6.5 ? '接近中性' : '不稳定';

  const layerText = coldest.tag === '925' ? '地面到 925 hPa' : coldest.tag === '850' ? '925—850 hPa' : '地面到 850 hPa';

  const note =
    coldest.lapse < 0
      ? `${layerText}温度随高度升高，逆温盖已经形成（${coldest.lapse.toFixed(1)} ℃/km）`
      : coldest.lapse < 5.5
        ? `${layerText}的直减率 ${coldest.lapse.toFixed(1)} ℃/km，低于标准大气 6.5，层结稳定`
        : `最稳定层（${layerText}）直减率 ${coldest.lapse.toFixed(1)} ℃/km，对流不易被压制`;

  return {
    index,
    lapseLow: l1,
    lapseMid: l2,
    /** 判据实际采用的那一段的直减率，UI 显示它才不会和标签对不上 */
    lapse: coldest.lapse,
    layer: layerText,
    base: z2m,
    top: coldest.top,
    absolute,
    label,
    note,
    available: true
  };
}

/**
 * 逆温强度代理指标（0—1）—— 仅在拿不到气压层数据时使用
 *
 * 真实逆温层需要 850 hPa 温度。有 Open-Meteo 层结数据时改用
 * inversionProfile()，这个函数只作为离线 / 缺测时的兜底，
 * 在界面上会如实标注为"估算"。
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
