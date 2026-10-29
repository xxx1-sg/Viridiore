/** SOS 紧急求救页 */
import { icon } from '../core/icons.js';
import { contactRepo, bus, prefsStore } from '../core/store.js';
import { getPosition, getBattery, compassLabel } from '../services/geo.js';
import { formatCoord, formatTime, formatCoordShort } from '../core/format.js';
import { formDialog, confirmDialog, openModal } from '../core/modal.js';
import { toastOk, toastError, toastWarn } from '../core/toast.js';
import { copyText, shareText, smsLink, amapUrl } from '../services/exporter.js';
import { config } from '../config.js';
import { escapeHtml } from '../core/dom.js';

let countdownTimer = null;
let audioCtx = null;

function beep(times = 3) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + i * 0.5 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * 0.5 + 0.32);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.5);
      osc.stop(audioCtx.currentTime + i * 0.5 + 0.36);
    }
  } catch {
    /* 静默失败 */
  }
}

export default {
  id: 'sos',
  title: 'SOS',
  icon: 'alert',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">紧急求救</h1>
          <p class="page-head__desc">坐标会自动附在求救信息里</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--sm btn--ghost" type="button" data-action="call110">${icon('phone', 15)} 110</button>
        </div>
      </div>

      <div class="sos-stage">
        <button class="sos-btn" type="button" id="sosMain">
          <span class="sos-btn__main">SOS</span>
          <span class="sos-btn__sub">按 下 求 救</span>
        </button>
        <p class="sos-hint" id="sosHint">
          按下后有 5 秒倒计时可以取消，避免误触。<br>求救信息会包含你的实时坐标与时间。
        </p>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card__head">
          <span class="card__title">${icon('crosshair', 16)} 现场状态</span>
          <button class="btn btn--sm btn--plain" type="button" data-action="relocate">刷新定位</button>
        </div>
        <div class="kv"><span class="kv__k">坐标</span><span class="kv__v tabular" id="sosCoord">等待定位…</span></div>
        <div class="kv"><span class="kv__k">精度</span><span class="kv__v" id="sosAccuracy">--</span></div>
        <div class="kv"><span class="kv__k">海拔</span><span class="kv__v" id="sosAltitude">--</span></div>
        <div class="kv"><span class="kv__k">网络</span><span class="kv__v" id="sosNetwork">--</span></div>
        <div class="kv"><span class="kv__k">电量</span><span class="kv__v" id="sosBattery">--</span></div>
        <div class="kv"><span class="kv__k">时间</span><span class="kv__v tabular" id="sosTime">--</span></div>
        <p class="field__hint hidden" id="sosHint" style="margin-top:10px"></p>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card__head">
          <span class="card__title">${icon('users', 16)} 紧急联系人</span>
          <button class="btn btn--sm btn--ghost" type="button" data-action="add-contact">${icon('plus', 14)} 添加</button>
        </div>
        <div class="stack" id="sosContacts" style="gap:8px"></div>
        <p class="field__hint" style="margin-top:10px">建议设置 2—3 位，并与家人约定"超时未报平安即报警"。</p>
      </div>

      <div class="card">
        <div class="card__head">
          <span class="card__title">${icon('info', 16)} 求救渠道</span>
        </div>
        <div class="list">
          <button class="list-row" type="button" data-action="call110">
            <span class="list-row__icon" style="color:var(--danger)">${icon('phone', 18)}</span>
            <span class="list-row__main"><span class="list-row__title">拨打 110 / 119</span><span class="list-row__sub">最快，口头报坐标</span></span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>
          <button class="list-row" type="button" data-action="sms">
            <span class="list-row__icon">${icon('message', 18)}</span>
            <span class="list-row__main"><span class="list-row__title">短信发送坐标</span><span class="list-row__sub">无网络时也可尝试发送</span></span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>
          <button class="list-row" type="button" data-action="share">
            <span class="list-row__icon">${icon('share', 18)}</span>
            <span class="list-row__main"><span class="list-row__title">分享当前位置</span><span class="list-row__sub">系统分享面板 / 复制文本</span></span>
            <span class="list-row__tail">${icon('chevronRight', 15)}</span>
          </button>
        </div>
      </div>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    let position = null;
    let contacts = [];

    /* ---------- 状态 ---------- */
    const refreshStatus = async () => {
      $('#sosTime').textContent = formatTime(Date.now(), true);
      $('#sosNetwork').textContent = navigator.onLine ? '在线' : '离线';
      const battery = await getBattery();
      $('#sosBattery').textContent = battery ? `${battery.level}%${battery.charging ? ' · 充电中' : ''}` : '当前平台不可读';
    };

    const locate = async () => {
      const hint = $('#sosHint');
      hint.classList.add('hidden');
      $('#sosCoord').textContent = '定位中…';
      $('#sosAccuracy').textContent = '--';
      try {
        position = await getPosition({ timeout: 15000 });
        $('#sosCoord').textContent = formatCoord(position.lat, position.lon);
        $('#sosAccuracy').textContent = `±${Math.round(position.accuracy || 0)} m · ${compassLabel(position.heading || 0)}`;
        $('#sosAltitude').textContent = Number.isFinite(position.altitude)
          ? `${Math.round(position.altitude)} m`
          : '设备不支持';
        return position;
      } catch (err) {
        // 定位失败时不要把错误塞进「精度」字段，统一用一行提示表达
        $('#sosCoord').textContent = '—';
        $('#sosAccuracy').textContent = '—';
        $('#sosAltitude').textContent = '—';
        hint.textContent = `${err.message || '定位失败'}。可在系统设置中允许本应用使用定位，或到空旷处重试。`;
        hint.classList.remove('hidden');
        toastError(err.message || '定位失败');
        return null;
      }
    };

    /* ---------- 联系人 ---------- */
    const renderContacts = async () => {
      contacts = await contactRepo.list();
      const host = $('#sosContacts');
      if (!contacts.length) {
        host.innerHTML = `<div class="empty" style="padding:22px 10px">
          ${icon('users', 30)}
          <div class="empty__title">还没有紧急联系人</div>
          <div class="empty__desc">添加一位家人或队友，求救时可一键通知</div>
        </div>`;
        return;
      }
      host.innerHTML = contacts
        .map(
          (c) => `<div class="contact-card">
            <span class="contact-avatar">${escapeHtml(c.name.slice(0, 1))}</span>
            <div class="grow">
              <div class="contact-card__name">${escapeHtml(c.name)}${c.primary ? ' <span class="badge badge--dawn" style="height:18px;padding:0 6px;font-size:10px">首选</span>' : ''}</div>
              <div class="contact-card__meta">${escapeHtml(c.relation)} · ${escapeHtml(c.phone)}</div>
            </div>
            <button class="icon-btn" type="button" data-call="${escapeHtml(c.phone)}" title="拨号">${icon('phone', 16)}</button>
            <button class="icon-btn" type="button" data-edit="${c.id}" title="编辑">${icon('edit', 16)}</button>
            <button class="icon-btn" type="button" data-del="${c.id}" title="删除">${icon('trash', 16)}</button>
          </div>`
        )
        .join('');
      $('#sosHint').innerHTML = contacts.length
        ? `按下后有 5 秒倒计时可以取消。<br>将通知 ${contacts.length} 位联系人，并附上实时坐标。`
        : '按下后有 5 秒倒计时可以取消。<br>还没有联系人，建议先添加一位。';
    };

    const editContact = (contact = {}) =>
      formDialog({
        title: contact.id ? '编辑联系人' : '添加紧急联系人',
        fields: [
          { name: 'name', label: '姓名', value: contact.name || '', required: true, placeholder: '例如：妈妈' },
          { name: 'phone', label: '手机号', value: contact.phone || '', required: true, placeholder: '11 位手机号' },
          {
            name: 'relation',
            label: '关系',
            type: 'select',
            value: contact.relation || '家人',
            options: ['家人', '亲友', '队友', '领队'].map((v) => ({ label: v, value: v }))
          }
        ],
        submitText: '保存',
        onSubmit: async (data) => {
          await contactRepo.save({ ...contact, ...data });
          toastOk('已保存');
          renderContacts();
        }
      });

    /* ---------- 求救 ---------- */
    const buildMessage = (pos) => {
      const coord = pos ? formatCoord(pos.lat, pos.lon) : '坐标获取失败';
      const lines = [
        '【SOS 紧急求助】',
        '我在户外遇到紧急情况，需要救援。',
        `位置：${coord}`,
        pos?.altitude ? `海拔：约 ${Math.round(pos.altitude)} m` : '',
        `时间：${formatTime(Date.now(), true)}`,
        pos ? `地图：${amapUrl(pos.lat, pos.lon, '我的位置')}` : '',
        '这是我手机的自动求救信息，请尽快联系我或报警。'
      ];
      return lines.filter(Boolean).join('\n');
    };

    const dispatch = async () => {
      const btn = $('#sosMain');
      btn.classList.add('is-armed');
      btn.innerHTML = `<span class="sos-btn__main">SOS</span><span class="sos-btn__sub" id="sosCountdown">5</span>`;
      $('#sosHint').innerHTML = '<strong style="color:var(--danger)">正在发送求救信号…</strong>';
      beep(2);
      navigator.vibrate?.([200, 100, 200]);

      const pos = position || (await locate());
      const message = buildMessage(pos);

      // 有后端则推送，否则走本机渠道
      if (config.get('sos.endpoint')) {
        try {
          await fetch(config.get('sos.endpoint'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, position: pos, ts: Date.now() })
          });
          toastOk('已发送到求救服务');
        } catch (err) {
          toastWarn('服务发送失败，改走本机渠道');
        }
      }

      const primary = contacts.find((c) => c.primary) || contacts[0];
      const { close } = openModal({
        title: '求救信息已生成',
        desc: '请立刻选择一种方式发出去，并拨打电话确认对方收到。',
        body: `<div class="card" style="background:var(--danger-soft);border-color:transparent">
          <pre style="margin:0;white-space:pre-wrap;font-family:var(--font-sans);font-size:12.5px;line-height:1.7;color:var(--ink)">${escapeHtml(message)}</pre>
        </div>`,
        wide: true,
        actions: [
          {
            label: '复制',
            variant: 'ghost',
            onClick: async () => {
              await copyText(message);
              toastOk('已复制');
              return false;
            }
          },
          {
            label: primary ? `短信发给 ${primary.name}` : '选择短信',
            variant: 'ghost',
            close: false,
            onClick: () => {
              const phone = primary ? primary.phone : '';
              window.location.href = smsLink(phone, message);
            }
          },
          {
            label: '分享',
            variant: 'primary',
            close: false,
            onClick: async () => {
              const res = await shareText(message, 'SOS 紧急求助');
              if (res === 'copied') toastOk('系统不支持分享，已复制');
              if (res === 'shared') toastOk('已打开分享面板');
            }
          }
        ]
      });

      close; // 保留引用
      btn.classList.remove('is-armed');
      btn.innerHTML = `<span class="sos-btn__main">SOS</span><span class="sos-btn__sub">按 下 求 救</span>`;
      $('#sosHint').innerHTML = '求救信息已生成。若已脱险，记得告知联系人取消警报。';
    };

    const startCountdown = () => {
      if (countdownTimer) return;

      let remain = 5;
      const btn = $('#sosMain');
      btn.classList.add('is-armed');
      btn.innerHTML = `<span class="sos-btn__main" style="font-size:44px" id="sosCountdown">${remain}</span><span class="sos-btn__sub">点击取消</span>`;
      $('#sosHint').innerHTML = '倒计时中，点击按钮可取消。';
      beep(1);
      navigator.vibrate?.(120);

      countdownTimer = setInterval(() => {
        remain -= 1;
        const node = $('#sosCountdown');
        if (node) node.textContent = remain;
        beep(1);
        navigator.vibrate?.(80);
        if (remain <= 0) {
          cancelCountdown(false);
          dispatch();
        }
      }, 1000);
    };

    const cancelCountdown = (notify = true) => {
      clearInterval(countdownTimer);
      countdownTimer = null;
      const btn = $('#sosMain');
      btn.classList.remove('is-armed');
      btn.innerHTML = `<span class="sos-btn__main">SOS</span><span class="sos-btn__sub">按 下 求 救</span>`;
      $('#sosHint').innerHTML = '按下后有 5 秒倒计时可以取消，避免误触。<br>求救信息会包含你的实时坐标与时间。';
      if (notify) toastWarn('已取消');
    };

    /* ---------- 事件 ---------- */
    $('#sosMain').addEventListener('click', () => {
      if (countdownTimer) cancelCountdown();
      else startCountdown();
    });

    el.addEventListener('click', async (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'relocate') await locate();
        if (action === 'add-contact') editContact();
        if (action === 'call110') window.location.href = 'tel:110';
        if (action === 'sms') {
          const primary = contacts.find((c) => c.primary) || contacts[0];
          if (!primary) {
            toastWarn('请先添加紧急联系人');
            return;
          }
          const pos = position || (await locate());
          window.location.href = smsLink(primary.phone, buildMessage(pos));
        }
        if (action === 'share') {
          const pos = position || (await locate());
          const res = await shareText(buildMessage(pos), 'SOS 紧急求助');
          if (res === 'copied') toastOk('已复制到剪贴板');
        }
      }

      const callBtn = e.target.closest('[data-call]');
      if (callBtn) window.location.href = `tel:${callBtn.dataset.call}`;

      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) {
        const c = contacts.find((x) => x.id === editBtn.dataset.edit);
        editContact(c);
      }

      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        const ok = await confirmDialog({
          title: '删除联系人？',
          desc: '删除后不会再向该联系人发送求救信息。',
          confirmText: '删除',
          danger: true
        });
        if (ok) {
          await contactRepo.remove(delBtn.dataset.del);
          renderContacts();
        }
      }
    });

    const offContact = bus.on('contact:change', renderContacts);
    await renderContacts();
    refreshStatus();
    locate();

    return () => {
      offContact();
      clearInterval(countdownTimer);
      countdownTimer = null;
    };
  },

  onShow() {
    const t = document.querySelector('#sosTime');
    if (t) t.textContent = formatTime(Date.now(), true);
  }
};
