/** 模态框 / 底部抽屉 / 确认对话 */
import { icon } from './icons.js';
import { escapeHtml } from './dom.js';

const stack = [];

function lockScroll(lock) {
  document.body.style.overflow = lock ? 'hidden' : '';
}

function register(layer, onClose) {
  stack.push({ layer, onClose });
  lockScroll(true);
}

function unregister(layer) {
  const idx = stack.findIndex((s) => s.layer === layer);
  if (idx >= 0) stack.splice(idx, 1);
  if (!stack.length) lockScroll(false);
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !stack.length) return;
  const top = stack[stack.length - 1];
  top.layer.__close?.();
});

/**
 * 通用模态框
 * @returns {{close: Function, el: HTMLElement}}
 */
export function openModal(options = {}) {
  const {
    title = '',
    desc = '',
    body = '',
    actions = [],
    wide = false,
    dismissible = true,
    onMount
  } = options;

  const previousFocus = document.activeElement;
  const layer = document.createElement('div');
  layer.className = 'modal-layer';
  layer.innerHTML = `
    <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true">
      ${title ? `<h3 class="modal__title">${escapeHtml(title)}</h3>` : ''}
      ${desc ? `<p class="modal__desc">${desc}</p>` : ''}
      ${body ? `<div class="modal__body">${body}</div>` : ''}
      ${actions.length ? '<div class="modal__actions"></div>' : ''}
    </div>`;

  const modalEl = layer.querySelector('.modal');
  const actionWrap = layer.querySelector('.modal__actions');

  const close = (result) => {
    layer.remove();
    unregister(layer);
    previousFocus?.focus?.({ preventScroll: true });
    options.onClose?.(result);
  };

  layer.__close = () => {
    if (dismissible) close();
  };

  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${action.variant ? `btn--${action.variant}` : 'btn--ghost'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', async () => {
      if (action.onClick) {
        const keep = await action.onClick({ close, modal: modalEl });
        if (keep === false) return;
      }
      if (action.close !== false) close(action.value);
    });
    actionWrap?.appendChild(btn);
  });

  layer.addEventListener('click', (e) => {
    if (e.target === layer && dismissible) close();
  });

  document.body.appendChild(layer);
  register(layer, close);
  onMount?.(modalEl, close);

  requestAnimationFrame(() => {
    const focusable = modalEl.querySelector('input, textarea, select, button');
    focusable?.focus?.({ preventScroll: true });
  });

  return { close, el: modalEl };
}

/** 确认对话 */
export function confirmDialog(options = {}) {
  const {
    title = '确认操作',
    desc = '',
    confirmText = '确定',
    cancelText = '取消',
    danger = false,
    iconName = danger ? 'alert' : 'info'
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const { close } = openModal({
      title,
      body: desc ? `<p class="modal__desc" style="margin:0">${escapeHtml(desc)}</p>` : '',
      actions: [
        { label: cancelText, variant: 'ghost', onClick: () => done(false) },
        {
          label: confirmText,
          variant: danger ? 'danger' : 'primary',
          onClick: () => done(true)
        }
      ],
      onClose: () => done(false)
    });

    const titleEl = document.querySelector('.modal__title');
    if (titleEl && iconName) {
      titleEl.insertAdjacentHTML('afterbegin', `<span style="color:var(--${danger ? 'danger' : 'moss-500'});margin-right:6px;vertical-align:-2px;display:inline-block">${icon(iconName, 18)}</span>`);
    }
    void close;
  });
}

/** 底部抽屉 */
export function openSheet(options = {}) {
  const { title = '', body = '', onMount, dismissible = true } = options;

  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet__grip"></div>
      ${title ? `<h3 class="sheet__title">${escapeHtml(title)}</h3>` : ''}
      <div class="sheet__body">${body}</div>
    </div>`;

  const sheetEl = layer.querySelector('.sheet');
  const close = () => {
    layer.remove();
    unregister(layer);
  };
  layer.__close = () => {
    if (dismissible) close();
  };

  layer.addEventListener('click', (e) => {
    if (e.target === layer && dismissible) close();
  });

  document.body.appendChild(layer);
  register(layer, close);
  onMount?.(sheetEl, close);
  return { close, el: sheetEl };
}

/** 表单弹窗（返回提交数据或 null） */
export function formDialog(options = {}) {
  const {
    title = '',
    desc = '',
    fields = [],
    submitText = '保存',
    cancelText = '取消',
    onSubmit
  } = options;

  const body = `<div class="stack" style="gap:14px">${fields
    .map(
      (f) => `
    <label class="field">
      <span class="field__label">${escapeHtml(f.label)}</span>
      ${
        f.type === 'textarea'
          ? `<textarea class="textarea" name="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(f.value || '')}</textarea>`
          : f.type === 'select'
            ? `<select class="select" name="${f.name}">${(f.options || [])
                .map(
                  (o) =>
                    `<option value="${escapeHtml(o.value)}" ${o.value === f.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
                )
                .join('')}</select>`
            : `<input class="input" name="${f.name}" type="${f.type || 'text'}" value="${escapeHtml(f.value || '')}" placeholder="${escapeHtml(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} />`
      }
      ${f.hint ? `<span class="field__hint">${escapeHtml(f.hint)}</span>` : ''}
    </label>`
    )
    .join('')}</div>`;

  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const { el } = openModal({
      title,
      desc,
      body,
      actions: [
        { label: cancelText, variant: 'ghost', onClick: () => done(null) },
        {
          label: submitText,
          variant: 'primary',
          onClick: () => {
            const data = {};
            let valid = true;
            fields.forEach((f) => {
              const input = el.querySelector(`[name="${f.name}"]`);
              if (!input) return;
              const val = input.value.trim();
              if (f.required && !val) {
                valid = false;
                input.style.borderColor = 'var(--danger)';
              }
              data[f.name] = f.type === 'number' ? Number(val) : val;
            });
            if (!valid) return false;
            if (onSubmit) onSubmit(data);
            done(data);
          }
        }
      ],
      onClose: () => done(null)
    });
  });
}
