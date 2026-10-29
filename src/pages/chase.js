/** 追光页：七天窗口的概率、证据与可保存的预测卡 */
import { icon, weatherIcon } from '../core/icons.js';
import { appState, currentMountain, setMountain } from '../state.js';
import { loadWeather } from '../services/weather.js';
import { rankDays, advice, compensation, MODES, summitTemp, relativeDay } from '../services/chase.js';
import { calibrationFor, recordFeedback } from '../services/calibration.js';
import { sunTimes, sunriseAzimuth, facingSlopeLabel } from '../services/sun.js';
import { buildNarrative } from '../services/narrative.js';
import { renderCard, downloadCard, shareCard } from '../services/sharecard.js';
import { MOUNTAINS } from '../data/mountains.js';
import { formatTime, formatDate } from '../core/format.js';
import { openSheet, openModal } from '../core/modal.js';
import { toastError, toastOk, toastWarn } from '../core/toast.js';
import { escapeHtml } from '../core/dom.js';

const RING_R = 34;
const CIRC = 2 * Math.PI * RING_R;

function ringSvg(prob) {
  const offset = CIRC * (1 - prob / 100);
  const color = prob >= 72 ? '#f0bb7f' : prob >= 55 ? '#e5a457' : prob >= 38 ? '#9dbd9f' : '#7d8f83';
  return `<svg width="84" height="84" viewBox="0 0 84 84">
    <circle cx="42" cy="42" r="${RING_R}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="5"/>
    <circle cx="42" cy="42" r="${RING_R}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${CIRC}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)"/>
  </svg>`;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export default {
  id: 'chase',
  title: '追光',
  icon: 'sunrise',

  template() {
    const m = currentMountain();
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">追光</h1>
          <p class="page-head__desc">七天窗口，每一天都给一个可被证伪的概率</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="mountain" title="换山头">${icon('mountain', 19)}</button>
          <button class="icon-btn" type="button" data-action="refresh" title="刷新">${icon('refresh', 19)}</button>
        </div>
      </div>

      <div class="segmented" style="margin-bottom:16px" id="chaseModes">
        ${['cloudsea', 'sunrise', 'stars']
          .map(
            (k, i) =>
              `<button type="button" data-mode="${k}" class="${i === 0 ? 'is-active' : ''}">${MODES[k].name}</button>`
          )
          .join('')}
      </div>

      <div class="chase-hero" id="chaseHero">
        <div class="chase-hero__glow"></div>
        <div class="chase-hero__top">
          <div>
            <div class="chase-mountain__name" id="chaseName">${m.name}</div>
            <div class="chase-mountain__meta" id="chaseMeta">海拔 ${m.elevation}m · ${m.area}</div>
          </div>
          <div class="chase-score">
            <div class="chase-score__ring" id="chaseRing">${ringSvg(0)}<div class="chase-score__prob" id="chaseProb">--</div></div>
            <div class="chase-score__label" id="chaseGrade">概率</div>
          </div>
        </div>
        <div class="chase-best">
          ${icon('sunrise', 20)}
          <div>
            <div class="chase-best__k" id="chaseBestK">最佳窗口</div>
            <div class="chase-best__v" id="chaseBest">正在计算…</div>
          </div>
        </div>
      </div>

      <p class="chase-sentence" id="chaseSentence">正在根据温湿与逆温条件估算…</p>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">七天窗口</h2>
            <p class="section__desc" id="chaseWindowDesc">按概率排序</p>
          </div>
        </div>
        <div class="chase-days" id="chaseDays">
          <div class="skeleton" style="height:56px"></div>
          <div class="skeleton" style="height:56px"></div>
          <div class="skeleton" style="height:56px"></div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">判断依据</h2>
            <p class="section__desc" id="chaseEvidenceDesc">每一项都可以被反驳</p>
          </div>
        </div>
        <div class="card card--flush" id="chaseFactors"></div>
      </section>

      <section class="section">
        <div class="card">
          <div class="card__head">
            <span class="card__title">${icon('clock', 16)} 天文时刻</span>
            <span class="badge" id="chaseMoon">--</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><div class="stat__label">日出</div><div class="stat__value" id="chaseSunrise">--:--</div></div>
            <div class="stat"><div class="stat__label">日落</div><div class="stat__value" id="chaseSunset">--:--</div></div>
            <div class="stat"><div class="stat__label">日出方位</div><div class="stat__value" id="chaseAzimuth">--</div></div>
            <div class="stat"><div class="stat__label">建议坡向</div><div class="stat__value" id="chaseSlope">--</div></div>
          </div>
          <div class="kv" style="margin-top:12px">
            <span class="kv__k">参考路线</span>
            <span class="kv__v" id="chaseRoute">--</span>
          </div>
          <div class="kv">
            <span class="kv__k">最佳季节</span>
            <span class="kv__v" id="chaseSeason">--</span>
          </div>
        </div>
        <p class="footnote" id="chaseFoot"></p>
      </section>

      <section class="section">
        <div class="feedback-card">
          <div class="feedback-card__text">
            <strong>今天这趟看到了吗</strong>
            <span>一次点击，让下一次的百分比更准。数据只留在本机。</span>
          </div>
          <div class="feedback-card__actions">
            <button class="btn btn--sm btn--ghost" type="button" data-feedback="1">${icon('check', 14)} 看到了</button>
            <button class="btn btn--sm btn--ghost" type="button" data-feedback="0">${icon('x', 14)} 白跑一趟</button>
          </div>
        </div>
      </section>

      <section class="section">
        <button class="btn btn--dawn btn--block btn--lg" type="button" data-action="share">
          ${icon('share', 17)} 生成预测卡
        </button>
      </section>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    let mode = 'cloudsea';
    let wx = null;
    let ranked = null;
    let calib = { offset: 0, n: 0 };
    let loading = false;

    const requested = new URLSearchParams(location.hash.split('?')[1] || '').get('mode');
    if (requested && MODES[requested]) {
      mode = requested;
      el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
    }

    /* ---------------- 渲染 ---------------- */
    const render = () => {
      if (!wx || !ranked) return;
      const mountain = currentMountain();
      $('#chaseName').textContent = mountain.name;
      $('#chaseMeta').textContent = `海拔 ${mountain.elevation}m · ${mountain.area}`;

      const best = ranked.ranked[0];
      if (!best) return;

      $('#chaseRing').innerHTML = ringSvg(best.probability);
      const probNode = document.createElement('div');
      probNode.className = 'chase-score__prob';
      probNode.id = 'chaseProb';
      probNode.innerHTML = `${best.probability}<small>%</small>`;
      $('#chaseRing').appendChild(probNode);
      $('#chaseGrade').textContent = `${MODES[mode].name} · ${best.grade.label}`;

      const dateObj = best.day.dateObj instanceof Date ? best.day.dateObj : new Date(best.day.date);
      const sun = sunTimes(dateObj, mountain.lat, mountain.lon);
      const az = sunriseAzimuth(dateObj, mountain.lat);

      $('#chaseBestK').textContent =
        mode === 'stars' ? '最佳夜空' : `${relativeDay(best.index, best.day)} · ${formatTime(sun.sunrise)} 前后`;
      $('#chaseBest').textContent = `${best.probability}% · ${best.verdict}`;
      $('#chaseSentence').textContent = advice(best, mode, mountain);

      /* 七天 */
      const order = [...ranked.all];
      $('#chaseDays').innerHTML = order
        .map((d) => {
          const isBest = d.index === best.index;
          const label = relativeDay(d.index, d.day);
          return `<div class="chase-day ${isBest ? 'is-best' : ''}">
            <span class="chase-day__date">${label}<small>${String(d.day.date).slice(5)}</small></span>
            <span class="chase-day__icon">${weatherIcon(d.day.codeDay, 22)}</span>
            <span class="chase-day__bar"><span style="width:${d.probability}%"></span></span>
            <span class="chase-day__score ${d.probability >= 55 ? 'is-high' : ''}">${d.probability}%</span>
          </div>`;
        })
        .join('');

      $('#chaseWindowDesc').textContent = `${MODES[mode].name} · 基准率 ${best.baseRate}% · ${
        wx.source === 'demo' ? '演示数据' : '实时预报'
      }`;

      /* 证据链 */
      const rows = ranked.all[0].index === 0 ? ranked.all[0].factors : best.factors;
      const target = ranked.all.find((d) => d.index === 0) || best;
      $('#chaseEvidenceDesc').textContent = `以${
        target.index === 0 ? '今天' : '最佳日'
      }为例，共 ${target.factors.length} 项因子`;
      $('#chaseFactors').innerHTML = `<div class="factor-list">
        ${target.factors
          .map(
            (f) => `<div class="factor ${f.tone}">
              <span class="factor__sign">${f.tone === 'pro' ? '+' : '−'}</span>
              <span class="factor__main">
                <span class="factor__head"><b>${escapeHtml(f.label)}</b><em>${escapeHtml(String(f.value))}</em></span>
                <span class="factor__detail">${escapeHtml(f.detail)}</span>
              </span>
              <span class="factor__delta">${f.delta > 0 ? '+' : ''}${f.delta.toFixed(1)}</span>
            </div>`
          )
          .join('')}
      </div>`;

      const temp = summitTemp(target.day, mountain.elevation);
      $('#chaseMoon').textContent = wx.moon ? wx.moon.phaseName : '--';
      $('#chaseSunrise').textContent = sun.sunrise ? formatTime(sun.sunrise) : '--:--';
      $('#chaseSunset').textContent = sun.sunset ? formatTime(sun.sunset) : '--:--';
      $('#chaseAzimuth').textContent = `${Math.round(az)}°`;
      $('#chaseSlope').textContent = facingSlopeLabel(az);
      $('#chaseRoute').textContent = `${mountain.route.distance} km / 爬升 ${mountain.route.ascent} m / 约 ${mountain.route.hours} h`;
      $('#chaseSeason').textContent = mountain.season;

      const conf = target.confidence;
      $('#chaseFoot').innerHTML = `模型：月度基准率 + 云层高度（LCL）等 ${
        target.factors.length
      } 项物理证据。置信度 <b>${conf.label}</b>（${conf.hint}）${
        calib.n ? `；已用你 ${calib.n} 次反馈校准（偏移 ${calib.offset.toFixed(2)}）` : ''
      }${temp != null ? `。山顶约 ${temp} ℃` : ''}。`;

      /* 补偿：概率低的时候给下一个窗口 */
      const comp = compensation({ all: ranked.all, mode, todayProb: ranked.all[0]?.probability });
      if (ranked.all[0] && ranked.all[0].probability < 50 && comp) {
        $('#chaseSentence').textContent += ` ${comp.text}`;
      }
    };

    /* ---------------- 数据 ---------------- */
    const load = async (force = false) => {
      if (loading) return;
      loading = true;
      const mountain = currentMountain();
      $('#chaseWindowDesc').textContent = '正在获取山区天气…';
      try {
        calib = await calibrationFor(mountain.id, mode);
        wx = await loadWeather({ lat: mountain.lat, lon: mountain.lon, name: mountain.name, force });
        ranked = rankDays(wx.daily, mode, { mountain, source: wx.source, calibration: calib });
        render();
      } catch (err) {
        toastError(err.message || '数据加载失败');
      } finally {
        loading = false;
      }
    };

    /* ---------------- 预测卡 ---------------- */
    const makeCard = () => {
      const mountain = currentMountain();
      const best = ranked.ranked[0];
      const dateObj = best.day.dateObj instanceof Date ? best.day.dateObj : new Date(best.day.date);
      const sun = sunTimes(dateObj, mountain.lat, mountain.lon);
      const az = sunriseAzimuth(dateObj, mountain.lat);
      const temp = summitTemp(best.day, mountain.elevation);

      const narrative = {
        headline: `${dateObj.getMonth() + 1} 月 ${dateObj.getDate()} 日 ${formatTime(sun.sunrise)}，${mountain.name}${
          facingSlopeLabel(az)
        }，看到${MODES[mode].name}概率 ${best.probability}%。`,
        detail: `山顶约 ${temp} ℃`,
        tags: [MODES[mode].name, `${best.probability}%`, best.grade.label],
        meta: {
          date: formatDate(dateObj),
          time: formatTime(sun.sunrise),
          place: mountain.name,
          elevation: mountain.elevation,
          coord: `${mountain.lat.toFixed(4)}, ${mountain.lon.toFixed(4)}`,
          temp,
          weather: facingSlopeLabel(az)
        }
      };

      const canvas = renderCard({
        narrative,
        mode,
        probability: best.probability,
        sourceLabel: wx.source === 'demo' ? '演示数据预测' : '实时预报'
      });

      openModal({
        title: '预测卡',
        desc: '明天带着这张图上山，回来对照',
        wide: true,
        body: `<div class="card-preview"><canvas id="cardCanvas"></canvas></div>`,
        actions: [
          {
            label: '分享',
            variant: 'primary',
            close: false,
            onClick: async () => {
              const ok = await shareCard(canvas, { title: '晓山青 · 预测卡', text: narrative.headline });
              if (!ok) {
                await downloadCard(canvas, `晓山青-预测-${best.day.date}.png`);
                toastOk('已保存图片');
              }
            }
          },
          {
            label: '保存图片',
            close: false,
            onClick: async () => {
              await downloadCard(canvas, `晓山青-预测-${best.day.date}.png`);
              toastOk('已保存图片');
            }
          }
        ],
        onMount: (modalEl) => {
          const host = modalEl.querySelector('#cardCanvas');
          if (!host) return;
          host.width = canvas.width;
          host.height = canvas.height;
          host.getContext('2d').drawImage(canvas, 0, 0);
        }
      });
    };

    /* ---------------- 反馈 ---------------- */
    const submitFeedback = async (observed) => {
      const target = ranked.all.find((d) => d.index === 0);
      if (!target) return;
      await recordFeedback({
        mountainId: currentMountain().id,
        mode,
        date: todayKey(),
        predicted: target.probability,
        observed,
        source: wx.source
      });
      calib = await calibrationFor(currentMountain().id, mode);
      ranked = rankDays(wx.daily, mode, {
        mountain: currentMountain(),
        source: wx.source,
        calibration: calib
      });
      render();
      toastOk(observed ? '记下了，恭喜看到' : '记下了，模型会往下修正');
    };

    /* ---------------- 山峰切换 ---------------- */
    const openMountainSheet = () => {
      const body = `<div class="list">
        ${MOUNTAINS.map(
          (m) => `<button class="list-row" type="button" data-mountain="${m.id}">
            <span class="list-row__icon">${icon('mountain', 18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">${m.name} <span class="muted" style="font-weight:400">${m.elevation}m</span></span>
              <span class="list-row__sub">${m.area} · ${m.tags.join(' / ')}</span>
            </span>
            <span class="list-row__tail">${m.id === appState.mountainId ? '当前' : ''}</span>
          </button>`
        ).join('')}
      </div>`;
      const { el: sheet, close } = openSheet({ title: '选择山峰', body });
      sheet.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mountain]');
        if (!btn) return;
        setMountain(btn.dataset.mountain);
        close();
        load(true);
      });
    };

    /* ---------------- 事件 ---------------- */
    el.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) {
        mode = modeBtn.dataset.mode;
        el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b === modeBtn));
        load(false);
        return;
      }

      const fb = e.target.closest('[data-feedback]');
      if (fb) {
        submitFeedback(fb.dataset.feedback === '1');
        return;
      }

      const action = e.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'mountain') openMountainSheet();
      if (action.dataset.action === 'refresh') load(true);
      if (action.dataset.action === 'share') {
        if (!ranked) return toastWarn('数据还没加载完');
        makeCard();
      }
    });

    await load();
    return () => {};
  }
};
