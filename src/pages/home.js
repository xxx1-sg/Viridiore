/** 首页：只回答一个问题——最近哪个清晨值得上山 */
import { icon } from '../core/icons.js';
import { appState, ensureWeather, currentMountain, setMountain } from '../state.js';
import { bus, trailRepo } from '../core/store.js';
import { formatDate, formatTime, formatDistance, relTime } from '../core/format.js';
import { rankDays, advice, compensation, MODES, summitTemp } from '../services/chase.js';
import { calibrationFor } from '../services/calibration.js';
import { parseIntent, matchRoutes, describeIntent, QUICK_INTENTS } from '../services/intent.js';
import { annualRecap, compareWithPrevious } from '../services/narrative.js';
import { sunTimes } from '../services/sun.js';
import { MOUNTAINS } from '../data/mountains.js';
import { openSheet } from '../core/modal.js';
import { navigate } from '../router.js';
import { countUp, escapeHtml } from '../core/dom.js';
import { toastWarn } from '../core/toast.js';

const MODE_ORDER = ['cloudsea', 'sunrise', 'stars'];

const FEATURES = [
  { id: 'chase', name: '追光', desc: '概率 · 坡向 · 时间', icon: 'sunrise', tone: 'dawn' },
  { id: 'trail', name: '轨迹', desc: '记录 · 卡片', icon: 'footprint', tone: '' },
  { id: 'weather', name: '天气', desc: '实时 · 预警', icon: 'cloudSun', tone: '' }
];

/** 今天还没过日出，就看今天；否则从明天算起 */
function pickTarget(all) {
  const now = Date.now();
  return (
    all.find((item) => {
      const d = item.day.dateObj instanceof Date ? item.day.dateObj : new Date(item.day.date);
      const sun = sunTimes(d, 22.58, 114.2);
      if (!sun.sunrise) return item.index > 0;
      return item.index > 0 || now < sun.sunrise.getTime() + 30 * 60000;
    }) || all[0]
  );
}

export default {
  id: 'home',
  title: '首页',
  icon: 'home',

  template() {
    const m = currentMountain();
    return `
      <section class="hero" id="homeHero">
        <div class="hero__sky"></div>
        <div class="hero__sun"></div>
        <div class="hero__horizon"></div>
        <div class="hero__ridge hero__ridge--far"></div>
        <div class="hero__ridge hero__ridge--mid"></div>
        <div class="hero__ridge hero__ridge--near"></div>
        <div class="hero__mist"></div>
        <div class="hero__content">
          <div class="hero__meta">
            <span class="badge badge--glass badge--dot" id="heroSource">读取中</span>
            <span id="heroDate">--</span>
          </div>
          <h1 class="hero__title">晓山青</h1>
          <p class="hero__tagline">不问天气好不好，只回答值不值得去</p>
          <div class="hero__panel">
            <div class="hero__temp">
              <strong id="heroTemp">--</strong><span>°C</span>
              <span id="heroCond" style="margin-left:6px">读取中…</span>
            </div>
            <div class="hero__actions">
              <button class="hero__btn hero__btn--dawn" type="button" data-go="chase">${icon('sunrise', 14)} 追光</button>
            </div>
          </div>
        </div>
      </section>

      <section class="verdict" id="verdictCard">
        <div class="verdict__head">
          <span class="verdict__kicker" id="verdictKicker">${icon('sparkles', 13)} 正在计算</span>
          <button class="verdict__mountain" type="button" data-action="mountain" id="verdictMountain">
            ${m.name} ${icon('chevronDown', 13)}
          </button>
        </div>

        <div class="verdict__main">
          <div class="verdict__prob">
            <span class="verdict__num" id="verdictNum">--</span><span class="verdict__pct">%</span>
          </div>
          <div class="verdict__side">
            <div class="verdict__mode" id="verdictMode">云海</div>
            <div class="verdict__grade" id="verdictGrade">--</div>
          </div>
        </div>

        <p class="verdict__sentence" id="verdictSentence">正在根据温湿与逆温条件估算…</p>

        <div class="verdict__facts" id="verdictFacts"></div>

        <div class="verdict__foot">
          <span id="verdictFoot">基准率 --</span>
          <button class="btn btn--sm btn--ghost" type="button" data-go="chase">看七天窗口 ${icon('chevronRight', 13)}</button>
        </div>
      </section>

      <div class="mini-modes" id="miniModes"></div>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">问一句</h2>
            <p class="section__desc">说出条件，直接给路线，不聊天</p>
          </div>
        </div>
        <form class="ask" id="askForm">
          <span class="ask__icon">${icon('search', 17)}</span>
          <input class="ask__input" id="askInput" type="text" autocomplete="off"
            placeholder="例：周六带 6 岁孩子，2 小时能来回" />
          <button class="ask__btn" type="submit">${icon('chevronRight', 17)}</button>
        </form>
        <div class="ask__chips" id="askChips">
          ${QUICK_INTENTS.map((q) => `<button class="chip chip--sm" type="button" data-chip="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
        </div>
        <div id="askResult"></div>
      </section>

      <section class="section" id="compensateSection" hidden>
        <div class="compensate" id="compensateCard"></div>
      </section>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">三个功能</h2>
            <p class="section__desc">能用的只有这三个，其他都下架了</p>
          </div>
        </div>
        <div class="feature-grid feature-grid--3">
          ${FEATURES.map(
            (f) => `<button class="feature ${f.tone ? `feature--${f.tone}` : ''}" type="button" data-go="${f.id}">
              <span class="feature__icon">${icon(f.icon, 18)}</span>
              <span class="feature__name">${f.name}</span>
              <span class="feature__desc">${f.desc}</span>
            </button>`
          ).join('')}
        </div>
      </section>

      <section class="section" id="recapSection" hidden>
        <div class="recap" id="recapCard"></div>
      </section>

      <section class="section" id="recentSection">
        <div class="section__head">
          <div>
            <h2 class="section__title">最近轨迹</h2>
            <p class="section__desc">保存在本机，可导出 GPX 或生成卡片</p>
          </div>
          <button class="btn btn--sm btn--ghost" type="button" data-go="trail">去记录</button>
        </div>
        <div class="card card--flush" id="recentTrails">
          <div class="loading-inline"><span class="spinner"></span>读取中…</div>
        </div>
      </section>

      <footer class="center muted" style="font-size:11px;padding:10px 0 4px">
        晓山青 Viridiore · <span id="homeVersion">v2.0</span> · 无痕山林，只带走照片
      </footer>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    const m = currentMountain();

    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) {
        navigate(go.dataset.go);
        return;
      }
      if (e.target.closest('[data-action="mountain"]')) openMountainSheet();
    });

    /* ---------------- 日期 ---------------- */
    $('#heroDate').textContent = formatDate(new Date(), true);

    /* ---------------- 追光判断 ---------------- */
    let calib = { offset: 0, n: 0 };

    const renderVerdict = (wx) => {
      if (!wx?.daily?.length) return;
      const mountain = currentMountain();
      const ranked = rankDays(wx.daily, 'cloudsea', {
        mountain,
        source: wx.source,
        calibration: calib
      });
      const target = pickTarget(ranked.all);
      if (!target) return;

      const p = target.probability;
      const label = target.index === 0 ? '今天清晨' : target.index === 1 ? '明天清晨' : `${target.index} 天后`;
      const dateObj = target.day.dateObj instanceof Date ? target.day.dateObj : new Date(target.day.date);
      const sun = sunTimes(dateObj, mountain.lat, mountain.lon);

      $('#verdictKicker').innerHTML = `${icon('sparkles', 13)} ${label} · ${formatTime(sun.sunrise, false).slice(0, 5)} 前后`;
      $('#verdictNum').textContent = '0';
      $('#verdictNum').dataset.target = String(p);
      countUp($('#verdictNum'), p, { duration: 700 });
      $('#verdictMode').textContent = '云海概率';
      $('#verdictGrade').textContent = target.grade.label;
      $('#verdictGrade').className = `verdict__grade is-${target.grade.tone}`;
      $('#verdictSentence').textContent = advice(target, 'cloudsea', mountain);

      const facts = [];
      target.factors.slice(0, 2).forEach((f) => facts.push({ tone: f.tone, text: f.detail || `${f.label} ${f.value}` }));
      if (target.probability >= 22) {
        const temp = summitTemp(target.day, mountain.elevation);
        if (temp != null) facts.push({ tone: 'neutral', text: `山顶约 ${temp} ℃` });
      }
      $('#verdictFacts').innerHTML = facts
        .filter((f) => f.text)
        .slice(0, 3)
        .map(
          (f) => `<span class="verdict__fact is-${f.tone}">
            <i>${f.tone === 'pro' ? '＋' : f.tone === 'con' ? '－' : '·'}</i>${escapeHtml(f.text)}
          </span>`
        )
        .join('');

      $('#verdictFoot').textContent = `基准率 ${target.baseRate}% · 置信度 ${target.confidence.label}${
        wx.source === 'demo' ? ' · 演示数据' : ''
      }`;

      /* 三个模式横排 */
      const otherModes = MODE_ORDER.map((key) => {
        const r =
          key === 'cloudsea'
            ? target
            : rankDays(wx.daily, key, { mountain, source: wx.source, calibration: calib }).all[target.index];
        return { key, name: MODES[key].name, prob: r?.probability ?? 0, icon: MODES[key].icon };
      });
      $('#miniModes').innerHTML = otherModes
        .map(
          (o) => `<button class="mini-mode ${o.key === 'cloudsea' ? 'is-active' : ''}" type="button" data-mode="${o.key}">
            <span class="mini-mode__icon">${icon(o.icon, 15)}</span>
            <span class="mini-mode__name">${o.name}</span>
            <span class="mini-mode__prob">${o.prob}%</span>
          </button>`
        )
        .join('');

      /* 补偿：今天不值得去，就给下一个窗口 */
      const comp = compensation({ all: ranked.all, mode: 'cloudsea', todayProb: target.probability });
      const show = target.probability < 55 && comp;
      $('#compensateSection').hidden = !show;
      if (show) {
        $('#compensateCard').innerHTML = `
          <span class="compensate__icon">${icon(comp.tone === 'hopeful' ? 'sunrise' : 'moon', 18)}</span>
          <p>${escapeHtml(comp.text)}</p>`;
        $('#compensateCard').classList.toggle('is-hopeful', comp.tone === 'hopeful');
      }

      /* 首页也允许切换模式：点 mini-mode 直接去追光页对应模式 */
      el.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => navigate(`chase?mode=${btn.dataset.mode}`));
      });
    };

    /* ---------------- 顶部天气 ---------------- */
    const renderHero = (wx) => {
      if (!wx) return;
      $('#heroTemp').textContent = wx.now.temp;
      $('#heroCond').textContent = `体感 ${wx.now.feels}°`;
      const badge = $('#heroSource');
      badge.textContent = wx.source === 'live' ? '实时数据' : '演示数据';
      badge.style.opacity = wx.source === 'live' ? '1' : '0.85';
    };

    /* ---------------- 问一句 ---------------- */
    const askForm = $('#askForm');
    const askInput = $('#askInput');
    const askResult = $('#askResult');

    const runQuery = (text) => {
      const intent = parseIntent(text);
      askInput.value = text;
      const echo = describeIntent(intent);
      const result = matchRoutes(intent);

      const cards = result.items
        .map(
          (item) => `<button class="route-card" type="button" data-pick="${item.mountain.id}">
            <span class="route-card__main">
              <span class="route-card__name">${item.mountain.name}
                <small>${item.mountain.elevation} m · 难度 ${item.mountain.difficulty}/5</small>
              </span>
              <span class="route-card__why">${escapeHtml(item.why)}</span>
            </span>
            <span class="route-card__go">${icon('chevronRight', 15)}</span>
          </button>`
        )
        .join('');

      askResult.innerHTML = `
        <p class="ask__echo">${escapeHtml(echo)}</p>
        ${intent.understood.length ? `<p class="ask__note">${escapeHtml(result.note)}</p>` : ''}
        <div class="route-list">${cards || '<div class="empty"><div class="empty__title">没有匹配的路线</div></div>'}</div>`;
    };

    askForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = askInput.value.trim();
      if (text) runQuery(text);
    });

    $('#askChips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chip]');
      if (chip) runQuery(chip.dataset.chip);
    });

    askResult.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      setMountain(pick.dataset.pick);
      navigate('chase');
    });

    /* ---------------- 山峰切换 ---------------- */
    function openMountainSheet() {
      const body = `<div class="list">
        ${MOUNTAINS.map(
          (mm) => `<button class="list-row" type="button" data-mountain="${mm.id}">
            <span class="list-row__icon">${icon('mountain', 18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">${mm.name} <span class="muted" style="font-weight:400">${mm.elevation}m</span></span>
              <span class="list-row__sub">${mm.area} · ${mm.tags.slice(0, 3).join(' / ')}</span>
            </span>
            <span class="list-row__tail">${mm.id === appState.mountainId ? '当前' : ''}</span>
          </button>`
        ).join('')}
      </div>`;
      const { el: sheet, close } = openSheet({ title: '换个山头', body });
      sheet.addEventListener('click', (e2) => {
        const btn = e2.target.closest('[data-mountain]');
        if (!btn) return;
        setMountain(btn.dataset.mountain);
        close();
        $('#verdictMountain').innerHTML = `${currentMountain().name} ${icon('chevronDown', 13)}`;
        calibrationFor(btn.dataset.mountain, 'cloudsea')
          .then((c) => {
            calib = c;
            return ensureWeather();
          })
          .then((wx) => renderVerdict(wx));
      });
    }

    /* ---------------- 最近轨迹 + 年度 ---------------- */
    const renderTrails = async () => {
      const host = $('#recentTrails');
      const trails = await trailRepo.list();

      if (!trails.length) {
        host.innerHTML = `
          <div class="empty">
            ${icon('footprint', 34)}
            <div class="empty__title">还没有记录过轨迹</div>
            <div class="empty__desc">上山前点一下「开始记录」，下山后能生成一张带天气的卡片</div>
          </div>`;
        $('#recapSection').hidden = true;
        return;
      }

      host.innerHTML = `<div style="padding:6px 14px 10px">
        ${trails
          .slice(0, 3)
          .map(
            (t, i) => `<button class="list-row" type="button" data-trail="${t.id}">
              <span class="list-row__icon">${icon('route', 18)}</span>
              <span class="list-row__main">
                <span class="list-row__title">${escapeHtml(t.name)}</span>
                <span class="list-row__sub">${formatDate(t.startedAt)} · ${formatDistance((t.stats?.distanceKm || 0) * 1000)} · 爬升 ${
                  t.stats?.elevation?.gain || 0
                } m</span>
              </span>
              <span class="list-row__tail">${i === 0 ? relTime(t.startedAt) : ''}</span>
            </button>`
          )
          .join('')}
      </div>`;

      const recap = annualRecap(trails);
      if (recap) {
        $('#recapSection').hidden = false;
        $('#recapCard').innerHTML = `
          <span class="recap__year">${recap.year}</span>
          <p>${recap.text}</p>`;
      }

      const cmp = compareWithPrevious(trails[0], trails[1]);
      if (cmp && trails[0]?.id) {
        const row = host.querySelector(`[data-trail="${trails[0].id}"] .list-row__sub`);
        if (row) row.textContent = `${formatDistance((trails[0].stats?.distanceKm || 0) * 1000)} · ${cmp}`;
      }
    };

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-trail]')) navigate('trail');
    });

    const offWeather = bus.on('weather:change', (wx) => {
      renderHero(wx);
      renderVerdict(wx);
    });
    const offTrail = bus.on('trail:change', renderTrails);

    try {
      calib = await calibrationFor(m.id, 'cloudsea');
      const wx = await ensureWeather();
      renderHero(wx);
      renderVerdict(wx);
    } catch (err) {
      $('#verdictSentence').textContent = '天气数据获取失败，稍后重试。';
      toastWarn(err.message || '天气获取失败');
    }

    renderTrails();
    $('#homeVersion').textContent = `v${__APP_VERSION__}`;

    return () => {
      offWeather();
      offTrail();
    };
  },

  onShow() {
    ensureWeather().catch(() => {});
  }
};
