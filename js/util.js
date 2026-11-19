/* সাধারণ সহায়ক ফাংশন — বাংলা সংখ্যা, তারিখ, টাকা ইত্যাদি */
const U = {
  digits: '০১২৩৪৫৬৭৮৯',
  months: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],

  /** ইংরেজি অঙ্ক → বাংলা অঙ্ক */
  bn(x) {
    if (x === null || x === undefined) return '';
    return String(x).replace(/[0-9]/g, d => U.digits[d]);
  },
  /** বাংলা অঙ্ক → ইংরেজি অঙ্ক */
  en(x) {
    if (x === null || x === undefined) return '';
    return String(x).replace(/[০-৯]/g, d => U.digits.indexOf(d));
  },
  /** যেকোনো ইনপুট (বাংলা/ইংরেজি অঙ্ক) থেকে সংখ্যা */
  num(x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    const v = parseFloat(U.en(x).replace(/[,\s৳]/g, ''));
    return isNaN(v) ? 0 : v;
  },
  round2(n) { return Math.round((Number(n) || 0) * 100) / 100; },
  /** ১২,৩৪৫ ধরণের সংখ্যা */
  count(n) {
    return U.bn(U.round2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
  },
  money(n) {
    const v = U.round2(n);
    return (v < 0 ? '-' : '') + '৳' + U.count(Math.abs(v));
  },

  /** আজকের তারিখ YYYY-MM-DD (স্থানীয় সময়) */
  today() { return U.iso(new Date()); },
  iso(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  parse(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  },
  addDays(iso, n) { const d = U.parse(iso); d.setDate(d.getDate() + n); return U.iso(d); },
  diffDays(a, b) { return Math.round((U.parse(a) - U.parse(b)) / 86400000); },
  /** "১৯ নভেম্বর ২০২৬" */
  date(iso) {
    if (!iso) return '—';
    const d = U.parse(iso);
    return `${U.bn(d.getDate())} ${U.months[d.getMonth()]} ${U.bn(d.getFullYear())}`;
  },
  dateShort(iso) {
    if (!iso) return '—';
    const d = U.parse(iso);
    return U.bn(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  },
  monthKey(iso) { return String(iso || '').slice(0, 7); },
  monthName(key) {
    const [y, m] = key.split('-').map(Number);
    return `${U.months[m - 1]} ${U.bn(y)}`;
  },
  monthStart(key) { return key + '-01'; },
  monthEnd(key) {
    const [y, m] = key.split('-').map(Number);
    return U.iso(new Date(y, m, 0));
  },
  inRange(iso, from, to) { return !!iso && (!from || iso >= from) && (!to || iso <= to); },
  /** তারিখ নিয়ে আপেক্ষিক বর্ণনা */
  relDay(iso) {
    if (!iso) return '';
    const d = U.diffDays(iso, U.today());
    if (d === 0) return 'আজ';
    if (d === 1) return 'আগামীকাল';
    if (d === -1) return 'গতকাল';
    if (d > 0) return `${U.bn(d)} দিন বাকি`;
    return `${U.bn(-d)} দিন পার হয়েছে`;
  },

  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  /** বাংলা অঙ্কে দেখাও + HTML escape */
  t(s) { return U.esc(U.bn(s)); },
  sum(arr, fn) { return arr.reduce((a, x) => a + (Number(fn ? fn(x) : x) || 0), 0); },
  /** মোবাইল নম্বর → WhatsApp লিংকের জন্য আন্তর্জাতিক ফরম্যাট */
  waPhone(phone) {
    let p = U.en(phone).replace(/\D/g, '');
    if (p.startsWith('880')) return p;
    if (p.startsWith('0')) return '88' + p;
    if (p.length === 10) return '880' + p;
    return p;
  },
  /** সার্চের জন্য স্বাভাবিকীকরণ */
  norm(s) { return U.en(String(s ?? '')).toLowerCase().trim(); },
  match(q, ...fields) {
    const n = U.norm(q);
    if (!n) return true;
    return fields.some(f => U.norm(f).includes(n));
  },
  download(filename, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  /** হ্যাশের query string পড়া: #/orders/new?c=abc */
  query() {
    const h = location.hash;
    const i = h.indexOf('?');
    return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '');
  }
};
