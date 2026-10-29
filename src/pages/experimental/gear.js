/** 装备清单 */
import { icon } from '../core/icons.js';
import { GEAR_GROUPS, gearRepo, bus, prefsStore } from '../core/store.js';
import { GEAR_PRESETS } from '../data/gear.js';
import { formDialog, confirmDialog, openSheet } from '../core/modal.js';
import { toastOk } from '../core/toast.js';
import { escapeHtml } from '../core/dom.js';
import { pct } from '../core/format.js';

async function seedIfNeeded() {
  const items = await gearRepo.list();
  if (items.length || prefsStore.get('gearSeeded')) return items;

  const preset = GEAR_PRESETS.day;
  const records = preset.items.map((item, i) => ({
    name: item.name,
    qty: item.qty,
    group: item.group,
    checked: false,
    order: i
  }));
  for (const r of records) await gearRepo.save(r);
  prefsStore.set({ gearSeeded: true });
  return gearRepo.list();
}

export default {
  id: 'gear',
  title: '装备',
  icon: 'backpack',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">装备</h1>
          <p class="page-head__desc">出门前逐项打勾，别把救命的东西留在家里</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="presets" title="套用清单">${icon('layers', 19)}</button>
          <button class="icon-btn" type="button" data-action="add" title="添加装备">${icon('plus', 19)}</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="row row--between" style="margin-bottom:10px">
          <span class="card__title" id="gearSummary">清点中…</span>
          <span class="badge" id="gearPercent">0%</span>
        </div>
        <div class="progress"><div class="progress__bar" id="gearBar" style="width:0%"></div></div>
        <div class="row row--between" style="margin-top:10px">
          <span class="field__hint" id="gearHint">出发前全部打勾</span>
          <button class="btn btn--sm btn--plain" type="button" data-action="reset">取消全部勾选</button>
        </div>
      </div>

      <div id="gearGroups" class="stack" style="gap:14px">
        <div class="skeleton" style="height:180px"></div>
      </div>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    let items = [];

    const render = () => {
      const groups = Object.entries(GEAR_GROUPS);
      const done = items.filter((i) => i.checked).length;
      const percent = pct(done, items.length || 1);

      $('#gearSummary').textContent = `${done} / ${items.length} 已备齐`;
      $('#gearPercent').textContent = `${percent}%`;
      $('#gearBar').style.width = `${percent}%`;
      $('#gearBar').classList.toggle('progress__bar--dawn', percent === 100);
      $('#gearHint').textContent =
        percent === 100 ? '全部备齐，可以出发了' : percent >= 60 ? '快好了，注意救生物品' : '先看生存保障类';

      const host = $('#gearGroups');
      const html = groups
        .map(([key, meta]) => {
          const list = items
            .filter((i) => i.group === key)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          if (!list.length) return '';
          const groupDone = list.filter((i) => i.checked).length;
          return `<div class="card" style="padding:14px 14px 8px">
            <div class="gear-group__head">
              <span class="gear-group__name">${icon(meta.icon, 14)}${meta.name}</span>
              <span class="gear-group__count">${groupDone}/${list.length}</span>
            </div>
            <div class="gear-group">
              ${list
                .map(
                  (item) => `<div class="gear-item ${item.checked ? 'is-done' : ''}" data-check="${item.id}" role="checkbox" aria-checked="${item.checked}" tabindex="0">
                    <span class="gear-check">${icon('check', 12)}</span>
                    <span class="gear-item__name">${escapeHtml(item.name)}</span>
                    ${item.qty > 1 ? `<span class="gear-item__qty">×${item.qty}</span>` : ''}
                    <button class="icon-btn" type="button" data-del="${item.id}" aria-label="删除" style="width:28px;height:28px;opacity:.5">
                      ${icon('trash', 14)}
                    </button>
                  </div>`
                )
                .join('')}
            </div>
          </div>`;
        })
        .join('');

      host.innerHTML =
        html ||
        `<div class="card"><div class="empty">
          ${icon('backpack', 34)}
          <div class="empty__title">清单是空的</div>
          <div class="empty__desc">点右上角套用一份预设清单，或手动添加装备</div>
        </div></div>`;
    };

    const load = async () => {
      items = await seedIfNeeded();
      render();
    };

    const toggle = async (id) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      item.checked = !item.checked;
      await gearRepo.save(item);
      render();
    };

    const applyPreset = (key) => {
      const preset = GEAR_PRESETS[key];
      openSheet({
        title: `套用「${preset.name}」`,
        body: `
          <p class="field__hint" style="margin-bottom:14px">将替换当前清单，共 ${preset.items.length} 项。</p>
          <div class="stack" style="gap:6px">
            ${preset.items.map((i) => `<div class="row" style="gap:8px;font-size:13px">${icon('check', 14)} ${escapeHtml(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ''}</div>`).join('')}
          </div>
          <button class="btn btn--primary btn--block" type="button" id="applyPreset" style="margin-top:18px">替换为这份清单</button>`
      }).el.querySelector('#applyPreset').addEventListener('click', async (e) => {
        await gearRepo.clear();
        for (let i = 0; i < preset.items.length; i++) {
          await gearRepo.save({ ...preset.items[i], order: i, checked: false });
        }
        toastOk(`已套用「${preset.name}」`);
        e.target.closest('.sheet-layer')?.remove();
        await load();
      });
    };

    el.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        const a = action.dataset.action;
        if (a === 'add') {
          formDialog({
            title: '添加装备',
            fields: [
              { name: 'name', label: '名称', required: true, placeholder: '例如：对讲机' },
              { name: 'qty', label: '数量', type: 'number', value: 1, min: 1 },
              {
                name: 'group',
                label: '分类',
                type: 'select',
                value: 'gear',
                options: Object.entries(GEAR_GROUPS).map(([k, v]) => ({ label: v.name, value: k }))
              }
            ],
            submitText: '添加',
            onSubmit: async (data) => {
              await gearRepo.save({ ...data, qty: Number(data.qty) || 1, order: items.length });
              toastOk('已添加');
              await load();
            }
          });
        }
        if (a === 'presets') {
          openSheet({
            title: '预设清单',
            body: `<div class="list">${Object.entries(GEAR_PRESETS)
              .map(
                ([key, p]) => `<button class="list-row" type="button" data-preset="${key}">
                  <span class="list-row__icon">${icon('layers', 18)}</span>
                  <span class="list-row__main">
                    <span class="list-row__title">${p.name}</span>
                    <span class="list-row__sub">${p.items.length} 项</span>
                  </span>
                  <span class="list-row__tail">${icon('chevronRight', 15)}</span>
                </button>`
              )
              .join('')}</div>`
          }).el.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-preset]');
            if (btn) {
              btn.closest('.sheet-layer')?.remove();
              applyPreset(btn.dataset.preset);
            }
          });
        }
        if (a === 'reset') {
          for (const item of items) {
            if (item.checked) await gearRepo.save({ ...item, checked: false });
          }
          toastOk('已取消全部勾选');
          await load();
        }
        return;
      }

      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        await gearRepo.remove(del.dataset.del);
        await load();
        return;
      }

      const check = e.target.closest('[data-check]');
      if (check) toggle(check.dataset.check);
    });

    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const check = e.target.closest('[data-check]');
      if (check) {
        e.preventDefault();
        toggle(check.dataset.check);
      }
    });

    const off = bus.on('gear:change', () => render());
    await load();
    return () => off();
  }
};
