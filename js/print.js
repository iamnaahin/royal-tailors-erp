/* প্রিন্ট: রসিদ, মাপ-স্লিপ, কোটেশন, বিল, চালান */
const Print = {
  run(html) {
    const area = document.getElementById('print-area');
    area.innerHTML = `<div class="pr">${html}</div>`;
    document.body.classList.add('printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('printing'), 500);
    }, 150);
  },

  head(title) {
    const s = DB.s;
    return `<div class="pr-head">
      <div class="shop">${U.esc(s.shopName)}</div>
      <div class="tag">${U.esc(s.tagline || '')}</div>
      <div class="tag">${U.esc(s.address || '')}${s.phone ? ' · মোবাইল: ' + U.t(s.phone) : ''}</div>
    </div>${title ? `<div class="pr-title">${U.esc(title)}</div>` : ''}`;
  },

  measureBlock(values, tpl) {
    return `<div class="m-view">${CFG.templates[tpl].fields.map(([k, l]) =>
      `<div>${U.esc(l)}<b>${values?.[k] ? U.t(values[k]) : '—'}</b></div>`).join('')}</div>`;
  },

  receiptBody(o, copy) {
    const c = DB.get('customers', o.customerId) || {};
    const total = Calc.orderTotal(o), paid = Calc.orderPaid(o);
    const rows = [];
    for (const it of o.items) {
      rows.push(`<tr><td>${U.esc(CFG.garmentName(it.garment))}${it.school ? ' (' + U.esc(it.school) + ')' : ''}</td><td class="num">${U.bn(it.qty)}</td><td class="num">${U.money(it.rate)}</td><td class="num">${U.money(U.num(it.qty) * U.num(it.rate))}</td></tr>`);
      if (it.fabricSource === 'shop' && it.fabricId) {
        const f = DB.get('inventory', it.fabricId);
        rows.push(`<tr><td>&nbsp;&nbsp;কাপড়: ${U.esc(f?.name || '')}</td><td class="num">${U.bn(it.fabricQty)} ${U.esc(f?.unit || '')}</td><td class="num">${U.money(it.fabricRate)}</td><td class="num">${U.money(U.num(it.fabricQty) * U.num(it.fabricRate))}</td></tr>`);
      }
    }
    return `${Print.head('অর্ডার রসিদ — ' + copy)}
      <div class="meta"><span>অর্ডার নং: <b>${U.bn(o.no)}</b></span><span>তারিখ: ${U.date(o.date)}</span></div>
      <div class="meta"><span>গ্রাহক: <b>${U.esc(c.name || '')}</b></span><span>মোবাইল: ${U.t(c.phone || '')}</span></div>
      <div class="meta">${o.trialDate ? `<span>ট্রায়াল: <b>${U.date(o.trialDate)}</b></span>` : '<span></span>'}<span>ডেলিভারি: <b>${U.date(o.deliveryDate)}</b></span></div>
      <table><thead><tr><th>বিবরণ</th><th class="num">পরিমাণ</th><th class="num">দর</th><th class="num">টাকা</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot>
          ${U.num(o.discount) ? `<tr><td colspan="3" class="num">মোট</td><td class="num">${U.money(Calc.orderSubtotal(o))}</td></tr><tr><td colspan="3" class="num">ছাড়</td><td class="num">- ${U.money(o.discount)}</td></tr>` : ''}
          <tr><td colspan="3" class="num"><b>সর্বমোট</b></td><td class="num"><b>${U.money(total)}</b></td></tr>
          <tr><td colspan="3" class="num">পরিশোধিত</td><td class="num">${U.money(paid)}</td></tr>
          <tr><td colspan="3" class="num"><b>বাকি</b></td><td class="num"><b>${U.money(total - paid)}</b></td></tr>
        </tfoot></table>
      ${o.note ? `<div>নোট: ${U.esc(o.note)}</div>` : ''}
      <div class="sign"><span>গ্রাহকের স্বাক্ষর</span><span>দোকানের পক্ষে</span></div>
      <div class="foot">${U.esc(DB.s.receiptNote || '')}</div>`;
  },

  receipt(o) {
    Print.run(Print.receiptBody(o, 'গ্রাহকের কপি') + '<div class="cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>' + Print.receiptBody(o, 'দোকানের কপি'));
  },

  slip(o) {
    const c = DB.get('customers', o.customerId) || {};
    const html = o.items.map((it, i) => {
      const g = CFG.garments[it.garment];
      const fab = it.fabricId ? DB.get('inventory', it.fabricId) : null;
      const extra = (g.extra || []).filter(([k]) => it.style?._g?.[k]).map(([k, l]) => `${l}: ${it.style._g[k]}`);
      return `<div class="m-box">
        <div class="meta"><b style="font-size:15px">${U.esc(g.name)} × ${U.bn(it.qty)}</b><span>অর্ডার নং: <b>${U.bn(o.no)}</b> (${U.bn(i + 1)}/${U.bn(o.items.length)})</span></div>
        <div class="meta"><span>গ্রাহক: ${U.esc(c.name || '')}</span><span>ডেলিভারি: <b>${U.date(o.deliveryDate)}</b>${o.trialDate ? ' · ট্রায়াল: ' + U.date(o.trialDate) : ''}</span></div>
        <div class="meta"><span>কারিগর: <b>${U.esc(DB.get('workers', it.workerId)?.name || '________________')}</b></span>
          <span>কাপড়: ${it.fabricSource === 'shop' ? U.esc(fab?.name || '') + ' ' + U.bn(it.fabricQty) + ' ' + U.esc(fab?.unit || '') : 'গ্রাহকের'}</span></div>
        ${it.school ? `<div>স্কুল: ${U.esc(it.school)}</div>` : ''}
        ${extra.length ? `<div>${U.esc(extra.join(' · '))}</div>` : ''}
        ${g.parts.map(p => {
          const st = CFG.templates[p].styles.filter(([k]) => it.style?.[p]?.[k]).map(([k, l]) => `${l}: ${it.style[p][k]}`);
          return `<div style="margin-top:6px"><b>${CFG.templates[p].name} (ইঞ্চি)</b>${Print.measureBlock(it.measurement?.[p], p)}
            ${st.length ? `<div>স্টাইল: ${U.esc(st.join(' · '))}</div>` : ''}</div>`;
        }).join('')}
        ${it.note ? `<div style="margin-top:4px"><b>নোট:</b> ${U.esc(it.note)}</div>` : ''}
        ${o.note ? `<div><b>অর্ডারের নোট:</b> ${U.esc(o.note)}</div>` : ''}
      </div>`;
    }).join('');
    Print.run(Print.head('কারিগরের মাপ-স্লিপ') + html);
  },

  measurements(c) {
    const parts = Object.keys(CFG.templates).filter(t => Calc.latestMeasurement(c, t));
    Print.run(`${Print.head('গ্রাহকের মাপ')}
      <div class="meta"><span>নাম: <b>${U.esc(c.name)}</b></span><span>মোবাইল: ${U.t(c.phone || '')}</span></div>
      ${c.school ? `<div>স্কুল: ${U.esc(c.school)} ${c.cls ? '· শ্রেণি: ' + U.esc(c.cls) : ''}</div>` : ''}
      ${parts.length ? parts.map(t => {
        const m = Calc.latestMeasurement(c, t);
        return `<div class="m-box"><div class="meta"><b>${CFG.templates[t].name} (ইঞ্চি)</b><span>${U.date(m.date)}</span></div>${Print.measureBlock(m.values, t)}${m.note ? `<div>নোট: ${U.esc(m.note)}</div>` : ''}</div>`;
      }).join('') : '<p>কোনো মাপ নেই</p>'}`);
  },

  instBlock(t) {
    const i = DB.get('institutions', t.institutionId) || {};
    return `<div>বরাবর,<br><b>${U.esc(i.contact || 'কর্তৃপক্ষ')}</b><br>${U.esc(i.name || '')}<br>${U.esc(i.address || '')}</div>`;
  },

  quotation(t) {
    const total = Calc.tenderValue(t);
    Print.run(`${Print.head('দরপত্র / কোটেশন')}
      <div class="meta"><span>রেফারেন্স: ${U.t(t.ref || '—')}</span><span>তারিখ: ${U.date(U.today())}</span></div>
      ${Print.instBlock(t)}
      <p><b>বিষয়: ${U.esc(t.title)} সরবরাহের দরপত্র।</b></p>
      <p>জনাব,<br>আপনার প্রতিষ্ঠানের চাহিদা অনুযায়ী নিম্নোক্ত পোশাকসমূহ তৈরি ও সরবরাহের জন্য আমাদের দর নিচে উল্লেখ করা হলো:</p>
      <table><thead><tr><th>ক্রম</th><th>পোশাক</th><th>বিবরণ</th><th class="num">পরিমাণ</th><th class="num">দর (৳)</th><th class="num">মোট (৳)</th></tr></thead>
        <tbody>${t.items.map((it, i) => `<tr><td>${U.bn(i + 1)}</td><td>${U.esc(it.name)}</td><td>${U.esc(it.spec || '')}</td><td class="num">${U.count(it.qty)}</td><td class="num">${U.money(it.rate)}</td><td class="num">${U.money(U.num(it.qty) * U.num(it.rate))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5" class="num"><b>সর্বমোট</b></td><td class="num"><b>${U.money(total)}</b></td></tr></tfoot></table>
      ${t.deadline ? `<p>ডেলিভারি: কার্যাদেশ পাওয়ার পর ${U.date(t.deadline)} তারিখের মধ্যে।</p>` : ''}
      ${t.note ? `<p>শর্তাবলি/নোট: ${U.esc(t.note)}</p>` : ''}
      <p>সকল পোশাক নিজস্ব কারখানায় দক্ষ কারিগর দ্বারা প্রত্যেক কর্মীর সঠিক মাপ নিয়ে তৈরি করা হবে।</p>
      <div class="sign"><span></span><span>স্বত্বাধিকারী<br>${U.esc(DB.s.shopName)}</span></div>`);
  },

  tenderBill(t) {
    const rows = t.items.map(it => ({ it, q: Calc.delivered(t, it.id) })).filter(r => r.q > 0);
    const dv = Calc.tenderDeliveredValue(t), paid = Calc.tenderPaid(t);
    Print.run(`${Print.head('বিল')}
      <div class="meta"><span>বিল নং: ${U.bn(`${t.no}/${U.today().replace(/-/g, '')}`)}</span><span>তারিখ: ${U.date(U.today())}</span></div>
      ${Print.instBlock(t)}
      <p>বিষয়: ${U.esc(t.title)}${t.ref ? ' (রেফারেন্স: ' + U.t(t.ref) + ')' : ''}</p>
      <table><thead><tr><th>ক্রম</th><th>পোশাক</th><th class="num">সরবরাহকৃত পরিমাণ</th><th class="num">দর (৳)</th><th class="num">মোট (৳)</th></tr></thead>
        <tbody>${rows.length ? rows.map((r, i) => `<tr><td>${U.bn(i + 1)}</td><td>${U.esc(r.it.name)}</td><td class="num">${U.count(r.q)}</td><td class="num">${U.money(r.it.rate)}</td><td class="num">${U.money(r.q * U.num(r.it.rate))}</td></tr>`).join('') : '<tr><td colspan="5">এখনো কোনো ডেলিভারি হয়নি</td></tr>'}</tbody>
        <tfoot>
          <tr><td colspan="4" class="num">সরবরাহকৃত মালের মোট মূল্য</td><td class="num">${U.money(dv)}</td></tr>
          <tr><td colspan="4" class="num">পূর্বে পরিশোধিত</td><td class="num">${U.money(paid)}</td></tr>
          <tr><td colspan="4" class="num"><b>প্রদেয়</b></td><td class="num"><b>${U.money(dv - paid)}</b></td></tr>
        </tfoot></table>
      <div class="sign"><span>গ্রহণকারীর স্বাক্ষর</span><span>স্বত্বাধিকারী<br>${U.esc(DB.s.shopName)}</span></div>`);
  },

  challan(t, date) {
    const ds = (t.deliveries || []).filter(d => d.date === date);
    Print.run(`${Print.head('ডেলিভারি চালান')}
      <div class="meta"><span>চালান নং: ${U.bn(`${t.no}-${date.replace(/-/g, '')}`)}</span><span>তারিখ: ${U.date(date)}</span></div>
      ${Print.instBlock(t)}
      <p>বিষয়: ${U.esc(t.title)}</p>
      <table><thead><tr><th>ক্রম</th><th>পোশাক</th><th>বিবরণ</th><th class="num">পরিমাণ</th><th>নোট</th></tr></thead>
        <tbody>${ds.map((d, i) => { const it = t.items.find(x => x.id === d.itemId) || {}; return `<tr><td>${U.bn(i + 1)}</td><td>${U.esc(it.name || '')}</td><td>${U.esc(it.spec || '')}</td><td class="num">${U.count(d.qty)}</td><td>${U.esc(d.note || '')}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="3" class="num">মোট</td><td class="num">${U.count(U.sum(ds, d => d.qty))}</td><td></td></tr></tfoot></table>
      <p>উপরোক্ত পোশাকসমূহ ভালো অবস্থায় বুঝে পেলাম।</p>
      <div class="sign"><span>গ্রহণকারীর স্বাক্ষর ও সিল</span><span>সরবরাহকারীর পক্ষে</span></div>`);
  },

  staffList(t) {
    const i = DB.get('institutions', t.institutionId) || {};
    Print.run(`${Print.head('কর্মীদের মাপ তালিকা')}
      <div class="meta"><span>প্রতিষ্ঠান: <b>${U.esc(i.name || '')}</b></span><span>${U.esc(t.title)}</span></div>
      <table><thead><tr><th>ক্রম</th><th>নাম</th><th>পদবি</th><th>মাপ / সাইজ</th><th>নোট</th><th>ডেলিভারি ✓</th></tr></thead>
        <tbody>${(t.staff || []).map((s, n) => `<tr><td>${U.bn(n + 1)}</td><td>${U.esc(s.name)}</td><td>${U.esc(s.designation || '')}</td><td>${U.t(s.sizes || '')}</td><td>${U.esc(s.note || '')}</td><td></td></tr>`).join('')}</tbody></table>`);
  },

  report(title, html) {
    Print.run(`${Print.head(title)}<div class="pr-report">${html}</div>`);
  }
};
