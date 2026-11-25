/**
 * 应用内更新
 * - 桌面（Electron）：走主进程的 electron-updater（真正的自动更新：检查→下载→重启安装），
 *   这里只负责发起检查、接收状态、弹重启提示。
 * - 手机 / 网页（Capacitor / PWA）：手机端原生 App 无法自更新（iOS 强制 App Store），
 *   所以这里用 GitHub Releases 做"应用内检查更新 + 一键去下载"。
 *   （真正的网页层静默热更新需要 Capgo 原生插件，见 README「应用内更新」。）
 */
import { openModal } from '../core/modal.js';
import { toastOk, toastWarn, toastError } from '../core/toast.js';
import { escapeHtml } from '../core/dom.js';
import { compareVersion, currentVersion } from '../core/version.js';

const REPO = { owner: 'xxx1-sg', repo: 'Viridiore' };
const DISMISS_KEY = 'mossy.update.dismissed';

export { currentVersion };

export function hasDesktopUpdater() {
  return typeof window !== 'undefined' && !!(window.desktop && window.desktop.updater);
}

export function isNativePlatform() {
  return (
    typeof window !== 'undefined' &&
    !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  );
}

function isNative() {
  return typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
}

function openExternal(url) {
  if (!url) return;
  try {
    if (isNative()) window.open(url, '_system');
    else window.open(url, '_blank', 'noopener');
  } catch {
    window.location.href = url;
  }
}

export async function fetchLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error(`GitHub 返回 ${res.status}`);
  const d = await res.json();
  const apk = (d.assets || []).find((a) => /\.apk$/i.test(a.name));
  return {
    latest: String(d.tag_name || '').replace(/^v/i, ''),
    url: d.html_url || '',
    notes: d.body || '',
    apkUrl: apk ? apk.browser_download_url : null
  };
}

/** 统一入口：返回 { channel:'desktop'|'github', ... } */
export async function checkForUpdate() {
  if (hasDesktopUpdater()) {
    const r = await window.desktop.updater.check();
    return { channel: 'desktop', ...r };
  }
  const info = await fetchLatestRelease();
  return {
    channel: 'github',
    available: compareVersion(info.latest, currentVersion()) > 0,
    current: currentVersion(),
    ...info
  };
}

function dismiss(v) {
  try {
    localStorage.setItem(DISMISS_KEY, v);
  } catch {
    /* ignore */
  }
}
function isDismissed(v) {
  try {
    return localStorage.getItem(DISMISS_KEY) === v;
  } catch {
    return false;
  }
}

function promptGithubUpdate(info) {
  openModal({
    title: `发现新版本 v${info.latest}`,
    desc: `当前 v${currentVersion()}。下载安装包后覆盖安装即可。`,
    body: `<div style="white-space:pre-wrap;font-size:13px;line-height:1.6;max-height:240px;overflow:auto">${escapeHtml(
      info.notes || '（无更新说明）'
    )}</div>`,
    actions: [
      { label: '稍后', variant: 'ghost', onClick: () => dismiss(info.latest) },
      {
        label: '去下载',
        variant: 'primary',
        onClick: () => {
          dismiss(info.latest);
          openExternal(info.apkUrl || info.url);
        }
      }
    ]
  });
}

function promptDesktopRestart(version) {
  openModal({
    title: '更新已下载',
    desc: `新版本${version ? ` v${version}` : ''}已就绪，重启应用后生效。`,
    actions: [
      { label: '稍后', variant: 'ghost' },
      {
        label: '立即重启',
        variant: 'primary',
        onClick: () => {
          window.desktop?.updater?.install?.();
        }
      }
    ]
  });
}

/** 设置页「检查更新」按钮调用 */
export async function manualCheck() {
  try {
    const info = await checkForUpdate();
    if (info.channel === 'desktop') {
      if (!info.ok) {
        toastWarn(`当前环境不支持自动更新${info.reason ? `：${info.reason}` : ''}`);
        return { channel: 'desktop', ok: false, reason: info.reason };
      }
      const available = !!info.version && compareVersion(info.version, currentVersion()) > 0;
      if (available) toastOk(`发现新版本 v${info.version}，正在后台下载…`);
      else toastOk('已是最新版本');
      return { channel: 'desktop', ok: true, available, version: info.version };
    }
    if (info.available) promptGithubUpdate(info);
    else toastOk('已是最新版本');
    return { channel: 'github', available: info.available, version: info.latest };
  } catch (err) {
    toastError(`检查更新失败：${err?.message || err}`);
    return { error: String(err?.message || err) };
  }
}

/** 启动时调用一次：桌面订阅进度；手机/网页静默检查（可被「稍后」忽略） */
export function initUpdater() {
  if (isNativePlatform()) return; // 手机端由 liveupdate.js（Capgo）处理
  if (hasDesktopUpdater()) {
    window.desktop.updater.onStatus?.((p) => {
      if (!p) return;
      if (p.state === 'available') toastOk(`发现新版本${p.version ? ` v${p.version}` : ''}，正在后台下载…`);
      else if (p.state === 'ready') promptDesktopRestart(p.version);
    });
    return;
  }
  checkForUpdate()
    .then((info) => {
      if (info.channel === 'github' && info.available && !isDismissed(info.latest)) promptGithubUpdate(info);
    })
    .catch(() => {});
}
