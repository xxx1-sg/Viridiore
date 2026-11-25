/**
 * 手机端「静默热更新」—— Capacitor + Capgo（@capgo/capacitor-updater）
 *
 * 只在原生运行时加载（网页 / 桌面不会走到这里）：
 *   · 启动调用 notifyAppReady()，否则插件超时会回滚上一次更新；
 *   · 静默检查 updates.json，有新版本就后台下载，并「下次启动生效」。
 *
 * 只更新网页层（JS/CSS/HTML）。原生代码 / 插件 / 权限变更必须重新发版。
 *
 * updates.json 由 scripts/live-update/manifest.mjs 生成，
 * 与 bundle-<version>.zip 一起放到 GitHub Pages（site/ota/）。
 */
import { compareVersion } from '../core/version.js';
import { CapacitorHttp } from '@capacitor/core';

const DEFAULT_FEED = 'https://xxx1-sg.github.io/Viridiore/ota/updates.json';

function isNative() {
  return typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

async function loadPlugin() {
  const mod = await import('@capgo/capacitor-updater');
  return mod.CapacitorUpdater;
}

function feedUrl() {
  const override = typeof window !== 'undefined' && window.__OTA_FEED_URL__;
  return override || DEFAULT_FEED;
}

async function fetchFeed() {
  const url = `${feedUrl()}${feedUrl().includes('?') ? '&' : '?'}t=${Date.now()}`;
  // 用原生 HTTP 取清单，避开 WebView 的跨域（CORS）限制；网页回退 fetch。
  let data;
  try {
    const res = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } });
    data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } catch {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`更新清单返回 ${res.status}`);
    data = await res.json();
  }
  if (!data || !data.version || !data.url) throw new Error('更新清单格式不对');
  return data; // { version, url, checksum }
}

async function currentVersionOf(CapacitorUpdater) {
  try {
    const c = await CapacitorUpdater.current();
    const v = c?.bundle?.version || c?.version || (c?.bundle?.id ? null : null);
    return v || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** 下载并标记为"下次启动生效" */
async function downloadAndStage(CapacitorUpdater, feed) {
  const bundle = await CapacitorUpdater.download({
    url: feed.url,
    version: feed.version,
    checksum: feed.checksum
  });
  await CapacitorUpdater.next({ id: bundle.id });
  return bundle;
}

/** 启动时调用（仅原生）。静默检查，不打扰用户。 */
export async function initLiveUpdate() {
  if (!isNative()) return;

  let CapacitorUpdater;
  try {
    CapacitorUpdater = await loadPlugin();
  } catch (err) {
    console.warn('[liveupdate] 未安装 @capgo/capacitor-updater，跳过', err?.message || err);
    return;
  }

  // 必须先告知就绪，否则 appReadyTimeout 后会回滚
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (err) {
    console.warn('[liveupdate] notifyAppReady 失败', err?.message || err);
  }

  try {
    const feed = await fetchFeed();
    const cur = await currentVersionOf(CapacitorUpdater);
    if (compareVersion(feed.version, cur) > 0) {
      await downloadAndStage(CapacitorUpdater, feed);
      console.log(`[liveupdate] 已下载 ${feed.version}，下次启动生效`);
    }
  } catch (err) {
    console.warn('[liveupdate] 静默检查失败', err?.message || err);
  }
}

/** 设置页「检查更新」在原生端调用：立即检查并下载（下次启动生效） */
export async function manualLiveCheck() {
  if (!isNative()) return { ok: false, available: false, reason: 'not-native' };
  const CapacitorUpdater = await loadPlugin();
  const feed = await fetchFeed();
  const cur = await currentVersionOf(CapacitorUpdater);
  if (compareVersion(feed.version, cur) <= 0) {
    return { ok: true, available: false, version: cur };
  }
  await downloadAndStage(CapacitorUpdater, feed);
  return { ok: true, available: true, version: feed.version };
}
