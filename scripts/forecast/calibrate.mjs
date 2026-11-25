/**
 * 台账 · 回测校准分析
 *
 * 从 data/verified/*.json 学习每种模式的系统性偏差，拟合一个**保序**的概率校准：
 *     p_calibrated = sigmoid( a * logit(p_model) + b )     (a ≥ 0，保持排序)
 * 并报告校准前后的 Brier，以及「恒定基准率」的 Brier 作对照。
 *
 * 为什么要保序：首轮回测里云海 AUC≈0.77（因子有区分度）但概率高估；
 * 星空 AUC≈0.35（方向存疑）。直接加常数会把云海的真信号一起砸掉。
 *
 * 用法：
 *   node scripts/forecast/calibrate.mjs                    # 读 data/verified
 *   node scripts/forecast/calibrate.mjs --dir .tmp/verified
 *   node scripts/forecast/calibrate.mjs --write            # 写 data/calibration.json
 *
 * 口径：真值是 ERA5 再分析判定的「气象条件成立」，与用户打卡（basis:user）分开。
 */
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { readJson, writeJson, ROOT, RULE_VERSION, log } from './lib.mjs';
import { sigmoid, logit, clamp } from '../../src/services/atmos.js';

const MIN_SAMPLES = 100;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fixed = (v, n = 3) => (v == null ? '—' : Number(v).toFixed(n));
const base = (r) => clamp(Number(r.probability) / 100, 0.02, 0.96);
const apply = (p, a, b) => clamp(sigmoid(a * logit(p) + b), 0.02, 0.96);

function brier(rows, a, b) {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + (apply(base(r), a, b) - r.observed) ** 2, 0) / rows.length;
}

/** AUC：判断因子是否有区分度（0.5≈随机，<0.5 说明方向反了） */
function auc(rows) {
  const pos = rows.filter((r) => r.observed).map((r) => r.probability);
  const neg = rows.filter((r) => !r.observed).map((r) => r.probability);
  if (!pos.length || !neg.length) return null;
  let w = 0;
  for (const p of pos) for (const q of neg) {
    if (p > q) w += 1;
    else if (p === q) w += 0.5;
  }
  return w / (pos.length * neg.length);
}

/** 网格拟合 (a,b)，a 限制在 [0,2] 保持单调；a=0 表示退化为常数（纯基准率） */
function fit(rows) {
  let best = { a: 1, b: 0, brier: brier(rows, 1, 0) };
  for (let a = 0; a <= 2.0001; a += 0.05) {
    for (let b = -3; b <= 3.0001; b += 0.05) {
      const v = brier(rows, a, b);
      if (v < best.brier) best = { a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100, brier: v };
    }
  }
  return best;
}

async function main() {
  const dir = path.resolve(arg('--dir', path.join(ROOT, 'data', 'verified')));
  const write = process.argv.includes('--write');
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) {
    log(`没有找到对账文件：${dir}`);
    return;
  }

  const rowsByMode = new Map();
  let all = 0;
  for (const f of files) {
    const v = await readJson(path.join(dir, f));
    for (const e of v?.entries || []) {
      // 星空 RULE_VERSION 2 之前口径不同，排除旧记录
      if (e.mode === 'stars' && (e.ruleVersion ?? 1) < RULE_VERSION) continue;
      all += 1;
      if (!rowsByMode.has(e.mode)) rowsByMode.set(e.mode, []);
      rowsByMode.get(e.mode).push(e);
    }
  }

  log(`读取 ${files.length} 天，共 ${all} 条（${files[0].slice(0, 10)} ~ ${files[files.length - 1].slice(0, 10)}）\n`);
  log('| 模式 | 样本 | 基准率 | 平均预测 | AUC | Brier(前) | 拟合 a | 拟合 b | Brier(后) | 恒定基准 Brier |');
  log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  const platt = {};
  const detail = {};

  for (const mode of ['cloudsea', 'sunrise', 'stars']) {
    const rows = rowsByMode.get(mode) || [];
    if (!rows.length) continue;
    const n = rows.length;
    const br = rows.reduce((s, r) => s + r.observed, 0) / n;
    const meanPred = rows.reduce((s, r) => s + r.probability / 100, 0) / n;
    const before = brier(rows, 1, 0);
    const constBrier = rows.reduce((s, r) => s + (br - r.observed) ** 2, 0) / n;

    if (n < MIN_SAMPLES) {
      log(`| ${mode} | ${n} | ${pct(br)} | ${pct(meanPred)} | — | ${fixed(before)} | — | — | — | 样本不足 |`);
      continue;
    }
    const best = fit(rows);
    platt[mode] = { a: best.a, b: best.b };
    const aucVal = auc(rows);
    detail[mode] = { n, baseRate: br, meanPredicted: meanPred, auc: aucVal, brierBefore: before, brierAfter: best.brier, constBrier };
    log(
      `| ${mode} | ${n} | ${pct(br)} | ${pct(meanPred)} | ${fixed(aucVal)} | ${fixed(before)} | ${best.a} | ${best.b} | ${fixed(best.brier)} | ${fixed(constBrier)} |`
    );
  }

  log('');
  log('拟合结果（写入 data/calibration.json）：');
  log(JSON.stringify(platt, null, 2));

  if (write) {
    const out = path.join(ROOT, 'data', 'calibration.json');
    await writeJson(out, {
      kind: 'calibration',
      generatedAt: new Date().toISOString(),
      basis: 'reanalysis',
      samples: all,
      days: files.length,
      window: { from: files[0].slice(0, 10), to: files[files.length - 1].slice(0, 10) },
      form: 'p_calibrated = sigmoid(a * logit(p_model) + b)，a≥0 保持排序',
      platt,
      detail,
      note: '由 scripts/forecast/calibrate.mjs 从 data/verified 拟合；样本有限（首轮 7 天），样本变多后应重跑。'
    });
    log(`\n写入 ${out}`);
  }
}

main().catch((err) => {
  console.error('校准分析失败：', err);
  process.exit(1);
});
