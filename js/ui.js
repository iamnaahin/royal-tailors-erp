/* মডাল, টোস্ট, ফর্ম ও ছোট UI সহায়ক */
const Pages = {};

const UI = {
  toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.getElementById('toast-root').appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 6000 : 3000);
  },

  /**
   * মডাল খোলা। opts: { wide, onSave(form, close) → false হলে বন্ধ হবে না, saveText, onMount(root, close), footer }
   */
  modal(title, bodyHtml, opts = {}) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    const hasSave = typeof opts.onSave === 'function';
    wrap.innerHTML = `
      <div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${U.esc(title)}</h3><button class="btn-icon" data-close aria-label="বন্ধ">✕</button></div>
        <form class="modal-form" novalidate>
          <div class="modal-body">${bodyHtml}</div>
          ${opts.footer === false ? '' : `<div class="modal-foot">
            ${opts.footer || ''}
            <button type="button" class="btn" data-close>${hasSave ? 'বাতিল' : 'বন্ধ করুন'}</button>
            ${hasSave ? `<button type="submit" class="btn btn-primary">${opts.saveText || 'সংরক্ষণ করুন'}</button>` : ''}
          </div>`}
        </form>
      </div>`;
    root.appendChild(wrap);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      wrap.remove();
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    const form = wrap.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!hasSave) return;
      if (!UI.validate(form)) return;
      const r = opts.onSave(form, close);
      if (r !== false) close();
    });
    if (opts.onMount) opts.onMount(wrap, close);
    const first = wrap.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
    return close;
  },

  confirm(msg, okText = 'হ্যাঁ, নিশ্চিত') {
    return new Promise(resolve => {
      let ok = false;
      UI.modal('নিশ্চিত করুন', `<p>${msg}</p>`, {
        saveText: okText,
        onSave: () => { ok = true; },
        onClose: () => resolve(ok)
      });
    });
  },

  /** required ফিল্ড যাচাই */
  validate(form) {
    for (const el of form.querySelectorAll('[required]')) {
      if (!String(el.value).trim()) {
        el.focus();
        const lbl = el.closest('.field')?.querySelector('label')?.textContent?.replace('*', '').trim();
        UI.toast(`${lbl || 'প্রয়োজনীয় ঘর'} পূরণ করুন`, 'error');
        return false;
      }
    }
    return true;
  },

  /** ফর্মের name অনুযায়ী মান */
  formData(form) {
    const out = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value.trim();
    }
    return out;
  },

  /* ---------- HTML সহায়ক ---------- */
  opts(list, selected, placeholder) {
    let h = placeholder !== undefined ? `<option value="">${U.esc(placeholder)}</option>` : '';
    for (const o of list) {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      h += `<option value="${U.esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${U.esc(l)}</option>`;
    }
    return h;
  },
  field(label, inner, cls = '', req = false) {
    return `<div class="field ${cls}"><label>${U.esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>${inner}</div>`;
  },
  input(name, label, value = '', o = {}) {
    const type = o.type || 'text';
    const attrs = [
      `name="${name}"`, `type="${type}"`, `value="${U.esc(o.bn ? U.bn(value) : value)}"`,
      o.req ? 'required' : '', o.ph ? `placeholder="${U.esc(o.ph)}"` : '',
      o.num ? 'inputmode="decimal"' : '', o.attrs || ''
    ].join(' ');
    return UI.field(label, `<input ${attrs}>`, o.cls || '', o.req);
  },
  select(name, label, list, value, o = {}) {
    return UI.field(label, `<select name="${name}" ${o.req ? 'required' : ''} ${o.attrs || ''}>${UI.opts(list, value, o.ph)}</select>`, o.cls || '', o.req);
  },
  textarea(name, label, value = '', o = {}) {
    return UI.field(label, `<textarea name="${name}" ${o.ph ? `placeholder="${U.esc(o.ph)}"` : ''}>${U.esc(value)}</textarea>`, o.cls || 'span-all');
  },
  badge(key, label) { return `<span class="badge b-${U.esc(key)}">${U.esc(label)}</span>`; },
  orderBadge(o) {
    let h = UI.badge(o.status, CFG.statusName('orderStatuses', o.status));
    if (Calc.isOverdue(o)) h += ' ' + UI.badge('overdue', 'বিলম্বিত');
    return h;
  },
  tenderBadge(t) { return UI.badge(t.status, CFG.statusName('tenderStatuses', t.status)); },
  empty(msg) { return `<div class="empty">${U.esc(msg)}</div>`; },
  progress(pct) { return `<div class="progress" title="${U.bn(pct)}%"><span style="width:${pct}%"></span></div>`; },

  /** পেমেন্ট নেওয়ার মডাল */
  paymentModal(title, defAmount, onSave) {
    UI.modal(title, `
      <div class="form-grid">
        ${UI.input('amount', 'টাকার পরিমাণ (৳)', defAmount > 0 ? U.round2(defAmount) : '', { req: true, num: true, bn: true })}
        ${UI.select('method', 'পেমেন্ট মাধ্যম', CFG.payMethods, 'ক্যাশ')}
        ${UI.input('date', 'তারিখ', U.today(), { type: 'date', req: true })}
        ${UI.input('note', 'নোট', '', { ph: 'যেমন: অগ্রিম, বাকি পরিশোধ, ট্রানজেকশন আইডি' })}
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const amount = U.num(f.amount);
        if (amount <= 0) { UI.toast('সঠিক টাকার পরিমাণ লিখুন', 'error'); return false; }
        onSave({ id: U.uid(), date: f.date, amount, method: f.method, note: f.note, by: Auth.user?.name || '' });
      }
    });
  },

  /** বাংলা অঙ্কে টাইপ করা সংখ্যা ইনপুটে রাখা — ইনপুট হারানোর পর বাংলায় দেখাবে */
  bindBnInputs(root) {
    root.addEventListener('focusout', e => {
      const el = e.target;
      if (el.matches && el.matches('input[inputmode=decimal]') && el.value) el.value = U.bn(U.en(el.value));
    });
  }
};
