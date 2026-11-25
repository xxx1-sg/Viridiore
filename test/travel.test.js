/**
 * travel.js 单元测试 —— 锁住出行方案的时间倒推、距离估算与天气联动。
 * 运行：npm test（node --test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRoad, departurePlan, buildTravelPlan } from '../src/services/travel.js';
import { MOUNTAINS } from '../src/data/mountains.js';

const from = { lat: 22.5431, lon: 114.0579 };

const mountain = {
  name: '测试山',
  elevation: 900,
  lat: 22.6,
  lon: 114.1,
  route: { distance: 10, ascent: 700, hours: 5 },
  travel: {
    ascentHours: 2,
    trailheads: ['主入口'],
    drive: { nav: '导航 A', parking: '有停车' },
    transit: { level: 'none', label: '无直达', note: '' },
    taxi: '打车说明',
    gear: ['登山鞋'],
    safety: ['注意安全']
  }
};

const mkDay = (over = {}) => ({
  dateObj: new Date(2026, 10, 14, 12, 0, 0),
  date: '2026-11-14',
  min: 16,
  max: 24,
  pop: 0,
  windScale: '2',
  ...over
});

test('estimateRoad：缺少出发地返回 null，否则给出正的参考里程', () => {
  assert.equal(estimateRoad(null, mountain), null);
  const r = estimateRoad(from, mountain);
  assert.ok(r.roadKm > r.straightKm, '道路里程应大于直线距离');
  assert.ok(r.minutes >= 5);
});

test('departurePlan：日出前 30 分钟到顶，登山口出发按 ascentHours 倒推', () => {
  const day = mkDay();
  const p = departurePlan({ mountain, day, mode: 'cloudsea' });
  assert.ok(p.sun.sunrise instanceof Date);
  const summitGap = p.sun.sunrise.getTime() - p.summitAt.getTime();
  assert.equal(summitGap, 30 * 60000, '到顶时间应为日出前 30 分钟');
  const hikeGap = p.summitAt.getTime() - p.trailheadAt.getTime();
  assert.equal(hikeGap, 2 * 3600000, '登山口出发应与到顶相差 ascentHours');
});

test('departurePlan：星空模式以日落后 45 分钟为到顶锚点', () => {
  const p = departurePlan({ mountain, day: mkDay(), mode: 'stars' });
  assert.equal(p.summitAt.getTime() - p.sun.sunset.getTime(), 45 * 60000);
});

test('buildTravelPlan：降水/大风/低温会追加装备与提醒', () => {
  const day = mkDay({ pop: 80, windScale: '5', max: 12, min: 4 });
  const tp = buildTravelPlan({ mountain, day, mode: 'cloudsea', from });
  assert.ok(tp.gear.includes('雨具 / 防水外套'));
  assert.ok(tp.gear.includes('防风外套'));
  assert.ok(tp.gear.includes('保暖层 / 抓绒'));
  assert.equal(tp.warnings.length, 3);
});

test('buildTravelPlan：无直达公交时自驾被标为推荐', () => {
  const tp = buildTravelPlan({ mountain, day: mkDay(), mode: 'cloudsea', from });
  const drive = tp.modes.find((m) => m.key === 'drive');
  const transit = tp.modes.find((m) => m.key === 'transit');
  assert.equal(drive.recommended, true);
  assert.equal(transit.badge, '建议自驾');
  assert.equal(transit.meta, '无直达');
});

test('buildTravelPlan：出发地含自驾耗时时给出家里出发时间', () => {
  const tp = buildTravelPlan({ mountain, day: mkDay(), mode: 'cloudsea', from });
  assert.ok(tp.plan.homeAt instanceof Date);
  assert.ok(tp.plan.homeAt < tp.plan.trailheadAt);
  const gap = tp.plan.trailheadAt.getTime() - tp.plan.homeAt.getTime();
  assert.equal(gap, (tp.road.minutes + 10) * 60000);
});

test('数据完整性：每座山都补齐了出行档案关键字段', () => {
  for (const m of MOUNTAINS) {
    assert.ok(m.travel, `${m.id} 缺少 travel`);
    assert.ok(Number.isFinite(m.travel.ascentHours) && m.travel.ascentHours > 0, `${m.id} ascentHours`);
    assert.ok(Array.isArray(m.travel.trailheads) && m.travel.trailheads.length, `${m.id} trailheads`);
    assert.ok(m.travel.drive && m.travel.drive.nav, `${m.id} drive.nav`);
    assert.ok(['metro', 'bus', 'none'].includes(m.travel.transit.level), `${m.id} transit.level`);
    assert.ok(Array.isArray(m.travel.gear) && m.travel.gear.length, `${m.id} gear`);
    assert.ok(Array.isArray(m.travel.safety) && m.travel.safety.length, `${m.id} safety`);
  }
});
