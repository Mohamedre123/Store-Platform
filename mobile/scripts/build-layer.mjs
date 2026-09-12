/**
 * بناء طبقة التطبيق — ملف واحد بيتحقن في كل صفحة من المنصة جوّه التطبيق.
 *
 * الشعارات بتتضمّن جوّه الملف نفسه (data URI) عشان شاشة الافتتاح ترسم
 * في أول فريم من غير ما تستنى طلب شبكة — على نت ضعيف الصورة كانت
 * هتظهر بعد الشاشة ما تختفي.
 *
 * الناتج `www/zawya-app.js`، و`cap sync` بينسخه للمشروعين.
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

const image = (file) =>
  'data:image/webp;base64,' + readFileSync(path.join(root, 'resources', 'layer', file)).toString('base64')

const assets = {
  mark: image('mark.webp'),
  markWhite: image('mark-white.webp'),
  typo: image('typo.webp'),
  typoWhite: image('typo-white.webp'),
}

/* ‏--dev: نسخة بتقبل localhost لصفحة التجربة في dev/ — ما بتروحش للتطبيق */
const dev = process.argv.includes('--dev')
const outfile = dev ? path.join(root, 'dev', 'zawya-app.dev.js') : path.join(root, 'www', 'zawya-app.js')

const result = await build({
  entryPoints: [path.join(root, 'src', 'layer', 'index.ts')],
  outfile,
  bundle: true,
  /* الشاشات الأصلية بـPreact — نفس React في الكتابة وأخف بعشر مرات */
  jsx: 'automatic',
  jsxImportSource: 'preact',
  format: 'iife',
  /* أندرويد ٧ بـWebView قديم وiOS ١٥ — الصياغة الحديثة بتتحوّل لهم */
  target: ['chrome70', 'safari15'],
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  metafile: true,
  define: {
    __ZAWYA_VERSION__: JSON.stringify(pkg.version),
    __ZAWYA_DEV__: JSON.stringify(dev),
    __ZAWYA_ASSETS__: JSON.stringify(assets),
  },
})

const bytes = Object.values(result.metafile.outputs)[0].bytes
console.log(`✓ ${path.relative(root, outfile)} — ${(bytes / 1024).toFixed(1)} KB`)
