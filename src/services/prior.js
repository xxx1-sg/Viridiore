/**
 * 先验重估逻辑（纯函数，Node 与浏览器通用，方便单测）
 *
 * 回测样本足够时，用「每月每模式」的实测成立率替换经验先验；
 * 样本不足的月份**沿用经验先验**，并用收缩（shrinkage）避免小样本噪声。
 *
 * 收缩公式（每格）：p = (hits + k·p0) / (n + k)，k = strength（先验强度，等效样本数）。
 * 当 n < minPerMonth 时直接保留 p0 —— 数据不够就不改，而不是拿几个样本瞎调。
 */
import { BUILTIN_PRIORS } from '../data/priors.js';

export const PRIOR_MODES = ['cloudsea', 'sunrise', 'stars'];

function monthIndex(date) {
  const m = Number(String(date || '').slice(5, 7));
  return m >= 1 && m <= 12 ? m - 1 : null;
}

const round4 = (v) => Math.round(v * 1e4) / 1e4;

/**
 * @param {Array<{mode:string,date:string,observed:0|1}>} entries 已按 ruleVersion 过滤好的对账条目
 * @param {{builtin?:object,minPerMonth?:number,strength?:number}} opts
 * @returns {{priors:object, stats:object}}
 */
export function derivePriors(entries, opts = {}) {
  const builtin = opts.builtin || BUILTIN_PRIORS;
  const minPerMonth = opts.minPerMonth ?? 30;
  const strength = opts.strength ?? 30;

  const acc = {};
  for (const mode of PRIOR_MODES) {
    acc[mode] = Array.from({ length: 12 }, () => ({ n: 0, hits: 0 }));
  }

  for (const e of entries || []) {
    if (!e || !acc[e.mode]) continue;
    const mi = monthIndex(e.date);
    if (mi == null) continue;
    const obs = Number(e.observed);
    if (obs !== 0 && obs !== 1) continue;
    acc[e.mode][mi].n += 1;
    acc[e.mode][mi].hits += obs;
  }

  const priors = {};
  const stats = {};
  for (const mode of PRIOR_MODES) {
    priors[mode] = [];
    stats[mode] = [];
    for (let m = 0; m < 12; m += 1) {
      const { n, hits } = acc[mode][m];
      const p0 = builtin[mode]?.[m] ?? 0.1;
      let p = p0;
      const used = n >= minPerMonth && n > 0;
      if (used) p = (hits + strength * p0) / (n + strength);
      priors[mode].push(round4(p));
      stats[mode].push({
        month: m + 1,
        n,
        empirical: n ? round4(hits / n) : null,
        prior: p0,
        used
      });
    }
  }

  return { priors, stats };
}

/** 生成可写回 src/data/priors.js 的源码文本 */
export function renderPriorsModule(priors, meta, builtin = BUILTIN_PRIORS) {
  return `/**
 * 月度基准率先验 —— 由 scripts/forecast/prior.mjs 自动生成，请勿手改。
 * 重新生成：npm run ledger:prior -- --write
 */
export const PRIOR_META = ${JSON.stringify(meta, null, 2)};

export const BUILTIN_PRIORS = ${JSON.stringify(builtin, null, 2)};

export const PRIORS = ${JSON.stringify(priors, null, 2)};
`;
}
