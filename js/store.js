/* ডেটা সংরক্ষণ (ব্রাউজারের localStorage) ও হিসাব-নিকাশ */
const STORE_KEY = 'royal_tailors_erp_v1';

const DB = {
  data: null,

  empty() {
    return {
      version: 1,
      settings: {
        shopName: 'রয়্যাল টেইলার্স',
        tagline: 'অভিজাত পুরুষদের পোশাক তৈরির বিশ্বস্ত প্রতিষ্ঠান',
        address: 'কক্সবাজার',
        phone: '',
        receiptNote: 'ডেলিভারির সময় অবশ্যই এই রসিদ সাথে আনবেন। ৩০ দিনের মধ্যে পোশাক না নিলে দোকান দায়ী থাকবে না।',
        prices: { ...CFG.defaultPrices },
        wages: { ...CFG.defaultWages },
        deliveryDays: 7,
        orderNo: 1001,
        tenderNo: 1
      },
      customers: [],
      orders: [],
      institutions: [],
      tenders: [],
      workers: [],
      workerPayments: [],
      inventory: [],
      stockMoves: [],
      expenses: [],
      meta: { lastBackup: null, createdAt: U.today() }
    };
  },

  /** true ফেরত দেয় যদি আগে থেকে ডেটা থাকে */
  load() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try { this.data = JSON.parse(raw); } catch (e) { this.data = null; }
    }
    if (!this.data) { this.data = this.empty(); return false; }
    this.migrate();
    return true;
  },

  /** পুরনো ডেটাতে নতুন ঘর যোগ */
  migrate() {
    const base = this.empty();
    for (const k of Object.keys(base)) if (this.data[k] === undefined) this.data[k] = base[k];
    this.data.settings = { ...base.settings, ...this.data.settings };
    this.data.settings.prices = { ...CFG.defaultPrices, ...this.data.settings.prices };
    this.data.settings.wages = { ...CFG.defaultWages, ...this.data.settings.wages };
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      UI.toast('ডেটা সংরক্ষণ করা যায়নি! এখনই ব্যাকআপ ডাউনলোড করুন।', 'error');
      return false;
    }
  },

  get s() { return this.data.settings; },
  list(coll) { return this.data[coll]; },
  get(coll, id) { return this.data[coll].find(x => x.id === id) || null; },
  upsert(coll, obj) {
    if (!obj.id) obj.id = U.uid();
    if (!obj.createdAt) obj.createdAt = U.today();
    const arr = this.data[coll];
    const i = arr.findIndex(x => x.id === obj.id);
    if (i >= 0) arr[i] = obj; else arr.push(obj);
    this.save();
    return obj;
  },
  remove(coll, id) {
    this.data[coll] = this.data[coll].filter(x => x.id !== id);
    this.save();
  },
  nextOrderNo() { const n = this.s.orderNo || 1001; this.s.orderNo = n + 1; return n; },
  nextTenderNo() { const n = this.s.tenderNo || 1; this.s.tenderNo = n + 1; return n; },

  /** অর্ডারে দোকানের কাপড় ব্যবহার হলে স্টক থেকে বাদ */
  syncOrderStock(order) {
    const ref = 'order:' + order.id;
    this.data.stockMoves = this.data.stockMoves.filter(m => m.ref !== ref);
    if (order.status === 'cancelled') return;
    for (const it of order.items) {
      if (it.fabricSource === 'shop' && it.fabricId && U.num(it.fabricQty) > 0) {
        this.data.stockMoves.push({
          id: U.uid(), itemId: it.fabricId, date: order.date, type: 'use',
          qty: U.num(it.fabricQty), rate: U.num(it.fabricRate),
          note: `অর্ডার #${order.no} — ${CFG.garmentName(it.garment)}`, ref
        });
      }
    }
  },

  exportJSON() { return JSON.stringify(this.data, null, 1); },
  importJSON(text) {
    const d = JSON.parse(text);
    if (!d || !d.settings || !Array.isArray(d.orders) || !Array.isArray(d.customers)) {
      throw new Error('ফাইলটি রয়্যাল টেইলার্স ইআরপি-র ব্যাকআপ নয়');
    }
    this.data = d;
    this.migrate();
    this.save();
  },
  reset() { this.data = this.empty(); this.save(); }
};

/* ---------------- হিসাব-নিকাশ ---------------- */
const Calc = {
  statusIdx(st) { return CFG.orderStatuses.findIndex(s => s[0] === st); },
  readyIdx() { return this.statusIdx('ready'); },

  itemTotal(it) {
    const stitch = U.num(it.qty) * U.num(it.rate);
    const fabric = it.fabricSource === 'shop' ? U.num(it.fabricQty) * U.num(it.fabricRate) : 0;
    return stitch + fabric;
  },
  orderSubtotal(o) { return U.sum(o.items, it => this.itemTotal(it)); },
  orderTotal(o) { return this.orderSubtotal(o) - U.num(o.discount); },
  orderPaid(o) { return U.sum(o.payments || [], p => p.amount); },
  orderDue(o) { return o.status === 'cancelled' ? 0 : this.orderTotal(o) - this.orderPaid(o); },
  isActive(o) { return o.status !== 'delivered' && o.status !== 'cancelled'; },
  isOverdue(o) { return this.isActive(o) && o.deliveryDate && o.deliveryDate < U.today(); },
  pieces(o) { return U.sum(o.items, it => it.qty); },
  orderSummary(o) {
    return o.items.map(it => `${CFG.garmentName(it.garment)}${U.num(it.qty) > 1 ? ' × ' + U.bn(it.qty) : ''}`).join(', ');
  },

  customerOrders(cid) { return DB.list('orders').filter(o => o.customerId === cid); },
  customerDue(cid) { return U.sum(this.customerOrders(cid), o => Math.max(0, this.orderDue(o))); },
  latestMeasurement(cust, tpl) {
    const h = cust?.measurements?.[tpl];
    return h && h.length ? h[h.length - 1] : null;
  },

  /* টেন্ডার */
  tenderValue(t) { return U.sum(t.items, it => U.num(it.qty) * U.num(it.rate)); },
  tenderQty(t) { return U.sum(t.items, it => it.qty); },
  delivered(t, itemId) { return U.sum((t.deliveries || []).filter(d => d.itemId === itemId), d => d.qty); },
  produced(t, itemId) { return U.sum((t.production || []).filter(d => d.itemId === itemId), d => d.qty); },
  tenderDeliveredQty(t) { return U.sum(t.deliveries || [], d => d.qty); },
  tenderDeliveredValue(t) {
    return U.sum(t.items, it => this.delivered(t, it.id) * U.num(it.rate));
  },
  tenderPaid(t) { return U.sum(t.payments || [], p => p.amount); },
  tenderDue(t) { return this.tenderDeliveredValue(t) - this.tenderPaid(t); },
  tenderProgress(t) {
    const q = this.tenderQty(t);
    return q ? Math.min(100, Math.round(this.tenderDeliveredQty(t) / q * 100)) : 0;
  },

  /* স্টক */
  stock(itemId) {
    let s = 0;
    for (const m of DB.list('stockMoves')) {
      if (m.itemId !== itemId) continue;
      if (m.type === 'use' || m.type === 'adjust_out') s -= U.num(m.qty);
      else s += U.num(m.qty);
    }
    return U.round2(s);
  },

  /* কারিগর: সব কাজের তালিকা */
  workerJobs(wid) {
    const jobs = [];
    const rIdx = this.readyIdx();
    for (const o of DB.list('orders')) {
      if (o.status === 'cancelled') continue;
      const done = this.statusIdx(o.status) >= rIdx;
      for (const it of o.items) {
        if (it.workerId !== wid) continue;
        jobs.push({
          kind: 'order', ref: o.id, title: `অর্ডার #${o.no}`, garment: CFG.garmentName(it.garment),
          qty: U.num(it.qty), wage: U.num(it.wage), amount: U.num(it.qty) * U.num(it.wage),
          done, date: done ? (o.readyDate || o.deliveryDate) : o.deliveryDate
        });
      }
    }
    for (const t of DB.list('tenders')) {
      for (const p of t.production || []) {
        if (p.workerId !== wid) continue;
        const it = t.items.find(i => i.id === p.itemId);
        jobs.push({
          kind: 'tender', ref: t.id, title: `টেন্ডার #${t.no}`, garment: it ? it.name : '—',
          qty: U.num(p.qty), wage: U.num(p.wage), amount: U.num(p.qty) * U.num(p.wage),
          done: true, date: p.date
        });
      }
    }
    return jobs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  workerEarned(wid, from, to) {
    return U.sum(this.workerJobs(wid).filter(j => j.done && U.inRange(j.date, from, to)), j => j.amount);
  },
  workerPaid(wid, from, to) {
    return U.sum(DB.list('workerPayments').filter(p => p.workerId === wid && U.inRange(p.date, from, to)), p => p.amount);
  },
  workerBalance(wid) { return this.workerEarned(wid) - this.workerPaid(wid); },

  /* আয়-ব্যয়ের খতিয়ান */
  ledger(from, to) {
    const rows = [];
    const custName = id => DB.get('customers', id)?.name || '—';
    for (const o of DB.list('orders')) {
      for (const p of o.payments || []) {
        if (!U.inRange(p.date, from, to)) continue;
        rows.push({ date: p.date, dir: 'in', cat: 'অর্ডার আদায়', desc: `অর্ডার #${U.bn(o.no)} — ${custName(o.customerId)}`, method: p.method, amount: U.num(p.amount), link: '#/orders/view/' + o.id });
      }
    }
    for (const t of DB.list('tenders')) {
      const inst = DB.get('institutions', t.institutionId)?.name || '—';
      for (const p of t.payments || []) {
        if (!U.inRange(p.date, from, to)) continue;
        rows.push({ date: p.date, dir: 'in', cat: 'টেন্ডার আদায়', desc: `টেন্ডার #${U.bn(t.no)} — ${inst}`, method: p.method, amount: U.num(p.amount), link: '#/tenders/view/' + t.id });
      }
    }
    for (const e of DB.list('expenses')) {
      if (!U.inRange(e.date, from, to)) continue;
      rows.push({ date: e.date, dir: 'out', cat: e.category, desc: e.note || e.category, method: e.method, amount: U.num(e.amount), expenseId: e.id, linked: !!e.ref });
    }
    for (const p of DB.list('workerPayments')) {
      if (!U.inRange(p.date, from, to)) continue;
      const w = DB.get('workers', p.workerId);
      rows.push({ date: p.date, dir: 'out', cat: 'কারিগর মজুরি', desc: `${w ? w.name : 'কারিগর'}${p.note ? ' — ' + p.note : ''}`, method: p.method, amount: U.num(p.amount), link: '#/workers/view/' + p.workerId });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }
};

/* ---------------- নমুনা ডেটা ---------------- */
DB.seed = function () {
  const d = this.empty();
  const T = U.today();
  const day = n => U.addDays(T, n);
  const id = () => U.uid();

  const w1 = { id: id(), name: 'জামাল উদ্দিন', phone: '01700-000101', skill: 'শার্ট, প্যান্ট, স্কুল ড্রেস', rates: { ...CFG.defaultWages }, active: true, joinDate: day(-400), createdAt: day(-400) };
  const w2 = { id: id(), name: 'নুরুল আলম', phone: '01700-000102', skill: 'স্যুট, কোট, ব্লেজার', rates: { ...CFG.defaultWages, suit: 1800, coat: 1300 }, active: true, joinDate: day(-700), createdAt: day(-700) };
  const w3 = { id: id(), name: 'শফিকুল ইসলাম', phone: '01700-000103', skill: 'পাঞ্জাবি, পায়জামা', rates: { ...CFG.defaultWages, punjabi: 250 }, active: true, joinDate: day(-200), createdAt: day(-200) };
  d.workers.push(w1, w2, w3);

  const f1 = { id: id(), name: 'সাদা কটন শার্টিং', category: 'কাপড়', unit: 'গজ', minStock: 20, buyRate: 180, sellRate: 260, createdAt: day(-60) };
  const f2 = { id: id(), name: 'নেভি ব্লু টেট্রন (প্যান্ট)', category: 'কাপড়', unit: 'গজ', minStock: 15, buyRate: 260, sellRate: 380, createdAt: day(-60) };
  const f3 = { id: id(), name: 'ছাই রঙের স্যুটিং (উল মিশ্রিত)', category: 'কাপড়', unit: 'গজ', minStock: 10, buyRate: 650, sellRate: 950, createdAt: day(-60) };
  const f4 = { id: id(), name: 'সাদা পাঞ্জাবি কাপড় (সুতি)', category: 'কাপড়', unit: 'গজ', minStock: 15, buyRate: 220, sellRate: 320, createdAt: day(-60) };
  const f5 = { id: id(), name: 'কোট লাইনিং', category: 'লাইনিং', unit: 'গজ', minStock: 10, buyRate: 120, sellRate: 180, createdAt: day(-60) };
  const f6 = { id: id(), name: 'শার্টের বোতাম', category: 'বোতাম', unit: 'ডজন', minStock: 10, buyRate: 40, sellRate: 60, createdAt: day(-60) };
  d.inventory.push(f1, f2, f3, f4, f5, f6);
  const opening = [[f1, 85], [f2, 60], [f3, 9], [f4, 40], [f5, 30], [f6, 25]];
  for (const [f, q] of opening) d.stockMoves.push({ id: id(), itemId: f.id, date: day(-60), type: 'opening', qty: q, rate: f.buyRate, note: 'শুরুর স্টক' });

  const m = (shirt, pant) => ({ shirt: [{ date: day(-30), values: shirt, note: '' }], pant: [{ date: day(-30), values: pant, note: '' }] });
  const c1 = { id: id(), name: 'মোঃ রফিকুল ইসলাম', phone: '01800-000201', address: 'কলাতলী, কক্সবাজার', type: 'regular', note: 'নিয়মিত গ্রাহক', createdAt: day(-90),
    measurements: { ...m({ length: '30', chest: '40', belly: '38', hip: '41', shoulder: '18', sleeve: '24.5', cuff: '9.5', collar: '15.5', armhole: '19' }, { length: '40', waist: '34', hip: '41', thigh: '25', knee: '18', bottom: '15', fork: '11' }),
      coat: [{ date: day(-30), values: { length: '29', chest: '41', belly: '39', hip: '42', shoulder: '18', sleeve: '24.5', cuff: '11', back: '16', neck: '16' }, note: '' }] } };
  const c2 = { id: id(), name: 'আবদুল করিম', phone: '01800-000202', address: 'বাজারঘাটা, কক্সবাজার', type: 'regular', note: '', createdAt: day(-50),
    measurements: { punjabi: [{ date: day(-20), values: { length: '42', chest: '42', belly: '40', hip: '44', shoulder: '18.5', sleeve: '24', cuff: '10', neck: '16', placket: '10' }, note: 'লম্বা একটু বেশি পছন্দ করেন' }],
      paijama: [{ date: day(-20), values: { length: '41', waist: '36', hip: '44', thigh: '26', knee: '19', bottom: '14' }, note: '' }] } };
  const c3 = { id: id(), name: 'তানভীর হাসান', phone: '01800-000203', address: 'টেকপাড়া, কক্সবাজার', type: 'student', school: 'নমুনা উচ্চ বিদ্যালয়', cls: 'নবম', note: '', createdAt: day(-15),
    measurements: m({ length: '27', chest: '33', belly: '30', hip: '34', shoulder: '15.5', sleeve: '21', cuff: '8.5', collar: '13.5', armhole: '16' }, { length: '37', waist: '28', hip: '35', thigh: '21', knee: '16', bottom: '14', fork: '10' }) };
  const c4 = { id: id(), name: 'সাইফুল আমিন', phone: '01800-000204', address: 'লাবণী পয়েন্ট, কক্সবাজার', type: 'regular', note: '', createdAt: day(-10),
    measurements: m({ length: '31', chest: '42', belly: '40', hip: '43', shoulder: '18.5', sleeve: '25', cuff: '10', collar: '16', armhole: '20' }, { length: '41', waist: '36', hip: '43', thigh: '26', knee: '19', bottom: '15.5', fork: '11.5' }) };
  d.customers.push(c1, c2, c3, c4);

  const latest = (c, tpl) => ({ ...(c.measurements[tpl]?.[0]?.values || {}) });
  const item = (garment, c, extra) => {
    const parts = CFG.garments[garment].parts;
    const measurement = {}; const style = {};
    for (const p of parts) { measurement[p] = latest(c, p); style[p] = {}; }
    return { id: id(), garment, qty: 1, rate: CFG.defaultPrices[garment], fabricSource: 'customer', fabricId: '', fabricQty: 0, fabricRate: 0, workerId: '', wage: 0, school: '', note: '', measurement, style, ...extra };
  };
  let no = 1001;
  const order = (c, o) => {
    const ord = { id: id(), no: no++, customerId: c.id, discount: 0, note: '', createdAt: o.date, statusLog: [{ status: 'new', date: o.date }], payments: [], ...o };
    if (ord.status !== 'new') ord.statusLog.push({ status: ord.status, date: T });
    if (Calc.statusIdx(ord.status) >= Calc.readyIdx() && ord.status !== 'cancelled') ord.readyDate = ord.status === 'delivered' ? day(-3) : day(-1);
    if (ord.status === 'delivered') ord.deliveredDate = day(-2);
    return ord;
  };
  d.orders.push(
    order(c1, { date: day(-12), trialDate: day(-4), deliveryDate: day(-2), status: 'delivered',
      items: [item('suit', c1, { workerId: w2.id, wage: 1800, fabricSource: 'shop', fabricId: f3.id, fabricQty: 3.5, fabricRate: 950, style: { coat: { buttons: 'দুই বোতাম', lapel: 'নচ ল্যাপেল', vent: 'ডাবল ভেন্ট', lining: 'ফুল লাইনিং' }, pant: { pleat: 'প্লেট ছাড়া' }, _g: { pieces: '২ পিস (কোট+প্যান্ট)' } } })],
      payments: [{ id: id(), date: day(-12), amount: 4000, method: 'ক্যাশ', note: 'অগ্রিম' }, { id: id(), date: day(-2), amount: 4825, method: 'বিকাশ', note: 'বাকি পরিশোধ' }] }),
    order(c2, { date: day(-6), trialDate: '', deliveryDate: T, status: 'ready',
      items: [item('punjabi', c2, { qty: 2, workerId: w3.id, wage: 250, style: { punjabi: { collarType: 'বেল্ট কলার', cut: 'কাবলি' } } }), item('paijama', c2, { qty: 2, workerId: w3.id, wage: 100 })],
      payments: [{ id: id(), date: day(-6), amount: 1000, method: 'ক্যাশ', note: 'অগ্রিম' }] }),
    order(c3, { date: day(-4), trialDate: '', deliveryDate: day(2), status: 'sewing',
      items: [item('school', c3, { qty: 2, rate: 900, school: 'নমুনা উচ্চ বিদ্যালয়', workerId: w1.id, wage: 300, fabricSource: 'shop', fabricId: f1.id, fabricQty: 3, fabricRate: 260 })],
      payments: [{ id: id(), date: day(-4), amount: 1000, method: 'নগদ', note: 'অগ্রিম' }] }),
    order(c4, { date: day(-9), trialDate: day(-1), deliveryDate: day(-1), status: 'trial',
      items: [item('shirt', c4, { qty: 3, workerId: w1.id, wage: 150, fabricSource: 'shop', fabricId: f1.id, fabricQty: 7.5, fabricRate: 260, style: { shirt: { collarType: 'স্প্রেড', sleeveType: 'ফুল হাতা', fit: 'স্লিম' } } }), item('pant', c4, { qty: 2, workerId: w1.id, wage: 180 })],
      payments: [{ id: id(), date: day(-9), amount: 2000, method: 'ক্যাশ', note: 'অগ্রিম' }] }),
    order(c1, { date: T, trialDate: day(5), deliveryDate: day(8), status: 'new',
      items: [item('shirt', c1, { qty: 2 })], payments: [] })
  );
  d.settings.orderNo = no;
  for (const o of d.orders) {
    DB.data = d; // syncOrderStock ব্যবহার করে
    DB.syncOrderStock(o);
  }

  const i1 = { id: id(), name: 'হোটেল নীল দিগন্ত (নমুনা)', type: 'hotel', contact: 'জনাব মাহমুদ (এইচআর ম্যানেজার)', phone: '01900-000301', address: 'হোটেল-মোটেল জোন, কলাতলী', note: '', createdAt: day(-80) };
  const i2 = { id: id(), name: 'সমুদ্রবিলাস রিসোর্ট (নমুনা)', type: 'hotel', contact: 'জনাব রাশেদ (ক্রয় বিভাগ)', phone: '01900-000302', address: 'মেরিন ড্রাইভ, ইনানী', note: '', createdAt: day(-40) };
  const i3 = { id: id(), name: 'নমুনা উচ্চ বিদ্যালয়', type: 'school', contact: 'প্রধান শিক্ষক', phone: '01900-000303', address: 'কক্সবাজার সদর', note: '', createdAt: day(-40) };
  d.institutions.push(i1, i2, i3);

  const ti = (name, garment, qty, rate, wage, spec) => ({ id: id(), name, garment, qty, rate, wage, spec });
  const t1Items = [ti('ওয়েটার শার্ট (সাদা)', 'shirt', 40, 650, 160, 'সাদা কটন, হোটেলের লোগো এমব্রয়ডারি'), ti('ওয়েটার প্যান্ট (কালো)', 'pant', 40, 750, 190, 'কালো টেট্রন'), ti('রিসেপশন স্যুট', 'suit', 8, 7500, 1800, 'নেভি ব্লু, ২ পিস')];
  const t1 = { id: id(), no: 1, institutionId: i1.id, title: 'ওয়েটার ও রিসেপশন স্টাফ ইউনিফর্ম ২০২৬', ref: 'HND/PUR/2026/14', publishDate: day(-45), submissionDate: day(-35), deadline: day(15), status: 'production', deposit: 10000, note: 'কার্যাদেশ পাওয়া গেছে। দুই কিস্তিতে ডেলিভারি।', createdAt: day(-45),
    items: t1Items,
    staff: [
      { id: id(), name: 'মোঃ সোহেল', designation: 'ওয়েটার', sizes: 'শার্ট: M (বুক ৩৮), প্যান্ট: কোমর ৩২ লম্বা ৩৯', note: '' },
      { id: id(), name: 'রুবেল দাশ', designation: 'ওয়েটার', sizes: 'শার্ট: L (বুক ৪০), প্যান্ট: কোমর ৩৪ লম্বা ৪০', note: '' },
      { id: id(), name: 'ইমরান হোসেন', designation: 'রিসেপশনিস্ট', sizes: 'কোট: বুক ৪০ কাঁধ ১৮, প্যান্ট: কোমর ৩৩', note: 'স্লিম ফিট' }
    ],
    production: [
      { id: id(), date: day(-10), workerId: w1.id, itemId: t1Items[0].id, qty: 25, wage: 160 },
      { id: id(), date: day(-8), workerId: w1.id, itemId: t1Items[1].id, qty: 20, wage: 190 },
      { id: id(), date: day(-5), workerId: w2.id, itemId: t1Items[2].id, qty: 4, wage: 1800 }
    ],
    deliveries: [{ id: id(), date: day(-6), itemId: t1Items[0].id, qty: 20, note: 'প্রথম কিস্তি' }, { id: id(), date: day(-6), itemId: t1Items[1].id, qty: 20, note: 'প্রথম কিস্তি' }],
    payments: [{ id: id(), date: day(-3), amount: 20000, method: 'ব্যাংক', note: 'চেক' }] };
  const t2 = { id: id(), no: 2, institutionId: i2.id, title: 'হাউসকিপিং ও সিকিউরিটি ইউনিফর্ম', ref: 'SBR/2026/T-07', publishDate: day(-3), submissionDate: day(4), deadline: day(40), status: 'preparing', deposit: 5000, note: 'নমুনা পোশাক জমা দিতে হবে', createdAt: day(-3),
    items: [ti('সিকিউরিটি শার্ট (খাকি)', 'shirt', 12, 700, 160, 'খাকি রং, কাঁধে ব্যাজ'), ti('সিকিউরিটি প্যান্ট', 'pant', 12, 780, 190, ''), ti('হাউসকিপিং শার্ট', 'shirt', 20, 600, 150, 'হালকা নীল')],
    staff: [], production: [], deliveries: [], payments: [] };
  d.tenders.push(t1, t2);
  d.settings.tenderNo = 3;

  d.expenses.push(
    { id: id(), date: day(-15), category: 'দোকান ভাড়া', amount: 15000, method: 'ক্যাশ', note: 'মাসিক দোকান ভাড়া' },
    { id: id(), date: day(-12), category: 'বিদ্যুৎ বিল', amount: 2300, method: 'বিকাশ', note: '' },
    { id: id(), date: day(-5), category: 'টেন্ডার খরচ', amount: 1500, method: 'ক্যাশ', note: 'নমুনা পোশাক ও কাগজপত্র' }
  );
  d.workerPayments.push(
    { id: id(), workerId: w1.id, date: day(-7), amount: 5000, method: 'ক্যাশ', note: 'সাপ্তাহিক' },
    { id: id(), workerId: w2.id, date: day(-4), amount: 3000, method: 'ক্যাশ', note: '' }
  );
  d.meta.demo = true;
  this.data = d;
  this.save();
};
