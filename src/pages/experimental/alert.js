/** 气象预警页 */
import { icon } from '../core/icons.js';
import { appState, ensureWeather } from '../state.js';
import { bus, prefsStore } from '../core/store.js';
import { formatTime, relTime } from '../core/format.js';
import { toastOk, toastWarn } from '../core/toast.js';
import { escapeHtml } from '../core/dom.js';

const COLOR_CLASS = {
  red: 'alert-card--red',
  orange: 'alert-card--orange',
  yellow: 'alert-card--yellow',
  blue: 'alert-card--blue'
};

function severityClass(color) {
  return COLOR_CLASS[String(color || '').toLowerCase()] || 'alert-card--yellow';
}

function severityText(color) {
  return { red: '红色', orange: '橙色', yellow: '黄色', blue: '蓝色' }[String(color || '').toLowerCase()] || '提示';
}

export default {
  id: 'alert',
  title: '预警',
  icon: 'bell',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">气象预警</h1>
          <p class="page-head__desc" id="alertSub">正在获取 ${appState.location.name} 的预警信息…</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="refresh" title="刷新">${icon('refresh', 19)}</button>
        </div>
      </div>

      <div class="alert-hero" id="alertHero" style="margin-bottom:16px">
        <div class="alert-hero__icon">${icon('shield', 24)}</div>
        <div class="grow">
          <div class="alert-hero__title" id="alertHeroTitle">检查中…</div>
          <div class="alert-hero__desc" id="alertHeroDesc">正在读取最新预警信号</div>
        </div>
      </div>

      <div class="stack" id="alertList" style="margin-bottom:18px"></div>

      <section class="section">
        <div class="section__head"><div><h2 class="section__title">现场提示</h2><p class="section__desc">根据当前气象条件生成</p></div></div>
        <div class="card">
          <div class="list" id="alertTips"></div>
        </div>
      </section>

      <section class="section">
        <div class="section__head"><div><h2 class="section__title">提醒设置</h2></div></div>
        <div class="settings-group">
          <div class="setting-row">
            <div class="setting-row__main">
              <div class="setting-row__title">预警推送</div>
              <div class="setting-row__desc">App 在前台时，出现新预警会弹出提醒</div>
            </div>
            <button class="switch" type="button" role="switch" data-toggle="notifications"></button>
          </div>
          <div class="setting-row">
            <div class="setting-row__main">
              <div class="setting-row__title">只提醒高级别</div>
              <div class="setting-row__desc">仅在橙色 / 红色预警时提醒</div>
            </div>
            <button class="switch" type="button" role="switch" data-toggle="alertSevereOnly"></button>
          </div>
        </div>
        <p class="field__hint" style="padding:8px 4px">
          后台推送需要安装为 App 并授权通知；离线状态下预警数据来自最近一次缓存。
        </p>
      </section>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);

    const syncSwitches = () => {
      el.querySelectorAll('[data-toggle]').forEach((node) => {
        const key = node.dataset.toggle;
        node.setAttribute('aria-checked', String(!!prefsStore.get(key, false)));
      });
    };

    const renderTips = (wx) => {
      const host = $('#alertTips');
      if (!wx) {
        host.innerHTML = '<div class="empty__desc">暂无气象数据</div>';
        return;
      }
      const tips = [];
      const wind = Number(wx.now.windScale) || 0;
      const today = wx.daily?.[0];

      if (wind >= 5) tips.push({ icon: 'wind', text: `当前风力 ${wind} 级，山脊线行走困难，建议改走林荫线路或推迟行程。`, tone: 'warn' });
      if (today && Number(today.pop) >= 60) tips.push({ icon: 'cloudRain', text: `今日降水概率 ${today.pop}%，注意湿滑与山洪，避免溯溪。`, tone: 'warn' });
      if (Number(wx.now.vis) < 5) tips.push({ icon: 'fog', text: `能见度仅 ${wx.now.vis} km，驾车与找路都受影响，携带头灯与离线地图。`, tone: 'warn' });
      if (Number(wx.now.temp) >= 33) tips.push({ icon: 'thermometer', text: '高温天气，避开 11:00—15:00 的无遮阴路段，补水要加电解质。', tone: 'warn' });
      if (Number(wx.now.temp) <= 10) tips.push({ icon: 'thermometer', text: '低温环境，注意防风与保暖，湿衣是失温主因。', tone: 'warn' });
      if (!tips.length) {
        tips.push({ icon: 'shield', text: '当前无生效预警，气象条件平稳。仍需按计划告知家人路线与返程时间。', tone: 'ok' });
      }

      host.innerHTML = tips
        .map(
          (t) => `<div class="list-row">
            <span class="list-row__icon" style="color:var(${t.tone === 'ok' ? '--ok' : '--warn'})">${icon(t.icon, 18)}</span>
            <span class="list-row__main"><span class="list-row__title" style="font-weight:500;line-height:1.6">${t.text}</span></span>
          </div>`
        )
        .join('');
    };

    const render = (wx) => {
      if (!wx) return;
      const warnings = wx.warnings || [];
      const severeOnly = prefsStore.get('alertSevereOnly', false);
      const list = severeOnly
        ? warnings.filter((w) => ['橙', '红'].some((c) => (w.severityColor || w.level || '').includes(c)) || /Orange|Red/i.test(w.severityColor || ''))
        : warnings;

      $('#alertSub').textContent = `${wx.place.name} · ${wx.source === 'live' ? '和风天气' : '演示数据'} · ${formatTime(wx.updatedAt)} 更新`;

      const hero = $('#alertHero');
      if (!list.length) {
        hero.className = 'alert-hero';
        hero.querySelector('.alert-hero__icon').innerHTML = icon('shield', 24);
        $('#alertHeroTitle').textContent = '当前无生效预警';
        $('#alertHeroDesc').textContent = '监测区域天气平稳，适合按计划出行';
        $('#alertList').innerHTML = `<div class="card"><div class="empty">
          ${icon('bell', 32)}
          <div class="empty__title">没有需要关注的预警</div>
          <div class="empty__desc">出现暴雨、雷电、大风等预警时，会在这里第一时间显示</div>
        </div></div>`;
      } else {
        const top = list[0];
        hero.className = `alert-hero ${/red|橙|red/i.test(top.severityColor || '') ? 'is-danger' : 'is-warn'}`;
        hero.querySelector('.alert-hero__icon').innerHTML = icon('alert', 24);
        $('#alertHeroTitle').textContent = `生效中 ${list.length} 条预警`;
        $('#alertHeroDesc').textContent = `${top.typeName || '气象'}${severityText(top.severityColor)}预警 · ${relTime(new Date(top.pubTime).getTime())}`;

        $('#alertList').innerHTML = list
          .map(
            (w) => `<div class="alert-card ${severityClass(w.severityColor)}">
              <div class="alert-card__head">
                <span class="alert-card__title">${escapeHtml(w.title)}</span>
                <span class="badge badge--warn">${escapeHtml(severityText(w.severityColor))}</span>
              </div>
              <p class="alert-card__body">${escapeHtml(w.text || '')}</p>
              <div class="alert-card__foot">
                ${escapeHtml(w.sender || '')} · ${w.pubTime ? formatTime(new Date(w.pubTime)) : ''}
                ${w.endTime ? ` · 预计解除 ${formatTime(new Date(w.endTime))}` : ''}
              </div>
            </div>`
          )
          .join('');
      }

      renderTips(wx);

      // 新预警提醒
      if (prefsStore.get('notifications', false) && list.length) {
        const seen = prefsStore.get('seenWarnings', []);
        const fresh = list.filter((w) => !seen.includes(w.id));
        if (fresh.length) {
          toastWarn(`新预警：${fresh[0].title}`, { duration: 4000 });
          prefsStore.set({ seenWarnings: [...seen, ...fresh.map((w) => w.id)].slice(-30) });
        }
      }
    };

    async function load(force = false) {
      try {
        const wx = await ensureWeather(force);
        render(wx);
      } catch {
        $('#alertSub').textContent = '预警数据获取失败';
      }
    }

    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action="refresh"]')) {
        await load(true);
        toastOk('已刷新');
        return;
      }
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        const key = toggle.dataset.toggle;
        const next = !prefsStore.get(key, false);
        prefsStore.set({ [key]: next });
        toggle.setAttribute('aria-checked', String(next));
        if (key === 'notifications' && next && 'Notification' in window) {
          try {
            await Notification.requestPermission();
          } catch {
            /* 忽略 */
          }
        }
      }
    });

    syncSwitches();
    const off = bus.on('weather:change', render);
    await load();
    return () => off();
  },

  onShow() {
    ensureWeather().catch(() => {});
  }
};
