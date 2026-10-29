/** 基于 hash 的路由（Electron file:// 与 Capacitor 下同样可靠） */
import { prefsStore, bus } from './core/store.js';

const routes = new Map();
let container = null;
let currentId = null;
let currentCleanup = null;
let booting = null;

export function registerPage(page) {
  routes.set(page.id, page);
}

export function getPages() {
  return [...routes.values()];
}

export function currentPageId() {
  return currentId;
}

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [id, ...rest] = raw.split('?');
  return { id: id || 'home', query: rest.join('?') };
}

export function setContainer(el) {
  container = el;
}

function buildPage(page) {
  const section = document.createElement('section');
  section.className = 'page';
  section.id = `page-${page.id}`;
  section.setAttribute('aria-label', page.title || page.id);
  section.innerHTML = page.template ? page.template() : '';
  container.appendChild(section);
  page.el = section;
  page.mounted = false;
  return section;
}

async function activate(id, { replace = false } = {}) {
  const page = routes.get(id) || routes.get('home');
  if (!page) return;

  if (id === currentId && page.mounted) return;

  currentCleanup?.();
  currentCleanup = null;

  [...container.children].forEach((child) => child.classList.remove('is-active'));

  const section = page.el || buildPage(page);
  section.classList.add('is-active');

  document.title = `${page.title} · 晓山青`;

  if (!page.mounted) {
    try {
      currentCleanup = (await page.mount?.(section)) || null;
    } catch (err) {
      console.error('[router] 页面挂载失败', id, err);
      section.innerHTML = `<div class="empty"><div class="empty__title">页面加载失败</div><div class="empty__desc">${err.message}</div></div>`;
    }
    page.mounted = true;
  } else {
    page.onShow?.(section);
  }

  currentId = page.id;
  prefsStore.set({ lastPage: page.id });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  bus.emit('route:change', page.id);

  if (!replace && location.hash !== `#/${page.id}`) {
    history.replaceState(null, '', `#/${page.id}`);
  }
}

export function navigate(id, options) {
  const page = routes.get(id);
  if (!page) return;
  if (location.hash === `#/${id}`) {
    activate(id, options);
  } else {
    location.hash = `#/${id}`;
  }
}

export function start(containerEl, defaultId = 'home') {
  container = containerEl;
  window.addEventListener('hashchange', () => {
    const { id } = parseHash();
    activate(id);
  });
  const { id } = parseHash();
  booting = activate(routes.has(id) ? id : defaultId);
  return booting;
}

export function refresh() {
  if (currentId) activate(currentId);
}
