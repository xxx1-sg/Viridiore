/**
 * 台账 · 采集
 *
 * 每天跑一次：把每座山 × 每种模式 × 未来 7 天的概率写成一份不可变的 JSON。
 *
 * 两个刻意的选择：
 * 1. 文件按运行日期命名，写完不再修改。对账结果另存 data/verified/，
 *    因为"改了预测再对账"是最容易也最没意义的作弊。
 * 2. 必须存**输入快照**。概率只有 30 天寿命，输入快照才是复盘的全部依据：
 *    半年后想回答"当时为什么给 62%"、或者改了模型想重算，靠的是这些原始数。
 *
 * 用法：
 *   node scripts/forecast/collect.mjs
 *   node scripts/forecast/collect.mjs --date 2026-11-02   # 补跑指定日期
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MOUNTAINS } from '../../src/data/mountains.js';
import { fetchOpenMeteo } from '../../src/services/openmeteo.js';
import { rankDays, MODES } from '../../src/services/chase.js';
import {
  FORECAST_DIR,
  ROOT,
  SCHEMA,
  RULE_VERSION,
  shDate,
  shTime,
  addDays,
  readJson,
  writeJson,
  previousHash,
  sha256,
  log
} from './lib.mjs';

const MODE_KEYS = Object.keys(MODES);
const round2 = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--date') out.date = argv[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const runDate = args.date || shDate();

  const pkg = await readJson(path.join(ROOT, 'package.json'), {});
  const modelVersion = String(pkg.version || '0.0.0');

  // 一天只记一次账，且先检查再取数——重跑不该白烧一遍 API 额度
  const file = path.join(FORECAST_DIR, `${runDate}.json`);
  const existing = await readJson(file);
  if (existing && !args.date) {
    log(`${runDate} 已有台账（${existing.counts?.entries ?? '?'} 条），跳过。`);
    return;
  }

  const { prev, prevFile } = await previousHash(FORECAST_DIR, runDate);

  const entries = [];
  const skipped = [];
  let totalDays = 0;

  for (const mountain of MOUNTAINS) {
    let wx;
    try {
      wx = await fetchOpenMeteo(mountain.lat, mountain.lon, mountain.name);
    } catch (err) {
      skipped.push({ mountainId: mountain.id, mountain: mountain.name, error: err?.message || String(err) });
      log(`  ! ${mountain.name} 取数失败：${err?.message || err}`);
      // 被限流时不要继续硬撞
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }

    totalDays += wx.daily.length;

    for (const mode of MODE_KEYS) {
      const { all } = rankDays(wx.daily, mode, { mountain, source: wx.source });

      for (const r of all) {
        const d = r.day;
        const geo = r.geometry;
        const s = r.sounding || {};

        entries.push({
          mountainId: mountain.id,
          mountain: mountain.name,
          elevation: mountain.elevation,
          mode,
          date: d.date,
          leadDays: r.index,
          probability: r.probability,
          baseRate: r.baseRate,
          grade: r.grade.label,
          verdict: r.verdict,
          confidence: r.confidence.score,
          sunrise: d.sunrise || null,
          sunset: d.sunset || null,
          /** 模型给出的"为什么"，逐项可核 */
          factors: (r.factors || []).map((f) => ({
            key: f.key,
            label: f.label,
            delta: round2(f.delta),
            value: f.value,
            tone: f.tone
          })),
          /** 输入快照：不看这些，就无法复盘，也无法在模型改版后重算 */
          inputs: {
            gridElevation: wx.elevation ?? null,
            valleyElevation: mountain.valleyElevation ?? null,
            referenceElevation: geo.referenceElevation ?? null,
            cloud: d.cloud ?? null,
            cloudLow: geo.cloudLow ?? null,
            cloudMid: s.cloudMid ?? null,
            cloudHigh: s.cloudHigh ?? null,
            t2m: s.t2m ?? null,
            td2m: s.td2m ?? null,
            lcl: geo.lcl ?? null,
            cloudBase: Math.round(geo.base ?? 0) || null,
            cloudTop: Math.round(geo.top ?? 0) || null,
            thickness: Math.round(geo.thickness ?? 0) || null,
            hasLayer: !!geo.hasLayer,
            margin: Number.isFinite(geo.top) ? Math.round(mountain.elevation - geo.top) : null,
            t925: s.t925 ?? null,
            z925: s.z925 ?? null,
            t850: s.t850 ?? null,
            z850: s.z850 ?? null,
            rh850: s.rh850 ?? null,
            ws850: s.ws850 ?? null,
            windScale: d.windScale ?? null,
            precip: Number(d.precip) || 0,
            pop: d.pop ?? null,
            vis: d.vis ?? null,
            invAvailable: !!r.inversion?.available,
            invIndex: r.inversion?.available ? round2(r.inversion.index) : null,
            invLabel: r.inversion?.label ?? null
          }
        });
      }
    }

    const best = entries
      .filter((e) => e.mountainId === mountain.id && e.mode === 'cloudsea')
      .sort((a, b) => b.probability - a.probability)[0];
    log(`  · ${mountain.name}（${mountain.elevation} m）云海最高 ${best?.probability ?? '--'}% ${best?.date || ''}`);
  }

  const payload = {
    schema: SCHEMA,
    kind: 'forecast',
    date: runDate,
    generatedAt: new Date().toISOString(),
    generatedAtLocal: `${runDate} ${shTime()}`,
    modelVersion,
    ruleVersion: RULE_VERSION,
    provider: 'open-meteo',
    horizonDays: totalDays ? Math.round(totalDays / Math.max(1, MOUNTAINS.length - skipped.length)) : 0,
    range: { from: addDays(runDate, 0), to: null },
    prev,
    prevFile,
    counts: { mountains: MOUNTAINS.length - skipped.length, entries: entries.length },
    skipped,
    entries
  };

  if (entries.length) {
    payload.range.to = entries.reduce((m, e) => (e.date > m ? e.date : m), entries[0].date);
  }

  await writeJson(file, payload);
  const digest = sha256(JSON.stringify(payload)).slice(0, 12);

  log(`\n写入 data/forecast/${runDate}.json`);
  log(`  ${payload.counts.mountains} 座山 · ${entries.length} 条预测 · 模型 ${modelVersion} · 规则 v${RULE_VERSION}`);
  log(`  prev ${prev ? `${prev.slice(0, 12)}（${prevFile}）` : '无（首条记录）'}`);
  log(`  self ${digest}`);

  if (skipped.length) {
    log(`\n  ${skipped.length} 座山取数失败，已记入 skipped：${skipped.map((s) => s.name).join('、')}`);
  }
}

main().catch((err) => {
  console.error('采集失败：', err);
  process.exit(1);
});
