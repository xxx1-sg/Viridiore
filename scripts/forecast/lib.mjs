/**
 * 预测台账 · 共用工具
 *
 * 设计前提：台账**复用 App 的同一份 src/services**（openmeteo / chase / sun / atmos），
 * 不另写一套算法。否则账本和界面迟早对不上，而"账本和界面不一致"比没有账本更糟。
 *
 * 这些模块都是纯函数、不碰 DOM，所以 Node 端可以直接 import。
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(HERE, '..', '..');
export const FORECAST_DIR = path.join(ROOT, 'data', 'forecast');
export const VERIFIED_DIR = path.join(ROOT, 'data', 'verified');
export const LEDGER_JSON = path.join(ROOT, 'data', 'ledger.json');
export const LEDGER_MD = path.join(ROOT, 'data', 'ledger.md');

/**
 * 判定规则的版本号。规则一改就 +1，旧的 verified 文件保持原样、不重判。
 * v2：星空改用夜间窗口（20:00–次日 06:00）判定，不再复用日出窗口。
 *     旧 stars 记录 ruleVersion=1，报告与校准时排除，避免新旧口径混算。
 */
export const RULE_VERSION = 2;

/** 台账 schema 版本 */
export const SCHEMA = 1;

export const TIMEZONE = 'Asia/Shanghai';

/* ---------------- 日期 ---------------- */

/** 深圳本地日期 YYYY-MM-DD。CI 跑在 UTC，不能直接用 new Date().toISOString() */
export function shDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** 深圳本地时间 HH:mm */
export function shTime(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/* ---------------- 文件 ---------------- */

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readText(file) {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function listJsonFiles(dir) {
  try {
    const names = await readdir(dir);
    return names.filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

/* ---------------- 哈希链 ---------------- */

/** 键排序的稳定序列化：同样的内容永远得到同样的哈希 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function sha256(value) {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : stableStringify(value))
    .digest('hex');
}

/** 取上一份文件的哈希，形成 prev 链：文档被改过，链就断了 */
export async function previousHash(dir, before = '9999-99-99') {
  const files = (await listJsonFiles(dir)).filter((f) => f.slice(0, 10) < before);
  if (!files.length) return { prevFile: null, prev: null };
  const last = files[files.length - 1];
  const raw = await readText(path.join(dir, last));
  return { prevFile: last, prev: raw ? sha256(raw) : null };
}

/* ---------------- 网络 ---------------- */

/**
 * Open-Meteo 免费额度够用，但偶发 429 / 5xx。重试两次，仍失败就抛错——
 * 台账宁可缺一天，也不能写一条来源不明记录。
 */
export async function fetchJson(url, { tries = 3, timeout = 25000 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.error) throw new Error(json.reason || '接口返回错误');
      return json;
    } catch (err) {
      lastError = err;
      if (attempt < tries) await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  throw lastError || new Error('请求失败');
}

/* ---------------- 判定规则 ---------------- */

/**
 * 「这次预言算不算成立」的判定规则。
 *
 * 三件必须说清的事：
 * 1. 判的是**气象条件是否成立**，不是"你有没有看到"。所以 basis 恒为 reanalysis，
 *    和用户打卡（basis: user）分开统计，绝不合并成一个数字。
 * 2. 阈值写在这里、版本号写进每条记录。将来改了规则，旧记录仍按旧版解释。
 * 3. 逆温这一维**无法用再分析验证**：Open-Meteo 的 ERA5 归档不提供 850/925 hPa
 *    温度（实测全部返回 null，单位是 undefined）。所以该项标 degraded，不参与判定，
 *    并在报告里如实写明"逆温维度未经验证"。
 */
export const JUDGE = {
  cloudsea: {
    minLowCloud: 25, // 低云覆盖率下限，与 chase.js 的 hasLayer 一致
    minMargin: 50, // 云顶至少低于山顶 50 m，才算"在云上"
    maxPrecip: 0.5 // 观测窗内累计降水上限（mm）
  },
  sunrise: {
    maxLowCloud: 65, // 低云压住东方地平线
    maxPrecip: 0.5,
    minMargin: -50 // 云顶高过山顶 50 m 以内还算有窗口
  },
  stars: {
    maxCloud: 30,
    maxLowCloud: 25,
    maxPrecip: 0.2
  }
};

/**
 * 判定一次预言是否成立
 * @returns {{observed: 0|1, checks: Array, degraded: string[], verdict: string}}
 */
export function judge(mode, { geometry, inversion, precip, cloud, elevation }) {
  const checks = [];
  const degraded = [];

  const push = (key, ok, text) => checks.push({ key, ok: !!ok, text });

  if (mode === 'cloudsea') {
    const { minLowCloud, minMargin, maxPrecip } = JUDGE.cloudsea;
    const margin = Math.round(elevation - geometry.top);

    push('低云成片', geometry.hasLayer, `低云 ${Math.round(geometry.cloudLow)}%（需 ≥ ${minLowCloud}%）`);
    push('云顶低于山顶', margin >= minMargin, `云顶约 ${Math.round(geometry.top)} m，山顶 ${elevation} m，差 ${margin} m`);
    push('无降水', precip <= maxPrecip, `观测窗降水 ${precip.toFixed(1)} mm`);

    if (inversion?.available) {
      push('逆温', inversion.index >= 0.35, `${inversion.label}（指数 ${inversion.index.toFixed(2)}）`);
    } else {
      degraded.push('inv');
    }
  }

  if (mode === 'sunrise') {
    const { maxLowCloud, maxPrecip, minMargin } = JUDGE.sunrise;
    const margin = Math.round(elevation - geometry.top);

    push('无降水', precip <= maxPrecip, `观测窗降水 ${precip.toFixed(1)} mm`);
    push('低云不挡地平线', geometry.cloudLow < maxLowCloud, `低云 ${Math.round(geometry.cloudLow)}%`);
    push('不在云里', margin > minMargin, `云顶与山顶相差 ${margin} m`);
    degraded.push('inv');
  }

  if (mode === 'stars') {
    const { maxCloud, maxLowCloud, maxPrecip } = JUDGE.stars;
    push('云量通透', cloud < maxCloud, `总云量 ${Math.round(cloud)}%`);
    push('低层无遮挡', geometry.cloudLow < maxLowCloud, `低云 ${Math.round(geometry.cloudLow)}%`);
    push('无降水', precip <= maxPrecip, `观测窗降水 ${precip.toFixed(1)} mm`);
    degraded.push('inv');
  }

  const observed = checks.every((c) => c.ok) ? 1 : 0;
  const failed = checks.filter((c) => !c.ok).map((c) => c.key);

  return {
    observed,
    checks,
    degraded: [...new Set(degraded)],
    verdict: observed ? '成立' : `未成立（${failed.join('、')}）`
  };
}

/* ---------------- 输出 ---------------- */

export function log(...args) {
  console.log(...args);
}

export function hhmmLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
