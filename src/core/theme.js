/** 主题管理：浅色 / 深色 / 跟随系统 */
import { prefsStore, bus } from './store.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

let mode = prefsStore.get('theme', 'auto');

function resolved(m = mode) {
  return m === 'auto' ? (mq.matches ? 'dark' : 'light') : m;
}

function apply() {
  const theme = resolved();
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c1411' : '#f5f2ea');
  bus.emit('theme:change', { mode, theme });
}

export const themeManager = {
  init() {
    apply();
    mq.addEventListener('change', () => {
      if (mode === 'auto') apply();
    });
  },
  get mode() {
    return mode;
  },
  get theme() {
    return resolved();
  },
  set(next) {
    mode = next;
    prefsStore.set({ theme: next });
    apply();
  },
  cycle() {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    this.set(next);
    return next;
  },
  label(m = mode) {
    return { auto: '跟随系统', light: '浅色', dark: '深色' }[m] || '跟随系统';
  }
};
