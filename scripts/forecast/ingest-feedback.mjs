/**
 * 把用户导出的匿名反馈样本并入台账。
 *
 * 用法：
 *   node scripts/forecast/ingest-feedback.mjs                 # 读取 data/inbox/feedback/*.json
 *   node scripts/forecast/ingest-feedback.mjs a.json b.json   # 指定文件
 *
 * 输出：data/feedback/merged.json（按 sampleKey 去重，重复导入幂等）。
 * 口径：这些是 basis:user 的"用户打卡"，和 ERA5 再分析的 basis:reanalysis 分列统计，绝不合并成一个数字。
 */
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import {
  FEEDBACK_SCHEMA,
  validateBundle,
  mergeSamples,
  summarizeSamples
} from '../../src/services/feedback.js';
import { ROOT, readJson, writeJson, log } from './lib.mjs';

const INBOX = path.join(ROOT, 'data', 'inbox', 'feedback');
const OUT = path.join(ROOT, 'data', 'feedback', 'merged.json');

async function inboxFiles() {
  try {
    const names = await readdir(INBOX);
    return names.filter((n) => n.endsWith('.json')).map((n) => path.join(INBOX, n));
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const files = args.length ? args.map((a) => path.resolve(a)) : await inboxFiles();

  if (!files.length) {
    log(`没有待导入的文件。把用户导出的 JSON 放进 data/inbox/feedback/，或作为参数传入。`);
    return;
  }

  const existing = (await readJson(OUT))?.samples || [];
  let incoming = [];
  let used = 0;

  for (const file of files) {
    const obj = await readJson(file);
    if (!obj) {
      log(`  ! 跳过（无法解析）：${path.basename(file)}`);
      continue;
    }
    const { ok, errors, samples } = validateBundle(obj);
    if (!ok) {
      log(`  ! 跳过（${path.basename(file)}）：${errors.join('；') || '没有可用样本'}`);
      continue;
    }
    if (errors.length) log(`  · ${path.basename(file)}：${errors.join('；')}`);
    incoming = [...incoming, ...samples];
    used += 1;
    log(`  · ${path.basename(file)}：${samples.length} 条样本`);
  }

  const merged = mergeSamples(existing, incoming);
  const summary = summarizeSamples(merged);
  const added = merged.length - existing.length;

  if (!added && existing.length) {
    log(`\n没有新样本（当前共 ${merged.length} 条，重复导入已按 sampleKey 去重）。`);
    return;
  }

  const payload = {
    schema: FEEDBACK_SCHEMA,
    kind: 'feedback-merged',
    updatedAt: new Date().toISOString(),
    basis: 'user',
    note: '用户打卡样本，basis=user；与 ERA5 再分析分列统计，不合并。',
    sources: used,
    summary,
    samples: merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  };

  await writeJson(OUT, payload);
  log(`\n写入 data/feedback/merged.json`);
  log(`  共 ${merged.length} 条（本次新增 ${added} 条）· 命中率 ${summary.hitRate == null ? '—' : Math.round(summary.hitRate * 100) + '%'} · Brier ${summary.brier == null ? '—' : summary.brier.toFixed(3)}`);
}

main().catch((err) => {
  console.error('合并反馈失败：', err);
  process.exit(1);
});
