/**
 * التنقّل من الشاشات الأصلية.
 *
 * ## الشاشة بتظهر قبل ما المنصة ترد
 * تنقّل Next بيغيّر الرابط بعد ما الخادم يرد — يعني نص ثانية أو أكتر.
 * لو الشاشة الأصلية استنت الرابط، التطبيق كان هيبان بطيء زي الموقع.
 * فبنبلّغ الهيكل بالوجهة **لحظة الضغطة** (`onPendingNavigation`)،
 * والشاشة بتترسم فورًا، والمنصة بتكمّل تحت في هدوء.
 *
 * ## والتنقّل نفسه بيعدّي على Next
 * عشان سجل الرجوع يفضل سليم: زرار الرجوع والسحب من الطرف بيرجعوا
 * لنفس الأماكن اللي Next عارفها. الراوتر لو متاح، وإلا رابط Next
 * موجود في الصفحة لنفس العنوان، والتحميل الكامل آخر احتياطي.
 */
import { progressStart } from '../navigation'

type Router = { push?: (href: string) => void; replace?: (href: string) => void }
type NextGlobal = { next?: { router?: Router } }

const pendingListeners = new Set<(href: string) => void>()

export function onPendingNavigation(listener: (href: string) => void): () => void {
  pendingListeners.add(listener)
  return () => {
    pendingListeners.delete(listener)
  }
}

export function navigate(href: string, options: { replace?: boolean } = {}): void {
  if (href === location.pathname + location.search) return
  pendingListeners.forEach((listener) => listener(href))
  progressStart()

  const router = (window as unknown as NextGlobal).next?.router
  const method = options.replace ? router?.replace : router?.push
  if (router && typeof method === 'function') {
    method.call(router, href)
    return
  }

  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
    (a) => a.getAttribute('href') === href,
  )
  if (link) {
    link.click()
    return
  }

  if (options.replace) location.replace(href)
  else location.assign(href)
}

/** المتجر والروابط الخارجية — الطبقة الأصلية بتفتحهم في متصفح داخلي */
export function openExternal(url: string): void {
  location.assign(url)
}
