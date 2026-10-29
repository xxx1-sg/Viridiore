/**
 * DOM / 字符串小工具
 */

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/** 事件委托：在 root 上监听，匹配 [data-action] */
export function delegate(root, type, handler) {
  const listener = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !root.contains(target)) return;
    handler(e, target.dataset.action, target);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

export function on(root, selector, type, handler) {
  const el = typeof selector === 'string' ? root.querySelector(selector) : selector;
  if (!el) return () => {};
  el.addEventListener(type, handler);
  return () => el.removeEventListener(type, handler);
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function rafThrottle(fn) {
  let queued = false;
  let lastArgs;
  return (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** 让数字从 0 滚动到目标值 */
export function countUp(el, to, { duration = 700, decimals = 0, suffix = '' } = {}) {
  if (!el) return;
  const from = 0;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = from + (to - from) * eased;
    el.textContent = val.toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const isTouch = () =>
  typeof window !== 'undefined' && (window.matchMedia('(hover: none)').matches || 'ontouchstart' in window);
