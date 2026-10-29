/**
 * 叙事层：把轨迹 + 天气 + 时间 + 地点，变成一句人愿意转发的话
 *
 * 这里刻意不用大模型做主路径：
 *   · 数据本来就是结构化的（时间、海拔、气温、风向都在手边），
 *     模板拼装的信息密度反而高于模型自由发挥；
 *   · 离线可用，山上有信号的概率远低于没有；
 *   · 不会编造不存在的细节——户外内容一旦编造，"记得住"就变成"不可信"。
 *
 * 配置了大模型后，可以在模板生成的句子基础上做润色（refineWithLLM），
 * 但模板永远是兜底，模型只是可选增强。
 */
import { formatTime } from '../core/format.js';

const PERIOD = [
  [5, '凌晨'],
  [8, '清晨'],
  [11, '上午'],
  [14, '正午'],
  [17, '下午'],
  [19, '傍晚'],
  [24, '夜里']
];

export function periodOf(date) {
  const h = new Date(date).getHours();
  for (const [max, label] of PERIOD) if (h < max) return label;
  return '夜里';
}

/** 风向 → "风从海上来"这类体感描述 */
function windStory(windDir, windScale) {
  const scale = Number(String(windScale).match(/\d+/)?.[0] ?? 0);
  if (!windDir) return '';
  if (scale >= 6) return '风大得站不稳';
  if (/东|南/.test(windDir)) return '风从海上来';
  if (/北/.test(windDir)) return '北风带着凉意';
  if (scale <= 2) return '几乎没有风';
  return `${windDir}吹着`;
}

/**
 * 主体叙事
 * @param {object} p
 * @param {object} p.trail   轨迹记录
 * @param {object} p.weather 当时的天气快照（可为空）
 * @param {object} p.mountain 山峰
 * @param {string} p.mode    sunrise | cloudsea | stars | hike
 */
export function buildNarrative({ trail = {}, weather = null, mountain = {}, mode = 'hike' }) {
  const start = new Date(trail.startedAt || Date.now());
  const end = new Date(trail.endedAt || Date.now());
  const stats = trail.stats || {};
  const now = weather?.now || {};
  const place = mountain.name || trail.mountainName || '山里';
  const elevation = mountain.elevation || stats.maxEle || null;
  const period = periodOf(start);

  const dateText = `${start.getMonth() + 1} 月 ${start.getDate()} 日`;

  // 只陈述能确证的事实：我们不知道用户到底看没看到日出，
  // 所以默认只用"赶在天亮前上了山"这类不会说谎的说法。
  const verb =
    mode === 'cloudsea'
      ? '等到了一场云海'
      : mode === 'sunrise'
        ? '守到了日出'
        : mode === 'stars'
          ? '看到了一整个银河'
          : mode === 'dawn'
            ? '赶在天亮前上了山'
            : '走完了一段山路';

  const bits = [];
  bits.push(`${dateText}${period}`);
  bits.push(formatTime(start, false).slice(0, 5));
  bits.push(`你在${place}${verb}`);

  if (elevation) bits.push(`海拔 ${elevation} 米`);
  if (now.temp !== undefined) bits.push(`气温 ${now.temp}℃`);
  const wind = windStory(now.windDir, now.windScale);
  if (wind) bits.push(wind);

  const headline = bits.join('，').replace(/，(\d{2}:\d{2})$/, ' $1') + '。';

  const detail = [];
  if (stats.distanceKm) detail.push(`${Number(stats.distanceKm).toFixed(1)} 公里`);
  if (stats.elevation?.gain) detail.push(`累计爬升 ${stats.elevation.gain} 米`);
  const hours = (end - start) / 3600000;
  if (hours > 0.1 && hours < 30) detail.push(`用时 ${hours.toFixed(1)} 小时`);

  return {
    headline,
    detail: detail.join(' · '),
    tags: buildTags({ mode, weather, elevation }),
    meta: {
      date: dateText,
      time: formatTime(start, false).slice(0, 5),
      place,
      elevation,
      coord: trail.points?.[0] ? `${trail.points[0].lat.toFixed(4)}, ${trail.points[0].lon.toFixed(4)}` : '',
      temp: now.temp,
      weather: now.text || ''
    }
  };
}

function buildTags({ mode, weather, elevation }) {
  const tags = [];
  if (mode !== 'hike') tags.push({ sunrise: '日出', cloudsea: '云海', stars: '星空' }[mode]);
  if (Number(elevation) >= 900) tags.push('千米峰');
  const vis = Number(weather?.now?.vis);
  if (Number.isFinite(vis) && vis >= 15) tags.push('通透');
  if (weather?.now?.text) tags.push(weather.now.text);
  return tags.filter(Boolean).slice(0, 3);
}

/**
 * 和上一次比：轨迹页的情绪抓手不是"你走了 6.2 公里"，
 * 而是"你今天比上次多爬了 200 米"。
 */
export function compareWithPrevious(current, previous) {
  if (!previous || !current) return null;
  const a = current.stats || {};
  const b = previous.stats || {};
  const dGain = (a.elevation?.gain || 0) - (b.elevation?.gain || 0);
  const dDist = (a.distanceKm || 0) - (b.distanceKm || 0);

  if (Math.abs(dGain) >= 30) {
    return dGain > 0
      ? `比上次多爬了 ${Math.round(dGain)} 米，进步了。`
      : `比上次少爬 ${Math.abs(Math.round(dGain))} 米，这次是收着走的。`;
  }
  if (Math.abs(dDist) >= 0.5) {
    return dDist > 0
      ? `比上次多走了 ${dDist.toFixed(1)} 公里。`
      : `比上次短 ${Math.abs(dDist).toFixed(1)} 公里，轻松一些。`;
  }
  return '和上次强度相当，稳定输出。';
}

/** 年度回顾：留存靠这个，不靠打卡积分 */
export function annualRecap(trails = []) {
  if (!trails.length) return null;
  const year = new Date().getFullYear();
  const rows = trails.filter((t) => new Date(t.startedAt).getFullYear() === year);
  if (!rows.length) return null;

  const km = rows.reduce((s, t) => s + (t.stats?.distanceKm || 0), 0);
  const gain = rows.reduce((s, t) => s + (t.stats?.elevation?.gain || 0), 0);
  const dawn = rows.filter((t) => new Date(t.startedAt).getHours() < 8).length;
  const months = new Set(rows.map((t) => new Date(t.startedAt).getMonth()));

  return {
    year,
    count: rows.length,
    km: Number(km.toFixed(1)),
    gain: Math.round(gain),
    dawn,
    months: months.size,
    text: `${year} 年你上山 ${rows.length} 次，累计 ${km.toFixed(1)} 公里、爬升 ${Math.round(gain)} 米，其中 ${dawn} 次是为了赶天亮出门。`
  };
}

/**
 * 可选：用大模型润色（配置了 LLM 才生效，失败静默回落模板）
 */
export async function refineWithLLM(narrative, llmAnswer) {
  if (typeof llmAnswer !== 'function') return narrative;
  try {
    const text = await llmAnswer({
      system: '你是户外记录者。只做润色，不得添加原文没有的事实、数字或地点。输出一句话，不超过 60 字。',
      user: `润色下面这句话，保持事实不变：\n${narrative.headline}`
    });
    const clean = String(text || '').trim().replace(/^["「]|["」]$/g, '');
    if (clean.length >= 12 && clean.length <= 90) return { ...narrative, headline: clean, refined: true };
  } catch {
    /* 静默失败，用模板 */
  }
  return narrative;
}
