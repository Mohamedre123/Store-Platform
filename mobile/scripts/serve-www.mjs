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
const harnessRoutes = /^\/(login|signup|dashboard)(\/|$)/
const port = Number(process.env.PORT) || 4455
const types = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.png': 'image/png' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)

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
