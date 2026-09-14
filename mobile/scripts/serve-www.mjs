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

  /* تعديل المنتج والحظر والمندوبين والحجوزات (dev/mock-ops.mjs) */
  if (/^\/api\/app\/(blocked|couriers|bookings|expenses|suppliers|categories|trash|loyalty|affiliates|referrals|media|blog|banners|automations|payments|shipping)(\/|$)/.test(url.pathname) || /^\/api\/app\/products\/[^/]+\/edit$/.test(url.pathname)) {
    const mock = await import(new URL('../dev/mock-ops.mjs', import.meta.url))
    await new Promise((r) => setTimeout(r, 450))
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    let raw = ''
    if (req.method === 'POST') for await (const chunk of req) raw += chunk
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[2] === 'products') {
      const api = await import(new URL('../dev/mock-api.mjs', import.meta.url))
      const d = api.productDetail(parts[3])
      if (!d) return send(404, { error: 'not_found' })
      return send(200, req.method === 'POST' ? { ok: true, detail: d } : mock.productEdit(d))
    }
    if (req.method === 'POST') {
      const body = raw ? JSON.parse(raw) : {}
      if (url.pathname.endsWith('/blocked/add') && !String(body.value ?? '').trim()) return send(400, { ok: false, error: 'اكتب القيمة' })
      return send(200, { ok: true, count: 3 })
    }
    return send(200, mock[parts[2]]())
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
