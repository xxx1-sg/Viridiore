/** 应用外壳：顶栏 / 底部标签栏 */
import { icon, brandMark } from '../core/icons.js';
import { themeManager } from '../core/theme.js';
import { bus, prefsStore } from '../core/store.js';
import { confirmDialog } from '../core/modal.js';
import { toastOk } from '../core/toast.js';
import { navigate } from '../router.js';
import { appState } from '../state.js';

/**
 * 只有四个入口。
 * 砍掉的 SOS / 队友 / 气压 / 装备 / 路书 / AI 聊天不是"藏起来"，
 * 是从产品里移除——留着一个假 SOS 比没有 SOS 更危险。
 */
export const NAV_ITEMS = [
  { id: 'home', name: '首页', icon: 'home', desc: '今天值不值得上山' },
  { id: 'chase', name: '追光', icon: 'sunrise', desc: '日出 · 云海 · 星空概率' },
  { id: 'trail', name: '轨迹', icon: 'footprint', desc: 'GPS 记录与光之卡片' },
  { id: 'weather', name: '天气', icon: 'cloudSun', desc: '实时与七日预报' },
  { id: 'settings', name: '设置', icon: 'settings', desc: '数据源与偏好' }
];

const PRIMARY = NAV_ITEMS.filter((i) => i.id !== 'settings');

const navItemHtml = (item) => `<button class="topnav__item" type="button" data-nav="${item.id}">
    ${icon(item.icon, 16)}<span>${item.name}</span>
  </button>`;

const tabItemHtml = (item) => `<button class="tabbar__item" type="button" data-nav="${item.id}">
    ${icon(item.icon, 21)}<span>${item.name}</span>
  </button>`;

function dataSourceLabel() {
  const src = appState.weather?.source;
  if (src === 'live') return { text: '实时数据', tone: 'live' };
  if (src === 'demo') return { text: '演示数据', tone: 'demo' };
  return { text: navigator.onLine ? '在线' : '离线', tone: 'idle' };
}

export function mountShell(root) {
  root.innerHTML = `
    <header class="topbar" id="topbar">
      <div class="topbar__inner">
        <button class="brand" type="button" data-nav="home" aria-label="返回首页">
          <span class="brand__mark">${brandMark(34)}</span>
          <span class="brand__text">
            <span class="brand__name">晓山青</span>
            <span class="brand__sub">Viridiore</span>
          </span>
        </button>

        <nav class="topnav" aria-label="主导航">
          ${PRIMARY.map(navItemHtml).join('')}
        </nav>

        <div class="topbar__actions">
          <span class="net-pill" id="netPill" title="数据来源">离线</span>
          <button class="icon-btn" type="button" id="themeBtn" title="切换主题" aria-label="切换主题">
            ${icon('moon', 19)}
          </button>
          <button class="icon-btn" type="button" data-nav="settings" title="设置" aria-label="设置">
            ${icon('settings', 19)}
          </button>
        </div>
      </div>
    </header>

    <main class="main" id="page-root"></main>

    <nav class="tabbar" aria-label="底部导航">
      ${PRIMARY.map(tabItemHtml).join('')}
    </nav>
  `;

  const topbar = root.querySelector('#topbar');
  const netPill = root.querySelector('#netPill');
  const themeBtn = root.querySelector('#themeBtn');
  const pageRoot = root.querySelector('#page-root');

  root.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) navigate(navBtn.dataset.nav);
  });

  themeBtn.addEventListener('click', () => {
    const next = themeManager.cycle();
    const label = { auto: '跟随系统', light: '浅色模式', dark: '深色模式' }[next];
    toastOk(`已切换为${label}`);
    syncThemeIcon();
  });

  function syncThemeIcon() {
    const mode = themeManager.mode;
    const name = mode === 'auto' ? 'sparkles' : mode === 'dark' ? 'moon' : 'sun';
    themeBtn.innerHTML = icon(name, 19);
    themeBtn.title = `主题：${themeManager.label()}`;
  }

  /* 数据来源徽标：演示数据必须显式标注，不能让用户误以为是真实预报 */
  function syncNet() {
    const { text, tone } = dataSourceLabel();
    netPill.textContent = text;
    netPill.classList.toggle('is-offline', !navigator.onLine);
    netPill.classList.toggle('is-demo', tone === 'demo');
  }
  window.addEventListener('online', syncNet);
  window.addEventListener('offline', syncNet);
  bus.on('weather:change', syncNet);

  const onScroll = () => topbar.classList.toggle('is-stuck', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });

  bus.on('route:change', (id) => {
    root.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.nav === id);
    });
  });

  document.documentElement.addEventListener('theme:change', syncThemeIcon);

  syncNet();
  syncThemeIcon();
  onScroll();

  return { pageRoot };
}

/**
 * 首次进入：说清楚现在是什么状态，而不是画一个不存在的饼。
 */
export async function maybeShowIntro() {
  if (prefsStore.get('onboarded')) return;
  prefsStore.set({ onboarded: true });
  const go = await confirmDialog({
    title: '晓山青能帮你做什么',
    desc:
      '只做三件事：\n' +
      '· 追光 —— 告诉你明早几点、去哪座山、多大几率看到云海\n' +
      '· 轨迹 —— 记录走过的路，回来生成一张可保存的卡片\n' +
      '· 天气 —— 实时与七日预报，含气象预警\n\n' +
      '现在是演示数据。到「设置」填入和风天气的 Key，就会切换成真实预报。',
    confirmText: '填 Key',
    cancelText: '先看看',
    iconName: 'sparkles'
  });
  if (go) navigate('settings');
}
