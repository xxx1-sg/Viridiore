/**
 * 图标库：全部内联 SVG，离线可用、跟随 currentColor
 * 风格：1.7 描边、圆角端点，与整套视觉统一
 */

const P = {
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunrise: '<path d="M12 2v6"/><path d="m8 6 4-4 4 4"/><path d="M2 18h2M20 18h2M4.2 13.2l1.4 1.4M18.4 14.6l1.4-1.4"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M2 22h20"/>',
  sunset: '<path d="M12 8V2"/><path d="m8 6 4 4 4-4"/><path d="M2 18h2M20 18h2M4.2 13.2l1.4 1.4M18.4 14.6l1.4-1.4"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M2 22h20"/>',
  moon: '<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 19Z"/>',
  cloudSun: '<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2"/><path d="M15 10a4 4 0 1 0-3.5 4"/><path d="M18 20a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 8 13.5 3.2 3.2 0 0 0 9 20Z"/>',
  cloudRain: '<path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 15Z"/><path d="M8 19v2M12 18v3M16 19v2"/>',
  cloudSnow: '<path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 15Z"/><path d="M8 18h.01M12 21h.01M16 18h.01M9 21h.01M15 21h.01"/>',
  cloudStorm: '<path d="M17.5 14a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 6.5 3.5 3.5 0 0 0 7 14Z"/><path d="m13 11-3 5h4l-2 5"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14M7 21h10"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h8"/>',
  droplet: '<path d="M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z"/>',
  gauge: '<path d="M12 14 8.5 9.5"/><circle cx="12" cy="14" r="1"/><path d="M4 18a9 9 0 1 1 16 0"/>',
  thermometer: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
  navigation: '<path d="m3 11 19-8-8 19-2.5-7.5Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6"/>',
  mountain: '<path d="m2 20 7-14 4 8 2.5-4L22 20Z"/><path d="m9 6 1.5 3"/>',
  tent: '<path d="M4 21 12 4l8 17"/><path d="M8 21l4-8 4 8"/><path d="M2 21h20"/>',
  backpack: '<path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><path d="M9 4V3a3 3 0 0 1 6 0v1"/><path d="M9 12h6M9 16h6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.1a4 4 0 0 1 0 7.75"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  alert: '<path d="m12 3 9 16a1 1 0 0 1-.9 1.5H3.9A1 1 0 0 1 3 19Z"/><path d="M12 9v4M12 17h.01"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M2 13h2M20 13h2"/>',
  sparkles: '<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4h6v3"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16.5 12l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 7.2 2 2 0 0 1 6.5 3Z"/>',
  message: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  square: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 3.2-2.1M19 12.9a10 10 0 0 0-2.4-1.7"/><path d="M2 8.8a15 15 0 0 1 5-2.6M22 8.8a15 15 0 0 0-6.4-2.7"/><path d="M12 20h.01"/>',
  battery: '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/><path d="M5 11v2M8 11v2"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
  star: '<path d="m12 3 2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.7l6.2-.8Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M12 20S3 14.5 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8C21 14.5 12 20 12 20Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  spark: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  minus: '<path d="M5 12h14"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  footprint: '<path d="M6 16c0-3 1-7 3-7s2 3 1 5-1 4-2.5 4S6 17 6 16Z"/><path d="M15 13c0-3 1-7 3-7s2 3 1 5-1 4-2.5 4S15 14 15 13Z"/>'
};

const ALIAS = {
  weather: 'cloudSun',
  ai: 'bot',
  gear: 'backpack',
  teammate: 'users',
  roadbook: 'route',
  trail: 'footprint',
  sos: 'alert',
  pressure: 'gauge',
  chase: 'sunrise',
  home: 'home',
  settings: 'settings'
};

export function icon(name, size = 18, extraClass = '') {
  const path = P[name] || P[ALIAS[name]] || P.info;
  return `<svg class="${extraClass}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function brandMark(size = 34) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bm-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5c946e"/><stop offset="0.55" stop-color="#33604a"/><stop offset="1" stop-color="#1b3427"/>
      </linearGradient>
      <linearGradient id="bm-s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe6ad"/><stop offset="1" stop-color="#e9a95e"/>
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="url(#bm-g)"/>
    <circle cx="27" cy="13" r="4.6" fill="url(#bm-s)" opacity="0.95"/>
    <path d="M4 31.5 13.5 17l5.2 8.2 3.3-4.6L36 31.5Z" fill="#0f2018" opacity="0.92"/>
    <path d="m8.5 31.5 5-8 3.2 5.2" stroke="#7fb894" stroke-width="1.1" stroke-linecap="round" opacity="0.6" fill="none"/>
  </svg>`;
}

/* ---------- 天气图标：按和风天气 code 映射 ---------- */
const WX_MAP = [
  { test: (c) => c === 100, kind: 'sun', label: '晴' },
  { test: (c) => c === 150, kind: 'moon', label: '晴' },
  { test: (c) => c === 151 || c === 152 || c === 153, kind: 'cloud', label: '多云' },
  { test: (c) => [101, 102, 103, 151, 152, 153].includes(c), kind: 'cloudSun', label: '多云' },
  { test: (c) => c === 104, kind: 'cloud', label: '阴' },
  { test: (c) => c >= 200 && c < 300, kind: 'wind', label: '风' },
  { test: (c) => c >= 300 && c < 400, kind: 'cloudRain', label: '雨' },
  { test: (c) => c >= 400 && c < 500, kind: 'cloudSnow', label: '雪' },
  { test: (c) => c >= 500 && c < 516, kind: 'fog', label: '雾霾' },
  { test: (c) => c >= 302 && c < 305, kind: 'cloudStorm', label: '雷雨' }
];

const WX_LABELS = {
  100: '晴', 101: '多云', 102: '少云', 103: '晴间多云', 104: '阴',
  150: '晴', 153: '晴间多云', 300: '阵雨', 301: '强阵雨', 302: '雷阵雨',
  303: '强雷阵雨', 304: '雷阵雨伴冰雹', 305: '小雨', 306: '中雨', 307: '大雨',
  308: '极端降雨', 309: '毛毛雨', 310: '暴雨', 311: '大暴雨', 312: '特大暴雨',
  313: '冻雨', 314: '小到中雨', 315: '中到大雨', 316: '大到暴雨', 317: '暴雨到大暴雨',
  318: '大暴雨到特大暴雨', 399: '雨', 400: '小雪', 401: '中雪', 402: '大雪',
  403: '暴雪', 404: '雨夹雪', 405: '雨雪天气', 406: '阵雨夹雪', 407: '阵雪',
  408: '小到中雪', 409: '中到大雪', 410: '大到暴雪', 499: '雪', 500: '薄雾',
  501: '雾', 502: '霾', 503: '扬沙', 504: '浮尘', 507: '沙尘暴', 508: '强沙尘暴',
  509: '浓雾', 510: '强浓雾', 511: '中度霾', 512: '重度霾', 513: '严重霾',
  514: '大雾', 515: '特强浓雾', 900: '热', 901: '冷', 999: '未知'
};

export function weatherIcon(code, size = 24) {
  const c = Number(code);
  const entry = WX_MAP.find((m) => m.test(c));
  return icon(entry ? entry.kind : 'cloud', size);
}

export function weatherKind(code) {
  const c = Number(code);
  const entry = WX_MAP.find((m) => m.test(c));
  return entry ? entry.kind : 'cloud';
}

export function weatherText(code) {
  return WX_LABELS[Number(code)] || '未知';
}

export const ICON_NAMES = Object.keys(P);
