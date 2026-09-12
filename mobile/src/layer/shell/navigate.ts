/**
 * التنقّل من الشاشات الأصلية لصفحات المنصة.
 *
 * الأفضل تنقّل Next من غير تحميل صفحة: الراوتر لو متاح، وإلا نضغط رابط
 * Next موجود فعلًا في الصفحة لنفس العنوان (الشريط السفلي المخفي مثلًا
 * فيه روابط الأقسام). التحميل الكامل آخر احتياطي بس.
 */
import { progressStart } from '../navigation'

type NextGlobal = { next?: { router?: { push?: (href: string) => void } } }

export function navigate(href: string): void {
  if (href === location.pathname + location.search) return
  progressStart()

  const router = (window as unknown as NextGlobal).next?.router
  if (typeof router?.push === 'function') {
    router.push(href)
    return
  }

  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
    (a) => a.getAttribute('href') === href,
  )
  if (link) {
    link.click()
    return
  }

  location.assign(href)
}

/** المتجر والروابط الخارجية — الطبقة الأصلية بتفتحهم في متصفح داخلي */
export function openExternal(url: string): void {
  location.assign(url)
}
