/* পোশাক, মাপ, স্টাইল ও অন্যান্য স্থির তালিকা */
const CFG = {
  /* মাপের টেমপ্লেট — গ্রাহকের প্রোফাইলে প্রতিটি টেমপ্লেটের মাপ আলাদাভাবে সংরক্ষিত থাকে */
  templates: {
    shirt: {
      name: 'শার্টের মাপ',
      fields: [
        ['length', 'লম্বা'], ['chest', 'বুক'], ['belly', 'পেট'], ['hip', 'নিচের ঘের'],
        ['shoulder', 'কাঁধ'], ['sleeve', 'হাতা লম্বা'], ['cuff', 'হাতার মুহুরি'],
        ['collar', 'কলার/গলা'], ['armhole', 'আর্মহোল']
      ],
      styles: [
        ['collarType', 'কলার', ['সাধারণ', 'বাটন-ডাউন', 'চাইনিজ/ব্যান্ড', 'স্প্রেড']],
        ['sleeveType', 'হাতা', ['ফুল হাতা', 'হাফ হাতা']],
        ['pocket', 'পকেট', ['একটি', 'দুটি', 'নেই']],
        ['cuffType', 'কাফ', ['সাধারণ', 'ফ্রেঞ্চ কাফ', 'গোল কাফ']],
        ['fit', 'ফিটিং', ['রেগুলার', 'স্লিম', 'ঢিলা']]
      ]
    },
    pant: {
      name: 'প্যান্টের মাপ',
      fields: [
        ['length', 'লম্বা'], ['waist', 'কোমর'], ['hip', 'হিপ'], ['thigh', 'রান/থাই'],
        ['knee', 'হাঁটু'], ['bottom', 'মুহুরি'], ['fork', 'ফর্ক/উঠা']
      ],
      styles: [
        ['pleat', 'প্লেট', ['প্লেট ছাড়া', 'সিঙ্গেল প্লেট', 'ডাবল প্লেট']],
        ['backPocket', 'পিছনের পকেট', ['দুটি', 'একটি', 'নেই']],
        ['loop', 'বেল্ট লুপ', ['আছে', 'নেই']],
        ['fit', 'ফিটিং', ['রেগুলার', 'স্লিম', 'ঢিলা']]
      ]
    },
    coat: {
      name: 'কোটের মাপ',
      fields: [
        ['length', 'লম্বা'], ['chest', 'বুক'], ['belly', 'পেট'], ['hip', 'হিপ'],
        ['shoulder', 'কাঁধ'], ['sleeve', 'হাতা লম্বা'], ['cuff', 'হাতার মুহুরি'],
        ['back', 'পিঠ'], ['neck', 'গলা']
      ],
      styles: [
        ['buttons', 'বোতাম', ['এক বোতাম', 'দুই বোতাম', 'তিন বোতাম', 'ডাবল ব্রেস্ট']],
        ['lapel', 'ল্যাপেল', ['নচ ল্যাপেল', 'পিক ল্যাপেল', 'শাল ল্যাপেল']],
        ['vent', 'পিছনের ফাড়া (ভেন্ট)', ['সিঙ্গেল ভেন্ট', 'ডাবল ভেন্ট', 'ভেন্ট নেই']],
        ['lining', 'লাইনিং', ['ফুল লাইনিং', 'হাফ লাইনিং']]
      ]
    },
    punjabi: {
      name: 'পাঞ্জাবির মাপ',
      fields: [
        ['length', 'লম্বা'], ['chest', 'বুক'], ['belly', 'পেট'], ['hip', 'নিচের ঘের'],
        ['shoulder', 'কাঁধ'], ['sleeve', 'হাতা লম্বা'], ['cuff', 'হাতার মুহুরি'],
        ['neck', 'গলা'], ['placket', 'প্লেট/ফাড়া লম্বা']
      ],
      styles: [
        ['collarType', 'কলার', ['বেল্ট কলার', 'শেরওয়ানি কলার', 'গোল গলা', 'ব্যান্ড কলার']],
        ['cut', 'কাট', ['সাধারণ', 'কাবলি', 'অ্যারাবিয়ান', 'সাইড কাট']],
        ['pocket', 'পকেট', ['সাইড পকেট', 'বুক পকেট', 'দুটোই', 'নেই']],
        ['button', 'বোতাম', ['সাধারণ', 'ধাতব', 'কাঠের', 'লুকানো']]
      ]
    },
    paijama: {
      name: 'পায়জামার মাপ',
      fields: [
        ['length', 'লম্বা'], ['waist', 'কোমর'], ['hip', 'হিপ'], ['thigh', 'রান'],
        ['knee', 'হাঁটু'], ['bottom', 'মুহুরি']
      ],
      styles: [
        ['type', 'ধরন', ['সাধারণ', 'চুড়িদার', 'আলিগড়ি', 'প্যান্ট স্টাইল']],
        ['waistband', 'কোমর', ['ফিতা', 'ইলাস্টিক', 'ফিতা + ইলাস্টিক']],
        ['pocket', 'পকেট', ['আছে', 'নেই']]
      ]
    }
  },

  /* পোশাকের ধরন — কোন পোশাকে কোন মাপ লাগবে (parts) */
  garments: {
    shirt: { name: 'শার্ট', icon: '👔', parts: ['shirt'] },
    pant: { name: 'প্যান্ট', icon: '👖', parts: ['pant'] },
    suit: { name: 'স্যুট', icon: '🤵', parts: ['coat', 'pant'], extra: [['pieces', 'পিস', ['২ পিস (কোট+প্যান্ট)', '৩ পিস (কোট+প্যান্ট+ওয়েস্টকোট)']]] },
    coat: { name: 'কোট/ব্লেজার', icon: '🧥', parts: ['coat'] },
    punjabi: { name: 'পাঞ্জাবি', icon: '🥻', parts: ['punjabi'] },
    paijama: { name: 'পায়জামা', icon: '🩳', parts: ['paijama'] },
    school: { name: 'স্কুল ড্রেস', icon: '🎒', parts: ['shirt', 'pant'], school: true, extra: [['set', 'সেট', ['শার্ট + প্যান্ট', 'শুধু শার্ট', 'শুধু প্যান্ট']]] },
    other: { name: 'অন্যান্য', icon: '🧵', parts: [], tenderOnly: true }
  },

  /* ডিফল্ট সেলাই মজুরি (গ্রাহকের কাছ থেকে) */
  defaultPrices: { shirt: 450, pant: 550, suit: 5500, coat: 3500, punjabi: 650, paijama: 300, school: 900, other: 0 },
  /* ডিফল্ট কারিগর মজুরি (প্রতি পিস) */
  defaultWages: { shirt: 150, pant: 180, suit: 1600, coat: 1200, punjabi: 220, paijama: 100, school: 300, other: 0 },

  orderStatuses: [
    ['new', 'নতুন অর্ডার'],
    ['cutting', 'কাটিং'],
    ['sewing', 'সেলাই চলছে'],
    ['trial', 'ট্রায়াল'],
    ['finishing', 'ফিনিশিং ও আয়রন'],
    ['ready', 'ডেলিভারির জন্য প্রস্তুত'],
    ['delivered', 'ডেলিভারি সম্পন্ন'],
    ['cancelled', 'বাতিল']
  ],
  tenderStatuses: [
    ['preparing', 'প্রস্তুতি চলছে'],
    ['submitted', 'জমা দেওয়া হয়েছে'],
    ['awarded', 'কার্যাদেশ পাওয়া গেছে'],
    ['production', 'উৎপাদন চলছে'],
    ['completed', 'সম্পন্ন'],
    ['lost', 'পাওয়া যায়নি'],
    ['cancelled', 'বাতিল']
  ],
  instTypes: [['hotel', 'হোটেল/রিসোর্ট'], ['school', 'স্কুল/কলেজ/মাদ্রাসা'], ['office', 'অফিস/প্রতিষ্ঠান'], ['other', 'অন্যান্য']],
  customerTypes: [['regular', 'সাধারণ'], ['student', 'শিক্ষার্থী']],
  payMethods: ['ক্যাশ', 'বিকাশ', 'নগদ', 'রকেট', 'ব্যাংক'],
  expenseCats: ['দোকান ভাড়া', 'বিদ্যুৎ বিল', 'কর্মচারী বেতন', 'কাপড়/মালামাল ক্রয়', 'যাতায়াত/পরিবহন', 'মেশিন মেরামত', 'টেন্ডার খরচ', 'চা-নাস্তা', 'অন্যান্য'],
  units: ['গজ', 'মিটার', 'পিস', 'ডজন', 'রিল', 'সেট', 'প্যাকেট'],
  invCats: ['কাপড়', 'লাইনিং', 'বোতাম', 'সুতা', 'চেইন', 'অন্যান্য'],

  /* ব্যবহারকারীর অনুমতি — অ্যাডমিন সবসময় সব পারেন (সেটিংস, ব্যাকআপ ও ব্যবহারকারী ব্যবস্থাপনাসহ) */
  perms: [
    ['orders', 'অর্ডার দেখা, তৈরি ও হালনাগাদ'],
    ['customers', 'গ্রাহক ও মাপ'],
    ['payments', 'টাকা গ্রহণ ও মজুরি পরিশোধ'],
    ['tenders', 'টেন্ডার ও প্রতিষ্ঠান'],
    ['workers', 'কারিগর ও মজুরি'],
    ['inventory', 'কাপড় ও স্টক'],
    ['reports', 'রিপোর্ট ও বকেয়া'],
    ['accounts', 'হিসাব (আয়-ব্যয়, লাভ-ক্ষতি)'],
    ['delete', 'তথ্য মুছে ফেলা']
  ],
  roles: [
    ['admin', 'অ্যাডমিন'],
    ['manager', 'ম্যানেজার'],
    ['employee', 'কর্মচারী']
  ],
  roleDefaults: {
    manager: ['orders', 'customers', 'payments', 'tenders', 'workers', 'inventory', 'reports'],
    employee: ['orders', 'customers']
  },
  /* কোন পাতায় কোন অনুমতি লাগে (admin = শুধু অ্যাডমিন) */
  pagePerm: {
    dashboard: null, orders: 'orders', customers: 'customers', tenders: 'tenders', workers: 'workers',
    inventory: 'inventory', accounts: 'accounts', reports: 'reports', settings: 'admin', users: 'admin'
  },
  /* অতিথি শুধু দেখতে পারেন — কোন কোন পাতা, তা অ্যাডমিন ঠিক করেন */
  guestPermOptions: ['orders', 'customers', 'tenders', 'workers', 'inventory', 'reports', 'accounts'],
  guestDefaults: ['orders', 'customers', 'tenders', 'inventory'],
  roleName(r) { return r === 'guest' ? 'অতিথি (শুধু দেখা)' : (this.roles.find(x => x[0] === r)?.[1] || r); },

  statusName(list, key) { const f = this[list].find(s => s[0] === key); return f ? f[1] : key; },
  garmentName(key, custom) { return key === 'other' ? (custom || 'অন্যান্য') : (this.garments[key]?.name || key); }
};
