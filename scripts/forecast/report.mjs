/**
 * 台账 · 汇总
 *
 * 把 data/verified/*.json 汇成两样东西：
 *   data/ledger.json  —— 给界面读（校准曲线、Brier、明细）
 *   data/ledger.md    —— 给人读（含"模型体检"，用来暴露系统性偏差）
 *
 * 统计口径（写进报告里，避免以后自己都说不清）：
 *   · 头条数字只取**每个（山 × 模式 × 日期）最晚的一次预言**——那才是用户真正照着做的那条；
 *   · 提前量（leadDays）另算，用全量记录，用来回答"提前几天开始准"；
 *   · 判据是再分析条件是否成立，不是人眼是否看到，两者不可混算。
 *
 * 用法：node scripts/forecast/report.mjs
 */
import path from 'node:path';
import {
  FORECAST_DIR,
  VERIFIED_DIR,
  LEDGER_JSON,
  LEDGER_MD,
  ROOT,
  SCHEMA,
  RULE_VERSION,
  shDate,
  readJson,
  writeJson,
  listJsonFiles,
  log
} from './lib.mjs';
import { writeFile } from 'node:fs/promises';
import { MOUNTAINS } from '../../src/data/mountains.js';

const BINS = [
  { label: '0–19%', lo: 0, hi: 20 },
  { label: '20–39%', lo: 20, hi: 40 },
  { label: '40–59%', lo: 40, hi: 60 },
  { label: '60–79%', lo: 60, hi: 80 },
  { label: '80–100%', lo: 80, hi: 101 }
];

const mean = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null);
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fixed = (v, n = 3) => (v == null ? '—' : Number(v).toFixed(n));

function brierOf(rows) {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + (r.probability / 100 - r.observed) ** 2, 0) / rows.length;
}

async function main() {
  const verifiedFiles = (await listJsonFiles(VERIFIED_DIR)).filter((f) => f.endsWith('.json'));
  const forecastFiles = (await listJsonFiles(FORECAST_DIR)).filter((f) => f.endsWith('.json'));

  const allRows = [];
  const days = [];

  for (const file of verifiedFiles) {
    const v = await readJson(path.join(VERIFIED_DIR, file));
    if (!v?.entries) continue;
    // 星空在 RULE_VERSION 2 之前用日出窗口判定，口径不同，不计入当前统计
    const ents = v.entries.filter((e) => !(e.mode === 'stars' && (e.ruleVersion ?? 1) < RULE_VERSION));
    days.push({ date: v.date, entries: ents.length, observed: ents.filter((x) => x.observed).length });
    for (const e of ents) allRows.push(e);
  }

  // 头条口径：每个（山 × 模式 × 日期）只留最晚一次预言
  const latest = new Map();
  for (const r of allRows) {
    const key = `${r.mountainId}|${r.mode}|${r.date}`;
    const prev = latest.get(key);
    if (!prev || String(r.predictedOn) > String(prev.predictedOn)) latest.set(key, r);
  }
  const primary = [...latest.values()];

  const forecastCount = forecastFiles.length
    ? (await Promise.all(forecastFiles.map((f) => readJson(path.join(FORECAST_DIR, f))))).reduce(
        (s, fx) => s + (fx?.entries?.length || 0),
        0
      )
    : 0;

  /* ---- 待对账：已过期但还没判的目标日期（含"再分析还没到位"） ---- */
  const today = shDate();
  const verifiedDates = new Set(days.map((d) => d.date));
  const pendingSet = new Set();
  for (const file of forecastFiles) {
    const fx = await readJson(path.join(FORECAST_DIR, file));
    for (const e of fx?.entries || []) {
      if (e.date < today && !verifiedDates.has(e.date)) pendingSet.add(e.date);
    }
  }

  /* ---- 校准分箱（用全量，样本才够） ---- */
  const calibration = BINS.map((b) => {
    const rows = allRows.filter((r) => r.probability >= b.lo && r.probability < b.hi);
    return {
      bin: b.label,
      lo: b.lo,
      hi: b.hi - 1,
      n: rows.length,
      predicted: mean(rows.map((r) => r.probability / 100)),
      observed: mean(rows.map((r) => r.observed))
    };
  });

  /* ---- 按提前量 ---- */
  const leadBuckets = [
    { label: '当天/次日', test: (d) => d <= 1 },
    { label: '提前 2–3 天', test: (d) => d >= 2 && d <= 3 },
    { label: '提前 4–6 天', test: (d) => d >= 4 }
  ].map((b) => {
    const rows = allRows.filter((r) => b.test(Number(r.leadDays) || 0));
    return {
      label: b.label,
      n: rows.length,
      predicted: mean(rows.map((r) => r.probability / 100)),
      observed: mean(rows.map((r) => r.observed)),
      brier: brierOf(rows)
    };
  });

  /* ---- 按模式 ---- */
  const modes = ['cloudsea', 'sunrise', 'stars'].map((mode) => {
    const rows = allRows.filter((r) => r.mode === mode);
    return {
      mode,
      n: rows.length,
      predicted: mean(rows.map((r) => r.probability / 100)),
      observed: mean(rows.map((r) => r.observed)),
      brier: brierOf(rows)
    };
  });

  /* ---- 按山 ---- */
  const byMountainMap = new Map();
  for (const r of allRows) {
    const key = r.mountainId;
    if (!byMountainMap.has(key)) byMountainMap.set(key, { mountainId: key, mountain: r.mountain, rows: [] });
    byMountainMap.get(key).rows.push(r);
  }
  const byMountain = [...byMountainMap.values()].map((m) => ({
    mountainId: m.mountainId,
    mountain: m.mountain,
    n: m.rows.length,
    predicted: mean(m.rows.map((r) => r.probability / 100)),
    observed: mean(m.rows.map((r) => r.observed)),
    brier: brierOf(m.rows)
  }));

  /* ---- 模型体检：最新一期预测里，云海判据的"云层位置"能不能成立 ---- */
  let health = null;
  const latestForecastFile = forecastFiles[forecastFiles.length - 1];
  if (latestForecastFile) {
    const fx = await readJson(path.join(FORECAST_DIR, latestForecastFile));
    const seaRows = (fx?.entries || []).filter((e) => e.mode === 'cloudsea');
    if (seaRows.length) {
      /*
       * 云底参考面：v2.4.1 起改为 min(格点海拔, 谷底海拔)。
       * 旧账本没有 referenceElevation 字段，用山的 valleyElevation 现场重算，
       * 这样体检表始终反映"当前模型"，而不是被历史快照里的旧 margin 钉死。
       * 云顶 = 参考海拔 + LCL + 云厚，与 chase.cloudGeometry 一致（lcl / thickness 都在输入快照里）。
       */
      const valleyById = new Map(MOUNTAINS.map((m) => [m.id, m.valleyElevation]));
      const refOf = (e) => {
        if (Number.isFinite(e.inputs?.referenceElevation)) return e.inputs.referenceElevation;
        const grid = e.inputs?.gridElevation;
        const valley = valleyById.get(e.mountainId);
        if (Number.isFinite(grid) && Number.isFinite(valley)) return Math.min(grid, valley);
        return Number.isFinite(grid) ? grid : null;
      };
      const topOf = (e) => {
        const ref = refOf(e);
        return ref === null ? null : ref + (Number(e.inputs?.lcl) || 0) + (Number(e.inputs?.thickness) || 0);
      };
      const marginOf = (e) => {
        const top = topOf(e);
        return top === null ? null : Math.round(e.elevation - top);
      };

      const margins = seaRows.map(marginOf).filter((v) => Number.isFinite(v));
      const sorted = [...margins].sort((a, b) => a - b);

      // 云厚下限 160 m，与 chase.js 的 cloudGeometry 里 `160 + 780 * ...` 保持一致。
      // 若「山顶 - (参考海拔 + 160)」都 < 0，那么即使露点差为 0（LCL=0）、云层最薄，
      // "云顶低于山顶"依然不成立 —— 这条判据在这座山上从数学上就不可能满足。
      const MIN_THICKNESS = 160;
      const headroom = (e) => {
        const ref = refOf(e);
        return ref === null ? null : Math.round(e.elevation - (ref + MIN_THICKNESS));
      };
      const impossible = seaRows.filter((e) => {
        const h = headroom(e);
        return h !== null && h < 0;
      });

      const byMtn = new Map();
      for (const e of seaRows) {
        const h = headroom(e);
        if (h === null) continue;
        const prev = byMtn.get(e.mountainId);
        const ref = refOf(e);
        if (!prev || h < prev.headroom)
          byMtn.set(e.mountainId, {
            mountain: e.mountain,
            elevation: e.elevation,
            headroom: h,
            reference: ref,
            grid: e.inputs.gridElevation
          });
      }

      health = {
        sourceFile: latestForecastFile,
        entries: seaRows.length,
        withLayer: seaRows.filter((e) => e.inputs?.hasLayer).length,
        marginPositive: margins.filter((m) => m >= 0).length,
        marginAbove50: margins.filter((m) => m >= 50).length,
        marginMedian: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
        marginMin: sorted[0] ?? null,
        marginMax: sorted[sorted.length - 1] ?? null,
        structurallyImpossible: impossible.length,
        impossibleMountains: [...new Set(impossible.map((e) => e.mountain))],
        headroom: [...byMtn.values()].sort((a, b) => a.headroom - b.headroom),
        referenceNote: '参考面 = min(格点海拔, 谷底海拔)，云底从此起算（v2.4.1 起）。旧账本按当前模型重算。',
        gridElevationMedian: (() => {
          const list = seaRows.map((e) => e.inputs?.gridElevation).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
          return list.length ? list[Math.floor(list.length / 2)] : null;
        })()
      };
    }
  }

  /* ---- 用户打卡（basis: user）——与再分析分列，绝不合并 ---- */
  const userMerged = await readJson(path.join(ROOT, 'data', 'feedback', 'merged.json'));
  const userFeedback =
    userMerged?.samples?.length && userMerged.summary
      ? { ...userMerged.summary, basis: 'user', note: userMerged.note }
      : null;

  const payload = {
    schema: SCHEMA,
    kind: 'ledger',
    updatedAt: new Date().toISOString(),
    asOf: verifiedFiles.length ? verifiedFiles[verifiedFiles.length - 1].slice(0, 10) : null,
    basisNote: '再分析判「气象条件是否成立」，不代表有人亲眼看到；用户打卡另计。',
    totals: {
      days: days.length,
      forecastEntries: forecastCount,
      verifiedEntries: allRows.length,
      primaryEntries: primary.length,
      pendingDays: pendingSet.size
    },
    brier: brierOf(allRows),
    hitRate: mean(allRows.map((r) => r.observed)),
    calibration: calibration.filter((b) => b.n > 0),
    byLead: leadBuckets.filter((b) => b.n > 0),
    byMode: modes.filter((m) => m.n > 0),
    byMountain,
    userFeedback,
    health,
    days,
    recent: allRows
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 30)
      .map((r) => ({
        date: r.date,
        mountain: r.mountain,
        mode: r.mode,
        probability: r.probability,
        observed: r.observed,
        predictedOn: r.predictedOn,
        verdict: r.verdict
      }))
  };

  await writeJson(LEDGER_JSON, payload);

  /* ---------------- 人读版 ---------------- */
  const lines = [];
  lines.push('# 预测台账');
  lines.push('');
  lines.push(`生成时间：${payload.updatedAt}　对账截至：${payload.asOf || '—'}`);
  lines.push('');
  lines.push(`> ${payload.basisNote}`);
  lines.push('');
  lines.push('## 总账');
  lines.push('');
  lines.push('| 项目 | 数值 |');
  lines.push('| --- | --- |');
  lines.push(`| 已记录预测 | ${payload.totals.forecastEntries} 条 |`);
  lines.push(`| 已对账 | ${payload.totals.verifiedEntries} 条（${payload.totals.days} 天） |`);
  lines.push(`| 待对账 | ${payload.totals.pendingDays} 天 |`);
  lines.push(`| 命中率 | ${pct(payload.hitRate)} |`);
  lines.push(`| Brier | ${fixed(payload.brier)}（越低越好，0.25 = 永远说 50%） |`);
  lines.push('');
  lines.push('## 校准曲线');
  lines.push('');
  lines.push('| 模型当时说 | 样本 | 实际成立 | 差距 |');
  lines.push('| --- | --- | --- | --- |');
  for (const b of payload.calibration) {
    const gap = b.predicted != null && b.observed != null ? b.observed - b.predicted : null;
    lines.push(
      `| ${b.bin} | ${b.n} | ${pct(b.observed)} | ${gap == null ? '—' : `${gap > 0 ? '+' : ''}${Math.round(gap * 100)} pt`} |`
    );
  }
  if (!payload.calibration.length) lines.push('| — | 0 | — | — |');
  lines.push('');
  lines.push('## 提前量');
  lines.push('');
  lines.push('| 提前量 | 样本 | 平均预测 | 实际成立 | Brier |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const b of payload.byLead) {
    lines.push(`| ${b.label} | ${b.n} | ${pct(b.predicted)} | ${pct(b.observed)} | ${fixed(b.brier)} |`);
  }
  if (!payload.byLead.length) lines.push('| — | 0 | — | — | — |');
  lines.push('');
  lines.push('## 分模式');
  lines.push('');
  lines.push('| 模式 | 样本 | 平均预测 | 实际成立 | Brier |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const m of payload.byMode) {
    const name = { cloudsea: '云海', sunrise: '日出', stars: '星空' }[m.mode] || m.mode;
    lines.push(`| ${name} | ${m.n} | ${pct(m.predicted)} | ${pct(m.observed)} | ${fixed(m.brier)} |`);
  }
  if (!payload.byMode.length) lines.push('| — | 0 | — | — | — |');
  lines.push('');
  lines.push('## 用户打卡（basis: user）');
  lines.push('');
  if (payload.userFeedback) {
    const u = payload.userFeedback;
    lines.push('| 指标 | 数值 |');
    lines.push('| --- | --- |');
    lines.push(`| 样本数 | ${u.n} |`);
    lines.push(`| 命中率 | ${pct(u.hitRate)} |`);
    lines.push(`| 平均预测 | ${pct(u.meanPredicted)} |`);
    lines.push(`| Brier | ${fixed(u.brier)} |`);
    if (u.dateRange) lines.push(`| 日期范围 | ${u.dateRange.from} ~ ${u.dateRange.to} |`);
    lines.push('');
    lines.push('> 用户打卡来自本机导出的匿名样本，basis=user；与上面的 ERA5 再分析分开统计，不合并。');
  } else {
    lines.push('暂无用户打卡样本。设置页「导出反馈样本（匿名）」→ 放进 `data/inbox/feedback/` → `npm run ledger:feedback` 合并，之后在此单列。');
  }
  lines.push('');

  if (health) {
    lines.push('## 模型体检（最新一期预测）');
    lines.push('');
    lines.push(`来源：\`data/forecast/${health.sourceFile}\`，云海条目 ${health.entries} 条。`);
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('| --- | --- |');
    lines.push(`| 有低云层的条目 | ${health.withLayer} / ${health.entries} |`);
    lines.push(`| 云顶低于山顶（margin ≥ 0） | ${health.marginPositive} / ${health.entries} |`);
    lines.push(`| 云顶低于山顶 50 m 以上 | ${health.marginAbove50} / ${health.entries} |`);
    lines.push(`| **即使露点差为 0 也不可能成立** | **${health.structurallyImpossible} / ${health.entries}** |`);
    lines.push(`| margin 中位数 | ${health.marginMedian ?? '—'} m |`);
    lines.push(`| margin 区间 | ${health.marginMin ?? '—'} ~ ${health.marginMax ?? '—'} m |`);
    lines.push(`| 格点海拔中位数 | ${health.gridElevationMedian ?? '—'} m |`);
    lines.push('');
    if (health.headroom?.length) {
      lines.push('各山的"干燥余量"（山顶 − 参考海拔 − 最小云厚 160 m）：');
      lines.push('');
      lines.push('| 山 | 山顶 | 参考海拔（谷底 / 格点取低） | 干燥余量 |');
      lines.push('| --- | --- | --- | --- |');
      for (const h of health.headroom) {
        const flag = h.headroom < 0 ? ' ❌' : '';
        const ref = h.reference ?? h.grid ?? '—';
        const from = Number.isFinite(h.grid) && h.reference !== h.grid ? `（格点 ${h.grid} m）` : '';
        lines.push(`| ${h.mountain} | ${h.elevation} m | ${ref} m${from} | ${h.headroom} m${flag} |`);
      }
      lines.push('');
      if (health.referenceNote) {
        lines.push(`> ${health.referenceNote}`);
        lines.push('');
      }
    }
    if (health.structurallyImpossible > 0) {
      lines.push(
        `> 仍有 ${health.structurallyImpossible} 条（${health.impossibleMountains.join('、')}）在任何天气下都判不出云海：` +
          '参考面已改为谷底，若仍不可能，说明该山谷底与山顶的高差本身不足一层云的厚度，需要复核山峰 / 谷底海拔数据。'
      );
      lines.push('');
    }
    lines.push('');
  }

  lines.push('## 最近对账明细');
  lines.push('');
  lines.push('| 日期 | 山 | 模式 | 当时说 | 结果 | 依据 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  const modeName = { cloudsea: '云海', sunrise: '日出', stars: '星空' };
  for (const r of payload.recent) {
    lines.push(
      `| ${r.date} | ${r.mountain} | ${modeName[r.mode] || r.mode} | ${r.probability}% | ${r.observed ? '成立' : '未成立'} | ${r.verdict} |`
    );
  }
  if (!payload.recent.length) lines.push('| — | — | — | — | — | 尚无对账记录 |');
  lines.push('');
  lines.push('## 口径与局限');
  lines.push('');
  lines.push('- 真值来自 ERA5 再分析（archive-api），**不是**预报的 past_days，避免同一套模式自证。');
  lines.push('- ERA5 通常延迟约 5 天，延迟期内日期保持 pending，不提前判。');
  lines.push('- ERA5 归档不提供 850 / 925 hPa 温度，**逆温维度未经验证**，记录里标 `degraded: ["inv"]`。');
  lines.push('- 判定为"气象条件成立"，与人眼是否看到不是一回事；用户打卡今后单列 `basis: user`。');
  lines.push('- 校准与命中率用全量记录；头条口径（每山每模式每日期取最晚一次预言）见 `primaryEntries`。');
  lines.push('');

  await writeFile(LEDGER_MD, `${lines.join('\n')}`, 'utf8');

  log(`写入 data/ledger.json 与 data/ledger.md`);
  log(`  ${payload.totals.verifiedEntries} 条对账记录 · 命中率 ${pct(payload.hitRate)} · Brier ${fixed(payload.brier)}`);
  if (health) {
    log(`  体检：云顶低于山顶 ${health.marginPositive}/${health.entries}，margin 中位数 ${health.marginMedian} m`);
  }
}

main().catch((err) => {
  console.error('汇总失败：', err);
  process.exit(1);
});
