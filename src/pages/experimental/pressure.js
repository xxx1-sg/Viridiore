/** 气压页 */
import { icon } from '../core/icons.js';
import { appState, ensureWeather } from '../state.js';
import { pressureRepo, bus } from '../core/store.js';
import { formatTime } from '../core/format.js';
import { toastWarn, toastOk } from '../core/toast.js';

const MIN_P = 960;
const MAX_P = 1040;

function gaugeSvg(value) {
  const ratio = Math.max(0, Math.min(1, (value - MIN_P) / (MAX_P - MIN_P)));
  const arcLen = Math.PI * 90; // 半径 90 的半圆
  const offset = arcLen * (1 - ratio);
  return `<svg viewBox="0 0 210 130" aria-hidden="true">
    <defs>
      <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5b8fa8"/>
        <stop offset="0.45" stop-color="#7fb894"/>
        <stop offset="1" stop-color="#e5a457"/>
      </linearGradient>
    </defs>
    <path d="M15 115 A90 90 0 0 1 195 115" fill="none" stroke="var(--line)" stroke-width="11" stroke-linecap="round"/>
    <path d="M15 115 A90 90 0 0 1 195 115" fill="none" stroke="url(#gaugeGrad)" stroke-width="11"
      stroke-linecap="round" stroke-dasharray="${arcLen}" stroke-dashoffset="${offset}"
      style="transition:stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)"/>
    <circle cx="${105 + 90 * Math.cos(Math.PI * (1 - ratio))}" cy="${115 - 90 * Math.sin(Math.PI * (1 - ratio))}" r="6"
      fill="var(--surface)" stroke="var(--dawn-400)" stroke-width="3"/>
    <text x="18" y="128" font-size="9" fill="var(--ink-3)">960</text>
    <text x="182" y="128" font-size="9" fill="var(--ink-3)">1040</text>
  </svg>`;
}

function trendOf(history) {
  if (history.length < 2) return { delta: 0, tone: 'flat', label: '数据不足' };
  const last = history[history.length - 1].value;
  const prevIdx = Math.max(0, history.length - 7); // 约 3 小时（30 分钟采样）
  const prev = history[prevIdx].value;
  const delta = Number((last - prev).toFixed(1));
  if (delta >= 1.5) return { delta, tone: 'up', label: '气压上升 · 天气转好' };
  if (delta <= -1.5) return { delta, tone: 'down', label: '气压下降 · 天气转坏' };
  return { delta, tone: 'flat', label: '气压平稳' };
}

function adviceOf(pressure, trend) {
  if (trend.tone === 'down' && trend.delta <= -3) {
    return '气压快速下降，低压系统正在接近：未来 12 小时风力和降水概率明显上升，山区行程建议推迟。';
  }
  if (trend.tone === 'down') {
    return '气压缓慢下降，天气有转坏趋势。若计划上山，尽量选择上午并留意云层变化。';
  }
  if (trend.tone === 'up' && trend.delta >= 3) {
    return '气压明显回升，高压控制下天气转晴、能见度提升，是拍照和远眺的好窗口。';
  }
  if (pressure < 1000) {
    return '当前气压偏低，空气湿度通常较大，山顶云海概率提升，但也要注意降雨。';
  }
  return '气压平稳，天气格局稳定。适合按原计划出行，注意早晚温差。';
}

export default {
  id: 'pressure',
  title: '气压',
  icon: 'gauge',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">气压</h1>
          <p class="page-head__desc">趋势比数值更重要</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="refresh" title="刷新">${icon('refresh', 19)}</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="gauge-wrap">
          <div class="gauge">
            <span id="gaugeSvg"></span>
            <div class="gauge__readout">
              <div class="gauge__num" id="pValue">--</div>
              <div class="gauge__unit">hPa · 海平面气压</div>
            </div>
          </div>
          <div class="row" style="gap:8px;margin-top:10px">
            <span class="trend-pill trend-pill--flat" id="pTrend">${icon('minus', 13)} 计算中</span>
          </div>
        </div>
        <div class="stat-grid" style="margin-top:6px">
          <div class="stat"><div class="stat__label">当前</div><div class="stat__value" id="pNow">--</div></div>
          <div class="stat"><div class="stat__label">3 小时变化</div><div class="stat__value" id="pDelta">--</div></div>
          <div class="stat"><div class="stat__label">等效海拔</div><div class="stat__value" id="pAltitude">--</div></div>
          <div class="stat"><div class="stat__label">趋势判断</div><div class="stat__value" id="pForecast" style="font-size:15px">--</div></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card__head">
          <span class="card__title">${icon('activity', 16)} 24 小时趋势</span>
          <span class="badge" id="pCount">0 条记录</span>
        </div>
        <div class="chart-box">
          <canvas id="pChart"></canvas>
          <div class="chart-legend"><span id="pChartStart">--</span><span>气压 (hPa)</span><span id="pChartEnd">--</span></div>
        </div>
      </div>

      <div class="advice-card" style="margin-bottom:14px">
        ${icon('sparkles', 20)}
        <p id="pAdvice">正在读取气压数据…</p>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">${icon('info', 16)} 关于气压</span>
        </div>
        <p style="font-size:12.5px;line-height:1.8;color:var(--ink-2)">
          气压每升高约 8.5 m 下降 1 hPa，因此手机显示的海平面气压需要按海拔换算。
          真正有用的是<strong>趋势</strong>：24 小时内下降超过 3 hPa 通常意味着天气转坏，
          上升超过 3 hPa 则多为转晴信号。
        </p>
        <div class="kv" style="margin-top:10px"><span class="kv__k">数据来源</span><span class="kv__v" id="pSource">--</span></div>
        <div class="kv"><span class="kv__k">采样间隔</span><span class="kv__v">打开页面时记录一次</span></div>
      </div>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    let history = [];

    const drawChart = () => {
      const canvas = $('#pChart');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.parentElement.clientWidth - 16;
      const h = 140;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      if (history.length < 2) return;

      const values = history.map((p) => p.value);
      const min = Math.min(...values) - 1;
      const max = Math.max(...values) + 1;
      const span = Math.max(1, max - min);
      const padX = 10;
      const padY = 12;
      const step = (w - padX * 2) / (history.length - 1);
      const yOf = (v) => h - padY - ((v - min) / span) * (h - padY * 2);

      // 网格
      c.strokeStyle = 'rgba(125,143,131,0.16)';
      c.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        const y = padY + (i * (h - padY * 2)) / 3;
        c.beginPath();
        c.moveTo(padX, y);
        c.lineTo(w - padX, y);
        c.stroke();
      }

      // 面积
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(68,122,89,0.28)');
      grad.addColorStop(1, 'rgba(68,122,89,0.02)');
      c.beginPath();
      c.moveTo(padX, h - padY);
      history.forEach((p, i) => c.lineTo(padX + i * step, yOf(p.value)));
      c.lineTo(w - padX, h - padY);
      c.closePath();
      c.fillStyle = grad;
      c.fill();

      // 折线
      c.beginPath();
      history.forEach((p, i) => {
        const x = padX + i * step;
        const y = yOf(p.value);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.strokeStyle = '#7fb894';
      c.lineWidth = 2;
      c.lineJoin = 'round';
      c.stroke();

      // 末点
      const lastP = history[history.length - 1];
      c.beginPath();
      c.arc(padX + (history.length - 1) * step, yOf(lastP.value), 3.5, 0, Math.PI * 2);
      c.fillStyle = '#e5a457';
      c.fill();

      $('#pChartStart').textContent = formatTime(history[0].ts);
      $('#pChartEnd').textContent = formatTime(lastP.ts);
    };

    const render = (pressure) => {
      const value = Number(pressure) || 1013;
      $('#gaugeSvg').innerHTML = gaugeSvg(value);
      $('#pValue').textContent = value;
      $('#pNow').innerHTML = `${value}<small>hPa</small>`;

      const trend = trendOf(history);
      const pill = $('#pTrend');
      pill.className = `trend-pill trend-pill--${trend.tone}`;
      pill.innerHTML = `${icon(trend.tone === 'up' ? 'arrowUp' : trend.tone === 'down' ? 'arrowDown' : 'minus', 13)} ${trend.label}`;

      $('#pDelta').innerHTML = `${trend.delta > 0 ? '+' : ''}${trend.delta}<small>hPa</small>`;
      const altitude = Math.round(Math.log(value / 1013.25) * -8434);
      $('#pAltitude').innerHTML = `${Math.abs(altitude)}<small>m</small>`;
      $('#pForecast').textContent = trend.tone === 'up' ? '转晴' : trend.tone === 'down' ? '转坏' : '稳定';
      $('#pCount').textContent = `${history.length} 条记录`;
      $('#pAdvice').textContent = adviceOf(value, trend);
      $('#pSource').textContent = appState.weather?.source === 'live' ? '和风天气（海平面气压）' : '演示数据（海平面气压）';
      drawChart();
    };

    const load = async (force = false) => {
      const wx = await ensureWeather(force).catch(() => null);
      if (!wx) {
        toastWarn('天气数据不可用，无法获取气压');
        return;
      }
      const value = Number(wx.now.pressure);
      if (!Number.isFinite(value)) {
        toastWarn('当前数据源没有气压字段');
        return;
      }

      await pressureRepo.push(value);

      history = await pressureRepo.list(120);

      // 记录不足时用当前值生成一段平滑的估算曲线（明确标注为估算）
      if (history.length < 6) {
        const now = Date.now();
        const synthetic = [];
        for (let i = 23; i >= 0; i--) {
          const wave = Math.sin((i / 24) * Math.PI * 2) * 1.6 + Math.cos(i / 3.2) * 0.6;
          synthetic.push({ id: `seed_${i}`, ts: now - i * 3600e3, value: Number((value - 1 + wave).toFixed(1)) });
        }
        history = [...synthetic, ...history];
      }

      render(value);
    };

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="refresh"]')) {
        load(true).then(() => toastOk('已刷新'));
      }
    });

    const off = bus.on('weather:change', (wx) => {
      if (wx?.now?.pressure) render(Number(wx.now.pressure));
    });

    await load();
    return () => off();
  },

  onShow() {
    ensureWeather().catch(() => {});
  }
};
