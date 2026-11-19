/* সেটিংস, ব্যাকআপ ও রিস্টোর */
Pages.settings = function (root) {
  const s = DB.s;
  const garments = Object.entries(CFG.garments).filter(([k]) => k !== 'other');
  const counts = ['customers', 'orders', 'tenders', 'workers', 'inventory'].map(k => DB.list(k).length);
  let size = 0;
  try { size = (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { size = 0; }

  root.innerHTML = `
    <div class="page-head"><h2>সেটিংস</h2></div>
    <form id="set-form" novalidate>
      <div class="card"><h3>দোকানের তথ্য (রসিদে ছাপা হবে)</h3>
        <div class="form-grid">
          ${UI.input('shopName', 'দোকানের নাম', s.shopName, { req: true })}
          ${UI.input('tagline', 'স্লোগান', s.tagline, { cls: 'span-2' })}
          ${UI.input('address', 'ঠিকানা', s.address, { cls: 'span-2' })}
          ${UI.input('phone', 'মোবাইল নম্বর', s.phone)}
          ${UI.input('deliveryDays', 'সাধারণ ডেলিভারি সময় (দিন)', s.deliveryDays, { num: true, bn: true })}
          ${UI.textarea('receiptNote', 'রসিদের নিচের নোট', s.receiptNote)}
        </div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>গ্রাহকের সেলাই মজুরি (প্রতি পিস ৳)</h3>
          <div class="m-grid">${garments.map(([k, g]) => `<div class="field"><label>${g.name}</label><input type="text" inputmode="decimal" name="price_${k}" value="${U.bn(s.prices[k] ?? 0)}"></div>`).join('')}</div>
        </div>
        <div class="card"><h3>নতুন কারিগরের ডিফল্ট মজুরি (৳)</h3>
          <div class="m-grid">${garments.map(([k, g]) => `<div class="field"><label>${g.name}</label><input type="text" inputmode="decimal" name="wage_${k}" value="${U.bn(s.wages[k] ?? 0)}"></div>`).join('')}</div>
        </div>
      </div>
      <div class="btn-row" style="justify-content:flex-end;margin-bottom:16px"><button class="btn btn-primary" type="submit">সেটিংস সংরক্ষণ করুন</button></div>
    </form>

    <div class="card">
      <h3>ব্যাকআপ ও রিস্টোর</h3>
      <div class="alert alert-warn small">সব তথ্য এই কম্পিউটারের ব্রাউজারে থাকে। ব্রাউজারের ইতিহাস/ডেটা মুছে ফেললে বা কম্পিউটার নষ্ট হলে তথ্য হারিয়ে যেতে পারে। তাই প্রতি সপ্তাহে অন্তত একবার ব্যাকআপ ডাউনলোড করে পেনড্রাইভ বা গুগল ড্রাইভে রাখুন।</div>
      <p class="small">গ্রাহক ${U.count(counts[0])} · অর্ডার ${U.count(counts[1])} · টেন্ডার ${U.count(counts[2])} · কারিগর ${U.count(counts[3])} · মালামাল ${U.count(counts[4])} · ডেটার আকার প্রায় ${U.count(Math.round(size / 1024))} কিলোবাইট
        <br>শেষ ব্যাকআপ: <b>${DB.data.meta.lastBackup ? U.date(DB.data.meta.lastBackup) : 'কখনো নেওয়া হয়নি'}</b></p>
      <div class="btn-row">
        <button class="btn btn-gold" id="backup">⬇ ব্যাকআপ ডাউনলোড করুন</button>
        <label class="btn">⬆ ব্যাকআপ থেকে ফেরত আনুন<input type="file" id="restore" accept=".json,application/json" hidden></label>
      </div>
    </div>

    <div class="card">
      <h3>বিপজ্জনক কাজ</h3>
      <div class="btn-row">
        <button class="btn" id="demo">নমুনা তথ্য লোড করুন</button>
        <button class="btn btn-danger" id="reset">সব তথ্য মুছে নতুন করে শুরু করুন</button>
      </div>
      <p class="small text-muted">দুটি কাজই বর্তমান সব তথ্য মুছে ফেলবে। আগে ব্যাকআপ নিন।</p>
    </div>`;

  root.querySelector('#set-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!UI.validate(e.target)) return;
    const f = UI.formData(e.target);
    Object.assign(s, { shopName: f.shopName, tagline: f.tagline, address: f.address, phone: U.en(f.phone), receiptNote: f.receiptNote, deliveryDays: U.num(f.deliveryDays) || 7 });
    for (const [k] of garments) { s.prices[k] = U.num(f['price_' + k]); s.wages[k] = U.num(f['wage_' + k]); }
    DB.save();
    App.refreshChrome();
    UI.toast('সেটিংস সংরক্ষিত হয়েছে', 'ok');
  });

  root.querySelector('#backup').addEventListener('click', () => {
    DB.data.meta.lastBackup = U.today();
    DB.save();
    U.download(`royal-tailors-backup-${U.today()}.json`, DB.exportJSON());
    UI.toast('ব্যাকআপ ফাইল ডাউনলোড হয়েছে', 'ok');
    App.route();
  });

  root.querySelector('#restore').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (!await UI.confirm(`"${U.esc(file.name)}" থেকে তথ্য ফেরত আনলে বর্তমান সব তথ্য মুছে যাবে। চালিয়ে যাবেন?`, 'হ্যাঁ, ফেরত আনুন')) { e.target.value = ''; return; }
    try {
      DB.importJSON(text);
      UI.toast('ব্যাকআপ থেকে তথ্য ফেরত আনা হয়েছে', 'ok');
      App.route();
    } catch (err) {
      UI.toast('ফাইলটি পড়া যায়নি: ' + err.message, 'error');
    }
  });

  root.querySelector('#demo').addEventListener('click', async () => {
    if (await UI.confirm('বর্তমান সব তথ্য মুছে নমুনা তথ্য লোড করবেন?', 'হ্যাঁ')) { DB.seed(); UI.toast('নমুনা তথ্য লোড হয়েছে', 'ok'); location.hash = '#/dashboard'; App.route(); }
  });
  root.querySelector('#reset').addEventListener('click', async () => {
    if (!await UI.confirm('<b>সতর্কতা:</b> সব গ্রাহক, অর্ডার, টেন্ডার ও হিসাব স্থায়ীভাবে মুছে যাবে। নিশ্চিত?', 'হ্যাঁ, সব মুছুন')) return;
    if (!await UI.confirm('আবারও নিশ্চিত করুন — এই কাজ আর ফেরানো যাবে না।', 'সব মুছে ফেলুন')) return;
    DB.reset();
    UI.toast('সব তথ্য মুছে ফেলা হয়েছে');
    location.hash = '#/dashboard';
    App.route();
  });
};
