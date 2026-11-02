/**
 * 天气服务
 *
 * 数据源策略（v2.4 起）：
 *   1. 和风天气（可选，填了 Key 时为主源）：实况走国内站点观测（obsTime），
 *      预报走中国区域预报，口径与手机自带天气一致；并补中国气象预警与国标 AQI。
 *   2. Open-Meteo（默认源，也是和风的层结来源）：免费、无需注册，提供
 *      850 / 925 hPa 气压层数据——追光的逆温判据依赖它。和风没有气压层，
 *      所以即便和风做主显示，也仍从 Open-Meteo（中国气象局 GRAPES 模式）取层结。
 *   3. 没有第三层。**不再有演示数据回退**：
 *      预测工具拿假数据算概率，等于没有预测。取数失败就如实报错，
 *      页面显示"重试"，而不是拿一份编造的天气糊弄过去。
 */
import { config } from '../config.js';
import { qweather } from './qweather.js';
import { fetchOpenMeteo } from './openmeteo.js';
import { cacheRepo } from '../core/store.js';
import { sunTimes, moonPhase, moonPhaseName, moonIllumination } from './sun.js';
import { estimatePop } from './atmos.js';
import { weatherText } from '../core/icons.js';

const TTL = 600; // 10 分钟

const round = (v, d = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(d));
};

/* ---------------- 和风：归一化（仅作为备选源） ---------------- */

function normalizeQWeather(lat, lon, placeName, parts) {
  const { now, hourly, daily, air, warnings, indices } = parts;
  const sun = sunTimes(new Date(), lat, lon);
  const phase = moonPhase();

  return {
    source: 'live',
    provider: 'qweather',
    providerName: '和风天气',
    updatedAt: Date.now(),
    place: { name: placeName, lat, lon },
    now: {
      temp: round(now.temp),
      feels: round(now.feelsLike),
      text: now.text || weatherText(now.icon),
      code: Number(now.icon),
      humidity: round(now.humidity),
      windDir: now.windDir || '--',
      windScale: String(now.windScale ?? '--'),
      windSpeed: String(now.windSpeed ?? '--'),
      pressure: String(now.pressure ?? '--'),
      pressureStation: null,
      pressureDelta: null,
      vis: String(now.vis ?? '--'),
      visMeters: Number.isFinite(Number(now.vis)) ? Number(now.vis) * 1000 : NaN,
      cloud: String(now.cloud ?? '--'),
      dew: String(now.dew ?? '--'),
      precip: String(now.precip ?? '0.0'),
      gust: '--',
      isDay: true,
      observedAt: new Date(now.obsTime || Date.now())
    },
    hourly: (hourly?.hourly || []).slice(0, 24).map((h) => ({
      time: new Date(h.fxTime),
      temp: round(h.temp),
      code: Number(h.icon),
      text: h.text,
      pop: round(h.pop),
      windScale: Number(h.windScale),
      humidity: round(h.humidity)
    })),
    daily: (daily?.daily || []).map((d) => ({
      date: d.fxDate,
      dateObj: new Date(`${d.fxDate}T12:00:00`),
      max: round(d.tempMax),
      min: round(d.tempMin),
      tempNight: round(d.tempMin),
      codeDay: Number(d.iconDay),
      textDay: d.textDay,
      codeNight: Number(d.iconNight),
      textNight: d.textNight,
      // 和风 7 日预报不提供降水概率字段，由降水量与天气现象反推
      pop: estimatePop({ precip: d.precip, text: d.textDay, code: d.iconDay }),
      precip: String(d.precip ?? '0.0'),
      humidity: round(d.humidity),
      windDir: d.windDirDay,
      windScale: d.windScaleDay,
      uv: round(d.uvIndex),
      cloud: round(d.cloud),
      vis: round(d.vis),
      sunrise: d.sunrise,
      sunset: d.sunset,
      moonPhase: d.moonPhase
      // 注意：和风不提供气压层数据，soundings 缺失，
      // 追光会自动降级为代理估算并在界面标注。
    })),
    // 和风兜底路径下 air 已是 normalizeAir 的结果，直接沿用
    air: air || null,
    warnings: (warnings?.warning || []).map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      typeName: w.typeName,
      level: w.level,
      severity: w.severity,
      severityColor: w.severityColor,
      pubTime: w.pubTime,
      startTime: w.startTime,
      endTime: w.endTime,
      sender: w.sender,
      text: w.text
    })),
    indices: (indices?.daily || []).map((i) => ({
      type: i.type,
      name: i.name,
      category: i.category,
      text: i.text
    })),
    sun: {
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      solarNoon: sun.solarNoon,
      dayLength: sun.dayLength
    },
    moon: { phase, phaseName: moonPhaseName(phase), illumination: moonIllumination(phase) }
  };
}

/* ---------------- 和风：可用时补充预警与空气质量 ---------------- */

async function enrichFromQWeather(bundle, lat, lon) {
  if (!config.hasQWeather() || !bundle) return bundle;

  const [warnings, air] = await Promise.allSettled([qweather.warnings(lat, lon), qweather.air(lat, lon)]);

  if (warnings.status === 'fulfilled' && warnings.value?.warning?.length) {
    bundle.warnings = warnings.value.warning;
    bundle.warningProvider = '和风天气';
  }

  // 有和风时用生态环境部国控站的实测 AQI，替换 Open-Meteo 的模式估算值
  if (air.status === 'fulfilled' && air.value?.aqi != null) {
    bundle.air = air.value;
  }

  return bundle;
}

/* ---------------- 层结合并 + 主入口 ---------------- */

/**
 * 把 Open-Meteo 的逐日高空层结并入和风 bundle。
 * 和风没有 850 / 925 hPa 数据，追光会降级成估算；这里按日期把层结补回去，
 * 让「实况/预报用和风、层结用中国气象局 GRAPES 模式」两全。
 */
function mergeSoundings(bundle, om) {
  if (!bundle || !om) return bundle;
  const byDate = new Map((om.daily || []).map((d) => [d.date, d.soundings]));
  bundle.daily = (bundle.daily || []).map((d) => {
    const s = byDate.get(d.date);
    return s ? { ...d, soundings: s } : d;
  });
  if (om.elevation != null) bundle.elevation = om.elevation;
  // 和风没给到 AQI 时，用 Open-Meteo 的 CAMS 六项浓度按国标估算兜底
  if (!bundle.air && om.air) bundle.air = om.air;
  return bundle;
}

/**
 * 获取真实天气数据
 * @param {{lat:number, lon:number, name?:string, force?:boolean}} options
 */
export async function loadWeather({ lat, lon, name = '当前位置', force = false } = {}) {
  const key = `wx:${lat.toFixed(3)}:${lon.toFixed(3)}`;

  if (!force) {
    const cached = await cacheRepo.get(key);
    if (cached && cached.source === 'live') return cached;
  }

  const hasQW = config.hasQWeather();
  const runOm = (models) => fetchOpenMeteo(lat, lon, name, models ? { models } : undefined);

  /*
   * 和风可用时，Open-Meteo 只借两样东西：850/925 hPa 层结（追光用）和格点海拔。
   * 此时用中国气象局 GRAPES 全球模型（cma_grapes_global），比 ECMWF 更贴中国本地。
   */
  const omPromise = runOm(hasQW ? 'cma_grapes_global' : null).catch((err) => {
    console.warn('[weather] Open-Meteo 取数失败', err?.message || err);
    return { __error: err };
  });

  let bundle = null;
  let error = null;

  // 1. 主源：和风天气（国内实况观测 + 预报），配了 Key 就优先用
  if (hasQW) {
    try {
      const [now, hourly, daily, air, warnings, indices] = await Promise.allSettled([
        qweather.now(lon, lat),
        qweather.hourly24(lon, lat),
        qweather.daily7(lon, lat),
        qweather.air(lat, lon),
        qweather.warnings(lat, lon),
        qweather.indices(lon, lat)
      ]);

      if (now.status === 'fulfilled') {
        bundle = normalizeQWeather(lat, lon, name, {
          now: now.value.now,
          hourly: hourly.status === 'fulfilled' ? hourly.value : null,
          daily: daily.status === 'fulfilled' ? daily.value : null,
          air: air.status === 'fulfilled' ? air.value : null,
          warnings: warnings.status === 'fulfilled' ? warnings.value : null,
          indices: indices.status === 'fulfilled' ? indices.value : null
        });
        if (bundle.warnings.length) bundle.warningProvider = '和风天气';
      } else {
        error = now.reason;
        console.warn('[weather] 和风实况取数失败', now.reason?.message || now.reason);
      }
    } catch (err) {
      error = err;
      console.warn('[weather] 和风取数失败', err?.message || err);
    }
  }

  // 2. Open-Meteo：和风成功时只并入层结；和风不可用时作为主源
  const om = await omPromise;
  let omBundle = om && !om.__error ? om : null;
  if (!omBundle && om?.__error) error = error || om.__error;

  if (bundle) {
    if (omBundle) bundle = mergeSoundings(bundle, omBundle);
  } else {
    /*
     * 和风没取到：退回 Open-Meteo 全量数据。
     * 若刚才用的是 GRAPES 模式（缺降水概率 / UV），此时改取默认全量模型，
     * 免得回退后界面出现一堆空值。
     */
    if (hasQW && omBundle) {
      try {
        omBundle = await runOm(null);
      } catch (err) {
        console.warn('[weather] Open-Meteo 回退取数失败', err?.message || err);
      }
    }
    bundle = omBundle;
    if (bundle && hasQW) bundle = await enrichFromQWeather(bundle, lat, lon);
  }

  if (!bundle) {
    // 如实报错，不编造数据
    const message =
      error?.code === 'TIMEOUT'
        ? '天气服务响应超时，请检查网络后重试'
        : error?.code === 'NETWORK'
          ? '连不上天气服务，请检查网络或代理设置'
          : error?.message || '天气数据获取失败';
    throw new Error(message);
  }

  // 3. 补全文字描述（Open-Meteo 只给代码，和风本身有中文文案）
  bundle.now.text = bundle.now.text || weatherText(bundle.now.code);
  bundle.daily = bundle.daily.map((d) => ({
    ...d,
    textDay: d.textDay || weatherText(d.codeDay),
    textNight: d.textNight || weatherText(d.codeNight)
  }));

  await cacheRepo.set(key, bundle, TTL);
  return bundle;
}

/** 城市搜索：优先和风 GeoAPI，未配置时用内置城市表（见 data/mountains.js） */
export async function searchCity(keyword) {
  const kw = keyword.trim();
  if (!kw) return [];

  if (config.hasQWeather()) {
    try {
      const data = await qweather.cityLookup(kw);
      if (data?.location?.length) {
        return data.location.map((c) => ({
          name: c.name,
          lat: Number(c.lat),
          lon: Number(c.lon),
          admin: [c.adm1, c.adm2].filter(Boolean).join(' · ')
        }));
      }
    } catch (err) {
      console.warn('[weather] 城市搜索失败', err);
    }
  }

  return [];
}

export { sunTimes, moonPhase, moonPhaseName };
