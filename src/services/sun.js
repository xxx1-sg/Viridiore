/**
 * 天文计算：日出 / 日落 / 太阳正午 / 月相
 * 算法：NOAA Solar Calculator（精度 ±1 分钟，离线可用）
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function solarParams(date) {
  const n = dayOfYear(date);
  const hour = date.getHours() + date.getMinutes() / 60;
  const gamma = ((2 * Math.PI) / 365) * (n - 1 + (hour - 12) / 24);
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  return { eqtime, decl };
}

function minutesToDate(baseDate, minutes) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(Math.round(minutes));
  return d;
}

export function sunTimes(date, lat, lon) {
  const { eqtime, decl } = solarParams(date);
  const latRad = lat * RAD;
  const zenith = 90.833 * RAD;

  const cosHa =
    Math.cos(zenith) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);

  if (cosHa > 1) return { polar: 'night', sunrise: null, sunset: null };
  if (cosHa < -1) return { polar: 'day', sunrise: null, sunset: null };

  const ha = Math.acos(cosHa) * DEG;

  // 小时数（UTC 分钟）
  const sunriseUTC = 720 - 4 * (lon + ha) - eqtime;
  const sunsetUTC = 720 - 4 * (lon - ha) - eqtime;
  const noonUTC = 720 - 4 * lon - eqtime;

  const utcOffsetMin = -date.getTimezoneOffset();

  const sunrise = minutesToDate(date, sunriseUTC + utcOffsetMin);
  const sunset = minutesToDate(date, sunsetUTC + utcOffsetMin);
  const solarNoon = minutesToDate(date, noonUTC + utcOffsetMin);

  return {
    sunrise,
    sunset,
    solarNoon,
    dayLength: sunset - sunrise,
    goldenHour: new Date(sunrise.getTime() - 25 * 60000)
  };
}

/**
 * 日出方位角（度，自正北顺时针）
 * 用途：告诉用户"去哪个坡向等日出"，而不是笼统说"去山顶"。
 * 关系式：cos A = (sin δ − sin φ·sin h) / (cos φ·cos h)，h 取 −0.833°
 */
export function sunriseAzimuth(date, lat) {
  const { decl } = solarParams(date);
  const phi = lat * RAD;
  const h = -0.833 * RAD;
  const cosA = (Math.sin(decl) - Math.sin(phi) * Math.sin(h)) / (Math.cos(phi) * Math.cos(h));
  return Math.acos(Math.max(-1, Math.min(1, cosA))) * DEG;
}

const AZIMUTH_SECTORS = [
  [22.5, '北'],
  [67.5, '东北'],
  [112.5, '东'],
  [157.5, '东南'],
  [202.5, '南'],
  [247.5, '西南'],
  [292.5, '西'],
  [337.5, '西北'],
  [360, '北']
];

/** 把方位角翻译成中文方位 */
export function azimuthLabel(deg) {
  const d = ((Number(deg) || 0) % 360 + 360) % 360;
  for (const [max, label] of AZIMUTH_SECTORS) {
    if (d < max) return label;
  }
  return '北';
}

/** 建议的观景坡向：日出方位 + 90°，即向阳坡 */
export function facingSlopeLabel(azimuth) {
  const label = azimuthLabel(azimuth);
  return label === '东' ? '东侧山脊' : `${label}向坡面`;
}

/** 月相：0 = 新月，0.5 = 满月 */
export function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const phase = ((days % synodic) + synodic) % synodic;
  return phase / synodic;
}

export function moonPhaseName(phase) {
  if (phase < 0.033 || phase > 0.967) return '新月';
  if (phase < 0.216) return '娥眉月';
  if (phase < 0.283) return '上弦月';
  if (phase < 0.466) return '盈凸月';
  if (phase < 0.534) return '满月';
  if (phase < 0.716) return '亏凸月';
  if (phase < 0.783) return '下弦月';
  return '残月';
}

/** 月亮照亮比例 */
export function moonIllumination(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** 是否为白天 */
export function isDaytime(date, lat, lon) {
  const { sunrise, sunset } = sunTimes(date, lat, lon);
  if (!sunrise || !sunset) return true;
  return date >= sunrise && date <= sunset;
}
