/**
 * chase.js 单元测试 —— 锁住概率模型的方向性与关键不变量。
 * 运行：npm test（node --test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES,
  MODE_CALIBRATION,
  cloudGeometry,
  assessDay,
  gradeOf,
  verdictOf,
  confidenceOf,
  rankDays,
  compensation,
  summitTemp,
  relativeDay
} from '../src/services/chase.js';

const mountain = { name: '测试山', elevation: 900, valleyElevation: 100, lat: 22.6, lon: 114.1 };

/** 构造一天预报；用固定的 dateObj 保证月份先验可预测 */
function mkDay(over = {}) {
  return {
    dateObj: new Date(2026, 0, 10, 6, 0, 0), // 2026-01-10，1 月
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
      stationElevation: 100,
      t2m: 18,
      td2m: 16,
      cloudLow: 60,
      cloudMid: 20,
      cloudHigh: 10,
      rh850: 85,
      ws850: 4,
      t925: 16,
      z925: 850,
      t850: 12,
      z850: 1550
    },
    ...over
  };
}

test('MODES：三种模式齐全，月度先验各 12 个月', () => {
  assert.deepEqual(Object.keys(MODES).sort(), ['cloudsea', 'stars', 'sunrise']);
  for (const m of Object.values(MODES)) assert.equal(m.prior.length, 12);
});

test('cloudGeometry：参考面 = min(格点海拔, 谷底海拔)（v2.4.1 关键修复）', () => {
  const day = {
    min: 20,
    soundings: { stationElevation: 798, t2m: 20, td2m: 10, cloudLow: 50, rh850: 90 }
  };
  const geo = cloudGeometry(day, { valleyElevation: 60 });
  assert.equal(geo.gridElevation, 798);
  assert.equal(geo.valleyElevation, 60);
  assert.equal(geo.referenceElevation, 60, '梧桐山场景：必须从谷底 60 m 起算，而不是格点 798 m');
  assert.ok(Math.abs(geo.lcl - 1250) < 1);
  assert.ok(Math.abs(geo.base - (60 + geo.lcl)) < 1e-6);
  assert.ok(geo.thickness >= 160);
  assert.equal(geo.hasLayer, true);
});

test('cloudGeometry：0 m 是合法格点海拔，不能回退成 25', () => {
  const day = { soundings: { stationElevation: 0, t2m: 20, td2m: 18, cloudLow: 10 } };
  const geo = cloudGeometry(day);
  assert.equal(geo.gridElevation, 0);
  assert.equal(geo.referenceElevation, 0);
});

test('cloudGeometry：没有谷底数据时退回格点海拔', () => {
  const day = { soundings: { stationElevation: 300, t2m: 20, td2m: 18, cloudLow: 40 } };
  const geo = cloudGeometry(day);
  assert.equal(geo.referenceElevation, 300);
});

test('cloudGeometry：低云不足时不算成片（hasLayer=false）', () => {
  const day = { soundings: { stationElevation: 100, t2m: 20, td2m: 10, cloudLow: 20 } };
  const geo = cloudGeometry(day);
  assert.equal(geo.hasLayer, false);
  assert.equal(geo.believable, false);
});

test('assessDay：概率恒在 [2, 96]，且基准率取自该月先验', () => {
  const r = assessDay(mkDay(), 'cloudsea', { mountain });
  assert.ok(r.probability >= 2 && r.probability <= 96);
  // 1 月云海先验 0.18 → 18%
  assert.equal(r.baseRate, 18);
  assert.ok(Array.isArray(r.factors));
  // factors 按 |delta| 从大到小
  for (let i = 1; i < r.factors.length; i++) {
    assert.ok(Math.abs(r.factors[i - 1].delta) >= Math.abs(r.factors[i].delta));
  }
});

test('assessDay：风力越大，云海概率不升反降', () => {
  const calm = assessDay(mkDay({ windScale: 2 }), 'cloudsea', { mountain }).probability;
  const windy = assessDay(mkDay({ windScale: 6 }), 'cloudsea', { mountain }).probability;
  assert.ok(calm > windy, `风速 6 级的概率(${windy}) 应低于 2 级(${calm})`);
});

test('assessDay：降水越多，云海概率越低', () => {
  const dry = assessDay(mkDay({ precip: 0, pop: 5 }), 'cloudsea', { mountain }).probability;
  const wet = assessDay(mkDay({ precip: 8, pop: 90 }), 'cloudsea', { mountain }).probability;
  assert.ok(dry > wet, `无降水(${dry}) 应高于大雨(${wet})`);
});

test('gradeOf / verdictOf：阈值边界正确', () => {
  assert.equal(gradeOf(72).label, '值得去');
  assert.equal(gradeOf(71).label, '可以赌');
  assert.equal(gradeOf(55).label, '可以赌');
  assert.equal(gradeOf(38).label, '看运气');
  assert.equal(gradeOf(22).label, '别抱期待');
  assert.equal(gradeOf(21).label, '建议改期');
  assert.ok(typeof verdictOf(80) === 'string');
});

test('confidenceOf：时效越远越低，缺高空层结再降一档，样本多了回升', () => {
  const base = confidenceOf({ dayIndex: 0, hasSounding: true, calibration: { n: 0 } }).score;
  const far = confidenceOf({ dayIndex: 5, hasSounding: true, calibration: { n: 0 } }).score;
  const noSounding = confidenceOf({ dayIndex: 0, hasSounding: false, calibration: { n: 0 } }).score;
  const calibrated = confidenceOf({ dayIndex: 0, hasSounding: true, calibration: { n: 10 } }).score;
  assert.ok(base > far, '提前 5 天置信度应更低');
  assert.ok(noSounding < base, '缺高空数据应降档');
  assert.ok(calibrated >= base, '有反馈样本应不低于基线');
});

test('rankDays：按概率降序，best 为最高分那天', () => {
  const daily = [mkDay({ windScale: 6 }), mkDay({ windScale: 2 })];
  const { all, ranked, best } = rankDays(daily, 'cloudsea', { mountain });
  assert.equal(all.length, 2);
  assert.equal(ranked.length, 2);
  assert.ok(ranked[0].probability >= ranked[1].probability);
  assert.equal(best.probability, ranked[0].probability);
  assert.equal(typeof best.index, 'number');
});

test('MODE_CALIBRATION：云海/日出保序(a>0)，星空退化为常数基准率', () => {
  assert.ok(MODE_CALIBRATION.cloudsea.a > 0, '云海校准必须保序，不能把区分度砸掉');
  assert.ok(MODE_CALIBRATION.sunrise.a > 0);
  assert.equal(MODE_CALIBRATION.stars.a, 0, '星空首轮回测方向存疑，应退化为基准率');
  const s1 = assessDay(mkDay({ windScale: 2 }), 'stars', { mountain }).probability;
  const s2 = assessDay(mkDay({ windScale: 6 }), 'stars', { mountain }).probability;
  assert.equal(s1, s2, '星空校准后应为常数，不因因子波动产生假精度');
});

test('compensation：有更好的窗口时给希望，否则给安慰', () => {
  const hopeful = compensation({
    all: [
      { probability: 20, index: 0, day: mkDay() },
      { probability: 80, index: 3, day: mkDay({ date: '2026-01-13' }) }
    ],
    mode: 'cloudsea',
    todayProb: 20
  });
  assert.equal(hopeful.tone, 'hopeful');
  assert.ok(hopeful.text.includes('80%'));

  const consoling = compensation({
    all: [
      { probability: 20, index: 0, day: mkDay() },
      { probability: 25, index: 1, day: mkDay() }
    ],
    mode: 'cloudsea',
    todayProb: 20
  });
  assert.equal(consoling.tone, 'consoling');
});

test('summitTemp：海拔越高越冷', () => {
  const low = summitTemp({ max: 30, min: 20 }, 300);
  const high = summitTemp({ max: 30, min: 20 }, 1200);
  assert.ok(high < low);
});

test('relativeDay：0/1/2 为今天/明天/后天', () => {
  assert.equal(relativeDay(0), '今天');
  assert.equal(relativeDay(1), '明天');
  assert.equal(relativeDay(2), '后天');
});
