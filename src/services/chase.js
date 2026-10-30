/**
 * 追光：把真实预报折算成"能不能看到"的概率
 *
 * 三个刻意的设计选择：
 *
 * 1. 输出概率，不输出评分。
 *    100 分制用户不信，也没法验证；"72%"可以被下一次出行证伪，
 *    能被证伪的数字才有资格叫预测。
 *
 * 2. 从基准率出发，而不是从 0 开始加分。
 *    云海在华南是季节性现象（11—3 月为主），不问月份的模型都是耍流氓。
 *    先验取该月历史基准率，再用当日物理证据在 log-odds 上做加减。
 *
 * 3. 每一项加减都能追到某个真实观测量。
 *    v2.2 起不再有"代理指标"：云底由 API 给的真实露点算 LCL，
 *    逆温由 925 / 850 hPa 的实际温度直减率判定，层厚由低云量与
 *    850 hPa 湿度给出。任何一个数字被质疑，都能指着原始数据复核。
 *
 * 仍然存在的局限（写在 README 与本文件，不藏）：
 *   · 山谷具体地形未建模，云底是相对测站的一阶估计，几百米量级误差；
 *   · 先验是经验基准率，不是本地气候统计年鉴，要靠用户反馈校准；
 *   · 高空变量来自数值模式同化场，不是本地探空实测。
 */
import {
  dewSpread,
  lclFromDewPoint,
  inversionProfile,
  inversionIndex,
  clamp01,
  clamp,
  sigmoid,
  logit
} from './atmos.js';
import { sunTimes, sunriseAzimuth, facingSlopeLabel } from './sun.js';

/**
 * 月度基准率（先验）
 * 云海需要"前期降水供湿 + 晴夜辐射降温 + 静风"，华南只在干季成立；
 * 夏季湿热但对流旺盛、逆温弱，云海反而少。
 */
const PRIOR_CLOUDSEA = [0.18, 0.2, 0.16, 0.1, 0.06, 0.03, 0.02, 0.02, 0.04, 0.09, 0.16, 0.19];
const PRIOR_SUNRISE = [0.52, 0.46, 0.4, 0.32, 0.26, 0.2, 0.22, 0.22, 0.28, 0.4, 0.48, 0.52];
const PRIOR_STARS = [0.42, 0.36, 0.28, 0.2, 0.14, 0.1, 0.12, 0.12, 0.18, 0.3, 0.38, 0.42];

export const MODES = {
  cloudsea: {
    key: 'cloudsea',
    name: '云海',
    icon: 'cloud',
    desc: '在云上等太阳',
    prior: PRIOR_CLOUDSEA,
    windowLabel: '日出前后 40 分钟'
  },
  sunrise: {
    key: 'sunrise',
    name: '日出',
    icon: 'sunrise',
    desc: '为了一抹晨光',
    prior: PRIOR_SUNRISE,
    windowLabel: '日出前 30 分钟 — 日出后 20 分钟'
  },
  stars: {
    key: 'stars',
    name: '星空',
    icon: 'star',
    desc: '银河与星轨',
    prior: PRIOR_STARS,
    windowLabel: '天黑后 — 月出前'
  }
};

/* ---------------- 云层几何 ---------------- */

/**
 * 由真实层结数据推算云层位置
 *
 * 云底 = 测站海拔 + LCL，LCL 用 API 直接给出的露点算：
 *   露点越接近气温，空气越接近饱和，云底越低。
 * 云顶 = 云底 + 厚度，厚度由低云量与 850 hPa 湿度共同决定：
 *   低云量高说明云是成片的层状云，850 湿度高说明水汽供给充足，
 *   两者都指向更厚、更像"海"的云层。
 *
 * 注意 cloudLow 是低云覆盖率，它回答"有没有云"；
 * LCL 回答"云在哪"。云海需要两个条件同时成立：有云，且云在你脚下。
 */
export function cloudGeometry(day) {
  const s = day.soundings || {};
  const station = Number(s.stationElevation) || 25;

  const t2m = Number.isFinite(Number(s.t2m)) ? Number(s.t2m) : Number(day.min ?? day.tempNight ?? 18);
  const td = Number.isFinite(Number(s.td2m))
    ? Number(s.td2m)
    : t2m - dewSpread(t2m, Number(day.humidity ?? 70));

  const lcl = lclFromDewPoint(t2m, td);
  const base = station + (lcl ?? 0);
  const spread = Math.max(0, t2m - td);

  const cloudLow = Number.isFinite(Number(s.cloudLow)) ? Number(s.cloudLow) : Number(day.cloud ?? 50);
  const rh850 = Number.isFinite(Number(s.rh850)) ? Number(s.rh850) : 70;

  const thickness = 160 + 780 * (0.6 * clamp01(cloudLow / 100) + 0.4 * clamp01((rh850 - 50) / 50));
  const top = base + thickness;

  return {
    nightTemp: t2m,
    dewPoint: td,
    spread,
    lcl,
    base,
    thickness,
    top,
    cloudLow,
    rh850,
    /**
     * 低云覆盖率 > 25% 才算"成片低云"。
     * 12% 的散云不叫云海——天空通透，云块零散，看不到"海"。
     */
    hasLayer: cloudLow > 25,
    /** 有低云且云底在 3000 m 以下，才可能是肉眼可见的云海 */
    believable: cloudLow > 25 && base < 3200
  };
}

/* ---------------- 单日评估 ---------------- */

const num = (v, d = NaN) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * @param {object} day 日预报（含 soundings 真实层结）
 * @param {string} mode cloudsea | sunrise | stars
 * @param {object} ctx { mountain, source, dayIndex, moonIllum, calibration, cloudseaProb }
 */
export function assessDay(day, mode = 'cloudsea', ctx = {}) {
  const M = MODES[mode] || MODES.cloudsea;
  const mountain = ctx.mountain || { elevation: 600, name: '山顶', lat: 22.58, lon: 114.2 };
  const elevation = Number(mountain.elevation) || 600;

  const s = day.soundings || {};
  const geo = cloudGeometry(day);

  const cloud = num(day.cloud, 50);
  const cloudLow = geo.cloudLow;
  const cloudMid = num(s.cloudMid, cloud);
  const precip = num(day.precip, 0);
  const pop = num(day.pop, 0);
  const vis = num(day.vis, 12);
  const wind = num(day.windScale, 3);
  const ws850 = num(s.ws850, NaN);

  // 真实层结：拿不到高空数据时才退回代理估算，并在 factor 里说明
  const inv = inversionProfile({
    t2m: s.t2m,
    z2m: s.stationElevation,
    t925: s.t925,
    z925: s.z925,
    t850: s.t850,
    z850: s.z850
  });

  const hasSounding = inv.available;

  const factors = [];
  const add = (key, label, value, delta, detail) => {
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.06) return;
    factors.push({ key, label, value, delta, detail, tone: delta > 0 ? 'pro' : 'con' });
  };

  const cloudseaProb = ctx.cloudseaProb;

  if (mode === 'cloudsea') {
    // 云层相对山顶的位置——决定性判据
    const margin = elevation - geo.top;
    const above = clamp01(margin / 200); // 高出云顶越多越好
    const inCloud = clamp01((geo.top - elevation) / 350); // 云顶压过山顶 = 在雾里

    add(
      'cloudbase',
      '云层位置',
      geo.hasLayer ? `云顶约 ${Math.round(geo.top)} m` : '无低云',
      // 没有低云时，"云顶在山顶以下"是个假命题：压根没有云层，
      // 不能因为算出来的理论云顶低就加分。
      geo.hasLayer ? 2.4 * above - 2.2 * inCloud : -1.3,
      !geo.hasLayer
        ? `低云 ${Math.round(cloudLow)}%，天空没有成片低云；露点 ${geo.dewPoint.toFixed(1)} ℃ 算出的云底 ${Math.round(geo.base)} m 只是理论值`
        : margin >= 0
          ? `云底 ${Math.round(geo.base)} m、云顶约 ${Math.round(geo.top)} m，山顶在你脚下 ${Math.round(margin)} m`
          : `云顶高出山顶约 ${Math.round(-margin)} m，很可能身在雾中`
    );

    add(
      'cloudlow',
      '低云覆盖',
      `${Math.round(cloudLow)}%`,
      1.6 * (clamp01((cloudLow - 30) / 45) - 0.28),
      cloudLow < 20
        ? '低云太少且零散，天空通透，形不成"海"'
        : cloudLow < 45
          ? '低云零散，能否连片完全看运气'
          : cloudLow > 70
            ? '低云成片覆盖，具备成海的基本条件'
            : '低云达到成片量级'
    );

    add(
      'inversion',
      hasSounding ? '逆温（实算）' : '逆温（估算）',
      hasSounding ? `${inv.label}` : `${Math.round(inversionIndex({ dtr: Math.max(0, num(day.max, 0) - num(day.min, 0)), cloudNight: num(s.nightCloud, cloud), windScale: wind }) * 100)}%`,
      hasSounding ? 2.0 * (inv.index - 0.35) : 0.9 * (inversionIndex({ dtr: Math.max(0, num(day.max, 0) - num(day.min, 0)), cloudNight: num(s.nightCloud, cloud), windScale: wind }) - 0.35),
      hasSounding ? inv.note : '缺少高空层结数据，用夜间温差与风力的代理指标估计'
    );

    if (Number.isFinite(num(s.rh850))) {
      add(
        'moisture850',
        '850 hPa 水汽',
        `${Math.round(s.rh850)}%`,
        1.1 * clamp01((s.rh850 - 62) / 28),
        s.rh850 > 85 ? '约 1500 m 高度接近饱和，云层有充足水汽供给' : s.rh850 < 55 ? '中低层偏干，云层难以维持' : '水汽条件中等'
      );
    }

    add(
      'wind',
      '风力',
      `${Math.round(wind)} 级${Number.isFinite(ws850) ? ` · 850hPa ${ws850.toFixed(0)} m/s` : ''}`,
      -0.35 * Math.max(0, wind - 3) - (Number.isFinite(ws850) ? 0.3 * clamp01((ws850 - 8) / 10) : 0),
      wind >= 4 ? '地面风偏大，逆温层容易被搅散' : Number.isFinite(ws850) && ws850 > 12 ? '高空风速大，层状云会被撕开' : '风力温和，有利于层结稳定'
    );

    add(
      'precip',
      '降水',
      `${precip} mm`,
      -1.5 * clamp01(precip / 8) - 0.6 * clamp01((pop - 55) / 45),
      precip > 0 ? '当天有降水，云层结构不稳定' : '无明显降水'
    );

    add(
      'elevation',
      '海拔',
      `${elevation} m`,
      0.5 * clamp01((elevation - 400) / 800),
      elevation >= 850 ? '海拔够高，更容易穿出云层' : '海拔偏低，云顶经常与山顶齐平'
    );

    add(
      'vis',
      '能见度',
      `${vis} km`,
      0.25 * clamp01((vis - 8) / 15) - 0.3 * clamp01((6 - vis) / 6),
      vis < 5 ? '能见度低，可能是就地起雾而非云海' : '能见度正常'
    );
  }

  if (mode === 'sunrise') {
    const inCloud = clamp01((geo.top - elevation) / 300);
    const lowBlock = clamp01((cloudLow - 55) / 45); // 低云挡东方地平线
    // 出霞靠中高云：没有云只剩一个白点，云太厚则整片挡死
    const niceCloud = 1 - clamp01(Math.abs(cloudMid - 40) / 42);

    add(
      'cloudmid',
      '中云量',
      `${Math.round(cloudMid)}%`,
      0.85 * niceCloud - 1.1 * clamp01((cloudMid - 70) / 30) - 0.2,
      cloudMid > 85 ? '中云过厚，太阳大概率被挡' : cloudMid < 12 ? '天空太干净，缺少出霞的层次' : '中云量适中，霞光层次好'
    );
    add('cloudlow', '低云遮挡', `${Math.round(cloudLow)}%`, -1.3 * lowBlock, cloudLow > 70 ? '低云压住东方地平线，日出可能被挡在云下' : '低云不构成遮挡');
    add('cloudtop', '是否在云上', `${Math.round(geo.top)} m`, -1.1 * inCloud, inCloud > 0.5 ? '云顶高过山顶，可能在雾里等天亮' : '山顶在云层之上，视野通透');
    add(
      'precip',
      '降水',
      `${precip} mm / ${Math.round(pop)}%`,
      -1.5 * clamp01(precip / 6) - 0.7 * clamp01((pop - 40) / 60),
      precip > 0 ? '有降水，日出段可能被雨云遮挡' : '无降水干扰'
    );
    add('vis', '能见度', `${vis} km`, 0.6 * clamp01((vis - 8) / 15) - 0.4 * clamp01((7 - vis) / 7), vis < 6 ? '能见度差，远景发灰' : '能见度可支撑远景');
    add('wind', '风力', `${Math.round(wind)} 级`, -0.4 * clamp01((wind - 4) / 4), wind >= 6 ? '山顶风大，注意保暖与站稳' : '风力可接受');

    if (hasSounding) {
      add('inversion', '逆温（实算）', inv.label, 0.5 * (inv.index - 0.4), inv.note);
    }

    // 云海之上的日出是加分项：光线在云面上扩散，观感完全不同
    if (Number.isFinite(cloudseaProb) && cloudseaProb >= 55) {
      add('seabonus', '云海叠加', `${cloudseaProb}%`, 0.7, '云海概率较高，日出会打在云面上');
    }
  }

  if (mode === 'stars') {
    // 高云薄但会糊掉银河，低云则直接挡死，权重分开
    const highBlock = clamp01((num(s.cloudHigh, cloud) - 25) / 50);
    add('cloud', '总云量', `${cloud}%`, -1.7 * clamp01((cloud - 10) / 55) - 0.5 * highBlock, cloud > 60 ? '云量偏多，银河基本看不到' : '天空较为通透');
    add('cloudlow', '低云雾', `${Math.round(cloudLow)}%`, -0.9 * clamp01((cloudLow - 20) / 40), cloudLow > 60 ? '低云或雾压顶，星点被完全遮挡' : '低层无遮挡');
    add('precip', '降水', `${precip} mm`, -1.6 * clamp01(precip / 5) - 0.5 * clamp01((pop - 30) / 70), precip > 0 ? '有降水，不适合观星' : '无降水');
    add('humidity', '水汽', `${Math.round(num(s.rh850, geo.rh850))}%`, -0.9 * clamp01((num(s.rh850, geo.rh850) - 65) / 30), num(s.rh850, geo.rh850) > 85 ? '中低层水汽重，星光被散射变暗' : '空气干爽，星点清晰');
    const moon = clamp01(ctx.moonIllum ?? 0);
    add('moon', '月光干扰', `${Math.round(moon * 100)}%`, -0.6 * moon, moon > 0.6 ? '接近满月，暗弱天体被压制' : '月光干扰小');
    add('vis', '能见度', `${vis} km`, 0.5 * clamp01((vis - 12) / 16), vis < 10 ? '能见度一般，地平附近星点稀少' : '通透度好');
    add('wind', '风力', `${Math.round(wind)} 级`, -0.3 * clamp01((wind - 3) / 4), wind >= 5 ? '风大，长曝光会抖' : '风力平稳');
  }

  const delta = factors.reduce((sum, f) => sum + f.delta, 0);
  const month = (day.dateObj instanceof Date ? day.dateObj : new Date()).getMonth();
  const prior = M.prior[month] ?? 0.15;
  const calibOffset = Number(ctx.calibration?.offset) || 0;

  let probability = sigmoid(logit(prior) + delta + calibOffset);
  probability = clamp(probability, 0.02, 0.96);
  const prob = Math.round(probability * 100);

  const sorted = [...factors].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    probability: prob,
    baseRate: Math.round(prior * 100),
    grade: gradeOf(prob),
    factors: sorted,
    pros: sorted.filter((f) => f.tone === 'pro').slice(0, 3),
    cons: sorted.filter((f) => f.tone === 'con').slice(0, 3),
    confidence: confidenceOf({ ...ctx, hasSounding }),
    calibration: ctx.calibration || { offset: 0, n: 0 },
    geometry: geo,
    inversion: inv,
    sounding: s,
    verdict: verdictOf(prob),
    mode
  };
}

/* ---------------- 分级与措辞 ---------------- */

export function gradeOf(prob) {
  if (prob >= 72) return { label: '值得去', tone: 'great' };
  if (prob >= 55) return { label: '可以赌', tone: 'good' };
  if (prob >= 38) return { label: '看运气', tone: 'fair' };
  if (prob >= 22) return { label: '别抱期待', tone: 'poor' };
  return { label: '建议改期', tone: 'bad' };
}

export function verdictOf(prob) {
  if (prob >= 72) return '大概率能看到';
  if (prob >= 55) return '有一半以上把握';
  if (prob >= 38) return '要看运气';
  if (prob >= 22) return '机会不大';
  return '不值得专程跑一趟';
}

/**
 * 置信度：预报时效越远越不确定；缺高空层结时再降一档
 */
export function confidenceOf(ctx = {}) {
  const lag = Number(ctx.dayIndex) || 0;
  let score = 0.82 - lag * 0.07;
  if (ctx.hasSounding === false) score -= 0.14; // 没有 850 hPa 数据，逆温只能估
  const n = Number(ctx.calibration?.n) || 0;
  score += Math.min(0.1, n * 0.012);
  score = clamp(score, 0.15, 0.95);

  const label = score >= 0.72 ? '高' : score >= 0.5 ? '中' : '低';
  const hint =
    ctx.hasSounding === false
      ? '缺少高空层结数据，逆温为估算值'
      : lag >= 4
        ? '预报时效较远，临出发前一天请再看一次'
        : n < 3
          ? '本地样本不足，尚未校准'
          : '已结合你的历史反馈校正';

  return { score: Math.round(score * 100), label, hint };
}

/* ---------------- 多日排序 ---------------- */

export function rankDays(daily = [], mode = 'cloudsea', ctx = {}) {
  if (!daily.length) return { all: [], ranked: [], best: null };

  const seaProbs = daily.map((d, i) => assessDay(d, 'cloudsea', { ...ctx, dayIndex: i, cloudseaProb: undefined }).probability);

  const all = daily.map((day, i) =>
    Object.assign(
      assessDay(day, mode, { ...ctx, dayIndex: i, cloudseaProb: mode === 'cloudsea' ? seaProbs[i] : seaProbs[i] }),
      { day, index: i }
    )
  );

  const ranked = [...all].sort((a, b) => b.probability - a.probability);
  return { all, ranked, best: ranked[0] || null };
}

/* ---------------- 人话建议 ---------------- */

const fmtHM = (d) =>
  d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '--:--';

const dateLabel = (day) => {
  const d = day.dateObj instanceof Date ? day.dateObj : new Date(day.date);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};

/** 相对日期标签：今天 / 明天 / 后天 / 周几 */
export function relativeDay(index, day) {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  if (index === 2) return '后天';
  const d = day?.dateObj instanceof Date ? day.dateObj : new Date(day?.date || Date.now());
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] || dateLabel(day || {});
}

/** 山顶温度估算：干绝热递减率取 0.6 ℃/100 m */
export function summitTemp(day, elevation) {
  const base = (Number(day.max) + Number(day.min)) / 2;
  if (!Number.isFinite(base)) return null;
  const stationBase = 30;
  return Math.round(base - ((elevation - stationBase) / 100) * 0.6);
}

/**
 * 生成一句可以直接照着执行的建议
 * 刻意包含：具体日期 + 具体时间 + 具体坡向 + 概率 + 体感准备
 */
export function advice(best, mode = 'cloudsea', mountain = {}) {
  if (!best) return '暂无预报数据。';

  const d = best.day;
  const dateObj = d.dateObj instanceof Date ? d.dateObj : new Date(d.date);
  const lat = mountain.lat ?? 22.58;
  const lon = mountain.lon ?? 114.2;
  const sun = sunTimes(dateObj, lat, lon);
  const az = sunriseAzimuth(dateObj, lat);
  const slope = facingSlopeLabel(az);
  const place = mountain.name || '山顶';
  const temp = summitTemp(d, mountain.elevation || 600);

  if (mode === 'stars') {
    const moon = Math.round((best.moonIllum ?? 0) * 100);
    return `${dateLabel(d)} 天黑后，${place}看到星空概率 ${best.probability}%（月光亮度 ${moon}%）。山顶气温约 ${temp} ℃，比市区低 4—6 ℃，记得带保暖层和头灯。`;
  }

  const time = fmtHM(sun.sunrise);
  const action =
    best.probability >= 72
      ? `值得为它早起。建议 ${fmtHM(new Date(sun.sunrise.getTime() - 90 * 60000))} 前从山脚出发`
      : best.probability >= 55
        ? `可以去，但留个 B 计划。${fmtHM(new Date(sun.sunrise.getTime() - 90 * 60000))} 前上山`
        : `如果本来就要上山，可以顺手看一眼；不建议专程跑`;

  return `${dateLabel(d)} ${time} 前后，${place}${slope}，看到${MODES[mode].name}概率 ${best.probability}%。${action}。山顶约 ${temp} ℃，带一件防风外套。`;
}

/** 光照窗口 */
export function lightWindow(sun, mode = 'sunrise') {
  if (!sun) return '--';
  const base = mode === 'sunrise' ? sun.sunrise : sun.sunset;
  if (!base) return '--';
  const start = new Date(base.getTime() - 30 * 60000);
  const end = new Date(base.getTime() + 20 * 60000);
  return `${fmtHM(start)} — ${fmtHM(end)}`;
}

/* ---------------- 没看到的时候 ---------------- */

/**
 * 补偿机制：竞品在这里沉默或道歉，这里给下一个窗口。
 * 这是整个产品情绪价值最高的一句话。
 */
export function compensation({ all = [], mode = 'cloudsea', todayProb }) {
  if (!all.length) return null;
  const today = Number.isFinite(todayProb) ? todayProb : all[0].probability;
  const next = all.find((r, i) => i > 0 && r.probability >= Math.max(55, today + 15));

  if (!next) {
    return {
      tone: 'consoling',
      text: `未来一周${MODES[mode].name}的机会都不好，最高只有 ${Math.max(...all.map((a) => a.probability))}%。这次别硬上，把体力留给下一次。`,
      target: null
    };
  }

  const gap = next.index;
  return {
    tone: 'hopeful',
    text: `这次没等到不怪你。${gap} 天后（${dateLabel(next.day)}）有 ${next.probability}% 的窗口，比今天高 ${next.probability - today} 个百分点。到那天我会提前提醒你。`,
    target: next
  };
}

export { dateLabel, fmtHM };
