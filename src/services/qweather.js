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
    if (!res.ok) throw new WeatherError(`接口返回 ${res.status}`, `HTTP_${res.status}`);
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

const apiHost = () => config.get('qweather.host', 'https://devapi.qweather.com');
const geoHost = () => config.get('qweather.geoHost', 'https://geoapi.qweather.com');

export const qweather = {
  now: (lon, lat) => request(apiHost(), '/v7/weather/now', { location: `${lon},${lat}`, lang: 'zh' }),
  hourly24: (lon, lat) => request(apiHost(), '/v7/weather/24h', { location: `${lon},${lat}`, lang: 'zh' }),
  daily7: (lon, lat) => request(apiHost(), '/v7/weather/7d', { location: `${lon},${lat}`, lang: 'zh' }),
  air: (lon, lat) => request(apiHost(), '/v7/air/now', { location: `${lon},${lat}`, lang: 'zh' }),
  warnings: (lon, lat) => request(apiHost(), '/v7/warning/now', { location: `${lon},${lat}`, lang: 'zh' }),
  indices: (lon, lat) =>
    request(apiHost(), '/v7/indices/1d', { location: `${lon},${lat}`, type: '0', lang: 'zh' }),
  sun: (lon, lat, date) => request(apiHost(), '/v7/astronomy/sun', { location: `${lon},${lat}`, date, lang: 'zh' }),
  cityLookup: (keyword) => request(geoHost(), '/v2/city/lookup', { location: keyword, number: 8, lang: 'zh' })
};

export { WeatherError };
