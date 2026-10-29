/**
 * 轨迹记录器：GPS 采集 + Worker 计算
 */
import { watchPosition } from './geo.js';

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
  }

  get isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    this.points = [];
    this.startedAt = Date.now();
    this.running = true;
    this.paused = false;
    this.onStatus({ running: true, paused: false, pointCount: 0 });

    this.stopWatch = watchPosition(
      (pos) => this.addPoint(pos),
      (err) => this.onError(err),
      { maximumAge: 1000 }
    );

    // 即使 GPS 还没有点，也每 4 秒刷新一次时长
    this.analyzeTimer = setInterval(() => this.recalc(), 4000);
  }

  pause() {
    if (!this.running) return;
    this.paused = true;
    this.stopWatch?.();
    this.stopWatch = null;
    this.onStatus({ running: true, paused: true, pointCount: this.points.length });
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.stopWatch = watchPosition(
      (pos) => this.addPoint(pos),
      (err) => this.onError(err),
      { maximumAge: 1000 }
    );
    this.onStatus({ running: true, paused: false, pointCount: this.points.length });
  }

  addPoint(pos) {
    if (this.paused) return;
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return;
    if (pos.accuracy && pos.accuracy > 80) return; // 精度太差的点丢弃

    const last = this.points[this.points.length - 1];
    if (last && pos.ts - last.ts < 800) return;

    this.points.push({
      lat: pos.lat,
      lon: pos.lon,
      altitude: pos.altitude,
      accuracy: pos.accuracy,
      speed: pos.speed,
      heading: pos.heading,
      ts: pos.ts || Date.now()
    });

    this.onStatus({ running: true, paused: false, pointCount: this.points.length });

    const now = Date.now();
    if (this.points.length > 1 && now - this.lastAnalyze > 1500) {
      this.recalc();
    }
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
    this.running = false;
    this.paused = false;
    this.stopWatch?.();
    this.stopWatch = null;
    clearInterval(this.analyzeTimer);
    this.analyzeTimer = null;

    if (this.points.length >= 2) {
      await this.recalc();
    } else if (this.points.length === 1) {
      await this.recalc();
    }

    this.onStatus({ running: false, paused: false, pointCount: this.points.length });
    return { stats: this.stats, points: this.points, startedAt: this.startedAt, endedAt: Date.now() };
  }

  discard() {
    this.stopWatch?.();
    this.stopWatch = null;
    clearInterval(this.analyzeTimer);
    this.analyzeTimer = null;
    this.running = false;
    this.paused = false;
    this.points = [];
    this.stats = null;
    this.startedAt = null;
    this.onStatus({ running: false, paused: false, pointCount: 0 });
  }

  destroy() {
    this.discard();
    this.worker.terminate();
  }
}
