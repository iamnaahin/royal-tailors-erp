/* রিপোর্ট */
Pages.reports = function (root) {
  const mk = U.monthKey(U.today());
  let from = U.monthStart(mk), to = U.monthEnd(mk);

  const build = () => {
    const orders = DB.list('orders').filter(o => o.status !== 'cancelled' && U.inRange(o.date, from, to));
    const delivered = DB.list('orders').filter(o => o.status === 'delivered' && U.inRange(o.deliveredDate, from, to));
    const led = Calc.ledger(from, to);
    const inc = U.sum(led.filter(r => r.dir === 'in'), r => r.amount);
    const exp = U.sum(led.filter(r => r.dir === 'out'), r => r.amount);
    const incOrder = U.sum(led.filter(r => r.cat === 'অর্ডার আদায়'), r => r.amount);
    const incTender = U.sum(led.filter(r => r.cat === 'টেন্ডার আদায়'), r => r.amount);

    const g = {};
    for (const o of orders) for (const it of o.items) {
      const k = it.garment;
      g[k] = g[k] || { qty: 0, amount: 0 };
      g[k].qty += U.num(it.qty);
      g[k].amount += Calc.itemTotal(it);
    }
    const gRows = Object.entries(g).sort((a, b) => b[1].qty - a[1].qty);
    const maxQ = Math.max(1, ...gRows.map(([, v]) => v.qty));

    const cats = {};
    led.filter(r => r.dir === 'out').forEach(r => { cats[r.cat] = (cats[r.cat] || 0) + r.amount; });

    const dues = DB.list('orders').filter(o => Calc.orderDue(o) > 0).sort((a, b) => Calc.orderDue(b) - Calc.orderDue(a));
    const tDues = DB.list('tenders').filter(t => Calc.tenderDue(t) > 0);
    const ws = DB.list('workers').map(w => ({ w, e: Calc.workerEarned(w.id, from, to), p: Calc.workerPaid(w.id, from, to), b: Calc.workerBalance(w.id) }))
      .filter(x => x.e || x.p || x.b);
    const tenders = DB.list('tenders').filter(t => U.inRange(t.publishDate, from, to));
    const custName = id => DB.get('customers', id)?.name || '—';

    return `
      <div class="stats">
        <div class="stat blue"><div class="lbl">নতুন অর্ডার</div><div class="val">${U.count(orders.length)}</div><div class="sub">${U.count(U.sum(orders, o => Calc.pieces(o)))} পিস · মূল্য ${U.money(U.sum(orders, o => Calc.orderTotal(o)))}</div></div>
        <div class="stat gold"><div class="lbl">ডেলিভারি সম্পন্ন</div><div class="val">${U.count(delivered.length)}</div></div>
        <div class="stat green"><div class="lbl">মোট আয়</div><div class="val">${U.money(inc)}</div><div class="sub">অর্ডার ${U.money(incOrder)} · টেন্ডার ${U.money(incTender)}</div></div>
        <div class="stat red"><div class="lbl">মোট ব্যয়</div><div class="val">${U.money(exp)}</div></div>
        <div class="stat ${inc - exp >= 0 ? 'green' : 'red'}"><div class="lbl">লাভ/ক্ষতি (নগদ ভিত্তিতে)</div><div class="val">${U.money(inc - exp)}</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>পোশাক অনুযায়ী অর্ডার</h3>
          ${gRows.length ? gRows.map(([k, v]) => `<div class="bar-row"><span>${CFG.garmentName(k)}</span><div class="bar"><span style="width:${Math.round(v.qty / maxQ * 100)}%"></span></div><span class="small num">${U.count(v.qty)} পিস<br>${U.money(v.amount)}</span></div>`).join('') : UI.empty('এই সময়ে কোনো অর্ডার নেই')}
        </div>
        <div class="card"><h3>ব্যয়ের খাত</h3>
          ${Object.keys(cats).length ? `<table class="tbl small"><tbody>${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${U.esc(c)}</td><td class="num">${U.money(v)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>মোট</td><td class="num">${U.money(exp)}</td></tr></tfoot></table>` : UI.empty('কোনো ব্যয় নেই')}
        </div>
      </div>
      <div class="card"><h3>কারিগরের মজুরি</h3>
        ${ws.length ? `<div class="table-wrap"><table class="tbl small"><thead><tr><th>কারিগর</th><th class="num">এই সময়ে অর্জন</th><th class="num">এই সময়ে পরিশোধ</th><th class="num">বর্তমান মোট পাওনা</th></tr></thead>
          <tbody>${ws.map(x => `<tr><td>${U.esc(x.w.name)}</td><td class="num">${U.money(x.e)}</td><td class="num">${U.money(x.p)}</td><td class="num ${x.b > 0 ? 'text-red' : ''}">${U.money(x.b)}</td></tr>`).join('')}</tbody></table></div>` : UI.empty('কোনো তথ্য নেই')}
      </div>
      <div class="grid-2">
        <div class="card"><h3>গ্রাহকের বকেয়া (সব সময়ের)</h3>
          ${dues.length ? `<div class="table-wrap"><table class="tbl small"><thead><tr><th>অর্ডার</th><th>গ্রাহক</th><th>অবস্থা</th><th class="num">বকেয়া</th></tr></thead>
          <tbody>${dues.map(o => `<tr><td><a href="#/orders/view/${o.id}">#${U.bn(o.no)}</a></td><td>${U.esc(custName(o.customerId))}</td><td>${UI.orderBadge(o)}</td><td class="num text-red">${U.money(Calc.orderDue(o))}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">মোট</td><td class="num">${U.money(U.sum(dues, o => Calc.orderDue(o)))}</td></tr></tfoot></table></div>` : UI.empty('কোনো বকেয়া নেই')}
        </div>
        <div class="card"><h3>প্রতিষ্ঠানের বকেয়া</h3>
          ${tDues.length ? `<table class="tbl small"><tbody>${tDues.map(t => `<tr><td><a href="#/tenders/view/${t.id}">${U.esc(DB.get('institutions', t.institutionId)?.name || '')}</a><br>${U.esc(t.title)}</td><td class="num text-red">${U.money(Calc.tenderDue(t))}</td></tr>`).join('')}</tbody></table>` : UI.empty('কোনো বকেয়া নেই')}
          <h3 style="margin-top:16px">এই সময়ের টেন্ডার</h3>
          ${tenders.length ? `<ul class="list-plain">${tenders.map(t => `<li><a href="#/tenders/view/${t.id}">${U.esc(t.title)}</a><span>${UI.tenderBadge(t)}</span></li>`).join('')}</ul>` : UI.empty('নতুন কোনো টেন্ডার নেই')}
        </div>
      </div>`;
  };

  const draw = () => { root.querySelector('#rep').innerHTML = build(); };
  root.innerHTML = `
    <div class="page-head"><h2>রিপোর্ট</h2>
      <div class="btn-row">
        <label class="small">থেকে <input type="date" id="r-from" value="${from}" style="width:auto"></label>
        <label class="small">পর্যন্ত <input type="date" id="r-to" value="${to}" style="width:auto"></label>
        <select id="r-quick" style="width:auto">${UI.opts([['', 'দ্রুত বাছাই'], ['month', 'এই মাস'], ['last', 'গত মাস'], ['year', 'এই বছর'], ['all', 'সব সময়']], '')}</select>
        <button class="btn" id="r-print">🖨 প্রিন্ট</button>
      </div></div>
    <div id="rep"></div>`;
  root.querySelector('#r-from').addEventListener('change', e => { from = e.target.value; draw(); });
  root.querySelector('#r-to').addEventListener('change', e => { to = e.target.value; draw(); });
  root.querySelector('#r-quick').addEventListener('change', e => {
    const T = U.today();
    const v = e.target.value;
    if (v === 'month') { from = U.monthStart(U.monthKey(T)); to = U.monthEnd(U.monthKey(T)); }
    if (v === 'last') { const d = U.parse(T); d.setDate(1); d.setMonth(d.getMonth() - 1); const k = U.monthKey(U.iso(d)); from = U.monthStart(k); to = U.monthEnd(k); }
    if (v === 'year') { from = T.slice(0, 4) + '-01-01'; to = T.slice(0, 4) + '-12-31'; }
    if (v === 'all') { from = '2000-01-01'; to = '2100-12-31'; }
    root.querySelector('#r-from').value = from; root.querySelector('#r-to').value = to;
    e.target.value = '';
    draw();
  });
  root.querySelector('#r-print').addEventListener('click', () => Print.report(`রিপোর্ট: ${U.date(from)} থেকে ${U.date(to)}`, build()));
  draw();
};
