/**
 * 天气服务：优先和风天气，未配置/失败时回退演示数据
 * 返回统一的内部数据结构，页面层不关心数据来源
 */
import { config } from '../config.js';
import { qweather } from './qweather.js';
import { buildDemoWeather } from './demo.js';
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

function normalize(lat, lon, placeName, parts) {
  const { now, hourly, daily, air, warnings, indices } = parts;
  const sun = sunTimes(new Date(), lat, lon);
  const phase = moonPhase();

  return {
    source: 'live',
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
      vis: String(now.vis ?? '--'),
      cloud: String(now.cloud ?? '--'),
      dew: String(now.dew ?? '--'),
      precip: String(now.precip ?? '0.0')
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
    })),
    air: air
      ? {
          aqi: round(air.now?.aqi),
          category: air.now?.category || '--',
          level: String(air.now?.level || '1'),
          primary: air.now?.primary || '--',
          pm2p5: String(air.now?.pm2p5 ?? '--'),
          pm10: String(air.now?.pm10 ?? '--')
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

/**
 * 获取天气数据
 * @param {{lat:number, lon:number, name?:string, force?:boolean}} options
 */
export async function loadWeather({ lat, lon, name = '当前位置', force = false } = {}) {
  const key = `wx:${lat.toFixed(3)}:${lon.toFixed(3)}`;

  if (!force) {
    const cached = await cacheRepo.get(key);
    if (cached) return cached;
  }

  if (config.hasQWeather()) {
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
        const bundle = normalize(lat, lon, name, {
          now: now.value.now,
          hourly: hourly.status === 'fulfilled' ? hourly.value : null,
          daily: daily.status === 'fulfilled' ? daily.value : null,
          air: air.status === 'fulfilled' ? air.value : null,
          warnings: warnings.status === 'fulfilled' ? warnings.value : null,
          indices: indices.status === 'fulfilled' ? indices.value : null
        });
        await cacheRepo.set(key, bundle, TTL);
        return bundle;
      }
      console.warn('[weather] 实时数据获取失败，回退演示数据', now.reason);
    } catch (err) {
      console.warn('[weather] 请求异常，回退演示数据', err);
    }
  }

  const demo = buildDemoWeather(lat, lon, name);
  await cacheRepo.set(key, demo, 180);
  return demo;
}

/** 城市搜索：优先 GeoAPI，失败时用内置城市表 */
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
