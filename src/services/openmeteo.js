/**
 * Open-Meteo 实时预报客户端
 *
 * 为什么换到这里：
 * 原来必须填和风天气 Key 才能拿到真实数据，没填就回退演示数据——一个预测工具
 * 拿假数据算概率，等于没有预测。Open-Meteo 不需要注册、不需要 Key、没有额度限制，
 * 而且提供**气压层数据**（850 / 925 / 700 hPa 的温度、湿度、位势高度），
 * 这直接决定了追光模型能算到什么程度：
 *
 *   · 逆温不再是"昼夜温差 + 云量"的代理估算，而是用 850 hPa 与地面的
 *     实际温度直减率判定——温度随高度升高就是逆温，这是可以手算复核的事实；
 *   · 逆温层的高度由 925 / 850 hPa 的位势高度给出，不再是拍一个 300 m；
 *   · 云底高度用 API 直接给的露点（不是由湿度反解）+ LCL 公式算；
 *   · 低云 / 中云 / 高云分层数据用来判断"云在你脚下"还是"你在云里"。
 *
 * 数据来源：ECMWF / GFS / ICON 的集合最优匹配（best_match），
 * 逐小时、7 天，时区固定 Asia/Shanghai。
 * 文档：https://open-meteo.com/en/docs
 */

import { sunTimes, moonPhase, moonPhaseName, moonIllumination } from './sun.js';
import { computeAqi } from './aqi.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const TIMEOUT = 12000;
const TIMEZONE = 'Asia/Shanghai';

/** 需要的逐小时变量。气压层那几项是追光模型的核心，不是装饰。 */
const HOURLY = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'visibility',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'pressure_msl',
  'weather_code',
  'uv_index',
  'temperature_925hPa',
  'relative_humidity_925hPa',
  'geopotential_height_925hPa',
  'temperature_850hPa',
  'relative_humidity_850hPa',
  'geopotential_height_850hPa',
  'wind_speed_850hPa'
];

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
  'uv_index_max'
];

/**
 * 实况块。**这是"现在"唯一正确的来源。**
 *
 * 早先版本从 hourly 里挑最近的一个整点当作"现在"，于是 09:40 显示的其实是
 * 09:00 的预报值——温度差 1℃、湿度差 7%、体感差 2℃，和手机自带天气一比
 * 处处对不上，用户会直接判定数据是编的。
 *
 * current 的 interval 是 900 秒（15 分钟插值），才是真正贴着观测时次的实况。
 */
const CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'cloud_cover_low',
  'pressure_msl',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'visibility'
];

export class MeteoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'MeteoError';
    this.code = code;
  }
}

/* ---------------- 基础工具 ---------------- */

/**
 * Open-Meteo 在指定时区下返回的是不带时区后缀的本地时间字符串，
 * 直接 `new Date()` 会被设备时区二次偏移，所以手动拆字段构造本地时间。
 */
function parseLocal(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '--:--');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 平均值，自动跳过 null / NaN（高空变量偶有缺测） */
function avg(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return NaN;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const round = (v, d = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Number(n.toFixed(d));
};

/* ---------------- 风 ---------------- */

/** 蒲福风级阈值（m/s 上限），用来把风速换成"几级风" */
const BEAUFORT_MS = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];

export function beaufort(ms) {
  const v = Number(ms);
  if (!Number.isFinite(v)) return '--';
  let level = 0;
  while (level < BEAUFORT_MS.length && v >= BEAUFORT_MS[level]) level += 1;
  return String(level);
}

const DIRS = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];

export function windDirText(deg) {
  const d = Number(deg);
  if (!Number.isFinite(d)) return '--';
  return DIRS[Math.round(((d % 360) + 360) % 360 / 45) % 8];
}

/* ---------------- WMO 天气代码 → 和风 code ---------------- */

/**
 * Open-Meteo 用 WMO 代码（0—99），UI 的图标与文案体系是按和风 code 写的。
 * 这里做一次映射，避免改动整套图标组件。
 */
const WMO_TO_QW = {
  0: 100,
  1: 102,
  2: 103,
  3: 104,
  45: 501,
  48: 509,
  51: 309,
  53: 309,
  55: 305,
  56: 313,
  57: 313,
  61: 305,
  63: 306,
  65: 307,
  66: 313,
  67: 313,
  71: 400,
  73: 401,
  75: 402,
  77: 499,
  80: 300,
  81: 301,
  82: 307,
  85: 407,
  86: 409,
  95: 302,
  96: 304,
  99: 304
};

function qwCode(wmo, isNight = false) {
  const base = WMO_TO_QW[Number(wmo)] ?? 104;
  if (isNight) {
    if (base === 100) return 150;
    if (base === 102) return 151;
    if (base === 103) return 153;
  }
  return base;
}

/* ---------------- 网络 ---------------- */

async function getJson(url, params) {
  const u = new URL(url);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(u.toString(), { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new MeteoError(`天气接口返回 ${res.status}`, `HTTP_${res.status}`);
    const data = await res.json();
    if (data?.error) throw new MeteoError(data.reason || '天气接口返回错误', 'API_ERROR');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new MeteoError('天气接口超时，请检查网络后重试', 'TIMEOUT');
    if (err instanceof MeteoError) throw err;
    throw new MeteoError(err.message || '网络不可达', 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 质量指标（真实数据派生） ---------------- */

/**
 * 生活指数：由实时温湿风云推导，不是外部给的"指数"。
 * 放在这里而不是页面里，是因为它和可视化用的是同一组数。
 */
function deriveIndices({ temp, humidity, cloud, uv, precip, windScale }) {
  const rainy = Number(precip) > 0.2;
  const hot = Number(temp) >= 30;
  const windy = Number(windScale) >= 6;

  const sport = rainy
    ? { category: '不宜', text: '有降水，山路湿滑，建议改期或走铺装路线。' }
    : hot
      ? { category: '较不宜', text: '气温偏高，注意补水与避晒，建议清晨出发。' }
      : windy
        ? { category: '较不宜', text: '风力偏大，山脊线注意站稳。' }
        : { category: '适宜', text: '天气条件适合徒步，注意山顶温差。' };

  const dressing = hot
    ? { category: '炎热', text: '短袖速干衣裤，带足饮水与防晒。' }
    : Number(temp) >= 22
      ? { category: '舒适', text: '长袖速干衣，包里放一件薄外套。' }
      : Number(temp) >= 15
        ? { category: '较凉', text: '建议抓绒 + 防风层，山顶风冷。' }
        : { category: '冷', text: '需要保暖层与防风外壳，注意失温。' };

  const uvCat = Number(uv) >= 8 ? '很强' : Number(uv) >= 6 ? '强' : Number(uv) >= 3 ? '中等' : '弱';
  const uvText =
    Number(uv) >= 6
      ? `UV ${round(uv, 1)}，山顶紫外线比市区更强，防晒别省。`
      : `UV ${round(uv, 1)}，基础防晒即可。`;

  return [
    { type: '1', name: '运动指数', ...sport },
    { type: '2', name: '穿衣指数', ...dressing },
    { type: '3', name: '紫外线', category: uvCat, text: uvText },
    { type: '6', name: '旅游指数', category: rainy ? '一般' : '适宜', text: rainy ? '降水会影响观景与路况。' : '适合出行，留意山区天气变化。' },
    { type: '9', name: '过敏指数', category: Number(humidity) > 80 ? '易发' : '不易发', text: Number(humidity) > 80 ? '湿度大，霉菌孢子活跃。' : '过敏风险较低。' }
  ];
}

/* ---------------- 主入口 ---------------- */

/**
 * 拉取真实预报，归一化为页面层使用的结构。
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} placeName
 * @returns {Promise<object>} 与和风 normalize() 同构，外加 soundings（层结数据）
 */
export async function fetchOpenMeteo(lat, lon, placeName = '当前位置') {
  const [forecast, air] = await Promise.all([
    getJson(FORECAST_URL, {
      latitude: Number(lat).toFixed(4),
      longitude: Number(lon).toFixed(4),
      current: CURRENT.join(','),
      hourly: HOURLY.join(','),
      daily: DAILY.join(','),
      timezone: TIMEZONE,
      forecast_days: 7,
      wind_speed_unit: 'ms',
      precipitation_unit: 'mm'
    }),
    getJson(AIR_URL, {
      latitude: Number(lat).toFixed(4),
      longitude: Number(lon).toFixed(4),
      // 六项污染物：用来按国标算 AQI，而不是拿欧洲 EAQI 冒充
      current: 'pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
      timezone: TIMEZONE,
      forecast_days: 1
    }).catch(() => null) // 空气质量是补充项，失败不影响主流程
  ]);

  const h = forecast.hourly || {};
  const d = forecast.daily || {};
  const stationElevation = Number(forecast.elevation);
  const times = (h.time || []).map(parseLocal);
  const now = new Date();

  /* ---- 逐小时序号索引 ---- */
  const idxOf = (key) => (h[key] || []).map((v) => (Number.isFinite(v) ? Number(v) : NaN));

  const series = {
    temp: idxOf('temperature_2m'),
    rh: idxOf('relative_humidity_2m'),
    dew: idxOf('dew_point_2m'),
    feels: idxOf('apparent_temperature'),
    precip: idxOf('precipitation'),
    pop: idxOf('precipitation_probability'),
    cloud: idxOf('cloud_cover'),
    cloudLow: idxOf('cloud_cover_low'),
    cloudMid: idxOf('cloud_cover_mid'),
    cloudHigh: idxOf('cloud_cover_high'),
    vis: idxOf('visibility'),
    wind: idxOf('wind_speed_10m'),
    windDir: idxOf('wind_direction_10m'),
    gust: idxOf('wind_gusts_10m'),
    pressure: idxOf('pressure_msl'),
    code: h.weather_code || [],
    uv: idxOf('uv_index'),
    t925: idxOf('temperature_925hPa'),
    rh925: idxOf('relative_humidity_925hPa'),
    z925: idxOf('geopotential_height_925hPa'),
    t850: idxOf('temperature_850hPa'),
    rh850: idxOf('relative_humidity_850hPa'),
    z850: idxOf('geopotential_height_850hPa'),
    ws850: idxOf('wind_speed_850hPa')
  };

  const at = (arr, i) => (Number.isFinite(arr?.[i]) ? arr[i] : NaN);

  /* ---- 当前时刻 ---- */
  // nowIdx 只用来定位逐小时列表的起点与观测窗口，不再代表"现在"。
  // "现在"一律取自 current 块（15 分钟插值），否则会和手机自带的天气对不上。
  let nowIdx = times.findIndex((t) => t && t >= new Date(now.getTime() - 30 * 60e3));
  if (nowIdx < 0) nowIdx = 0;

  const cur = forecast.current || {};

  /** 优先取 current 实况，接口偶尔不返回时退回最近整点 */
  const live = (key, fallback, digits = 0) => {
    const v = Number(cur[key]);
    if (Number.isFinite(v)) return round(v, digits);
    const f = Number(fallback);
    return Number.isFinite(f) ? round(f, digits) : fallback;
  };

  // is_day 比"早 6 点晚 19 点"准，冬夏日出时间差一个多小时
  const isDayNow = Number(cur.is_day) === 1;

  const pNow = Number(cur.pressure_msl);
  // 严格 3 小时变压：拿两个整点值相减，不用 09:30 去减 06:00
  const pHourly = at(series.pressure, nowIdx);
  const p3hAgo = nowIdx >= 3 ? at(series.pressure, nowIdx - 3) : NaN;
  const pDelta = Number.isFinite(pHourly) && Number.isFinite(p3hAgo) ? round(pHourly - p3hAgo, 1) : null;

  const nowBlock = {
    temp: live('temperature_2m', at(series.temp, nowIdx)),
    feels: live('apparent_temperature', at(series.feels, nowIdx)),
    text: '',
    code: qwCode(live('weather_code', at(series.code, nowIdx)), !isDayNow),
    humidity: live('relative_humidity_2m', at(series.rh, nowIdx)),
    windDir: windDirText(live('wind_direction_10m', at(series.windDir, nowIdx))),
    windSpeed: String(live('wind_speed_10m', at(series.wind, nowIdx), 1)),
    windScale: beaufort(live('wind_speed_10m', at(series.wind, nowIdx), 1)),
    /** 海平面气压。本站气压受海拔影响，同一城市不同海拔没法比，所以主显海平面 */
    pressure: String(live('pressure_msl', at(series.pressure, nowIdx))),
    /** 本站气压，留给数据说明区对照 */
    pressureStation: Number.isFinite(Number(cur.surface_pressure)) ? String(round(cur.surface_pressure)) : null,
    /** 3 小时变压，negative = 下降 */
    pressureDelta: pDelta,
    vis: String(round(live('visibility', at(series.vis, nowIdx)) / 1000, 1)),
    visMeters: live('visibility', at(series.vis, nowIdx)),
    cloud: String(live('cloud_cover', at(series.cloud, nowIdx))),
    dew: String(live('dew_point_2m', at(series.dew, nowIdx), 1)),
    precip: String(live('precipitation', at(series.precip, nowIdx), 1)),
    gust: String(live('wind_gusts_10m', at(series.gust, nowIdx), 1)),
    isDay: isDayNow,
    /** 实况时次，用于界面上标"实况 09:30" */
    observedAt: parseLocal(cur.time) || now
  };

  /* ---- 未来 24 小时 ---- */
  const hourly = [];
  for (let i = nowIdx; i < Math.min(nowIdx + 24, times.length); i++) {
    const t = times[i];
    if (!t) continue;
    const isNight = t.getHours() < 6 || t.getHours() >= 19;
    // 第一格标「现在」，用实况覆盖整点预报，否则这一格会比实际高一两度
    const isNow = hourly.length === 0;
    hourly.push({
      time: t,
      temp: isNow ? nowBlock.temp : round(at(series.temp, i)),
      code: isNow ? nowBlock.code : qwCode(at(series.code, i), isNight),
      pop: round(at(series.pop, i)),
      windScale: isNow ? Number(nowBlock.windScale) || 0 : Number(beaufort(at(series.wind, i))) || 0,
      windSpeed: round(at(series.wind, i), 1),
      windDir: windDirText(at(series.windDir, i)),
      humidity: round(at(series.rh, i)),
      uv: round(at(series.uv, i), 1),
      precip: round(at(series.precip, i), 1)
    });
  }

  /* ---- 逐日聚合：核心是观测窗口内的层结 ---- */
  const daily = [];
  const dates = (d.time || []).map((s) => String(s).slice(0, 10));

  dates.forEach((dateStr, di) => {
    const sunrise = parseLocal(d.sunrise?.[di]);
    const sunset = parseLocal(d.sunset?.[di]);

    // 本日 00:00 — 23:59 的逐小时序号
    const dayIdx = [];
    times.forEach((t, i) => {
      if (t && ymd(t) === dateStr) dayIdx.push(i);
    });

    // 观测窗口：日出前 90 分钟 到 日出后 30 分钟。
    // 云海与晨光都发生在这段时间，日平均会把关键信息抹平。
    const windowIdx = sunrise
      ? dayIdx.filter((i) => {
          const t = times[i];
          return t >= new Date(sunrise.getTime() - 90 * 60e3) && t <= new Date(sunrise.getTime() + 30 * 60e3);
        })
      : dayIdx.slice(4, 8);

    const obsIdx = windowIdx.length ? windowIdx : dayIdx.slice(4, 8);

    // 夜间（20:00 — 次日 06:00）用于辐射降温与逆温判断
    const nightIdx = dayIdx.filter((i) => times[i].getHours() <= 6 || times[i].getHours() >= 20);

    const pick = (arr, list) => list.map((i) => at(arr, i));

    const soundings = {
      /** 观测窗口平均的近地面要素 */
      t2m: round(avg(pick(series.temp, obsIdx)), 1),
      td2m: round(avg(pick(series.dew, obsIdx)), 1),
      rh2m: round(avg(pick(series.rh, obsIdx)), 0),
      cloudLow: round(avg(pick(series.cloudLow, obsIdx)), 0),
      cloudMid: round(avg(pick(series.cloudMid, obsIdx)), 0),
      cloudHigh: round(avg(pick(series.cloudHigh, obsIdx)), 0),
      ws10: round(avg(pick(series.wind, obsIdx)), 1),
      /** 925 hPa（约 750 m）与 850 hPa（约 1500 m）的实际层结 */
      z925: round(avg(pick(series.z925, obsIdx)), 0),
      t925: round(avg(pick(series.t925, obsIdx)), 1),
      rh925: round(avg(pick(series.rh925, obsIdx)), 0),
      z850: round(avg(pick(series.z850, obsIdx)), 0),
      t850: round(avg(pick(series.t850, obsIdx)), 1),
      rh850: round(avg(pick(series.rh850, obsIdx)), 0),
      ws850: round(avg(pick(series.ws850, obsIdx)), 1),
      /** 夜间平均云量，用于判断辐射降温能不能发生 */
      nightCloud: round(avg(pick(series.cloud, nightIdx)), 0),
      nightWind: round(avg(pick(series.wind, nightIdx)), 1),
      stationElevation: round(stationElevation)
    };

    const windowCloud = avg(pick(series.cloud, obsIdx));
    const windowVis = avg(pick(series.vis, obsIdx));

    // 逐日 UV 与降水概率必须取全天极值。
    // 用日出窗口平均会得到 UV = 0（那时太阳还没升起来），是错的。
    const uvMax = Number(d.uv_index_max?.[di]);
    const popMax = Number(d.precipitation_probability_max?.[di]);

    // 日最高/最低：daily 接口偶尔缺测，用逐小时极值兜底，避免界面出现 NaN
    const dayTemps = pick(series.temp, dayIdx).filter(Number.isFinite);
    const maxRaw = Number(d.temperature_2m_max?.[di]);
    const minRaw = Number(d.temperature_2m_min?.[di]);

    daily.push({
      date: dateStr,
      dateObj: new Date(`${dateStr}T12:00:00`),
      max: Number.isFinite(maxRaw) ? round(maxRaw) : dayTemps.length ? round(Math.max(...dayTemps)) : null,
      min: Number.isFinite(minRaw) ? round(minRaw) : dayTemps.length ? round(Math.min(...dayTemps)) : null,
      tempNight: (() => {
        const list = (nightIdx.length ? pick(series.temp, nightIdx) : [at(series.temp, dayIdx[0])]).filter(Number.isFinite);
        if (list.length) return round(Math.min(...list));
        const fallback = Number(d.temperature_2m_min?.[di]);
        return Number.isFinite(fallback) ? round(fallback) : null;
      })(),
      codeDay: qwCode(d.weather_code?.[di], false),
      textDay: '',
      codeNight: qwCode(d.weather_code?.[di], true),
      textNight: '',
      pop: Number.isFinite(popMax) ? round(popMax) : round(avg(pick(series.pop, dayIdx))),
      precip: String(round(d.precipitation_sum?.[di], 1)),
      humidity: soundings.rh2m,
      windDir: windDirText(d.wind_direction_10m_dominant?.[di]),
      windScale: beaufort(d.wind_speed_10m_max?.[di]),
      uv: Number.isFinite(uvMax) ? round(uvMax, 1) : round(avg(pick(series.uv, dayIdx)), 1),
      cloud: round(windowCloud),
      vis: round(windowVis / 1000, 1),
      sunrise: hhmm(sunrise),
      sunset: hhmm(sunset),
      /** 逐日层结：追光模型直接消费这份数据 */
      soundings
    });
  });

  /* ---- 空气质量：按中国国标自算，不用欧洲 EAQI ---- */
  let airBlock = null;
  const ac = air?.current;
  if (ac) {
    const computed = computeAqi({
      pm25: Number(ac.pm2_5),
      pm10: Number(ac.pm10),
      so2: Number(ac.sulphur_dioxide),
      no2: Number(ac.nitrogen_dioxide),
      co: Number(ac.carbon_monoxide),
      o3: Number(ac.ozone)
    });
    if (computed) {
      airBlock = { ...computed, observedAt: parseLocal(ac.time) || now };
    }
  }

  const sun = sunTimes(now, lat, lon);
  const phase = moonPhase(now);

  return {
    source: 'live',
    provider: 'open-meteo',
    providerName: 'Open-Meteo',
    updatedAt: Date.now(),
    place: { name: placeName, lat, lon },
    elevation: stationElevation,
    now: { ...nowBlock, text: '' }, // text 由页面用 weatherText(code) 补
    hourly,
    daily,
    air: airBlock,
    // Open-Meteo 不提供中国气象预警。没有就返回空，不编造。
    warnings: [],
    indices: deriveIndices({
      temp: nowBlock.temp,
      humidity: nowBlock.humidity,
      cloud: nowBlock.cloud,
      uv: at(series.uv, nowIdx),
      precip: at(series.precip, nowIdx),
      windScale: nowBlock.windScale
    }),
    sun: {
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      solarNoon: sun.solarNoon,
      dayLength: sun.dayLength
    },
    moon: { phase, phaseName: moonPhaseName(phase), illumination: moonIllumination(phase) }
  };
}

export { parseLocal, hhmm, ymd };
