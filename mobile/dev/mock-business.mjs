/**
 * بيانات تجربة لشاشات الكوبونات والمخزون والرسايل والاشتراك — نفس شكل
 * `/api/app/marketing|inventory|messages|subscription`. للتطوير بس.
 */

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString()

export function marketing() {
  return {
    currency: 'EGP',
    stats: { active: 2, totalUses: 57, total: 3 },
    coupons: [
      { id: 'cp1', code: 'RAMADAN20', description: 'خصم رمضان على كل المنتجات', valueLabel: 'خصم ٢٠٪', conditions: ['للطلبات من ٣٠٠ ج.م.', 'بحد أقصى ١٠٠ ج.م.', 'لكل العملاء', 'لحد ٣٠ سبتمبر ٢٠٢٦'], usedLabel: 'استُخدم ٤١ مرة', isActive: true, expired: false },
      { id: 'cp2', code: 'WELCOME', description: null, valueLabel: 'خصم ٥٠ ج.م.', conditions: ['لأول طلب بس'], usedLabel: 'استُخدم ١٦ من ١٠٠', isActive: true, expired: false },
      { id: 'cp3', code: 'FREESHIP', description: 'شحن مجاني نهاية الأسبوع', valueLabel: 'شحن مجاني', conditions: ['على ٣ منتج', 'لكل العملاء'], usedLabel: 'استُخدم ٠ مرة', isActive: false, expired: true },
    ],
    offers: [{ id: 'of1', name: 'اشتري أكتر ووفّر', badge: 'عرض', tiersLabel: '٢ قطع: خصم ١٠٪ · ٣ قطع: خصم ١٥٪', productsLabel: 'على كل المنتجات', isActive: true }],
    bundles: [{ id: 'bd1', name: 'طقم السهرة', badge: 'باقة', productsLabel: 'فستان سهرة ستان + شنطة جلد يد', priceLabel: '١٬٤٠٠ ج.م.', isActive: false }],
  }
}

export function inventory() {
  return {
    currency: 'EGP',
    stats: { units: 186, valueLabel: '٣٢٬٤٠٠ ج.م.', out: 1, low: 2 },
    items: [
      { id: 'p3', name: 'شنطة جلد يد', sku: 'BAG-011', image: null, stock: 0, threshold: 3, variants: [] },
      { id: 'p2', name: 'بلوزة قطن مطرّزة', sku: 'BL-204', image: null, stock: 0, threshold: 5, variants: [
        { id: 'v1', title: 'S / أبيض', sku: null, stock: 2 },
        { id: 'v2', title: 'M / أبيض', sku: null, stock: 1 },
        { id: 'v3', title: 'L / أسود', sku: null, stock: 0 },
      ] },
      { id: 'p4', name: 'طرحة شيفون', sku: null, image: null, stock: 4, threshold: 5, variants: [] },
      { id: 'p1', name: 'فستان سهرة ستان', sku: 'DR-100', image: null, stock: 38, threshold: 5, variants: [] },
    ],
    movements: [
      { id: 'm1', delta: -2, reasonLabel: 'طلب', note: null, productName: 'فستان سهرة ستان', createdAt: hoursAgo(1) },
      { id: 'm2', delta: 20, reasonLabel: 'توريد', note: 'شحنة المصنع', productName: 'فستان سهرة ستان', createdAt: hoursAgo(26) },
      { id: 'm3', delta: 1, reasonLabel: 'مرتجع', note: null, productName: 'طرحة شيفون', createdAt: hoursAgo(50) },
    ],
  }
}

export function messages() {
  const ok = ['اتبعتت', 'var(--color-success-soft)', 'var(--color-success)']
  const bad = ['فشلت', 'var(--color-danger-soft)', 'var(--color-danger)']
  const rows = [
    ['email', 'تأكيد طلب', 'sara@mail.com', 'تأكيد طلبك رقم 1041 من متجر الأناقة', ok, null, 'o2'],
    ['whatsapp', 'الطلب اتشحن', '+201002345671', 'طلبك رقم 1038 اتشحن مع بوسطة — رقم البوليصة BST-22841', ok, null, 'o5'],
    ['whatsapp', 'تأكيد طلب', '+201223334444', 'مرحبًا، طلبك رقم 1039 وصلنا', bad, '429: rate limit reached — free plan allows 1 message per minute', 'o4'],
    ['email', 'تذكير سلة متروكة', 'rana@mail.com', 'نسيت حاجة في سلتك؟', ok, null, null],
  ]
  return {
    emailConfigured: true,
    counts: { total: 128, last7: 23, failed: 1 },
    messages: rows.map(([channel, eventLabel, recipient, body, meta, error, orderId], i) => ({
      id: `msg${i}`, channel, eventLabel, recipient, body, status: meta === bad ? 'failed' : 'sent',
      statusLabel: meta[0], bg: meta[1], fg: meta[2], error, orderId, createdAt: hoursAgo(i * 3 + 0.5),
    })),
  }
}

let trialStarted = false

export function subscription() {
  return {
    accountId: 'ZW-48K2Q7PM',
    isAdmin: false,
    active: trialStarted,
    onTrial: trialStarted,
    expired: false,
    title: trialStarted ? 'فترة تجريبية' : 'الباقة المجانية',
    text: trialStarted ? 'التجربة بتنتهي في ١٦ سبتمبر ٢٠٢٦' : 'مفيش اشتراك شغّال — اختار باقة وافتح كل المميزات.',
    tone: trialStarted ? 'warning' : 'danger',
    daysLeft: trialStarted ? 3 : null,
    quota: { limit: trialStarted ? null : 5, used: 3, blocked: false },
    trial: { state: trialStarted ? 'running' : 'available', name: 'تجربة مجانية', tagline: '٣ أيام بكل المميزات — من غير أي دفع.' },
    plans: [
      { key: 'monthly', name: 'الباقة الشهرية', priceLabel: '٥٠٠ ج.م.', tagline: 'شهر كامل، كل حاجة مفتوحة.', features: ['أدوات الذكاء الاصطناعي كلها', 'صفحات الهبوط بلا حدود', 'طلبات بلا حدود', 'ربط نطاقك الخاص'], highlight: true },
      { key: 'yearly', name: 'الباقة السنوية', priceLabel: '٥٬٥٠٠ ج.م.', tagline: 'سنة كاملة — بتوفّر تمن شهرين.', features: ['كل مميزات الشهري', 'أوفر من الشهري بـ١٤٥٠ جنيه'], highlight: false },
    ],
    pendingPlan: null,
    requests: [],
    history: [],
  }
}

export function startTrial() {
  trialStarted = true
}
