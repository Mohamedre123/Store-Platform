/**
 * «كروم» التطبيق: شريط الحالة فوق، وشريط التنقّل (أو شريط الآيفون) تحت.
 *
 * ## المحتوى بين الشريطين لا وراهم
 * المنصة بتطلب `viewport-fit=cover` — مناسب للمتصفح، لكن جوّه التطبيق
 * معناه إن كل صفحة مش حاسبة حساب الشريط العلوي (تسجيل الدخول، المتجر،
 * صفحات كتير) بتترسم تحت الساعة والبطارية. بدل ما نصلّح كل صفحة، بنشيل
 * `cover` هنا: الصفحة بتترسم في المساحة الآمنة، و`env(safe-area-inset-*)`
 * بيبقى صفر فمفيش مسافة متكررة في اللوحة اللي كانت حاسباها.
 *
 * ## والشريطين بياخدوا لون الصفحة
 * بنقرا لون أول بكسل فوق وآخر بكسل تحت ونبعتهم للطبقة الأصلية — فشريط
 * الحالة في اللوحة أبيض زي الهيدر، وفي صفحة الدخول بنفسجي غامق زيها،
 * وأيقونات الساعة والبطارية بتتقلب فاتح/غامق حسب اللون.
 */
import { native } from './bridge'
import { IS_ANDROID, isDarkTheme, onDomReady } from './env'

/* ─────────────── الـviewport ─────────────── */

const DROP = /^(viewport-fit|maximum-scale|user-scalable)\s*=/i

function fixViewport(node: Element): void {
  if (node.nodeName !== 'META' || node.getAttribute('name') !== 'viewport') return
  const before = node.getAttribute('content') ?? ''
  const parts = before
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !DROP.test(p))
  /* التطبيقات الأصلية ما بتتكبّرش بإصبعين، وده بيمنع iOS كمان من التكبير عند الكتابة */
  parts.push('maximum-scale=1', 'user-scalable=no')
  const after = parts.join(', ')
  if (after !== before) node.setAttribute('content', after)
}

export function installViewportFix(): void {
  const scan = (root: ParentNode) => root.querySelectorAll('meta[name="viewport"]').forEach(fixViewport)

  /*
    بنراقب الـhead لأن Next بيحدّث الـmeta مع التنقّل بين الصفحات —
    تعديل مرة واحدة كان هيتلغي أول ما التاجر يفتح صفحة تانية.
  */
  const headObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') fixViewport(record.target as Element)
      else
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return
          fixViewport(node as Element)
          scan(node as Element)
        })
    }
  })

  const watchHead = (head: HTMLHeadElement) => {
    scan(head)
    headObserver.observe(head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content', 'name'] })
  }

  if (document.head) {
    watchHead(document.head)
    return
  }
  /* السكربت بيشتغل قبل ما الـhead يتقري — نستناه */
  const rootObserver = new MutationObserver(() => {
    if (!document.head) return
    rootObserver.disconnect()
    watchHead(document.head)
  })
  rootObserver.observe(document.documentElement, { childList: true })
}

/* ─────────────── ألوان الشريطين ─────────────── */

type RGBA = [number, number, number, number]

function parseColor(value: string): RGBA | null {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i)
  if (!m) return null
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return [Number(m[1]), Number(m[2]), Number(m[3]), alpha]
}

const toHex = ([r, g, b]: RGBA) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

function isDarkColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum < 0.55
}

function colorAt(x: number, y: number): string | null {
  let node: Element | null = document.elementFromPoint(x, y)
  while (node && node !== document.documentElement) {
    /* طبقتنا نفسها بتتحسب من `override` */
    if (node.nodeName === 'ZAWYA-APP-LAYER') break
    const color = parseColor(getComputedStyle(node).backgroundColor)
    if (color && color[3] > 0.5) return toHex(color)
    node = node.parentElement
  }
  const body = document.body ? parseColor(getComputedStyle(document.body).backgroundColor) : null
  return body && body[3] > 0.5 ? toHex(body) : null
}

let override: string | null = null
let lastKey = ''
let scheduled = false

/** لون ثابت للشريطين وقت ما شاشة من شاشاتنا (الافتتاح، التعريف) مغطّية الصفحة */
export function setChromeOverride(color: string | null): void {
  override = color
  requestChromeSync()
}

export function requestChromeSync(delay = 0): void {
  if (delay > 0) {
    window.setTimeout(() => requestChromeSync(), delay)
    return
  }
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    sync()
  })
}

function sync(): void {
  const fallback = isDarkTheme() ? '#14162a' : '#f6f6f9'
  const ready = document.body !== null
  const top = override ?? (ready ? colorAt(window.innerWidth / 2, 1) : null) ?? fallback
  const bottom = override ?? (ready ? colorAt(window.innerWidth / 2, window.innerHeight - 1) : null) ?? fallback

  const key = `${top}|${bottom}`
  if (key === lastKey) return
  lastKey = key

  void native('ZawyaShell', 'setChrome', { top, bottom })
  /* ‏DARK = أيقونات فاتحة على خلفية غامقة */
  if (IS_ANDROID) {
    void native('SystemBars', 'setStyle', { bar: 'StatusBar', style: isDarkColor(top) ? 'DARK' : 'LIGHT' })
    void native('SystemBars', 'setStyle', { bar: 'NavigationBar', style: isDarkColor(bottom) ? 'DARK' : 'LIGHT' })
  } else {
    void native('SystemBars', 'setStyle', { style: isDarkColor(top) ? 'DARK' : 'LIGHT' })
  }
}

export function installSystemBars(): void {
  requestChromeSync()
  onDomReady(() => {
    requestChromeSync()
    requestChromeSync(400)
  })
  window.addEventListener('load', () => requestChromeSync(), { once: true })
  window.addEventListener('resize', () => requestChromeSync())

  /* تغيير الثيم من إعدادات المنصة أو من الجهاز */
  new MutationObserver(() => requestChromeSync()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style'],
  })
  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', () => requestChromeSync())
  }

  /* القوايم والشاشات الكاملة (المزيد، البحث) بتفتح بضغطة وبتغيّر لون أعلى الشاشة */
  document.addEventListener(
    'click',
    () => {
      requestChromeSync(120)
      requestChromeSync(450)
    },
    { capture: true, passive: true },
  )
}

export { isDarkColor }
