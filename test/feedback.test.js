/**
 * feedback.js 单元测试 —— 匿名化边界、校验、汇总、幂等合并。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toAnonymousSample,
  isValidSample,
  sampleKey,
  summarizeSamples,
  buildExportBundle,
  validateBundle,
  mergeSamples,
  FEEDBACK_KIND,
  FEEDBACK_SCHEMA
} from '../src/services/feedback.js';

test('toAnonymousSample：白名单字段，丢弃坐标/设备/自由文本', () => {
  const s = toAnonymousSample({
    mountainId: 'wutong',
    mode: 'cloudsea',
    date: '2026-11-02',
    predicted: '62',
    observed: true,
    ts: 123,
    lat: 22.58,
    lon: 114.2,
    note: 'private',
    device: 'iPhone'
  });
  assert.deepEqual(Object.keys(s).sort(), ['date', 'mode', 'mountainId', 'observed', 'predicted', 'source', 'ts'].sort());
  assert.equal(s.predicted, 62);
  assert.equal(s.observed, 1);
  assert.equal(s.source, 'live');
  assert.equal('lat' in s, false);
  assert.equal('note' in s, false);
});

test('isValidSample：拒绝非法模式、日期、概率、结果', () => {
  assert.equal(isValidSample({ mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1 }), true);
  assert.equal(isValidSample({ mountainId: '', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1 }), false);
  assert.equal(isValidSample({ mountainId: 'a', mode: 'nope', date: '2026-11-02', predicted: 50, observed: 1 }), false);
  assert.equal(isValidSample({ mountainId: 'a', mode: 'cloudsea', date: '2026/11/02', predicted: 50, observed: 1 }), false);
  assert.equal(isValidSample({ mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 150, observed: 1 }), false);
  assert.equal(isValidSample({ mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 2 }), false);
});

test('sampleKey：预测值不同则不是同一条', () => {
  const a = { mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1, ts: 1 };
  const b = { ...a, predicted: 51 };
  assert.notEqual(sampleKey(a), sampleKey(b));
  assert.equal(sampleKey(a), sampleKey({ ...a }));
});

test('summarizeSamples：命中率、平均预测、Brier 正确', () => {
  const rows = [
    { mountainId: 'a', mode: 'cloudsea', date: '2026-11-01', predicted: 60, observed: 1, ts: 1 },
    { mountainId: 'b', mode: 'sunrise', date: '2026-11-02', predicted: 40, observed: 0, ts: 2 },
    { mountainId: 'a', mode: 'cloudsea', date: '2026-11-03', predicted: 80, observed: 1, ts: 3 }
  ];
  const s = summarizeSamples(rows);
  assert.equal(s.n, 3);
  assert.ok(Math.abs(s.hitRate - 2 / 3) < 1e-9);
  assert.ok(Math.abs(s.meanPredicted - 0.6) < 1e-9);
  // (0.4² + 0.4² + 0.2²) / 3 = 0.12
  assert.ok(Math.abs(s.brier - 0.12) < 1e-9);
  assert.equal(s.byMode.cloudsea, 2);
  assert.equal(s.byMode.sunrise, 1);
  assert.deepEqual(s.dateRange, { from: '2026-11-01', to: '2026-11-03' });
});

test('buildExportBundle：结构完整、basis=user', () => {
  const bundle = buildExportBundle(
    [{ mountainId: 'a', mode: 'stars', date: '2026-11-02', predicted: 30, observed: 0, ts: 9 }],
    { appVersion: '2.4.1', exportedAt: '2026-11-04T00:00:00.000Z' }
  );
  assert.equal(bundle.schema, FEEDBACK_SCHEMA);
  assert.equal(bundle.kind, FEEDBACK_KIND);
  assert.equal(bundle.basis, 'user');
  assert.equal(bundle.appVersion, '2.4.1');
  assert.equal(bundle.samples.length, 1);
  assert.equal(bundle.summary.n, 1);
});

test('validateBundle：好文件通过，坏文件报错，非法样本被跳过', () => {
  const good = buildExportBundle([{ mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1, ts: 1 }]);
  const r1 = validateBundle(good);
  assert.equal(r1.ok, true);
  assert.equal(r1.samples.length, 1);

  assert.equal(validateBundle(null).ok, false);
  assert.equal(validateBundle({ kind: FEEDBACK_KIND }).ok, false);

  const mixed = {
    kind: FEEDBACK_KIND,
    samples: [
      { mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1, ts: 1 },
      { mountainId: 'b', mode: 'bad-mode', date: '2026-11-02', predicted: 50, observed: 1, ts: 1 }
    ]
  };
  const r2 = validateBundle(mixed);
  assert.equal(r2.ok, true);
  assert.equal(r2.samples.length, 1);
  assert.ok(r2.errors.some((e) => e.includes('跳过')));
});

test('mergeSamples：重复导入幂等', () => {
  const one = [{ mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1, ts: 1 }];
  assert.equal(mergeSamples(one, one).length, 1);
  const two = [...one, { mountainId: 'a', mode: 'cloudsea', date: '2026-11-02', predicted: 50, observed: 1, ts: 2 }];
  assert.equal(mergeSamples(one, two).length, 2);
});
