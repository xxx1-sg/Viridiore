/**
 * 台账 · 先验重估（方案 B 的执行器）
 *
 * 从 data/verified/ 的再分析对账结果里，统计「每月 × 每模式」的实测成立率，
 * 用它替换 src/data/priors.js 里的月度基准率先验。
 *
 * 三条底线：
 * 1. 只用 basis=reanalysis 且 ruleVersion 与当前规则一致的对账条目，不混新旧口径。
 * 2. **样本不足就不改**：需要总量与覆盖月份都达标，否则保留经验先验并退出。
 * 3. 单月样本不够时沿用经验先验；够则用收缩估计（避免小样本噪声）。
 *
 * 用法：
 *   npm run ledger:prior                 # 只报告，不写盘（dry）
 *   npm run ledger:prior -- --write      # 达标则重写 src/data/priors.js
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { VERIFIED_DIR, RULE_VERSION, ROOT, listJsonFiles, readJson, log } from './lib.mjs';
import { derivePriors, renderPriorsModule, PRIOR_MODES } from '../../src/services/prior.js';
import { BUILTIN_PRIORS } from '../../src/data/priors.js';

const OUT_FILE = path.join(ROOT, 'src', 'data', 'priors.js');

// 达标门槛：总量 + 覆盖月份 + 每月每模式最少样本
const MIN_TOTAL = 200;
const MIN_MONTHS = 3;
const MIN_PER_MONTH = 30;
const STRENGTH = 30;

function pct(v) {
  return v == null ? ' — ' : `${Math.round(v * 100)}%`;
}

async function loadEntries() {
  const files = await listJsonFiles(VERIFIED_DIR);
  const entries = [];
  for (const f of files) {
    const data = await readJson(path.join(VERIFIED_DIR, f));
    if (!data?.entries) continue;
    for (const e of data.entries) {
      if (e.basis !== 'reanalysis') continue;
      if (Number(e.ruleVersion) !== RULE_VERSION) continue; // 排除旧规则口径
      entries.push(e);
    }
  }
  return { files: files.length, entries };
}

async function main() {
  const write = process.argv.includes('--write');
  const { files, entries } = await loadEntries();

  log(`读取 ${files} 份对账文件，可用条目 ${entries.length} 条（ruleVersion=${RULE_VERSION}）。`);

  if (!entries.length) {
    log('\n没有可用的再分析对账数据（data/verified 为空）。');
    log('保持经验先验，未做任何改动。等台账 CI 攒够对账后重跑即可。');
    return;
  }

  const { priors, stats } = derivePriors(entries, {
    builtin: BUILTIN_PRIORS,
    minPerMonth: MIN_PER_MONTH,
    strength: STRENGTH
  });

  // 覆盖月份：某个「月 × 模式」样本达到门槛，才算这个月被数据覆盖到
  const covered = new Set();
  for (const mode of PRIOR_MODES) {
    for (const s of stats[mode]) if (s.used) covered.add(s.month);
  }
  const monthsCovered = [...covered].sort((a, b) => a - b);

  // 打印每月「云海」对照表，便于人工复核
  log('\n云海 · 各月实测 vs 先验：');
  log('  月份  样本   实测率   旧先验   新先验   采用');
  for (const s of stats.cloudsea) {
    log(
      `  ${String(s.month).padStart(2)}月  ${String(s.n).padStart(4)}  ${pct(s.empirical).padStart(6)}  ${pct(
        s.prior
      ).padStart(6)}  ${pct(priors.cloudsea[s.month - 1]).padStart(6)}  ${s.used ? '是' : '否'}`
    );
  }

  const enough = entries.length >= MIN_TOTAL && monthsCovered.length >= MIN_MONTHS;
  log(
    `\n样本总量 ${entries.length}（需 ≥${MIN_TOTAL}）；覆盖月份 ${monthsCovered.length} 个（需 ≥${MIN_MONTHS}）：${
      monthsCovered.length ? monthsCovered.join('/') + ' 月' : '无'
    }`
  );

  if (!enough) {
    log('\n样本仍不足，保持经验先验，未修改 src/data/priors.js。');
    return;
  }

  if (!write) {
    log('\n已达标，但为 dry 模式；加 --write 才会重写 src/data/priors.js。');
    return;
  }

  const meta = {
    source: 'reanalysis',
    samples: entries.length,
    monthsCovered,
    generatedAt: new Date().toISOString(),
    ruleVersion: RULE_VERSION,
    minPerMonth: MIN_PER_MONTH,
    strength: STRENGTH,
    note: '样本不足的月份沿用经验先验；单月用收缩估计'
  };

  await writeFile(OUT_FILE, renderPriorsModule(priors, meta, BUILTIN_PRIORS), 'utf8');
  log(`\n已重写 ${path.relative(ROOT, OUT_FILE)}（${entries.length} 条，覆盖 ${monthsCovered.length} 个月）。`);
  log('提醒：先验改变后，建议重跑 calibrate.mjs 重新拟合校准（否则旧的 b 偏移会重复修正）。');
}

main().catch((err) => {
  console.error('先验重估失败：', err);
  process.exit(1);
});
