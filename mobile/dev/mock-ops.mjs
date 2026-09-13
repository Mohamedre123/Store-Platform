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
