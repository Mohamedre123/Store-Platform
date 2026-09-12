/**
 * بيانات تجربة لشاشات الطلبات — نفس شكل `/api/app/orders*` بالظبط.
 *
 * للتطوير بس (صفحة التجربة على localhost). الحالة والملاحظات بتتحفظ في
 * الذاكرة، فتغيير الحالة بيبان في القايمة بعدها زي الحقيقي.
 */

const LABELS = {
  incomplete: 'ناقص',
  pending: 'قيد الانتظار',
  confirmed: 'مؤكّد',
  processing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
}
const NEXT = { pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'delivered' }
const TABS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString()

const people = [
  ['أحمد علي', 'القاهرة', 75000, 'pending', null],
  ['سارة محمود', 'الجيزة', 120000, 'confirmed', { level: 'good', label: 'موثوق' }],
  ['كريم حسن', 'الإسكندرية', 48500, 'pending', { level: 'risky', label: 'خطر' }],
  ['منى إبراهيم', 'المنصورة', 210000, 'processing', null],
  ['يوسف سمير', 'طنطا', 33000, 'shipped', null],
  ['نور الهدى', 'القاهرة', 99000, 'shipped', { level: 'watch', label: 'حاسب' }],
  ['محمد عادل', 'الجيزة', 152000, 'delivered', { level: 'good', label: 'موثوق' }],
  ['هبة سامي', 'أسيوط', 64000, 'delivered', null],
  ['عمر خالد', 'الإسكندرية', 87500, 'cancelled', null],
  ['ليلى مصطفى', 'القاهرة', 43000, 'delivered', null],
]

const orders = people.map(([name, city, total, status, trust], i) => ({
  id: `o${i + 1}`,
  number: String(1042 - i),
  status,
  incomplete: false,
  name,
  phone: `0100${String(2345671 + i * 1117).slice(0, 7)}`,
  email: i % 3 === 0 ? `customer${i + 1}@mail.com` : null,
  city,
  total,
  createdAt: hoursAgo(i * 5.5 + 0.4),
  trust,
}))

const carts = [
  { id: 'c1', number: '1036', status: 'incomplete', incomplete: true, name: 'رنا فتحي', phone: '01011122233', email: null, city: 'القاهرة', total: 56000, createdAt: hoursAgo(2), trust: null },
  { id: 'c2', number: '1035', status: 'incomplete', incomplete: true, name: null, phone: '01222333444', email: null, city: null, total: 31000, createdAt: hoursAgo(7), trust: null },
]

const events = new Map()
const confirms = new Map()

const whatsappText = (o) =>
  o.incomplete
    ? `مرحبًا${o.name ? ' ' + o.name : ''}، شفنا إنك كنت بتطلب من متجر الأناقة وما كمّلتش الطلب. تحب نساعدك؟`
    : `مرحبًا${o.name ? ' ' + o.name : ''}، بخصوص طلبك رقم ${o.number} من متجر الأناقة`

const find = (id) => orders.find((o) => o.id === id) ?? carts.find((o) => o.id === id)

export function list(filter = 'all') {
  const rows = filter === 'incomplete' ? carts : filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  return {
    currency: 'EGP',
    canCreate: true,
    filter,
    totalCount: orders.length,
    incompleteCount: carts.length,
    tabs: [
      { key: 'all', label: 'الكل', n: orders.length },
      ...TABS.map((k) => ({ key: k, label: LABELS[k], n: orders.filter((o) => o.status === k).length })),
    ],
    orders: rows.map((o) => ({ ...o, statusLabel: LABELS[o.status], whatsappText: whatsappText(o) })),
  }
}

export function detail(id) {
  const o = find(id)
  if (!o) return null
  const shipping = 5000
  const subtotal = o.total - shipping
  if (!events.has(id)) {
    events.set(
      id,
      o.incomplete
        ? [
            { id: `${id}-e1`, type: 'stage', message: 'العميل فتح صفحة إتمام الطلب ومعاه منتجات في السلة', createdAt: hoursAgo(2.2) },
            { id: `${id}-e2`, type: 'stage', message: 'كتب اسمه ورقم تليفونه', createdAt: hoursAgo(2.1) },
          ]
        : [
            { id: `${id}-e1`, type: 'created', message: 'اتعمل الطلب من المتجر', createdAt: o.createdAt },
            { id: `${id}-e2`, type: 'message_sent', message: 'بعتنا تأكيد الطلب للعميل على واتساب', createdAt: o.createdAt },
          ],
    )
  }
  const confirm = confirms.get(id) ?? { hasPhone: Boolean(o.phone), reply: o.status === 'confirmed' ? 'yes' : null, sentAt: null, repliedAt: null }
  const next = o.incomplete ? null : NEXT[o.status] ?? null
  return {
    currency: 'EGP',
    order: {
      id: o.id,
      number: o.number,
      status: o.status,
      statusLabel: LABELS[o.status],
      incomplete: o.incomplete,
      createdAt: o.createdAt,
      name: o.name,
      phone: o.phone,
      email: o.email,
      address: o.city ? `${o.city} — مدينة نصر — شارع مصطفى النحاس، عمارة ١٢` : null,
      notes: o.id === 'o1' ? 'يفضّل التوصيل بعد الساعة ٥' : null,
      subtotal,
      shippingTotal: shipping,
      codFee: 0,
      total: o.total,
      costTotal: Math.round(subtotal * 0.55),
      profit: o.total - Math.round(subtotal * 0.55) - shipping,
      paymentStatus: 'pending',
      stage: o.incomplete ? { label: 'كتب بياناته', detail: 'كتب اسمه ورقمه وما كتبش العنوان.' } : null,
      confirm,
    },
    items: [
      { id: `${id}-i1`, name: 'قميص قطن بياقة', image: null, options: [{ name: 'المقاس', value: 'XL' }, { name: 'اللون', value: 'كحلي' }], price: subtotal - 25000, quantity: 1, total: subtotal - 25000 },
      { id: `${id}-i2`, name: 'شراب قطن', image: null, options: [], price: 12500, quantity: 2, total: 25000 },
    ],
    events: events.get(id),
    trust: o.incomplete || !o.phone ? null : { level: o.trust?.level ?? 'new', label: o.trust ? { good: 'موثوق', watch: 'حاسب', risky: 'خطر — أكّد قبل الشحن' }[o.trust.level] : 'عميل جديد', score: o.trust ? { good: 92, watch: 61, risky: 23 }[o.trust.level] : null, reasons: o.trust?.level === 'risky' ? ['رفض استلام ٣ طلبات قبل كده', 'رقم جديد في متجرك'] : o.trust ? ['استلم ٥ طلبات قبل كده'] : [], networkStores: o.trust ? 4 : 0 },
    courier: o.status === 'shipped' ? { name: 'حسام المندوب', phone: '01099988877' } : null,
    next: next ? { key: next, label: LABELS[next] } : null,
    statuses: Object.keys(LABELS).filter((k) => k !== 'incomplete').map((k) => ({ key: k, label: LABELS[k] })),
    whatsappText: whatsappText(o),
  }
}

export function act(id, action, body) {
  const o = find(id)
  if (!o) return { status: 404, json: { ok: false, error: 'not_found' } }
  const log = events.get(id) ?? detail(id).events
  if (action === 'status') {
    if (!LABELS[body?.status] || body.status === 'incomplete') return { status: 400, json: { ok: false, error: 'حالة غير معروفة' } }
    o.status = body.status
    log.push({ id: `${id}-s${log.length}`, type: 'status', message: `الحالة اتغيّرت لـ«${LABELS[body.status]}» (الإشعار: ${body.channel ?? 'auto'})`, createdAt: new Date().toISOString() })
  } else if (action === 'note') {
    if (!String(body?.note ?? '').trim()) return { status: 400, json: { ok: false, error: 'اكتب الملاحظة الأول' } }
    log.push({ id: `${id}-n${log.length}`, type: 'note', message: String(body.note).trim(), createdAt: new Date().toISOString() })
  } else if (action === 'confirm') {
    confirms.set(id, { hasPhone: true, reply: null, sentAt: new Date().toISOString(), repliedAt: null })
  }
  events.set(id, log)
  return { status: 200, json: { ok: true, detail: detail(id) } }
}
