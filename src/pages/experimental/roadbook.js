/** 路书页 */
import { icon } from '../core/icons.js';
import { roadbookRepo, bus, prefsStore } from '../core/store.js';
import { MOUNTAINS } from '../data/mountains.js';
import { formatDate } from '../core/format.js';
import { formDialog, confirmDialog, openSheet } from '../core/modal.js';
import { toastOk } from '../core/toast.js';
import { shareText } from '../services/exporter.js';
import { escapeHtml } from '../core/dom.js';

const TONES = ['moss', 'alt', 'dawn'];
const SEASONS = ['四季', '春', '夏', '秋', '冬', '10 月 — 次年 3 月'];

function stars(n) {
  return `<span class="difficulty">${Array.from({ length: 5 })
    .map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`)
    .join('')}</span>`;
}

async function seedIfEmpty() {
  const list = await roadbookRepo.list();
  if (list.length) return list;
  if (prefsStore.get('roadbookSeeded')) return list;

  const seeds = [
    {
      name: '梧桐山 · 泰山涧登顶线',
      mountain: '梧桐山',
      desc: '溪谷与石阶交替，秋冬清晨可俯瞰云海，是深圳最经典的日出线路。',
      distance: 11.2,
      ascent: 820,
      hours: 5.5,
      difficulty: 3,
      season: '10 月 — 次年 3 月',
      tone: 'moss'
    },
    {
      name: '七娘山 · 海景山脊',
      mountain: '七娘山',
      desc: '三面环海的山脊线，视野极好但无遮阴，建议秋冬清晨出发。',
      distance: 9.6,
      ascent: 760,
      hours: 6,
      difficulty: 4,
      season: '11 月 — 次年 4 月',
      tone: 'alt'
    },
    {
      name: '马峦山 · 瀑布与梅花',
      mountain: '马峦山',
      desc: '路径成熟、补给方便，适合带新人和孩子，雨后瀑布水量最大。',
      distance: 8.4,
      ascent: 420,
      hours: 3.5,
      difficulty: 2,
      season: '四季',
      tone: 'dawn'
    }
  ];

  for (const s of seeds) await roadbookRepo.save(s);
  prefsStore.set({ roadbookSeeded: true });
  return roadbookRepo.list();
}

export default {
  id: 'roadbook',
  title: '路书',
  icon: 'route',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">路书</h1>
          <p class="page-head__desc">把走过的路留下来，分享给同行的人</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--sm btn--primary" type="button" data-action="add">${icon('plus', 15)} 新建</button>
        </div>
      </div>

      <div class="row wrap" style="gap:6px;margin-bottom:16px" id="rbFilters">
        <button class="chip is-active" type="button" data-filter="all">全部</button>
        <button class="chip" type="button" data-filter="1">轻松</button>
        <button class="chip" type="button" data-filter="3">进阶</button>
        <button class="chip" type="button" data-filter="4">挑战</button>
      </div>

      <div class="rb-grid" id="rbList">
        <div class="skeleton" style="height:220px"></div>
        <div class="skeleton" style="height:220px"></div>
      </div>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    let books = [];
    let filter = 'all';

    const render = () => {
      const host = $('#rbList');
      const list = books.filter((b) => {
        if (filter === 'all') return true;
        if (filter === '1') return b.difficulty <= 2;
        if (filter === '3') return b.difficulty === 3;
        return b.difficulty >= 4;
      });

      if (!list.length) {
        host.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty">
          ${icon('route', 34)}
          <div class="empty__title">这个难度下还没有路书</div>
          <div class="empty__desc">点右上角「新建」，把你的路线记下来</div>
        </div></div>`;
        return;
      }

      host.innerHTML = list
        .map(
          (b) => `<button class="rb-card" type="button" data-id="${b.id}">
            <div class="rb-card__cover rb-card__cover--${b.tone || 'moss'}">
              <span class="rb-card__badge badge badge--glass">${escapeHtml(b.season)}</span>
            </div>
            <div class="rb-card__body">
              <div class="rb-card__title">${escapeHtml(b.name)}</div>
              <div class="rb-card__desc">${escapeHtml(b.desc || '暂无描述')}</div>
              <div class="rb-card__foot">
                <span>${icon('route', 12)}${b.distance} km</span>
                <span>${icon('mountain', 12)}${b.ascent} m</span>
                <span>${icon('clock', 12)}${b.hours} h</span>
                <span style="margin-left:auto">${stars(b.difficulty)}</span>
              </div>
            </div>
          </button>`
        )
        .join('');
    };

    const openDetail = (book) => {
      const body = `
        <div class="stat-grid" style="margin-bottom:14px">
          <div class="stat"><div class="stat__label">距离</div><div class="stat__value">${book.distance}<small>km</small></div></div>
          <div class="stat"><div class="stat__label">爬升</div><div class="stat__value">${book.ascent}<small>m</small></div></div>
          <div class="stat"><div class="stat__label">预计用时</div><div class="stat__value">${book.hours}<small>h</small></div></div>
          <div class="stat"><div class="stat__label">难度</div><div class="stat__value" style="padding-top:6px">${stars(book.difficulty)}</div></div>
        </div>
        <p style="font-size:13px;line-height:1.75;color:var(--ink-2)">${escapeHtml(book.desc || '')}</p>
        <div class="kv" style="margin-top:12px"><span class="kv__k">适宜季节</span><span class="kv__v">${escapeHtml(book.season)}</span></div>
        <div class="kv"><span class="kv__k">关联山峰</span><span class="kv__v">${escapeHtml(book.mountain || '—')}</span></div>
        <div class="kv"><span class="kv__k">创建时间</span><span class="kv__v">${formatDate(book.createdAt)}</span></div>
        <div class="row" style="gap:8px;margin-top:16px">
          <button class="btn btn--ghost grow" type="button" data-edit="${book.id}">${icon('edit', 15)} 编辑</button>
          <button class="btn btn--ghost grow" type="button" data-share="${book.id}">${icon('share', 15)} 分享</button>
          <button class="btn btn--ghost" type="button" data-del="${book.id}" style="color:var(--danger)">${icon('trash', 15)}</button>
        </div>`;

      const { el: sheet } = openSheet({ title: book.name, body });

      sheet.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) {
          sheet.closest('.sheet-layer')?.remove();
          openEditor(book);
        }
        const shareBtn = e.target.closest('[data-share]');
        if (shareBtn) {
          const res = await shareText(
            `【${book.name}】${book.distance}km / 爬升 ${book.ascent}m / 约 ${book.hours}h\n${book.desc}\n—— 来自晓山青路书`
          );
          if (res === 'copied') toastOk('已复制到剪贴板');
        }
        const delBtn = e.target.closest('[data-del]');
        if (delBtn) {
          const ok = await confirmDialog({
            title: '删除这份路书？',
            desc: '删除后无法恢复。',
            confirmText: '删除',
            danger: true
          });
          if (ok) {
            await roadbookRepo.remove(book.id);
            sheet.closest('.sheet-layer')?.remove();
            await load();
            toastOk('已删除');
          }
        }
      });
    };

    const openEditor = (book = {}) =>
      formDialog({
        title: book.id ? '编辑路书' : '新建路书',
        fields: [
          { name: 'name', label: '路线名称', value: book.name || '', required: true, placeholder: '例如：梧桐山 · 泰山涧登顶线' },
          {
            name: 'mountain',
            label: '关联山峰',
            type: 'select',
            value: book.mountain || MOUNTAINS[0].name,
            options: MOUNTAINS.map((m) => ({ label: m.name, value: m.name }))
          },
          { name: 'desc', label: '路线描述', type: 'textarea', value: book.desc || '', placeholder: '路况、补给、看点、注意事项…' },
          { name: 'distance', label: '距离（km）', type: 'number', value: book.distance ?? 8, min: 0, step: 0.1 },
          { name: 'ascent', label: '累计爬升（m）', type: 'number', value: book.ascent ?? 400, min: 0 },
          { name: 'hours', label: '预计用时（小时）', type: 'number', value: book.hours ?? 4, min: 0, step: 0.5 },
          {
            name: 'difficulty',
            label: '难度',
            type: 'select',
            value: String(book.difficulty ?? 2),
            options: [1, 2, 3, 4, 5].map((n) => ({ label: `${n} 星`, value: String(n) }))
          },
          {
            name: 'season',
            label: '适宜季节',
            type: 'select',
            value: book.season || '四季',
            options: SEASONS.map((s) => ({ label: s, value: s }))
          },
          {
            name: 'tone',
            label: '封面配色',
            type: 'select',
            value: book.tone || 'moss',
            options: TONES.map((t) => ({ label: { moss: '苔藓绿', alt: '远山蓝', dawn: '破晓金' }[t], value: t }))
          }
        ],
        submitText: '保存',
        onSubmit: async (data) => {
          await roadbookRepo.save({ ...book, ...data, difficulty: Number(data.difficulty) });
          toastOk('已保存');
          await load();
        }
      });

    const load = async () => {
      books = await seedIfEmpty();
      render();
    };

    el.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) {
        filter = filterBtn.dataset.filter;
        el.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === filterBtn));
        render();
        return;
      }
      const addBtn = e.target.closest('[data-action="add"]');
      if (addBtn) {
        openEditor();
        return;
      }
      const card = e.target.closest('[data-id]');
      if (card) {
        const book = books.find((b) => b.id === card.dataset.id);
        if (book) openDetail(book);
      }
    });

    const off = bus.on('roadbook:change', load);
    await load();
    return () => off();
  }
};
