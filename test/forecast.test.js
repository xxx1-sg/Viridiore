/**
 * 台账判定规则单元测试 —— 判据阈值、日期工具、哈希链的稳定性。
 * 运行：npm test（node --test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  daysBetween,
  shDate,
  stableStringify,
  sha256,
  judge,
  JUDGE,
  RULE_VERSION,
  SCHEMA
} from '../scripts/forecast/lib.mjs';

test('日期工具：addDays / daysBetween 正确跨月', () => {
  assert.equal(addDays('2026-11-02', 5), '2026-11-07');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-11-02', '2026-11-07'), 5);
  assert.equal(daysBetween('2026-11-07', '2026-11-02'), -5);
});

test('shDate：输出深圳本地 YYYY-MM-DD', () => {
  assert.match(shDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('stableStringify：键顺序不影响结果；sha256 稳定且区分内容', () => {
  assert.equal(stableStringify({ b: 1, a: [2, 3] }), stableStringify({ a: [2, 3], b: 1 }));
  assert.equal(sha256({ x: 1, y: 2 }), sha256({ y: 2, x: 1 }));
  assert.notEqual(sha256('a'), sha256('b'));
});

test('judge(cloudsea)：全部判据成立 → observed=1', () => {
  const r = judge('cloudsea', {
    geometry: { top: 800, cloudLow: 60, hasLayer: true },
    inversion: { available: true, index: 0.5, label: '逆温' },
    precip: 0,
    cloud: 50,
    elevation: 1000
  });
  assert.equal(r.observed, 1);
  assert.deepEqual(r.degraded, []);
  assert.ok(r.checks.every((c) => c.ok));
});

test('judge(cloudsea)：云顶离山顶太近 → 不成立', () => {
  const r = judge('cloudsea', {
    geometry: { top: 980, cloudLow: 60, hasLayer: true },
    inversion: { available: true, index: 0.5, label: '逆温' },
    precip: 0,
    cloud: 50,
    elevation: 1000
  });
  assert.equal(r.observed, 0);
  assert.ok(r.checks.some((c) => !c.ok));
});

test('judge(cloudsea)：有降水 → 不成立', () => {
  const r = judge('cloudsea', {
    geometry: { top: 800, cloudLow: 60, hasLayer: true },
    inversion: { available: true, index: 0.5, label: '逆温' },
    precip: 2,
    cloud: 50,
    elevation: 1000
  });
  assert.equal(r.observed, 0);
});

test('judge(cloudsea)：缺逆温数据 → 标 degraded 但不影响其余判据', () => {
  const r = judge('cloudsea', {
    geometry: { top: 800, cloudLow: 60, hasLayer: true },
    inversion: { available: false },
    precip: 0,
    cloud: 50,
    elevation: 1000
  });
  assert.ok(r.degraded.includes('inv'));
  assert.equal(r.observed, 1);
});

test('judge(stars)：云量通透才成立', () => {
  const open = judge('stars', {
    geometry: { top: 800, cloudLow: 10, hasLayer: false },
    inversion: { available: false },
    precip: 0,
    cloud: 20,
    elevation: 1000
  });
  assert.equal(open.observed, 1);
  const cloudy = judge('stars', {
    geometry: { top: 800, cloudLow: 10, hasLayer: false },
    inversion: { available: false },
    precip: 0,
    cloud: 40,
    elevation: 1000
  });
  assert.equal(cloudy.observed, 0);
});

test('judge(sunrise)：低云挡地平线 → 不成立', () => {
  const clear = judge('sunrise', {
    geometry: { top: 900, cloudLow: 50, hasLayer: true },
    inversion: { available: false },
    precip: 0,
    cloud: 40,
    elevation: 1000
  });
  assert.equal(clear.observed, 1);
  const blocked = judge('sunrise', {
    geometry: { top: 900, cloudLow: 80, hasLayer: true },
    inversion: { available: false },
    precip: 0,
    cloud: 40,
    elevation: 1000
  });
  assert.equal(blocked.observed, 0);
});

test('JUDGE 阈值自洽：云海要求成片低云且有正余量', () => {
  assert.ok(JUDGE.cloudsea.minLowCloud > 0);
  assert.ok(JUDGE.cloudsea.minMargin > 0);
});

test('schema / rule 版本号存在', () => {
  assert.equal(typeof SCHEMA, 'number');
  assert.equal(typeof RULE_VERSION, 'number');
});
