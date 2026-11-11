/**
 * 台账 · 对账
 *
 * 把过去某天"当时怎么说"和"实际怎么样"对上，写成 data/verified/<date>.json。
 *
 * 三条底线：
 * 1. 只用**再分析**（ERA5 归档）当真值，绝不用预报的 past_days —— 那是同一套模式自己验自己。
 * 2. 判的是「气象条件是否成立」，不是「你有没有看到」。basis 恒为 reanalysis，
 *    日后和用户打卡（basis: user）分开统计。
 * 3. 同一目标日可能有多次预言（D-3 说的、D-1 说的），全部单独对账，
 *    这样才能回答"提前几天开始准"。
 *
 * 已知局限（写在这里，也写进 ledger.md）：
 *   Open-Meteo 的 ERA5 归档**不提供 850 / 925 hPa 温度**（实测全部 null，
 *   单位字段是 undefined），所以逆温这一维无法回测，记录里标 degraded: ['inv']。
 *   云量分层、地面温湿、降水、风这几维是可以验证的——而它们正是云海判据的主体。
 *
 * 用法：
 *   node scripts/forecast/verify.mjs            # 对账所有待办日期（最多 7 天）
 *   node scripts/forecast/verify.mjs --date 2026-10-30
 *   node scripts/forecast/verify.mjs --dry      # 只看会写什么，不落盘
 */
import path from 'node:path';
import { MOUNTAINS } from '../../src/data/mountains.js';
import { cloudGeometry } from '../../src/services/chase.js';
import { inversionProfile } from '../../src/services/atmos.js';
import { sunTimes } from '../../src/services/sun.js';
import { parseLocal } from '../../src/services/openmeteo.js';
import {
  FORECAST_DIR,
  VERIFIED_DIR,
  SCHEMA,
  RULE_VERSION,
  shDate,
  addDays,
  readJson,
  writeJson,
  listJsonFiles,
  previousHash,
  judge,
  fetchJson,
  log
} from './lib.mjs';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const HOURLY = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'precipitation',
  'wind_speed_10m'
].join(',');

const MAX_DAYS = 7;
const round = (v, n = 0) => {
  if (!Number.isFinite(Number(v))) return null;
  const p = 10 ** n;
  return Math.round(Number(v) * p) / p;
};

/** null / '' / NaN 统一成 undefined：cloudGeometry 里 Number(null) === 0，会把缺数据当成"零云" */
const num = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function parseArgs(argv) {
  const out = { dry: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--date') out.date = argv[i + 1];
    if (argv[i] === '--dry') out.dry = true;
  }
  return out;
}

/* ---------------- 读取待对账的预言 ---------------- */

async function loadPending() {
  const files = (await listJsonFiles(FORECAST_DIR)).filter((f) => f.endsWith('.json'));
  const verifiedFiles = new Set((await listJsonFiles(VERIFIED_DIR)).map((f) => f.slice(0, 10)));

  const byDate = new Map(); // targetDate -> entries[]
  const predictedDates = new Set();

  for (const file of files) {
    const fx = await readJson(path.join(FORECAST_DIR, file));
    if (!fx?.entries) continue;
    predictedDates.add(fx.date);
    for (const e of fx.entries) {
      if (!e.date) continue;
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push({ ...e, predictedOn: fx.date, modelVersion: fx.modelVersion });
    }
  }

  const today = shDate();
  return {
    byDate,
    pending: [...byDate.keys()]
      .filter((d) => d < today)
      .filter((d) => !verifiedFiles.has(d))
      .sort()
      .slice(-MAX_DAYS)
  };
}

/* ---------------- 再分析 ---------------- */

async function fetchArchive(lat, lon, start, end) {
  const url = new URL(ARCHIVE_URL);
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('hourly', HOURLY);
  url.searchParams.set('timezone', 'Asia/Shanghai');
  return fetchJson(url.toString(), { tries: 3, timeout: 40000 });
}

function ymdLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 观测窗内的逐时平均。
 * · 云海 / 日出：日出前 90 分钟 ~ 日出后 30 分钟；
 * · 星空：夜间窗口 20:00–次日 06:00（与 openmeteo 的 nightIdx 口径一致）。
 */
function windowStats(hourly, dateStr, lat, lon, mode = 'cloudsea') {
  const times = (hourly.time || []).map(parseLocal);
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayObj = new Date(y, m - 1, d, 12);

  const idx = [];
  if (mode === 'stars') {
    times.forEach((t, i) => {
      if (!t || ymdLocal(t) !== dateStr) return;
      const h = t.getHours();
      if (h >= 20 || h <= 6) idx.push(i);
    });
  } else {
    const sun = sunTimes(dayObj, lat, lon);
    if (!sun?.sunrise) return null;
    const from = new Date(sun.sunrise.getTime() - 90 * 60000);
    const to = new Date(sun.sunrise.getTime() + 30 * 60000);
    times.forEach((t, i) => {
      if (t && t >= from && t <= to) idx.push(i);
    });
  }
  if (!idx.length) return null;

  const pick = (key) => idx.map((i) => num(hourly[key]?.[i]));
  const avg = (list) => {
    const vals = list.filter((v) => v !== undefined);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : undefined;
  };
  const sum = (list) => list.filter((v) => v !== undefined).reduce((s, v) => s + v, 0);

  const precipList = pick('precipitation');
  const stats = {
    hours: idx.length,
    t2m: avg(pick('temperature_2m')),
    rh2m: avg(pick('relative_humidity_2m')),
    td2m: avg(pick('dew_point_2m')),
    cloud: avg(pick('cloud_cover')),
    cloudLow: avg(pick('cloud_cover_low')),
    cloudMid: avg(pick('cloud_cover_mid')),
    cloudHigh: avg(pick('cloud_cover_high')),
    precip: sum(precipList),
    windMs: avg(pick('wind_speed_10m')),
    sunrise: sun.sunrise
  };

  // 观测窗内全是空值 = 这天 ERA5 还没到位，返回 null 让上层标 pending
  const hasAny = ['t2m', 'cloud', 'cloudLow'].every((k) => stats[k] !== undefined);
  return hasAny ? stats : null;
}

/* ---------------- 单条对账 ---------------- */

function verifyEntry(entry, stats, mountain) {
  const soundings = {
    t2m: stats.t2m,
    td2m: stats.td2m,
    rh2m: stats.rh2m,
    cloudLow: stats.cloudLow,
    cloudMid: stats.cloudMid,
    cloudHigh: stats.cloudHigh,
    stationElevation: mountain.gridElevation ?? entry.inputs?.gridElevation ?? 30
    // rh850 归档不提供，cloudGeometry 会退回默认 70
  };

  const geo = cloudGeometry({ soundings, min: stats.t2m }, { valleyElevation: mountain.valleyElevation });
  const inv = inversionProfile({ t2m: stats.t2m, z2m: soundings.stationElevation });

  const result = judge(entry.mode, {
    geometry: geo,
    inversion: inv,
    precip: stats.precip ?? 0,
    cloud: stats.cloud ?? 0,
    elevation: entry.elevation || mountain.elevation
  });

  return {
    mountainId: entry.mountainId,
    mountain: entry.mountain,
    mode: entry.mode,
    date: entry.date,
    predictedOn: entry.predictedOn,
    leadDays: entry.leadDays,
    probability: entry.probability,
    baseRate: entry.baseRate,
    modelVersion: entry.modelVersion,
    observed: result.observed,
    verdict: result.verdict,
    basis: 'reanalysis',
    ruleVersion: RULE_VERSION,
    checks: result.checks,
    degraded: [...new Set([...result.degraded, 'rh850'])],
    actual: {
      cloudLow: round(stats.cloudLow),
      cloud: round(stats.cloud),
      cloudMid: round(stats.cloudMid),
      cloudHigh: round(stats.cloudHigh),
      t2m: round(stats.t2m, 1),
      td2m: round(stats.td2m, 1),
      cloudBase: round(geo.base),
      cloudTop: round(geo.top),
      margin: round((entry.elevation || mountain.elevation) - geo.top),
      precip: round(stats.precip, 1),
      windMs: round(stats.windMs, 1),
      hours: stats.hours
    }
  };
}

/* ---------------- 主流程 ---------------- */

async function main() {
  const args = parseArgs(process.argv);
  const { byDate, pending } = await loadPending();

  const targets = args.date ? [args.date] : pending;
  if (!targets.length) {
    log('没有待对账的日期。');
    return;
  }

  const usable = targets.filter((d) => byDate.has(d));
  if (!usable.length) {
    log(`待对账日期（${targets.join('、')}）在预测台账里没有对应记录。`);
    return;
  }

  log(`对账 ${usable.join('、')}`);

  // 每座山一次请求，覆盖全部待对账日期，减少额度消耗
  const start = usable[0];
  const end = usable[usable.length - 1];
  const archive = new Map();

  for (const m of MOUNTAINS) {
    try {
      const raw = await fetchArchive(m.lat, m.lon, start, end);
      archive.set(m.id, { hourly: raw.hourly || {}, elevation: num(raw.elevation) });
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      log(`  ! ${m.name} 归档取数失败：${err?.message || err}`);
    }
  }

  let written = 0;
  let pendingDays = [];

  for (const date of usable) {
    const rows = [];
    let missing = 0;

    for (const entry of byDate.get(date)) {
      const m = MOUNTAINS.find((x) => x.id === entry.mountainId);
      const arc = m && archive.get(m.id);
      if (!m || !arc) {
        missing += 1;
        continue;
      }
      const stats = windowStats(arc.hourly, date, m.lat, m.lon, entry.mode);
      if (!stats) {
        missing += 1;
        continue;
      }
      rows.push(verifyEntry(entry, stats, { ...m, gridElevation: arc.elevation }));
    }

    if (!rows.length) {
      pendingDays.push(date);
      continue;
    }

    const hits = rows.filter((r) => r.observed).length;
    const { prev, prevFile } = await previousHash(VERIFIED_DIR, date);

    const payload = {
      schema: SCHEMA,
      kind: 'verified',
      date,
      verifiedAt: new Date().toISOString(),
      basis: 'reanalysis',
      provider: 'archive-api.open-meteo.com (ERA5)',
      ruleVersion: RULE_VERSION,
      verifiedScope: ['cloud_layers', 'surface_temp_humidity', 'precipitation', 'wind'],
      unverifiedScope: ['pressure_level_temperature'],
      prev,
      prevFile,
      summary: {
        entries: rows.length,
        observed: hits,
        hitRate: Math.round((hits / rows.length) * 1000) / 1000,
        missing
      },
      entries: rows
    };

    if (args.dry) {
      log(`  [dry] ${date}：${rows.length} 条，成立 ${hits} 条（${Math.round((hits / rows.length) * 100)}%）`);
      continue;
    }

    const file = path.join(VERIFIED_DIR, `${date}.json`);
    if (await readJson(file)) {
      log(`  · ${date} 已对账，跳过（已写入的文件不重判）`);
      continue;
    }
    await writeJson(file, payload);
    written += 1;
    log(`  · ${date}：${rows.length} 条，成立 ${hits} 条（${Math.round((hits / rows.length) * 100)}%）`);
  }

  if (pendingDays.length) {
    log(`\n  ${pendingDays.join('、')} 的再分析数据还没到位（ERA5 通常延迟约 5 天），保持 pending。`);
  }
  log(written ? `\n已写入 ${written} 份对账文件。` : '\n本次没有新写入。');
}

main().catch((err) => {
  console.error('对账失败：', err);
  process.exit(1);
});
