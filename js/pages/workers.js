/* কারিগর ও মজুরি */
Pages.workers = function (root, args) {
  if (args[0] === 'view' && args[1]) return WorkerPages.view(root, args[1]);
  return WorkerPages.list(root);
};

const WorkerPages = {
  editModal(w, onSaved) {
    const x = w || { active: true, rates: { ...DB.s.wages } };
    const garments = Object.entries(CFG.garments).filter(([k]) => k !== 'other');
    UI.modal(w ? 'কারিগরের তথ্য সম্পাদনা' : 'নতুন কারিগর', `
      <div class="form-grid">
        ${UI.input('name', 'নাম', x.name || '', { req: true })}
        ${UI.input('phone', 'মোবাইল', x.phone || '', { type: 'tel' })}
        ${UI.input('skill', 'দক্ষতা', x.skill || '', { ph: 'যেমন: স্যুট, কোট' })}
        ${UI.input('joinDate', 'যোগদানের তারিখ', x.joinDate || U.today(), { type: 'date' })}
        ${UI.select('active', 'অবস্থা', [['1', 'কর্মরত'], ['0', 'কাজ ছেড়ে দিয়েছেন']], x.active === false ? '0' : '1')}
      </div>
      <h4 style="margin-top:14px">প্রতি পিস মজুরি (৳)</h4>
      <div class="m-grid">${garments.map(([k, g]) =>
        `<div class="field"><label>${g.name}</label><input type="text" inputmode="decimal" name="rate_${k}" value="${U.esc(U.bn(x.rates?.[k] ?? DB.s.wages[k] ?? 0))}"></div>`).join('')}</div>`, {
      wide: true,
      onSave: form => {
        const f = UI.formData(form);
        const rates = {};
        for (const [k] of garments) rates[k] = U.num(f['rate_' + k]);
        const obj = { ...x, name: f.name, phone: U.en(f.phone), skill: f.skill, joinDate: f.joinDate, active: f.active === '1', rates };
        DB.upsert('workers', obj);
        UI.toast('কারিগরের তথ্য সংরক্ষিত হয়েছে', 'ok');
        if (onSaved) onSaved(obj);
      }
    });
  },

  payModal(w, onSaved) {
    const bal = Calc.workerBalance(w.id);
    UI.modal(`${w.name} — মজুরি পরিশোধ`, `
      <p>বর্তমান পাওনা: <b class="${bal > 0 ? 'text-red' : ''}">${U.money(bal)}</b></p>
      <div class="form-grid">
        ${UI.input('amount', 'টাকার পরিমাণ (৳)', bal > 0 ? bal : '', { req: true, num: true, bn: true })}
        ${UI.select('method', 'মাধ্যম', CFG.payMethods, 'ক্যাশ')}
        ${UI.input('date', 'তারিখ', U.today(), { type: 'date', req: true })}
        ${UI.input('note', 'নোট', '', { ph: 'যেমন: সাপ্তাহিক, অগ্রিম' })}
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const amount = U.num(f.amount);
        if (amount <= 0) { UI.toast('সঠিক টাকার পরিমাণ লিখুন', 'error'); return false; }
        DB.upsert('workerPayments', { id: U.uid(), workerId: w.id, date: f.date, amount, method: f.method, note: f.note });
        UI.toast('মজুরি পরিশোধ লেখা হয়েছে', 'ok');
        if (onSaved) onSaved();
      }
    });
  },

  list(root) {
    const mk = U.monthKey(U.today());
    const from = U.monthStart(mk), to = U.monthEnd(mk);
    const ws = DB.list('workers').slice().sort((a, b) => (b.active !== false) - (a.active !== false));
    const totalBal = U.sum(ws, w => Math.max(0, Calc.workerBalance(w.id)));
    root.innerHTML = `
      <div class="page-head"><h2>কারিগর</h2><button class="btn btn-gold" id="add-w">+ নতুন কারিগর</button></div>
      <div class="stats">
        <div class="stat blue"><div class="lbl">কর্মরত কারিগর</div><div class="val">${U.count(ws.filter(w => w.active !== false).length)}</div></div>
        <div class="stat green"><div class="lbl">এই মাসে অর্জিত মজুরি</div><div class="val">${U.money(U.sum(ws, w => Calc.workerEarned(w.id, from, to)))}</div></div>
        <div class="stat orange"><div class="lbl">মোট পাওনা (অপরিশোধিত)</div><div class="val">${U.money(totalBal)}</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>নাম</th><th>মোবাইল</th><th>দক্ষতা</th><th class="num">চলমান কাজ (পিস)</th><th class="num">এই মাসে অর্জন</th><th class="num">পাওনা</th><th></th></tr></thead>
        <tbody>${ws.length ? ws.map(w => {
          const jobs = Calc.workerJobs(w.id);
          const pending = U.sum(jobs.filter(j => !j.done), j => j.qty);
          const bal = Calc.workerBalance(w.id);
          return `<tr class="clickable" data-href="#/workers/view/${w.id}">
            <td><b>${U.esc(w.name)}</b>${w.active === false ? ' <span class="badge">প্রাক্তন</span>' : ''}</td>
            <td>${U.t(w.phone || '—')}</td><td class="small">${U.esc(w.skill || '')}</td>
            <td class="num">${U.count(pending)}</td>
            <td class="num">${U.money(Calc.workerEarned(w.id, from, to))}</td>
            <td class="num ${bal > 0 ? 'text-red bold' : ''}">${U.money(bal)}</td>
            <td><button class="btn btn-sm" data-pay="${w.id}">পরিশোধ</button></td></tr>`;
        }).join('') : `<tr><td colspan="7">${UI.empty('কোনো কারিগর যোগ করা হয়নি')}</td></tr>`}</tbody>
      </table></div>
      <p class="small text-muted">অর্ডারের অবস্থা "ডেলিভারির জন্য প্রস্তুত" হলে কারিগরের মজুরি পাওনা হিসেবে যোগ হয়। টেন্ডারের ক্ষেত্রে উৎপাদন লেখার সাথে সাথে যোগ হয়।</p></div>`;
    root.querySelector('#add-w').addEventListener('click', () => WorkerPages.editModal(null, () => App.route()));
    root.addEventListener('click', e => {
      const p = e.target.closest('[data-pay]');
      if (p) { e.stopPropagation(); WorkerPages.payModal(DB.get('workers', p.dataset.pay), () => App.route()); return; }
      const tr = e.target.closest('tr[data-href]');
      if (tr) location.hash = tr.dataset.href;
    });
  },

  view(root, id) {
    const w = DB.get('workers', id);
    if (!w) { root.innerHTML = UI.empty('কারিগর পাওয়া যায়নি'); return; }
    App.setTitle(w.name);
    const jobs = Calc.workerJobs(id);
    const pays = DB.list('workerPayments').filter(p => p.workerId === id).sort((a, b) => b.date.localeCompare(a.date));
    const earned = Calc.workerEarned(id), paid = Calc.workerPaid(id);
    root.innerHTML = `
      <div class="page-head"><div><a class="small" href="#/workers">← সব কারিগর</a><h2>${U.esc(w.name)}</h2>
        <div class="text-muted">${U.esc(w.skill || '')} · ${U.t(w.phone || '')}</div></div>
        <div class="btn-row"><button class="btn btn-green" id="pay">মজুরি পরিশোধ</button><button class="btn" id="edit">সম্পাদনা</button><button class="btn btn-danger" id="del">মুছুন</button></div></div>
      <div class="stats">
        <div class="stat green"><div class="lbl">মোট অর্জিত মজুরি</div><div class="val">${U.money(earned)}</div></div>
        <div class="stat blue"><div class="lbl">মোট পরিশোধিত</div><div class="val">${U.money(paid)}</div></div>
        <div class="stat ${earned - paid > 0 ? 'red' : ''}"><div class="lbl">বর্তমান পাওনা</div><div class="val">${U.money(earned - paid)}</div></div>
        <div class="stat orange"><div class="lbl">চলমান কাজ</div><div class="val">${U.count(U.sum(jobs.filter(j => !j.done), j => j.qty))} পিস</div></div>
      </div>
      <div class="card"><h3>প্রতি পিস মজুরি</h3><div class="m-view">${Object.entries(CFG.garments).filter(([k]) => k !== 'other').map(([k, g]) =>
        `<div>${g.name}<b>${U.money(w.rates?.[k] || 0)}</b></div>`).join('')}</div></div>
      <div class="grid-2">
        <div class="card"><h3>কাজের তালিকা</h3><div class="table-wrap"><table class="tbl small">
          <thead><tr><th>তারিখ</th><th>কাজ</th><th class="num">পিস</th><th class="num">মজুরি</th><th>অবস্থা</th></tr></thead>
          <tbody>${jobs.length ? jobs.map(j => `<tr><td class="nowrap">${U.dateShort(j.date)}</td>
            <td><a href="#/${j.kind === 'order' ? 'orders' : 'tenders'}/view/${j.ref}">${U.esc(U.bn(j.title))}</a><br>${U.esc(j.garment)}</td>
            <td class="num">${U.count(j.qty)}</td><td class="num">${U.money(j.amount)}</td>
            <td>${j.done ? '<span class="badge b-delivered">সম্পন্ন</span>' : '<span class="badge b-sewing">চলমান</span>'}</td></tr>`).join('')
            : `<tr><td colspan="5">${UI.empty('কোনো কাজ নেই')}</td></tr>`}</tbody></table></div></div>
        <div class="card"><h3>পরিশোধের ইতিহাস</h3><div class="table-wrap"><table class="tbl small">
          <thead><tr><th>তারিখ</th><th>মাধ্যম</th><th>নোট</th><th class="num">টাকা</th><th></th></tr></thead>
          <tbody>${pays.length ? pays.map(p => `<tr><td>${U.dateShort(p.date)}</td><td>${U.esc(p.method || '')}</td><td>${U.esc(p.note || '')}</td>
            <td class="num">${U.money(p.amount)}</td><td><button class="btn-icon small" data-delpay="${p.id}">✕</button></td></tr>`).join('')
            : `<tr><td colspan="5">${UI.empty('কোনো পরিশোধ নেই')}</td></tr>`}</tbody></table></div></div>
      </div>`;
    root.querySelector('#pay').addEventListener('click', () => WorkerPages.payModal(w, () => App.route()));
    root.querySelector('#edit').addEventListener('click', () => WorkerPages.editModal(w, () => App.route()));
    root.querySelector('#del').addEventListener('click', async () => {
      if (jobs.length || pays.length) { UI.toast('এই কারিগরের কাজের রেকর্ড আছে। মুছে না ফেলে "কাজ ছেড়ে দিয়েছেন" অবস্থা দিন।', 'error'); return; }
      if (await UI.confirm(`"${U.esc(w.name)}" কে মুছে ফেলবেন?`, 'মুছুন')) { DB.remove('workers', w.id); location.hash = '#/workers'; }
    });
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-delpay]');
      if (b && await UI.confirm('এই পরিশোধের রেকর্ড মুছবেন?', 'মুছুন')) { DB.remove('workerPayments', b.dataset.delpay); App.route(); }
    });
  }
};
