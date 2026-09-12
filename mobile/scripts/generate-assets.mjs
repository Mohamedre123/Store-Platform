/**
 * توليد الأيقونات وشاشات البداية لأندرويد وiOS من الشعار الأصلي.
 *
 * المصدر `resources/source/logo.png` (1254×1254 على خلفية بيضا) — أعلى
 * دقة متاحة للعلامة. النسخ اللي في `public/brand` صغيرة (148 بكسل)
 * وبتبان مغبّشة على شاشات ٣x.
 *
 * بيستخدم sharp المتسطّب في مشروع الويب (المجلد الأب) — مش محتاج تسطيب
 * تاني. شغّله بعد أي تغيير في الشعار: `npm run assets`
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(path.join(root, '..', 'package.json'))
const sharp = require('sharp')

const SOURCE = path.join(root, 'resources', 'source', 'logo.png')
const PUBLIC_BRAND = path.join(root, '..', 'public', 'brand')
const out = (...p) => {
  const file = path.join(root, ...p)
  mkdirSync(path.dirname(file), { recursive: true })
  return file
}

const LIGHT_BG = '#f3f1f9'
const DARK_BG = '#171633'

/* ─────────────── استخراج العلامة بخلفية شفافة ─────────────── */

/**
 * «لون ← شفافية» للأبيض.
 *
 * الشفافية من بُعد البكسل عن الأبيض، مضروبة في معامل عشان ألوان العلامة
 * نفسها (البنفسجي والكحلي) تفضل صلبة ١٠٠٪ — والحواف الناعمة بس اللي
 * تبقى شبه شفافة. الظل الرمادي الفاتح تحت الشنطة بيتشال بالعتبة.
 */
async function extractMark() {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const rgba = Buffer.alloc(width * height * 4)
  let minX = width, minY = height, maxX = 0, maxY = 0
  /* العلامة فوق الكلام — بنقصّ قبل «zawya | زاوية» */
  const markBottom = Math.round(height * 0.6)

  /*
    الشعار الأصلي فيه ظل «أرضية» رمادي تحت الشنطة وجنب اللوح اليمين.
    على خلفية غامقة الظل ده بيبان بقعة بيضا، فبنشيله: المسموح بيه بس
    البكسلات اللي في حدود ٣ بكسل من جسم العلامة الصلب (الحواف الناعمة)،
    والظل أبعد من كده فبيختفي.
  */
  const solid = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) {
    if (Math.min(data[p * 3], data[p * 3 + 1], data[p * 3 + 2]) < 150) solid[p] = 1
  }
  const near = new Uint8Array(width * height)
  const R = 3
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid[y * width + x]) continue
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < width) near[yy * width + xx] = 1
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const o = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      let a = ((255 - Math.min(r, g, b)) / 255) * 2.3
      if (a < 0.3 || y > markBottom || !near[y * width + x]) a = 0
      a = Math.min(1, a)
      if (a > 0) {
        const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a)))
        rgba[o] = un(r); rgba[o + 1] = un(g); rgba[o + 2] = un(b); rgba[o + 3] = Math.round(a * 255)
        if (a > 0.6) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  }

  const pad = 4
  const crop = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(height, maxY + pad) - Math.max(0, minY - pad),
  }
  const color = await sharp(rgba, { raw: { width, height, channels: 4 } }).extract(crop).png().toBuffer()

  /* النسخة البيضا: نفس الشفافية، واللون أبيض */
  const white = Buffer.from(rgba)
  for (let o = 0; o < white.length; o += 4) {
    if (white[o + 3] > 0) white[o] = white[o + 1] = white[o + 2] = 255
  }
  const whiteMark = await sharp(white, { raw: { width, height, channels: 4 } }).extract(crop).png().toBuffer()
  return { color, white: whiteMark, ratio: crop.width / crop.height }
}

/** العلامة في منتصف مربع بخلفية، بارتفاع نسبة من الضلع */
async function composeSquare(size, mark, ratio, { background, markHeight }) {
  const h = Math.round(size * markHeight)
  const w = Math.round(h * ratio)
  const resized = await sharp(mark).resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  const base = background
    ? sharp({ create: { width: size, height: size, channels: 4, background } })
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  return base
    .composite([{ input: resized, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toBuffer()
}

/** خلفية الأيقونة: أبيض لبنفسجي خفيف جدًا بزاوية — نفس روح خلفية الشعار */
function iconBackground(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece8f5"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`
  return Buffer.from(svg)
}

async function icon(size, mark, ratio, markHeight) {
  const h = Math.round(size * markHeight)
  const w = Math.round(h * ratio)
  const resized = await sharp(mark).resize(w, h).toBuffer()
  return sharp(iconBackground(size))
    .composite([{ input: resized, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer()
}

async function splash(width, height, mark, ratio, background) {
  const markH = Math.round(Math.min(width, height) * 0.22)
  const markW = Math.round(markH * ratio)
  const resized = await sharp(mark).resize(markW, markH).toBuffer()
  return sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: resized, left: Math.round((width - markW) / 2), top: Math.round((height - markH) / 2) }])
    .png()
    .toBuffer()
}

/* ─────────────── التشغيل ─────────────── */

const { color, white, ratio } = await extractMark()

/* طبقة التطبيق (شاشة الافتتاح) — ٣x لعرض ١٠٤ بكسل */
/* WebP لأن الصور دي بتتضمّن جوّه السكربت اللي بيتحقن في كل صفحة — كل كيلوبايت بيتقري كل مرة */
const layerImage = (input, file) =>
  sharp(input).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(out('resources', 'layer', file))
await layerImage(await sharp(color).resize({ height: 330 }).toBuffer(), 'mark.webp')
await layerImage(await sharp(white).resize({ height: 330 }).toBuffer(), 'mark-white.webp')
await layerImage(path.join(PUBLIC_BRAND, 'zawya-typo.png'), 'typo.webp')
await layerImage(path.join(PUBLIC_BRAND, 'zawya-typo-white.png'), 'typo-white.webp')
for (const old of ['mark.png', 'mark-white.png', 'typo.png', 'typo-white.png']) {
  const p = path.join(root, 'resources', 'layer', old)
  if (existsSync(p)) rmSync(p)
}

/* ── أندرويد ── */
const RES = ['android', 'app', 'src', 'main', 'res']
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const [d, scale] of Object.entries(densities)) {
  const legacy = Math.round(48 * scale)
  const adaptive = Math.round(108 * scale)
  writeFileSync(out(...RES, `mipmap-${d}`, 'ic_launcher.png'), await icon(legacy, color, ratio, 0.58))
  const round = await sharp(await icon(legacy, color, ratio, 0.52))
    .composite([{ input: Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`), blend: 'dest-in' }])
    .png()
    .toBuffer()
  writeFileSync(out(...RES, `mipmap-${d}`, 'ic_launcher_round.png'), round)
  /* المنطقة الآمنة في الأيقونة التكيّفية دايرة ٦٦dp من ١٠٨ — العلامة جوّاها بالكامل */
  writeFileSync(out(...RES, `mipmap-${d}`, 'ic_launcher_foreground.png'), await composeSquare(adaptive, color, ratio, { markHeight: 0.42 }))
}

writeFileSync(
  out(...RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background_gradient"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`,
)
writeFileSync(
  out(...RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background_gradient"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`,
)
writeFileSync(
  out(...RES, 'drawable', 'ic_launcher_background_gradient.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:angle="315" android:startColor="#FFFFFF" android:endColor="#ECE8F5" android:type="linear"/>
</shape>
`,
)
/* ملف القالب القديم كان بيعرّف نفس الاسم كلون — بنشيله عشان مايتعارضش */
const oldBg = path.join(root, ...RES, 'values', 'ic_launcher_background.xml')
if (existsSync(oldBg)) rmSync(oldBg)
const oldForegroundXml = path.join(root, ...RES, 'drawable-v24', 'ic_launcher_foreground.xml')
if (existsSync(oldForegroundXml)) rmSync(oldForegroundXml)
const oldBackgroundXml = path.join(root, ...RES, 'drawable', 'ic_launcher_background.xml')
if (existsSync(oldBackgroundXml)) rmSync(oldBackgroundXml)

/* أيقونة شاشة البداية (Android 12+) — ٢٤٠dp، والعلامة جوّه دايرة ١٦٠dp */
writeFileSync(out(...RES, 'drawable-nodpi', 'splash_icon.png'), await composeSquare(960, color, ratio, { markHeight: 0.36 }))
writeFileSync(out(...RES, 'drawable-night-nodpi', 'splash_icon.png'), await composeSquare(960, white, ratio, { markHeight: 0.36 }))

/* شاشات البداية القديمة (قبل Android 12). ترتيب المؤهلات إلزامي: الاتجاه قبل night */
const portrait = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }
for (const [d, [w, h]] of Object.entries(portrait)) {
  writeFileSync(out(...RES, `drawable-port-${d}`, 'splash.png'), await splash(w, h, color, ratio, LIGHT_BG))
  writeFileSync(out(...RES, `drawable-land-${d}`, 'splash.png'), await splash(h, w, color, ratio, LIGHT_BG))
  writeFileSync(out(...RES, `drawable-port-night-${d}`, 'splash.png'), await splash(w, h, white, ratio, DARK_BG))
  writeFileSync(out(...RES, `drawable-land-night-${d}`, 'splash.png'), await splash(h, w, white, ratio, DARK_BG))
}
writeFileSync(out(...RES, 'drawable', 'splash.png'), await splash(480, 320, color, ratio, LIGHT_BG))
writeFileSync(out(...RES, 'drawable-night', 'splash.png'), await splash(480, 320, white, ratio, DARK_BG))

/* ── iOS ── */
const XC = ['ios', 'App', 'App', 'Assets.xcassets']
writeFileSync(out(...XC, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), await icon(1024, color, ratio, 0.56))

const splashSet = out(...XC, 'Splash.imageset', 'Contents.json')
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  const p = path.join(path.dirname(splashSet), f)
  if (existsSync(p)) rmSync(p)
}
/*
  مربع ٢٧٣٢ والعلامة في النص، ومعروض بـaspectFill: على أي مقاس شاشة
  الأطراف بس اللي بتتقص والعلامة بتفضل في المنتصف وبنفس الحجم تقريبًا.
*/
const iosSplash = async (mark, bg) => {
  const size = 2732
  const markH = 300
  const markW = Math.round(markH * ratio)
  const resized = await sharp(mark).resize(markW, markH).toBuffer()
  return sharp({ create: { width: size, height: size, channels: 3, background: bg } })
    .composite([{ input: resized, left: Math.round((size - markW) / 2), top: Math.round((size - markH) / 2) }])
    .png()
    .toBuffer()
}
writeFileSync(path.join(path.dirname(splashSet), 'splash-light.png'), await iosSplash(color, LIGHT_BG))
writeFileSync(path.join(path.dirname(splashSet), 'splash-dark.png'), await iosSplash(white, DARK_BG))
writeFileSync(
  splashSet,
  JSON.stringify(
    {
      images: [
        { idiom: 'universal', filename: 'splash-light.png', scale: '1x' },
        { idiom: 'universal', filename: 'splash-dark.png', scale: '1x', appearances: [{ appearance: 'luminosity', value: 'dark' }] },
        { idiom: 'universal', scale: '2x' },
        { idiom: 'universal', scale: '3x' },
      ],
      info: { version: 1, author: 'xcode' },
    },
    null,
    2,
  ) + '\n',
)

/* ── صور المتاجر (جوجل بلاي) ── */
writeFileSync(out('store-assets', 'play-icon-512.png'), await icon(512, color, ratio, 0.56))
const featureW = 1024
const featureH = 500
const feature = await sharp({
  create: { width: featureW, height: featureH, channels: 3, background: DARK_BG },
})
  .composite([
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${featureW}" height="${featureH}"><defs><radialGradient id="g" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#2d2656"/><stop offset="1" stop-color="#0f0e24"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
      ),
    },
    { input: await sharp(white).resize({ height: 190 }).toBuffer(), gravity: 'center' },
  ])
  .png()
  .toBuffer()
writeFileSync(out('store-assets', 'play-feature-1024x500.png'), feature)

console.log('✓ icons, splash screens, layer assets and store assets generated')
