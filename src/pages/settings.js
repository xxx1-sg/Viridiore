/** 设置页：数据源、样本、外观、数据管理 */
import { icon, brandMark } from '../core/icons.js';
import { config } from '../config.js';
import { prefsStore, clearAllData, bus, trailRepo } from '../core/store.js';
import { themeManager } from '../core/theme.js';
import { ensureWeather } from '../state.js';
import { qweather } from '../services/qweather.js';
import { feedbackStats, invalidateCalibrationCache } from '../services/calibration.js';
import { toastOk, toastError, toastWarn } from '../core/toast.js';
import { confirmDialog } from '../core/modal.js';
import { download } from '../services/exporter.js';
import { escapeHtml } from '../core/dom.js';

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Electron/i.test(ua)) return 'Windows 桌面版（Electron）';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Macintosh/i.test(ua)) return 'macOS';
  return '浏览器 / PWA';
}

export default {
  id: 'settings',
  title: '设置',
  icon: 'settings',

  template() {
    const cfg = config.all;
    const src = config.hasQWeather() ? 'Open-Meteo + 和风天气（预警 / 空气质量）' : 'Open-Meteo（免费，无需 Key）';
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">设置</h1>
          <p class="page-head__desc">当前数据来源：${src}</p>
        </div>
      </div>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">和风天气 · 可选增强</div>
          <p class="field__hint" style="margin:-6px 0 14px">
            预报本身已经走 Open-Meteo，打开就是真实数据。这里填 Key 只为了两件 Open-Meteo 给不了的东西：
            <strong>中国气象局的气象预警</strong>，以及<strong>环境监测总站的实测 AQI</strong>。
            不填的话空气质量是 CAMS 模式估算值，通常比监测站实测偏高，尤其 SO₂ 和 NO₂。
          </p>
          <label class="field" style="margin-bottom:14px">
            <span class="field__label">API Key</span>
            <input class="input" id="qwKey" type="password" placeholder="粘贴你的和风天气 Key" value="${escapeHtml(
              cfg.qweather.key || ''
            )}" />
          </label>
          <label class="field" style="margin-bottom:14px">
            <span class="field__label">API Host</span>
            <input class="input" id="qwHost" type="text" placeholder="https://xxxxxxxx.re.qweatherapi.com" value="${escapeHtml(
              cfg.qweather.host || ''
            )}" />
            <span class="field__hint">免费版必须填控制台分配的专属 Host；不确定可先保持 devapi.qweather.com。</span>
          </label>
          <div class="row" style="gap:8px">
            <button class="btn btn--sm btn--primary" type="button" data-action="test-weather">${icon(
              'activity',
              14
            )} 测试连接</button>
            <button class="btn btn--sm btn--ghost" type="button" data-action="open-qw">申请地址</button>
          </div>
          <p class="field__hint" style="margin-top:12px">
            前端 Key 一定会被扒出来。上线前请在和风控制台设置域名白名单并开启用量告警，
            或把请求转发到你自己的服务端。
          </p>
        </div>
      </section>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">模型校准</div>
          <button class="list-row" type="button" data-action="feedback">
            <span class="list-row__icon">${icon('sparkles', 18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">我的反馈样本</span>
              <span class="list-row__sub" id="fbSub">读取中…</span>
            </span>
            <span class="list-row__tail" id="fbCount">--</span>
          </button>
          <button class="list-row" type="button" data-action="reset-calib">
            <span class="list-row__icon">${icon('refresh', 18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">重置校准</span>
              <span class="list-row__sub">样本只留在本机，重置后概率回到未经校准的模型输出</span>
            </span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">外观</div>
          <div class="setting-row" style="border-bottom:none">
            <div class="setting-row__main">
              <div class="setting-row__title">主题</div>
              <div class="setting-row__desc" id="themeDesc">${themeManager.label()}</div>
            </div>
            <div class="segmented" id="themeSeg">
              ${['auto', 'light', 'dark']
                .map(
                  (m) =>
                    `<button type="button" data-theme-set="${m}" class="${themeManager.mode === m ? 'is-active' : ''}">${
                      { auto: '自动', light: '浅色', dark: '深色' }[m]
                    }</button>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">数据</div>
          <button class="list-row" type="button" data-action="export-data">
            <span class="list-row__icon">${icon('download', 18)}</span>
            <span class="list-row__main"><span class="list-row__title">导出全部数据</span><span class="list-row__sub">轨迹、追光反馈、偏好（JSON）</span></span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>
          <button class="list-row" type="button" data-action="install">
            <span class="list-row__icon">${icon('expand', 18)}</span>
            <span class="list-row__main"><span class="list-row__title">安装到本机</span><span class="list-row__sub">PWA：添加到主屏幕 / 桌面</span></span>
            <span class="list-row__tail" id="installState">检查中</span>
          </button>
          <button class="list-row" type="button" data-action="clear">
            <span class="list-row__icon" style="color:var(--danger)">${icon('trash', 18)}</span>
            <span class="list-row__main"><span class="list-row__title" style="color:var(--danger)">清除全部数据</span><span class="list-row__sub">不可恢复，请先导出备份</span></span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="card" style="text-align:center;padding:26px 20px">
          <div style="display:flex;justify-content:center;margin-bottom:10px">${brandMark(52)}</div>
          <div style="font-family:var(--font-display);font-size:20px;letter-spacing:.16em">晓山青</div>
          <div class="muted" style="font-size:11px;letter-spacing:.2em;margin-top:4px">VIRIDIORE</div>
          <div class="muted" style="font-size:12px;margin-top:14px">版本 v${__APP_VERSION__} · ${detectPlatform()}</div>
          <div class="muted" style="font-size:11px;margin-top:6px">不问天气好不好，只回答值不值得去</div>
        </div>
      </section>

      <p class="center muted" style="font-size:11px;padding:6px 0 10px">
        无痕山林 · 只带走照片，只留下脚印
      </p>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);

    const saveConfig = () => {
      config.set({
        qweather: {
          key: $('#qwKey').value.trim(),
          host: $('#qwHost').value.trim() || 'https://devapi.qweather.com'
        }
      });
      bus.emit('config:change', config.all);
    };

    el.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        saveConfig();
        input.style.borderColor = 'var(--moss-400)';
        setTimeout(() => (input.style.borderColor = ''), 700);
      });
    });

    const refreshFeedback = async () => {
      const { total } = await feedbackStats();
      $('#fbCount').textContent = `${total} 条`;
      $('#fbSub').textContent =
        total < 3
          ? `已有 ${total} 条，满 3 条开始参与概率校准`
          : `已有 ${total} 条，已参与概率校准`;
    };

    el.addEventListener('click', async (e) => {
      const themeBtn = e.target.closest('[data-theme-set]');
      if (themeBtn) {
        themeManager.set(themeBtn.dataset.themeSet);
        el.querySelectorAll('[data-theme-set]').forEach((b) => b.classList.toggle('is-active', b === themeBtn));
        $('#themeDesc').textContent = themeManager.label();
        return;
      }

      const action = e.target.closest('[data-action]');
      if (!action) return;

      switch (action.dataset.action) {
        case 'test-weather': {
          saveConfig();
          if (!config.hasQWeather()) {
            toastWarn('请先填写 API Key');
            return;
          }
          const btn = action;
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> 测试中';
          try {
            const data = await qweather.now(114.0579, 22.5431);
            toastOk(`连接成功：深圳 ${data.now.temp}℃ ${data.now.text}`);
            ensureWeather(true).catch(() => {});
          } catch (err) {
            toastError(`连接失败：${err.message}`);
          } finally {
            btn.disabled = false;
            btn.innerHTML = `${icon('activity', 14)} 测试连接`;
          }
          break;
        }
        case 'open-qw':
          window.open('https://console.qweather.com/', '_blank', 'noopener');
          break;
        case 'feedback': {
          const { rows } = await feedbackStats();
          if (!rows.length) {
            toastWarn('还没有反馈样本。到追光页点「看到了 / 白跑一趟」');
            return;
          }
          toastOk(`共 ${rows.length} 条样本，最近一条预测 ${rows[rows.length - 1].predicted}%`);
          break;
        }
        case 'reset-calib': {
          const ok = await confirmDialog({
            title: '重置校准？',
            desc: '会清空所有追光反馈样本，概率回到未经校准的模型输出。轨迹不受影响。',
            confirmText: '重置',
            danger: true
          });
          if (ok) {
            const { idb } = await import('../core/db.js');            await idb.clear('feedback').catch(() => {});
            invalidateCalibrationCache();
            refreshFeedback();
            toastOk('已重置');
          }
          break;
        }
        case 'export-data': {
          const [trails, fb] = await Promise.all([trailRepo.list(), feedbackStats()]);
          download(
            `xiaoshanqing-backup-${new Date().toISOString().slice(0, 10)}.json`,
            JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                version: __APP_VERSION__,
                trails,
                feedback: fb.rows,
                prefs: prefsStore.all
              },
              null,
              2
            ),
            'application/json'
          );
          toastOk('已导出 JSON 备份');
          break;
        }
        case 'install': {
          if (window.__installPrompt) {
            window.__installPrompt.prompt();
            const choice = await window.__installPrompt.userChoice;
            window.__installPrompt = null;
            $('#installState').textContent = choice.outcome === 'accepted' ? '已发起安装' : '已取消';
          } else if (window.matchMedia('(display-mode: standalone)').matches) {
            toastOk('已在独立窗口中运行');
          } else {
            toastWarn('当前浏览器未提供安装入口：iOS 请用 Safari「添加到主屏幕」');
          }
          break;
        }
        case 'clear': {
          const ok = await confirmDialog({
            title: '清除全部数据？',
            desc: '轨迹、追光反馈、缓存都会删除，且无法恢复。',
            confirmText: '确认清除',
            danger: true
          });
          if (ok) {
            await clearAllData();
            toastOk('已清除，正在重新加载');
            setTimeout(() => location.reload(), 800);
          }
          break;
        }
        default:
          break;
      }
    });

    const installState = $('#installState');
    installState.textContent = window.__installPrompt
      ? '可安装'
      : window.matchMedia('(display-mode: standalone)').matches
        ? '已安装'
        : '不可用';

    refreshFeedback();

    const off = bus.on('config:change', () => {});
    return () => off();
  }
};
