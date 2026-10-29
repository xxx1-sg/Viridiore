/** 队友页：位置共享 */
import { icon } from '../core/icons.js';
import { CanvasMap } from '../components/mapview.js';
import { MOUNTAINS } from '../data/mountains.js';
import { formatTime, formatCoordShort, relTime } from '../core/format.js';
import { haversine } from '../services/geo.js';
import { openModal, openSheet } from '../core/modal.js';
import { copyText, shareText } from '../services/exporter.js';
import { toastOk, toastWarn } from '../core/toast.js';
import { config } from '../config.js';
import { escapeHtml } from '../core/dom.js';

const BASE = MOUNTAINS[0];

const PEOPLE = [
  { id: 'p1', name: '阿岑', role: '领队', color: '#e5a457', offset: [0.010, -0.014], speed: 3.4, battery: 78 },
  { id: 'p2', name: '小林', role: '收队', color: '#6f9fb8', offset: [-0.012, 0.016], speed: 2.9, battery: 64 },
  { id: 'p3', name: '阿岚', role: '队员', color: '#8dbf9e', offset: [0.021, 0.009], speed: 3.1, battery: 42 },
  { id: 'p4', name: '老周', role: '队员', color: '#c98b6b', offset: [-0.006, -0.024], speed: 2.6, battery: 91 },
  { id: 'p5', name: 'Nina', role: '队员', color: '#a9a1d6', offset: [0.026, -0.006], speed: 3.7, battery: 55 }
];

function createTeam() {
  const me = {
    id: 'me',
    name: '我',
    role: '本人',
    color: '#7fd39a',
    lat: BASE.lat,
    lon: BASE.lon,
    online: true,
    lastSeen: Date.now(),
    distance: 0,
    battery: 100,
    self: true
  };
  return [me, ...PEOPLE.map((p, i) => ({
    ...p,
    lat: BASE.lat + p.offset[0],
    lon: BASE.lon + p.offset[1],
    online: i !== 4,
    lastSeen: Date.now() - i * 45000,
    distance: 0
  }))].map((t) => ({
    ...t,
    distance: t.self ? 0 : Math.round(haversine(BASE, t))
  }));
}

let team = createTeam();
let tickTimer = null;

export default {
  id: 'teammate',
  title: '队友',
  icon: 'users',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">队友</h1>
          <p class="page-head__desc" id="teamSub">${config.get('sync.endpoint') ? '已连接同步服务' : '本机演示模式 · 未接入同步服务'}</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--sm btn--primary" type="button" data-action="invite">${icon('plus', 15)} 邀请</button>
        </div>
      </div>

      <div class="team-map" id="teamMapWrap" style="margin-bottom:14px">
        <canvas id="teamCanvas"></canvas>
        <div class="team-map__tools">
          <button class="map-tool" type="button" data-action="locate" title="居中">${icon('crosshair', 16)}</button>
          <button class="map-tool" type="button" data-action="fit" title="全览">${icon('expand', 16)}</button>
          <button class="map-tool" type="button" data-action="zoom-in" title="放大">${icon('zoomIn', 16)}</button>
          <button class="map-tool" type="button" data-action="zoom-out" title="缩小">${icon('zoomOut', 16)}</button>
        </div>
        <div class="trail-map__overlay">
          <span class="trail-map__badge" id="teamCount"><span class="dot"></span>0 人在线</span>
          <span class="trail-map__badge" id="teamUpdated">刚刚同步</span>
        </div>
      </div>

      <div class="team-list" id="teamList" style="margin-bottom:16px"></div>

      <div class="team-panel" id="teamPanel" style="display:none"></div>

      <section class="section">
        <div class="settings-group">
          <div class="setting-row">
            <div class="setting-row__main">
              <div class="setting-row__title">只显示在线队友</div>
              <div class="setting-row__desc">离线队友仍会保留在地图外的列表中</div>
            </div>
            <button class="switch" type="button" role="switch" data-toggle="onlineOnly"></button>
          </div>
          <div class="setting-row">
            <div class="setting-row__main">
              <div class="setting-row__title">共享我的位置</div>
              <div class="setting-row__desc">开启后队友可以看到你的实时坐标</div>
            </div>
            <button class="switch" type="button" role="switch" data-toggle="shareSelf"></button>
          </div>
        </div>
        <p class="field__hint" style="padding:10px 4px">
          多人实时位置需要一个同步后端（WebSocket 或轮询 API）。在「设置 → 队友同步」填入服务地址后即可切换为真实数据；未配置时为本地演示。
        </p>
      </section>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    const map = new CanvasMap($('#teamCanvas'), {
      onMarkerClick: (m) => select(m.id)
    });
    let selectedId = null;
    let onlineOnly = false;

    const visible = () => (onlineOnly ? team.filter((t) => t.online) : team);

    const renderMarkers = () => {
      map.setMarkers(
        visible().map((t) => ({
          id: t.id,
          lat: t.lat,
          lon: t.lon,
          label: t.name,
          color: t.online ? t.color : '#7d8f83',
          kind: t.self ? 'self' : 'team'
        }))
      );
      $('#teamCount').innerHTML = `<span class="dot"></span>${team.filter((t) => t.online).length} 人在线`;
      $('#teamUpdated').textContent = `同步于 ${formatTime(Date.now())}`;
    };

    const renderList = () => {
      const host = $('#teamList');
      host.innerHTML = visible()
        .map(
          (t) => `<button class="team-card ${selectedId === t.id ? 'is-selected' : ''}" type="button" data-person="${t.id}">
            <span class="team-card__avatar" style="background:${t.color}">
              ${escapeHtml(t.name.slice(0, 1))}
              ${t.online ? '<span class="online-dot"></span>' : ''}
            </span>
            <span class="grow" style="text-align:left">
              <span class="team-card__name">${escapeHtml(t.name)} <span class="muted" style="font-weight:400;font-size:11px">${t.role}</span></span>
              <span class="team-card__meta">
                <span>${t.online ? `${t.distance} m` : `离线 · ${relTime(t.lastSeen)}`}</span>
                <span>电量 ${t.battery}%</span>
              </span>
            </span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>`
        )
        .join('');
    };

    const renderPanel = (person) => {
      const panel = $('#teamPanel');
      if (!person) {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'grid';
      panel.innerHTML = `
        <div class="row row--between">
          <div class="row" style="gap:10px">
            <span class="team-card__avatar" style="background:${person.color};width:34px;height:34px;font-size:12px">${escapeHtml(person.name.slice(0, 1))}</span>
            <div>
              <div style="font-size:14px;font-weight:600">${escapeHtml(person.name)}</div>
              <div class="muted" style="font-size:11px">${person.role} · ${person.online ? '在线' : '离线'}</div>
            </div>
          </div>
          <button class="icon-btn" type="button" data-action="close-panel">${icon('x', 16)}</button>
        </div>
        <div class="kv" style="border:none;padding:0"><span class="kv__k">坐标</span><span class="kv__v tabular">${formatCoordShort(person.lat, person.lon)}</span></div>
        <div class="kv" style="border:none;padding:0"><span class="kv__k">与你距离</span><span class="kv__v">${person.distance} m</span></div>
        <div class="kv" style="border:none;padding:0"><span class="kv__k">电量</span><span class="kv__v">${person.battery}%</span></div>
        <div class="row" style="gap:8px;margin-top:4px">
          <button class="btn btn--sm btn--ghost grow" type="button" data-action="ping">${icon('message', 14)} 呼叫</button>
          <button class="btn btn--sm btn--ghost grow" type="button" data-action="center">${icon('crosshair', 14)} 居中</button>
        </div>`;
    };

    const select = (id) => {
      selectedId = id;
      const person = team.find((t) => t.id === id);
      map.select(id);
      renderList();
      renderPanel(person);
      if (person) map.setView({ lat: person.lat, lon: person.lon, zoom: Math.max(13, map.view.zoom) });
    };

    const syncSwitches = () => {
      el.querySelectorAll('[data-toggle]').forEach((n) => {
        n.setAttribute('aria-checked', String(!!el.__state?.[n.dataset.toggle]));
      });
    };
    el.__state = { onlineOnly: false, shareSelf: false };

    const simulate = () => {
      team = team.map((t) => {
        if (!t.online || t.self) return t;
        const dLat = (Math.random() - 0.5) * 0.00035;
        const dLon = (Math.random() - 0.5) * 0.00035;
        return {
          ...t,
          lat: t.lat + dLat,
          lon: t.lon + dLon,
          distance: Math.max(40, Math.round(t.distance + (Math.random() - 0.5) * 20)),
          battery: Math.max(5, t.battery - (Math.random() < 0.05 ? 1 : 0)),
          lastSeen: Date.now()
        };
      });
      renderMarkers();
      renderList();
      if (selectedId) {
        const p = team.find((t) => t.id === selectedId);
        if (p) renderPanel(p);
      }
    };

    /* 邀请 */
    const invite = async () => {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const link = `https://mossydawn.app/join/${code}`;
      const { close } = openModal({
        title: '邀请队友加入',
        desc: '把口令或链接发给队友，对方在「队友 → 加入」输入即可看到彼此位置。',
        body: `
          <div class="card" style="text-align:center;background:var(--moss-50);border-color:transparent">
            <div class="muted" style="font-size:11px;letter-spacing:.1em">队伍口令</div>
            <div style="font-family:var(--font-mono);font-size:30px;letter-spacing:.18em;font-weight:600;color:var(--moss-700);margin:8px 0">${code}</div>
            <div class="muted" style="font-size:11px">${link}</div>
          </div>
          <p class="field__hint" style="margin-top:12px">当前为演示口令。接入同步后端后，口令会关联真实房间。</p>`,
        actions: [
          {
            label: '复制口令',
            variant: 'ghost',
            onClick: async () => {
              await copyText(`${code} ${link}`);
              toastOk('已复制');
              return false;
            }
          },
          {
            label: '分享',
            variant: 'primary',
            onClick: async () => {
              const res = await shareText(`加入我的队伍，口令：${code}\n${link}`, '晓山青 · 队友邀请');
              if (res === 'copied') toastOk('已复制');
              close();
            }
          }
        ]
      });
    };

    el.addEventListener('click', async (e) => {
      const personBtn = e.target.closest('[data-person]');
      if (personBtn) {
        select(personBtn.dataset.person);
        return;
      }

      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        const key = toggle.dataset.toggle;
        const next = !el.__state[key];
        el.__state[key] = next;
        toggle.setAttribute('aria-checked', String(next));
        if (key === 'onlineOnly') {
          onlineOnly = next;
          renderList();
          renderMarkers();
        }
        if (key === 'shareSelf' && next) toastOk('已开始共享你的位置（演示）');
        return;
      }

      const action = e.target.closest('[data-action]');
      if (!action) return;
      const a = action.dataset.action;
      if (a === 'invite') invite();
      if (a === 'zoom-in') map.zoomBy(1);
      if (a === 'zoom-out') map.zoomBy(-1);
      if (a === 'fit') map.fitBounds(visible());
      if (a === 'locate') {
        const me = team.find((t) => t.self);
        map.setView({ lat: me.lat, lon: me.lon, zoom: 15 });
      }
      if (a === 'close-panel') {
        selectedId = null;
        map.select(null);
        renderList();
        renderPanel(null);
      }
      if (a === 'ping') {
        const p = team.find((t) => t.id === selectedId);
        toastOk(`已向 ${p?.name || '队友'} 发送呼叫（演示）`);
      }
      if (a === 'center') {
        const p = team.find((t) => t.id === selectedId);
        if (p) map.setView({ lat: p.lat, lon: p.lon, zoom: 15 });
      }
    });

    renderMarkers();
    renderList();
    map.fitBounds(team, 54);
    syncSwitches();

    tickTimer = setInterval(simulate, 4000);

    if (!config.get('sync.endpoint')) {
      $('#teamSub').textContent = '本机演示模式 · 位置每 4 秒模拟更新';
    }

    return () => {
      clearInterval(tickTimer);
      tickTimer = null;
      map.destroy();
    };
  }
};
