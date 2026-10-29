/** 应用入口 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

import { themeManager } from './core/theme.js';
import { mountShell } from './components/shell.js';
import { registerPage, setContainer, start } from './router.js';
import { ensureWeather } from './state.js';
import { toastError } from './core/toast.js';

import home from './pages/home.js';
import weather from './pages/weather.js';
import chase from './pages/chase.js';
import trail from './pages/trail.js';
import settings from './pages/settings.js';

/**
 * 只注册四个主功能 + 设置。
 * 已下架的模块（SOS / 队友 / 气压 / 装备 / 路书 / AI 对话）
 * 整目录移到了 src/pages/experimental/，不参与构建，
 * 需要时再逐个评估，不放回导航。
 */
[home, chase, trail, weather, settings].forEach(registerPage);

function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  setTimeout(() => splash.remove(), 600);
}

function registerServiceWorker() {
  const isHttp = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isHttp || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('[sw] 注册失败', err));
  });
}

function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__installPrompt = e;
  });
}

async function boot() {
  themeManager.init();
  captureInstallPrompt();

  const root = document.getElementById('app');
  const shell = mountShell(root);
  setContainer(shell.pageRoot);

  // 首屏数据（不阻塞渲染）
  ensureWeather().catch((err) => console.warn('[boot] 天气预取失败', err));

  await start(shell.pageRoot, 'home');
  hideSplash();
  registerServiceWorker();

  // 全局错误提示
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[unhandledrejection]', e.reason);
  });
}

window.addEventListener('error', (e) => {
  console.error('[global error]', e.error || e.message);
});

boot().catch((err) => {
  console.error('[boot] 启动失败', err);
  const splash = document.getElementById('boot-splash');
  if (splash) splash.innerHTML = `<div style="color:#fff;text-align:center;padding:24px">
    <div style="font-size:18px;margin-bottom:8px">应用启动失败</div>
    <div style="font-size:12px;opacity:.75;max-width:320px">${err.message}</div>
  </div>`;
  toastError('应用启动失败，请刷新重试');
});
