/* অর্ডার: তালিকা, নতুন/সম্পাদনা, বিস্তারিত */
Pages.orders = function (root, args) {
  if (args[0] === 'new') return OrderPages.form(root, null);
  if (args[0] === 'edit') return OrderPages.form(root, DB.get('orders', args[1]));
  if (args[0] === 'view') return OrderPages.view(root, args[1]);
  return OrderPages.list(root);
};

const OrderPages = {
  custLabel(c) { return `${c.name}${c.phone ? ' (' + U.bn(c.phone) + ')' : ''}`; },

  /* ------------------------------ তালিকা ------------------------------ */
  list(root) {
    const q = U.query();
    const T = U.today();
    const filters = [
      ['active', 'চলমান', o => Calc.isActive(o)],
      ['today', 'আজ ডেলিভারি', o => Calc.isActive(o) && o.deliveryDate === T],
      ['overdue', 'বিলম্বিত', o => Calc.isOverdue(o)],
      ['ready', 'প্রস্তুত', o => o.status === 'ready'],
      ['due', 'বকেয়া আছে', o => Calc.orderDue(o) > 0],
      ['delivered', 'ডেলিভারি সম্পন্ন', o => o.status === 'delivered'],
      ['cancelled', 'বাতিল', o => o.status === 'cancelled'],
      ['all', 'সব', () => true]
    ];
    let f = q.get('f') || (q.get('s') ? 'all' : 'active');
    let status = q.get('s') || '';
    let search = '';
    const custName = id => DB.get('customers', id)?.name || '—';
    const custPhone = id => DB.get('customers', id)?.phone || '';

    const draw = () => {
      const all = DB.list('orders');
      root.querySelector('#o-tabs').innerHTML = filters.map(([k, l, fn]) =>
        `<button class="${k === f ? 'active' : ''}" data-f="${k}">${l}<span class="cnt">${U.bn(all.filter(fn).length)}</span></button>`).join('');
      const fn = filters.find(x => x[0] === f)[2];
      const list = all.filter(o => fn(o) && (!status || o.status === status) &&
        U.match(search, o.no, custName(o.customerId), custPhone(o.customerId), Calc.orderSummary(o)))
        .sort((a, b) => Calc.isActive(a) && Calc.isActive(b)
          ? (a.deliveryDate || '').localeCompare(b.deliveryDate || '')
          : (b.date || '').localeCompare(a.date || '') || b.no - a.no);
      root.querySelector('#o-body').innerHTML = list.length ? list.map(o => {
        const due = Calc.orderDue(o);
        const late = Calc.isOverdue(o);
        return `<tr class="clickable" data-href="#/orders/view/${o.id}">
          <td class="bold">#${U.bn(o.no)}</td>
          <td>${U.esc(custName(o.customerId))}<br><span class="small text-muted">${U.t(custPhone(o.customerId))}</span></td>
          <td>${U.esc(Calc.orderSummary(o))}</td>
          <td class="nowrap">${U.dateShort(o.date)}</td>
          <td class="nowrap ${late ? 'text-red bold' : ''}">${U.dateShort(o.deliveryDate)}${Calc.isActive(o) ? `<br><span class="small">${U.esc(U.relDay(o.deliveryDate))}</span>` : ''}</td>
          <td class="num">${U.money(Calc.orderTotal(o))}</td>
          <td class="num ${due > 0 ? 'text-red bold' : ''}">${due > 0 ? U.money(due) : '—'}</td>
          <td>${UI.orderBadge(o)}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="8">${UI.empty('এই তালিকায় কোনো অর্ডার নেই')}</td></tr>`;
    };

    root.innerHTML = `
      <div class="page-head"><h2>অর্ডার</h2><a class="btn btn-gold" href="#/orders/new">+ নতুন অর্ডার</a></div>
      <div class="card">
        <div class="tabs" id="o-tabs"></div>
        <div class="toolbar">
          <input type="text" id="o-search" placeholder="অর্ডার নং, নাম বা মোবাইল দিয়ে খুঁজুন...">
          <select id="o-status">${UI.opts(CFG.orderStatuses, status, 'সব অবস্থা')}</select>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>নং</th><th>গ্রাহক</th><th>পোশাক</th><th>অর্ডারের তারিখ</th><th>ডেলিভারি</th><th class="num">মোট</th><th class="num">বকেয়া</th><th>অবস্থা</th></tr></thead>
          <tbody id="o-body"></tbody>
        </table></div>
      </div>`;
    root.querySelector('#o-search').addEventListener('input', e => { search = e.target.value; draw(); });
    root.querySelector('#o-status').addEventListener('change', e => { status = e.target.value; draw(); });
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-f]');
      if (t) { f = t.dataset.f; draw(); return; }
      const tr = e.target.closest('tr[data-href]');
      if (tr) location.hash = tr.dataset.href;
    });
    draw();
  },

  /* ------------------------------ ফর্ম ------------------------------ */
  newItem(garment, cust) {
    const g = CFG.garments[garment];
    const it = {
      id: U.uid(), garment, qty: 1, rate: DB.s.prices[garment] || 0, workerId: '', wage: 0,
      fabricSource: 'customer', fabricId: '', fabricQty: '', fabricRate: '',
      school: garment === 'school' ? (cust?.school || '') : '', note: '', measurement: {}, style: { _g: {} }
    };
    for (const p of g.parts) {
      it.measurement[p] = { ...(Calc.latestMeasurement(cust, p)?.values || {}) };
      it.style[p] = {};
    }
    return it;
  },

  form(root, existing) {
    if (existing === null && location.hash.includes('/edit/')) { root.innerHTML = UI.empty('অর্ডার পাওয়া যায়নি'); return; }
    const isNew = !existing;
    const q = U.query();
    const o = isNew ? {
      customerId: q.get('c') || '', date: U.today(), trialDate: '',
      deliveryDate: U.addDays(U.today(), Number(DB.s.deliveryDays) || 7),
      items: [], discount: 0, note: '', status: 'new', payments: []
    } : JSON.parse(JSON.stringify(existing));
    for (const it of o.items) { it.style = it.style || {}; it.style._g = it.style._g || {}; it.measurement = it.measurement || {}; }
    if (!isNew) App.setTitle(`অর্ডার #${U.bn(o.no)} সম্পাদনা`);
    const cust = () => DB.get('customers', o.customerId);
    const workers = () => DB.list('workers').filter(w => w.active !== false);
    const fabrics = () => DB.list('inventory').filter(x => x.category === 'কাপড়' || x.category === 'লাইনিং');

    root.innerHTML = `
      <div class="page-head">
        <div><a class="small" href="${isNew ? '#/orders' : '#/orders/view/' + o.id}">← ফিরে যান</a>
        <h2>${isNew ? 'নতুন অর্ডার' : `অর্ডার #${U.bn(o.no)} সম্পাদনা`}</h2></div>
      </div>
      <form id="order-form" novalidate>
        <div class="card">
          <h3>গ্রাহক ও তারিখ</h3>
          <div class="form-grid">
            <div class="field span-2"><label>গ্রাহক <span class="req">*</span></label>
              <div class="btn-row" style="flex-wrap:nowrap">
                <input type="text" id="cust-input" list="cust-list" placeholder="নাম বা মোবাইল লিখে বেছে নিন" autocomplete="off">
                <button type="button" class="btn" id="new-cust">+ নতুন</button>
              </div>
              <datalist id="cust-list"></datalist>
              <div class="small text-muted" id="cust-info"></div>
            </div>
            ${UI.input('date', 'অর্ডারের তারিখ', o.date, { type: 'date', req: true })}
            ${UI.input('trialDate', 'ট্রায়ালের তারিখ (যদি থাকে)', o.trialDate || '', { type: 'date' })}
            ${UI.input('deliveryDate', 'ডেলিভারির তারিখ', o.deliveryDate, { type: 'date', req: true })}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>পোশাক</h3></div>
          <div id="items"></div>
          <div class="small text-muted" style="margin-bottom:6px">পোশাক যোগ করুন:</div>
          <div class="garment-picker">${Object.entries(CFG.garments).filter(([, g]) => !g.tenderOnly).map(([k, g]) =>
            `<button type="button" data-add="${k}"><span class="gi">${g.icon}</span>${g.name}</button>`).join('')}</div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3>অন্যান্য</h3>
            <div class="form-grid">
              ${UI.textarea('note', 'অর্ডারের নোট', o.note || '', { ph: 'বিশেষ নির্দেশনা' })}
              <label class="span-all small"><input type="checkbox" id="save-m" checked> এই মাপগুলো গ্রাহকের প্রোফাইলে সংরক্ষণ করুন</label>
            </div>
          </div>
          <div class="card">
            <h3>বিল</h3>
            <div class="summary-box" id="summary"></div>
          </div>
        </div>
        <div class="btn-row" style="justify-content:flex-end;margin-bottom:30px">
          <a class="btn" href="${isNew ? '#/orders' : '#/orders/view/' + o.id}">বাতিল</a>
          <button type="submit" class="btn btn-primary">${isNew ? 'অর্ডার সংরক্ষণ করুন' : 'পরিবর্তন সংরক্ষণ করুন'}</button>
        </div>
      </form>`;

    const form = root.querySelector('#order-form');
    const custInput = root.querySelector('#cust-input');
    const itemsEl = root.querySelector('#items');
    let advance = '';
    let advMethod = 'ক্যাশ';

    /* --- গ্রাহক নির্বাচন --- */
    const fillDatalist = () => {
      root.querySelector('#cust-list').innerHTML = DB.list('customers')
        .map(c => `<option value="${U.esc(OrderPages.custLabel(c))}"></option>`).join('');
    };
    const showCust = () => {
      const c = cust();
      const info = root.querySelector('#cust-info');
      if (!c) { info.innerHTML = ''; return; }
      const due = Calc.customerDue(c.id);
      const tpls = Object.keys(c.measurements || {}).filter(t => c.measurements[t].length).map(t => CFG.templates[t].name);
      info.innerHTML = `${U.esc(c.address || '')} · আগের অর্ডার: ${U.bn(Calc.customerOrders(c.id).length)} টি
        ${due > 0 ? ` · <span class="text-red">পূর্বের বকেয়া ${U.money(due)}</span>` : ''}
        <br>সংরক্ষিত মাপ: ${tpls.length ? U.esc(tpls.join(', ')) : 'নেই'}`;
    };
    const setCustomer = (c, fillEmpty) => {
      o.customerId = c ? c.id : '';
      if (c) custInput.value = OrderPages.custLabel(c);
      showCust();
      if (c && fillEmpty) {
        let changed = false;
        for (const it of o.items) {
          for (const p of CFG.garments[it.garment].parts) {
            const m = it.measurement[p] || {};
            if (!Object.values(m).some(v => v)) {
              it.measurement[p] = { ...(Calc.latestMeasurement(c, p)?.values || {}) };
              changed = true;
            }
          }
          if (it.garment === 'school' && !it.school) { it.school = c.school || ''; changed = true; }
        }
        if (changed) drawItems();
      }
    };
    fillDatalist();
    if (cust()) { custInput.value = OrderPages.custLabel(cust()); showCust(); }
    custInput.addEventListener('change', () => {
      const v = custInput.value.trim();
      const c = DB.list('customers').find(x => OrderPages.custLabel(x) === v)
        || DB.list('customers').find(x => x.phone && U.en(x.phone) === U.en(v));
      setCustomer(c || null, true);
      if (!c && v) UI.toast('তালিকা থেকে গ্রাহক বেছে নিন, অথবা "+ নতুন" চাপুন', 'error');
    });
    root.querySelector('#new-cust').addEventListener('click', () => {
      CustomerUI.editModal(null, c => { fillDatalist(); setCustomer(c, true); });
    });

    /* --- পোশাকের কার্ড --- */
    const itemHtml = (it, i) => {
      const g = CFG.garments[it.garment];
      const fab = it.fabricId ? DB.get('inventory', it.fabricId) : null;
      const wlist = workers();
      if (it.workerId && !wlist.find(w => w.id === it.workerId)) { const w = DB.get('workers', it.workerId); if (w) wlist.push(w); }
      return `<div class="item-card" data-i="${i}">
        <div class="item-head">
          <span class="title">${g.icon} ${U.bn(i + 1)}. ${g.name}</span>
          <span class="btn-row"><span class="small">মোট: <b class="it-total">${U.money(Calc.itemTotal(it))}</b></span>
          <button type="button" class="btn btn-sm btn-danger" data-remove="${i}">বাদ দিন</button></span>
        </div>
        <div class="form-grid">
          ${UI.field('পরিমাণ (পিস)', `<input type="text" inputmode="decimal" data-k="qty" value="${U.esc(U.bn(it.qty))}">`)}
          ${UI.field('সেলাই মজুরি (প্রতি পিস ৳)', `<input type="text" inputmode="decimal" data-k="rate" value="${U.esc(U.bn(it.rate))}">`)}
          ${UI.field('কারিগর', `<select data-k="workerId" data-rr>${UI.opts(wlist.map(w => [w.id, w.name]), it.workerId, '— পরে ঠিক করা হবে —')}</select>`)}
          ${it.workerId ? UI.field('কারিগরের মজুরি (প্রতি পিস ৳)', `<input type="text" inputmode="decimal" data-k="wage" value="${U.esc(U.bn(it.wage))}">`) : ''}
          ${UI.field('কাপড়', `<select data-k="fabricSource" data-rr>${UI.opts([['customer', 'গ্রাহকের নিজের কাপড়'], ['shop', 'দোকানের কাপড়']], it.fabricSource)}</select>`)}
          ${it.fabricSource === 'shop' ? `
            ${UI.field('কাপড় বাছাই', `<select data-k="fabricId" data-rr>${UI.opts(fabrics().map(f => [f.id, `${f.name} (স্টক ${U.bn(Calc.stock(f.id))} ${f.unit})`]), it.fabricId, '— বেছে নিন —')}</select>`)}
            ${UI.field(`কাপড়ের পরিমাণ${fab ? ' (' + fab.unit + ')' : ''}`, `<input type="text" inputmode="decimal" data-k="fabricQty" value="${U.esc(U.bn(it.fabricQty))}">`)}
            ${UI.field(`কাপড়ের দাম (প্রতি ${fab ? fab.unit : 'একক'} ৳)`, `<input type="text" inputmode="decimal" data-k="fabricRate" value="${U.esc(U.bn(it.fabricRate))}">`)}` : ''}
          ${g.school ? UI.field('স্কুলের নাম', `<input type="text" data-k="school" value="${U.esc(it.school || '')}">`, 'span-2') : ''}
          ${(g.extra || []).map(([k, l, opts]) => UI.field(l, `<select data-k="x.${k}">${UI.opts(opts, it.style._g[k], '—')}</select>`)).join('')}
        </div>
        ${g.parts.map(p => `
          <div class="m-part">
            <div class="m-part-title"><span>${CFG.templates[p].name} (ইঞ্চি)</span>
              ${cust() && Calc.latestMeasurement(cust(), p) ? `<button type="button" class="btn btn-sm" data-fill="${i}:${p}">প্রোফাইলের মাপ বসান</button>` : ''}</div>
            <div class="m-grid">${CFG.templates[p].fields.map(([k, l]) =>
              `<div class="field"><label>${U.esc(l)}</label><input type="text" inputmode="decimal" data-k="m.${p}.${k}" value="${U.esc(U.bn(it.measurement[p]?.[k] ?? ''))}"></div>`).join('')}</div>
            <div class="form-grid" style="margin-top:8px">${CFG.templates[p].styles.map(([k, l, opts]) =>
              UI.field(l, `<select data-k="s.${p}.${k}">${UI.opts(opts, it.style[p]?.[k], '—')}</select>`)).join('')}</div>
          </div>`).join('')}
        <div class="form-grid" style="margin-top:10px">
          ${UI.field('এই পোশাকের নোট', `<input type="text" data-k="note" value="${U.esc(it.note || '')}" placeholder="যেমন: বুক পকেটে নাম সেলাই">`, 'span-all')}
        </div>
      </div>`;
    };
    const drawItems = () => {
      itemsEl.innerHTML = o.items.length ? o.items.map(itemHtml).join('')
        : `<div class="alert alert-info">নিচ থেকে পোশাকের ধরন বেছে নিয়ে অর্ডারে যোগ করুন।</div>`;
      drawSummary();
    };

    /* --- বিলের সারাংশ --- */
    const drawSummary = () => {
      const sub = Calc.orderSubtotal(o);
      const total = sub - U.num(o.discount);
      const paid = Calc.orderPaid(o);
      const due = total - paid - (isNew ? U.num(advance) : 0);
      root.querySelector('#summary').innerHTML = `
        <div class="row"><span>মোট (${U.bn(Calc.pieces(o))} পিস)</span><b>${U.money(sub)}</b></div>
        <div class="row"><span>ছাড় (৳)</span><input type="text" inputmode="decimal" id="discount" value="${U.esc(U.bn(o.discount || ''))}"></div>
        <div class="row total"><span>সর্বমোট</span><span>${U.money(total)}</span></div>
        ${isNew && Auth.can('payments') ? `
          <div class="row"><span>অগ্রিম (৳)</span><input type="text" inputmode="decimal" id="advance" value="${U.esc(U.bn(advance))}"></div>
          <div class="row"><span>অগ্রিমের মাধ্যম</span><select id="adv-method" style="max-width:140px">${UI.opts(CFG.payMethods, advMethod)}</select></div>`
        : `<div class="row"><span>পরিশোধিত</span><span>${U.money(paid)}</span></div>`}
        <div class="row total"><span>বাকি</span><span class="${due > 0 ? 'text-red' : 'text-green'}">${U.money(due)}</span></div>`;
    };
    const refreshTotals = () => {
      o.items.forEach((it, i) => {
        const el = itemsEl.querySelector(`.item-card[data-i="${i}"] .it-total`);
        if (el) el.textContent = U.money(Calc.itemTotal(it));
      });
      const keepFocus = document.activeElement?.id;
      const pos = document.activeElement?.selectionStart;
      drawSummary();
      if (keepFocus && (keepFocus === 'discount' || keepFocus === 'advance')) {
        const el = root.querySelector('#' + keepFocus);
        el.focus();
        try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
      }
    };

    /* --- ইভেন্ট --- */
    const onField = e => {
      const el = e.target;
      const card = el.closest('.item-card');
      if (card && el.dataset.k) {
        const it = o.items[Number(card.dataset.i)];
        const k = el.dataset.k;
        const numeric = el.getAttribute('inputmode') === 'decimal';
        const v = numeric ? U.en(el.value) : el.value;
        const p = k.split('.');
        if (p[0] === 'm') { (it.measurement[p[1]] = it.measurement[p[1]] || {})[p[2]] = v.trim(); }
        else if (p[0] === 's') { (it.style[p[1]] = it.style[p[1]] || {})[p[2]] = v; }
        else if (p[0] === 'x') { it.style._g[p[1]] = v; }
        else it[k] = v;
        if (k === 'workerId') {
          const w = DB.get('workers', v);
          it.wage = w ? (w.rates?.[it.garment] ?? DB.s.wages[it.garment] ?? 0) : 0;
        }
        if (k === 'fabricId') {
          const f = DB.get('inventory', v);
          if (f) it.fabricRate = f.sellRate || '';
        }
        if (k === 'fabricSource' && v === 'customer') { it.fabricId = ''; it.fabricQty = ''; it.fabricRate = ''; }
        if (e.type === 'change' && el.hasAttribute('data-rr')) drawItems();
        else refreshTotals();
        return;
      }
      if (e.type !== 'input') { if (el.id === 'adv-method') advMethod = el.value; return; }
      if (el.id === 'discount') { o.discount = U.en(el.value); refreshTotals(); }
      if (el.id === 'advance') { advance = U.en(el.value); refreshTotals(); }
      if (el.id === 'adv-method') advMethod = el.value;
    };
    form.addEventListener('input', onField);
    form.addEventListener('change', onField);
    form.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) {
        o.items.push(OrderPages.newItem(add.dataset.add, cust()));
        drawItems();
        const cards = itemsEl.querySelectorAll('.item-card');
        cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { o.items.splice(Number(rm.dataset.remove), 1); drawItems(); return; }
      const fill = e.target.closest('[data-fill]');
      if (fill) {
        const [i, p] = fill.dataset.fill.split(':');
        o.items[Number(i)].measurement[p] = { ...(Calc.latestMeasurement(cust(), p)?.values || {}) };
        drawItems();
        UI.toast('প্রোফাইলের মাপ বসানো হয়েছে');
      }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = UI.formData(form);
      if (!o.customerId) { UI.toast('গ্রাহক বেছে নিন', 'error'); custInput.focus(); return; }
      if (!o.items.length) { UI.toast('অন্তত একটি পোশাক যোগ করুন', 'error'); return; }
      if (!f.deliveryDate) { UI.toast('ডেলিভারির তারিখ দিন', 'error'); return; }
      for (const it of o.items) {
        if (U.num(it.qty) <= 0) { UI.toast(`${CFG.garmentName(it.garment)} — পরিমাণ সঠিক নয়`, 'error'); return; }
        if (it.fabricSource === 'shop' && !it.fabricId) { UI.toast(`${CFG.garmentName(it.garment)} — দোকানের কোন কাপড় তা বেছে নিন`, 'error'); return; }
        it.qty = U.num(it.qty); it.rate = U.num(it.rate); it.wage = U.num(it.wage);
        if (it.fabricSource === 'shop') { it.fabricQty = U.num(it.fabricQty); it.fabricRate = U.num(it.fabricRate); }
      }
      o.date = f.date; o.trialDate = f.trialDate; o.deliveryDate = f.deliveryDate; o.note = f.note;
      o.discount = U.num(o.discount);
      if (isNew) {
        o.id = U.uid();
        o.no = DB.nextOrderNo();
        o.createdAt = U.today();
        o.createdBy = Auth.user?.name || '';
        o.statusLog = [{ status: 'new', date: U.today(), by: o.createdBy }];
        o.payments = [];
        if (U.num(advance) > 0 && Auth.can('payments')) o.payments.push({ id: U.uid(), date: o.date, amount: U.num(advance), method: advMethod, note: 'অগ্রিম', by: o.createdBy });
      }
      if (root.querySelector('#save-m').checked) {
        const c = cust();
        let changed = false;
        for (const it of o.items) for (const p of CFG.garments[it.garment].parts) {
          const vals = {};
          for (const [k, v] of Object.entries(it.measurement[p] || {})) if (v) vals[k] = v;
          if (Object.keys(vals).length && CustomerUI.addMeasurement(c, p, vals, Calc.latestMeasurement(c, p)?.note || '')) changed = true;
        }
        if (changed) DB.upsert('customers', c);
      }
      DB.syncOrderStock(o);
      DB.upsert('orders', o);
      UI.toast(isNew ? `অর্ডার #${U.bn(o.no)} সংরক্ষিত হয়েছে` : 'পরিবর্তন সংরক্ষিত হয়েছে', 'ok');
      location.hash = '#/orders/view/' + o.id;
    });

    drawItems();
    if (isNew && q.get('c') && !o.items.length) showCust();
  },

  /* ------------------------------ বিস্তারিত ------------------------------ */
  setStatus(o, st) {
    o.status = st;
    o.statusLog = o.statusLog || [];
    o.statusLog.push({ status: st, date: U.today(), by: Auth.user?.name || '' });
    const idx = Calc.statusIdx(st);
    if (st !== 'cancelled' && idx >= Calc.readyIdx()) { if (!o.readyDate) o.readyDate = U.today(); }
    else o.readyDate = null;
    o.deliveredDate = st === 'delivered' ? U.today() : null;
    DB.syncOrderStock(o);
    DB.upsert('orders', o);
  },

  waMessage(o, c) {
    const s = DB.s;
    const due = Calc.orderDue(o);
    let msg = `আসসালামু আলাইকুম ${c.name}, ${s.shopName} থেকে বলছি।\n`;
    if (o.status === 'ready') msg += `আপনার অর্ডার নং ${U.bn(o.no)} (${Calc.orderSummary(o)}) ডেলিভারির জন্য প্রস্তুত। অনুগ্রহ করে দোকানে এসে সংগ্রহ করুন।`;
    else if (o.status === 'trial') msg += `আপনার অর্ডার নং ${U.bn(o.no)} এর ট্রায়ালের জন্য প্রস্তুত। সুবিধামতো সময়ে দোকানে আসুন।`;
    else if (o.status === 'delivered') msg += `অর্ডার নং ${U.bn(o.no)} গ্রহণ করার জন্য ধন্যবাদ। আবার আসবেন।`;
    else msg += `আপনার অর্ডার নং ${U.bn(o.no)} এর বর্তমান অবস্থা: ${CFG.statusName('orderStatuses', o.status)}। ডেলিভারির তারিখ: ${U.date(o.deliveryDate)}।`;
    if (due > 0 && o.status !== 'delivered') msg += `\nবাকি টাকা: ${U.money(due)}`;
    msg += `\nধন্যবাদ।`;
    return `https://wa.me/${U.waPhone(c.phone)}?text=${encodeURIComponent(msg)}`;
  },

  view(root, id) {
    const o = DB.get('orders', id);
    if (!o) { root.innerHTML = UI.empty('অর্ডার পাওয়া যায়নি'); return; }
    const c = DB.get('customers', o.customerId) || { name: '(মুছে ফেলা গ্রাহক)', phone: '' };
    App.setTitle(`অর্ডার #${U.bn(o.no)}`);
    const total = Calc.orderTotal(o);
    const paid = Calc.orderPaid(o);
    const due = Calc.orderDue(o);
    const steps = CFG.orderStatuses.filter(s => s[0] !== 'cancelled');
    const curIdx = Calc.statusIdx(o.status);
    const next = o.status !== 'cancelled' && curIdx < steps.length - 1 ? steps[curIdx + 1] : null;
    const wName = wid => DB.get('workers', wid)?.name || '';

    root.innerHTML = `
      <div class="page-head">
        <div><a class="small" href="#/orders">← সব অর্ডার</a>
          <h2>অর্ডার #${U.bn(o.no)} ${UI.orderBadge(o)}</h2></div>
        <div class="btn-row">
          <button class="btn" data-act="receipt">🖨 গ্রাহকের রসিদ</button>
          <button class="btn" data-act="slip">🖨 কারিগরের মাপ-স্লিপ</button>
          ${c.phone ? `<a class="btn" target="_blank" rel="noopener" href="${OrderPages.waMessage(o, c)}">WhatsApp-এ জানান</a>` : ''}
          <a class="btn" href="#/orders/edit/${o.id}">সম্পাদনা</a>
          <button class="btn btn-danger" data-act="del">মুছুন</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>কাজের অগ্রগতি</h3>
          <div class="btn-row">
            ${next ? `<button class="btn btn-green" data-status="${next[0]}">→ ${U.esc(next[1])}</button>` : ''}
            <select id="status-sel" style="width:auto">${UI.opts(CFG.orderStatuses, o.status)}</select>
          </div>
        </div>
        ${o.status === 'cancelled' ? '<div class="alert alert-warn">এই অর্ডারটি বাতিল করা হয়েছে।</div>' : `
        <div class="stepper">${steps.map((s, i) => `<div class="st ${i < curIdx ? 'done' : i === curIdx ? 'cur' : ''}">${U.esc(s[1])}</div>`).join('')}</div>`}
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>গ্রাহক ও তারিখ</h3>
          <dl class="info-list">
            <dt>গ্রাহক</dt><dd>${o.customerId && DB.get('customers', o.customerId) ? `<a href="#/customers/view/${o.customerId}">${U.esc(c.name)}</a>` : U.esc(c.name)}</dd>
            <dt>মোবাইল</dt><dd>${U.t(c.phone || '—')}</dd>
            <dt>অর্ডারের তারিখ</dt><dd>${U.date(o.date)}</dd>
            <dt>ট্রায়াল</dt><dd>${o.trialDate ? U.date(o.trialDate) : '—'}</dd>
            <dt>ডেলিভারি</dt><dd class="${Calc.isOverdue(o) ? 'text-red' : ''}">${U.date(o.deliveryDate)} ${Calc.isActive(o) ? `(${U.esc(U.relDay(o.deliveryDate))})` : ''}</dd>
            ${o.deliveredDate ? `<dt>ডেলিভারি দেওয়া হয়েছে</dt><dd>${U.date(o.deliveredDate)}</dd>` : ''}
            ${o.note ? `<dt>নোট</dt><dd>${U.esc(o.note)}</dd>` : ''}
            ${o.createdBy ? `<dt>অর্ডার নিয়েছেন</dt><dd>${U.esc(o.createdBy)}</dd>` : ''}
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3>বিল ও পেমেন্ট</h3>${o.status !== 'cancelled' ? '<button class="btn btn-sm btn-green" data-act="pay">+ পেমেন্ট নিন</button>' : ''}</div>
          <div class="summary-box">
            <div class="row"><span>মোট</span><span>${U.money(Calc.orderSubtotal(o))}</span></div>
            ${U.num(o.discount) ? `<div class="row"><span>ছাড়</span><span>- ${U.money(o.discount)}</span></div>` : ''}
            <div class="row total"><span>সর্বমোট</span><span>${U.money(total)}</span></div>
            <div class="row"><span>পরিশোধিত</span><span class="text-green">${U.money(paid)}</span></div>
            <div class="row total"><span>বাকি</span><span class="${due > 0 ? 'text-red' : 'text-green'}">${U.money(due)}</span></div>
          </div>
          ${(o.payments || []).length ? `<table class="tbl small" style="margin-top:10px">
            <thead><tr><th>তারিখ</th><th>মাধ্যম</th><th>নোট</th><th class="num">টাকা</th><th></th></tr></thead>
            <tbody>${o.payments.map(p => `<tr><td class="nowrap">${U.dateShort(p.date)}</td><td>${U.esc(p.method)}</td><td>${U.esc(p.note || '')}${p.by ? `<br><span class="text-muted">গ্রহণ: ${U.esc(p.by)}</span>` : ''}</td>
              <td class="num">${U.money(p.amount)}</td><td><button class="btn-icon small" title="মুছুন" data-delpay="${p.id}">✕</button></td></tr>`).join('')}</tbody>
          </table>` : ''}
        </div>
      </div>

      <div class="card">
        <h3>পোশাক (${U.bn(Calc.pieces(o))} পিস)</h3>
        ${o.items.map((it, i) => {
          const g = CFG.garments[it.garment];
          const fab = it.fabricId ? DB.get('inventory', it.fabricId) : null;
          const styles = [];
          for (const [k, l] of g.extra || []) if (it.style?._g?.[k]) styles.push(`${l}: ${it.style._g[k]}`);
          return `<div class="item-card">
            <div class="item-head"><span class="title">${g.icon} ${U.bn(i + 1)}. ${g.name} × ${U.bn(it.qty)}</span><b>${U.money(Calc.itemTotal(it))}</b></div>
            <div class="small">
              সেলাই: ${U.money(it.rate)} × ${U.bn(it.qty)}
              ${it.fabricSource === 'shop' ? ` · কাপড়: ${U.esc(fab?.name || '—')} ${U.bn(it.fabricQty)} ${U.esc(fab?.unit || '')} × ${U.money(it.fabricRate)}` : ' · গ্রাহকের নিজের কাপড়'}
              · কারিগর: ${it.workerId ? `<a href="#/workers/view/${it.workerId}">${U.esc(wName(it.workerId))}</a> (${U.money(it.wage)}/পিস)` : '<span class="text-red">ঠিক করা হয়নি</span>'}
              ${it.school ? ` · স্কুল: ${U.esc(it.school)}` : ''}
              ${styles.length ? ` · ${U.esc(styles.join(' · '))}` : ''}
            </div>
            ${g.parts.map(p => {
              const st = CFG.templates[p].styles.filter(([k]) => it.style?.[p]?.[k]).map(([k, l]) => `${l}: ${it.style[p][k]}`);
              return `<div class="m-part"><div class="m-part-title">${CFG.templates[p].name}</div>
                ${CustomerUI.measureView(it.measurement?.[p] || {})(p)}
                ${st.length ? `<div class="small" style="margin-top:6px">স্টাইল: ${U.esc(st.join(' · '))}</div>` : ''}</div>`;
            }).join('')}
            ${it.note ? `<div class="small" style="margin-top:6px">নোট: ${U.esc(it.note)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>

      <div class="card">
        <h3>অবস্থার ইতিহাস</h3>
        <ul class="list-plain">${(o.statusLog || []).slice().reverse().map(l => `<li><span>${UI.badge(l.status, CFG.statusName('orderStatuses', l.status))}</span><span class="small">${U.date(l.date)}${l.by ? ' · ' + U.esc(l.by) : ''}</span></li>`).join('')}</ul>
      </div>`;

    const changeStatus = async st => {
      if (st === o.status) return;
      if (st === 'delivered' && Calc.orderDue(o) > 0) {
        if (!await UI.confirm(`এই অর্ডারে এখনো <b>${U.money(Calc.orderDue(o))}</b> বাকি আছে। বাকি রেখেই ডেলিভারি সম্পন্ন করবেন?`, 'হ্যাঁ, ডেলিভারি সম্পন্ন')) { App.route(); return; }
      }
      if (st === 'cancelled' && !await UI.confirm('অর্ডারটি বাতিল করবেন? দোকানের কাপড় ব্যবহার হয়ে থাকলে তা স্টকে ফেরত যাবে।', 'বাতিল করুন')) { App.route(); return; }
      OrderPages.setStatus(o, st);
      UI.toast(`অবস্থা: ${CFG.statusName('orderStatuses', st)}`, 'ok');
      App.route();
    };
    root.querySelector('#status-sel').addEventListener('change', e => changeStatus(e.target.value));
    root.addEventListener('click', async e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.status) return changeStatus(b.dataset.status);
      if (b.dataset.delpay) {
        if (await UI.confirm('এই পেমেন্টটি মুছে ফেলবেন?', 'মুছুন')) {
          o.payments = o.payments.filter(p => p.id !== b.dataset.delpay);
          DB.upsert('orders', o); App.route();
        }
        return;
      }
      switch (b.dataset.act) {
        case 'pay':
          UI.paymentModal(`অর্ডার #${U.bn(o.no)} — পেমেন্ট`, Calc.orderDue(o), p => {
            o.payments = o.payments || [];
            o.payments.push(p);
            DB.upsert('orders', o);
            UI.toast('পেমেন্ট যোগ হয়েছে', 'ok');
            App.route();
          });
          break;
        case 'receipt': Print.receipt(o); break;
        case 'slip': Print.slip(o); break;
        case 'del':
          if (await UI.confirm(`অর্ডার #${U.bn(o.no)} সম্পূর্ণ মুছে ফেলবেন? এর পেমেন্টের হিসাবও মুছে যাবে।`, 'মুছুন')) {
            DB.data.stockMoves = DB.data.stockMoves.filter(m => m.ref !== 'order:' + o.id);
            DB.remove('orders', o.id);
            UI.toast('অর্ডার মুছে ফেলা হয়েছে');
            location.hash = '#/orders';
          }
          break;
      }
    });
  }
};
