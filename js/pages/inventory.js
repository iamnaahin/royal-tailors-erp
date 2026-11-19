/* কাপড় ও মালামালের স্টক */
Pages.inventory = function (root) {
  let search = '';
  let cat = '';

  const editModal = item => {
    const x = item || { category: 'কাপড়', unit: 'গজ' };
    UI.modal(item ? 'মালামালের তথ্য সম্পাদনা' : 'নতুন কাপড়/মালামাল', `
      <div class="form-grid">
        ${UI.input('name', 'নাম', x.name || '', { req: true, cls: 'span-2', ph: 'যেমন: সাদা কটন শার্টিং' })}
        ${UI.select('category', 'ক্যাটাগরি', CFG.invCats, x.category)}
        ${UI.select('unit', 'একক', CFG.units, x.unit)}
        ${UI.input('buyRate', 'ক্রয়মূল্য (প্রতি একক ৳)', x.buyRate ?? '', { num: true, bn: true })}
        ${UI.input('sellRate', 'বিক্রয়মূল্য (প্রতি একক ৳)', x.sellRate ?? '', { num: true, bn: true })}
        ${UI.input('minStock', 'সর্বনিম্ন স্টক (সতর্কতা)', x.minStock ?? '', { num: true, bn: true })}
        ${item ? '' : UI.input('opening', 'শুরুর স্টক', '', { num: true })}
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const obj = { ...x, name: f.name, category: f.category, unit: f.unit, buyRate: U.num(f.buyRate), sellRate: U.num(f.sellRate), minStock: U.num(f.minStock) };
        DB.upsert('inventory', obj);
        if (!item && U.num(f.opening) > 0) {
          DB.data.stockMoves.push({ id: U.uid(), itemId: obj.id, date: U.today(), type: 'opening', qty: U.num(f.opening), rate: obj.buyRate, note: 'শুরুর স্টক' });
          DB.save();
        }
        UI.toast('সংরক্ষিত হয়েছে', 'ok');
        App.route();
      }
    });
  };

  const purchaseModal = item => {
    UI.modal(`${item.name} — ক্রয় / স্টক যোগ`, `
      <div class="form-grid">
        ${UI.input('qty', `পরিমাণ (${item.unit})`, '', { req: true, num: true })}
        ${UI.input('rate', 'ক্রয়মূল্য (প্রতি একক ৳)', item.buyRate || '', { num: true, bn: true })}
        ${UI.input('date', 'তারিখ', U.today(), { type: 'date', req: true })}
        ${UI.select('method', 'পেমেন্ট মাধ্যম', CFG.payMethods, 'ক্যাশ')}
        ${UI.input('note', 'সরবরাহকারী / নোট', '', { cls: 'span-all', ph: 'যেমন: বড় বাজার থেকে' })}
        <label class="span-all small"><input type="checkbox" name="expense" checked> খরচের হিসাবে যোগ করুন</label>
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const qty = U.num(f.qty), rate = U.num(f.rate);
        if (qty <= 0) { UI.toast('সঠিক পরিমাণ লিখুন', 'error'); return false; }
        const mid = U.uid();
        DB.data.stockMoves.push({ id: mid, itemId: item.id, date: f.date, type: 'purchase', qty, rate, note: f.note || 'ক্রয়' });
        if (f.expense && qty * rate > 0) {
          DB.data.expenses.push({ id: U.uid(), date: f.date, category: 'কাপড়/মালামাল ক্রয়', amount: U.round2(qty * rate), method: f.method,
            note: `${item.name} ${U.bn(qty)} ${item.unit}${f.note ? ' — ' + f.note : ''}`, ref: 'move:' + mid });
        }
        if (rate) item.buyRate = rate;
        DB.save();
        UI.toast('স্টক যোগ হয়েছে', 'ok');
        App.route();
      }
    });
  };

  const useModal = item => {
    UI.modal(`${item.name} — স্টক থেকে বাদ`, `
      <p class="small text-muted">অর্ডারে দোকানের কাপড় দিলে স্বয়ংক্রিয়ভাবে বাদ যায়। টেন্ডারের কাজে বা নষ্ট হলে এখানে লিখুন।</p>
      <div class="form-grid">
        ${UI.input('qty', `পরিমাণ (${item.unit})`, '', { req: true, num: true })}
        ${UI.input('date', 'তারিখ', U.today(), { type: 'date', req: true })}
        ${UI.input('note', 'কারণ', '', { cls: 'span-all', ph: 'যেমন: টেন্ডার #১ এর কাজে, নষ্ট' })}
      </div>`, {
      onSave: form => {
        const f = UI.formData(form);
        const qty = U.num(f.qty);
        if (qty <= 0) { UI.toast('সঠিক পরিমাণ লিখুন', 'error'); return false; }
        DB.data.stockMoves.push({ id: U.uid(), itemId: item.id, date: f.date, type: 'adjust_out', qty, rate: item.buyRate, note: f.note || 'স্টক থেকে বাদ' });
        DB.save();
        UI.toast('স্টক হালনাগাদ হয়েছে', 'ok');
        App.route();
      }
    });
  };

  const typeName = { opening: 'শুরুর স্টক', purchase: 'ক্রয়', use: 'অর্ডারে ব্যবহার', adjust_in: 'যোগ', adjust_out: 'বাদ' };
  const historyModal = item => {
    const moves = DB.list('stockMoves').filter(m => m.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date));
    UI.modal(`${item.name} — স্টকের ইতিহাস`, moves.length ? `<div class="table-wrap"><table class="tbl small">
      <thead><tr><th>তারিখ</th><th>ধরন</th><th>বিবরণ</th><th class="num">পরিমাণ</th><th></th></tr></thead>
      <tbody>${moves.map(m => {
        const out = m.type === 'use' || m.type === 'adjust_out';
        return `<tr><td class="nowrap">${U.dateShort(m.date)}</td><td>${typeName[m.type] || m.type}</td><td>${U.t(m.note || '')}</td>
          <td class="num ${out ? 'text-red' : 'text-green'}">${out ? '-' : '+'}${U.count(m.qty)} ${U.esc(item.unit)}</td>
          <td>${m.ref ? '' : `<button type="button" class="btn-icon small" data-delmove="${m.id}" title="মুছুন">✕</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>` : UI.empty('কোনো লেনদেন নেই'), {
      wide: true,
      onMount: (m, close) => m.addEventListener('click', async e => {
        const b = e.target.closest('[data-delmove]');
        if (!b) return;
        close();
        if (await UI.confirm('এই স্টক রেকর্ডটি মুছবেন? (ক্রয়ের সাথে যুক্ত খরচও মুছে যাবে)', 'মুছুন')) {
          DB.data.stockMoves = DB.data.stockMoves.filter(x => x.id !== b.dataset.delmove);
          DB.data.expenses = DB.data.expenses.filter(x => x.ref !== 'move:' + b.dataset.delmove);
          DB.save(); App.route();
        }
      })
    });
  };

  const draw = () => {
    const items = DB.list('inventory').filter(i => (!cat || i.category === cat) && U.match(search, i.name));
    const totalValue = U.sum(DB.list('inventory'), i => Math.max(0, Calc.stock(i.id)) * U.num(i.buyRate));
    root.querySelector('#inv-value').textContent = U.money(totalValue);
    root.querySelector('#inv-body').innerHTML = items.length ? items.map(i => {
      const s = Calc.stock(i.id);
      const low = U.num(i.minStock) > 0 && s < U.num(i.minStock);
      return `<tr>
        <td><b>${U.esc(i.name)}</b></td><td>${U.esc(i.category)}</td>
        <td class="num ${low ? 'text-red bold' : ''}">${U.count(s)} ${U.esc(i.unit)}${low ? ' ⚠' : ''}</td>
        <td class="num">${U.money(i.buyRate)}</td><td class="num">${U.money(i.sellRate)}</td>
        <td class="num">${U.money(Math.max(0, s) * U.num(i.buyRate))}</td>
        <td class="nowrap"><button class="btn btn-sm btn-green" data-buy="${i.id}">+ ক্রয়</button>
          <button class="btn btn-sm" data-use="${i.id}">− বাদ</button>
          <button class="btn btn-sm" data-hist="${i.id}">ইতিহাস</button>
          <button class="btn btn-sm" data-edit="${i.id}">✎</button>
          <button class="btn btn-sm btn-danger" data-del="${i.id}">✕</button></td></tr>`;
    }).join('') : `<tr><td colspan="7">${UI.empty('কোনো কাপড়/মালামাল নেই')}</td></tr>`;
  };

  root.innerHTML = `
    <div class="page-head"><h2>কাপড় ও স্টক</h2><button class="btn btn-gold" id="add-i">+ নতুন কাপড়/মালামাল</button></div>
    <div class="card">
      <div class="toolbar">
        <input type="text" id="i-search" placeholder="খুঁজুন...">
        <select id="i-cat">${UI.opts(CFG.invCats, '', 'সব ক্যাটাগরি')}</select>
        <span class="small text-muted">স্টকের মোট মূল্য (ক্রয়মূল্যে): <b id="inv-value"></b></span>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>নাম</th><th>ক্যাটাগরি</th><th class="num">বর্তমান স্টক</th><th class="num">ক্রয়মূল্য</th><th class="num">বিক্রয়মূল্য</th><th class="num">স্টকের মূল্য</th><th></th></tr></thead>
        <tbody id="inv-body"></tbody>
      </table></div>
    </div>`;
  root.querySelector('#i-search').addEventListener('input', e => { search = e.target.value; draw(); });
  root.querySelector('#i-cat').addEventListener('change', e => { cat = e.target.value; draw(); });
  root.querySelector('#add-i').addEventListener('click', () => editModal(null));
  root.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    const get = k => DB.get('inventory', b.dataset[k]);
    if (b.dataset.buy) purchaseModal(get('buy'));
    else if (b.dataset.use) useModal(get('use'));
    else if (b.dataset.hist) historyModal(get('hist'));
    else if (b.dataset.edit) editModal(get('edit'));
    else if (b.dataset.del) {
      const it = get('del');
      if (DB.list('stockMoves').some(m => m.itemId === it.id && m.ref)) { UI.toast('এই কাপড় অর্ডারে ব্যবহার হয়েছে, তাই মোছা যাবে না', 'error'); return; }
      if (await UI.confirm(`"${U.esc(it.name)}" এবং এর স্টকের ইতিহাস মুছে ফেলবেন?`, 'মুছুন')) {
        DB.data.stockMoves = DB.data.stockMoves.filter(m => m.itemId !== it.id);
        DB.remove('inventory', it.id);
        App.route();
      }
    }
  });
  draw();
};
