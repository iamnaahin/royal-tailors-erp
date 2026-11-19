/* ড্যাশবোর্ড */
Pages.dashboard = function (root) {
  const T = U.today();
  const orders = DB.list('orders');
  const active = orders.filter(o => Calc.isActive(o));
  const dueToday = active.filter(o => o.deliveryDate === T);
  const overdue = active.filter(o => o.deliveryDate && o.deliveryDate < T);
  const trialsToday = active.filter(o => o.trialDate === T);
  const ready = active.filter(o => o.status === 'ready');
  const upcoming = active.filter(o => o.deliveryDate > T && o.deliveryDate <= U.addDays(T, 3))
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

  const mk = U.monthKey(T);
  const led = Calc.ledger(U.monthStart(mk), U.monthEnd(mk));
  const income = U.sum(led.filter(r => r.dir === 'in'), r => r.amount);
  const expense = U.sum(led.filter(r => r.dir === 'out'), r => r.amount);
  const todayIncome = U.sum(led.filter(r => r.dir === 'in' && r.date === T), r => r.amount);
  const custDue = U.sum(orders, o => Math.max(0, Calc.orderDue(o)));

  const tenders = DB.list('tenders');
  const runningT = tenders.filter(t => t.status === 'awarded' || t.status === 'production');
  const tenderDue = U.sum(tenders.filter(t => t.status !== 'lost' && t.status !== 'cancelled'), t => Math.max(0, Calc.tenderDue(t)));
  const tenderAlerts = [];
  for (const t of tenders) {
    if ((t.status === 'preparing') && t.submissionDate && U.diffDays(t.submissionDate, T) <= 7)
      tenderAlerts.push({ t, label: 'জমা দেওয়ার শেষ তারিখ', date: t.submissionDate });
    if ((t.status === 'awarded' || t.status === 'production') && t.deadline && U.diffDays(t.deadline, T) <= 15)
      tenderAlerts.push({ t, label: 'ডেলিভারির শেষ তারিখ', date: t.deadline });
  }
  tenderAlerts.sort((a, b) => a.date.localeCompare(b.date));

  const lowStock = DB.list('inventory').filter(i => U.num(i.minStock) > 0 && Calc.stock(i.id) < U.num(i.minStock));

  const custName = id => DB.get('customers', id)?.name || '—';
  const orderRow = (o, withDate) => `
    <li><span><a href="#/orders/view/${o.id}">#${U.bn(o.no)}</a> ${U.esc(custName(o.customerId))}
      <span class="small text-muted"> · ${U.esc(Calc.orderSummary(o))}</span></span>
      <span class="nowrap">${withDate === true ? `<span class="small">${U.esc(U.relDay(o.deliveryDate))}</span> ` : ''}${UI.orderBadge(o)}</span></li>`;

  const statusCounts = CFG.orderStatuses.filter(s => s[0] !== 'delivered' && s[0] !== 'cancelled')
    .map(([k, l]) => ({ k, l, n: active.filter(o => o.status === k).length }));

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h2>আসসালামু আলাইকুম 👋</h2>
        <div class="text-muted">${U.date(T)} · ${U.esc(DB.s.shopName)}, ${U.esc(DB.s.address)}</div>
      </div>
      <div class="btn-row">
        ${Auth.can('orders') ? '<a class="btn btn-gold" href="#/orders/new">+ নতুন অর্ডার</a>' : ''}
        ${Auth.can('customers') ? '<a class="btn" href="#/customers?new=1">+ নতুন গ্রাহক</a>' : ''}
        ${Auth.can('tenders') ? '<a class="btn" href="#/tenders/new">+ নতুন টেন্ডার</a>' : ''}
        ${Auth.can('accounts') ? '<a class="btn" href="#/accounts?expense=1">+ খরচ লিখুন</a>' : ''}
      </div>
    </div>

    <div class="stats">
      <a class="stat gold" href="#/orders?f=today"><div class="lbl">আজকের ডেলিভারি</div><div class="val">${U.count(dueToday.length)}</div><div class="sub">প্রস্তুত: ${U.count(ready.length)} টি অর্ডার</div></a>
      <a class="stat red" href="#/orders?f=overdue"><div class="lbl">বিলম্বিত অর্ডার</div><div class="val">${U.count(overdue.length)}</div><div class="sub">ডেলিভারির তারিখ পার হয়েছে</div></a>
      <a class="stat blue" href="#/orders?f=active"><div class="lbl">চলমান অর্ডার</div><div class="val">${U.count(active.length)}</div><div class="sub">মোট ${U.count(U.sum(active, o => Calc.pieces(o)))} পিস পোশাক</div></a>
      ${Auth.can('accounts') ? `<a class="stat green" href="#/accounts"><div class="lbl">এই মাসের আয়</div><div class="val">${U.money(income)}</div><div class="sub">আজ: ${U.money(todayIncome)} · ব্যয়: ${U.money(expense)}</div></a>` : ''}
      ${Auth.can('reports') ? `<a class="stat orange" href="#/reports"><div class="lbl">মোট বকেয়া</div><div class="val">${U.money(custDue + tenderDue)}</div><div class="sub">গ্রাহক ${U.money(custDue)} · প্রতিষ্ঠান ${U.money(tenderDue)}</div></a>` : ''}
      ${Auth.can('tenders') ? `<a class="stat" href="#/tenders"><div class="lbl">চলমান টেন্ডার</div><div class="val">${U.count(runningT.length)}</div><div class="sub">মোট টেন্ডার: ${U.count(tenders.length)}</div></a>` : ''}
    </div>

    <div class="card">
      <div class="card-head"><h3>চলমান অর্ডারের অবস্থা</h3></div>
      <div class="stepper">${statusCounts.map(s => `<a class="st ${s.n ? 'cur' : ''}" href="#/orders?s=${s.k}">${U.esc(s.l)}<br><b>${U.count(s.n)}</b></a>`).join('')}</div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h3>আজ ডেলিভারি ও বিলম্বিত</h3><a class="small" href="#/orders?f=overdue">সব দেখুন</a></div>
        ${dueToday.length + overdue.length ? `<ul class="list-plain">${[...overdue, ...dueToday].slice(0, 10).map(orderRow).join('')}</ul>` : UI.empty('আজ কোনো ডেলিভারি নেই')}
      </div>
      <div class="card">
        <div class="card-head"><h3>আগামী ৩ দিনের ডেলিভারি</h3></div>
        ${upcoming.length ? `<ul class="list-plain">${upcoming.slice(0, 10).map(o => orderRow(o, true)).join('')}</ul>` : UI.empty('আগামী ৩ দিনে কোনো ডেলিভারি নেই')}
      </div>
      <div class="card">
        <div class="card-head"><h3>আজকের ট্রায়াল</h3></div>
        ${trialsToday.length ? `<ul class="list-plain">${trialsToday.map(orderRow).join('')}</ul>` : UI.empty('আজ কোনো ট্রায়াল নেই')}
      </div>
      <div class="card" ${Auth.can('tenders') ? '' : 'hidden'}>
        <div class="card-head"><h3>টেন্ডারের গুরুত্বপূর্ণ তারিখ</h3><a class="small" href="#/tenders">সব টেন্ডার</a></div>
        ${tenderAlerts.length ? `<ul class="list-plain">${tenderAlerts.map(a => {
          const inst = DB.get('institutions', a.t.institutionId);
          const late = a.date < T;
          return `<li><span><a href="#/tenders/view/${a.t.id}">${U.esc(a.t.title)}</a><br><span class="small text-muted">${U.esc(inst?.name || '')} · ${a.label}</span></span>
            <span class="nowrap small ${late ? 'text-red bold' : ''}">${U.date(a.date)}<br>${U.esc(U.relDay(a.date))}</span></li>`;
        }).join('')}</ul>` : UI.empty('সামনে কোনো জরুরি তারিখ নেই')}
      </div>
    </div>

    ${lowStock.length && Auth.can('inventory') ? `<div class="card">
      <div class="card-head"><h3>⚠ স্টক কম</h3><a class="small" href="#/inventory">স্টক দেখুন</a></div>
      <ul class="list-plain">${lowStock.map(i => `<li><span>${U.esc(i.name)}</span><span class="text-red bold">${U.count(Calc.stock(i.id))} ${U.esc(i.unit)} (সর্বনিম্ন ${U.count(i.minStock)})</span></li>`).join('')}</ul>
    </div>` : ''}
  `;
};
