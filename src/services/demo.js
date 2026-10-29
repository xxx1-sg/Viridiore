/**
 * 演示数据生成器
 * 未配置和风天气 Key 时使用：基于坐标 + 日期确定性生成，刷新不会乱跳数值，
 * 数据在气象上自洽（温度曲线、湿度与降水、云量相互对应）。
 */
import { sunTimes, moonPhase, moonPhaseName, moonIllumination } from './sun.js';

function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLIMATE = [
  { high: 19, low: 11 }, { high: 20, low: 12 }, { high: 23, low: 15 },
  { high: 26, low: 19 }, { high: 29, low: 23 }, { high: 31, low: 25 },
  { high: 32, low: 26 }, { high: 32, low: 26 }, { high: 31, low: 25 },
  { high: 28, low: 22 }, { high: 24, low: 18 }, { high: 21, low: 13 }
];

const PATTERNS = [
  { code: 100, text: '晴', weight: 26, cloud: [0, 12], pop: 0, humid: [45, 62], vis: [18, 26] },
  { code: 103, text: '晴间多云', weight: 22, cloud: [25, 55], pop: 5, humid: [55, 70], vis: [14, 22] },
  { code: 101, text: '多云', weight: 20, cloud: [55, 82], pop: 12, humid: [62, 78], vis: [12, 18] },
  { code: 104, text: '阴', weight: 12, cloud: [82, 98], pop: 25, humid: [70, 85], vis: [9, 14] },
  { code: 305, text: '小雨', weight: 9, cloud: [85, 100], pop: 65, humid: [82, 94], vis: [6, 11] },
  { code: 302, text: '雷阵雨', weight: 6, cloud: [80, 100], pop: 78, humid: [78, 92], vis: [5, 10] },
  { code: 500, text: '薄雾', weight: 5, cloud: [40, 70], pop: 8, humid: [88, 96], vis: [2, 6] }
];

const TOTAL_WEIGHT = PATTERNS.reduce((s, p) => s + p.weight, 0);

function pickPattern(r) {
  let x = r() * TOTAL_WEIGHT;
  for (const p of PATTERNS) {
    x -= p.weight;
    if (x <= 0) return p;
  }
  return PATTERNS[0];
}

const between = (r, [min, max]) => min + r() * (max - min);
const dateKey = (d) => `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`;

function patternForDay(date, lat, lon) {
  const r = rng(seedOf(`day-${dateKey(date)}-${lat.toFixed(2)}-${lon.toFixed(2)}`));
  const p = pickPattern(r);
  const month = date.getMonth();
  const climate = CLIMATE[month];
  const offset = (r() - 0.5) * 4;
  const high = Math.round(climate.high + offset);
  const low = Math.round(climate.low + offset * 0.6);
  return { r, pattern: p, high, low, climate };
}

function hourTemp(hour, high, low) {
  const mean = (high + low) / 2;
  const amp = (high - low) / 2;
  const normalized = ((hour - 14 + 24) % 24) / 24;
  return mean + amp * Math.cos(normalized * Math.PI * 2);
}

const WIND_DIRS = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDateCompact(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function buildDemoWeather(lat, lon, placeName = '深圳') {
  const now = new Date();
  const day = patternForDay(now, lat, lon);
  const { r, pattern, high, low } = day;

  const temp = Math.round(hourTemp(now.getHours() + now.getMinutes() / 60, high, low));
  const humidity = Math.round(between(r, pattern.humid));
  const windScale = Math.round(between(r, [1, pattern.pop > 50 ? 5 : 4]));
  const windDirIdx = Math.floor(r() * 8);
  const cloud = Math.round(between(r, pattern.cloud));
  const vis = Math.round(between(r, pattern.vis));
  const pressure = Math.round(1009 + (r() - 0.5) * 12 + (pattern.pop > 50 ? -4 : 2));
  const feels = Math.round(temp + (humidity > 75 ? 2.4 : humidity < 50 ? -1.2 : 0.6));

  const sun = sunTimes(now, lat, lon);
  const phase = moonPhase(now);

  // 逐小时（未来 24 小时）
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() + i * 3600e3);
    t.setMinutes(0, 0, 0);
    const d = patternForDay(t, lat, lon);
    const hour = t.getHours();
    const isNight = sun.sunrise && (t < sun.sunrise || t > sun.sunset);
    const code = isNight ? (d.pattern.code === 100 ? 150 : d.pattern.code) : d.pattern.code;
    hourly.push({
      time: t,
      temp: Math.round(hourTemp(hour, d.high, d.low)),
      code,
      text: d.pattern.text,
      pop: Math.min(100, Math.round(d.pattern.pop + (r() - 0.5) * 18)),
      windScale: Math.round(between(r, [1, 4])),
      humidity: Math.round(between(r, d.pattern.humid))
    });
  }

  // 7 日
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const info = patternForDay(d, lat, lon);
    const s = sunTimes(d, lat, lon);
    const nightCode = info.pattern.code === 100 ? 150 : info.pattern.code;
    daily.push({
      date: fmtDate(d),
      dateObj: d,
      max: info.high,
      min: info.low,
      tempNight: info.low,
      codeDay: info.pattern.code,
      textDay: info.pattern.text,
      codeNight: nightCode,
      textNight: info.pattern.text,
      pop: info.pattern.pop,
      precip: info.pattern.pop > 50 ? (Math.round(info.r() * 12 * 10) / 10).toFixed(1) : '0.0',
      humidity: Math.round(between(info.r, info.pattern.humid)),
      windDir: WIND_DIRS[Math.floor(info.r() * 8)],
      windScale: `${Math.round(between(info.r, [1, 4]))}-${Math.round(between(info.r, [2, 5]))}`,
      uv: Math.max(0, Math.round((info.pattern.cloud[0] < 40 ? 8 : 4) + (info.r() - 0.5) * 4)),
      cloud: Math.round(between(info.r, info.pattern.cloud)),
      vis: Math.round(between(info.r, info.pattern.vis)),
      sunrise: s.sunrise ? `${String(s.sunrise.getHours()).padStart(2, '0')}:${String(s.sunrise.getMinutes()).padStart(2, '0')}` : '--:--',
      sunset: s.sunset ? `${String(s.sunset.getHours()).padStart(2, '0')}:${String(s.sunset.getMinutes()).padStart(2, '0')}` : '--:--'
    });
  }

  const aqi = Math.round(Math.max(18, Math.min(120, 32 + (100 - vis * 4) + (r() - 0.5) * 30)));
  const airCategory = aqi <= 50 ? '优' : aqi <= 100 ? '良' : '轻度污染';

  const warnings = [];
  if (pattern.pop >= 65) {
    warnings.push({
      id: 'demo-warn-1',
      title: `深圳市气象台发布${pattern.text === '雷阵雨' ? '雷电' : '暴雨'}黄色预警`,
      type: '1006',
      typeName: pattern.text === '雷阵雨' ? '雷电' : '暴雨',
      level: '黄色',
      severity: 'Moderate',
      severityColor: 'Yellow',
      pubTime: new Date(now.getTime() - 2 * 3600e3).toISOString(),
      startTime: new Date(now.getTime() - 2 * 3600e3).toISOString(),
      endTime: new Date(now.getTime() + 8 * 3600e3).toISOString(),
      sender: '深圳市气象台',
      text: `预计未来 6 小时内本地将出现${pattern.text === '雷阵雨' ? '雷雨' : '较强降水'}，并伴有短时大风，请注意防范。山区徒步请推迟行程。`
    });
  }

  const indices = [
    { type: '1', name: '运动指数', category: pattern.pop > 50 ? '不宜' : temp > 32 ? '较不宜' : '适宜', text: pattern.pop > 50 ? '有降水，建议改为室内运动。' : '天气较好，适合户外徒步，注意补水。' },
    { type: '2', name: '穿衣指数', category: temp > 28 ? '炎热' : temp > 22 ? '舒适' : temp > 16 ? '较凉' : '冷', text: temp > 28 ? '建议短袖速干衣裤。' : temp > 22 ? '长袖速干衣加薄外套。' : '建议加抓绒与防风层。' },
    { type: '3', name: '紫外线', category: cloud < 40 ? '强' : '中等', text: cloud < 40 ? '山顶紫外线强，务必防晒。' : '紫外线适中，仍需基础防晒。' },
    { type: '5', name: '洗车指数', category: pattern.pop > 50 ? '不宜' : '适宜', text: pattern.pop > 50 ? '有降水，不建议洗车。' : '天气较好，适合洗车。' },
    { type: '6', name: '旅游指数', category: pattern.pop > 50 ? '一般' : '适宜', text: pattern.pop > 50 ? '降水影响出行体验。' : '适合出行，注意山区天气变化。' },
    { type: '9', name: '过敏指数', category: humidity > 80 ? '易发' : '不易发', text: humidity > 80 ? '湿度大，霉菌花粉易扩散。' : '过敏风险较低。' }
  ];

  return {
    source: 'demo',
    updatedAt: Date.now(),
    place: { name: placeName, lat, lon },
    now: {
      temp,
      feels,
      text: pattern.text,
      code: pattern.code,
      humidity,
      windDir: WIND_DIRS[windDirIdx],
      windScale: String(windScale),
      windSpeed: String(Math.round(windScale * 4 + r() * 3)),
      pressure: String(pressure),
      vis: String(vis),
      cloud: String(cloud),
      dew: String(Math.round(temp - (100 - humidity) / 5)),
      precip: pattern.pop > 50 ? (r() * 2).toFixed(1) : '0.0'
    },
    hourly,
    daily,
    air: { aqi, category: airCategory, level: String(aqi <= 50 ? 1 : 2), primary: 'PM2.5', pm2p5: String(Math.round(aqi * 0.6)), pm10: String(Math.round(aqi * 0.85)) },
    warnings,
    indices,
    sun: {
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      solarNoon: sun.solarNoon,
      dayLength: sun.dayLength
    },
    moon: {
      phase,
      phaseName: moonPhaseName(phase),
      illumination: moonIllumination(phase)
    }
  };
}

export { fmtDateCompact, dateKey };
