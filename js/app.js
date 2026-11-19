/* রাউটার ও অ্যাপ চালু করা */
const App = {
  titles: {
    dashboard: 'ড্যাশবোর্ড', orders: 'অর্ডার', customers: 'গ্রাহক ও মাপ', tenders: 'টেন্ডার ও প্রতিষ্ঠান',
    workers: 'কারিগর', inventory: 'কাপড় ও স্টক', accounts: 'হিসাব', reports: 'রিপোর্ট', settings: 'সেটিংস'
  },

  route() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    const parts = h.split('/').filter(Boolean);
    const page = Pages[parts[0]] ? parts[0] : 'dashboard';
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    App.setTitle(App.titles[page]);
    document.body.classList.remove('nav-open');
    const main = document.getElementById('main');
    main.innerHTML = '';
    const root = document.createElement('div');
    main.appendChild(root);
    UI.bindBnInputs(root);
    try {
      Pages[page](root, parts.slice(1));
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="card"><h3 class="text-red">কিছু একটা ভুল হয়েছে</h3><p class="small">${U.esc(e.message)}</p><a class="btn" href="#/dashboard">ড্যাশবোর্ডে ফিরে যান</a></div>`;
    }
    window.scrollTo(0, 0);
    App.refreshChrome();
  },

  setTitle(t) {
    document.getElementById('page-title').textContent = t;
    document.title = `${t} · ${DB.s.shopName}`;
  },

  refreshChrome() {
    document.getElementById('brand-name').textContent = DB.s.shopName;
    const last = DB.data.meta.lastBackup;
    const days = last ? U.diffDays(U.today(), last) : null;
    document.getElementById('backup-hint').innerHTML = last
      ? `শেষ ব্যাকআপ: ${U.date(last)}${days >= 7 ? ' <br><a href="#/settings">⚠ নতুন ব্যাকআপ নিন</a>' : ''}`
      : `<a href="#/settings">⚠ এখনো কোনো ব্যাকআপ নেওয়া হয়নি</a>`;
  },

  welcome() {
    UI.modal('রয়্যাল টেইলার্স ইআরপি-তে স্বাগতম', `
      <p>এটি রয়্যাল টেইলার্স, কক্সবাজারের জন্য তৈরি দোকান পরিচালনার সফটওয়্যার — অর্ডার, গ্রাহকের মাপ, হোটেল ও স্কুলের টেন্ডার, কারিগরের মজুরি, কাপড়ের স্টক এবং আয়-ব্যয়ের হিসাব এক জায়গায়।</p>
      <div class="alert alert-info small">সব তথ্য এই কম্পিউটারের ব্রাউজারে সংরক্ষিত থাকে। নিয়মিত <b>সেটিংস → ব্যাকআপ ডাউনলোড</b> করে রাখুন।</div>
      <p>কীভাবে শুরু করতে চান?</p>
      <div class="btn-row">
        <button type="button" class="btn btn-gold" data-start="demo">নমুনা তথ্যসহ দেখুন</button>
        <button type="button" class="btn btn-primary" data-start="empty">খালি অবস্থায় শুরু করুন</button>
      </div>`, {
      footer: false,
      noFocus: true,
      onMount: (root, close) => {
        root.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.start === 'demo') DB.seed(); else DB.save();
          close();
          App.route();
          UI.toast(b.dataset.start === 'demo' ? 'নমুনা তথ্য যোগ হয়েছে' : 'শুরু করার জন্য প্রস্তুত', 'ok');
        }));
      }
    });
  },

  init() {
    const existed = DB.load();
    window.addEventListener('hashchange', App.route);
    document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
    App.route();
    if (!existed) App.welcome();
  }
};

App.init();
