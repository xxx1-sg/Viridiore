/**
 * 定位服务桥
 * - 原生（Capacitor Android/iOS）：调用自研 BackgroundLocation 插件，
 *   由原生前台服务持续采集，即使锁屏 / 切后台也能沿真实路线记录。
 * - 非原生（浏览器 / PWA / 桌面）：回退到 geo.js 的 navigator.geolocation。
 *
 * 说明：原生端采用「原生缓冲 + JS 定时拉取(drain)」的方式，而不是依赖
 * WebView 事件回调。WebView 在后台会被暂停，事件无法即时送达 JS；但只要
 * 前台服务还在跑，点位就会存进原生缓冲，等 App 回到前台时一次性取回，
 * 从而完整重建后台那一段真实轨迹。
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

const Native = registerPlugin('BackgroundLocation');

/** 当前运行环境是否具备原生后台定位能力 */
export function nativeBackgroundAvailable() {
  try {
    return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable && Capacitor.isPluginAvailable('BackgroundLocation'));
  } catch {
    return false;
  }
}

/** 启动原生后台定位（会弹权限；已授权则直接启动前台服务） */
export async function startNativeTracking(opts = {}) {
  const { title = '晓山青 · 正在记录轨迹', text = '后台持续定位中，结束后点「结束并保存」' } = opts;
  await Native.start({ title, text });
}

/** 停止原生后台定位 */
export async function stopNativeTracking() {
  try {
    await Native.stop();
  } catch {
    /* 忽略：服务可能已停止 */
  }
}

/** 取回并清空原生缓冲的定位点（幂等，可重复调用） */
export async function drainNativeLocations() {
  try {
    const res = await Native.getLocations();
    const list = (res && res.locations) || [];
    return list
      .map((f) => ({
        lat: Number(f.latitude),
        lon: Number(f.longitude),
        altitude: Number.isFinite(f.altitude) ? f.altitude : null,
        accuracy: Number.isFinite(f.accuracy) ? f.accuracy : undefined,
        speed: Number.isFinite(f.speed) ? f.speed : undefined,
        heading: Number.isFinite(f.bearing) ? f.bearing : undefined,
        ts: Number(f.ts)
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  } catch {
    return [];
  }
}

/** 清空原生缓冲（开始新一次记录前调用，避免串入上一次的点） */
export async function clearNativeLocations() {
  try {
    await Native.clear();
  } catch {
    /* 忽略 */
  }
}
