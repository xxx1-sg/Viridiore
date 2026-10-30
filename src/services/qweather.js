/**
 * 和风天气 API 客户端
 * 文档：https://dev.qweather.com/docs/api/
 * 免费版需使用控制台分配的个人 API Host（形如 https://xxxx.re.qweatherapi.com）
 */
import { config } from '../config.js';

const TIMEOUT = 9000;

class WeatherError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WeatherError';
    this.code = code;
  }
}

function buildUrl(host, path, params) {
  const url = new URL(host.replace(/\/$/, '') + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  return url.toString();
}

async function request(host, path, params) {
  const key = config.get('qweather.key');
  if (!key) throw new WeatherError('未配置和风天气 Key', 'NO_KEY');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(buildUrl(host, path, { ...params, key }), {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    /*
     * 和风的错误有两层：HTTP 状态码 + body 里的 error / code。
     * 2024 年后新账号都会拿到专属 Host（xxx.re.qweatherapi.com），
     * 用错 Host 时返回的是 403 + "Invalid Host"——光看状态码只会写"接口返回 403"，
     * 用户根本不知道要去哪改。这里把 body 里的 title 翻成可操作的提示。
     */
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const title = body?.error?.title || '';
      if (/invalid host/i.test(title)) {
        throw new WeatherError(
          '和风拒绝了当前 API Host。请到控制台「项目管理」复制你项目的专属 Host（形如 https://xxxxxx.re.qweatherapi.com），填到设置页的 API Host 里。',
          'INVALID_HOST'
        );
      }
      if (res.status === 401 || /unauthor/i.test(title)) {
        throw new WeatherError('和风 Key 无效或已被停用，请到控制台确认项目状态。', 'BAD_KEY');
      }
      throw new WeatherError(`接口返回 ${res.status}${title ? `（${title}）` : ''}`, `HTTP_${res.status}`);
    }

    const data = await res.json();
    if (String(data.code) !== '200') {
      throw new WeatherError(`和风天气返回 ${data.code}`, String(data.code));
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new WeatherError('请求超时', 'TIMEOUT');
    if (err instanceof WeatherError) throw err;
    throw new WeatherError(err.message || '网络错误', 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 规范化用户填的 Host：补协议、去结尾斜杠。
 * 控制台里复制出来常是 abcdefg.re.qweatherapi.com（没协议），
 * 直接塞进 fetch 会报 "Failed to parse URL"，这里统一兜住。
 */
function normalizeHost(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withProto.replace(/\/+$/, '');
}

const apiHost = () => normalizeHost(config.get('qweather.host')) || 'https://devapi.qweather.com';

/**
 * GeoAPI 的落点随账号类型变：
 *   老账号 —— geoapi.qweather.com + /v2/city/lookup
 *   新账号 —— 专属 Host + /geo/v2/city/lookup（没有独立的 geo 域名）
 * 用户手动填了 geoHost 就按填的来，否则按 API Host 是否专属域名推断。
 */
function geoEndpoint() {
  const explicit = normalizeHost(config.get('qweather.geoHost'));
  const host = apiHost();
  if (explicit) return { host: explicit, path: '/v2/city/lookup' };
  if (/\.re\.qweatherapi\.com/i.test(host)) return { host, path: '/geo/v2/city/lookup' };
  return { host: 'https://geoapi.qweather.com', path: '/v2/city/lookup' };
}

export const qweather = {
  now: (lon, lat) => request(apiHost(), '/v7/weather/now', { location: `${lon},${lat}`, lang: 'zh' }),
  hourly24: (lon, lat) => request(apiHost(), '/v7/weather/24h', { location: `${lon},${lat}`, lang: 'zh' }),
  daily7: (lon, lat) => request(apiHost(), '/v7/weather/7d', { location: `${lon},${lat}`, lang: 'zh' }),
  air: (lon, lat) => request(apiHost(), '/v7/air/now', { location: `${lon},${lat}`, lang: 'zh' }),
  warnings: (lon, lat) => request(apiHost(), '/v7/warning/now', { location: `${lon},${lat}`, lang: 'zh' }),
  indices: (lon, lat) =>
    request(apiHost(), '/v7/indices/1d', { location: `${lon},${lat}`, type: '0', lang: 'zh' }),
  sun: (lon, lat, date) => request(apiHost(), '/v7/astronomy/sun', { location: `${lon},${lat}`, date, lang: 'zh' }),
  cityLookup: (keyword) => {
    const { host, path } = geoEndpoint();
    return request(host, path, { location: keyword, number: 8, lang: 'zh' });
  }
};

export { WeatherError };
