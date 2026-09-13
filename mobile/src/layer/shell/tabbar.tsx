/**
 * شريط التبويبات الأصلي — بيحلّ محل الشريط السفلي بتاع الموقع.
 *
 * ## البنود من المنصة نفسها
 * المنصة بتبني الشريط حسب صلاحيات المستخدم (الموظف اللي مالوش «الطلبات»
 * ما بيشوفهاش). بدل ما نكرر المنطق ده هنا ويختلف بعد أول تعديل، بنقرا
 * بنود الشريط اللي المنصة رسمته (مخفي) ونرسمها بشكل التطبيق. «المزيد»
 * بيضغط زرار المنصة نفسه، فالقايمة الكاملة بتفتح بنفس الصلاحيات.
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { navigate } from './navigate'
import { openMore } from './more'
import { Icon } from './ui'

type Tab = { key: string; label: string; href: string | null; more: boolean; icon: string; source: HTMLElement | null }

/* البنود اللي ليها أقسام جوّاها بتبقى أزرار في المنصة (من غير href) */
const SECTION_HREFS: Record<string, string> = {
  الرئيسية: '/dashboard',
  الطلبات: '/dashboard/orders',
  المنتجات: '/dashboard/products',
  العملاء: '/dashboard/customers',
  'المحتوى والنشر': '/dashboard/studio',
  التسويق: '/dashboard/marketing',
  المتجر: '/dashboard/storefront',
  الدفع: '/dashboard/payments',
  الشحن: '/dashboard/shipping',
  الإضافات: '/dashboard/plugins',
  الإعدادات: '/dashboard/settings',
}

const ICONS: Record<string, () => string> = {
  '/dashboard': icons.house,
  '/dashboard/orders': icons.bag,
  '/dashboard/products': icons.package,
  '/dashboard/customers': icons.users,
  '/dashboard/studio': icons.sparkles,
  '/dashboard/marketing': icons.megaphone,
  '/dashboard/storefront': icons.store,
  '/dashboard/payments': icons.creditCard,
  '/dashboard/shipping': icons.truck,
}

const FALLBACK: Tab[] = [
  { key: 'home', label: 'الرئيسية', href: '/dashboard', more: false, icon: icons.house(), source: null },
  { key: 'orders', label: 'الطلبات', href: '/dashboard/orders', more: false, icon: icons.bag(), source: null },
  { key: 'products', label: 'المنتجات', href: '/dashboard/products', more: false, icon: icons.package(), source: null },
  { key: 'more', label: 'المزيد', href: null, more: true, icon: icons.grid(), source: null },
]

function readTabs(): Tab[] {
  const nav = document.querySelector('nav[aria-label="التنقّل السريع"]')
  if (!nav || !nav.children.length) return FALLBACK
  return Array.from(nav.children).map((node, i) => {
    const label = (node.textContent ?? '').trim()
    const more = label === 'المزيد'
    const href = more ? null : node.getAttribute('href') ?? SECTION_HREFS[label] ?? null
    return {
      key: `${i}:${label}`,
      label,
      href,
      more,
      icon: (more ? icons.grid : ICONS[href ?? ''] ?? icons.grid)(),
      source: node as HTMLElement,
    }
  })
}

/** قايمة «المزيد» أو البحث أو نافذة مفتوحة — الشريط بيتشال من قدامهم */
const overlayOpen = () => Boolean(document.querySelector('.zw-sheet, [role="dialog"], [aria-modal="true"], dialog[open]'))

export function TabBar({ path, active }: { path: string; active: boolean }) {
  const [, rerender] = useState(0)
  const [keyboard, setKeyboard] = useState(false)

  useEffect(() => {
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        rerender((n) => n + 1)
      })
    }
    let observer: MutationObserver | null = null
    const start = () => {
      observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
      schedule()
    }
    if (document.body) start()
    else document.addEventListener('DOMContentLoaded', start, { once: true })

    /* لوحة المفاتيح بتصغّر الشاشة — الشريط ما يصحّش يطلع فوقها ويغطّي الحقل */
    let tallest = window.innerHeight
    const onResize = () => {
      tallest = Math.max(tallest, window.innerHeight)
      setKeyboard(window.innerHeight < tallest * 0.78)
    }
    window.addEventListener('resize', onResize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frame)
    }
  }, [])

  const tabs = readTabs()
  let index = tabs.findIndex(
    (t) => t.href && (t.href === '/dashboard' ? path === '/dashboard' : path === t.href || path.startsWith(`${t.href}/`)),
  )
  /* صفحة مش في الشريط (الإعدادات مثلًا) — مكانها جوّه «المزيد» */
  if (index < 0) index = tabs.findIndex((t) => t.more)

  const hidden = !active || keyboard || overlayOpen()

  const press = (tab: Tab, i: number) => {
    haptic('LIGHT')
    if (tab.more) {
      /*
        قايمة المنصة بتفتح تحت الشاشات الأصلية فمش بتبان — «المزيد»
        بقت لوحة أصلية فوق أي شاشة (more.tsx).
      */
      openMore()
      return
    }
    if (!tab.href) return
    /* الضغط على التبويب اللي إنت فيه بيطلعك لأول الصفحة — عرف iOS وأندرويد */
    if (i === index && path === tab.href) {
      if (tab.href === '/dashboard') window.dispatchEvent(new Event('zw:home-top'))
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate(tab.href)
  }

  return (
    <nav
      class={`tabbar${hidden ? ' tabbar--hidden' : ''}`}
      aria-label="التنقّل"
      aria-hidden={hidden}
      style={`--n:${tabs.length};--i:${Math.max(index, 0)}`}
    >
      <span class={`tab-slot${index < 0 ? ' tab-slot--off' : ''}`} aria-hidden="true">
        <span />
      </span>
      {tabs.map((tab, i) => (
        <button
          key={tab.key}
          type="button"
          class="tab"
          aria-current={i === index ? 'page' : undefined}
          onClick={() => press(tab, i)}
        >
          <Icon svg={tab.icon} />
          <span class="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
