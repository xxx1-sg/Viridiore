/** 轻提示 */
import { icon } from './icons.js';
import { escapeHtml } from './dom.js';

let layer = null;

function ensureLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement('div');
  layer.className = 'toast-layer';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'polite');
  document.body.appendChild(layer);
  return layer;
}

const ICONS = { ok: 'check', danger: 'alert', warn: 'alert', info: 'info' };

export function toast(message, options = {}) {
  const { type = 'info', duration = 2400 } = options;
  const host = ensureLayer();
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.innerHTML = `${icon(ICONS[type] || 'info', 15)}<span>${escapeHtml(message)}</span>`;
  host.appendChild(node);

  const remove = () => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 260);
  };
  const timer = setTimeout(remove, duration);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
  return remove;
}

export const toastOk = (msg, opt) => toast(msg, { ...opt, type: 'ok' });
export const toastWarn = (msg, opt) => toast(msg, { ...opt, type: 'warn' });
export const toastError = (msg, opt) => toast(msg, { ...opt, type: 'danger' });
