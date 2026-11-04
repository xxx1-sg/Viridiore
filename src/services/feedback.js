/**
 * 反馈样本：匿名化、校验、汇总、合并
 *
 * 这是「数据飞轮」的搬运层，刻意做成**纯函数**，两处共用同一份逻辑：
 *   · 浏览器端（设置页「导出反馈样本」）——只导出，不上传；
 *   · Node 端（scripts/forecast/ingest-feedback.mjs）——把收到的文件合并进台账。
 *
 * 隐私边界写死在这里：
 *   样本只保留 mountainId / mode / date / predicted / observed / source / ts，
 *   **不包含**轨迹坐标、设备信息、账号或任何自由文本。多余字段一律丢弃。
 */

export const FEEDBACK_SCHEMA = 1;
export const FEEDBACK_KIND = 'xiaoshanqing-feedback';
export const FEEDBACK_MODES = ['cloudsea', 'sunrise', 'stars'];

const MODE_SET = new Set(FEEDBACK_MODES);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 只保留白名单字段，并做类型收敛；这是"匿名化"的唯一入口 */
export function toAnonymousSample(row = {}) {
  return {
    mountainId: String(row.mountainId ?? '').trim(),
    mode: String(row.mode ?? '').trim(),
    date: String(row.date ?? '').trim(),
    predicted: Math.round(Number(row.predicted) || 0),
    observed: row.observed ? 1 : 0,
    source: String(row.source ?? 'live'),
    ts: Number(row.ts) || 0
  };
}

/** 单条样本是否可参与统计 */
export function isValidSample(s = {}) {
  return (
    typeof s.mountainId === 'string' &&
    s.mountainId.length > 0 &&
    MODE_SET.has(s.mode) &&
    DATE_RE.test(s.date) &&
    Number.isInteger(s.predicted) &&
    s.predicted >= 0 &&
    s.predicted <= 100 &&
    (s.observed === 0 || s.observed === 1)
  );
}

/**
 * 去重键：同一用户同一天同一模式只应有一条；但不同用户可能对同一山/日给不同预测，
 * 所以把 predicted/observed/ts 也纳入键，避免把不同来源误合并。
 * 同一个导出文件被导入两次时，键相同 → 幂等。
 */
export function sampleKey(s = {}) {
  return [s.mountainId, s.mode, s.date, s.predicted, s.observed, s.ts].join('|');
}

/** 汇总：条数、分模式、命中率、平均预测、Brier、日期范围 */
export function summarizeSamples(rows = []) {
  const samples = rows.map(toAnonymousSample).filter(isValidSample);
  const n = samples.length;
  const byMode = {};
  let hits = 0;
  let sumPred = 0;
  let sumBrier = 0;
  let from = null;
  let to = null;

  for (const s of samples) {
    byMode[s.mode] = (byMode[s.mode] || 0) + 1;
    hits += s.observed ? 1 : 0;
    sumPred += s.predicted;
    sumBrier += (s.predicted / 100 - s.observed) ** 2;
    if (!from || s.date < from) from = s.date;
    if (!to || s.date > to) to = s.date;
  }

  return {
    n,
    byMode,
    hitRate: n ? hits / n : null,
    meanPredicted: n ? sumPred / n / 100 : null,
    brier: n ? sumBrier / n : null,
    dateRange: from ? { from, to } : null
  };
}

/** 构造一份可导出的匿名 bundle */
export function buildExportBundle(rows = [], meta = {}) {
  const samples = rows.map(toAnonymousSample).filter(isValidSample);
  return {
    schema: FEEDBACK_SCHEMA,
    kind: FEEDBACK_KIND,
    basis: 'user',
    exportedAt: meta.exportedAt || new Date().toISOString(),
    appVersion: meta.appVersion || null,
    note: '匿名反馈样本：仅含山峰 id、模式、日期、预测概率与结果；不含轨迹坐标、设备信息或账号。',
    summary: summarizeSamples(samples),
    samples
  };
}

/** 校验一份外部 bundle；返回可入库的样本 */
export function validateBundle(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['不是 JSON 对象'], samples: [] };
  if (obj.kind && obj.kind !== FEEDBACK_KIND) errors.push(`kind 不是 ${FEEDBACK_KIND}`);
  if (!Array.isArray(obj.samples)) errors.push('缺少 samples 数组');
  const raw = Array.isArray(obj.samples) ? obj.samples : [];
  const samples = [];
  let dropped = 0;
  for (const r of raw) {
    const s = toAnonymousSample(r);
    if (isValidSample(s)) samples.push(s);
    else dropped += 1;
  }
  if (dropped) errors.push(`${dropped} 条样本字段不合法，已跳过`);
  return { ok: samples.length > 0, errors, samples };
}

/** 合并两组样本，按 sampleKey 去重（幂等） */
export function mergeSamples(existing = [], incoming = []) {
  const map = new Map();
  for (const row of [...existing, ...incoming]) {
    const s = toAnonymousSample(row);
    if (!isValidSample(s)) continue;
    map.set(sampleKey(s), s);
  }
  return [...map.values()];
}
