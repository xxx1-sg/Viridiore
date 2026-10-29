/**
 * 追光概率的本地校准
 *
 * 思路很简单：模型给出的概率只是先验 + 物理证据，必须用真实结果收敛。
 * 用户每次上山后点一下"看到了 / 白跑一趟"，就是一条带标签的样本——
 * 这是别人没有的数据飞轮，而且完全存在本机，不需要后端、不涉及隐私。
 *
 * 校准方式：收缩估计（shrinkage）。样本少时几乎不影响模型，样本多了才逐步生效。
 *   offset = n/(n+8) × [ logit(实测命中率) − logit(模型平均预测) ]
 */
import { safeAll, safePut } from '../core/db.js';
import { logit, clamp } from './atmos.js';

const STORE = 'feedback';
const SHRINK_K = 8;
const MAX_OFFSET = 0.9;

let cache = null;

async function ensure() {
  if (!cache) cache = await safeAll(STORE);
  return cache;
}

/** 记录一次反馈（同一天同一模式只保留最新一条） */
export async function recordFeedback({ mountainId, mode, date, predicted, observed, source = 'demo' }) {
  const record = {
    id: `${mountainId}_${mode}_${date}`,
    mountainId,
    mode,
    date,
    predicted: Math.round(Number(predicted) || 0),
    observed: observed ? 1 : 0,
    source,
    ts: Date.now()
  };
  await safePut(STORE, record);
  if (cache) {
    const i = cache.findIndex((r) => r.id === record.id);
    if (i >= 0) cache[i] = record;
    else cache.push(record);
  }
  return record;
}

/** 取某个山峰 + 模式下的校准偏移（log-odds） */
export async function calibrationFor(mountainId, mode) {
  const all = await ensure();
  const rows = all.filter((r) => r.mountainId === mountainId && r.mode === mode);
  if (!rows.length) return { offset: 0, n: 0, hitRate: null, meanPredicted: null };

  const hits = rows.reduce((s, r) => s + (r.observed ? 1 : 0), 0);
  const meanPred = rows.reduce((s, r) => s + r.predicted, 0) / rows.length / 100;
  const hitRate = hits / rows.length;
  const shrink = rows.length / (rows.length + SHRINK_K);
  const raw = logit(hitRate) - logit(meanPred);

  return {
    offset: clamp(raw * shrink, -MAX_OFFSET, MAX_OFFSET),
    n: rows.length,
    hitRate,
    meanPredicted: meanPred,
    // 样本不足时不解释，避免误导
    note:
      rows.length < 3
        ? `已收集 ${rows.length} 次反馈，满 3 次开始参与校准`
        : `基于你的 ${rows.length} 次反馈：实测命中 ${Math.round(hitRate * 100)}%，模型平均预测 ${Math.round(
            meanPred * 100
          )}%`
  };
}

/** 全部山峰的反馈条数（设置页展示） */
export async function feedbackStats() {
  const all = await ensure();
  return { total: all.length, rows: all };
}

export function invalidateCalibrationCache() {
  cache = null;
}
