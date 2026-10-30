/**
 * 运行时配置
 * 优先级：本地设置（App 内「设置」页）> 构建时环境变量 > 默认值
 */

const env = import.meta.env || {};

const DEFAULTS = {
  qweather: {
    key: env.VITE_QWEATHER_KEY || '',
    host: env.VITE_QWEATHER_HOST || 'https://devapi.qweather.com',
    geoHost: env.VITE_QWEATHER_GEOHOST || 'https://geoapi.qweather.com'
  },
  app: {
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1.0',
    city: '深圳',
    location: { lat: 22.5431, lon: 114.0579, name: '深圳' }
  }
};

const SETTINGS_KEY = 'mossy.config';

function readOverrides() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function deepMerge(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!extra || typeof extra !== 'object') return out;
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null || v === '') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] || {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

let current = deepMerge(DEFAULTS, readOverrides());

export const config = {
  get all() {
    return current;
  },
  get(key, fallback) {
    const parts = key.split('.');
    let node = current;
    for (const p of parts) {
      if (node == null) return fallback;
      node = node[p];
    }
    return node === undefined || node === '' ? fallback : node;
  },
  set(patch) {
    const overrides = deepMerge(readOverrides(), patch);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(overrides));
    current = deepMerge(DEFAULTS, overrides);
    return current;
  },
  reset() {
    localStorage.removeItem(SETTINGS_KEY);
    current = deepMerge(DEFAULTS, {});
  },
  hasQWeather() {
    const key = current.qweather.key;
    return !!key && !/^YOUR_/.test(key);
  },
  /**
   * 主数据源说明。
   * v2.2 起追光与天气默认走 Open-Meteo（免费、无需注册、提供气压层），
   * 和风 Key 变成可选增强项，不再是"能不能用"的开关。
   */
  weatherSource() {
    return this.hasQWeather() ? 'Open-Meteo + 和风天气' : 'Open-Meteo';
  }
};

export const DEMO_LOCATION = DEFAULTS.app.location;
