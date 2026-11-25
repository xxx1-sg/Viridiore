/**
 * atmos.js 单元测试 —— 物理公式是模型的地基，先钉死边界。
 * 运行：npm test（node --test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  satVaporPressure,
  dewPoint,
  dewSpread,
  liftingCondensationLevel,
  lclFromDewPoint,
  potentialTemp,
  lapseRate,
  inversionProfile,
  inversionIndex,
  stability,
  estimatePop,
  windScaleNum,
  clamp01,
  clamp,
  sigmoid,
  logit,
  round1
} from '../src/services/atmos.js';

test('satVaporPressure：Magnus 公式量级正确，且随温度单调上升', () => {
  assert.ok(Math.abs(satVaporPressure(20) - 23.37) < 0.6, `20℃ 饱和水汽压应约 23.4 hPa，实际 ${satVaporPressure(20)}`);
  assert.ok(satVaporPressure(30) > satVaporPressure(20));
  assert.ok(satVaporPressure(-10) > 0);
});

test('dewPoint：饱和时等于气温，湿度越低露点越低', () => {
  assert.ok(Math.abs(dewPoint(20, 100) - 20) < 0.2);
  assert.ok(dewPoint(20, 50) < dewPoint(20, 80));
  assert.ok(dewPoint(20, 50) > 0);
});

test('dewSpread / liftingCondensationLevel：饱和时间为 0，且非负', () => {
  assert.ok(dewSpread(20, 100) < 0.2);
  assert.ok(dewSpread(20, 50) > 9);
  assert.ok(dewSpread(20, 50) >= 0);
  assert.ok(Math.abs(liftingCondensationLevel(20, 100)) < 30);
});

test('lclFromDewPoint：125 m/℃ 一阶估计，缺数据返回 null', () => {
  assert.equal(lclFromDewPoint(20, 20), 0);
  assert.equal(lclFromDewPoint(20, 10), 1250);
  assert.equal(lclFromDewPoint(15, 17), 0, '露点高于气温时不应给负的云底');
  assert.equal(lclFromDewPoint(NaN, 10), null);
  assert.equal(lclFromDewPoint(20, 'oops'), null);
});

test('potentialTemp：1000 hPa 时等于绝对温度，越界返回 null', () => {
  assert.ok(Math.abs(potentialTemp(20, 1000) - 293.15) < 0.2);
  assert.equal(potentialTemp(20, 200), null);
  assert.equal(potentialTemp(20, 1200), null);
});

test('lapseRate：正常递减为正、逆温为负、层太薄返回 null', () => {
  assert.ok(Math.abs(lapseRate(20, 0, 10, 1000) - 10) < 1e-9);
  assert.ok(lapseRate(10, 0, 12, 1000) < 0, '温度随高度上升应为负直减率（逆温）');
  assert.equal(lapseRate(10, 0, 10, 20), null, '两层高差不足 50 m 不应给直减率');
  assert.equal(lapseRate(20, 1000, 10, 0), null, '高度倒置应返回 null');
});

test('inversionProfile：绝对逆温识别为 available + absolute', () => {
  const prof = inversionProfile({ t2m: 10, z2m: 30, t925: 12, z925: 800, t850: 14, z850: 1500 });
  assert.equal(prof.available, true);
  assert.equal(prof.absolute, true);
  assert.equal(prof.label, '逆温');
  assert.ok(prof.index > 0.9);
});

test('inversionProfile：强递减识别为不稳定，指数接近 0', () => {
  const prof = inversionProfile({ t2m: 20, z2m: 30, t925: 14, z925: 800, t850: 5, z850: 1500 });
  assert.equal(prof.available, true);
  assert.equal(prof.absolute, false);
  assert.equal(prof.label, '不稳定');
  assert.ok(prof.index < 0.1);
});

test('inversionProfile：缺高空数据时 available=false 且 index=0', () => {
  const prof = inversionProfile({});
  assert.equal(prof.available, false);
  assert.equal(prof.index, 0);
});

test('inversionIndex / stability：输出落在 0—1', () => {
  const a = inversionIndex({ dtr: 12, cloudNight: 10, windScale: 1 });
  const b = inversionIndex({ dtr: 0, cloudNight: 90, windScale: 6 });
  assert.ok(a > b);
  assert.ok(a >= 0 && a <= 1 && b >= 0 && b <= 1);
  assert.ok(stability({ dtr: 10, cloudNight: 20, windScale: 2, humidity: 90 }) >= 0);
});

test('estimatePop：降水越多概率越高，文本兜底', () => {
  assert.equal(estimatePop({ precip: 12 }), 95);
  assert.equal(estimatePop({ precip: 0.6 }), 65);
  assert.equal(estimatePop({ precip: 0, text: '小雨' }), 55);
  assert.equal(estimatePop({ precip: 0, text: '阴' }), 28);
  assert.equal(estimatePop({ precip: 0, text: '多云' }), 12);
  assert.equal(estimatePop({ precip: 0 }), 4);
});

test('windScaleNum：区间取中值', () => {
  assert.equal(windScaleNum('3-4'), 3.5);
  assert.equal(windScaleNum('5'), 5);
  assert.equal(windScaleNum(''), 3);
});

test('clamp / clamp01 / sigmoid / logit：数值稳定', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(NaN), 0);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(sigmoid(0), 0.5);
  assert.equal(logit(0.5), 0);
  assert.ok(Math.abs(logit(sigmoid(1.5)) - 1.5) < 1e-9);
  assert.equal(round1(1.24), 1.2);
});
