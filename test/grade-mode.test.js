/**
 * 方案 A：按模式可行区间分级的单元测试。
 * 运行：node test/grade-mode.test.js（或 npm test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeForMode, verdictForMode, assessDay } from '../src/services/chase.js';

test('gradeForMode：云海按较低上限分级，"值得去"可达', () => {
  assert.equal(gradeForMode('cloudsea', 30).label, '值得去');
  assert.equal(gradeForMode('cloudsea', 30).tone, 'great');
  assert.equal(gradeForMode('cloudsea', 29).label, '可以赌');
  assert.equal(gradeForMode('cloudsea', 22).label, '可以赌');
  assert.equal(gradeForMode('cloudsea', 14).label, '看运气');
  assert.equal(gradeForMode('cloudsea', 7).label, '别抱期待');
  assert.equal(gradeForMode('cloudsea', 6).label, '建议改期');
});

test('gradeForMode：日出沿用较高阈值（不会被压得太松）', () => {
  assert.equal(gradeForMode('sunrise', 72).label, '值得去');
  assert.equal(gradeForMode('sunrise', 55).label, '可以赌');
  assert.equal(gradeForMode('sunrise', 38).label, '看运气');
  assert.equal(gradeForMode('sunrise', 22).label, '别抱期待');
  assert.equal(gradeForMode('sunrise', 21).label, '建议改期');
});

test('verdictForMode：措辞与分档一致', () => {
  assert.equal(verdictForMode('cloudsea', 30), '大概率能看到');
  assert.equal(verdictForMode('cloudsea', 16), '要看运气');
  assert.equal(verdictForMode('sunrise', 10), '不值得专程跑一趟');
});

test('assessDay：grade/verdict 由模式分级得出，概率仍在 [2,96]', () => {
  const day = {
    dateObj: new Date(2026, 0, 10),
    date: '2026-01-10',
    min: 18,
    max: 26,
    humidity: 80,
    cloud: 60,
    cloudLow: 60,
    precip: 0,
    pop: 10,
    vis: 15,
    windScale: 2,
    soundings: {
      stationElevation: 100, t2m: 18, td2m: 16, cloudLow: 60, cloudMid: 20,
      cloudHigh: 10, rh850: 85, ws850: 4, t925: 16, z925: 850, t850: 12, z850: 1550
    }
  };
  const r = assessDay(day, 'cloudsea', {
    mountain: { name: '测试山', elevation: 900, valleyElevation: 100, lat: 22.6, lon: 114.1 }
  });
  assert.ok(r.probability >= 2 && r.probability <= 96);
  const expectVerdict = {
    great: '大概率能看到', good: '有一半以上把握', fair: '要看运气',
    poor: '机会不大', bad: '不值得专程跑一趟'
  };
  assert.equal(r.verdict, expectVerdict[r.grade.tone]);
});
