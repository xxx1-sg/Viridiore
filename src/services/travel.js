/**
 * 出行方案：把「选哪座山 + 从哪里出发 + 当天天气」折算成
 * 交通方式、出发时间与装备 / 安全建议。
 *
 * 数据边界（和整个产品一致：不编造）：
 *   · 距离取出发地到山顶的直线距离，再乘道路系数折成「参考里程」；
 *     耗时按城市道路平均速度分段估算，界面一律标注「参考」，实际以导航为准。
 *   · 公交 / 地铁站点是人工整理的固定信息，不接实时班次，
 *     也不写具体线路号与票价，避免给出会过期的错误。
 *   · 出发时间由 services/sun.js 的真实日出 / 日落倒推，不是拍脑袋。
 */
import { haversine } from './geo.js';
import { sunTimes } from './sun.js';
import { summitTemp } from './chase.js';

/** 直线距离 → 参考道路里程的放大系数（绕行、上下山道路） */
const ROAD_FACTOR = 1.4;

/** 参考平均速度（km/h）：近程多在市区，远途走快速路 / 高速 */
function averageSpeed(roadKm) {
  if (roadKm < 12) return 24;
  if (roadKm < 30) return 38;
  if (roadKm < 60) return 55;
  return 68;
}

/** 出发地 → 山峰的参考里程与自驾耗时 */
export function estimateRoad(from, mountain) {
  if (!from || !Number.isFinite(from.lat) || !Number.isFinite(from.lon)) return null;
  const straightKm =
    haversine({ lat: from.lat, lon: from.lon }, { lat: mountain.lat, lon: mountain.lon }) / 1000;
  const roadKm = straightKm * ROAD_FACTOR;
  const speed = averageSpeed(roadKm);
  const minutes = Math.max(5, Math.round(((roadKm / speed) * 60) / 5) * 5);
  return { straightKm, roadKm, minutes };
}

/** 公共交通参考耗时：地铁约 1.9 倍自驾，公交约 2.4 倍，无直达返回 null */
function transitMinutes(level, driveMinutes) {
  if (!driveMinutes) return null;
  if (level === 'metro') return Math.round((driveMinutes * 1.9) / 5) * 5;
  if (level === 'bus') return Math.round((driveMinutes * 2.4) / 5) * 5;
  return null;
}

/**
 * 出发时间倒推
 * 云海 / 日出：日出前 30 分钟到顶；星空：日落后 45 分钟到顶。
 * 登山口出发 = 到顶时间 − 登山参考用时 ascentHours。
 */
export function departurePlan({ mountain, day, mode = 'cloudsea' }) {
  const dateObj = day?.dateObj instanceof Date ? day.dateObj : new Date(day?.date || Date.now());
  const sun = sunTimes(dateObj, mountain.lat, mountain.lon);
  const ascentHours = mountain.travel?.ascentHours ?? Math.max(1, mountain.route.hours * 0.55);

  let summitAt = null;
  if (mode === 'stars') {
    if (sun.sunset) summitAt = new Date(sun.sunset.getTime() + 45 * 60000);
  } else if (sun.sunrise) {
    summitAt = new Date(sun.sunrise.getTime() - 30 * 60000);
  }
  if (!summitAt) return { sun, ascentHours, summitAt: null, trailheadAt: null };
  const trailheadAt = new Date(summitAt.getTime() - ascentHours * 3600000);
  return { sun, ascentHours, summitAt, trailheadAt };
}

/**
 * 生成完整出行方案
 * @returns {{
 *   road: {straightKm:number, roadKm:number, minutes:number}|null,
 *   plan: {sun:object, ascentHours:number, summitAt:Date|null, trailheadAt:Date|null, homeAt:Date|null},
 *   modes: Array, trailheads: string[], gear: string[], safety: string[],
 *   warnings: Array<{tone:string,text:string}>, summit: number|null
 * }}
 */
export function buildTravelPlan({ mountain, day, mode = 'cloudsea', from }) {
  const t = mountain.travel || {};
  const road = estimateRoad(from, mountain);
  const level = t.transit?.level || 'none';
  const plan = departurePlan({ mountain, day, mode });

  // 家里出发 = 登山口出发 − (自驾耗时 + 10 分钟停车缓冲)
  let homeAt = null;
  if (plan.trailheadAt && road) {
    homeAt = new Date(plan.trailheadAt.getTime() - (road.minutes + 10) * 60000);
  }

  // 装备 / 安全：固定项 + 按当天天气追加
  const gear = new Set(t.gear || []);
  const safety = [...(t.safety || [])];
  const warnings = [];
  let summit = null;

  if (day) {
    summit = summitTemp(day, mountain.elevation);
    const pop = Number(day.pop);
    if (Number.isFinite(pop) && pop >= 40) {
      gear.add('雨具 / 防水外套');
      warnings.push({ tone: 'warn', text: `当天降水概率 ${pop}%，山路湿滑，下撤时间要留足` });
    }
    const ws = Number(day.windScale);
    if (Number.isFinite(ws) && ws >= 4) {
      gear.add('防风外套');
      warnings.push({ tone: 'warn', text: `山顶预报风力约 ${ws} 级，注意防风、站稳` });
    }
    if (summit != null && summit <= 10) {
      gear.add('保暖层 / 抓绒');
      warnings.push({ tone: 'info', text: `山顶约 ${summit}℃，比山下明显更冷，带够保暖` });
    }
  }

  const transitLabel = level === 'metro' ? '地铁可达' : level === 'bus' ? '需换乘' : '建议自驾';
  const transitTone = level === 'metro' ? 'moss' : level === 'bus' ? 'warn' : 'danger';
  const tm = transitMinutes(level, road?.minutes);

  const modes = [
    {
      key: 'drive',
      name: '自驾',
      icon: 'navigation',
      badge: '直达登山口',
      tone: 'moss',
      recommended: level === 'none',
      meta: road ? `约 ${road.roadKm.toFixed(0)} km · 约 ${road.minutes} 分钟` : '开启定位后可估算',
      detail: `${t.drive?.nav || '导航至登山口'}${t.drive?.parking ? `；${t.drive.parking}` : ''}`
    },
    {
      key: 'transit',
      name: '公共交通',
      icon: 'route',
      badge: transitLabel,
      tone: transitTone,
      recommended: level === 'metro',
      meta: tm ? `约 ${tm} 分钟（参考）` : level === 'none' ? '无直达' : '需换乘',
      detail: `${t.transit?.label || '—'}${t.transit?.note ? `；${t.transit.note}` : ''}`
    },
    {
      key: 'taxi',
      name: '打车 / 拼车',
      icon: 'phone',
      badge: '灵活',
      tone: 'info',
      recommended: false,
      meta: road ? `车程约 ${road.minutes} 分钟` : '—',
      detail: t.taxi || '回程车辆需提前安排'
    }
  ];

  return {
    road,
    plan: { ...plan, homeAt },
    modes,
    trailheads: t.trailheads || [],
    gear: [...gear],
    safety,
    warnings,
    summit
  };
}
