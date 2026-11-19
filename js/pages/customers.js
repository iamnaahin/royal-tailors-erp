/* গ্রাহক ও মাপ */
const CustomerUI = {
  /** নতুন/সম্পাদনা মডাল */
  editModal(cust, onSaved) {
    const c = cust || { type: 'regular' };
    UI.modal(cust ? 'গ্রাহকের তথ্য সম্পাদনা' : 'নতুন গ্রাহক', `
      <div class="form-grid">
        ${UI.input('name', 'নাম', c.name || '', { req: true })}
        ${UI.input('phone', 'মোবাইল নম্বর', c.phone || '', { type: 'tel', ph: '০১XXXXXXXXX' })}
        ${UI.select('type', 'ধরন', CFG.customerTypes, c.type)}
        ${UI.input('address', 'ঠিকানা', c.address || '', { cls: 'span-2' })}
        ${UI.input('school', 'স্কুল/প্রতিষ্ঠানের নাম (শিক্ষার্থী হলে)', c.school || '', { cls: 'span-2' })}
        ${UI.input('cls', 'শ্রেণি', c.cls || '')}
        ${UI.textarea('note', 'নোট', c.note || '')}
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const phone = U.en(f.phone);
        if (phone) {
          const dup = DB.list('customers').find(x => x.id !== c.id && U.en(x.phone) === phone);
          if (dup && !confirm(`এই নম্বরে আগে থেকে "${dup.name}" নামে গ্রাহক আছে। তবুও সংরক্ষণ করবেন?`)) return false;
        }
        const obj = { ...c, ...f, phone, measurements: c.measurements || {} };
        DB.upsert('customers', obj);
        UI.toast('গ্রাহকের তথ্য সংরক্ষিত হয়েছে', 'ok');
        if (onSaved) onSaved(obj);
      }
    });
  },

  measureFields(tpl, values = {}, prefix = '') {
    return `<div class="m-grid">${CFG.templates[tpl].fields.map(([k, l]) =>
      `<div class="field"><label>${U.esc(l)}</label><input type="text" inputmode="decimal" name="${prefix}${k}" data-k="${prefix}${k}" value="${U.esc(U.bn(values[k] ?? ''))}"></div>`
    ).join('')}</div>`;
  },

  /** মাপ নেওয়া/আপডেট */
  measureModal(cust, tpl, onSaved) {
    const last = Calc.latestMeasurement(cust, tpl);
    UI.modal(`${cust.name} — ${CFG.templates[tpl].name}`, `
      <p class="small text-muted">সব মাপ ইঞ্চিতে। আগের মাপ ${last ? `(${U.date(last.date)})` : ''} দেখানো হচ্ছে — শুধু পরিবর্তিত ঘর বদলান। আগের মাপ ইতিহাসে থেকে যাবে।</p>
      ${CustomerUI.measureFields(tpl, last?.values || {}, 'm_')}
      <div class="form-grid" style="margin-top:10px">${UI.textarea('note', 'মাপ সম্পর্কে নোট', last?.note || '', { ph: 'যেমন: কাঁধ একটু ঢালু, পেট একটু বড়' })}</div>`, {
      wide: true,
      onSave: form => {
        const f = UI.formData(form);
        const values = {};
        for (const [k] of CFG.templates[tpl].fields) { const v = U.en(f['m_' + k]); if (v) values[k] = v; }
        if (!Object.keys(values).length) { UI.toast('অন্তত একটি মাপ লিখুন', 'error'); return false; }
        CustomerUI.addMeasurement(cust, tpl, values, f.note);
        DB.upsert('customers', cust);
        UI.toast('মাপ সংরক্ষিত হয়েছে', 'ok');
        if (onSaved) onSaved();
      }
    });
  },

  /** মাপ ইতিহাসে যোগ — আজকের মাপ থাকলে সেটাই হালনাগাদ */
  addMeasurement(cust, tpl, values, note = '') {
    cust.measurements = cust.measurements || {};
    const h = cust.measurements[tpl] = cust.measurements[tpl] || [];
    const last = h[h.length - 1];
    if (last && JSON.stringify(last.values) === JSON.stringify(values) && (last.note || '') === (note || '')) return false;
    const entry = { date: U.today(), values, note: note || '' };
    if (last && last.date === entry.date) h[h.length - 1] = entry; else h.push(entry);
    return true;
  },

  measureView(values) {
    return (tpl) => `<div class="m-view">${CFG.templates[tpl].fields.filter(([k]) => values[k]).map(([k, l]) =>
      `<div>${U.esc(l)}<b>${U.t(values[k])}</b></div>`).join('') || '<span class="text-muted small">কোনো মাপ নেই</span>'}</div>`;
  },

  historyModal(cust, tpl) {
    const h = (cust.measurements?.[tpl] || []).slice().reverse();
    const fields = CFG.templates[tpl].fields;
    UI.modal(`${cust.name} — ${CFG.templates[tpl].name}ের ইতিহাস`, h.length ? `
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>তারিখ</th>${fields.map(([, l]) => `<th class="num">${U.esc(l)}</th>`).join('')}<th>নোট</th></tr></thead>
        <tbody>${h.map(e => `<tr><td class="nowrap">${U.dateShort(e.date)}</td>${fields.map(([k]) => `<td class="num">${U.t(e.values[k] || '—')}</td>`).join('')}<td class="small">${U.esc(e.note || '')}</td></tr>`).join('')}</tbody>
      </table></div>` : UI.empty('কোনো ইতিহাস নেই'), { wide: true });
  }
};

Pages.customers = function (root, args) {
  if (args[0] === 'view' && args[1]) return Pages.customerView(root, args[1]);

  const q = U.query();
  let search = q.get('q') || '';
  let type = '';

  const draw = () => {
    const list = DB.list('customers')
      .filter(c => (!type || c.type === type) && U.match(search, c.name, c.phone, c.address, c.school))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    root.querySelector('#c-body').innerHTML = list.length ? list.map(c => {
      const ords = Calc.customerOrders(c.id);
      const due = Calc.customerDue(c.id);
      const mCount = Object.values(c.measurements || {}).filter(h => h.length).length;
      return `<tr class="clickable" data-href="#/customers/view/${c.id}">
        <td><b>${U.esc(c.name)}</b>${c.type === 'student' ? `<br><span class="small text-muted">🎒 ${U.esc(c.school || '')} ${c.cls ? '· ' + U.esc(c.cls) : ''}</span>` : ''}</td>
        <td class="nowrap">${U.t(c.phone || '—')}</td>
        <td class="small">${U.esc(c.address || '')}</td>
        <td class="num">${U.count(mCount)}</td>
        <td class="num">${U.count(ords.length)}</td>
        <td class="num ${due > 0 ? 'text-red bold' : ''}">${due > 0 ? U.money(due) : '—'}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="6">${UI.empty(search ? 'কোনো গ্রাহক পাওয়া যায়নি' : 'এখনো কোনো গ্রাহক যোগ করা হয়নি')}</td></tr>`;
    root.querySelector('#c-count').textContent = `মোট ${U.count(list.length)} জন`;
  };

  root.innerHTML = `
    <div class="page-head"><h2>গ্রাহক ও মাপ</h2><button class="btn btn-gold" id="add-c">+ নতুন গ্রাহক</button></div>
    <div class="card">
      <div class="toolbar">
        <input type="text" id="c-search" placeholder="নাম, মোবাইল বা স্কুল দিয়ে খুঁজুন..." value="${U.esc(search)}">
        <select id="c-type">${UI.opts(CFG.customerTypes, '', 'সব ধরন')}</select>
        <span class="text-muted small" id="c-count"></span>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>নাম</th><th>মোবাইল</th><th>ঠিকানা</th><th class="num">মাপ</th><th class="num">অর্ডার</th><th class="num">বকেয়া</th></tr></thead>
        <tbody id="c-body"></tbody>
      </table></div>
    </div>`;
  root.querySelector('#c-search').addEventListener('input', e => { search = e.target.value; draw(); });
  root.querySelector('#c-type').addEventListener('change', e => { type = e.target.value; draw(); });
  root.querySelector('#add-c').addEventListener('click', () => CustomerUI.editModal(null, c => location.hash = '#/customers/view/' + c.id));
  root.addEventListener('click', e => { const tr = e.target.closest('tr[data-href]'); if (tr) location.hash = tr.dataset.href; });
  draw();
  if (q.get('new')) CustomerUI.editModal(null, c => location.hash = '#/customers/view/' + c.id);
};

Pages.customerView = function (root, id) {
  const c = DB.get('customers', id);
  if (!c) { root.innerHTML = UI.empty('গ্রাহক পাওয়া যায়নি'); return; }
  App.setTitle(c.name);
  const redraw = () => App.route();
  const ords = Calc.customerOrders(c.id).sort((a, b) => b.date.localeCompare(a.date));
  const due = Calc.customerDue(c.id);
  const total = U.sum(ords.filter(o => o.status !== 'cancelled'), o => Calc.orderTotal(o));

  root.innerHTML = `
    <div class="page-head">
      <div><a href="#/customers" class="small">← সব গ্রাহক</a><h2>${U.esc(c.name)}</h2></div>
      <div class="btn-row">
        <a class="btn btn-gold" href="#/orders/new?c=${c.id}">+ নতুন অর্ডার</a>
        <button class="btn" data-act="print">🖨 মাপ প্রিন্ট</button>
        ${c.phone ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${U.waPhone(c.phone)}">WhatsApp</a>` : ''}
        <button class="btn" data-act="edit">সম্পাদনা</button>
        <button class="btn btn-danger" data-act="del">মুছুন</button>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>গ্রাহকের তথ্য</h3>
        <dl class="info-list">
          <dt>মোবাইল</dt><dd>${U.t(c.phone || '—')}</dd>
          <dt>ধরন</dt><dd>${U.esc(CFG.customerTypes.find(t => t[0] === c.type)?.[1] || 'সাধারণ')}</dd>
          ${c.school ? `<dt>স্কুল</dt><dd>${U.esc(c.school)} ${c.cls ? '· শ্রেণি: ' + U.esc(c.cls) : ''}</dd>` : ''}
          <dt>ঠিকানা</dt><dd>${U.esc(c.address || '—')}</dd>
          <dt>গ্রাহক হয়েছেন</dt><dd>${U.date(c.createdAt)}</dd>
          ${c.note ? `<dt>নোট</dt><dd>${U.esc(c.note)}</dd>` : ''}
        </dl>
      </div>
      <div class="card">
        <h3>লেনদেনের সারাংশ</h3>
        <dl class="info-list">
          <dt>মোট অর্ডার</dt><dd>${U.count(ords.length)} টি</dd>
          <dt>মোট বিল</dt><dd>${U.money(total)}</dd>
          <dt>বকেয়া</dt><dd class="${due > 0 ? 'text-red' : 'text-green'}">${U.money(due)}</dd>
        </dl>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>মাপসমূহ (ইঞ্চি)</h3></div>
      ${Object.keys(CFG.templates).map(tpl => {
        const last = Calc.latestMeasurement(c, tpl);
        const n = c.measurements?.[tpl]?.length || 0;
        return `<div class="m-part">
          <div class="m-part-title"><span>${U.esc(CFG.templates[tpl].name)} ${last ? `<span class="small text-muted">· ${U.date(last.date)}</span>` : ''}</span>
            <span class="btn-row">
              <button class="btn btn-sm ${last ? '' : 'btn-primary'}" data-measure="${tpl}">${last ? 'মাপ আপডেট' : 'মাপ নিন'}</button>
              ${n > 1 ? `<button class="btn btn-sm" data-hist="${tpl}">ইতিহাস (${U.bn(n)})</button>` : ''}
            </span></div>
          ${last ? CustomerUI.measureView(last.values)(tpl) + (last.note ? `<div class="small text-muted" style="margin-top:4px">নোট: ${U.esc(last.note)}</div>` : '') : '<span class="small text-muted">এখনো মাপ নেওয়া হয়নি</span>'}
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h3>অর্ডারসমূহ</h3></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>অর্ডার নং</th><th>তারিখ</th><th>পোশাক</th><th>ডেলিভারি</th><th class="num">মোট</th><th class="num">বকেয়া</th><th>অবস্থা</th></tr></thead>
        <tbody>${ords.length ? ords.map(o => `<tr class="clickable" data-href="#/orders/view/${o.id}">
          <td>#${U.bn(o.no)}</td><td class="nowrap">${U.dateShort(o.date)}</td><td>${U.esc(Calc.orderSummary(o))}</td>
          <td class="nowrap">${U.dateShort(o.deliveryDate)}</td><td class="num">${U.money(Calc.orderTotal(o))}</td>
          <td class="num ${Calc.orderDue(o) > 0 ? 'text-red' : ''}">${U.money(Calc.orderDue(o))}</td><td>${UI.orderBadge(o)}</td></tr>`).join('')
          : `<tr><td colspan="7">${UI.empty('এই গ্রাহকের কোনো অর্ডার নেই')}</td></tr>`}</tbody>
      </table></div>
    </div>`;

  root.addEventListener('click', async e => {
    const tr = e.target.closest('tr[data-href]');
    if (tr) { location.hash = tr.dataset.href; return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.measure) CustomerUI.measureModal(c, b.dataset.measure, redraw);
    else if (b.dataset.hist) CustomerUI.historyModal(c, b.dataset.hist);
    else if (b.dataset.act === 'edit') CustomerUI.editModal(c, redraw);
    else if (b.dataset.act === 'print') Print.measurements(c);
    else if (b.dataset.act === 'del') {
      if (ords.length) { UI.toast('এই গ্রাহকের অর্ডার আছে, তাই মোছা যাবে না', 'error'); return; }
      if (await UI.confirm(`"${U.esc(c.name)}" গ্রাহককে মুছে ফেলবেন?`, 'মুছুন')) {
        DB.remove('customers', c.id);
        UI.toast('গ্রাহক মুছে ফেলা হয়েছে');
        location.hash = '#/customers';
      }
    }
  });
};
