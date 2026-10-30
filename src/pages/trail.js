/** 轨迹页 */
import { icon } from '../core/icons.js';
import { CanvasMap } from '../components/mapview.js';
import { TrailTracker } from '../services/tracker.js';
import { trailRepo, bus } from '../core/store.js';
import { formatDate, formatTime, formatDistance, formatDuration, humanDuration, relTime } from '../core/format.js';
import { download, toGPX } from '../services/exporter.js';
import { buildNarrative, compareWithPrevious } from '../services/narrative.js';
import { renderCard, downloadCard, shareCard } from '../services/sharecard.js';
import { confirmDialog, formDialog, openModal } from '../core/modal.js';
import { toastOk, toastError, toastWarn } from '../core/toast.js';
import { escapeHtml } from '../core/dom.js';
import { appState, currentMountain } from '../state.js';

let tracker = null;

/** 生成一段示例轨迹（无 GPS 环境体验用） */
function demoPoints() {
  const base = currentMountain();
  const pts = [];
  const n = 160;
  const start = Date.now() - 3.2 * 3600e3;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2.2;
    const radius = 0.012 * (1 - t * 0.35);
    pts.push({
      lat: base.lat + Math.cos(angle) * radius + Math.sin(t * 9) * 0.0012,
      lon: base.lon + Math.sin(angle) * radius * 0.9,
      altitude: base.elevation * 0.35 + base.elevation * 0.6 * Math.sin(Math.min(1, t * 1.25) * Math.PI) + Math.sin(t * 30) * 6,
      accuracy: 8,
      ts: start + i * 72000
    });
  }
  return pts;
}

export default {
  id: 'trail',
  title: '轨迹',
  icon: 'footprint',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">轨迹</h1>
          <p class="page-head__desc">GPS 记录 · 后台计算 · 可导出 GPX</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="card" title="生成光之卡片">${icon('sparkles', 19)}</button>
          <button class="icon-btn" type="button" data-action="export" title="导出 GPX">${icon('download', 19)}</button>
        </div>
      </div>

      <div class="trail-map" id="trailMapWrap">
        <canvas id="trailCanvas"></canvas>
        <div class="team-map__tools">
          <button class="map-tool" type="button" data-action="zoom-in" title="放大">${icon('zoomIn', 16)}</button>
          <button class="map-tool" type="button" data-action="zoom-out" title="缩小">${icon('zoomOut', 16)}</button>
          <button class="map-tool" type="button" data-action="fit" title="适配范围">${icon('expand', 16)}</button>
        </div>
        <div class="map-empty" id="trailEmpty">
          <div class="map-empty__card">
            ${icon('map', 26)}
            <div>还没有轨迹数据<br />点下方「开始记录」，或先载入示例</div>
          </div>
        </div>
        <div class="trail-map__overlay">
          <span class="trail-map__badge is-idle" id="trailState"><span class="dot"></span>待机</span>
          <span class="trail-map__badge" id="trailPointCount">0 个点</span>
        </div>
      </div>

      <div class="stat-grid" style="margin-top:14px">
        <div class="stat"><div class="stat__label">距离</div><div class="stat__value" id="stDistance">0.00<small>km</small></div></div>
        <div class="stat"><div class="stat__label">累计爬升</div><div class="stat__value" id="stGain">0<small>m</small></div></div>
        <div class="stat"><div class="stat__label">用时</div><div class="stat__value" id="stTime">00:00</div></div>
        <div class="stat"><div class="stat__label">平均配速</div><div class="stat__value" id="stPace">--</div></div>
      </div>

      <div class="trail-controls">
        <button class="trail-record" type="button" id="recordBtn">${icon('play', 17)} 开始记录</button>
        <button class="btn btn--icon btn--ghost" type="button" data-action="pause" id="pauseBtn" style="display:none" title="暂停">${icon('pause', 17)}</button>
      </div>

      <div class="trail-profile" style="margin-top:14px">
        <canvas id="trailProfile"></canvas>
        <div class="trail-profile__label">
          <span id="profileMin">--</span>
          <span>海拔剖面</span>
          <span id="profileMax">--</span>
        </div>
      </div>

      <section class="section" style="margin-top:22px">
        <div class="section__head">
          <div>
            <h2 class="section__title">历史记录</h2>
            <p class="section__desc">存在本机 IndexedDB，不上传云端</p>
          </div>
          <button class="btn btn--sm btn--ghost" type="button" data-action="demo" title="生成一段示例轨迹，仅用于体验卡片生成，不是你真实走过的路">载入示例轨迹</button>
        </div>
        <div class="stack" id="trailHistory">
          <div class="loading-inline"><span class="spinner"></span>读取中…</div>
        </div>
      </section>
    `;
  },

  async mount(el, ctx) {
    const $ = (s) => el.querySelector(s);
    const canvas = $('#trailCanvas');
    const map = new CanvasMap(canvas, { onViewChange: () => {} });
    map.setView({ lat: currentMountain().lat, lon: currentMountain().lon, zoom: 14 });
    map.setMarkers([]);

    const profileCanvas = $('#trailProfile');
    let currentPoints = [];
    let profile = [];
    let savedTrails = [];
    let currentStats = null;
    let activeTrail = null;

    /* ---------- 绘制 ---------- */
    const drawProfile = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(80, profileCanvas.clientWidth || profileCanvas.parentElement.clientWidth - 28);
      const h = 74;
      profileCanvas.width = Math.max(1, w * dpr);
      profileCanvas.height = h * dpr;
      const c = profileCanvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      if (!profile.length) {
        c.strokeStyle = 'rgba(125,143,131,0.4)';
        c.setLineDash([3, 4]);
        c.beginPath();
        c.moveTo(0, h / 2);
        c.lineTo(w, h / 2);
        c.stroke();
        c.setLineDash([]);
        $('#profileMin').textContent = '--';
        $('#profileMax').textContent = '--';
        return;
      }

      const min = Math.min(...profile);
      const max = Math.max(...profile);
      const span = Math.max(1, max - min);
      const step = w / Math.max(1, profile.length - 1);

      const yOf = (v) => h - 8 - ((v - min) / span) * (h - 22);

      // 面积
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(229,164,87,0.34)');
      grad.addColorStop(1, 'rgba(229,164,87,0.02)');
      c.beginPath();
      c.moveTo(0, h);
      profile.forEach((v, i) => c.lineTo(i * step, yOf(v)));
      c.lineTo(w, h);
      c.closePath();
      c.fillStyle = grad;
      c.fill();

      // 折线
      c.beginPath();
      profile.forEach((v, i) => {
        const x = i * step;
        const y = yOf(v);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.strokeStyle = '#e5a457';
      c.lineWidth = 1.8;
      c.lineJoin = 'round';
      c.stroke();

      $('#profileMin').textContent = `${Math.round(min)} m`;
      $('#profileMax').textContent = `${Math.round(max)} m`;
    };

    const renderStats = (stats) => {
      if (!stats) return;
      currentStats = stats;
      $('#stDistance').innerHTML = `${(stats.distanceKm || 0).toFixed(2)}<small>km</small>`;
      $('#stGain').innerHTML = `${stats.elevation?.gain || 0}<small>m</small>`;
      $('#stTime').textContent = formatDuration(stats.duration || 0);
      $('#stPace').innerHTML = stats.avgPace
        ? `${Math.floor(stats.avgPace / 60000)}'${String(Math.floor((stats.avgPace % 60000) / 1000)).padStart(2, '0')}"<small>/km</small>`
        : '--';
    };

    const setStateBadge = (status) => {
      const badge = $('#trailState');
      if (status.running) {
        badge.classList.remove('is-idle');
        badge.innerHTML = `<span class="dot"></span>${status.paused ? '已暂停' : '记录中'}`;
      } else {
        badge.classList.add('is-idle');
        badge.innerHTML = '<span class="dot"></span>待机';
      }
      $('#trailPointCount').textContent = `${status.pointCount || 0} 个点`;
    };

    const onTrackerUpdate = (stats, points) => {
      currentPoints = points;
      profile = stats.profile || [];
      const path = stats.simplified || points;
      map.setPath(path);
      // 空状态下不显示山峰标注，避免与空状态卡片叠在一起
      map.setMarkers(
        path.length > 1
          ? [{ id: 'peak', lat: currentMountain().lat, lon: currentMountain().lon, label: currentMountain().name, color: '#8dbf9e', kind: 'peak' }]
          : []
      );
      $('#trailEmpty')?.classList.toggle('hidden', path.length > 1);
      renderStats(stats);
      drawProfile();
    };

    /* ---------- 记录器 ---------- */
    if (!tracker) {
      tracker = new TrailTracker({
        onUpdate: onTrackerUpdate,
        onStatus: (status) => {
          setStateBadge(status);
          const btn = $('#recordBtn');
          const pauseBtn = $('#pauseBtn');
          if (status.running) {
            btn.classList.add('is-recording');
            btn.innerHTML = `${icon('square', 16)} 结束并保存`;
            pauseBtn.style.display = status.paused ? 'none' : 'grid';
            if (status.paused) {
              btn.innerHTML = `${icon('play', 16)} 继续记录`;
            }
          } else {
            btn.classList.remove('is-recording');
            btn.innerHTML = `${icon('play', 17)} 开始记录`;
            pauseBtn.style.display = 'none';
          }
        },
        onError: (err) => toastError(err.message || '定位失败')
      });
    } else {
      // 页面重新挂载时接管已有记录器
      tracker.onUpdate = onTrackerUpdate;
      tracker.onStatus = (status) => setStateBadge(status);
    }

    const startRecord = async () => {
      if (!navigator.geolocation) {
        toastError('当前环境不支持定位');
        return;
      }
      try {
        map.setPath([]);
        profile = [];
        drawProfile();
        await tracker.start();
        toastOk('开始记录，请保持应用在前台以获得更准的轨迹');
        map.fitBounds([{ lat: currentMountain().lat, lon: currentMountain().lon }]);
      } catch (err) {
        toastError(err.message);
      }
    };

    const stopRecord = async () => {
      const result = await tracker.stop();
      const stats = result?.stats;
      if (!stats || (stats.distance || 0) < 5) {
        toastWarn('轨迹太短，未保存');
        tracker.discard();
        return;
      }

      const name = await formDialog({
        title: '保存轨迹',
        desc: `共 ${formatDistance(stats.distance)}，累计爬升 ${stats.elevation?.gain || 0} m`,
        fields: [
          { name: 'name', label: '轨迹名称', value: `${currentMountain().name} · ${new Date().getMonth() + 1}/${new Date().getDate()}`, required: true },
          { name: 'note', label: '备注（可选）', type: 'textarea', placeholder: '路况、天气、同行的人…' }
        ],
        submitText: '保存'
      });

      if (!name) {
        tracker.discard();
        return;
      }

      await trailRepo.save({
        name: name.name,
        note: name.note,
        points: result.points,
        stats,
        startedAt: result.startedAt,
        endedAt: result.endedAt
      });
      toastOk('已保存到本机');
      tracker.discard();
      loadHistory();
    };

    /* ---------- 历史 ---------- */
    const loadHistory = async () => {
      savedTrails = await trailRepo.list();
      const host = $('#trailHistory');
      if (!savedTrails.length) {
        host.innerHTML = `<div class="card"><div class="empty">
          ${icon('footprint', 34)}
          <div class="empty__title">还没有轨迹</div>
          <div class="empty__desc">点上方「开始记录」实时采集，或载入示例查看效果</div>
        </div></div>`;
        return;
      }

      host.innerHTML = savedTrails
        .map((t) => {
          const s = t.stats || {};
          return `<div class="card" style="padding:12px">
            <div class="row row--between" style="align-items:flex-start">
              <div class="grow">
                <div style="font-size:14px;font-weight:600">${escapeHtml(t.name)}</div>
                <div class="trail-item__meta">
                  <span>${formatDate(t.startedAt)}</span>
                  <span>${(s.distanceKm || 0).toFixed(2)} km</span>
                  <span>爬升 ${s.elevation?.gain || 0} m</span>
                  <span>${humanDuration((t.endedAt || 0) - (t.startedAt || 0))}</span>
                </div>
              </div>
              <div class="row" style="gap:2px">
                <button class="icon-btn" type="button" data-preview="${t.id}" title="查看">${icon('map', 17)}</button>
                <button class="icon-btn" type="button" data-gpx="${t.id}" title="导出 GPX">${icon('download', 17)}</button>
                <button class="icon-btn" type="button" data-share="${t.id}" title="分享">${icon('share', 17)}</button>
                <button class="icon-btn" type="button" data-del="${t.id}" title="删除">${icon('trash', 17)}</button>
              </div>
            </div>
          </div>`;
        })
        .join('');
    };

    /* ---------- 光之卡片 ---------- */
    const openCard = (trail) => {
      const mountain = currentMountain();
      const startedAt = trail.startedAt || Date.now();
      const hour = new Date(startedAt).getHours();
      // 天没亮就出发的，只陈述"赶在天亮前上了山"，不臆断看没看到日出
      const mode = hour < 9 ? 'dawn' : 'hike';

      const narrative = buildNarrative({
        trail,
        weather: appState.weather,
        mountain,
        mode
      });

      const canvas = renderCard({
        narrative,
        mode: 'hike',
        sourceLabel: appState.weather?.providerName
          ? `${appState.weather.providerName} · ${formatTime(appState.weather.updatedAt)}`
          : '未取到天气'
      });

      const filename = `晓山青-${trail.startedAt ? formatDate(trail.startedAt) : '轨迹'}.png`;

      openModal({
        title: '光之卡片',
        desc: '时间、坐标、海拔、当时的天气，都在这张图上',
        wide: true,
        body: `<div class="card-preview"><canvas id="trailCardCanvas"></canvas></div>`,
        actions: [
          {
            label: '分享',
            variant: 'primary',
            close: false,
            onClick: async () => {
              const ok = await shareCard(canvas, { title: '晓山青', text: narrative.headline });
              if (!ok) {
                await downloadCard(canvas, filename);
                toastOk('已保存图片');
              }
            }
          },
          {
            label: '保存图片',
            close: false,
            onClick: async () => {
              await downloadCard(canvas, filename);
              toastOk('已保存图片');
            }
          }
        ],
        onMount: (modalEl) => {
          const host = modalEl.querySelector('#trailCardCanvas');
          if (!host) return;
          host.width = canvas.width;
          host.height = canvas.height;
          host.getContext('2d').drawImage(canvas, 0, 0);
        }
      });
    };

    /* ---------- 事件 ---------- */
    el.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action], [data-preview], [data-gpx], [data-share], [data-del]');
      if (!target) return;

      if (target.id === 'recordBtn') return;

      const action = target.dataset.action;
      if (action === 'zoom-in') map.zoomBy(1);
      if (action === 'zoom-out') map.zoomBy(-1);
      if (action === 'fit') map.fitBounds(currentPoints.length ? currentPoints : [{ lat: currentMountain().lat, lon: currentMountain().lon }]);
      if (action === 'pause') {
        if (tracker.paused) tracker.resume();
        else tracker.pause();
      }
      if (action === 'export') {
        if (!currentPoints.length) {
          toastWarn('当前没有可导出的轨迹');
          return;
        }
        download(`track-${Date.now()}.gpx`, toGPX({ name: '晓山青轨迹', points: currentPoints, startedAt: currentPoints[0]?.ts }), 'application/gpx+xml');
        toastOk('GPX 已导出');
      }
      if (action === 'card') {
        if (!currentPoints.length) {
          toastWarn('还没有轨迹可以生成卡片');
          return;
        }
        openCard(
          activeTrail || {
            name: `${currentMountain().name} 轨迹`,
            startedAt: currentPoints[0]?.ts || Date.now(),
            endedAt: currentPoints[currentPoints.length - 1]?.ts || Date.now(),
            points: currentPoints,
            stats: currentStats || {}
          }
        );
      }
      if (action === 'demo') {
        const points = demoPoints();
        const fake = await new Promise((resolve) => {
          const worker = tracker.worker;
          worker.analyze(points).then(resolve).catch(() => resolve(null));
        });
        if (!fake) {
          toastError('示例计算失败');
          return;
        }
        currentPoints = points;
        profile = fake.profile || [];
        map.setPath(fake.simplified || points);
        map.fitBounds(points);
        renderStats(fake);
        drawProfile();
        $('#trailState').innerHTML = '<span class="dot"></span>示例轨迹';
        $('#trailPointCount').textContent = `${fake.pointCount} 个点`;
        toastOk('已载入示例轨迹（不会保存）');
      }

      const previewId = target.dataset.preview;
      if (previewId) {
        const trail = savedTrails.find((t) => t.id === previewId);
        if (!trail) return;
        activeTrail = trail;
        currentPoints = trail.points || [];
        profile = trail.stats?.profile || [];
        map.setPath(trail.stats?.simplified || trail.points || []);
        map.fitBounds(trail.points || []);
        renderStats(trail.stats);
        drawProfile();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const gpxId = target.dataset.gpx;
      if (gpxId) {
        const trail = savedTrails.find((t) => t.id === gpxId);
        download(`${trail.name || 'trail'}.gpx`, toGPX(trail), 'application/gpx+xml');
        toastOk('GPX 已导出');
      }

      const shareId = target.dataset.share;
      if (shareId) {
        const trail = savedTrails.find((t) => t.id === shareId);
        if (trail) openCard(trail);
      }

      const delId = target.dataset.del;
      if (delId) {
        const ok = await confirmDialog({
          title: '删除这条轨迹？',
          desc: '删除后不可恢复，导出的 GPX 文件不受影响。',
          confirmText: '删除',
          danger: true
        });
        if (ok) {
          await trailRepo.remove(delId);
          toastOk('已删除');
          loadHistory();
        }
      }
    });

    $('#recordBtn').addEventListener('click', async () => {
      if (!tracker.isRunning) {
        await startRecord();
      } else if (tracker.paused) {
        tracker.resume();
      } else {
        await stopRecord();
      }
    });

    const profileObserver = new ResizeObserver(() => drawProfile());
    profileObserver.observe(profileCanvas.parentElement);

    const off = bus.on('trail:change', loadHistory);
    await loadHistory();

    // 默认展示最近一条
    if (savedTrails.length) {
      const t = savedTrails[0];
      activeTrail = t;
      currentPoints = t.points || [];
      profile = t.stats?.profile || [];
      map.setPath(t.stats?.simplified || t.points || []);
      map.fitBounds(t.points || []);
      renderStats(t.stats);
      drawProfile();
      $('#trailState').innerHTML = `<span class="dot"></span>${t.name}`;
    }
    drawProfile();

    return () => {
      off();
      profileObserver.disconnect();
      map.destroy();
      // tracker 保持运行（后台记录），只解绑 UI
    };
  }
};
