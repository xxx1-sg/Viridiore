/**
 * openmeteo.js 归一化单元测试 —— 锁住最容易悄悄坏、又纯逻辑的部分：
 * 时区解析（parseLocal）、风级/风向、以及把 Open-Meteo 原始 JSON
 * 整理成页面结构（now / hourly / daily / soundings / air）。
 *
 * 全程离线：用 stub 顶替 globalThis.fetch，喂固定 JSON，不依赖网络。
 * 运行：npm test（node --test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocal,
  hhmm,
  ymd,
  beaufort,
  windDirText,
  fetchOpenMeteo
} from '../src/services/openmeteo.js';

/* ---------------- 纯工具 ---------------- */

test('parseLocal：按本地字段构造时间，不受设备时区二次偏移', () => {
  const d = parseLocal('2026-01-10T06:30');
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 10);
  assert.equal(d.getHours(), 6);
  assert.equal(d.getMinutes(), 30);
});

test('parseLocal：空串 / 非法串返回 null', () => {
  assert.equal(parseLocal(''), null);
  assert.equal(parseLocal(null), null);
  assert.equal(parseLocal('not-a-date'), null);
});

test('hhmm / ymd：格式化与缺省值', () => {
  assert.equal(hhmm(new Date(2026, 0, 10, 6, 5)), '06:05');
  assert.equal(hhmm(null), '--:--');
  assert.equal(ymd(new Date(2026, 0, 10)), '2026-01-10');
});

test('beaufort：蒲福风级边界', () => {
  assert.equal(beaufort(0), '0');
  assert.equal(beaufort(0.3), '1');
  assert.equal(beaufort(5.5), '4');
  assert.equal(beaufort(13.9), '7');
  assert.equal(beaufort(32.7), '12');
  assert.equal(beaufort(NaN), '--');
  assert.equal(beaufort('x'), '--');
});

test('windDirText：八方位映射与非法值', () => {
  assert.equal(windDirText(0), '北风');
  assert.equal(windDirText(45), '东北风');
  assert.equal(windDirText(90), '东风');
  assert.equal(windDirText(180), '南风');
  assert.equal(windDirText(270), '西风');
  assert.equal(windDirText(-90), '西风');
  assert.equal(windDirText(NaN), '--');
});

/* ---------------- fetchOpenMeteo 归一化 ---------------- */

const HOURS = 48;

const pad2 = (n) => String(n).padStart(2, '0');
const hourlyTime = Array.from({ length: HOURS }, (_, i) => {
  const d = new Date(2026, 0, 10, 0, 0, 0);
  d.setHours(d.getHours() + i);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`;
});
const series = (v) => Array.from({ length: HOURS }, () => v);

const forecastJson = {
  latitude: 22.6,
  longitude: 114.1,
  elevation: 100,
  current: {
    time: '2026-01-10T06:30',
    temperature_2m: 18.4,
    relative_humidity_2m: 80,
    dew_point_2m: 15.2,
    apparent_temperature: 17.1,
    is_day: 1,
    precipitation: 0,
    weather_code: 0,
    cloud_cover: 40,
    cloud_cover_low: 30,
    pressure_msl: 1012,
    surface_pressure: 1000,
    wind_speed_10m: 3.2,
    wind_direction_10m: 90,
    wind_gusts_10m: 6.5,
    visibility: 20000
  },
  hourly: {
    time: hourlyTime,
    temperature_2m: series(18),
    relative_humidity_2m: series(80),
    dew_point_2m: series(15),
    apparent_temperature: series(17),
    precipitation: series(0),
    precipitation_probability: series(10),
    cloud_cover: series(40),
    cloud_cover_low: series(30),
    cloud_cover_mid: series(20),
    cloud_cover_high: series(10),
    visibility: series(20000),
    wind_speed_10m: series(3),
    wind_direction_10m: series(90),
    wind_gusts_10m: series(6),
    pressure_msl: series(1012),
    weather_code: series(0),
    uv_index: series(5),
    temperature_925hPa: series(16),
    relative_humidity_925hPa: series(75),
    geopotential_height_925hPa: series(800),
    temperature_850hPa: series(12),
    relative_humidity_850hPa: series(70),
    geopotential_height_850hPa: series(1500),
    wind_speed_850hPa: series(4)
  },
  daily: {
    time: ['2026-01-10', '2026-01-11'],
    sunrise: ['2026-01-10T07:00', '2026-01-11T07:00'],
    sunset: ['2026-01-10T18:00', '2026-01-11T18:00'],
    weather_code: [0, 1],
    temperature_2m_max: [24, 25],
    temperature_2m_min: [15, 16],
    precipitation_sum: [0, 0],
    precipitation_probability_max: [10, 20],
    wind_speed_10m_max: [5, 6],
    wind_direction_10m_dominant: [90, 180],
    uv_index_max: [5, 6]
  }
};

const airJson = {
  current: {
    time: '2026-01-10T06:00',
    pm2_5: 20,
    pm10: 40,
    carbon_monoxide: 400,
    nitrogen_dioxide: 30,
    sulphur_dioxide: 5,
    ozone: 80
  }
};

function makeResponse(data) {
  return { ok: true, status: 200, json: async () => data };
}

function withFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
  });
}

test('fetchOpenMeteo：把原始 JSON 正确归一化（now / hourly / daily / soundings / air）', async () => {
  await withFetch(
    async (url) => {
      const u = String(url);
      return makeResponse(u.includes('air-quality') ? airJson : forecastJson);
    },
    async () => {
      const res = await fetchOpenMeteo(22.6, 114.1, '测试点');

      assert.equal(res.provider, 'open-meteo');
      assert.equal(res.place.name, '测试点');
      assert.equal(res.elevation, 100);

      // 实况取 current 块，而非最近整点预报
      assert.equal(res.now.temp, 18);
      assert.equal(res.now.humidity, 80);
      assert.equal(res.now.feels, 17);
      assert.equal(res.now.code, 100); // WMO 0 → 和风 100
      assert.equal(res.now.windDir, '东风');
      assert.equal(res.now.windScale, '2'); // 3.2 m/s → 2 级
      assert.equal(res.now.pressure, '1012');
      assert.equal(res.now.pressureStation, '1000');
      assert.equal(res.now.vis, '20'); // 20000 m → 20 km

      assert.equal(res.hourly.length, 24);
      assert.equal(res.hourly[0].temp, 18); // 第一格用实况覆盖整点

      assert.equal(res.daily.length, 2);
      const s0 = res.daily[0].soundings;
      assert.ok(s0, '逐日应带 soundings（追光模型消费）');
      assert.equal(s0.t2m, 18);
      assert.equal(s0.t850, 12);
      assert.equal(s0.rh850, 70);
      assert.equal(s0.stationElevation, 100);

      assert.ok(res.air, '空气质量应被算出来');
      assert.ok(Number.isFinite(res.air.aqi), 'AQI 应为有限数值');
    }
  );
});

test('fetchOpenMeteo：空气质量接口失败时不阻断主流程，air 为 null', async () => {
  await withFetch(
    async (url) => {
      const u = String(url);
      if (u.includes('air-quality')) throw new Error('air down');
      return makeResponse(forecastJson);
    },
    async () => {
      const res = await fetchOpenMeteo(22.6, 114.1, '测试点');
      assert.equal(res.air, null);
      assert.equal(res.now.temp, 18);
      assert.equal(res.daily.length, 2);
    }
  );
});
