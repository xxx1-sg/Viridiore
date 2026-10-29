/** 天气页 */
import { icon, weatherIcon } from '../core/icons.js';
import { appState, ensureWeather, setLocation } from '../state.js';
import { bus } from '../core/store.js';
import { config } from '../config.js';
import { CITIES } from '../data/mountains.js';
import { formatTime, WEEK } from '../core/format.js';
import { searchCity } from '../services/weather.js';
import { getPosition, nearestCity } from '../services/geo.js';
import { openSheet, formDialog } from '../core/modal.js';
import { toastOk, toastError, toastWarn } from '../core/toast.js';
import { escapeHtml } from '../core/dom.js';

function aqiTone(aqi) {
  if (aqi <= 50) return 'badge--moss';
  if (aqi <= 100) return 'badge--dawn';
  if (aqi <= 150) return 'badge--warn';
  return 'badge--danger';
}

/** 和风的 severity 取值：Minor / Moderate / Severe / Extreme */
function severityRank(severity = '') {
  return { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 }[severity] || 1;
}

function severityTone(severity = '') {
  return { Minor: 'minor', Moderate: 'moderate', Severe: 'severe', Extreme: 'extreme' }[severity] || 'minor';
}

export default {
  id: 'weather',
  title: '天气',
  icon: 'cloudSun',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">天气</h1>
          <p class="page-head__desc" id="wxUpdated">正在获取天气数据…</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="locate" title="使用我的位置">${icon('crosshair', 19)}</button>
          <button class="icon-btn" type="button" data-action="refresh" title="刷新">${icon('refresh', 19)}</button>
        </div>
      </div>

      <div id="wxWarnings"></div>

      <div class="wx-hero" id="wxHero">
        <div class="wx-hero__top">
          <button class="wx-city" type="button" data-action="city">
            ${icon('map', 15)}<span id="wxCityName">${appState.location.name}</span>${icon('chevronDown', 13)}
          </button>
          <span class="badge badge--glass" id="wxSource">--</span>
        </div>
        <div class="wx-hero__main">
          <div>
            <div class="wx-now">
              <span class="wx-now__temp" id="wxTemp">--</span><span class="wx-now__deg">°</span>
            </div>
            <div class="wx-now__cond" id="wxCond">加载中</div>
            <div class="wx-now__feel" id="wxFeel">&nbsp;</div>
          </div>
          <div class="wx-now__icon" id="wxIcon">${icon('cloudSun', 84)}</div>
        </div>
        <div class="wx-metrics" id="wxMetrics">
          ${['湿度', '风', '气压', '能见度'].map((k) => `
            <div class="wx-metric">
              <div class="wx-metric__k">${k}</div>
              <div class="wx-metric__v" data-metric="${k}">--</div>
            </div>`).join('')}
        </div>
      </div>

      <section class="section" style="margin-top:18px">
        <div class="section__head">
          <div><h2 class="section__title">未来 24 小时</h2></div>
          <span class="badge" id="wxRainBadge">${icon('droplet', 12)} 降水</span>
        </div>
        <div class="card" style="padding:10px 12px">
          <div class="hourly-scroll" id="wxHourly">
            ${Array.from({ length: 6 }).map(() => '<div class="skeleton" style="width:62px;height:96px;flex:none"></div>').join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <div><h2 class="section__title">7 日预报</h2></div>
          <span class="badge" id="wxAirBadge">AQI --</span>
        </div>
        <div class="card" id="wxDaily" style="padding:6px 16px">
          <div class="loading-inline"><span class="spinner"></span>加载中…</div>
        </div>
      </section>

      <section class="section">
        <div class="section__head"><div><h2 class="section__title">生活与户外</h2></div></div>
        <div class="index-grid" id="wxIndices"></div>
      </section>

      <section class="section">
        <div class="card">
          <div class="card__head">
            <span class="card__title">${icon('info', 16)} 数据说明</span>
          </div>
          <div class="kv"><span class="kv__k">数据来源</span><span class="kv__v" id="wxProvider">--</span></div>
          <div class="kv"><span class="kv__k">更新于</span><span class="kv__v" id="wxTime">--</span></div>
          <div class="kv"><span class="kv__k">日出 / 日落</span><span class="kv__v" id="wxSun">--</span></div>
          <div class="kv"><span class="kv__k">月相</span><span class="kv__v" id="wxMoon">--</span></div>
          <p class="field__hint" style="margin-top:10px">
            未配置和风天气 Key 时使用本地演示数据；配置后自动切换真实预报。
          </p>
        </div>
      </section>
    `;
  },

  async mount(el) {
    const $ = (sel) => el.querySelector(sel);

    const render = (wx) => {
      if (!wx) return;
      const { now, hourly, daily, air, indices, sun, moon } = wx;

      $('#wxCityName').textContent = wx.place.name;
      $('#wxSource').textContent = wx.source === 'live' ? '和风天气' : '演示数据';
      $('#wxTemp').textContent = now.temp;
      $('#wxCond').textContent = `${now.text}`;

      /* 气象预警：原本是独立页面，但预警只有"看见"才有价值，并入天气页顶部 */
      const warnings = wx.warnings || [];
      const wxBox = $('#wxWarnings');
      if (!warnings.length) {
        wxBox.innerHTML = '';
      } else {
        const ranked = [...warnings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
        wxBox.innerHTML = ranked
          .slice(0, 3)
          .map(
            (w) => `<div class="warn-banner is-${severityTone(w.severity)}">
              <span class="warn-banner__icon">${icon('alert', 17)}</span>
              <span class="warn-banner__main">
                <span class="warn-banner__title">${escapeHtml(w.title || w.typeName || '气象预警')}</span>
                <span class="warn-banner__time">${escapeHtml(w.typeName || '')}${
                  w.pubTime ? ` · ${formatTime(new Date(w.pubTime))} 发布` : ''
                }</span>
              </span>
            </div>`
          )
          .join('');
      }
      $('#wxFeel').textContent = `体感 ${now.feels}° · 今日 ${daily[0]?.min ?? '--'}~${daily[0]?.max ?? '--'}°`;
      $('#wxIcon').innerHTML = weatherIcon(now.code, 84);

      $('#wxMetrics').innerHTML = [
        ['湿度', `${now.humidity}%`],
        ['风', `${now.windDir} ${now.windScale}级`],
        ['气压', `${now.pressure} hPa`],
        ['能见度', `${now.vis} km`]
      ]
        .map(
          ([k, v]) => `<div class="wx-metric"><div class="wx-metric__k">${k}</div><div class="wx-metric__v">${v}</div></div>`
        )
        .join('');

      $('#wxUpdated').textContent = `${formatTime(wx.updatedAt)} 更新 · ${wx.source === 'live' ? '真实预报' : '演示数据'}`;

      /* 逐小时 */
      const hourlyHost = $('#wxHourly');
      if (hourly?.length) {
        hourlyHost.innerHTML = hourly
          .map((h, i) => {
            const isNow = i === 0;
            return `<div class="hour ${isNow ? 'is-now' : ''}">
              <span class="hour__t">${isNow ? '现在' : formatTime(h.time)}</span>
              <span class="hour__icon">${weatherIcon(h.code, 24)}</span>
              <span class="hour__temp">${h.temp}°</span>
              <span class="hour__pop">${h.pop > 20 ? `${h.pop}%` : ''}</span>
            </div>`;
          })
          .join('');
      } else {
        hourlyHost.innerHTML = '<div class="empty__desc">暂无逐小时数据</div>';
      }

      /* 7 日 */
      const dailyHost = $('#wxDaily');
      if (daily?.length) {
        const mins = daily.map((d) => d.min);
        const maxs = daily.map((d) => d.max);
        const lo = Math.min(...mins);
        const hi = Math.max(...maxs);
        const span = Math.max(1, hi - lo);

        dailyHost.innerHTML = daily
          .map((d, i) => {
            const label = i === 0 ? '今天' : i === 1 ? '明天' : WEEK[d.dateObj.getDay()];
            const left = ((d.min - lo) / span) * 100;
            const width = Math.max(8, ((d.max - d.min) / span) * 100);
            return `<div class="day-row">
              <span class="day-row__name">${label}</span>
              <span class="day-row__icon">${weatherIcon(d.codeDay, 22)}</span>
              <span class="day-row__bar"><span style="left:${left}%;width:${width}%"></span></span>
              <span class="day-row__temp"><b>${d.max}°</b> / ${d.min}°</span>
            </div>`;
          })
          .join('');
      }

      /* AQI */
      if (air) {
        $('#wxAirBadge').className = `badge ${aqiTone(air.aqi)}`;
        $('#wxAirBadge').textContent = `AQI ${air.aqi} ${air.category}`;
      }

      /* 生活指数 */
      const idxHost = $('#wxIndices');
      if (indices?.length) {
        const icons = { 1: 'activity', 2: 'thermometer', 3: 'sun', 5: 'droplet', 6: 'tent', 9: 'heart' };
        idxHost.innerHTML = indices
          .slice(0, 6)
          .map(
            (i) => `<div class="index-item">
              <span class="index-item__k">${icon(icons[i.type] || 'info', 13)}${i.name}</span>
              <span class="index-item__v">${escapeHtml(i.category)}</span>
              <span class="index-item__d">${escapeHtml(i.text)}</span>
            </div>`
          )
          .join('');
      } else {
        idxHost.innerHTML = '';
      }

      /* 说明 */
      $('#wxProvider').textContent = wx.source === 'live' ? '和风天气 QWeather' : '本地演示算法';
      $('#wxTime').textContent = formatTime(wx.updatedAt);
      $('#wxSun').textContent = sun?.sunrise
        ? `${formatTime(sun.sunrise)} / ${formatTime(sun.sunset)}`
        : '--';
      $('#wxMoon').textContent = moon ? `${moon.phaseName} · 照亮 ${Math.round(moon.illumination * 100)}%` : '--';
      $('#wxRainBadge').innerHTML = `${icon('droplet', 12)} 降水概率`;
    };

    const load = async (force = false) => {
      try {
        const wx = await ensureWeather(force);
        render(wx);
      } catch (err) {
        toastError(err.message || '天气加载失败');
      }
    };

    /* 城市选择 */
    const openCitySheet = () => {
      const groups = [...new Set(CITIES.map((c) => c.group))];
      const body = `
        <div class="input-group" style="margin-bottom:14px">
          <input class="input" id="citySearch" placeholder="搜索城市，如 深圳 / 惠州" />
          <button class="btn btn--primary btn--sm" type="button" id="citySearchBtn">搜索</button>
        </div>
        <div id="cityList">
          ${groups
            .map(
              (g) => `<div style="margin-bottom:12px">
                <div class="settings-group__title">${g}</div>
                ${CITIES.filter((c) => c.group === g)
                  .map(
                    (c) => `<button class="list-row" type="button" data-city='${JSON.stringify({ name: c.name, lat: c.lat, lon: c.lon })}'>
                      <span class="list-row__main"><span class="list-row__title">${c.name}</span></span>
                      <span class="list-row__tail">${c.name === appState.location.name ? '当前' : ''}</span>
                    </button>`
                  )
                  .join('')}
              </div>`
            )
            .join('')}
        </div>`;

      const { el: sheet, close } = openSheet({ title: '切换城市', body });

      const pick = async (city) => {
        setLocation(city);
        close();
        toastOk(`已切换到 ${city.name}`);
        await load(true);
      };

      sheet.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-city]');
        if (btn) pick(JSON.parse(btn.dataset.city));
      });

      const doSearch = async () => {
        const kw = sheet.querySelector('#citySearch').value.trim();
        if (!kw) return;
        const listHost = sheet.querySelector('#cityList');
        listHost.innerHTML = '<div class="loading-inline"><span class="spinner"></span>搜索中…</div>';
        const results = await searchCity(kw);
        const merged = results.length
          ? results
          : CITIES.filter((c) => c.name.includes(kw)).map((c) => ({ ...c, admin: c.group }));
        if (!merged.length) {
          listHost.innerHTML = `<div class="empty"><div class="empty__title">没有找到「${escapeHtml(kw)}」</div><div class="empty__desc">试试更短的关键词，或在设置中检查天气 API Host</div></div>`;
          return;
        }
        listHost.innerHTML = merged
          .map(
            (c) => `<button class="list-row" type="button" data-city='${JSON.stringify({ name: c.name, lat: Number(c.lat), lon: Number(c.lon) })}'>
              <span class="list-row__main">
                <span class="list-row__title">${escapeHtml(c.name)}</span>
                <span class="list-row__sub">${escapeHtml(c.admin || '')}</span>
              </span>
              <span class="list-row__tail">${icon('chevronRight', 15)}</span>
            </button>`
          )
          .join('');
      };

      sheet.querySelector('#citySearchBtn').addEventListener('click', doSearch);
      sheet.querySelector('#citySearch').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
      });
    };

    /* 使用我的位置 */
    const locate = async () => {
      const stop = toastWarn('正在定位…', { duration: 1500 });
      try {
        const pos = await getPosition();
        const city = nearestCity(pos.lat, pos.lon);
        setLocation({ name: city.name, lat: pos.lat, lon: pos.lon });
        toastOk(`已定位到 ${city.name} 附近`);
        await load(true);
      } catch (err) {
        toastError(err.message);
      } finally {
        stop?.();
      }
    };

    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'refresh') {
        btn.style.transform = 'rotate(360deg)';
        btn.style.transition = 'transform .6s';
        setTimeout(() => (btn.style.transform = ''), 620);
        await load(true);
      }
      if (btn.dataset.action === 'city') openCitySheet();
      if (btn.dataset.action === 'locate') locate();
    });

    const off = bus.on('weather:change', render);
    await load();
    return () => off();
  },

  onShow() {
    ensureWeather().catch(() => {});
  }
};
