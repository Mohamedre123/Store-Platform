/* بيانات وهمية لشاشات الحملات والقنوات والفروع والاستيراد وحسابي — بتحفظ حالة عشان الأفعال تبان */

const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString()

const audiences = [
  { key: 'all', label: 'كل المشتركين', hint: 'كل اللي موافق يستقبل رسايلك', size: 120 },
  { key: 'buyers', label: 'اللي اشتروا قبل كده', hint: 'أعلى نسبة استجابة — بيعرفوك خلاص', size: 64 },
  { key: 'non_buyers', label: 'اللي ما اشتروش لسه', hint: 'سجّلوا بريدهم وما كمّلوش', size: 56 },
  { key: 'abandoned', label: 'اللي ساب سلته', hint: 'حطّ في السلة ومكمّلش الطلب', size: 0 },
]

const camp = [
  { id: 'c1a2b3c4-0000-4000-8000-000000000001', name: 'عروض الصيف', subject: 'خصم ٢٠٪ على الفساتين', body: 'أهلًا! عندنا خصم ٢٠٪ لحد الجمعة.', ctaLabel: 'اتسوّق', ctaUrl: 'https://zawya.zawyaeg.site', audience: 'all', status: 'draft', audienceCount: 0, sentCount: 0, failedCount: 0, createdAt: daysAgo(1) },
  { id: 'c1a2b3c4-0000-4000-8000-000000000002', name: 'شكر العملاء', subject: 'شكرًا إنك معانا', body: 'هدية صغيرة ليك.', ctaLabel: null, ctaUrl: null, audience: 'buyers', status: 'sending', audienceCount: 64, sentCount: 40, failedCount: 2, createdAt: daysAgo(3) },
]

export function campaigns() {
  return { subscribers: 120, withoutEmail: 12, rows: camp, audiences }
}

export function campaignSave(body) {
  if (!String(body.name ?? '').trim() || String(body.name).trim().length < 2) return [400, { ok: false, error: 'اكتب اسم الحملة' }]
  if (String(body.body ?? '').trim().length < 10) return [400, { ok: false, error: 'اكتب نص الرسالة' }]
  const row = camp.find((c) => c.id === body.id)
  if (row) Object.assign(row, body)
  else camp.unshift({ ...body, id: `c1a2b3c4-0000-4000-8000-${String(Date.now()).slice(-12)}`, status: 'draft', audienceCount: 0, sentCount: 0, failedCount: 0, createdAt: new Date().toISOString() })
  return [200, { ok: true, id: body.id ?? null }]
}

export function campaignAction(id, action) {
  const i = camp.findIndex((c) => c.id === id)
  if (i < 0) return [400, { ok: false, error: 'الحملة مش موجودة' }]
  if (action === 'delete') camp.splice(i, 1)
  if (action === 'start') {
    const size = audiences.find((a) => a.key === camp[i].audience)?.size ?? 0
    if (!size) return [400, { ok: false, error: 'مفيش حد في الجمهور ده. جرّب جمهورًا تاني أو استنى مشتركين جدد.' }]
    Object.assign(camp[i], { status: 'sending', audienceCount: size, sentCount: 0 })
  }
  return [200, { ok: true }]
}

export function channels() {
  const ch = [
    {
      key: 'meta', name: 'فيسبوك وإنستجرام', color: '#1877F2', why: 'أغلب عملائك جايين من هنا — من غير البكسل إعلانك بيصرف على الفاضي.',
      steps: [
        { label: 'بكسل ميتا', hint: 'بيقيس مبيعاتك من الإعلانات.', status: 'done', href: '/dashboard/plugins' },
        { label: 'توكن التحويلات', hint: 'عشان الشرا يوصل حتى لو البكسل اتمنع.', status: 'missing', href: '/dashboard/plugins' },
        { label: 'رابط صفحتك', hint: 'بيظهر في فوتر متجرك.', status: 'missing', href: '/dashboard/settings?web=1' },
      ],
    },
    {
      key: 'whatsapp', name: 'واتساب', color: '#25D366', why: 'العميل بيسأل قبل ما يشتري.',
      steps: [{ label: 'رقم واتساب المتجر', hint: 'زر واتساب في المتجر.', status: 'done', href: '/dashboard/settings?web=1' }],
    },
  ]
  const progress = (c) => ({ done: c.steps.filter((s) => s.status === 'done').length, total: c.steps.length })
  return { totals: { done: 2, total: 4 }, channels: ch.map((c) => ({ ...c, progress: progress(c) })) }
}

const br = [
  { id: 'b1000000-0000-4000-8000-000000000001', name: 'المخزن الرئيسي', city: 'القاهرة', address: 'مدينة نصر', phone: null, isDefault: true, isActive: true },
  { id: 'b1000000-0000-4000-8000-000000000002', name: 'فرع الجيزة', city: 'الجيزة', address: null, phone: '01000000000', isDefault: false, isActive: true },
]
const levels = { 'p1:b1000000-0000-4000-8000-000000000001': 8, 'p1:b1000000-0000-4000-8000-000000000002': 2 }
const prods = [
  { id: 'p1', name: 'فستان صيفي', total: 12 },
  { id: 'p2', name: 'شنطة جلد', total: 4 },
]

export function branches() {
  return {
    branches: br,
    products: prods.map((p) => ({ ...p, byBranch: Object.fromEntries(br.map((b) => [b.id, levels[`${p.id}:${b.id}`] ?? 0])) })),
  }
}

export function branchAction(parts, body) {
  if (parts[3] === 'save') {
    if (!String(body.name ?? '').trim()) return [400, { ok: false, error: 'اكتب اسم الفرع' }]
    if (body.isDefault) br.forEach((b) => (b.isDefault = false))
    const row = br.find((b) => b.id === body.id)
    if (row) Object.assign(row, body)
    else br.push({ ...body, id: `b1000000-0000-4000-8000-${String(Date.now()).slice(-12)}` })
    return [200, { ok: true }]
  }
  if (parts[3] === 'level') {
    levels[`${body.productId}:${body.locationId}`] = body.available
    return [200, { ok: true }]
  }
  if (parts[3] === 'transfer') {
    const from = `${body.productId}:${body.fromId}`
    if ((levels[from] ?? 0) < body.quantity) return [400, { ok: false, error: 'الكمية في الفرع ده أقل من اللي عايز تنقله' }]
    levels[from] -= body.quantity
    levels[`${body.productId}:${body.toId}`] = (levels[`${body.productId}:${body.toId}`] ?? 0) + body.quantity
    return [200, { ok: true }]
  }
  if (parts[4] === 'delete') {
    const i = br.findIndex((b) => b.id === parts[3])
    if (i < 0) return [400, { ok: false, error: 'الفرع مش موجود' }]
    if (br[i].isDefault) return [400, { ok: false, error: 'ما ينفعش تمسح الفرع الافتراضي. خلّي فرعًا تاني افتراضيًا الأول.' }]
    br.splice(i, 1)
    return [200, { ok: true }]
  }
  return [404, { ok: false, error: 'not_found' }]
}

export function productImport() {
  return {
    currency: 'EGP',
    sources: [
      {
        key: 'shopify', name: 'Shopify', intro: 'بنقرا منتجاتك المنشورة من Storefront API — للقراءة بس.',
        steps: ['من لوحة شوبيفاي: Settings ← Apps and sales channels ← Develop apps', 'انسخ الـStorefront API access token'],
        fields: [{ key: 'shop', label: 'Shop domain', placeholder: 'my-store.myshopify.com' }, { key: 'token', label: 'Storefront API access token', secret: true }],
      },
      { key: 'woocommerce', name: 'WooCommerce', intro: 'مفاتيح قراءة من ووكومرس.', steps: ['WooCommerce ← Settings ← Advanced ← REST API'], fields: [{ key: 'url', label: 'Store URL' }, { key: 'key', label: 'Consumer key' }, { key: 'secret', label: 'Consumer secret', secret: true }] },
    ],
  }
}

/* تحليل CSV مبسّط للتجربة — الموقع بيستخدم `product-csv.ts` */
export function importPreview(body) {
  const lines = String(body.text ?? '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return [400, { ok: false, error: 'الملف فاضي أو فيه سطر واحد بس. لازم يكون فيه ترويسة وصف واحد على الأقل.' }]
  const header = lines[0].split(',')
  const guess = (re) => header.findIndex((h) => re.test(h))
  const columns = {
    name: guess(/name|اسم/i), price: guess(/price|سعر/i), compareAtPrice: -1, costPrice: -1, sku: guess(/sku|كود/i),
    stock: guess(/stock|qty|كمية/i), category: guess(/categ|قسم/i), brand: -1, description: -1, image: guess(/image|صورة/i),
    ...(body.columns ?? {}),
  }
  const items = []
  const issues = []
  lines.slice(1).forEach((l, i) => {
    const c = l.split(',')
    const name = c[columns.name]?.trim()
    const price = Number(c[columns.price])
    if (!name) return issues.push({ line: i + 2, reason: 'الاسم فاضي' })
    if (!(price > 0)) return issues.push({ line: i + 2, reason: 'السعر مش رقم' })
    items.push({ name, price: Math.round(price * 100), stock: Number(c[columns.stock]) || 0, category: c[columns.category]?.trim() || null, image: c[columns.image]?.trim() || null })
  })
  return [200, { ok: true, header, columns, items, issues, issueCount: issues.length }]
}

const account = { name: 'محمد أحمد', email: 'owner@mail.com', phone: '01012345678', publicId: 'ZW-8K3P2', stores: [{ id: 's1', name: 'متجر زاوية', slug: 'zawya' }] }

export function accountInfo() {
  return account
}

export function accountAction(kind, body) {
  if (kind === 'profile') {
    if (String(body.name ?? '').trim().length < 2) return [400, { ok: false, error: 'اكتب اسمك' }]
    Object.assign(account, { name: body.name, phone: body.phone })
    return [200, { ok: true }]
  }
  if (kind === 'password') return body.current === 'old-pass-1' ? [200, { ok: true }] : [400, { ok: false, error: 'كلمة السر الحالية غلط' }]
  return [404, { ok: false, error: 'not_found' }]
}
