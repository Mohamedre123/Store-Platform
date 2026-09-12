/**
 * التنقّل: شريط التقدّم، حركة الصفحات، زرار الرجوع، والروابط العميقة.
 *
 * المنصة Next (App Router)، والتنقّل فيها بيحصل من غير تحميل صفحة —
 * بتغيّر المحتوى وبتنادي `history.pushState`. فبنسمع على النداء ده:
 * لحظة ما بيتنادى يكون المحتوى الجديد اترسم فعلًا، فنحرّكه.
 */
import { APP_HOSTS, HOME_PATH, IS_ANDROID, ROOT_PATHS, SITE_ORIGIN, prefersReducedMotion, session } from './env'
import { listen, native } from './bridge'
import { el, layer, toast } from './dom'

type RouteKind = 'push' | 'replace' | 'pop'

const routeListeners: Array<(kind: RouteKind) => void> = []
export function onRouteChange(listener: (kind: RouteKind) => void): void {
  routeListeners.push(listener)
}

/* ─────────────── شريط التقدّم ─────────────── */

let bar: HTMLElement | null = null
let fill: HTMLElement | null = null
let safety = 0

function ensureBar(): [HTMLElement, HTMLElement] {
  if (!bar || !fill) {
    bar = el('div', 'progress', '<span></span>')
    fill = bar.firstElementChild as HTMLElement
    layer().appendChild(bar)
  }
  return [bar, fill]
}

export function progressStart(): void {
  const [b, f] = ensureBar()
  window.clearTimeout(safety)
  b.classList.add('on')
  f.style.transition = 'none'
  f.style.width = '0%'
  void f.offsetWidth
  /* بيجري بسرعة في الأول ويبطّأ قرب الآخر — من غير ما يوصل ١٠٠٪ لوحده */
  f.style.transition = 'width 8s cubic-bezier(.08,.82,.17,1)'
  f.style.width = '86%'
  safety = window.setTimeout(progressDone, 12000)
}

export function progressDone(): void {
  if (!bar || !fill || !bar.classList.contains('on')) return
  const b = bar
  const f = fill
  window.clearTimeout(safety)
  f.style.transition = 'width .22s ease-out'
  f.style.width = '100%'
  setTimeout(() => b.classList.remove('on'), 230)
}

/* ─────────────── حركة الصفحات ─────────────── */

const ENTER_CLASSES = ['zw-enter', 'zw-enter-back', 'zw-enter-soft']

function animatePage(kind: 'forward' | 'back' | 'soft'): void {
  if (prefersReducedMotion()) return
  const main = document.querySelector('main')
  if (!main) return
  main.classList.remove(...ENTER_CLASSES)
  void (main as HTMLElement).offsetWidth
  const cls = kind === 'forward' ? 'zw-enter' : kind === 'back' ? 'zw-enter-back' : 'zw-enter-soft'
  main.classList.add(cls)
  /*
    الكلاس بيتشال بعد الحركة: الـtransform على عنصر بيخلّي أي عنصر
    `fixed` جوّاه يتحسب منه بدل الشاشة. طول ما الكلاس موجود، أزرار
    الحفظ الثابتة كانت هتتحرك مع الصفحة.
  */
  window.setTimeout(() => main.classList.remove(cls), 520)
}

let lastUrl = location.href

function handleUrlChange(kind: RouteKind): void {
  const next = location.href
  if (next === lastUrl) return
  const prev = new URL(lastUrl)
  const now = new URL(next)
  lastUrl = next

  progressDone()
  if (prev.pathname !== now.pathname) animatePage(kind === 'pop' ? 'back' : 'forward')
  else if (prev.search !== now.search) animatePage('soft')
  routeListeners.forEach((fn) => fn(kind))
}

function patchHistory(): void {
  const wrap = (method: 'pushState' | 'replaceState', kind: RouteKind) => {
    const original = history[method]
    history[method] = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      const result = original.call(this, data, unused, url)
      queueMicrotask(() => handleUrlChange(kind))
      return result
    }
  }
  wrap('pushState', 'push')
  wrap('replaceState', 'replace')
  window.addEventListener('popstate', () => handleUrlChange('pop'))
}

function watchLinkClicks(): void {
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.hasAttribute('download')) return
      let url: URL
      try {
        url = new URL(anchor.href)
      } catch {
        return
      }
      if (!APP_HOSTS.has(url.hostname)) return
      if (url.pathname.startsWith('/s/') || url.pathname.startsWith('/api/')) return
      if (url.pathname === location.pathname && url.search === location.search) return
      progressStart()
    },
    true,
  )
}

/* ─────────────── زرار الرجوع (أندرويد) ─────────────── */

const backHandlers: Array<() => boolean> = []

/** أحدث معالج بيتسأل الأول. لو رجّع true الرجوع اتعالج ووقفنا */
export function registerBackHandler(handler: () => boolean): () => void {
  backHandlers.unshift(handler)
  return () => {
    const i = backHandlers.indexOf(handler)
    if (i >= 0) backHandlers.splice(i, 1)
  }
}

const isVisible = (node: Element) => {
  const rect = node.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function insideFixedLayer(node: Element): boolean {
  for (let n: Element | null = node; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return true
  }
  return false
}

/**
 * يقفل أعلى طبقة مفتوحة (قايمة «المزيد»، القايمة السريعة، نافذة).
 *
 * المنصة بتسمّي أزرار القفل «إغلاق…» في كل مكان، فبندوّر عليها جوّه
 * عناصر ثابتة فوق الصفحة ونضغط آخر واحد (الأحدث فتحًا). الشرط إنها جوّه
 * طبقة ثابتة مهم: كروت التنبيهات جوّه الصفحة فيها «إغلاق» برضه، والرجوع
 * ما يصحّش يقفلها بدل ما يرجع.
 */
function closeTopLayer(): boolean {
  const closers = Array.from(document.querySelectorAll<HTMLElement>('[aria-label^="إغلاق"], [aria-label="Close"]')).filter(
    (n) => isVisible(n) && insideFixedLayer(n),
  )
  const closer = closers[closers.length - 1]
  if (closer) {
    closer.click()
    return true
  }

  const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')).filter(isVisible).pop()
  if (dialog) {
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
    return true
  }

  /* قوايم منسدلة في الشريط العلوي فقط — مش أقسام قابلة للطي جوّه الصفحة */
  const toggle = Array.from(document.querySelectorAll<HTMLElement>('[aria-expanded="true"]'))
    .filter((n) => isVisible(n) && (n.closest('header, .safe-top') || n.hasAttribute('aria-haspopup')))
    .pop()
  if (toggle) {
    toggle.click()
    return true
  }
  return false
}

let exitArmedAt = 0

function handleBack(canGoBack: boolean): void {
  for (const handler of backHandlers) if (handler()) return
  if (closeTopLayer()) return

  if (canGoBack && !ROOT_PATHS.has(location.pathname)) {
    history.back()
    return
  }

  /* في صفحة البداية: دوسة تنبّه، والتانية تخرج */
  const now = Date.now()
  if (now - exitArmedAt < 2000) {
    exitArmedAt = 0
    void native('App', 'minimizeApp')
    return
  }
  exitArmedAt = now
  toast('اضغط رجوع مرة كمان للخروج', { duration: 2000 })
}

/* ─────────────── الروابط العميقة ─────────────── */

function resolveDeepLink(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (APP_HOSTS.has(url.hostname)) return `${SITE_ORIGIN}${url.pathname}${url.search}${url.hash}`
    /* zawya://dashboard/orders → /dashboard/orders */
    if (url.protocol === 'zawya:') {
      const path = `/${url.host}${url.pathname}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || HOME_PATH
      return `${SITE_ORIGIN}${path}${url.search}`
    }
  } catch {
    /* رابط مش مفهوم — نتجاهله */
  }
  return null
}

function openDeepLink(raw: string): void {
  const target = resolveDeepLink(raw)
  if (target && target !== location.href) location.assign(target)
}

/* ─────────────── الرجوع للتطبيق بعد غياب ─────────────── */

/*
  لو التطبيق فضل في الخلفية أكتر من نص ساعة، الأرقام اللي على الشاشة
  (طلبات، مخزون) بقت قديمة. بنحدّث الصفحة بهدوء بدل ما التاجر يتصرّف
  على بيانات فاتت.
*/
const STALE_AFTER = 30 * 60 * 1000
let backgroundedAt = 0

export function installNavigation(): void {
  patchHistory()
  watchLinkClicks()
  window.addEventListener('pageshow', progressDone)

  if (IS_ANDROID) {
    void listen<{ canGoBack: boolean }>('App', 'backButton', ({ canGoBack }) => handleBack(canGoBack))
  }

  void listen<{ url: string }>('App', 'appUrlOpen', ({ url }) => openDeepLink(url))
  /* فتح التطبيق من رابط وهو مقفول: الرابط بيوصل هنا مرة واحدة بس */
  if (session.get('zw-launch-url') !== '1') {
    session.set('zw-launch-url', '1')
    void native<{ url?: string }>('App', 'getLaunchUrl').then((res) => {
      if (res?.url) openDeepLink(res.url)
    })
  }

  void listen<{ isActive: boolean }>('App', 'appStateChange', ({ isActive }) => {
    if (!isActive) {
      backgroundedAt = Date.now()
      return
    }
    if (backgroundedAt && Date.now() - backgroundedAt > STALE_AFTER && !document.querySelector('form :focus')) {
      location.reload()
    }
    backgroundedAt = 0
  })
}
