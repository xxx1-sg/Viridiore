/**
 * 轨迹记录器：定位采集 + Worker 计算
 *
 * 采集来源有两种：
 *  1) 原生后台定位（Capacitor Android/iOS）：前台服务持续写点，JS 定时 drain 回放。
 *     锁屏 / 切后台也不会丢点，回到前台后一次性重建真实路线。
 *  2) 前台回退（浏览器 / PWA / 桌面）：navigator.geolocation.watchPosition，
 *     并用 Wake Lock 尽量防止屏幕休眠，避免记录中断。
 *
 * 无论哪种来源，都会做去重、精度过滤和「跳点」剔除，杜绝一个坏点把轨迹拉成直线。
 */
import { watchPosition, haversine } from './geo.js';
import {
  nativeBackgroundAvailable,
  startNativeTracking,
  stopNativeTracking,
  drainNativeLocations,
  clearNativeLocations
} from './location.js';

/** 采样节流：同一次记录中，两点的最小间隔（毫秒） */
const MIN_INTERVAL_MS = 800;
/** 精度上限（米）：超过则视为不可信点（首个点除外） */
const MAX_ACCURACY_M = 100;
/** 合理速度上限（米/秒 ≈ 324km/h）：超过则判为 GPS 跳点 */
const MAX_SPEED_MPS = 90;

class WorkerClient {
  constructor() {
    this.worker = null;
    this.seq = 0;
    this.pending = new Map();
  }

  ensure() {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL('../workers/trail.worker.js', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (e) => {
      const { id, ok, payload } = e.data || {};
      const task = this.pending.get(id);
      if (!task) return;
      this.pending.delete(id);
      if (ok) task.resolve(payload);
      else task.reject(new Error(payload?.message || '计算失败'));
    });
    this.worker.addEventListener('error', (err) => {
      console.warn('[worker]', err.message);
    });
    return this.worker;
  }

  post(type, payload) {
    const worker = this.ensure();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('计算超时'));
        }
      }, 8000);
    });
  }

  analyze(points) {
    return this.post('ANALYZE', { points });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}

export class TrailTracker {
  constructor({ onUpdate, onError, onStatus } = {}) {
    this.onUpdate = onUpdate || (() => {});
    this.onError = onError || (() => {});
    this.onStatus = onStatus || (() => {});
    this.worker = new WorkerClient();
    this.points = [];
    this.stats = null;
    this.startedAt = null;
    this.running = false;
    this.paused = false;
    this.stopWatch = null;
    this.lastAnalyze = 0;
    this.analyzeTimer = null;

    this.native = false;
    this.pollTimer = null;
    this.lastTs = 0;
    this.wakeLock = null;
    this._draining = false;
  }

  get isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    this.points = [];
    this.stats = null;
    this.lastTs = 0;
    this.startedAt = Date.now();
    this.running = true;
    this.paused = false;
    this.native = nativeBackgroundAvailable();
    this.onStatus({ running: true, paused: false, pointCount: 0 });

    if (this.native) {
      try {
        await clearNativeLocations();
        await startNativeTracking({
          title: '晓山青 · 正在记录轨迹',
          text: '后台持续定位中，结束后点「结束并保存」'
        });
        this.pollTimer = setInterval(() => this.pollNative(), 1000);
        await this.pollNative();
      } catch (err) {
        console.warn('[tracker] 原生后台定位启动失败，回退前台定位', err);
        this.native = false;
        this.clearPoll();
      }
    }

    if (!this.native) {
      this.watchFront();
    }

    // 即使暂时还没有点，也每 4 秒刷新一次时长
    this.analyzeTimer = setInterval(() => this.recalc(), 4000);
  }

  /** 前台回退：持续定位 + 屏幕唤醒锁 */
  watchFront() {
    this.stopWatch = watchPosition(
      (pos) => {
        if (this.addPoint(pos)) this.maybeRecalc();
      },
      (err) => this.onError(err),
      { maximumAge: 1000 }
    );
    this.requestWakeLock();
  }

  async pause() {
    if (!this.running) return;
    // 先把原生/前台已采集的点收进来，再暂停
    if (this.native) await this.pollNative();
    this.paused = true;
    this.stopWatch?.();
    this.stopWatch = null;
    this.clearPoll();
    if (this.native) await stopNativeTracking();
    this.releaseWakeLock();
    this.onStatus({ running: true, paused: true, pointCount: this.points.length });
  }

  async resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this.native) {
      try {
        await startNativeTracking({
          title: '晓山青 · 正在记录轨迹',
          text: '后台持续定位中，结束后点「结束并保存」'
        });
        this.pollTimer = setInterval(() => this.pollNative(), 1000);
      } catch (err) {
        console.warn('[tracker] 恢复原生定位失败', err);
      }
    } else {
      this.watchFront();
    }
    this.onStatus({ running: true, paused: false, pointCount: this.points.length });
  }

  /** 拉取原生缓冲里的点并喂给 addPoint */
  async pollNative() {
    if (!this.native || this.paused || this._draining) return;
    this._draining = true;
    try {
      const fixes = await drainNativeLocations();
      let accepted = 0;
      for (const f of fixes) {
        if (this.addPoint(f)) accepted++;
      }
      if (accepted) this.maybeRecalc();
    } finally {
      this._draining = false;
    }
  }

  maybeRecalc() {
    const now = Date.now();
    if (this.points.length > 1 && now - this.lastAnalyze > 1200) this.recalc();
  }

  /**
   * 收点。返回是否被接受。
   * 过滤：时间去重、精度阈值、采样节流、GPS 跳点。
   */
  addPoint(pos) {
    if (this.paused) return false;
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return false;

    const ts = Number.isFinite(pos.ts) ? pos.ts : Date.now();
    if (ts <= this.lastTs) return false; // 重复 / 乱序（原生缓冲与实时源可能重叠）

    // 精度太差的点一律丢弃（含首个点）：宁愿晚几秒等到好定位，也不要一个坏点把轨迹拉歪
    if (Number.isFinite(pos.accuracy) && pos.accuracy > MAX_ACCURACY_M) {
      return false;
    }

    const last = this.points[this.points.length - 1];
    if (last) {
      const dt = (ts - last.ts) / 1000;
      if (dt < MIN_INTERVAL_MS / 1000) return false; // 采样节流
      const d = haversine(last, pos);
      if (d > 3 && d / dt > MAX_SPEED_MPS) return false; // 速度异常 → 判为跳点
    }

    this.lastTs = ts;
    this.points.push({
      lat: pos.lat,
      lon: pos.lon,
      altitude: pos.altitude,
      accuracy: pos.accuracy,
      speed: pos.speed,
      heading: pos.heading,
      ts
    });
    this.onStatus({ running: true, paused: false, pointCount: this.points.length });
    return true;
  }

  async recalc() {
    if (!this.points.length) return;
    this.lastAnalyze = Date.now();
    try {
      const points =
        this.running && this.points.length === 1
          ? [this.points[0], { ...this.points[0], ts: Date.now() }]
          : this.points;
      const stats = await this.worker.analyze(points);
      this.stats = stats;
      this.onUpdate(stats, this.points);
    } catch (err) {
      console.warn('[tracker] 计算失败', err);
    }
  }

  async stop() {
    if (!this.running) return null;
    // 停服务前再多拉两轮，确保拿到最后一批点
    if (this.native) {
      await this.pollNative();
      await stopNativeTracking();
      await this.pollNative();
    }
    this.running = false;
    this.paused = false;
    this.stopWatch?.();
    this.stopWatch = null;
    this.clearPoll();
    if (this.analyzeTimer) {
      clearInterval(this.analyzeTimer);
      this.analyzeTimer = null;
    }
    this.releaseWakeLock();

    if (this.points.length >= 1) {
      await this.recalc();
    }

    this.onStatus({ running: false, paused: false, pointCount: this.points.length });
    return { stats: this.stats, points: this.points, startedAt: this.startedAt, endedAt: Date.now() };
  }

  discard() {
    this.stopWatch?.();
    this.stopWatch = null;
    this.clearPoll();
    if (this.analyzeTimer) {
      clearInterval(this.analyzeTimer);
      this.analyzeTimer = null;
    }
    if (this.native) stopNativeTracking();
    this.releaseWakeLock();
    this.running = false;
    this.paused = false;
    this.points = [];
    this.stats = null;
    this.startedAt = null;
    this.lastTs = 0;
    this.onStatus({ running: false, paused: false, pointCount: 0 });
  }

  clearPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async requestWakeLock() {
    if (this.native) return;
    try {
      if (navigator.wakeLock && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener?.('release', () => {
          this.wakeLock = null;
        });
      }
    } catch {
      /* 不支持就算了 */
    }
  }

  releaseWakeLock() {
    try {
      this.wakeLock?.release?.();
    } catch {
      /* ignore */
    }
    this.wakeLock = null;
  }

  destroy() {
    this.discard();
    this.worker.terminate();
  }
}
