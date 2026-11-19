/* আয়-ব্যয়ের হিসাব */
const AccountPages = {
  expenseModal(exp, onSaved) {
    const x = exp || { date: U.today(), method: 'ক্যাশ', category: CFG.expenseCats[0] };
    UI.modal(exp ? 'খরচ সম্পাদনা' : 'নতুন খরচ', `
      <div class="form-grid">
        ${UI.select('category', 'খাত', CFG.expenseCats, x.category)}
        ${UI.input('amount', 'টাকার পরিমাণ (৳)', x.amount ?? '', { req: true, num: true, bn: true })}
        ${UI.select('method', 'মাধ্যম', CFG.payMethods, x.method)}
        ${UI.input('date', 'তারিখ', x.date, { type: 'date', req: true })}
        ${UI.input('note', 'বিবরণ', x.note || '', { cls: 'span-all' })}
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const amount = U.num(f.amount);
        if (amount <= 0) { UI.toast('সঠিক টাকার পরিমাণ লিখুন', 'error'); return false; }
        DB.upsert('expenses', { ...x, ...f, amount });
        UI.toast('খরচ সংরক্ষিত হয়েছে', 'ok');
        if (onSaved) onSaved();
      }
    });
  }
};

Pages.accounts = function (root) {
  const q = U.query();
  let month = U.monthKey(U.today());
  let dir = '';

  const draw = () => {
    const from = U.monthStart(month), to = U.monthEnd(month);
    const rows = Calc.ledger(from, to);
    const inc = U.sum(rows.filter(r => r.dir === 'in'), r => r.amount);
    const exp = U.sum(rows.filter(r => r.dir === 'out'), r => r.amount);
    const byMethod = CFG.payMethods.map(m => {
      const i = U.sum(rows.filter(r => r.dir === 'in' && r.method === m), r => r.amount);
      const o = U.sum(rows.filter(r => r.dir === 'out' && r.method === m), r => r.amount);
      return { m, i, o };
    }).filter(x => x.i || x.o);
    const cats = {};
    rows.filter(r => r.dir === 'out').forEach(r => { cats[r.cat] = (cats[r.cat] || 0) + r.amount; });
    const shown = rows.filter(r => !dir || r.dir === dir);

    root.querySelector('#acc-content').innerHTML = `
      <div class="stats">
        <div class="stat green"><div class="lbl">মোট আয়</div><div class="val">${U.money(inc)}</div><div class="sub">${U.monthName(month)}</div></div>
        <div class="stat red"><div class="lbl">মোট ব্যয়</div><div class="val">${U.money(exp)}</div></div>
        <div class="stat ${inc - exp >= 0 ? 'blue' : 'red'}"><div class="lbl">নিট (আয় − ব্যয়)</div><div class="val">${U.money(inc - exp)}</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>মাধ্যম অনুযায়ী</h3>
          ${byMethod.length ? `<table class="tbl"><thead><tr><th>মাধ্যম</th><th class="num">আয়</th><th class="num">ব্যয়</th><th class="num">নিট</th></tr></thead>
          <tbody>${byMethod.map(x => `<tr><td>${x.m}</td><td class="num">${U.money(x.i)}</td><td class="num">${U.money(x.o)}</td><td class="num bold">${U.money(x.i - x.o)}</td></tr>`).join('')}</tbody></table>` : UI.empty('কোনো লেনদেন নেই')}
        </div>
        <div class="card"><h3>ব্যয়ের খাত</h3>
          ${Object.keys(cats).length ? Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) =>
            `<div class="bar-row"><span class="small">${U.esc(c)}</span><div class="bar"><span style="width:${Math.round(v / exp * 100)}%"></span></div><span class="small num">${U.money(v)}</span></div>`).join('') : UI.empty('কোনো ব্যয় নেই')}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>লেনদেনের খতিয়ান</h3>
          <div class="tabs" style="margin:0">${[['', 'সব'], ['in', 'আয়'], ['out', 'ব্যয়']].map(([k, l]) => `<button class="${dir === k ? 'active' : ''}" data-dir="${k}">${l}</button>`).join('')}</div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>তারিখ</th><th>বিবরণ</th><th>খাত</th><th>মাধ্যম</th><th class="num">আয়</th><th class="num">ব্যয়</th><th></th></tr></thead>
          <tbody>${shown.length ? shown.map(r => `<tr>
            <td class="nowrap">${U.dateShort(r.date)}</td>
            <td>${r.link ? `<a href="${r.link}">${U.esc(r.desc)}</a>` : U.esc(r.desc)}</td>
            <td class="small">${U.esc(r.cat)}</td><td class="small">${U.esc(r.method || '')}</td>
            <td class="num text-green">${r.dir === 'in' ? U.money(r.amount) : ''}</td>
            <td class="num text-red">${r.dir === 'out' ? U.money(r.amount) : ''}</td>
            <td class="nowrap">${r.expenseId && !r.linked ? `<button class="btn-icon small" data-edit="${r.expenseId}">✎</button><button class="btn-icon small" data-del="${r.expenseId}">✕</button>` : ''}</td></tr>`).join('')
            : `<tr><td colspan="7">${UI.empty('এই মাসে কোনো লেনদেন নেই')}</td></tr>`}</tbody>
          ${shown.length ? `<tfoot><tr><td colspan="4">মোট</td><td class="num">${U.money(U.sum(shown.filter(r => r.dir === 'in'), r => r.amount))}</td><td class="num">${U.money(U.sum(shown.filter(r => r.dir === 'out'), r => r.amount))}</td><td></td></tr></tfoot>` : ''}
        </table></div>
      </div>`;
  };

  root.innerHTML = `
    <div class="page-head"><h2>হিসাব</h2>
      <div class="btn-row"><input type="month" id="acc-month" value="${month}" style="width:auto"><button class="btn btn-gold" id="add-exp">+ খরচ লিখুন</button></div></div>
    <div id="acc-content"></div>
    <p class="small text-muted">অর্ডার ও টেন্ডারের পেমেন্ট, কারিগরের মজুরি এবং কাপড় ক্রয় স্বয়ংক্রিয়ভাবে এই হিসাবে যোগ হয়। দোকান ভাড়া, বিদ্যুৎ বিলের মতো খরচ "খরচ লিখুন" থেকে যোগ করুন।</p>`;
  root.querySelector('#acc-month').addEventListener('change', e => { if (e.target.value) { month = e.target.value; draw(); } });
  root.querySelector('#add-exp').addEventListener('click', () => AccountPages.expenseModal(null, draw));
  root.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dir !== undefined) { dir = b.dataset.dir; draw(); }
    else if (b.dataset.edit) AccountPages.expenseModal(DB.get('expenses', b.dataset.edit), draw);
    else if (b.dataset.del && await UI.confirm('এই খরচটি মুছে ফেলবেন?', 'মুছুন')) { DB.remove('expenses', b.dataset.del); draw(); }
  });
  draw();
  if (q.get('expense')) AccountPages.expenseModal(null, draw);
};
