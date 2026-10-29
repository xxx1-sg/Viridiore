/** 定位与地理计算 */
import { CITIES } from '../data/mountains.js';

const R = 6371008.8;

export function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function compassLabel(deg) {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return dirs[idx];
}

export function nearestCity(lat, lon) {
  let best = CITIES[0];
  let min = Infinity;
  for (const c of CITIES) {
    const d = haversine({ lat, lon }, c);
    if (d < min) {
      min = d;
      best = c;
    }
  }
  return { ...best, distance: min };
}

/**
 * 获取当前位置
 * @returns {Promise<{lat:number, lon:number, accuracy:number, altitude:number|null, ts:number}>}
 */
export function getPosition(options = {}) {
  const { timeout = 12000, maximumAge = 30000, enableHighAccuracy = true } = options;
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('当前环境不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          ts: pos.timestamp
        }),
      (err) => {
        const messages = {
          1: '定位权限被拒绝，请在系统设置中允许',
          2: '暂时无法获取位置，请到空旷处重试',
          3: '定位超时，请重试'
        };
        reject(new Error(messages[err.code] || err.message));
      },
      { timeout, maximumAge, enableHighAccuracy }
    );
  });
}

/** 持续定位 */
export function watchPosition(onUpdate, onError, options = {}) {
  if (!('geolocation' in navigator)) {
    onError?.(new Error('当前环境不支持定位'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        ts: pos.timestamp
      }),
    (err) => onError?.(new Error(err.message || '定位失败')),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000, ...options }
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** 电量（支持的平台） */
export async function getBattery() {
  try {
    if (!navigator.getBattery) return null;
    const b = await navigator.getBattery();
    return { level: Math.round(b.level * 100), charging: b.charging };
  } catch {
    return null;
  }
}

export function isSecureContextOk() {
  return (
    window.isSecureContext ||
    location.hostname === 'localhost' ||
    location.protocol === 'file:' ||
    location.protocol === 'capacitor:' ||
    location.protocol === 'app:'
  );
}
