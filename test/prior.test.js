/**
 * prior.js 单元测试 —— 锁住「回测 → 月度先验」的重估逻辑。
 * 运行：node test/prior.test.js（或 npm test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePriors, renderPriorsModule, PRIOR_MODES } from '../src/services/prior.js';
import { BUILTIN_PRIORS } from '../src/data/priors.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function entriesFor(mode, date, hit, miss) {
  return [
    ...Array.from({ length: hit }, () => ({ mode, date, observed: 1 })),
    ...Array.from({ length: miss }, () => ({ mode, date, observed: 0 }))
  ];
}

test('内置先验：三模式各 12 个月，全部在 (0,1)', () => {
  assert.deepEqual(Object.keys(BUILTIN_PRIORS).sort(), [...PRIOR_MODES].sort());
  for (const mode of PRIOR_MODES) {
    assert.equal(BUILTIN_PRIORS[mode].length, 12);
    for (const p of BUILTIN_PRIORS[mode]) assert.ok(p > 0 && p < 1, `${mode} 先验 ${p} 应合法`);
  }
});

test('derivePriors：样本达门槛时用收缩估计替换该月先验', () => {
  // 11 月（index 10）40 条、其中 16 条成立 → 实测 40%
  const { priors, stats } = derivePriors(entriesFor('cloudsea', '2026-11-05', 16, 24));
  const p0 = BUILTIN_PRIORS.cloudsea[10]; // 0.16
  const expected = (16 + 30 * p0) / (40 + 30);
  assert.ok(close(priors.cloudsea[10], Math.round(expected * 1e4) / 1e4), `应约为 ${expected}`);
  assert.equal(stats.cloudsea[10].n, 40);
  assert.equal(stats.cloudsea[10].used, true);
});

test('derivePriors：样本不足的月份沿用经验先验，不瞎调', () => {
  // 4 月（index 3）只有 10 条 → 未达 30，保留内置
  const { priors, stats } = derivePriors(entriesFor('cloudsea', '2026-04-10', 5, 5));
  assert.equal(stats.cloudsea[3].n, 10);
  assert.equal(stats.cloudsea[3].used, false);
  assert.equal(priors.cloudsea[3], BUILTIN_PRIORS.cloudsea[3]);
});

test('derivePriors：非法条目（坏日期/未知模式/非 0-1）被忽略', () => {
  const junk = [
    { mode: 'cloudsea', date: '', observed: 1 },
    { mode: 'bogus', date: '2026-11-01', observed: 1 },
    { mode: 'cloudsea', date: '2026-11-01', observed: 2 }
  ];
  const { priors, stats } = derivePriors(junk);
  assert.equal(stats.cloudsea[10].n, 0);
  assert.deepEqual(priors, BUILTIN_PRIORS);
});

test('derivePriors：只统计对应模式，不影响别的模式', () => {
  const { stats } = derivePriors(entriesFor('stars', '2026-01-20', 3, 2));
  assert.equal(stats.stars[0].n, 5);
  assert.equal(stats.cloudsea[0].n, 0);
});

test('renderPriorsModule：输出可写回的数据模块', () => {
  const { priors } = derivePriors([]);
  const txt = renderPriorsModule(priors, { source: 'reanalysis', samples: 0 });
  assert.match(txt, /export const PRIORS = /);
  assert.match(txt, /export const BUILTIN_PRIORS = /);
  assert.match(txt, /"source": "reanalysis"/);
});
