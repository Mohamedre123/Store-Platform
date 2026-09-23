/**
 * خادم محلي صغير لمجلد www — للتطوير بس.
 *
 * بيخلّي طبقة التطبيق تتجرّب على الموقع الحي من متصفح الكمبيوتر: افتح
 * الموقع بعرض موبايل، وفي الـConsole:
 *
 *   const s = document.createElement('script')
 *   s.src = 'http://localhost:4455/zawya-app.js'
 *   document.head.appendChild(s)
 *
 * (كروم الحديث بيمنع ده من صفحة عامة — الأضمن التجربة على المحاكي.)
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const mobile = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const root = path.join(mobile, 'www')
const devRoot = path.join(mobile, 'dev')
/* صفحة التجربة بتترد على مسارات المنصة عشان الطبقة تتصرف زي ما هي على الموقع */
const harnessRoutes = /^\/(login|signup|dashboard|verify)(\/|$)/
const port = Number(process.env.PORT) || 4455
const types = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.png': 'image/png' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)

  /* قايمة «المزيد»: المستخدم وصلاحياته، وتسجيل الخروج */
  if (url.pathname === '/api/app/me' || url.pathname === '/api/app/logout') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(
      JSON.stringify(
        url.pathname === '/api/app/logout'
          ? { ok: true }
          : {
              user: { name: 'محمد أحمد', email: 'owner@mail.com', isPlatformAdmin: false },
              store: { name: 'متجر الأناقة', slug: 'elanaka', logo: null, url: 'https://www.zawyaeg.site/s/demo' },
              role: url.searchParams.get('role') ?? 'owner',
              permissions: [],
            },
      ),
    )
    return
  }

  /* رفع صورة (منتج جديد) — بيستهلك الملف ويرجّع رابط وهمي */
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    for await (const _ of req) void _
    await new Promise((r) => setTimeout(r, 800))
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ url: `https://example.com/products/${Date.now()}.jpg`, path: 'products/x.jpg' }))
    return
  }

  /* الحملات والقنوات والفروع والاستيراد وحسابي (dev/mock-growth.mjs) */
  if (/^\/api\/app\/(campaigns|channels|branches|product-import|account)(\/|$)/.test(url.pathname) && !/^\/api\/app\/account\/(change-email|abandon)/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-growth.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 350))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (req.method === 'POST') {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const body = raw ? JSON.parse(raw) : {}
      if (parts[2] === 'campaigns') return send(...(parts[3] === 'save' ? mock.campaignSave(body) : mock.campaignAction(parts[3], parts[4])))
      if (parts[2] === 'branches') return send(...mock.branchAction(parts, body))
      if (parts[2] === 'product-import') {
        if (parts[3] === 'preview') return send(...mock.importPreview(body))
        if (parts[3] === 'csv') return send(200, { ok: true, created: (body.rows ?? []).length, skipped: 0, categories: 1 })
        return send(200, { ok: true, created: 25, skipped: 2, categories: 3, fetched: 27 })
      }
      if (parts[2] === 'account') return send(...mock.accountAction(parts[3], body))
      return send(404, { ok: false, error: 'not_found' })
    }
    const name = { campaigns: 'campaigns', channels: 'channels', branches: 'branches', 'product-import': 'productImport', account: 'accountInfo' }[parts[2]]
    return send(200, mock[name]())
  }

  /* العرض المباشر والتقارير المفصّلة وجودة الإشارة (dev/mock-reports.mjs) */
  if (/^\/api\/app\/(live|reports|signal)$/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-reports.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 350))
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(mock[url.pathname.split('/').pop()]()))
    return
  }

  /* إعدادات الطلبات والشيك أوت وواتساب والبريد (dev/mock-settings.mjs) */
  if (/^\/api\/app\/(order-settings|checkout-settings|whatsapp|email|receipt|seo|store-pages|domain|improve)(\/|$)/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-settings.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 450))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (req.method === 'POST') {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const body = raw ? JSON.parse(raw) : {}
      if (parts[2] === 'whatsapp') return send(...mock.whatsappAction(parts[3], body))
      if (parts[2] === 'store-pages') return send(...mock.savePage(parts[3], body))
      if (parts[2] === 'domain') return send(...mock.domainAction(parts[3], body))
      if (parts[2] === 'improve') return send(200, { ok: true, suggestions: ['نص محسّن أول للصفحة — واضح وقصير.', 'نص محسّن تاني بأسلوب ودود.', 'نص محسّن تالت أكثر رسمية.'] })
      if (parts[2] === 'email') return String(body.to ?? '').includes('@') ? send(200, { ok: true, message: 'اتبعتت. شوف الوارد والسبام — ولو لقيتها في السبام دوس «ليست غير مرغوب فيها».', from: 'x' }) : send(400, { ok: false, error: 'اكتب بريدًا صحيحًا' })
      if (parts[2] === 'checkout-settings' && (body.fieldName === 'hidden' || body.fieldPhone === 'hidden')) return send(400, { ok: false, error: 'الاسم والرقم ما ينفعش يتخفوا — من غيرهم الطلب مالوش صاحب.' })
      if (parts[2] === 'order-settings' && body.nextOrderNumber < 1043) return send(400, { ok: false, error: 'الرقم الجاي لازم يكون 1043 أو أكبر — الأقل بيتصادم مع طلب موجود.' })
      return send(200, { ok: true })
    }
    if (parts[2] === 'checkout-settings' && parts[3] === 'products') return send(200, mock.checkoutProducts(url.searchParams.get('q') ?? ''))
    const name = { 'order-settings': 'orderSettings', 'checkout-settings': 'checkoutSettings', whatsapp: 'whatsapp', email: 'email', receipt: 'receipt', seo: 'seo', 'store-pages': 'storePages', domain: 'domain' }[parts[2]]
    return send(200, mock[name]())
  }

  /* تعديل المنتج والحظر والمندوبين والحجوزات (dev/mock-ops.mjs) */
  if (/^\/api\/app\/(blocked|couriers|bookings|expenses|suppliers|categories|trash|loyalty|affiliates|referrals|media|blog|banners|automations|payments|shipping|posts|schedules|social-accounts|team|sessions|activity|manual-order)(\/|$)/.test(url.pathname) || /^\/api\/app\/products\/[^/]+\/edit$/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-ops.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 450))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    let raw = ''
    if (req.method === 'POST') for await (const chunk of req) raw += chunk
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[2] === 'manual-order') {
      const body = raw ? JSON.parse(raw) : {}
      const q = url.searchParams.get('q') ?? ''
      if (parts[3] === 'products') return send(200, mock.manualProducts(q))
      if (parts[3] === 'customers') return send(200, mock.manualCustomers(q))
      if (parts[3] === 'quote') return send(200, mock.manualQuote(body))
      if (parts[3] === 'create') return body.lines?.length ? send(200, { ok: true, orderId: 'o-1043', orderNumber: 1043 }) : send(400, { ok: false, error: 'ضيف منتج واحد على الأقل' })
      return send(200, mock.manualOrder())
    }
    if (parts[2] === 'products') {
      const api = await import(new URL('../dev/mock-api.mjs', import.meta.url))
      const d = api.productDetail(parts[3])
      if (!d) return send(404, { error: 'not_found' })
      return send(200, req.method === 'POST' ? { ok: true, detail: d } : mock.productEdit(d))
    }
    if (req.method === 'POST') {
      const body = raw ? JSON.parse(raw) : {}
      if (/\/team\/(invite|invites\/[^/]+\/resend)$/.test(url.pathname)) return send(200, { ok: true, inviteUrl: `https://www.zawyaeg.site/join?t=demo${Date.now()}`, emailed: true })
      if (url.pathname.endsWith('/blocked/add') && !String(body.value ?? '').trim()) return send(400, { ok: false, error: 'اكتب القيمة' })
      return send(200, { ok: true, count: 3 })
    }
    if (parts[2] === 'schedules' && parts[3] === 'models') return send(200, mock.scheduleModels())
    return send(200, mock[parts[2] === 'social-accounts' ? 'socialAccounts' : parts[2]]())
  }

  /* منتج جديد والمراجعات والمرتجعات والشكاوى (dev/mock-care.mjs) */
  if (/^\/api\/app\/(products\/form|products\/new|reviews|returns|complaints)(\/|$)/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-care.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 450))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'POST') {
      for await (const _ of req) void _
      return send(200, { ok: true })
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (url.pathname === '/api/app/products/form') return send(200, mock.productForm())
    if (parts[2] === 'reviews') return send(200, mock.reviews())
    if (parts[2] === 'returns') return send(200, mock.returns())
    if (parts[2] === 'complaints') return send(200, parts.length === 4 ? mock.thread(parts[3]) : mock.complaints())
    return send(404, { error: 'not_found' })
  }

  /* الكوبونات والمخزون والرسايل والاشتراك (dev/mock-business.mjs) */
  if (/^\/api\/app\/(marketing|inventory|messages|subscription)(\/|$)/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-business.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 450))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'POST') {
      if (url.pathname === '/api/app/subscription/trial') mock.startTrial()
      return send(200, { ok: true, stock: 0 })
    }
    const name = url.pathname.split('/')[3]
    return send(200, mock[name]())
  }

  /* أفعال الشحنات: تسجيل، إرسال للشركة، الحالة، التحصيل */
  if (url.pathname.startsWith('/api/app/shipments/') && req.method === 'POST') {
    let raw = ''
    for await (const chunk of req) raw += chunk
    await new Promise((r) => setTimeout(r, 500))
    const body = raw ? JSON.parse(raw) : {}
    const bad = url.pathname.endsWith('/create') && !body.carrier
    res.writeHead(bad ? 400 : 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(bad ? { ok: false, error: 'اختار شركة الشحن' } : { ok: true }))
    return
  }

  /* التحليلات والشحنات (dev/mock-extra.mjs) */
  if (url.pathname === '/api/app/analytics' || url.pathname === '/api/app/shipments') {
    const mock = await import(new URL('../dev/mock-extra.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 500))
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(url.pathname.endsWith('/analytics') ? mock.analytics() : mock.shipments()))
    return
  }

  /* صفحة تأكيد البريد: تغيير البريد وإلغاء التسجيل */
  if (url.pathname.startsWith('/api/app/account/')) {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = raw ? JSON.parse(raw) : {}
    await new Promise((r) => setTimeout(r, 600))
    const taken = url.pathname.endsWith('/change-email') && String(body.email ?? '').startsWith('taken')
    res.writeHead(taken ? 409 : 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(
      JSON.stringify(
        taken
          ? { ok: false, error: 'taken', message: 'البريد ده مسجّل بحساب تاني — سجّل دخول بيه بدل التسجيل الجديد.' }
          : url.pathname.endsWith('/abandon')
            ? { ok: true, deleted: true }
            : { ok: true, sent: true },
      ),
    )
    return
  }

  /* بيانات وهمية للعملاء (dev/mock-api.mjs) */
  if (url.pathname.startsWith('/api/app/customers')) {
    const mock = await import(new URL('../dev/mock-api.mjs', import.meta.url))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const parts = url.pathname.split('/').filter(Boolean)
    await new Promise((r) => setTimeout(r, 450))
    if (parts.length === 3) return send(200, mock.customersList(url.searchParams.get('filter') ?? 'all'))
    if (parts.length === 4) {
      const d = mock.customerDetail(parts[3])
      return d ? send(200, d) : send(404, { error: 'not_found' })
    }
    return send(404, { error: 'not_found' })
  }

  /* بيانات وهمية للمنتجات (dev/mock-api.mjs) */
  if (url.pathname.startsWith('/api/app/products')) {
    const mock = await import(new URL('../dev/mock-api.mjs', import.meta.url))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const parts = url.pathname.split('/').filter(Boolean)
    await new Promise((r) => setTimeout(r, 450))
    if (parts.length === 3) return send(200, mock.productsList())
    if (parts.length === 4) {
      const d = mock.productDetail(parts[3])
      return d ? send(200, d) : send(404, { error: 'not_found' })
    }
    if (parts.length === 5 && req.method === 'POST') {
      const out = mock.productAct(parts[3], parts[4])
      return send(out.status, out.json)
    }
    return send(404, { error: 'not_found' })
  }

  /* بيانات وهمية للطلبات — القايمة والتفاصيل والأفعال (dev/mock-api.mjs) */
  if (url.pathname.startsWith('/api/app/orders')) {
    const mock = await import(new URL('../dev/mock-api.mjs', import.meta.url))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const parts = url.pathname.split('/').filter(Boolean)
    await new Promise((r) => setTimeout(r, 450))
    if (parts.length === 3) return send(200, mock.list(url.searchParams.get('filter') ?? 'all'))
    if (parts.length === 4 && req.method === 'GET') {
      const d = mock.detail(parts[3])
      return d ? send(200, d) : send(404, { error: 'not_found' })
    }
    if (parts.length === 5 && req.method === 'POST') {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const out = mock.act(parts[3], parts[4], raw ? JSON.parse(raw) : {})
      return send(out.status, out.json)
    }
    return send(404, { error: 'not_found' })
  }

  /* بيانات وهمية للرئيسية — نفس شكل /api/app/home بالظبط، بتأخير زي النت الحقيقي */
  if (url.pathname === '/api/app/home') {
    const body = await readFile(path.join(devRoot, 'home.json'))
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(body)
    }, 700)
    return
  }
  const file = harnessRoutes.test(url.pathname)
    ? path.join(devRoot, 'harness.html')
    : url.pathname.startsWith('/dev/')
      ? path.join(devRoot, path.normalize(url.pathname.slice(4)))
      : path.join(root, path.normalize(url.pathname === '/' ? '/offline.html' : url.pathname))
  if (!file.startsWith(root) && !file.startsWith(devRoot)) {
    res.writeHead(403).end()
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`www on http://localhost:${port}`))
