/**
 * 轨迹计算 Worker
 * 主线程只负责采集坐标，距离/爬升/难度/热力等计算放到这里，避免卡 UI
 */

const R = 6371008.8;

function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 距离计算，过滤掉抖动点（<2m 位移） */
function calcDistance(points) {
  let total = 0;
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    segments.push(d);
    if (d > 2) total += d;
  }
  return { total, segments };
}

/** 平滑后的累计爬升 / 下降 */
function calcElevation(points) {
  const alts = points.map((p) => p.altitude).filter((a) => Number.isFinite(a));
  if (alts.length < 3) {
    return { gain: 0, loss: 0, max: alts.length ? Math.max(...alts) : 0, min: alts.length ? Math.min(...alts) : 0 };
  }

  // 3 点滑动平均 + 2m 阈值，抑制 GPS 高程噪声
  const smoothed = alts.map((v, i) => {
    const slice = alts.slice(Math.max(0, i - 1), Math.min(alts.length, i + 2));
    return slice.reduce((s, x) => s + x, 0) / slice.length;
  });

  let gain = 0;
  let loss = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const diff = smoothed[i] - smoothed[i - 1];
    if (diff > 2) gain += diff;
    else if (diff < -2) loss += -diff;
  }
  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
    max: Math.round(Math.max(...smoothed)),
    min: Math.round(Math.min(...smoothed))
  };
}

function difficultyOf(distanceKm, gain) {
  const effort = distanceKm * 1 + gain / 100;
  if (effort < 8) return 1;
  if (effort < 16) return 2;
  if (effort < 26) return 3;
  if (effort < 40) return 4;
  return 5;
}

function analyze(points) {
  const { total, segments } = calcDistance(points);
  const elevation = calcElevation(points);
  const start = points[0];
  const end = points[points.length - 1];
  const duration = start && end ? (end.ts || 0) - (start.ts || 0) : 0;
  const distanceKm = total / 1000;
  const movingMs = duration || 1;

  const lats = points.map((p) => p.lat).filter(Number.isFinite);
  const lons = points.map((p) => p.lon).filter(Number.isFinite);

  return {
    distance: Math.round(total),
    distanceKm: Number(distanceKm.toFixed(2)),
    elevation,
    duration,
    avgSpeed: duration > 0 ? Number((total / (duration / 1000)).toFixed(2)) : 0,
    avgPace: distanceKm > 0.05 ? Math.round(duration / distanceKm) : 0,
    maxSpeed: segments.length ? Number(((Math.max(...segments) / 1000) * 3600).toFixed(1)) : 0,
    difficulty: difficultyOf(distanceKm, elevation.gain),
    pointCount: points.length,
    startedAt: start?.ts || Date.now(),
    endedAt: end?.ts || Date.now(),
    bounds: lats.length
      ? {
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLon: Math.min(...lons),
          maxLon: Math.max(...lons)
        }
      : null,
    movingMs
  };
}

/** 生成抽稀后的折线（用于绘图，最多 400 点） */
function simplify(points, max = 400) {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** 海拔剖面（等距离采样 60 段） */
function profile(points, buckets = 60) {
  if (points.length < 2) return [];
  const alts = points.map((p) => {
    const a = Number(p.altitude);
    return Number.isFinite(a) ? a : 0;
  });
  const out = [];
  const size = Math.max(1, Math.floor(alts.length / buckets));
  for (let i = 0; i < alts.length; i += size) {
    const slice = alts.slice(i, i + size);
    out.push(Math.round(slice.reduce((s, x) => s + x, 0) / slice.length));
  }
  return out;
}

self.addEventListener('message', (e) => {
  const { type, payload, id } = e.data || {};
  try {
    let result;
    switch (type) {
      case 'ANALYZE':
        result = analyze(payload.points || []);
        result.simplified = simplify(payload.points || []);
        result.profile = profile(payload.points || []);
        break;
      case 'DISTANCE':
        result = calcDistance(payload.points || []);
        break;
      case 'ELEVATION':
        result = calcElevation(payload.points || []);
        break;
      default:
        throw new Error(`未知任务类型: ${type}`);
    }
    self.postMessage({ id, ok: true, type: `${type}_DONE`, payload: result });
  } catch (err) {
    self.postMessage({ id, ok: false, type: 'ERROR', payload: { message: err.message } });
  }
});
