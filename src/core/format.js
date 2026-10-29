/** 格式化工具 */

export const pad2 = (n) => String(n).padStart(2, '0');

export const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatDate(ts, withWeek = false) {
  const d = new Date(ts);
  const base = `${d.getMonth() + 1}月${d.getDate()}日`;
  return withWeek ? `${base} ${WEEK[d.getDay()]}` : base;
}

export function formatTime(ts, seconds = false) {
  const d = new Date(ts);
  return seconds
    ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60e3) return '刚刚';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)} 小时前`;
  if (diff < 7 * 86400e3) return `${Math.floor(diff / 86400e3)} 天前`;
  return formatDate(ts);
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

export function humanDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatElevation(m) {
  return `${Math.round(m || 0)} m`;
}

export function formatPace(msPerKm) {
  if (!Number.isFinite(msPerKm) || msPerKm <= 0) return '--';
  const total = Math.round(msPerKm / 1000);
  return `${Math.floor(total / 60)}'${pad2(total % 60)}"`;
}

export function formatCoord(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '--';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}°${ns} ${Math.abs(lon).toFixed(5)}°${ew}`;
}

export function formatCoordShort(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '定位中';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export function moonPhaseName(phase) {
  const p = Number(phase);
  if (Number.isNaN(p)) return '';
  if (p < 0.03 || p > 0.97) return '新月';
  if (p < 0.22) return '娥眉月';
  if (p < 0.28) return '上弦月';
  if (p < 0.47) return '盈凸月';
  if (p < 0.53) return '满月';
  if (p < 0.72) return '亏凸月';
  if (p < 0.78) return '下弦月';
  return '残月';
}

/** 依据时段给出问候 */
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return '夜色正浓';
  if (h < 8) return '晨光初现';
  if (h < 11) return '山气清朗';
  if (h < 14) return '日正当中';
  if (h < 17) return '林荫正好';
  if (h < 19) return '暮色将至';
  return '星河在上';
}

export function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}
