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
          <div class="wx-hero__tags">
            <span class="wx-observed" id="wxObserved">--</span>
            <span class="badge badge--glass" id="wxSource">--</span>
          </div>
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
          <span class="badge" id="wxRainBadge">${icon('droplet', 12)} 降水概率</span>
        </div>
        <div class="card" style="padding:10px 12px">
          <div class="hourly-scroll" id="wxHourly">
            ${Array.from({ length: 6 }).map(() => '<div class="skeleton" style="width:62px;height:170px;flex:none"></div>').join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <div><h2 class="section__title">7 日预报</h2></div>
          <span class="badge" id="wxDailyHint">${icon('cloud', 12)} 日间现象</span>
        </div>
        <div class="card" id="wxDaily" style="padding:6px 16px">
          <div class="loading-inline"><span class="spinner"></span>加载中…</div>
        </div>
      </section>

      <section class="section" id="wxAirSection">
        <div class="section__head">
          <div><h2 class="section__title">空气质量</h2></div>
          <span class="badge" id="wxAirScale">中国标准</span>
        </div>
        <div class="card" id="wxAir">
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
          <div class="kv"><span class="kv__k">实况时次</span><span class="kv__v" id="wxObserved2">--</span></div>
          <div class="kv"><span class="kv__k">气压口径</span><span class="kv__v" id="wxPressureNote">--</span></div>
          <div class="kv"><span class="kv__k">日出 / 日落</span><span class="kv__v" id="wxSun">--</span></div>
          <div class="kv"><span class="kv__k">月相</span><span class="kv__v" id="wxMoon">--</span></div>
          <p class="field__hint" style="margin-top:10px">
            实况取自 Open-Meteo 的 15 分钟插值场（ECMWF / GFS），不是整点预报值。
            <strong>气压为海平面气压</strong>，比手机气压计显示的本站气压高，两者差值对应海拔高度差，不是数据错了。
            AQI 按 HJ 633-2012 由 PM2.5、PM10、O₃、NO₂、SO₂、CO 六项浓度算得，与国内天气 App 同口径。
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
      $('#wxSource').textContent = wx.providerName || '实时数据';
      $('#wxTemp').textContent = now.temp;
      $('#wxCond').textContent = `${now.text}`;

      /* 实况时次：必须写出来。这个数字是 09:30 的还是 12:00 的，
         决定了用户会不会拿它和窗外对一遍。 */
      const obsAt = now.observedAt instanceof Date ? now.observedAt : new Date(wx.updatedAt);
      $('#wxObserved').textContent = `实况 ${formatTime(obsAt)}`;

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

      /* 四指标：主值下面补一行真实的附加信息，不留空格子 */
      const delta = Number(now.pressureDelta);
      const trend =
        !Number.isFinite(delta)
          ? { icon: '', text: '海平面' }
          : delta > 0.8
            ? { icon: icon('arrowUp', 10), text: '3h 上升' }
            : delta < -0.8
              ? { icon: icon('arrowDown', 10), text: '3h 下降' }
              : { icon: icon('minus', 10), text: '3h 平稳' };

      const visNum = Number(now.vis);
      const visPhrase = visNum >= 20 ? '通透' : visNum >= 10 ? '良好' : visNum >= 5 ? '一般' : '较差';

      $('#wxMetrics').innerHTML = [
        { k: '湿度', v: `${now.humidity}<i>%</i>`, sub: `露点 ${now.dew}°` },
        { k: '风', v: `${now.windDir}<b>${now.windScale}</b><i>级</i>`, sub: `阵风 ${now.gust} m/s` },
        { k: '气压', v: `${now.pressure}<i>hPa</i>`, sub: `${trend.icon}${trend.text}`, raw: true },
        { k: '能见度', v: `${now.vis}<i>km</i>`, sub: `${visPhrase} · 云量 ${now.cloud}%` }
      ]
        .map(
          (m) => `<div class="wx-metric">
            <div class="wx-metric__k">${m.k}</div>
            <div class="wx-metric__v">${m.v}</div>
            <div class="wx-metric__sub">${m.sub}</div>
          </div>`
        )
        .join('');

      $('#wxUpdated').textContent = `${formatTime(wx.updatedAt)} 更新 · ${wx.providerName || '实时预报'}`;

      /* 逐小时：时间 / 天气 / 温度曲线 / 降水概率 / 风力
         曲线是这一屏"像不像天气预报"的分水岭。只有数字没有走势，
         读起来像表格，不像天气。 */
      const hourlyHost = $('#wxHourly');
      if (hourly?.length) {
        const n = hourly.length;
        const COL_W = 62;
        const GAP = 6;
        const H = 56;
        const trackW = n * COL_W + (n - 1) * GAP;

        const temps = hourly.map((h) => Number(h.temp)).filter(Number.isFinite);
        const hi = temps.length ? Math.max(...temps) : 30;
        const lo = temps.length ? Math.min(...temps) : 20;
        const span = Math.max(1, hi - lo);

        // 每个格子的中心 x，换成 viewBox 的百分比坐标
        const X = (i) => ((i * (COL_W + GAP) + COL_W / 2) / trackW) * 100;
        // 高温贴顶、低温贴底，上下各留 9px 给温度数字
        const Y = (t) => H - 9 - ((Number(t) - lo) / span) * (H - 18);

        const pts = hourly.map((h, i) => [X(i), Y(h.temp)]);
        let line = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
        for (let i = 0; i < n - 1; i++) {
          const cx = ((pts[i][0] + pts[i + 1][0]) / 2).toFixed(2);
          line += ` C ${cx} ${pts[i][1].toFixed(2)}, ${cx} ${pts[i + 1][1].toFixed(2)}, ${pts[i + 1][0].toFixed(2)} ${pts[i + 1][1].toFixed(2)}`;
        }

        hourlyHost.innerHTML = `
          <div class="hourly-track" style="width:${trackW}px">
            <div class="hourly-curve">
              <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
                <path class="hourly-curve__line" d="${line}" vector-effect="non-scaling-stroke" />
              </svg>
              ${hourly
                .map(
                  (h, i) =>
                    `<span class="hourly-dot" style="left:${pts[i][0].toFixed(2)}%;top:${((pts[i][1] / H) * 100).toFixed(
                      2
                    )}%"></span>`
                )
                .join('')}
              ${hourly
                .map(
                  (h, i) =>
                    `<span class="hourly-pt ${pts[i][1] > H / 2 ? 'is-low' : ''}" style="left:${pts[i][0].toFixed(
                      2
                    )}%;top:${((pts[i][1] / H) * 100).toFixed(2)}%">${h.temp}°</span>`
                )
                .join('')}
            </div>
            <div class="hourly-cols">
              ${hourly
                .map((h, i) => {
                  const isNow = i === 0;
                  return `<div class="hour ${isNow ? 'is-now' : ''}">
                    <span class="hour__t">${isNow ? '现在' : formatTime(h.time)}</span>
                    <span class="hour__icon">${weatherIcon(h.code, 24)}</span>
                    <span class="hour__gap"></span>
                    <span class="hour__pop">${h.pop > 10 ? `${h.pop}%` : '<i>—</i>'}</span>
                    <span class="hour__wind">${icon('wind', 10)}${h.windScale}级</span>
                  </div>`;
                })
                .join('')}
            </div>
          </div>`;
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

      /* 空气质量：独立卡片，按国标 AQI 展示六项污染物。
         原先这里是一个挤在「7 日预报」标题右边的 EAQI 徽标——
         位置不对，口径也不对，用户拿它和手机的「38 优」一对比就是两回事。 */
      const airHost = $('#wxAir');
      if (air && air.pollutants?.length) {
        $('#wxAirScale').textContent = air.standard === 'CN MEE' ? '模式估算 · HJ 633' : '欧洲 EAQI';
        const primaryKey = air.pollutants.reduce((a, b) => (b.iaqi > a.iaqi ? b : a), air.pollutants[0]).key;
        airHost.innerHTML = `
          <div class="air-head">
            <div class="air-score is-${air.tone}">
              <span class="air-score__num">${air.aqi}</span>
              <span class="air-score__cat">${escapeHtml(air.category)}</span>
            </div>
            <div class="air-head__meta">
              <span class="air-head__label">AQI · HJ 633-2012</span>
              <span class="air-head__primary">${
                air.primary ? `首要污染物 ${escapeHtml(air.primary)}` : '各项均优于一级限值'
              }</span>
            </div>
          </div>
          <div class="air-grid">
            ${air.pollutants
              .map(
                (p) => `<div class="air-item ${p.key === primaryKey && air.aqi > 50 ? 'is-primary' : ''}">
                  <span class="air-item__k">${p.name}</span>
                  <span class="air-item__v">${p.value}<i>${p.unit.replace('μg/m³', '')}</i></span>
                  <span class="air-item__bar"><i style="width:${Math.min(100, Math.round(p.iaqi / 2))}%"></i></span>
                </div>`
              )
              .join('')}
          </div>
          <p class="air-note">
            浓度来自 CAMS 全球空气质量模式，国内监测站实测通常更低；AQI 按 HJ&nbsp;633-2012 由六项浓度取分指数最大值算得。
          </p>`;
      } else {
        $('#wxAirScale').textContent = '暂不可用';
        airHost.innerHTML =
          '<div class="empty__desc" style="padding:10px 0">空气质量数据未取到。这一项来自独立接口，失败不影响上方预报。</div>';
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
      $('#wxProvider').textContent = wx.providerName === '和风天气' ? '和风天气 QWeather' : 'Open-Meteo（ECMWF / GFS）';
      $('#wxObserved2').textContent = `${formatTime(obsAt)}（15 分钟插值）`;
      // 和风给的本来就是本站气压，只有 Open-Meteo 才需要区分两种口径
      $('#wxPressureNote').textContent = now.pressureStation
        ? `海平面 ${now.pressure} · 本站 ${now.pressureStation} hPa（格点海拔 ${Math.round(wx.elevation || 0)} m）`
        : `${now.pressure} hPa（本站）`;
      $('#wxSun').textContent = sun?.sunrise
        ? `${formatTime(sun.sunrise)} / ${formatTime(sun.sunset)}`
        : '--';
      $('#wxMoon').textContent = moon ? `${moon.phaseName} · 照亮 ${Math.round(moon.illumination * 100)}%` : '--';
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
