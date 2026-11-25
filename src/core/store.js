/**
 * 数据仓库层 + 轻量事件总线 + 本地设置
 */
import { idb, safeAll, safePut } from './db.js';
import { config } from '../config.js';

const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---------------- 事件总线 ---------------- */
const listeners = new Map();

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
  emit(event, payload) {
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.warn('[bus]', event, err);
      }
    });
  }
};

/* ---------------- 本地设置（轻量偏好） ---------------- */
const PREF_KEY = 'mossy.prefs';

const defaultPrefs = {
  theme: 'auto',
  voice: true,
  notifications: false,
  autoRefresh: true,
  units: 'metric',
  lastPage: 'home',
  onboarded: false,
  homeCity: '深圳'
};

let prefs = { ...defaultPrefs };

try {
  prefs = { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
} catch {
  prefs = { ...defaultPrefs };
}

export const prefsStore = {
  get all() {
    return { ...prefs };
  },
  get(key, fallback) {
    return prefs[key] === undefined ? fallback : prefs[key];
  },
  set(patch) {
    prefs = { ...prefs, ...patch };
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    bus.emit('prefs:change', prefs);
    return prefs;
  }
};

/* ---------------- 轨迹 ---------------- */
export const trailRepo = {
  async list() {
    const items = await safeAll('trails');
    return items.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  },
  async save(trail) {
    const record = {
      id: trail.id || uid('trail'),
      name: trail.name || '未命名轨迹',
      points: trail.points || [],
      stats: trail.stats || {},
      startedAt: trail.startedAt || Date.now(),
      endedAt: trail.endedAt || Date.now(),
      note: trail.note || ''
    };
    await safePut('trails', record);
    bus.emit('trail:change', record);
    return record;
  },
  async remove(id) {
    await idb.remove('trails', id).catch(() => {});
    bus.emit('trail:change', null);
  },
  async get(id) {
    return idb.get('trails', id).catch(() => null);
  }
};

/* ---------------- 通用缓存（带 TTL） ---------------- */
export const cacheRepo = {
  async get(key) {
    const item = await idb.get('cache', key).catch(() => null);
    if (!item) return null;
    if (item.expireAt && item.expireAt < Date.now()) return null;
    return item.value;
  },
  async set(key, value, ttlSeconds = 600) {
    await safePut('cache', {
      key,
      value,
      expireAt: Date.now() + ttlSeconds * 1000
    });
    return value;
  },
  async clear() {
    await idb.clear('cache').catch(() => {});
  }
};

/** 一键清除 */
export async function clearAllData() {
  for (const store of ['trails', 'feedback', 'cache']) {
    await idb.clear(store).catch(() => {});
  }
  prefsStore.set({ onboarded: true });
}

export { uid, config };
