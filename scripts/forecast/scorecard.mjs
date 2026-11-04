/**
 * 台账 · 回测记分牌
 *
 * 把 data/ledger.json 里已经算好的 Brier / 命中率 / 按提前量拆分，渲染成一段
 * 可读的 Markdown，写回 README 的 <!-- SCORECARD:START --> … <!-- SCORECARD:END --> 标记区。
 *
 * 为什么单独做一个脚本：
 *   · 记分牌是给人看的第一屏，应该跟着台账自动更新，而不是手抄；
 *   · 没有对账数据时它只说"样本积累中"，绝不填编造数字——和项目整体口径一致。
 *
 * 用法：
 *   node scripts/forecast/scorecard.mjs            # 打印到终端
 *   node scripts/forecast/scorecard.mjs --write    # 写回 README.md
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { LEDGER_JSON, ROOT, readJson, log } from './lib.mjs';

export const SCORECARD_START = '<!-- SCORECARD:START -->';
export const SCORECARD_END = '<!-- SCORECARD:END -->';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fixed = (v, n = 3) => (v == null ? '—' : Number(v).toFixed(n));
const modeName = { cloudsea: '云海', sunrise: '日出', stars: '星空' };

/** 把 ledger 对象渲染成带标记的 Markdown 片段 */
export function renderScorecard(ledger = {}) {
  const t = ledger.totals || {};
  const L = [];
  L.push(SCORECARD_START);
  L.push('## 回测记分牌');
  L.push('');
  L.push(
    '> 真值 = ERA5 再分析；判的是「气象条件是否成立」，不是「有人看到」。本表由 `npm run ledger:scorecard` 从 `data/ledger.json` 自动生成。'
  );
  L.push('');
  L.push('| 指标 | 数值 |');
  L.push('| --- | --- |');
  L.push(`| 已记录预测 | ${t.forecastEntries ?? 0} 条 |`);
  L.push(`| 已对账 | ${t.verifiedEntries ?? 0} 条（${t.days ?? 0} 天） |`);
  L.push(`| 待对账 | ${t.pendingDays ?? 0} 天 |`);
  L.push(`| 命中率 | ${pct(ledger.hitRate)} |`);
  L.push(`| **Brier** | **${fixed(ledger.brier)}**（越低越好，0.25 = 永远说 50%） |`);
  if (ledger.asOf) L.push(`| 对账截至 | ${ledger.asOf} |`);
  L.push('');

  if (Array.isArray(ledger.byLead) && ledger.byLead.length) {
    L.push('按提前量：');
    L.push('');
    L.push('| 提前量 | 样本 | 平均预测 | 实际成立 | Brier |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const b of ledger.byLead) {
      L.push(`| ${b.label} | ${b.n} | ${pct(b.predicted)} | ${pct(b.observed)} | ${fixed(b.brier)} |`);
    }
    L.push('');
  }

  if (Array.isArray(ledger.byMode) && ledger.byMode.length) {
    L.push('按模式：');
    L.push('');
    L.push('| 模式 | 样本 | 平均预测 | 实际成立 | Brier |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const m of ledger.byMode) {
      L.push(`| ${modeName[m.mode] || m.mode} | ${m.n} | ${pct(m.predicted)} | ${pct(m.observed)} | ${fixed(m.brier)} |`);
    }
    L.push('');
  }

  if (!t.verifiedEntries) {
    L.push(
      '⏳ **样本积累中**：ERA5 归档约延迟 5 天，首批对账在预测日 +5 天左右才到位。在此之前这里只显示「待对账」，不填任何编造的数字。'
    );
    L.push('');
  }

  L.push(SCORECARD_END);
  return L.join('\n');
}

/** 用渲染结果替换 README 中的标记区；找不到标记返回 null */
export function applyScorecard(readme, ledger = {}) {
  if (!readme.includes(SCORECARD_START) || !readme.includes(SCORECARD_END)) return null;
  const block = renderScorecard(ledger);
  const re = new RegExp(`${escapeRe(SCORECARD_START)}[\\s\\S]*?${escapeRe(SCORECARD_END)}`);
  return readme.replace(re, block);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const write = process.argv.includes('--write');
  const li = process.argv.indexOf('--ledger');
  const ledgerPath = li > -1 && process.argv[li + 1] ? path.resolve(process.argv[li + 1]) : LEDGER_JSON;
  const ledger = (await readJson(ledgerPath)) || {};
  const block = renderScorecard(ledger);

  if (!write) {
    log(block);
    return;
  }

  const readmePath = path.join(ROOT, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const next = applyScorecard(readme, ledger);
  if (next == null) {
    log('README.md 里没有 SCORECARD 标记区，未写入。');
    return;
  }
  if (next === readme) {
    log('记分牌已是最新，无需改动。');
    return;
  }
  await writeFile(readmePath, next, 'utf8');
  log('已更新 README.md 的回测记分牌。');
}

// 仅在直接运行时执行；被 report.mjs 之类的模块 import 时不跑
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error('记分牌生成失败：', err);
    process.exit(1);
  });
}
