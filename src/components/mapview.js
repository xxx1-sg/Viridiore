/**
 * 轻量 Canvas 地图
 * 不依赖任何地图服务：离线可用、性能可控，支持平移 / 缩放 / 标记 / 轨迹绘制。
 * 需要真实底图时由 map-factory 切换到高德适配器。
 */

const TILE = 256;
const WORLD = TILE; // 世界像素 = 256 * 2^zoom

function toWorld(lat, lon, zoom) {
  const scale = WORLD * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
  const x = ((lon + 180) / 360) * scale;
  const s = Math.sin((clampedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function fromWorld(x, y, zoom) {
  const scale = WORLD * Math.pow(2, zoom);
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

export class CanvasMap {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      minZoom: 8,
      maxZoom: 17,
      padding: 36,
      onMarkerClick: null,
      onViewChange: null,
      ...options
    };
    this.view = { lat: 22.55, lon: 114.06, zoom: 12 };
    this.markers = [];
    this.path = [];
    this.selectedId = null;
    this.pointers = new Map();
    this.dragging = false;
    this.lastPointer = null;
    this.pinchStart = null;
    this.raf = null;
    this.destroyed = false;

    this._bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
  }

  /* ---------------- 尺寸 ---------------- */
  resize() {
    const parent = this.canvas.parentElement || this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  /* ---------------- 数据 ---------------- */
  setView(view) {
    this.view = { ...this.view, ...view };
    this.view.zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, this.view.zoom));
    this.render();
  }

  setMarkers(markers = []) {
    this.markers = markers;
    this.render();
  }

  setPath(points = []) {
    this.path = points;
    this.render();
  }

  select(id) {
    this.selectedId = id;
    this.render();
  }

  fitBounds(points, padding = 40) {
    const pts = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (!pts.length) return;

    if (pts.length === 1) {
      this.setView({ lat: pts[0].lat, lon: pts[0].lon, zoom: 14 });
      return;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    pts.forEach((p) => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    });

    const center = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
    let zoom = this.view.zoom;
    const w = Math.max(40, this.width - padding * 2);
    const h = Math.max(40, this.height - padding * 2);

    for (let z = this.options.maxZoom; z >= this.options.minZoom; z--) {
      const a = toWorld(maxLat, minLon, z);
      const b = toWorld(minLat, maxLon, z);
      if (Math.abs(b.x - a.x) <= w && Math.abs(b.y - a.y) <= h) {
        zoom = z;
        break;
      }
      zoom = z;
    }

    this.view = { ...center, zoom };
    this.render();
  }

  zoomBy(delta) {
    const next = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, this.view.zoom + delta));
    if (next === this.view.zoom) return;
    this.view.zoom = next;
    this.render();
    this.options.onViewChange?.(this.view);
  }

  /* ---------------- 投影 ---------------- */
  project(lat, lon) {
    const c = toWorld(this.view.lat, this.view.lon, this.view.zoom);
    const p = toWorld(lat, lon, this.view.zoom);
    return {
      x: p.x - c.x + this.width / 2,
      y: p.y - c.y + this.height / 2
    };
  }

  unproject(x, y) {
    const c = toWorld(this.view.lat, this.view.lon, this.view.zoom);
    return fromWorld(c.x + x - this.width / 2, c.y + y - this.height / 2, this.view.zoom);
  }

  /* ---------------- 交互 ---------------- */
  _bind() {
    const el = this.canvas;
    el.style.touchAction = 'none';

    this._onPointerDown = (e) => {
      el.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchStart = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: this.view.zoom
        };
      }
      this.dragging = true;
      this.moved = 0;
      this.lastPointer = { x: e.offsetX, y: e.offsetY };
    };

    this._onPointerMove = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

      if (this.pointers.size === 2 && this.pinchStart) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = dist / (this.pinchStart.dist || dist);
        const zoom = Math.max(
          this.options.minZoom,
          Math.min(this.options.maxZoom, this.pinchStart.zoom + Math.log2(ratio))
        );
        this.view.zoom = zoom;
        this.render();
        return;
      }

      if (!this.dragging || !this.lastPointer) return;
      const dx = e.offsetX - this.lastPointer.x;
      const dy = e.offsetY - this.lastPointer.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.lastPointer = { x: e.offsetX, y: e.offsetY };

      const c = toWorld(this.view.lat, this.view.lon, this.view.zoom);
      const next = fromWorld(c.x - dx, c.y - dy, this.view.zoom);
      this.view.lat = Math.max(-84, Math.min(84, next.lat));
      this.view.lon = next.lon;
      this.scheduleRender();
    };

    this._onPointerUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = null;
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.lastPointer = null;
        if (this.moved < 6) this._hitTest(e.offsetX, e.offsetY);
        this.options.onViewChange?.(this.view);
      }
    };

    this._onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.5 : 0.5;
      const before = this.unproject(e.offsetX, e.offsetY);
      const next = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, this.view.zoom + delta));
      if (next === this.view.zoom) return;
      this.view.zoom = next;
      // 让光标下的地理点保持不动
      const after = this.unproject(e.offsetX, e.offsetY);
      this.view.lat -= after.lat - before.lat;
      this.view.lon -= after.lon - before.lon;
      this.render();
      this.options.onViewChange?.(this.view);
    };

    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('pointercancel', this._onPointerUp);
    el.addEventListener('pointerleave', this._onPointerUp);
    el.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _hitTest(x, y) {
    const hit = [...this.markers].reverse().find((m) => {
      const p = this.project(m.lat, m.lon);
      return Math.hypot(p.x - x, p.y - y) < 22;
    });
    if (hit) {
      this.selectedId = hit.id;
      this.render();
      this.options.onMarkerClick?.(hit);
    }
  }

  /* ---------------- 渲染 ---------------- */
  scheduleRender() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.render();
    });
  }

  colors() {
    const style = getComputedStyle(document.documentElement);
    const get = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    return {
      moss: get('--moss-400', '#649776'),
      mossDeep: get('--moss-600', '#326046'),
      dawn: get('--dawn-400', '#e5a457'),
      danger: get('--danger', '#c04b40'),
      ink: get('--ink', '#16261d'),
      text: get('--ink-2', '#4c6156')
    };
  }

  render() {
    if (this.destroyed || !this.width) return;
    const { ctx, width: w, height: h } = this;
    const c = this.colors();

    ctx.clearRect(0, 0, w, h);

    // 地形底色
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0d1d15');
    bg.addColorStop(0.55, '#12291d');
    bg.addColorStop(1, '#0a1710');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 地形斑块
    ctx.save();
    ctx.globalAlpha = 0.5;
    const blobs = [
      { x: w * 0.24, y: h * 0.32, r: h * 0.42, color: 'rgba(63,107,76,0.28)' },
      { x: w * 0.74, y: h * 0.62, r: h * 0.5, color: 'rgba(43,84,60,0.3)' },
      { x: w * 0.55, y: h * 0.15, r: h * 0.3, color: 'rgba(90,120,80,0.16)' }
    ];
    blobs.forEach((b) => {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 网格
    const gridSize = 64;
    const origin = this.project(this.view.lat, this.view.lon);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    const offX = ((origin.x % gridSize) + gridSize) % gridSize;
    const offY = ((origin.y % gridSize) + gridSize) % gridSize;
    for (let x = offX; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
      ctx.stroke();
    }
    for (let y = offY; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
      ctx.stroke();
    }

    // 轨迹
    if (this.path.length > 1) {
      const pts = this.path.map((p) => this.project(p.lat, p.lon));
      const drawPath = (lineWidth, color, blur) => {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        if (blur) {
          ctx.shadowColor = color;
          ctx.shadowBlur = blur;
        }
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
        ctx.restore();
      };
      drawPath(9, 'rgba(229,164,87,0.16)', 0);
      drawPath(4, c.dawn, 8);
      drawPath(1.4, 'rgba(255,240,215,0.85)', 0);

      // 起终点
      const s = pts[0];
      const e = pts[pts.length - 1];
      this._dot(s.x, s.y, 5, '#8fd6a8');
      this._dot(e.x, e.y, 6, '#f0b268');
    }

    // 标记
    this._labelRects = [];
    this.markers.forEach((m) => {
      const p = this.project(m.lat, m.lon);
      if (p.x < -60 || p.y < -60 || p.x > w + 60 || p.y > h + 60) return;
      this._marker(p, m);
    });

    // 比例尺
    this._scaleBar(c);

    // 暗角
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(3,10,6,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  _dot(x, y, r, color) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,20,13,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  }

  _marker(p, m) {
    const { ctx } = this;
    const selected = m.id === this.selectedId;
    const color = m.color || '#e5a457';

    if (m.kind === 'self') {
      const pulse = (performance.now() % 2000) / 2000;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + pulse * 20, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(127,211,154,${0.24 * (1 - pulse)})`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, selected ? 8 : 6.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const showLabel =
      m.label &&
      (selected || this.markers.length <= 3 || this.view.zoom >= 13.2) &&
      this._labelRects.length < 6;

    if (showLabel) {
      const fontSize = 10.5;
      ctx.font = `600 ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
      const textWidth = ctx.measureText(m.label).width;
      const bw = textWidth + 12;
      const bh = 18;
      const bx = p.x - bw / 2;
      const by = p.y - 10 - bh;

      // 与已绘制标签碰撞时跳过
      const collides = this._labelRects.some(
        (r) => bx < r.x + r.w + 3 && bx + bw > r.x - 3 && by < r.y + r.h + 3 && by + bh > r.y - 3
      );
      if (collides && !selected) return;
      this._labelRects.push({ x: bx, y: by, w: bw, h: bh });
      ctx.beginPath();
      const r = 6;
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.fillStyle = selected ? 'rgba(229,164,87,0.94)' : 'rgba(9,22,15,0.8)';
      ctx.fill();
      ctx.fillStyle = selected ? '#2c1d0c' : '#e8f2ea';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.label, p.x, by + bh / 2);
    }
  }

  _scaleBar(c) {
    const { ctx, width: w, height: h } = this;
    const mpp = metersPerPixel(this.view.lat, this.view.zoom);
    const targetPx = 80;
    const meters = mpp * targetPx;
    const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find(
      (v) => v >= meters / 2
    ) || 50000;
    const px = nice / mpp;

    const x = 14;
    const y = h - 18;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y);
    ctx.lineTo(x + px, y);
    ctx.lineTo(x + px, y - 5);
    ctx.stroke();

    ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(230,240,232,0.72)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, x + 2, y - 6);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    const el = this.canvas;
    el.removeEventListener('pointerdown', this._onPointerDown);
    el.removeEventListener('pointermove', this._onPointerMove);
    el.removeEventListener('pointerup', this._onPointerUp);
    el.removeEventListener('pointercancel', this._onPointerUp);
    el.removeEventListener('pointerleave', this._onPointerUp);
    el.removeEventListener('wheel', this._onWheel);
  }
}
