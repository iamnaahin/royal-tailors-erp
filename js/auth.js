/* লগইন, ব্যবহারকারী ও অনুমতি */
const AUTH_KEY = 'royal_tailors_session';

const Auth = {
  user: null,

  /* ---------- পাসওয়ার্ড হ্যাশ ---------- */
  async hash(pw, salt) {
    const text = salt + '|' + pw;
    if (!(window.crypto && crypto.subtle)) throw new Error('এই ব্রাউজারে নিরাপদ পাসওয়ার্ড যাচাই সম্ভব নয়। Chrome বা Edge ব্যবহার করুন।');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  salt() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  recoveryCode() {
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    const s = [...a].map(b => abc[b % abc.length]).join('');
    return s.slice(0, 4) + '-' + s.slice(4);
  },
  async setPassword(u, pw) {
    u.salt = Auth.salt();
    u.passHash = await Auth.hash(pw, u.salt);
  },
  async check(u, pw) { return !!u && u.passHash === await Auth.hash(pw, u.salt); },

  /* ---------- অনুমতি ---------- */
  users() { return DB.list('users'); },
  activeAdmins() { return Auth.users().filter(u => u.role === 'admin' && u.active !== false); },
  isAdmin() { return Auth.user?.role === 'admin'; },
  isGuest() { return !!Auth.user?.guest; },
  can(p) {
    const u = Auth.user;
    if (!u) return false;
    if (u.guest) return CFG.guestPermOptions.includes(p) && (DB.s.guestPerms || []).includes(p);
    if (u.role === 'admin') return true;
    if (p === 'admin') return false;
    return (u.perms || []).includes(p);
  },
  canPage(page) {
    const p = CFG.pagePerm[page];
    return p === null || p === undefined ? true : Auth.can(p);
  },

  /* ---------- সেশন ---------- */
  saveSession(id, remember) {
    try {
      sessionStorage.setItem(AUTH_KEY, id);
      if (remember) localStorage.setItem(AUTH_KEY, id); else localStorage.removeItem(AUTH_KEY);
    } catch (e) { /* ব্রাউজার স্টোরেজ বন্ধ থাকলে প্রতিবার লগইন লাগবে */ }
  },
  guestUser(entry) {
    return { id: 'guest:' + entry.id, guest: true, role: 'guest', name: entry.name, perms: [] };
  },
  restoreSession() {
    let id = null;
    try { id = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY); } catch (e) { id = null; }
    if (id && id.startsWith('guest:')) {
      const entry = (DB.data.guestLog || []).find(g => 'guest:' + g.id === id);
      Auth.user = entry && DB.s.guestEnabled !== false ? Auth.guestUser(entry) : null;
      return !!Auth.user;
    }
    const u = id ? DB.get('users', id) : null;
    Auth.user = u && u.active !== false ? u : null;
    return !!Auth.user;
  },
  logout() {
    try { sessionStorage.removeItem(AUTH_KEY); localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
    Auth.user = null;
    document.getElementById('modal-root').innerHTML = '';
    document.getElementById('main').innerHTML = '';
    Auth.applyChrome();
    Auth.showLogin();
  },
  /** লগইন সফল হলে */
  enter(u, remember) {
    if (!u.guest) {
      u.lastLogin = new Date().toISOString();
      DB.save();
    }
    Auth.user = u;
    Auth.saveSession(u.id, u.guest ? false : remember);
    document.getElementById('auth-root').innerHTML = '';
    document.body.classList.remove('locked');
    App.route();
  },

  /** অ্যাপ চালুর সময়: ব্যবহারকারী না থাকলে অ্যাডমিন তৈরি, না হলে লগইন */
  start(onFirstSetup) {
    if (!Auth.users().length) return Auth.showSetup(onFirstSetup);
    if (Auth.restoreSession()) { App.route(); return; }
    Auth.showLogin();
  },

  /* ---------- UI: অ্যাডমিন সেটআপ ---------- */
  screen(inner) {
    document.body.classList.add('locked');
    const root = document.getElementById('auth-root');
    root.innerHTML = `<div class="auth-screen"><div class="auth-box">
      <div class="auth-brand"><div class="brand-logo">র</div><div><div class="auth-shop">${U.esc(DB.s.shopName)}</div><div class="small text-muted">${U.esc(DB.s.address)}</div></div></div>
      ${inner}</div></div>`;
    UI.bindBnInputs(root);
    return root;
  },

  showSetup(onDone) {
    const root = Auth.screen(`
      <h2>অ্যাডমিন অ্যাকাউন্ট তৈরি করুন</h2>
      <p class="small text-muted">অ্যাডমিন সব কিছু দেখতে ও করতে পারবেন — ম্যানেজার ও কর্মচারীদের অ্যাকাউন্ট তৈরিসহ। সাধারণত দোকানের মালিক অ্যাডমিন হন।</p>
      <form id="setup-form" class="auth-form" novalidate>
        ${UI.input('name', 'আপনার নাম', '', { req: true, ph: 'যেমন: মোঃ নাহিন' })}
        ${UI.input('pw', 'পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর)', '', { type: 'password', req: true })}
        ${UI.input('pw2', 'আবার পাসওয়ার্ড', '', { type: 'password', req: true })}
        <button class="btn btn-gold" type="submit">অ্যাকাউন্ট তৈরি করুন</button>
      </form>`);
    root.querySelector('#setup-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (!UI.validate(e.target)) return;
      const f = UI.formData(e.target);
      if (f.pw.length < 4) return UI.toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error');
      if (f.pw !== f.pw2) return UI.toast('দুটি পাসওয়ার্ড মেলেনি', 'error');
      try {
        const u = { id: U.uid(), name: f.name, role: 'admin', perms: [], active: true, createdAt: U.today() };
        await Auth.setPassword(u, f.pw);
        const code = Auth.recoveryCode();
        u.recoverySalt = Auth.salt();
        u.recoveryHash = await Auth.hash(code, u.recoverySalt);
        DB.data.users.push(u);
        DB.save();
        Auth.showRecoveryCode(code, () => { Auth.enter(u, true); if (onDone) onDone(); });
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  },

  showRecoveryCode(code, onOk) {
    const root = Auth.screen(`
      <h2>রিকভারি কোড লিখে রাখুন</h2>
      <p>অ্যাডমিনের পাসওয়ার্ড ভুলে গেলে এই কোড দিয়ে নতুন পাসওয়ার্ড দেওয়া যাবে। এটি কাগজে লিখে নিরাপদ জায়গায় রাখুন — আর দেখানো হবে না।</p>
      <div class="recovery-code">${U.esc(code)}</div>
      <button class="btn btn-gold" id="rc-ok">আমি কোডটি লিখে রেখেছি</button>`);
    root.querySelector('#rc-ok').addEventListener('click', onOk);
  },

  /** অতিথি লগইন — শুধু নাম; প্রতিটি লগইন ডেটাবেসে লেখা থাকে */
  enterGuest(name) {
    const entry = { id: U.uid(), name: name.trim(), at: new Date().toISOString() };
    DB.data.guestLog = DB.data.guestLog || [];
    DB.data.guestLog.unshift(entry);
    if (DB.data.guestLog.length > 1000) DB.data.guestLog.length = 1000;
    DB.save(true);
    Auth.enter(Auth.guestUser(entry), false);
    UI.toast(`স্বাগতম ${entry.name} — আপনি শুধু দেখতে পারবেন`, 'ok');
  },

  /* ---------- UI: লগইন ---------- */
  showLogin() {
    const users = Auth.users().filter(u => u.active !== false);
    const guestOn = DB.s.guestEnabled !== false;
    let sel = users.length === 1 && !guestOn ? users[0] : null;
    const draw = () => {
      const isGuest = sel === 'guest';
      const root = Auth.screen(`
        <h2>লগইন</h2>
        <p class="small text-muted">${sel ? '' : 'আপনার নাম বেছে নিন'}</p>
        <div class="user-tiles">${users.map(u => `<button type="button" class="user-tile ${sel?.id === u.id ? 'active' : ''}" data-u="${u.id}">
          <span class="avatar">${U.esc(u.name.trim()[0] || '?')}</span><span><b>${U.esc(u.name)}</b><br><span class="small">${U.esc(CFG.roleName(u.role))}</span></span></button>`).join('')}
          ${guestOn ? `<button type="button" class="user-tile guest-tile ${isGuest ? 'active' : ''}" data-guest>
            <span class="avatar">অ</span><span><b>অতিথি</b><br><span class="small">শুধু দেখা, পাসওয়ার্ড লাগে না</span></span></button>` : ''}</div>
        ${isGuest ? `<form id="guest-form" class="auth-form" novalidate>
          ${UI.input('gname', 'আপনার নাম', '', { req: true, ph: 'যেমন: আরিফ হোসেন' })}
          <p class="small text-muted" style="margin:0">অতিথি হিসেবে আপনি তথ্য দেখতে পারবেন, কিন্তু কিছু লিখতে, বদলাতে বা মুছতে পারবেন না। আপনার নাম ও লগইনের সময় সংরক্ষিত থাকবে।</p>
          <button class="btn btn-primary" type="submit">অতিথি হিসেবে প্রবেশ করুন</button>
        </form>` : ''}
        ${sel && !isGuest ? `<form id="login-form" class="auth-form" novalidate>
          ${UI.input('pw', `${sel.name} — পাসওয়ার্ড`, '', { type: 'password', req: true })}
          <label class="small"><input type="checkbox" name="remember"> এই ডিভাইসে লগইন রাখুন</label>
          <button class="btn btn-primary" type="submit">লগইন করুন</button>
          <a href="#" class="small" id="forgot">পাসওয়ার্ড ভুলে গেছেন?</a>
        </form>` : ''}`);
      root.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { sel = DB.get('users', b.dataset.u); draw(); }));
      root.querySelector('[data-guest]')?.addEventListener('click', () => { sel = 'guest'; draw(); });
      const gform = root.querySelector('#guest-form');
      if (gform) {
        gform.querySelector('[name=gname]').focus();
        gform.addEventListener('submit', e => {
          e.preventDefault();
          const name = UI.formData(gform).gname;
          if (name.length < 2) return UI.toast('আপনার পুরো নাম লিখুন', 'error');
          Auth.enterGuest(name);
        });
        return;
      }
      const form = root.querySelector('#login-form');
      if (!form) return;
      form.querySelector('[name=pw]').focus();
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const f = UI.formData(form);
        try {
          if (await Auth.check(sel, f.pw)) Auth.enter(sel, f.remember);
          else { UI.toast('পাসওয়ার্ড সঠিক নয়', 'error'); form.querySelector('[name=pw]').select(); }
        } catch (err) { UI.toast(err.message, 'error'); }
      });
      root.querySelector('#forgot').addEventListener('click', e => {
        e.preventDefault();
        if (sel.role !== 'admin') return UI.toast('অ্যাডমিনকে আপনার পাসওয়ার্ড রিসেট করতে বলুন', 'error');
        Auth.recoverModal(sel);
      });
    };
    draw();
  },

  recoverModal(u) {
    UI.modal('রিকভারি কোড দিয়ে নতুন পাসওয়ার্ড', `
      <p class="small text-muted">অ্যাডমিন অ্যাকাউন্ট তৈরির সময় দেওয়া রিকভারি কোডটি লিখুন।</p>
      <div class="form-grid">
        ${UI.input('code', 'রিকভারি কোড', '', { req: true, ph: 'XXXX-XXXX' })}
        ${UI.input('pw', 'নতুন পাসওয়ার্ড', '', { type: 'password', req: true })}
        ${UI.input('pw2', 'আবার নতুন পাসওয়ার্ড', '', { type: 'password', req: true })}
      </div>`, {
      saveText: 'পাসওয়ার্ড বদলান',
      onSave: (form, close) => {
        const f = UI.formData(form);
        if (f.pw.length < 4) { UI.toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error'); return false; }
        if (f.pw !== f.pw2) { UI.toast('দুটি পাসওয়ার্ড মেলেনি', 'error'); return false; }
        (async () => {
          const code = f.code.toUpperCase().replace(/\s/g, '');
          if (!u.recoveryHash || await Auth.hash(code, u.recoverySalt) !== u.recoveryHash) { UI.toast('রিকভারি কোড সঠিক নয়', 'error'); return; }
          await Auth.setPassword(u, f.pw);
          DB.save();
          close();
          UI.toast('নতুন পাসওয়ার্ড সেট হয়েছে — এখন লগইন করুন', 'ok');
        })();
        return false;
      }
    });
  },

  /* ---------- আমার অ্যাকাউন্ট ---------- */
  accountModal() {
    const u = Auth.user;
    if (u.guest) {
      UI.modal('অতিথি', `
        <p>আপনি <b>${U.esc(u.name)}</b> নামে অতিথি হিসেবে প্রবেশ করেছেন। আপনি শুধু দেখতে পারবেন — কিছু লিখতে, বদলাতে বা মুছতে পারবেন না।</p>
        <button type="button" class="btn btn-danger" id="logout">বের হয়ে যান</button>`, {
        onMount: (m, close) => m.querySelector('#logout').addEventListener('click', () => { close(); Auth.logout(); })
      });
      return;
    }
    const list = u.role === 'admin' ? ['সব কিছু (সেটিংস, ব্যাকআপ ও ব্যবহারকারী ব্যবস্থাপনাসহ)'] : CFG.perms.filter(([k]) => Auth.can(k)).map(p => p[1]);
    UI.modal('আমার অ্যাকাউন্ট', `
      <dl class="info-list"><dt>নাম</dt><dd>${U.esc(u.name)}</dd><dt>ভূমিকা</dt><dd>${U.esc(CFG.roleName(u.role))}</dd></dl>
      <h4 style="margin-top:12px">আপনি যা করতে পারেন</h4>
      <ul class="small">${list.map(x => `<li>${U.esc(x)}</li>`).join('') || '<li>শুধু ড্যাশবোর্ড</li>'}</ul>
      <div class="btn-row"><button type="button" class="btn" id="chg-pw">পাসওয়ার্ড পরিবর্তন</button><button type="button" class="btn btn-danger" id="logout">লগআউট</button></div>`, {
      onMount: (m, close) => {
        m.querySelector('#logout').addEventListener('click', () => { close(); Auth.logout(); });
        m.querySelector('#chg-pw').addEventListener('click', () => { close(); Auth.changePasswordModal(); });
      }
    });
  },

  changePasswordModal() {
    const u = Auth.user;
    UI.modal('পাসওয়ার্ড পরিবর্তন', `<div class="form-grid">
      ${UI.input('old', 'বর্তমান পাসওয়ার্ড', '', { type: 'password', req: true })}
      ${UI.input('pw', 'নতুন পাসওয়ার্ড', '', { type: 'password', req: true })}
      ${UI.input('pw2', 'আবার নতুন পাসওয়ার্ড', '', { type: 'password', req: true })}</div>`, {
      onSave: (form, close) => {
        const f = UI.formData(form);
        if (f.pw.length < 4) { UI.toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error'); return false; }
        if (f.pw !== f.pw2) { UI.toast('দুটি পাসওয়ার্ড মেলেনি', 'error'); return false; }
        (async () => {
          if (!await Auth.check(u, f.old)) { UI.toast('বর্তমান পাসওয়ার্ড সঠিক নয়', 'error'); return; }
          await Auth.setPassword(u, f.pw);
          DB.save();
          close();
          UI.toast('পাসওয়ার্ড পরিবর্তন হয়েছে', 'ok');
        })();
        return false;
      }
    });
  },

  /* ---------- মেনু ও বোতামে অনুমতি প্রয়োগ ---------- */
  applyChrome() {
    const b = document.body.classList;
    b.toggle('no-delete', !Auth.can('delete'));
    b.toggle('no-payments', !Auth.can('payments'));
    b.toggle('no-orders', !Auth.can('orders'));
    b.toggle('readonly', Auth.isGuest());
    document.querySelectorAll('#nav a').forEach(a => { a.hidden = !Auth.canPage(a.dataset.page); });
    const chip = document.getElementById('user-chip');
    if (Auth.user) {
      chip.hidden = false;
      chip.innerHTML = `<span class="avatar">${U.esc(Auth.user.name.trim()[0] || '?')}</span><span class="uc-text">${U.esc(Auth.user.name)}<br><span class="small">${U.esc(CFG.roleName(Auth.user.role))}</span></span>`;
    } else chip.hidden = true;
  }
};

/* অনুমতি ছাড়া মুছে ফেলা/টাকা নেওয়ার বোতাম কাজ করবে না (CSS এ লুকানোও থাকে) */
const PERM_SELECTORS = {
  delete: '[data-act="del"],[data-delpay],[data-del],[data-staff-del],[data-delmove],#del,#del-i',
  payments: '[data-act="pay"],[data-pay],#pay'
};
document.addEventListener('click', e => {
  for (const [perm, sel] of Object.entries(PERM_SELECTORS)) {
    if (e.target.closest && e.target.closest(sel) && !Auth.can(perm)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      UI.toast('এই কাজের অনুমতি আপনার নেই', 'error');
      return;
    }
  }
}, true);

/* অতিথি (শুধু দেখা): এই বোতামগুলো ছাড়া অ্যাপের ভেতরের কোনো বোতাম কাজ করবে না */
const VIEW_ONLY_ALLOW = [
  '[data-close]', '[data-f]', '[data-tab]', '[data-dir]', '[data-hist]', '[data-challan]',
  '[data-act="receipt"]', '[data-act="slip"]', '[data-act="print"]', '[data-act="quote"]', '[data-act="bill"]', '[data-act="staff-print"]',
  '#r-print', '#user-chip', '#menu-btn', '#logout'
].join(',');
document.addEventListener('click', e => {
  if (!Auth.isGuest() || !e.target.closest) return;
  const el = e.target.closest('button, a, label.btn');
  if (!el || el.closest('#nav') || el.matches(VIEW_ONLY_ALLOW)) return;
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') || '';
    const editing = /\/(new|edit)\b|[?&](new|expense)=/.test(href) || href.startsWith('https://wa.me');
    if (!editing) return; // সাধারণ দেখার লিংক চলবে
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  UI.toast('অতিথি হিসেবে শুধু দেখা যায় — এই কাজটি করা যাবে না', 'error');
}, true);
document.addEventListener('change', e => {
  if (Auth.isGuest() && e.target.matches && e.target.matches('#status-sel, #t-st, #guest-on, [data-gp], .item-card *, #order-form *, #t-form *')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    UI.toast('অতিথি হিসেবে শুধু দেখা যায়', 'error');
    App.route();
  }
}, true);
document.addEventListener('submit', e => {
  if (Auth.isGuest() && !e.target.closest('.auth-screen')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    UI.toast('অতিথি হিসেবে কিছু সংরক্ষণ করা যায় না', 'error');
  }
}, true);

/* ------------------------------ ব্যবহারকারী ব্যবস্থাপনা (শুধু অ্যাডমিন) ------------------------------ */
Pages.users = function (root) {
  const users = Auth.users();

  const permBoxes = (role, perms) => CFG.perms.map(([k, l]) => `
    <label class="perm-row"><input type="checkbox" name="perm_${k}" ${role === 'admin' || perms.includes(k) ? 'checked' : ''} ${role === 'admin' ? 'disabled' : ''}> ${U.esc(l)}</label>`).join('');

  const editModal = u => {
    const isNew = !u;
    const x = u || { role: 'employee', perms: [...CFG.roleDefaults.employee], active: true };
    UI.modal(isNew ? 'নতুন ব্যবহারকারী' : `${x.name} — সম্পাদনা`, `
      <div class="form-grid">
        ${UI.input('name', 'নাম', x.name || '', { req: true })}
        ${UI.select('role', 'ভূমিকা', CFG.roles, x.role)}
        ${isNew ? UI.input('pw', 'পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর)', '', { type: 'password', req: true }) : ''}
        ${!isNew ? UI.select('active', 'অবস্থা', [['1', 'সক্রিয়'], ['0', 'নিষ্ক্রিয় (লগইন করতে পারবে না)']], x.active === false ? '0' : '1') : ''}
      </div>
      <h4 style="margin:14px 0 6px">অনুমতি</h4>
      <p class="small text-muted" id="perm-hint"></p>
      <div id="perm-box" class="perm-grid">${permBoxes(x.role, x.perms || [])}</div>`, {
      onMount: m => {
        const roleSel = m.querySelector('[name=role]');
        const hint = () => {
          m.querySelector('#perm-hint').textContent = roleSel.value === 'admin'
            ? 'অ্যাডমিন সব কিছু করতে পারেন — সেটিংস, ব্যাকআপ ও ব্যবহারকারী ব্যবস্থাপনাসহ।'
            : 'ভূমিকা বদলালে সাধারণ অনুমতিগুলো বসে যায়; প্রয়োজনমতো টিক দিন বা তুলে দিন।';
        };
        roleSel.addEventListener('change', () => {
          const r = roleSel.value;
          m.querySelector('#perm-box').innerHTML = permBoxes(r, CFG.roleDefaults[r] || []);
          hint();
        });
        hint();
      },
      onSave: (form, close) => {
        const f = UI.formData(form);
        const name = f.name.trim();
        if (Auth.users().some(o => o.id !== x.id && o.name.trim() === name)) { UI.toast('এই নামে আরেকজন ব্যবহারকারী আছেন', 'error'); return false; }
        const perms = f.role === 'admin' ? [] : CFG.perms.map(p => p[0]).filter(k => f['perm_' + k]);
        const active = isNew ? true : f.active === '1';
        // শেষ সক্রিয় অ্যাডমিনকে সরানো যাবে না
        const wasActiveAdmin = !isNew && x.role === 'admin' && x.active !== false;
        if (wasActiveAdmin && (f.role !== 'admin' || !active) && Auth.activeAdmins().length <= 1) {
          UI.toast('অন্তত একজন সক্রিয় অ্যাডমিন থাকতে হবে', 'error'); return false;
        }
        if (isNew && f.pw.length < 4) { UI.toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error'); return false; }
        (async () => {
          const obj = { ...x, name, role: f.role, perms, active };
          if (isNew) { obj.id = U.uid(); obj.createdAt = U.today(); await Auth.setPassword(obj, f.pw); }
          DB.upsert('users', obj);
          if (Auth.user && obj.id === Auth.user.id) Auth.user = obj;
          close();
          UI.toast(isNew ? `${name} এর অ্যাকাউন্ট তৈরি হয়েছে` : 'সংরক্ষিত হয়েছে', 'ok');
          if (Auth.user && obj.id === Auth.user.id && !Auth.canPage('users')) location.hash = '#/dashboard';
          App.route();
        })();
        return false;
      }
    });
  };

  const resetModal = u => {
    UI.modal(`${u.name} — নতুন পাসওয়ার্ড`, `<div class="form-grid">
      ${UI.input('pw', 'নতুন পাসওয়ার্ড', '', { type: 'password', req: true })}
      ${UI.input('pw2', 'আবার নতুন পাসওয়ার্ড', '', { type: 'password', req: true })}</div>`, {
      onSave: (form, close) => {
        const f = UI.formData(form);
        if (f.pw.length < 4) { UI.toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 'error'); return false; }
        if (f.pw !== f.pw2) { UI.toast('দুটি পাসওয়ার্ড মেলেনি', 'error'); return false; }
        (async () => { await Auth.setPassword(u, f.pw); DB.save(); close(); UI.toast('পাসওয়ার্ড বদলানো হয়েছে', 'ok'); })();
        return false;
      }
    });
  };

  const permSummary = u => u.role === 'admin' ? 'সব কিছু'
    : (CFG.perms.filter(([k]) => (u.perms || []).includes(k)).map(p => p[1].split(' ')[0]).join(', ') || 'শুধু ড্যাশবোর্ড');

  root.innerHTML = `
    <div class="page-head"><h2>ব্যবহারকারী ও অনুমতি</h2><button class="btn btn-gold" id="add-u">+ নতুন ব্যবহারকারী</button></div>
    <div class="grid-3">
      ${CFG.roles.map(([r, l]) => `<div class="card"><h3>${l}</h3><p class="small">${r === 'admin' ? 'সব কিছু — সেটিংস, ব্যাকআপ, ব্যবহারকারী তৈরি ও অনুমতি নির্ধারণসহ।'
        : 'সাধারণ অনুমতি: ' + U.esc(CFG.roleDefaults[r].map(k => CFG.perms.find(p => p[0] === k)[1]).join('; '))}</p>
        <div class="text-muted small">${U.bn(users.filter(u => u.role === r).length)} জন</div></div>`).join('')}
    </div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>নাম</th><th>ভূমিকা</th><th>অনুমতি</th><th>শেষ লগইন</th><th>অবস্থা</th><th></th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td><b>${U.esc(u.name)}</b>${Auth.user && u.id === Auth.user.id ? ' <span class="badge b-new">আপনি</span>' : ''}</td>
        <td>${U.esc(CFG.roleName(u.role))}</td>
        <td class="small">${U.esc(permSummary(u))}</td>
        <td class="small nowrap">${u.lastLogin ? U.dateShort(u.lastLogin.slice(0, 10)) : '—'}</td>
        <td>${u.active === false ? '<span class="badge b-cancelled">নিষ্ক্রিয়</span>' : '<span class="badge b-delivered">সক্রিয়</span>'}</td>
        <td class="nowrap"><button class="btn btn-sm" data-edit-u="${u.id}">সম্পাদনা</button>
          <button class="btn btn-sm" data-reset-u="${u.id}">পাসওয়ার্ড</button>
          <button class="btn btn-sm btn-danger" data-del-u="${u.id}">মুছুন</button></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="small text-muted">টিপস: কেউ চাকরি ছেড়ে দিলে অ্যাকাউন্ট মুছে না ফেলে "নিষ্ক্রিয়" করে দিন। প্রত্যেক ডিভাইসে (কম্পিউটার/মোবাইল) ব্যবহারকারী আলাদাভাবে তৈরি করতে হবে, অথবা ব্যাকআপ ফাইল দিয়ে নিয়ে যেতে হবে।</p></div>

    <div class="card">
      <div class="card-head"><h3>অতিথি লগইন (শুধু দেখা)</h3>
        <label class="perm-row"><input type="checkbox" id="guest-on" ${DB.s.guestEnabled !== false ? 'checked' : ''}> লগইন পাতায় অতিথি অপশন দেখান</label></div>
      <p class="small text-muted">অতিথি শুধু নিজের নাম লিখে ঢুকতে পারেন — পাসওয়ার্ড লাগে না। তিনি কিছু লিখতে, বদলাতে, টাকা নিতে বা মুছতে পারবেন না। নিচে টিক দিন অতিথি কোন কোন পাতা দেখতে পারবেন (ড্যাশবোর্ড সবসময় দেখা যায়)।</p>
      <div class="perm-grid" id="guest-perms">${CFG.guestPermOptions.map(k => `<label class="perm-row"><input type="checkbox" data-gp="${k}" ${(DB.s.guestPerms || []).includes(k) ? 'checked' : ''}> ${U.esc(CFG.perms.find(p => p[0] === k)[1])}</label>`).join('')}</div>
      <div class="card-head" style="margin-top:16px"><h3>অতিথিদের লগইনের তালিকা (${U.bn((DB.data.guestLog || []).length)})</h3>
        ${(DB.data.guestLog || []).length ? '<button class="btn btn-sm btn-danger" id="guest-clear">তালিকা মুছুন</button>' : ''}</div>
      <div class="table-wrap" style="max-height:320px;overflow-y:auto"><table class="tbl small">
        <thead><tr><th>#</th><th>নাম</th><th>তারিখ</th><th>সময়</th></tr></thead>
        <tbody>${(DB.data.guestLog || []).length ? DB.data.guestLog.map((g, i) => {
          const d = new Date(g.at);
          return `<tr><td>${U.bn(i + 1)}</td><td>${U.esc(g.name)}</td><td class="nowrap">${U.date(U.iso(d))}</td>
            <td class="nowrap">${U.bn(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</td></tr>`;
        }).join('') : `<tr><td colspan="4">${UI.empty('এখনো কোনো অতিথি লগইন করেননি')}</td></tr>`}</tbody>
      </table></div>
    </div>`;

  root.querySelector('#guest-on').addEventListener('change', e => {
    DB.s.guestEnabled = e.target.checked;
    DB.save();
    UI.toast(e.target.checked ? 'অতিথি লগইন চালু হয়েছে' : 'অতিথি লগইন বন্ধ হয়েছে', 'ok');
  });
  root.querySelector('#guest-perms').addEventListener('change', () => {
    DB.s.guestPerms = [...root.querySelectorAll('[data-gp]:checked')].map(i => i.dataset.gp);
    DB.save();
    UI.toast('অতিথির অনুমতি সংরক্ষিত হয়েছে', 'ok');
  });
  root.querySelector('#guest-clear')?.addEventListener('click', async () => {
    if (await UI.confirm('অতিথিদের লগইনের পুরো তালিকা মুছে ফেলবেন?', 'মুছুন')) { DB.data.guestLog = []; DB.save(); App.route(); }
  });

  root.querySelector('#add-u').addEventListener('click', () => editModal(null));
  root.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.editU) editModal(DB.get('users', b.dataset.editU));
    else if (b.dataset.resetU) resetModal(DB.get('users', b.dataset.resetU));
    else if (b.dataset.delU) {
      const u = DB.get('users', b.dataset.delU);
      if (u.id === Auth.user.id) return UI.toast('নিজের অ্যাকাউন্ট মুছতে পারবেন না', 'error');
      if (u.role === 'admin' && u.active !== false && Auth.activeAdmins().length <= 1) return UI.toast('অন্তত একজন সক্রিয় অ্যাডমিন থাকতে হবে', 'error');
      if (await UI.confirm(`"${U.esc(u.name)}" এর অ্যাকাউন্ট মুছে ফেলবেন?`, 'মুছুন')) { DB.remove('users', u.id); App.route(); }
    }
  });
};
