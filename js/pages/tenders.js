/* হোটেল/স্কুল/প্রতিষ্ঠানের টেন্ডার ও বাল্ক অর্ডার */
Pages.tenders = function (root, args) {
  if (args[0] === 'new') return TenderPages.form(root, null);
  if (args[0] === 'edit') return TenderPages.form(root, DB.get('tenders', args[1]));
  if (args[0] === 'view') return TenderPages.view(root, args[1]);
  if (args[0] === 'inst') return TenderPages.instView(root, args[1]);
  return TenderPages.list(root);
};

const TenderPages = {
  instName(id) { return DB.get('institutions', id)?.name || '—'; },
  instTypeName(k) { return CFG.instTypes.find(t => t[0] === k)?.[1] || ''; },

  instModal(inst, onSaved) {
    const x = inst || { type: 'hotel' };
    UI.modal(inst ? 'প্রতিষ্ঠানের তথ্য সম্পাদনা' : 'নতুন প্রতিষ্ঠান (হোটেল/স্কুল)', `
      <div class="form-grid">
        ${UI.input('name', 'প্রতিষ্ঠানের নাম', x.name || '', { req: true, cls: 'span-2' })}
        ${UI.select('type', 'ধরন', CFG.instTypes, x.type)}
        ${UI.input('contact', 'যোগাযোগের ব্যক্তি ও পদবি', x.contact || '', { cls: 'span-2' })}
        ${UI.input('phone', 'মোবাইল', x.phone || '', { type: 'tel' })}
        ${UI.input('address', 'ঠিকানা', x.address || '', { cls: 'span-all' })}
        ${UI.textarea('note', 'নোট', x.note || '')}
      </div>`, {
      onSave: form => {
        const obj = { ...x, ...UI.formData(form) };
        obj.phone = U.en(obj.phone);
        DB.upsert('institutions', obj);
        UI.toast('প্রতিষ্ঠান সংরক্ষিত হয়েছে', 'ok');
        if (onSaved) onSaved(obj);
      }
    });
  },

  /* ------------------------------ তালিকা ------------------------------ */
  list(root) {
    const q = U.query();
    let tab = q.get('tab') || 'tenders';
    let status = '';
    let search = '';

    const drawTenders = () => {
      const list = DB.list('tenders')
        .filter(t => (!status || t.status === status) && U.match(search, t.title, t.ref, TenderPages.instName(t.institutionId)))
        .sort((a, b) => b.no - a.no);
      return `
        <div class="toolbar">
          <input type="text" id="t-search" placeholder="শিরোনাম, প্রতিষ্ঠান বা রেফারেন্স..." value="${U.esc(search)}">
          <select id="t-status">${UI.opts(CFG.tenderStatuses, status, 'সব অবস্থা')}</select>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>নং</th><th>প্রতিষ্ঠান ও শিরোনাম</th><th>জমার শেষ তারিখ</th><th>ডেলিভারির শেষ তারিখ</th><th class="num">চুক্তিমূল্য</th><th>অগ্রগতি</th><th class="num">বকেয়া</th><th>অবস্থা</th></tr></thead>
          <tbody>${list.length ? list.map(t => {
            const pct = Calc.tenderProgress(t);
            const due = Calc.tenderDue(t);
            return `<tr class="clickable" data-href="#/tenders/view/${t.id}">
              <td>#${U.bn(t.no)}</td>
              <td><b>${U.esc(TenderPages.instName(t.institutionId))}</b><br><span class="small">${U.esc(t.title)}</span></td>
              <td class="nowrap">${U.dateShort(t.submissionDate)}</td>
              <td class="nowrap">${U.dateShort(t.deadline)}</td>
              <td class="num">${U.money(Calc.tenderValue(t))}</td>
              <td>${UI.progress(pct)}<span class="small">${U.bn(Calc.tenderDeliveredQty(t))}/${U.bn(Calc.tenderQty(t))} পিস</span></td>
              <td class="num ${due > 0 ? 'text-red' : ''}">${due > 0 ? U.money(due) : '—'}</td>
              <td>${UI.tenderBadge(t)}</td></tr>`;
          }).join('') : `<tr><td colspan="8">${UI.empty('কোনো টেন্ডার নেই')}</td></tr>`}</tbody>
        </table></div>`;
    };

    const drawInst = () => {
      const list = DB.list('institutions').filter(i => U.match(search, i.name, i.contact, i.phone, i.address));
      return `
        <div class="toolbar"><input type="text" id="t-search" placeholder="প্রতিষ্ঠান খুঁজুন..." value="${U.esc(search)}"></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>নাম</th><th>ধরন</th><th>যোগাযোগ</th><th class="num">টেন্ডার</th><th class="num">মোট কাজ (পাওয়া)</th></tr></thead>
          <tbody>${list.length ? list.map(i => {
            const ts = DB.list('tenders').filter(t => t.institutionId === i.id);
            const won = ts.filter(t => ['awarded', 'production', 'completed'].includes(t.status));
            return `<tr class="clickable" data-href="#/tenders/inst/${i.id}">
              <td><b>${U.esc(i.name)}</b><br><span class="small text-muted">${U.esc(i.address || '')}</span></td>
              <td>${U.esc(TenderPages.instTypeName(i.type))}</td>
              <td class="small">${U.esc(i.contact || '')}<br>${U.t(i.phone || '')}</td>
              <td class="num">${U.count(ts.length)}</td>
              <td class="num">${U.money(U.sum(won, t => Calc.tenderValue(t)))}</td></tr>`;
          }).join('') : `<tr><td colspan="5">${UI.empty('কোনো প্রতিষ্ঠান যোগ করা হয়নি')}</td></tr>`}</tbody>
        </table></div>`;
    };

    const draw = () => {
      root.querySelector('#t-tabs').innerHTML = [['tenders', 'টেন্ডার / প্রতিষ্ঠানের অর্ডার'], ['inst', 'হোটেল, স্কুল ও প্রতিষ্ঠান']]
        .map(([k, l]) => `<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('');
      root.querySelector('#t-content').innerHTML = tab === 'tenders' ? drawTenders() : drawInst();
      const s = root.querySelector('#t-search');
      s.addEventListener('input', e => { search = e.target.value; const pos = s.selectionStart; draw(); const n = root.querySelector('#t-search'); n.focus(); n.setSelectionRange(pos, pos); });
      root.querySelector('#t-status')?.addEventListener('change', e => { status = e.target.value; draw(); });
    };

    const T = U.today();
    const all = DB.list('tenders');
    const running = all.filter(t => t.status === 'awarded' || t.status === 'production');
    const pending = all.filter(t => t.status === 'preparing' || t.status === 'submitted');
    const decided = all.filter(t => ['awarded', 'production', 'completed', 'lost'].includes(t.status));
    const won = decided.filter(t => t.status !== 'lost');
    root.innerHTML = `
      <div class="page-head"><h2>টেন্ডার ও প্রতিষ্ঠান</h2>
        <div class="btn-row"><button class="btn" id="add-inst">+ নতুন প্রতিষ্ঠান</button><a class="btn btn-gold" href="#/tenders/new">+ নতুন টেন্ডার</a></div></div>
      <div class="stats">
        <div class="stat blue"><div class="lbl">চলমান কাজ</div><div class="val">${U.count(running.length)}</div><div class="sub">মূল্য ${U.money(U.sum(running, t => Calc.tenderValue(t)))}</div></div>
        <div class="stat gold"><div class="lbl">জমা/প্রস্তুতি পর্যায়ে</div><div class="val">${U.count(pending.length)}</div><div class="sub">${pending.filter(t => t.submissionDate && t.submissionDate >= T).length ? 'নিকটতম জমা: ' + U.date(pending.filter(t => t.submissionDate >= T).sort((a, b) => a.submissionDate.localeCompare(b.submissionDate))[0]?.submissionDate) : '—'}</div></div>
        <div class="stat green"><div class="lbl">সফলতার হার</div><div class="val">${decided.length ? U.bn(Math.round(won.length / decided.length * 100)) + '%' : '—'}</div><div class="sub">${U.bn(won.length)} টি পাওয়া / ${U.bn(decided.length)} টি সিদ্ধান্ত</div></div>
        <div class="stat orange"><div class="lbl">প্রতিষ্ঠানের বকেয়া</div><div class="val">${U.money(U.sum(all, t => Math.max(0, Calc.tenderDue(t))))}</div><div class="sub">ডেলিভারি দেওয়া মালের বিপরীতে</div></div>
      </div>
      <div class="card"><div class="tabs" id="t-tabs"></div><div id="t-content"></div></div>`;
    root.querySelector('#add-inst').addEventListener('click', () => TenderPages.instModal(null, () => { tab = 'inst'; draw(); }));
    root.addEventListener('click', e => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; search = ''; draw(); return; }
      const tr = e.target.closest('tr[data-href]');
      if (tr) location.hash = tr.dataset.href;
    });
    draw();
  },

  /* ------------------------------ ফর্ম ------------------------------ */
  form(root, existing) {
    if (existing === null && location.hash.includes('/edit/')) { root.innerHTML = UI.empty('টেন্ডার পাওয়া যায়নি'); return; }
    const isNew = !existing;
    const q = U.query();
    const t = isNew ? {
      institutionId: q.get('i') || '', title: '', ref: '', publishDate: U.today(), submissionDate: '', deadline: '',
      status: 'preparing', deposit: '', note: '', items: [], staff: [], production: [], deliveries: [], payments: []
    } : JSON.parse(JSON.stringify(existing));
    if (!t.items.length) t.items.push({ id: U.uid(), name: '', garment: 'shirt', spec: '', qty: '', rate: '', wage: '' });

    const instOpts = () => UI.opts(DB.list('institutions').map(i => [i.id, `${i.name} (${TenderPages.instTypeName(i.type)})`]), t.institutionId, '— প্রতিষ্ঠান বেছে নিন —');
    const gOpts = sel => UI.opts(Object.entries(CFG.garments).map(([k, g]) => [k, g.name]), sel);

    root.innerHTML = `
      <div class="page-head"><div><a class="small" href="${isNew ? '#/tenders' : '#/tenders/view/' + t.id}">← ফিরে যান</a>
        <h2>${isNew ? 'নতুন টেন্ডার / প্রতিষ্ঠানের অর্ডার' : `টেন্ডার #${U.bn(t.no)} সম্পাদনা`}</h2></div></div>
      <form id="t-form" novalidate>
        <div class="card">
          <h3>মূল তথ্য</h3>
          <div class="form-grid">
            <div class="field span-2"><label>প্রতিষ্ঠান <span class="req">*</span></label>
              <div class="btn-row" style="flex-wrap:nowrap"><select name="institutionId" id="inst-sel" required>${instOpts()}</select>
              <button type="button" class="btn" id="new-inst">+ নতুন</button></div></div>
            ${UI.input('title', 'শিরোনাম / কাজের বিবরণ', t.title, { req: true, cls: 'span-2', ph: 'যেমন: ওয়েটার ও রিসেপশন স্টাফ ইউনিফর্ম' })}
            ${UI.input('ref', 'টেন্ডার/রেফারেন্স নং', t.ref)}
            ${UI.select('status', 'অবস্থা', CFG.tenderStatuses, t.status)}
            ${UI.input('publishDate', 'প্রকাশ/অনুরোধের তারিখ', t.publishDate, { type: 'date' })}
            ${UI.input('submissionDate', 'জমা দেওয়ার শেষ তারিখ', t.submissionDate, { type: 'date' })}
            ${UI.input('deadline', 'ডেলিভারির শেষ তারিখ', t.deadline, { type: 'date' })}
            ${UI.input('deposit', 'জামানত / সিকিউরিটি মানি (৳)', t.deposit, { num: true, bn: true })}
            ${UI.textarea('note', 'নোট / শর্তাবলি', t.note, { ph: 'যেমন: নমুনা জমা, কিস্তিতে ডেলিভারি, লোগো এমব্রয়ডারি' })}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>পোশাকের তালিকা ও দর</h3><span>চুক্তিমূল্য: <b id="t-total"></b></span></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>পোশাকের নাম</th><th>ধরন</th><th>কাপড়/বিবরণ</th><th class="num">পরিমাণ</th><th class="num">দর (৳/পিস)</th><th class="num">কারিগর মজুরি (৳/পিস)</th><th class="num">মোট</th><th></th></tr></thead>
            <tbody id="t-items"></tbody>
          </table></div>
          <button type="button" class="btn btn-sm" id="add-row" style="margin-top:8px">+ আরেকটি পোশাক</button>
        </div>
        <div class="btn-row" style="justify-content:flex-end;margin-bottom:30px">
          <a class="btn" href="${isNew ? '#/tenders' : '#/tenders/view/' + t.id}">বাতিল</a>
          <button type="submit" class="btn btn-primary">সংরক্ষণ করুন</button>
        </div>
      </form>`;

    const body = root.querySelector('#t-items');
    const drawRows = () => {
      body.innerHTML = t.items.map((it, i) => `<tr data-i="${i}">
        <td><input type="text" data-k="name" value="${U.esc(it.name)}" placeholder="যেমন: ওয়েটার শার্ট"></td>
        <td><select data-k="garment">${gOpts(it.garment)}</select></td>
        <td><input type="text" data-k="spec" value="${U.esc(it.spec || '')}" placeholder="রং, কাপড়, লোগো"></td>
        <td><input type="text" inputmode="decimal" data-k="qty" value="${U.esc(U.bn(it.qty))}" style="width:80px"></td>
        <td><input type="text" inputmode="decimal" data-k="rate" value="${U.esc(U.bn(it.rate))}" style="width:100px"></td>
        <td><input type="text" inputmode="decimal" data-k="wage" value="${U.esc(U.bn(it.wage))}" style="width:100px"></td>
        <td class="num row-total">${U.money(U.num(it.qty) * U.num(it.rate))}</td>
        <td><button type="button" class="btn-icon" data-rm="${i}" title="বাদ দিন">✕</button></td></tr>`).join('');
      calc();
    };
    const calc = () => {
      body.querySelectorAll('tr').forEach(tr => { const it = t.items[tr.dataset.i]; tr.querySelector('.row-total').textContent = U.money(U.num(it.qty) * U.num(it.rate)); });
      root.querySelector('#t-total').textContent = U.money(Calc.tenderValue(t));
    };
    body.addEventListener('input', e => {
      const tr = e.target.closest('tr'); const k = e.target.dataset.k;
      if (!tr || !k) return;
      const it = t.items[tr.dataset.i];
      it[k] = e.target.getAttribute('inputmode') === 'decimal' ? U.en(e.target.value) : e.target.value;
      if (k === 'garment') {
        if (!U.num(it.wage)) it.wage = DB.s.wages[it.garment] || '';
        if (!it.name) it.name = CFG.garmentName(it.garment);
        drawRows(); return;
      }
      calc();
    });
    body.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (!rm) return;
      const it = t.items[rm.dataset.rm];
      if (t.deliveries?.some(d => d.itemId === it.id) || t.production?.some(d => d.itemId === it.id)) {
        UI.toast('এই পোশাকের উৎপাদন/ডেলিভারি রেকর্ড আছে, তাই বাদ দেওয়া যাবে না', 'error'); return;
      }
      t.items.splice(rm.dataset.rm, 1); drawRows();
    });
    root.querySelector('#add-row').addEventListener('click', () => {
      t.items.push({ id: U.uid(), name: '', garment: 'shirt', spec: '', qty: '', rate: '', wage: DB.s.wages.shirt });
      drawRows();
    });
    root.querySelector('#new-inst').addEventListener('click', () => TenderPages.instModal(null, inst => {
      t.institutionId = inst.id; root.querySelector('#inst-sel').innerHTML = instOpts();
    }));

    root.querySelector('#t-form').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target;
      if (!UI.validate(form)) return;
      const f = UI.formData(form);
      const items = t.items.filter(it => it.name.trim() || U.num(it.qty));
      if (!items.length) { UI.toast('অন্তত একটি পোশাক লিখুন', 'error'); return; }
      for (const it of items) {
        if (!it.name.trim()) it.name = CFG.garmentName(it.garment);
        it.qty = U.num(it.qty); it.rate = U.num(it.rate); it.wage = U.num(it.wage);
      }
      Object.assign(t, f, { items, deposit: U.num(f.deposit) });
      if (isNew) { t.id = U.uid(); t.no = DB.nextTenderNo(); t.createdAt = U.today(); }
      DB.upsert('tenders', t);
      UI.toast('টেন্ডার সংরক্ষিত হয়েছে', 'ok');
      location.hash = '#/tenders/view/' + t.id;
    });
    drawRows();
  },

  /* ------------------------------ বিস্তারিত ------------------------------ */
  view(root, id) {
    const t = DB.get('tenders', id);
    if (!t) { root.innerHTML = UI.empty('টেন্ডার পাওয়া যায়নি'); return; }
    ['staff', 'production', 'deliveries', 'payments'].forEach(k => { t[k] = t[k] || []; });
    const inst = DB.get('institutions', t.institutionId) || { name: '—' };
    App.setTitle(`টেন্ডার #${U.bn(t.no)}`);
    const save = (msg) => { DB.upsert('tenders', t); if (msg) UI.toast(msg, 'ok'); App.route(); };
    const itemName = iid => t.items.find(i => i.id === iid)?.name || '—';
    const value = Calc.tenderValue(t);
    const dv = Calc.tenderDeliveredValue(t);
    const paid = Calc.tenderPaid(t);
    const itemOpts = sel => UI.opts(t.items.map(i => [i.id, i.name]), sel);

    root.innerHTML = `
      <div class="page-head">
        <div><a class="small" href="#/tenders">← সব টেন্ডার</a>
          <h2>${U.esc(t.title)} ${UI.tenderBadge(t)}</h2>
          <div class="text-muted">টেন্ডার #${U.bn(t.no)} · <a href="#/tenders/inst/${t.institutionId}">${U.esc(inst.name)}</a></div></div>
        <div class="btn-row">
          <select id="t-st" style="width:auto">${UI.opts(CFG.tenderStatuses, t.status)}</select>
          <button class="btn" data-act="quote">🖨 দরপত্র/কোটেশন</button>
          <button class="btn" data-act="bill">🖨 বিল</button>
          <a class="btn" href="#/tenders/edit/${t.id}">সম্পাদনা</a>
          <button class="btn btn-danger" data-act="del">মুছুন</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>তথ্য</h3>
          <dl class="info-list">
            <dt>প্রতিষ্ঠান</dt><dd>${U.esc(inst.name)} <span class="small text-muted">(${U.esc(TenderPages.instTypeName(inst.type))})</span></dd>
            <dt>যোগাযোগ</dt><dd>${U.esc(inst.contact || '—')} ${inst.phone ? '· ' + U.t(inst.phone) : ''}</dd>
            <dt>রেফারেন্স নং</dt><dd>${U.t(t.ref || '—')}</dd>
            <dt>প্রকাশের তারিখ</dt><dd>${U.date(t.publishDate)}</dd>
            <dt>জমার শেষ তারিখ</dt><dd>${U.date(t.submissionDate)}</dd>
            <dt>ডেলিভারির শেষ তারিখ</dt><dd class="${t.deadline && t.deadline < U.today() && !['completed', 'lost', 'cancelled'].includes(t.status) ? 'text-red' : ''}">${U.date(t.deadline)} ${t.deadline && ['awarded', 'production'].includes(t.status) ? '(' + U.esc(U.relDay(t.deadline)) + ')' : ''}</dd>
            <dt>জামানত</dt><dd>${U.num(t.deposit) ? U.money(t.deposit) : '—'}</dd>
            ${t.note ? `<dt>নোট</dt><dd>${U.esc(t.note)}</dd>` : ''}
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3>আর্থিক সারাংশ</h3><button class="btn btn-sm btn-green" data-act="pay">+ পেমেন্ট গ্রহণ</button></div>
          <div class="summary-box">
            <div class="row"><span>মোট চুক্তিমূল্য (${U.bn(Calc.tenderQty(t))} পিস)</span><b>${U.money(value)}</b></div>
            <div class="row"><span>ডেলিভারি দেওয়া মালের মূল্য</span><span>${U.money(dv)}</span></div>
            <div class="row"><span>প্রাপ্ত টাকা</span><span class="text-green">${U.money(paid)}</span></div>
            <div class="row total"><span>বকেয়া (ডেলিভারি অনুযায়ী)</span><span class="${dv - paid > 0 ? 'text-red' : 'text-green'}">${U.money(dv - paid)}</span></div>
            <div class="row"><span>চুক্তি অনুযায়ী মোট বাকি</span><span>${U.money(value - paid)}</span></div>
          </div>
          <div style="margin-top:10px">${UI.progress(Calc.tenderProgress(t))}<span class="small">ডেলিভারি সম্পন্ন: ${U.bn(Calc.tenderProgress(t))}%</span></div>
        </div>
      </div>

      <div class="card">
        <h3>পোশাক ও অগ্রগতি</h3>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>পোশাক</th><th>বিবরণ</th><th class="num">পরিমাণ</th><th class="num">দর</th><th class="num">মোট</th><th class="num">তৈরি হয়েছে</th><th class="num">ডেলিভারি</th><th>অগ্রগতি</th></tr></thead>
          <tbody>${t.items.map(it => {
            const pr = Calc.produced(t, it.id), dl = Calc.delivered(t, it.id);
            return `<tr><td><b>${U.esc(it.name)}</b><br><span class="small text-muted">${U.esc(CFG.garmentName(it.garment))}</span></td>
              <td class="small">${U.esc(it.spec || '')}</td><td class="num">${U.count(it.qty)}</td><td class="num">${U.money(it.rate)}</td>
              <td class="num">${U.money(U.num(it.qty) * U.num(it.rate))}</td><td class="num">${U.count(pr)}</td><td class="num">${U.count(dl)}</td>
              <td>${UI.progress(it.qty ? Math.min(100, Math.round(dl / it.qty * 100)) : 0)}</td></tr>`;
          }).join('')}</tbody>
          <tfoot><tr><td colspan="2">মোট</td><td class="num">${U.count(Calc.tenderQty(t))}</td><td></td><td class="num">${U.money(value)}</td>
            <td class="num">${U.count(U.sum(t.production, p => p.qty))}</td><td class="num">${U.count(Calc.tenderDeliveredQty(t))}</td><td></td></tr></tfoot>
        </table></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>কর্মীদের মাপ তালিকা (${U.bn(t.staff.length)} জন)</h3>
          <div class="btn-row"><button class="btn btn-sm" data-act="staff-add">+ একজন যোগ</button><button class="btn btn-sm" data-act="staff-bulk">একসাথে অনেকজন যোগ</button><button class="btn btn-sm" data-act="staff-print">🖨 প্রিন্ট</button></div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>#</th><th>নাম</th><th>পদবি</th><th>মাপ / সাইজ</th><th>নোট</th><th></th></tr></thead>
          <tbody>${t.staff.length ? t.staff.map((s, i) => `<tr><td>${U.bn(i + 1)}</td><td>${U.esc(s.name)}</td><td>${U.esc(s.designation || '')}</td>
            <td>${U.t(s.sizes || '')}</td><td class="small">${U.esc(s.note || '')}</td>
            <td class="nowrap"><button class="btn-icon small" data-staff-edit="${s.id}" title="সম্পাদনা">✎</button><button class="btn-icon small" data-staff-del="${s.id}" title="মুছুন">✕</button></td></tr>`).join('')
            : `<tr><td colspan="6">${UI.empty('প্রতিষ্ঠানের কর্মীদের নাম ও মাপ এখানে রাখুন')}</td></tr>`}</tbody>
        </table></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-head"><h3>উৎপাদন (কারিগরের কাজ)</h3><button class="btn btn-sm" data-act="prod">+ উৎপাদন লিখুন</button></div>
          <div class="table-wrap"><table class="tbl small">
            <thead><tr><th>তারিখ</th><th>পোশাক</th><th>কারিগর</th><th class="num">পিস</th><th class="num">মজুরি</th><th></th></tr></thead>
            <tbody>${t.production.length ? t.production.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => `<tr><td class="nowrap">${U.dateShort(p.date)}</td><td>${U.esc(itemName(p.itemId))}</td>
              <td>${U.esc(DB.get('workers', p.workerId)?.name || '—')}</td><td class="num">${U.count(p.qty)}</td><td class="num">${U.money(U.num(p.qty) * U.num(p.wage))}</td>
              <td><button class="btn-icon small" data-del="production:${p.id}">✕</button></td></tr>`).join('') : `<tr><td colspan="6">${UI.empty('কোনো উৎপাদন রেকর্ড নেই')}</td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>ডেলিভারি (চালান)</h3><button class="btn btn-sm" data-act="deliv">+ ডেলিভারি লিখুন</button></div>
          <div class="table-wrap"><table class="tbl small">
            <thead><tr><th>তারিখ</th><th>পোশাক</th><th class="num">পিস</th><th>নোট</th><th></th></tr></thead>
            <tbody>${t.deliveries.length ? t.deliveries.slice().sort((a, b) => b.date.localeCompare(a.date)).map(d => `<tr><td class="nowrap">${U.dateShort(d.date)}</td><td>${U.esc(itemName(d.itemId))}</td>
              <td class="num">${U.count(d.qty)}</td><td>${U.esc(d.note || '')}</td>
              <td class="nowrap"><button class="btn-icon small" data-challan="${d.date}" title="এই তারিখের চালান প্রিন্ট">🖨</button><button class="btn-icon small" data-del="deliveries:${d.id}">✕</button></td></tr>`).join('') : `<tr><td colspan="5">${UI.empty('কোনো ডেলিভারি হয়নি')}</td></tr>`}</tbody>
          </table></div>
        </div>
      </div>

      <div class="card">
        <h3>প্রাপ্ত পেমেন্ট</h3>
        <div class="table-wrap"><table class="tbl small">
          <thead><tr><th>তারিখ</th><th>মাধ্যম</th><th>নোট</th><th class="num">টাকা</th><th></th></tr></thead>
          <tbody>${t.payments.length ? t.payments.map(p => `<tr><td>${U.dateShort(p.date)}</td><td>${U.esc(p.method)}</td><td>${U.esc(p.note || '')}</td><td class="num">${U.money(p.amount)}</td>
            <td><button class="btn-icon small" data-del="payments:${p.id}">✕</button></td></tr>`).join('') : `<tr><td colspan="5">${UI.empty('এখনো কোনো পেমেন্ট পাওয়া যায়নি')}</td></tr>`}</tbody>
        </table></div>
      </div>`;

    root.querySelector('#t-st').addEventListener('change', e => { t.status = e.target.value; save('অবস্থা হালনাগাদ হয়েছে'); });

    const staffModal = s => {
      const x = s || {};
      UI.modal(s ? 'কর্মীর তথ্য সম্পাদনা' : 'কর্মী যোগ করুন', `
        <div class="form-grid">
          ${UI.input('name', 'নাম', x.name || '', { req: true })}
          ${UI.input('designation', 'পদবি', x.designation || '', { ph: 'যেমন: ওয়েটার, শেফ, গার্ড' })}
          ${UI.input('sizes', 'মাপ / সাইজ', x.sizes || '', { cls: 'span-all', ph: 'যেমন: শার্ট বুক ৪০ লম্বা ৩০, প্যান্ট কোমর ৩৪ লম্বা ৪০' })}
          ${UI.input('note', 'নোট', x.note || '', { cls: 'span-all' })}
        </div>`, {
        onSave: form => {
          const f = UI.formData(form);
          if (s) Object.assign(s, f); else t.staff.push({ id: U.uid(), ...f });
          save('কর্মীর তথ্য সংরক্ষিত হয়েছে');
        }
      });
    };

    root.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.staffEdit) return staffModal(t.staff.find(s => s.id === b.dataset.staffEdit));
      if (b.dataset.staffDel) {
        if (await UI.confirm('এই কর্মীকে তালিকা থেকে মুছবেন?', 'মুছুন')) { t.staff = t.staff.filter(s => s.id !== b.dataset.staffDel); save(); }
        return;
      }
      if (b.dataset.del) {
        const [coll, rid] = b.dataset.del.split(':');
        if (await UI.confirm('এই রেকর্ডটি মুছে ফেলবেন?', 'মুছুন')) { t[coll] = t[coll].filter(x => x.id !== rid); save('মুছে ফেলা হয়েছে'); }
        return;
      }
      if (b.dataset.challan) return Print.challan(t, b.dataset.challan);
      switch (b.dataset.act) {
        case 'pay':
          UI.paymentModal(`টেন্ডার #${U.bn(t.no)} — পেমেন্ট গ্রহণ`, Math.max(0, dv - paid), p => { t.payments.push(p); save('পেমেন্ট যোগ হয়েছে'); });
          break;
        case 'staff-add': staffModal(null); break;
        case 'staff-bulk':
          UI.modal('একসাথে অনেক কর্মী যোগ', `
            <p class="small text-muted">প্রতি লাইনে একজন: <b>নাম, পদবি, মাপ</b> (কমা দিয়ে আলাদা)। যেমন:<br>
            মোঃ সোহেল, ওয়েটার, শার্ট M প্যান্ট কোমর ৩২<br>রুবেল দাশ, শেফ, শেফ কোট L</p>
            <textarea name="bulk" style="min-height:200px" required></textarea>`, {
            wide: true, saveText: 'যোগ করুন',
            onSave: form => {
              const lines = UI.formData(form).bulk.split('\n').map(l => l.trim()).filter(Boolean);
              for (const l of lines) {
                const [name, designation = '', ...rest] = l.split(/[,،]/).map(x => x.trim());
                if (name) t.staff.push({ id: U.uid(), name, designation, sizes: rest.join(', '), note: '' });
              }
              save(`${U.bn(lines.length)} জন কর্মী যোগ হয়েছে`);
            }
          });
          break;
        case 'staff-print': Print.staffList(t); break;
        case 'prod': {
          const ws = DB.list('workers').filter(w => w.active !== false);
          if (!ws.length) { UI.toast('আগে কারিগর যোগ করুন', 'error'); return; }
          UI.modal('উৎপাদন লিখুন', `
            <div class="form-grid">
              ${UI.input('date', 'তারিখ', U.today(), { type: 'date', req: true })}
              ${UI.select('itemId', 'পোশাক', t.items.map(i => [i.id, `${i.name} (বাকি ${U.bn(Math.max(0, i.qty - Calc.produced(t, i.id)))})`]), '', { req: true })}
              ${UI.select('workerId', 'কারিগর', ws.map(w => [w.id, w.name]), '', { req: true })}
              ${UI.input('qty', 'কত পিস তৈরি হয়েছে', '', { num: true, req: true })}
              ${UI.input('wage', 'মজুরি (প্রতি পিস ৳)', '', { num: true, bn: true })}
            </div>`, {
            onMount: (m) => {
              const setWage = () => {
                const it = t.items.find(i => i.id === m.querySelector('[name=itemId]').value);
                const w = DB.get('workers', m.querySelector('[name=workerId]').value);
                const wage = U.num(it?.wage) || U.num(w?.rates?.[it?.garment]) || 0;
                m.querySelector('[name=wage]').value = U.bn(wage);
              };
              m.querySelector('[name=itemId]').addEventListener('change', setWage);
              m.querySelector('[name=workerId]').addEventListener('change', setWage);
              setWage();
            },
            onSave: form => {
              const f = UI.formData(form);
              if (U.num(f.qty) <= 0) { UI.toast('সঠিক পরিমাণ লিখুন', 'error'); return false; }
              t.production.push({ id: U.uid(), date: f.date, itemId: f.itemId, workerId: f.workerId, qty: U.num(f.qty), wage: U.num(f.wage) });
              save('উৎপাদন রেকর্ড যোগ হয়েছে');
            }
          });
          break;
        }
        case 'deliv':
          UI.modal('ডেলিভারি লিখুন', `
            <div class="form-grid">
              ${UI.input('date', 'তারিখ', U.today(), { type: 'date', req: true })}
              ${UI.select('itemId', 'পোশাক', t.items.map(i => [i.id, `${i.name} (বাকি ${U.bn(Math.max(0, i.qty - Calc.delivered(t, i.id)))})`]), '', { req: true })}
              ${UI.input('qty', 'কত পিস', '', { num: true, req: true })}
              ${UI.input('note', 'নোট', '', { ph: 'যেমন: প্রথম কিস্তি, চালান নং' })}
            </div>`, {
            onSave: form => {
              const f = UI.formData(form);
              const it = t.items.find(i => i.id === f.itemId);
              const qty = U.num(f.qty);
              if (qty <= 0) { UI.toast('সঠিক পরিমাণ লিখুন', 'error'); return false; }
              if (Calc.delivered(t, it.id) + qty > it.qty && !confirm('চুক্তির চেয়ে বেশি পিস ডেলিভারি হচ্ছে। তবুও লিখবেন?')) return false;
              t.deliveries.push({ id: U.uid(), date: f.date, itemId: f.itemId, qty, note: f.note });
              if (t.status === 'awarded') t.status = 'production';
              if (Calc.tenderDeliveredQty(t) >= Calc.tenderQty(t)) UI.toast('সব পোশাক ডেলিভারি হয়েছে — অবস্থা "সম্পন্ন" করতে পারেন');
              save('ডেলিভারি যোগ হয়েছে');
            }
          });
          break;
        case 'quote': Print.quotation(t); break;
        case 'bill': Print.tenderBill(t); break;
        case 'del':
          if (await UI.confirm(`টেন্ডার "${U.esc(t.title)}" সম্পূর্ণ মুছে ফেলবেন? এর উৎপাদন, ডেলিভারি ও পেমেন্টের হিসাবও মুছে যাবে।`, 'মুছুন')) {
            DB.remove('tenders', t.id);
            UI.toast('টেন্ডার মুছে ফেলা হয়েছে');
            location.hash = '#/tenders';
          }
          break;
      }
    });
  },

  /* ------------------------------ প্রতিষ্ঠান ------------------------------ */
  instView(root, id) {
    const i = DB.get('institutions', id);
    if (!i) { root.innerHTML = UI.empty('প্রতিষ্ঠান পাওয়া যায়নি'); return; }
    App.setTitle(i.name);
    const ts = DB.list('tenders').filter(t => t.institutionId === id).sort((a, b) => b.no - a.no);
    root.innerHTML = `
      <div class="page-head"><div><a class="small" href="#/tenders?tab=inst">← সব প্রতিষ্ঠান</a><h2>${U.esc(i.name)}</h2>
        <div class="text-muted">${U.esc(TenderPages.instTypeName(i.type))}</div></div>
        <div class="btn-row"><a class="btn btn-gold" href="#/tenders/new?i=${i.id}">+ নতুন টেন্ডার</a>
          ${i.phone ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${U.waPhone(i.phone)}">WhatsApp</a>` : ''}
          <button class="btn" id="edit-i">সম্পাদনা</button><button class="btn btn-danger" id="del-i">মুছুন</button></div></div>
      <div class="card"><dl class="info-list">
        <dt>যোগাযোগ</dt><dd>${U.esc(i.contact || '—')}</dd><dt>মোবাইল</dt><dd>${U.t(i.phone || '—')}</dd>
        <dt>ঠিকানা</dt><dd>${U.esc(i.address || '—')}</dd>${i.note ? `<dt>নোট</dt><dd>${U.esc(i.note)}</dd>` : ''}
        <dt>মোট বকেয়া</dt><dd class="text-red">${U.money(U.sum(ts, t => Math.max(0, Calc.tenderDue(t))))}</dd>
      </dl></div>
      <div class="card"><h3>টেন্ডার ও অর্ডার</h3><div class="table-wrap"><table class="tbl">
        <thead><tr><th>নং</th><th>শিরোনাম</th><th>তারিখ</th><th class="num">মূল্য</th><th class="num">বকেয়া</th><th>অবস্থা</th></tr></thead>
        <tbody>${ts.length ? ts.map(t => `<tr class="clickable" data-href="#/tenders/view/${t.id}"><td>#${U.bn(t.no)}</td><td>${U.esc(t.title)}</td><td>${U.dateShort(t.publishDate)}</td>
          <td class="num">${U.money(Calc.tenderValue(t))}</td><td class="num">${U.money(Math.max(0, Calc.tenderDue(t)))}</td><td>${UI.tenderBadge(t)}</td></tr>`).join('')
          : `<tr><td colspan="6">${UI.empty('এই প্রতিষ্ঠানের কোনো টেন্ডার নেই')}</td></tr>`}</tbody></table></div></div>`;
    root.querySelector('#edit-i').addEventListener('click', () => TenderPages.instModal(i, () => App.route()));
    root.querySelector('#del-i').addEventListener('click', async () => {
      if (ts.length) { UI.toast('এই প্রতিষ্ঠানের টেন্ডার আছে, তাই মোছা যাবে না', 'error'); return; }
      if (await UI.confirm(`"${U.esc(i.name)}" মুছে ফেলবেন?`, 'মুছুন')) { DB.remove('institutions', i.id); location.hash = '#/tenders?tab=inst'; }
    });
    root.addEventListener('click', e => { const tr = e.target.closest('tr[data-href]'); if (tr) location.hash = tr.dataset.href; });
  }
};
