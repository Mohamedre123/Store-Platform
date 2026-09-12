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
