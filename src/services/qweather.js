/**
 * 和风天气 API 客户端
 * 文档：https://dev.qweather.com/docs/api/
 * 免费版需使用控制台分配的个人 API Host（形如 https://xxxx.re.qweatherapi.com）
 */
import { config } from '../config.js';
import { aqiCategory } from './aqi.js';

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
      /*
       * 实测两种 403 表现：
       *  - 老的公共域名（devapi.qweather.com）：403 + JSON "Invalid Host"
       *  - 专属域名写错子域（xxx.re.qweatherapi.com）：403 + 空 body、零字节
       * 后者最容易被误判成"Key 失效"，其实 Key 根本没被读到，先把提示拉回来。
       */
      if (res.status === 403 && !title) {
        throw new WeatherError(
          '和风拒绝了当前 API Host（403 空响应）。多数情况是 Host 子域写错了：控制台里「凭据 ID」不等于「API Host」，请复制形如 https://abcdefg.re.qweatherapi.com 的专属域名。',
          'INVALID_HOST'
        );
      }
      if (/invalid host/i.test(title)) {
        throw new WeatherError(
          '和风拒绝了当前 API Host。请到控制台「项目管理」复制你项目的专属 Host（形如 https://xxxxxx.re.qweatherapi.com），填到设置页的 API Host 里。',
          'INVALID_HOST'
        );
      }
      if (res.status === 401 || /unauthor/i.test(title)) {
        throw new WeatherError('和风 Key 无效或已被停用，请到控制台确认项目状态。', 'BAD_KEY');
      }
      if (/deprecated/i.test(title)) {
        throw new WeatherError('和风已下线这个接口，请升级到新版接口。', 'DEPRECATED');
      }
      throw new WeatherError(`接口返回 ${res.status}${title ? `（${title}）` : ''}`, `HTTP_${res.status}`);
    }

    /*
     * v7 的响应体带 code:"200"，新版 API（airquality/v1、weatheralert/v1）
     * 不带这个字段——一刀切去校验 code 会把成功响应判成失败。
     */
    const data = await res.json();
    if (data.code !== undefined && String(data.code) !== '200') {
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

/* ---------------- 新版空气质量 API（airquality/v1） ---------------- */

/**
 * 和风 2024 年底停掉了 /v7/air/now（返回 403 Deprecated），
 * 换成坐标系式路径 /airquality/v1/current/{lat}/{lon}，
 * 返回的是污染物数组 + 分指数，没有 v7 时代的 aqi/category 平铺字段。
 */
const AIR_SPEC = [
  { code: 'pm2p5', key: 'pm25', name: 'PM2.5' },
  { code: 'pm10', key: 'pm10', name: 'PM10' },
  { code: 'o3', key: 'o3', name: 'O₃' },
  { code: 'no2', key: 'no2', name: 'NO₂' },
  { code: 'so2', key: 'so2', name: 'SO₂' },
  { code: 'co', key: 'co', name: 'CO' }
];

function pickChineseIndex(indexes = []) {
  return (
    indexes.find((i) => /cn-mee|qaqi|cn/i.test(String(i.code || ''))) ||
    indexes[0] ||
    null
  );
}

/** 把 airquality/v1 的响应整理成界面直接能用的形状 */
export function normalizeAir(data) {
  const idx = pickChineseIndex(data?.indexes);
  const aqi = Number(idx?.aqi);
  if (!Number.isFinite(aqi)) return null;

  const pollutants = AIR_SPEC.map((spec) => {
    const item = (data.pollutants || []).find((p) => p.code === spec.code);
    const value = Number(item?.concentration?.value);
    const sub = (item?.subIndexes || []).find((s) => /cn-mee|qaqi/i.test(String(s.code || ''))) || item?.subIndexes?.[0];
    return {
      key: spec.key,
      name: spec.name,
      unit: item?.concentration?.unit || 'μg/m³',
      value: Number.isFinite(value) ? Math.round(value * 10) / 10 : null,
      iaqi: Number.isFinite(Number(sub?.aqi)) ? Number(sub.aqi) : null
    };
  }).filter((p) => p.value !== null);

  const primaryRaw = idx.primaryPollutant?.name || idx.primaryPollutant?.code || '';
  const primary =
    /pm2p5/i.test(primaryRaw) ? 'PM2.5' :
    primaryRaw ? String(primaryRaw) : null;

  const tone = aqiCategory(aqi).tone;

  return {
    aqi: Math.round(aqi),
    category: idx.category || aqiCategory(aqi).label,
    level: String(idx.level ?? aqiCategory(aqi).level),
    // 优级（AQI ≤ 50）时和风不返回首要污染物，界面据此显示"各项均优于一级限值"
    primary,
    tone,
    standard: 'CN MEE',
    source: 'qweather',
    pollutants
  };
}

/** 把 weatheralert/v1 的预警整理成 bundle.warnings 的形状 */
export function normalizeWarnings(data) {
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  return alerts.map((a) => {
    const color = a.color;
    const severityColor =
      color && Number.isFinite(color.red)
        ? `rgb(${color.red}, ${color.green}, ${color.blue})`
        : '';
    // v1 给的是 minor / moderate / severe / extreme，界面按首字母大写匹配
    const sev = String(a.severity || '').toLowerCase();
    const severity = sev ? sev[0].toUpperCase() + sev.slice(1) : '';
    return {
      id: a.id,
      title: a.headline || a.eventType?.name || '气象预警',
      type: a.eventType?.code || '',
      typeName: a.eventType?.name || '预警',
      level: severity,
      severity,
      severityColor,
      pubTime: a.issuedTime || a.sentTime || '',
      startTime: a.effectiveTime || '',
      endTime: a.expireTime || '',
      sender: a.senderName || '',
      text: [a.description, a.instruction].filter(Boolean).join('\n\n'),
      provider: 'qweather'
    };
  });
}

export const qweather = {
  now: (lon, lat) => request(apiHost(), '/v7/weather/now', { location: `${lon},${lat}`, lang: 'zh' }),
  hourly24: (lon, lat) => request(apiHost(), '/v7/weather/24h', { location: `${lon},${lat}`, lang: 'zh' }),
  daily7: (lon, lat) => request(apiHost(), '/v7/weather/7d', { location: `${lon},${lat}`, lang: 'zh' }),

  /** 空气质量：国控站实测，返回已归一化的对象（失败时为 null） */
  async air(lat, lon) {
    const data = await request(apiHost(), `/airquality/v1/current/${lat.toFixed(4)}/${lon.toFixed(4)}`, {
      lang: 'zh'
    });
    return normalizeAir(data);
  },

  /** 气象预警：新版 weatheralert/v1，无预警时 alerts 为空数组 */
  async warnings(lat, lon) {
    const data = await request(apiHost(), `/weatheralert/v1/current/${lat.toFixed(4)}/${lon.toFixed(4)}`, {
      lang: 'zh'
    });
    return { warning: normalizeWarnings(data) };
  },

  indices: (lon, lat) =>
    request(apiHost(), '/v7/indices/1d', { location: `${lon},${lat}`, type: '0', lang: 'zh' }),
  sun: (lon, lat, date) => request(apiHost(), '/v7/astronomy/sun', { location: `${lon},${lat}`, date, lang: 'zh' }),
  cityLookup: (keyword) => {
    const { host, path } = geoEndpoint();
    return request(host, path, { location: keyword, number: 8, lang: 'zh' });
  }
};

export { WeatherError };
