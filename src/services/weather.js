/**
 * 天气服务
 *
 * 数据源策略（v2.2 起）：
 *   1. 主源 Open-Meteo：免费、无需注册、提供 850 / 925 hPa 气压层数据。
 *      追光的逆温判据依赖它，所以这是默认源，装完就能看真实预报。
 *   2. 补充源和风天气（可选）：只在用户自己填了 Key 时启用，
 *      用来补中国气象预警与本地空气质量——Open-Meteo 不提供这两项。
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
    air: air
      ? {
          aqi: round(air.now?.aqi),
          category: air.now?.category || '--',
          level: String(air.now?.level || '1'),
          primary: air.now?.primary || '--',
          tone: 'good',
          standard: 'CN MEE',
          // 和风只给 PM2.5 / PM10 两项，其余留空，页面会照实显示两项而不是编造
          pollutants: [
            { key: 'pm25', name: 'PM2.5', unit: 'μg/m³', value: round(air.now?.pm2p5), iaqi: null },
            { key: 'pm10', name: 'PM10', unit: 'μg/m³', value: round(air.now?.pm10), iaqi: null }
          ].filter((p) => Number.isFinite(p.value))
        }
      : null,
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

  const [warnings, air] = await Promise.allSettled([qweather.warnings(lon, lat), qweather.air(lon, lat)]);

  if (warnings.status === 'fulfilled' && warnings.value?.warning?.length) {
    bundle.warnings = warnings.value.warning.map((w) => ({
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
      text: w.text,
      provider: 'qweather'
    }));
    bundle.warningProvider = '和风天气';
  }

  // 有和风时用国内生态环境部的 AQI，比 Open-Meteo 自算的更接近官方发布值
  if (air.status === 'fulfilled' && air.value?.now?.aqi) {
    bundle.air = {
      aqi: round(air.value.now.aqi),
      category: air.value.now.category || '--',
      level: String(air.value.now.level || '1'),
      primary: air.value.now.primary || '--',
      tone: 'good',
      standard: 'CN MEE',
      pollutants: [
        { key: 'pm25', name: 'PM2.5', unit: 'μg/m³', value: round(air.value.now.pm2p5), iaqi: null },
        { key: 'pm10', name: 'PM10', unit: 'μg/m³', value: round(air.value.now.pm10), iaqi: null }
      ].filter((p) => Number.isFinite(p.value))
    };
  }

  return bundle;
}

/* ---------------- 主入口 ---------------- */

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

  let bundle = null;
  let error = null;

  // 1. 主源：Open-Meteo（含气压层，追光依赖）
  try {
    bundle = await fetchOpenMeteo(lat, lon, name);
  } catch (err) {
    error = err;
    console.warn('[weather] Open-Meteo 取数失败', err?.message || err);
  }

  // 2. 主源失败时，如果用户配了和风，用和风兜底（无气压层，追光降级）
  if (!bundle && config.hasQWeather()) {
    try {
      const [now, hourly, daily, air, warnings, indices] = await Promise.allSettled([
        qweather.now(lon, lat),
        qweather.hourly24(lon, lat),
        qweather.daily7(lon, lat),
        qweather.air(lon, lat),
        qweather.warnings(lon, lat),
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
      }
    } catch (err) {
      console.warn('[weather] 和风兜底也失败', err?.message || err);
    }
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

  // 3. 和风补充预警 / 空气质量（可选，失败不影响主流程）
  bundle = await enrichFromQWeather(bundle, lat, lon);

  // 4. 补全文字描述（Open-Meteo 只给代码）
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
