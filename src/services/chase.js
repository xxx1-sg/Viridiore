/**
 * 追光：把 7 日预报折算成"能不能看到"的概率
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
 * 3. 每一项加减都有物理含义，可被反驳。
 *    核心判据是"云层在你脚下吗"——用抬升凝结高度算云底，加厚度得云顶，
 *    再和山顶海拔比。这套东西比"湿度 85% 就给高分"靠谱，也解释得清。
 *
 * 已知局限（写在这里而不是藏起来）：
 *   · 850 hPa 湿度、风速垂直切变需要探空资料，免费 API 拿不到，
 *     逆温强度只能用昼夜温差 + 夜间云量 + 风力做代理估算；
 *   · 山谷实际地形起伏未建模，用固定基准海拔近似；
 *   · 先验是经验值，不是本地气候统计年鉴，所以必须靠用户反馈校准。
 */
import {
  dewSpread,
  cloudBaseAltitude,
  inversionIndex,
  estimatePop,
  windScaleNum,
  clamp01,
  clamp,
  sigmoid,
  logit
} from './atmos.js';
import { sunTimes, sunriseAzimuth, facingSlopeLabel } from './sun.js';

const VALLEY_ELEVATION = 25; // 深圳/惠州山脚基准海拔（m）
const STATION_ELEVATION = 30; // 天气数据测站海拔（m）

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
 * 由夜间温湿推算云层位置
 * 云底 = 测站海拔 + LCL；云顶 = 云底 + 厚度（厚度随水汽增长）
 */
export function cloudGeometry(day) {
  const nightTemp = Number(day.min ?? day.tempNight ?? 18);
  const rh = Number(day.humidity ?? 70);
  const spread = dewSpread(nightTemp, rh);
  const base = cloudBaseAltitude(nightTemp, rh, STATION_ELEVATION);
  const moist = clamp01((rh - 68) / 30);
  const thickness = 220 + 620 * moist;
  return {
    nightTemp,
    rh,
    spread,
    base,
    thickness,
    top: base + thickness,
    moist,
    dewPoint: nightTemp - spread
  };
}

/* ---------------- 单日评估 ---------------- */

/**
 * @param {object} day 日预报
 * @param {string} mode cloudsea | sunrise | stars
 * @param {object} ctx { mountain, source, dayIndex, moonIllum, calibration, cloudseaProb }
 */
export function assessDay(day, mode = 'cloudsea', ctx = {}) {
  const M = MODES[mode] || MODES.cloudsea;
  const mountain = ctx.mountain || { elevation: 600, name: '山顶', lat: 22.58, lon: 114.2 };
  const elevation = Number(mountain.elevation) || 600;

  const geo = cloudGeometry(day);
  const cloud = Number(day.cloud ?? 50);
  const precip = Number(day.precip) || 0;
  const pop = Number.isFinite(Number(day.pop)) ? Number(day.pop) : estimatePop(day);
  const vis = Number(day.vis ?? 12);
  const wind = windScaleNum(day.windScale);
  const dtr = Math.max(0, Number(day.max ?? 0) - Number(day.min ?? 0));
  const inversion = inversionIndex({ dtr, cloudNight: cloud, windScale: wind });

  const factors = [];
  const add = (key, label, value, delta, detail) => {
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.06) return;
    factors.push({ key, label, value, delta, detail, tone: delta > 0 ? 'pro' : 'con' });
  };

  let cloudseaProb = ctx.cloudseaProb;

  if (mode === 'cloudsea') {
    // 云层相对山顶的位置——决定性判据
    const margin = elevation - geo.top;
    const above = clamp01(margin / 200); // 高出云顶越多越好
    const inCloud = clamp01((geo.top - elevation) / 350); // 云顶压过山顶 = 雾里
    const hasLayer = clamp01((geo.top - VALLEY_ELEVATION) / 300); // 山谷里确实有云

    add(
      'cloudbase',
      '云层位置',
      `云顶约 ${Math.round(geo.top)} m`,
      2.3 * above * hasLayer - 2.0 * inCloud,
      margin >= 0
        ? `云顶在山顶以下约 ${Math.round(margin)} m，你站的位置在云上`
        : `云顶高出山顶约 ${Math.round(-margin)} m，很可能身在雾中`
    );
    add('clouddepth', '云层厚度', `${Math.round(geo.thickness)} m`, 0.8 * (hasLayer - 0.4), hasLayer > 0.6 ? '云层有足够厚度，能成"海"' : '云层太薄，形不成规模');
    add('moisture', '近地水汽', `${Math.round(geo.rh)}%`, 1.1 * clamp01((geo.rh - 78) / 18), `露点 ${geo.dewPoint.toFixed(1)} ℃，温度露点差 ${geo.spread.toFixed(1)} ℃`);
    add('inversion', '逆温估算', `${Math.round(inversion * 100)}%`, 1.1 * (inversion - 0.35), '由昼夜温差、夜间云量、风力合成，非探空实测');
    add('wind', '风力', `${wind} 级`, -0.35 * Math.max(0, wind - 3), wind >= 4 ? '风偏大，逆温层容易被搅散' : '风力温和，有利于层结稳定');
    add('precip', '降水', `${precip} mm`, -1.5 * clamp01(precip / 8) - 0.6 * clamp01((pop - 55) / 45), precip > 0 ? '当天有降水，云层结构不稳定' : '无明显降水');
    add('elevation', '海拔', `${elevation} m`, 0.5 * clamp01((elevation - 400) / 800), elevation >= 850 ? '海拔够高，更容易穿出云层' : '海拔偏低，云顶经常与山顶齐平');
    add('vis', '能见度', `${vis} km`, 0.25 * clamp01((vis - 8) / 15) - 0.3 * clamp01((6 - vis) / 6), vis < 5 ? '能见度低，可能是就地起雾而非云海' : '能见度正常');
  }

  if (mode === 'sunrise') {
    const inCloud = clamp01((geo.top - elevation) / 300);
    const overcast = clamp01((cloud - 58) / 40);
    const niceCloud = 1 - clamp01(Math.abs(cloud - 38) / 42); // 20—55% 云量出霞最好

    add('cloudcover', '总云量', `${cloud}%`, -1.3 * overcast + 0.75 * niceCloud - 0.15, cloud > 85 ? '云层过厚，太阳大概率被挡' : cloud < 12 ? '天空太干净，缺少出霞的层次' : '云量适中，霞光层次好');
    add('cloudtop', '是否在云上', `${Math.round(geo.top)} m`, -1.1 * inCloud, inCloud > 0.5 ? '云顶高过山顶，可能在雾里等天亮' : '山顶在云层之上，视野通透');
    add('precip', '降水', `${precip} mm / ${Math.round(pop)}%`, -1.5 * clamp01(precip / 6) - 0.7 * clamp01((pop - 40) / 60), precip > 0 ? '有降水，日出段可能被雨云遮挡' : '无降水干扰');
    add('vis', '能见度', `${vis} km`, 0.6 * clamp01((vis - 8) / 15) - 0.4 * clamp01((7 - vis) / 7), vis < 6 ? '能见度差，远景发灰' : '能见度可支撑远景');
    add('wind', '风力', `${wind} 级`, -0.4 * clamp01((wind - 4) / 4), wind >= 6 ? '山顶风大，注意保暖与站稳' : '风力可接受');

    // 云海之上的日出是加分项：光线在云面上扩散，观感完全不同
    if (Number.isFinite(cloudseaProb) && cloudseaProb >= 55) {
      add('seabonus', '云海叠加', `${cloudseaProb}%`, 0.7, '云海概率较高，日出会打在云面上');
    }
  }

  if (mode === 'stars') {
    add('cloud', '总云量', `${cloud}%`, -2.0 * clamp01((cloud - 10) / 55), cloud > 60 ? '云量偏多，银河基本看不到' : '天空较为通透');
    add('precip', '降水', `${precip} mm`, -1.6 * clamp01(precip / 5) - 0.5 * clamp01((pop - 30) / 70), precip > 0 ? '有降水，不适合观星' : '无降水');
    add('humidity', '水汽', `${Math.round(geo.rh)}%`, -0.9 * clamp01((geo.rh - 68) / 26), geo.rh > 85 ? '水汽重，星光被散射变暗' : '空气干爽，星点清晰');
    const moon = clamp01(ctx.moonIllum ?? 0);
    add('moon', '月光干扰', `${Math.round(moon * 100)}%`, -0.6 * moon, moon > 0.6 ? '接近满月，暗弱天体被压制' : '月光干扰小');
    add('vis', '能见度', `${vis} km`, 0.5 * clamp01((vis - 12) / 16), vis < 10 ? '能见度一般，地平附近星点稀少' : '通透度好');
    add('wind', '风力', `${wind} 级`, -0.3 * clamp01((wind - 3) / 4), wind >= 5 ? '风大，长曝光会抖' : '风力平稳');
  }

  const delta = factors.reduce((s, f) => s + f.delta, 0);
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
    confidence: confidenceOf(ctx),
    calibration: ctx.calibration || { offset: 0, n: 0 },
    geometry: geo,
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
 * 置信度：预报时效越远越不确定；演示数据一律低置信
 */
export function confidenceOf(ctx = {}) {
  const lag = Number(ctx.dayIndex) || 0;
  let score = 0.88 - lag * 0.065;
  if (ctx.source === 'demo') score = Math.min(score, 0.4);
  const n = Number(ctx.calibration?.n) || 0;
  score += Math.min(0.1, n * 0.012);
  score = clamp(score, 0.15, 0.95);

  const label = score >= 0.72 ? '高' : score >= 0.5 ? '中' : '低';
  const hint =
    ctx.source === 'demo'
      ? '当前是演示数据，概率只用于展示模型行为'
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
