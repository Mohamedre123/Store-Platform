/**
 * بيانات تجربة لشاشات الحظر والمندوبين والحجوزات وتعديل المنتج — نفس شكل
 * `/api/app/blocked|couriers|bookings|products/:id/edit`. للتطوير بس.
 */

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString()
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function blocked() {
  return {
    matches: [
      { key: 'phone', label: 'رقم موبايل' },
      { key: 'email', label: 'بريد' },
      { key: 'ip', label: 'عنوان IP' },
      { key: 'name', label: 'اسم' },
    ],
    rows: [
      { id: 'b1', match: 'phone', matchLabel: 'رقم موبايل', value: '+201001234567', action: 'reject', reason: 'رفض الاستلام ٣ مرات', hits: 4, lastHitAt: hoursAgo(30) },
      { id: 'b2', match: 'name', matchLabel: 'اسم', value: 'تجربة تجربة', action: 'flag', reason: null, hits: 0, lastHitAt: null },
    ],
    risky: [
      { id: 'c1', name: 'أحمد سعيد', phone: '01112223334', refused: 3, delivered: 1, isBlocked: false },
      { id: 'c2', name: null, phone: '01001234567', refused: 2, delivered: 0, isBlocked: true },
    ],
  }
}

export function couriers() {
  return {
    currency: 'EGP',
    vehicles: [
      { key: 'motorcycle', label: 'موتوسيكل' },
      { key: 'car', label: 'عربية' },
      { key: 'van', label: 'ونش / فان' },
      { key: 'foot', label: 'مشي' },
    ],
    cities: ['القاهرة', 'الجيزة', 'مدينة نصر', 'المعادي', 'التجمع الخامس', '٦ أكتوبر'],
    stats: { active: 2, open: 5, waiting: 2, due: 245000 },
    waiting: [
      { id: 'o9', orderNumber: 1044, orderLabel: '#1044', customerName: 'منة الله طارق', total: 89000, isPaid: false, city: 'المعادي', createdAt: hoursAgo(5) },
      { id: 'o8', orderNumber: 1043, orderLabel: '#1043', customerName: 'عمر خالد', total: 45000, isPaid: true, city: 'الجيزة', createdAt: hoursAgo(9) },
    ],
    couriers: [
      { id: 'k1', name: 'محمود حسن', phone: '+201001112223', vehicle: 'motorcycle', vehicleLabel: 'موتوسيكل', zones: ['المعادي', 'مدينة نصر'], feePerOrder: 3000, isActive: true, note: 'بيبدأ من ١١ الصبح', openCount: 3, deliveredCount: 41, failedCount: 2, dueAmount: 185000, feesDue: 21000, link: 'https://www.zawyaeg.site/mandoub/abcdefghijklmnopqrstuvwxyz123456' },
      { id: 'k2', name: 'كريم عادل', phone: '01223334455', vehicle: 'car', vehicleLabel: 'عربية', zones: [], feePerOrder: 0, isActive: true, note: null, openCount: 2, deliveredCount: 12, failedCount: 0, dueAmount: 60000, feesDue: 0, link: 'https://www.zawyaeg.site/mandoub/zyxwvutsrqponmlkjihgfedcba654321' },
      { id: 'k3', name: 'سيد إبراهيم', phone: '01550001122', vehicle: 'foot', vehicleLabel: 'مشي', zones: ['الجيزة'], feePerOrder: 2000, isActive: false, note: null, openCount: 0, deliveredCount: 7, failedCount: 1, dueAmount: 0, feesDue: 0, link: 'https://www.zawyaeg.site/mandoub/qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' },
    ],
  }
}

const BS = {
  pending: ['مستنّي تأكيد', 'var(--color-warning-soft)', 'var(--color-warning)'],
  confirmed: ['مؤكّد', 'var(--color-info-soft)', 'var(--color-info)'],
  completed: ['تم', 'var(--color-success-soft)', 'var(--color-success)'],
  cancelled: ['ملغي', 'var(--surface-2)', 'var(--fg-muted)'],
  no_show: ['ما جاش', 'var(--color-danger-soft)', 'var(--color-danger)'],
}

export function bookings() {
  const rows = [
    ['bk1', 'جلسة تصوير منتجات', 'ريم أشرف', '01007778889', at(0, 14), at(0, 15), 'confirmed', 'عايزة خلفية بيضا', '1039'],
    ['bk2', 'قص شعر', 'مصطفى علي', '01112223344', at(0, 18, 30), at(0, 19), 'pending', null, null],
    ['bk3', 'جلسة تصوير منتجات', 'دينا حسام', null, at(1, 11), at(1, 12), 'confirmed', null, '1042'],
    ['bk4', 'قص شعر', 'ياسر محمد', '01009990000', at(-1, 17), at(-1, 17, 30), 'completed', null, null],
    ['bk5', 'استشارة', 'هالة سمير', '01234567890', at(-2, 12), at(-2, 13), 'no_show', null, null],
  ]
  return {
    enabled: true,
    hours: { days: [6, 0, 1, 2, 3, 4], from: '10:00', to: '22:00', slotMinutes: 60 },
    dayNames: ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'],
    statuses: Object.entries(BS).map(([key, [label, bg, fg]]) => ({ key, label, bg, fg })),
    bookings: rows.map(([id, productName, customerName, customerPhone, startsAt, endsAt, status, notes, order]) => ({
      id, productName, customerName, customerPhone, startsAt, endsAt, status,
      statusLabel: BS[status][0], bg: BS[status][1], fg: BS[status][2], notes, orderLabel: order ? `#${order}` : null,
    })),
  }
}

const EXP = {
  ads: ['إعلانات', 'فيسبوك، تيك توك، جوجل، مؤثّرين', '#634b9a'],
  goods: ['شراء بضاعة', 'فواتير الموردين', '#0f4c81'],
  shipping: ['شحن ومرتجعات', 'اللي بتدفعه لشركة الشحن', '#0d9488'],
  salaries: ['مرتبات وعمولات', 'الموظفين والمندوبين', '#c9a227'],
  packaging: ['تغليف ومطبوعات', 'كراتين، أكياس، استيكرات', '#a8577a'],
  rent: ['إيجار ومرافق', 'المحل، المخزن، كهربا، نت', '#6b5644'],
  fees: ['رسوم واشتراكات', 'بوابات الدفع، الاشتراكات الشهرية', '#b3341f'],
  other: ['أخرى', 'أي حاجة تانية', '#7a7a85'],
}

export function expenses() {
  const rows = [
    ['e1', 'حملة فيسبوك سبتمبر', 'ads', 350000, 2, null, false],
    ['e2', 'إيجار المخزن', 'rent', 500000, 10, 'بيتدفع أول الشهر', true],
    ['e3', 'كراتين وأكياس', 'packaging', 45000, 5, null, false],
    ['e4', 'مرتب مساعد المبيعات', 'salaries', 400000, 12, null, true],
    ['e5', 'تيك توك', 'ads', 120000, 20, null, false],
  ]
  const list = rows.map(([id, title, category, amount, daysAgo, note, isRecurring]) => ({
    id, title, category, amount, note, isRecurring,
    spentAt: new Date(now - daysAgo * 86400e3).toISOString(),
    categoryLabel: EXP[category][0], color: EXP[category][2],
  }))
  const by = {}
  for (const e of list) by[e.category] = (by[e.category] ?? 0) + e.amount
  const monthTotal = list.reduce((s, e) => s + e.amount, 0)
  return {
    currency: 'EGP',
    categories: Object.entries(EXP).map(([key, [label, hint, color]]) => ({ key, label, hint, color })),
    profit: { revenue: 4800000, cogs: 2100000, expenses: monthTotal, net: 4800000 - 180000 - 2100000 - monthTotal, marginBps: 870, shippingCollected: 180000 },
    monthTotal,
    totals: Object.entries(by).sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total, label: EXP[category][0], color: EXP[category][2] })),
    expenses: list,
  }
}

export function suppliers() {
  const products = [
    { id: 'p1', name: 'قميص قطن بياقة', supplierId: 's1' },
    { id: 'p2', name: 'بنطلون جينز سليم', supplierId: 's1' },
    { id: 'p3', name: 'شنطة جلد يدوي', supplierId: 's2' },
    { id: 'p4', name: 'ساعة كلاسيك', supplierId: null },
    { id: 'p5', name: 'حزام جلد', supplierId: null },
  ]
  return {
    currency: 'EGP',
    unlinkedCount: 2,
    reorderCount: 3,
    reorder: [
      { supplierId: 's1', name: 'مصنع النور', phone: '01005556667', items: [
        { id: 'p1', name: 'قميص قطن بياقة', sku: 'SH-01', stock: 0, costPrice: 18000 },
        { id: 'p2', name: 'بنطلون جينز سليم', sku: null, stock: 3, costPrice: 26000 },
      ] },
      { supplierId: null, name: null, phone: null, items: [{ id: 'p4', name: 'ساعة كلاسيك', sku: 'W-7', stock: 2, costPrice: null }] },
    ],
    suppliers: [
      { id: 's1', name: 'مصنع النور', phone: '01005556667', email: 'sales@alnour.com', marginPercent: 35, isActive: true, productCount: 2 },
      { id: 's2', name: 'ورشة الجلود', phone: null, email: null, marginPercent: 30, isActive: false, productCount: 1 },
    ],
    products,
  }
}

export function categories() {
  return {
    categories: [
      { id: 'cat1', name: 'ملابس رجالي', description: null, image: null, isActive: true, parentId: null, parentName: null, productCount: 12 },
      { id: 'cat2', name: 'قمصان', description: 'قطن ١٠٠٪', image: null, isActive: true, parentId: 'cat1', parentName: 'ملابس رجالي', productCount: 5 },
      { id: 'cat3', name: 'بناطيل', description: null, image: null, isActive: false, parentId: 'cat1', parentName: 'ملابس رجالي', productCount: 0 },
      { id: 'cat4', name: 'إكسسوارات', description: null, image: null, isActive: true, parentId: null, parentName: null, productCount: 7 },
    ],
  }
}

export function trash() {
  return {
    currency: 'EGP',
    products: [
      { id: 't-1', name: 'تيشيرت صيفي قديم', price: 19900, image: null, deletedAt: hoursAgo(30) },
      { id: 't-2', name: 'كاب رياضي', price: 12000, image: null, deletedAt: hoursAgo(300) },
    ],
  }
}

export function loyalty() {
  return {
    currency: 'EGP',
    enabled: true,
    settings: { pointsPerPound: 1, pointValue: 5, minPointsToRedeem: 100, welcomePoints: 50, reviewPoints: 20, referralPoints: 100 },
    tiers: [
      { key: 'bronze', name: 'برونزي', minPoints: 0, color: '#a1662f', discountBps: 0 },
      { key: 'silver', name: 'فضي', minPoints: 500, color: '#8a8f98', discountBps: 300 },
      { key: 'gold', name: 'ذهبي', minPoints: 2000, color: '#c9a227', discountBps: 700 },
    ],
    stats: { members: 184, outstanding: 23650 },
    rewardTypes: [
      { key: 'coupon_percent', label: 'خصم بنسبة', unit: '٪' },
      { key: 'coupon_fixed', label: 'خصم بمبلغ', unit: 'ج' },
      { key: 'free_shipping', label: 'شحن مجاني', unit: null },
      { key: 'free_product', label: 'منتج مجاني', unit: null },
    ],
    tierOptions: [
      { key: 'bronze', label: 'برونزي' },
      { key: 'silver', label: 'فضّي' },
      { key: 'gold', label: 'ذهبي' },
      { key: 'platinum', label: 'بلاتيني' },
    ],
    rewards: [
      { id: 'rw1', name: 'خصم ١٠٪', description: null, type: 'coupon_percent', typeLabel: 'خصم بنسبة', value: 1000, pointsCost: 300, minTier: null, minTierLabel: null, stock: null, redeemedCount: 12, isActive: true },
      { id: 'rw2', name: 'شحن مجاني', description: 'أي طلب', type: 'free_shipping', typeLabel: 'شحن مجاني', value: 0, pointsCost: 150, minTier: 'silver', minTierLabel: 'فضّي', stock: 40, redeemedCount: 3, isActive: false },
    ],
    wheel: {
      enabled: false,
      title: 'جرّب حظك',
      prizes: [
        { label: 'خصم ١٠٪', color: '#634b9a', chance: 25 },
        { label: 'حظ أوفر', color: '#0f4c81', chance: 35 },
        { label: 'شحن مجاني', color: '#15803d', chance: 20 },
      ],
      subtitle: 'لُف واكسب خصم',
      triggerAfterSeconds: 15,
      freeSpinsPerDay: 1,
      prizeInputs: [
        { label: 'خصم ١٠٪', color: '#634b9a', type: 'coupon_percent', value: '10', chance: '25' },
        { label: 'حظ أوفر', color: '#0f4c81', type: 'nothing', value: '0', chance: '35' },
        { label: 'شحن مجاني', color: '#15803d', type: 'free_shipping', value: '0', chance: '20' },
      ],
    },
    editsTiers: true,
    recent: [
      { id: 'lt1', points: 450, reason: 'طلب #1041', customerName: 'سارة محمود', createdAt: hoursAgo(3) },
      { id: 'lt2', points: -300, reason: 'استبدال خصم ١٠٪', customerName: 'كريم حسن', createdAt: hoursAgo(26) },
    ],
  }
}

export function affiliates() {
  return {
    currency: 'EGP',
    stats: { balance: 42000, earned: 128000, conversions: 23 },
    affiliates: [
      { id: 'af1', name: 'أحمد المؤثّر', phone: '+201001112233', email: null, code: 'AHMED', commissionType: 'percent', commissionInput: '10', commissionLabel: '10٪', balance: 42000, totalEarned: 98000, totalPaid: 56000, clicks: 1840, conversions: 19, isActive: true, link: 'https://www.zawyaeg.site/s/demo?ref=AHMED' },
      { id: 'af2', name: 'نورا', phone: null, email: 'noura@mail.com', code: 'NOURA', commissionType: 'fixed', commissionInput: '50', commissionLabel: '٥٠ ج.م.', balance: 0, totalEarned: 30000, totalPaid: 30000, clicks: 320, conversions: 4, isActive: false, link: 'https://www.zawyaeg.site/s/demo?ref=NOURA' },
    ],
  }
}

export function referrals() {
  return { storeName: 'متجر الأناقة', link: 'https://www.zawyaeg.site/signup?ref=ELANAKA', code: 'ELANAKA', signups: 3, subscribed: 1, deliveredOrders: 412 }
}

/* صورة صغيرة ملوّنة كـdata URL — عشان الشبكة تبان من غير نت */
const swatch = (hex) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${hex}"/></svg>`)}`

export function media() {
  const rows = [
    ['md1', 'فستان سهرة أمامي.jpg', 'products', 420000, 2, '#634b9a'],
    ['md2', 'فستان سهرة خلفي.jpg', 'products', 380000, 1, '#8b5cf6'],
    ['md3', 'بانر العيد.png', 'banners', 910000, 0, '#c9a227'],
    ['md4', 'شعار.png', 'logos', 60000, 0, '#0f4c81'],
    ['md5', 'قسم الشنط.jpg', 'categories', 250000, 0, '#a8577a'],
    ['md6', 'صورة قديمة.jpg', 'misc', 190000, 0, '#6b5644'],
  ]
  const labels = { products: 'صور المنتجات', categories: 'صور الأقسام', banners: 'البانرات', logos: 'الشعارات', misc: 'متنوّع' }
  return {
    synced: 0,
    totalBytes: rows.reduce((n, r) => n + r[3], 0),
    folders: Object.entries(labels).map(([key, label]) => ({ key, label })),
    items: rows.map(([id, name, folder, sizeBytes, usedIn, hex], i) => ({
      id, name, folder, folderLabel: labels[folder], sizeBytes, usedIn, url: swatch(hex), createdAt: hoursAgo(i * 20 + 1),
    })),
  }
}

export function blog() {
  return {
    posts: [
      { id: 'bp1', title: 'إزاي تختاري فستان السهرة المناسب لجسمك', slug: 'choose-evening-dress', excerpt: 'دليل سريع للمقاسات والقصّات', content: 'الفقرة الأولى.\n\nالفقرة التانية.', cover: swatch('#634b9a'), author: 'فريق المتجر', isPublished: true, publishedAt: hoursAgo(80), views: 312, url: 'https://www.zawyaeg.site/s/demo/blog/choose-evening-dress' },
      { id: 'bp2', title: 'العناية بالشنط الجلد', slug: 'leather-care', excerpt: '', content: '', cover: null, author: '', isPublished: false, publishedAt: null, views: 0, url: 'https://www.zawyaeg.site/s/demo/blog/leather-care' },
    ],
  }
}

export function banners() {
  const labels = { hero: 'البانر الرئيسي', promo: 'شريط ترويجي', category: 'بانر قسم', popup: 'نافذة منبثقة' }
  return {
    placements: Object.entries(labels).map(([key, label]) => ({ key, label })),
    banners: [
      { id: 'bn1', placement: 'promo', placementLabel: labels.promo, title: 'خصم العيد ٢٠٪', subtitle: 'على كل الفساتين', imageDesktop: swatch('#c9a227'), imageMobile: null, ctaLabel: 'تسوّقي', ctaUrl: '/products', startsAt: '', endsAt: '2026-09-30', isActive: true, expired: false },
      { id: 'bn2', placement: 'category', placementLabel: labels.category, title: '', subtitle: '', imageDesktop: swatch('#0f4c81'), imageMobile: swatch('#0d9488'), ctaLabel: '', ctaUrl: '', startsAt: '', endsAt: '2026-08-01', isActive: true, expired: true },
    ],
  }
}

export function automations() {
  return {
    whatsappReady: false,
    telegramReady: true,
    recipients: [
      { id: 'rc1', name: 'صاحب المحل', channel: 'telegram', channelLabel: 'تيليجرام', target: '123456789', eventsLabel: 'طلب جديد، طلب اتلغى', isActive: true },
      { id: 'rc2', name: '', channel: 'whatsapp', channelLabel: 'واتساب', target: '+201001112233', eventsLabel: 'طلب جديد', isActive: false },
    ],
    rules: [
      { id: 'ru1', name: 'ترحيب بالعميل الجديد', triggerLabel: 'عميل جديد', conditions: [], actions: ['ولّد كوبون خصم'], cooldownHours: 0, enabled: true, runCount: 37, lastRunAt: hoursAgo(5) },
      { id: 'ru2', name: 'استرجاع السلة', triggerLabel: 'سلة متروكة', conditions: ['إجمالي الطلب أكبر من أو يساوي 500'], actions: ['ولّد كوبون خصم', 'ابعت بريدًا للعميل'], cooldownHours: 24, enabled: false, runCount: 0, lastRunAt: null },
    ],
  }
}

/** فورم التعديل من تفاصيل المنتج الوهمية (mock-api.mjs) */
export function productEdit(detail) {
  const p = detail.product
  return {
    currency: detail.currency ?? 'EGP',
    hasVariants: (detail.options ?? []).length > 0,
    product: {
      id: p.id,
      name: p.name,
      price: String(p.price / 100),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice / 100) : '',
      stock: String(p.stock),
      trackInventory: p.trackInventory,
      categoryId: '',
      description: p.description ?? '',
      status: p.status === 'active' ? 'active' : 'draft',
      images: p.images ?? [],
    },
  }
}

const mockField = (key, label, secret, extra = {}) => ({ key, label, secret, placeholder: '', hint: '', required: true, value: '', saved: false, ...extra })
const mockProvider = (o) => ({ desc: '', mode: 'api', signupUrl: 'https://example.com/signup', where: 'من لوحتهم ← الإعدادات ← المفاتيح', docsUrl: null, hasTestMode: true, webhookUrl: null, enabled: false, testMode: false, lastError: null, hasCreds: false, flatRate: '', freeOver: '', ...o })

export function payments() {
  return {
    currency: 'EGP',
    codEnabled: true,
    methods: [
      { gateway: 'cod', title: 'الدفع عند الاستلام', desc: 'العميل بيدفع كاش لمّا الطلب يوصله. الأكثر استخدامًا في مصر.', defaultName: 'الدفع عند الاستلام', hasFee: true, hasInstructions: false, instructionsLabel: '', instructionsHint: '', enabled: true, displayName: 'الدفع عند الاستلام', instructions: '', fee: '10' },
      { gateway: 'manual', title: 'تحويل بنكي أو محفظة', desc: 'العميل بيحوّل على حسابك أو محفظتك، ويبعتلك الإيصال. من غير أي عقود.', defaultName: 'تحويل بنكي / فودافون كاش', hasFee: false, hasInstructions: true, instructionsLabel: 'تعليمات التحويل', instructionsHint: 'اكتب رقم حسابك أو محفظتك، والعميل هيشوفها في الشيك أوت.', enabled: false, displayName: 'تحويل بنكي / فودافون كاش', instructions: '', fee: '' },
    ],
    gateways: [
      mockProvider({ slug: 'paymob', name: 'باي موب', brand: 'Paymob', color: '#1e40af', desc: 'فيزا وماستر كارد ومحافظ إلكترونية وميزة. الأشهر في مصر.', webhookUrl: 'https://www.zawyaeg.site/api/webhooks/pay/paymob/demo-store', fields: [mockField('apiKey', 'API Key', true, { saved: true }), mockField('integrationId', 'Integration ID', false, { value: '4412345' }), mockField('iframeId', 'iFrame ID', false, { required: false, hint: 'من Developers ← iframes' })], enabled: true, testMode: true, hasCreds: true, docsUrl: 'https://docs.paymob.com' }),
      mockProvider({ slug: 'kashier', name: 'كاشير', brand: 'Kashier', color: '#0f766e', desc: 'بطاقات ومحافظ بعمولة أقل للمتاجر الصغيرة.', fields: [mockField('merchantId', 'Merchant ID', false, { value: 'MID-123' }), mockField('apiKey', 'API Key', true, { saved: true })], hasCreds: true, lastError: 'المفتاح اترفض من كاشير — راجعه من لوحتهم' }),
      mockProvider({ slug: 'fawry', name: 'فوري', brand: 'Fawry', color: '#f59e0b', desc: 'الدفع من أي منفذ فوري أو بالبطاقة.', fields: [mockField('merchantCode', 'Merchant Code', false), mockField('secureKey', 'Secure Key', true)] }),
    ],
    attempts: [
      { id: 'pa1', gateway: 'باي موب', status: 'succeeded', statusLabel: 'اتدفع', tone: 'good', amount: 125000, currency: 'EGP', orderId: 'o-1042', orderNumber: 1042, error: null, createdAt: hoursAgo(2) },
      { id: 'pa2', gateway: 'باي موب', status: 'failed', statusLabel: 'فشلت', tone: 'bad', amount: 56000, currency: 'EGP', orderId: 'o-1041', orderNumber: 1041, error: 'البطاقة اترفضت من البنك — العميل يجرّب بطاقة تانية', createdAt: hoursAgo(20) },
      { id: 'pa3', gateway: 'باي موب', status: 'redirected', statusLabel: 'اتحوّل للبوابة', tone: 'info', amount: 32000, currency: 'EGP', orderId: null, orderNumber: null, error: null, createdAt: hoursAgo(30) },
    ],
  }
}

export function shipping() {
  const regions = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية', 'أسيوط', 'أسوان']
  return {
    country: 'EG',
    currency: 'EGP',
    codEnabled: true,
    autoShip: true,
    carrier: { name: 'بوسطة', canFetch: true },
    zone: { enabled: true, defaultPrice: '60', freeShippingEnabled: true, freeOverAmount: '1500', minDays: 2, maxDays: 5 },
    regions: regions.map((name, i) => ({ name, price: i < 2 ? '45' : i === 7 ? '90' : '' })),
    zones: [
      { key: 'greater_cairo', label: 'القاهرة الكبرى', hint: 'القاهرة، الجيزة، القليوبية' },
      { key: 'alexandria', label: 'الإسكندرية', hint: 'الإسكندرية والبحيرة' },
      { key: 'delta', label: 'الدلتا', hint: 'الدقهلية، الشرقية، الغربية…' },
      { key: 'upper_egypt', label: 'الصعيد', hint: 'أسيوط، سوهاج، أسوان…' },
    ],
    carriers: [
      mockProvider({ slug: 'bosta', name: 'بوسطة', brand: 'Bosta', color: '#e11d48', desc: 'أشهر شركة شحن في مصر — تغطية كل المحافظات وتحصيل عند الاستلام.', webhookUrl: 'https://www.zawyaeg.site/api/webhooks/ship/bosta/demo-store', fields: [mockField('apiKey', 'API Key', true, { saved: true }), mockField('pickupCity', 'مدينة الاستلام', false, { value: 'القاهرة', required: false })], enabled: true, hasTestMode: false, hasCreds: true, flatRate: '55' }),
      mockProvider({ slug: 'aramex', name: 'أرامكس', brand: 'Aramex', color: '#dc2626', mode: 'manual', hasTestMode: false, desc: 'شحن محلي ودولي.', fields: [mockField('accountNumber', 'رقم الحساب', false)] }),
    ],
    pricedCarriers: ['بوسطة'],
    sampleBase: 6000,
    methods: [
      { id: '0b8a5d7e-1c2f-4e3a-9b8c-7d6e5f4a3b21', name: 'توصيل سريع', hint: 'يوصلك خلال ٢٤ ساعة', priceDelta: 3000, minDays: 1, maxDays: 1, enabled: true, sortOrder: 0 },
      { id: '1c9b6e8f-2d3a-4f4b-8c9d-8e7f6a5b4c32', name: 'استلام من الفرع', hint: '', priceDelta: -6000, minDays: null, maxDays: null, enabled: false, sortOrder: 1 },
    ],
  }
}

export function posts() {
  const accounts = [
    { id: 'sa1', name: 'متجر الأناقة', platform: 'facebook', platformLabel: 'فيسبوك', color: '#1877F2', status: 'active' },
    { id: 'sa2', name: '@elanaka.store', platform: 'instagram', platformLabel: 'إنستجرام', color: '#E1306C', status: 'active' },
    { id: 'sa3', name: 'elanaka', platform: 'tiktok', platformLabel: 'تيك توك', color: '#010101', status: 'expired' },
  ]
  return {
    studioEnabled: true,
    accounts,
    posts: [
      { id: 'sp1', caption: 'فستان الصيف الجديد وصل 🌸\nقماش خفيف ومريح، ومقاسات من S لـ XXL.\nاطلبيه دلوقتي والشحن مجاني فوق ١٥٠٠ ج.', hashtags: ['#فساتين', '#موضة', '#متجر_الأناقة'], imageUrls: [swatch('#c084fc')], videoUrl: null, status: 'ready', statusLabel: 'جاهز للنشر', targets: [], publishedAt: null, createdAt: hoursAgo(3), results: [] },
      { id: 'sp2', caption: 'كوليكشن الشنط الجلد — ٤ ألوان', hashtags: ['#شنط'], imageUrls: [swatch('#92400e'), swatch('#1e3a8a'), swatch('#065f46')], videoUrl: null, status: 'published', statusLabel: 'اتنشر', targets: ['sa1', 'sa2'], publishedAt: hoursAgo(26), createdAt: hoursAgo(27), results: [{ accountId: 'sa1', accountName: 'متجر الأناقة', color: '#1877F2', ok: true, error: null }, { accountId: 'sa2', accountName: '@elanaka.store', color: '#E1306C', ok: true, error: null }] },
      { id: 'sp3', caption: 'خصم ٢٠٪ على الأحذية لآخر الأسبوع', hashtags: [], imageUrls: [swatch('#0f766e')], videoUrl: null, status: 'failed', statusLabel: 'فشل', targets: ['sa2'], publishedAt: null, createdAt: hoursAgo(50), results: [{ accountId: 'sa2', accountName: '@elanaka.store', color: '#E1306C', ok: false, error: 'إنستجرام رفض الصورة — لازم تكون مربعة أو طولية' }] },
    ],
  }
}

export function schedules() {
  const weekdays = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'].map((label, day) => ({ day, label }))
  const base = { targets: ['sa1'], source: 'auto', categoryId: null, productIds: [], style: null, preset: 'portrait', slides: 5, imageStyle: 'auto', aiProvider: null, aiTextModel: null, aiImageModel: null, lastRunAt: null, lastError: null }
  return {
    studioEnabled: true,
    timezone: 'Africa/Cairo',
    providers: [{ key: 'gemini', label: 'Gemini' }, { key: 'openai', label: 'ChatGPT' }],
    weekdays,
    presets: [{ key: 'portrait', label: 'إنستجرام', hint: '' }, { key: 'square', label: 'مربّع', hint: '' }, { key: 'story', label: 'ستوري وريلز', hint: '' }, { key: 'landscape', label: 'عرضي', hint: '' }],
    styles: [{ key: 'auto', label: 'يختار لوحده', hint: 'على حسب المنتج وكلامك' }, { key: 'plain', label: 'خلفية سادة', hint: 'المنتج لوحده على لون واحد' }, { key: 'scene', label: 'مكان حقيقي', hint: 'المنتج في مكان استخدامه' }, { key: 'ugc', label: 'عفوية بالموبايل', hint: 'كأن عميل حقيقي صوّرها' }],
    accounts: [{ id: 'sa1', name: 'متجر الأناقة', platform: 'facebook', color: '#1877F2' }, { id: 'sa2', name: '@elanaka.store', platform: 'instagram', color: '#E1306C' }],
    categories: [{ id: 'c1', name: 'فساتين' }, { id: 'c2', name: 'شنط' }],
    products: [{ id: 'p-000001', name: 'فستان صيفي', image: swatch('#c084fc') }, { id: 'p-000002', name: 'شنطة جلد', image: swatch('#92400e') }, { id: 'p-000003', name: 'حذاء رياضي', image: null }],
    schedules: [
      { ...base, id: '2d8f3e1a-4b5c-4d6e-9f7a-8b9c0d1e2f31', name: 'بوست يومي', isActive: true, days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: '10:00', media: 'image', autoPublish: false, nextRunAt: hoursAgo(-14), summary: 'كل يوم الساعة 10:00' },
      { ...base, id: '3e9a4f2b-5c6d-4e7f-8a9b-9c0d1e2f3a42', name: 'كاروسيل الجمعة', isActive: false, days: [5], timeOfDay: '19:30', media: 'carousel', slides: 6, autoPublish: true, targets: ['sa1', 'sa2'], nextRunAt: null, lastError: 'مفتاح Gemini خلص رصيده — راجع الإضافات', summary: 'كل الجمعة الساعة 19:30' },
    ],
  }
}

export function scheduleModels() {
  return { ok: true, provider: 'gemini', text: [{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }, { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }], image: [{ id: 'imagen-4', label: 'Imagen 4' }], defaultText: 'gemini-2.5-flash', defaultImage: null }
}

export function socialAccounts() {
  return {
    studioEnabled: true,
    viaProvider: true,
    accounts: [
      { id: 'sa1', name: 'متجر الأناقة', platform: 'facebook', platformLabel: 'فيسبوك', color: '#1877F2', avatar: null, canPublish: true, status: 'active', lastError: null },
      { id: 'sa3', name: 'elanaka', platform: 'tiktok', platformLabel: 'تيك توك', color: '#010101', avatar: null, canPublish: false, status: 'expired', lastError: 'تيك توك لغى الإذن — اربط تاني' },
    ],
  }
}

export function team() {
  const permissions = [
    { key: 'orders.view', label: 'يشوف الطلبات', hint: 'القايمة وتفاصيل كل طلب' },
    { key: 'orders.manage', label: 'يشتغل على الطلبات', hint: 'يغيّر الحالة، يسجّل طلب، يعمل شحنة' },
    { key: 'products.view', label: 'يشوف المنتجات', hint: 'الكتالوج من غير تعديل' },
    { key: 'customers.view', label: 'يشوف العملاء', hint: 'بياناتهم وطلباتهم' },
    { key: 'finance.view', label: 'يشوف الفلوس', hint: 'التكلفة والمصروفات وصافي الربح.' },
    { key: 'team.manage', label: 'يدير الفريق والاشتراك', hint: 'يضيف موظفين ويغيّر صلاحياتهم' },
  ]
  return {
    canManage: true,
    currentUserId: 'u1',
    roleLabels: { owner: 'المالك', admin: 'مدير', staff: 'موظف' },
    permissions,
    presets: [{ key: 'support', label: 'خدمة عملاء', hint: '', role: 'staff', permissions: ['orders.view', 'orders.manage', 'customers.view', 'products.view'] }],
    members: [
      { id: '4f0b5a3c-6d7e-4f8a-9b0c-1d2e3f4a5b61', userId: 'u1', name: 'محمد أحمد', email: 'owner@mail.com', role: 'owner', permissions: [], isBlocked: false, joinedAt: hoursAgo(900) },
      { id: '5a1c6b4d-7e8f-4a9b-8c1d-2e3f4a5b6c72', userId: 'u2', name: 'سارة', email: 'sara@mail.com', role: 'staff', permissions: ['orders.view', 'orders.manage', 'products.view', 'customers.view'], isBlocked: false, joinedAt: hoursAgo(200) },
      { id: '6b2d7c5e-8f9a-4b0c-9d2e-3f4a5b6c7d83', userId: 'u3', name: 'كريم', email: 'karim@mail.com', role: 'admin', permissions: [], isBlocked: true, joinedAt: hoursAgo(100) },
    ],
    invites: [{ id: '7c3e8d6f-9a0b-4c1d-8e3f-4a5b6c7d8e94', email: 'new.staff@mail.com', role: 'staff', roleLabel: 'موظف', expiresAt: hoursAgo(-120) }],
  }
}

export function sessions() {
  return {
    sessions: [
      { id: '8d4f9e7a-0b1c-4d2e-9f4a-5b6c7d8e9fa5', device: 'mobile', label: 'كروم على أندرويد', ip: '41.33.12.8', createdAt: hoursAgo(2), expiresAt: hoursAgo(-700), isCurrent: true },
      { id: '9e5a0f8b-1c2d-4e3f-8a5b-6c7d8e9fa0b6', device: 'desktop', label: 'كروم على ويندوز', ip: '156.200.4.19', createdAt: hoursAgo(50), expiresAt: hoursAgo(-600), isCurrent: false },
      { id: 'af6b1a9c-2d3e-4f4a-9b6c-7d8e9fa0b1c7', device: 'tablet', label: 'سفاري على آيفون', ip: null, createdAt: hoursAgo(300), expiresAt: hoursAgo(-300), isCurrent: false },
    ],
  }
}

export function activity() {
  return {
    items: [
      { id: 'ac1', label: 'تغيير حالة طلب', risky: false, who: 'سارة', whoKey: 'sara@mail.com', createdAt: hoursAgo(1), before: '{\n "status": "pending"\n}', after: '{\n "status": "confirmed"\n}' },
      { id: 'ac2', label: 'حذف منتج', risky: true, who: 'محمد أحمد', whoKey: 'owner@mail.com', createdAt: hoursAgo(20), before: '{\n "name": "شنطة قديمة"\n}', after: null },
      { id: 'ac3', label: 'تغيير الإعدادات', risky: false, who: 'النظام', whoKey: 'system', createdAt: hoursAgo(40), before: null, after: null },
    ],
  }
}
