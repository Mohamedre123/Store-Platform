/**
 * هيكل التطبيق — الشاشات الأصلية وشريط التبويبات.
 *
 * ## إزاي الشاشات بتتحوّل واحدة واحدة
 * كل شاشة أصلية بتتسجّل على مسار. لما المسار يتفتح، الشاشة بتترسم فوق
 * صفحة المنصة وبتاخد مكانها. المسارات اللي لسه ما اتحوّلتش بتفضل صفحة
 * المنصة — بس جوّه نفس الهيكل (نفس شريط التبويبات والحركة) فمفيش نقلة
 * بتبان «موقع».
 *
 * `?web=1` على أي مسار بيعرض نسخة المنصة — مخرج للأفعال اللي لسه
 * مالهاش مكان في الشاشة الأصلية.
 *
 * ولو مسار البيانات بتاع شاشة مش منشور على الموقع لسه، الشاشة دي بس
 * بترجع لنسخة المنصة — والباقي يفضل أصلي.
 */
import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { layer } from '../dom'
import { onRouteChange } from '../navigation'
import { clearHomeCache } from './api'
import { Home } from './home'
import { onPendingNavigation } from './navigate'
import { OrderDetailScreen } from './order-detail'
import { OrdersScreen } from './orders'
import { clearOrdersCache } from './orders-api'
import { ORDERS_CSS } from './styles-orders'
import { SHELL_CSS } from './styles'
import { TabBar } from './tabbar'

const ORDER_DETAIL = /^\/dashboard\/orders\/([^/]+)$/

function useLocation(): URL {
  const [href, setHref] = useState(location.href)
  useEffect(() => {
    const sync = () => setHref(location.href)
    onRouteChange(sync)
    window.addEventListener('popstate', sync)
    window.addEventListener('pageshow', sync)
  }, [])
  return new URL(href)
}

type ScreenKey = 'home' | 'orders' | 'order'

function Shell() {
  const url = useLocation()

  /* الوجهة اللي التاجر داس عليها ولسه المنصة ما ردّتش — الشاشة بتظهر فورًا */
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => onPendingNavigation(setPending), [])
  useEffect(() => setPending(null), [url.href])
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => setPending(null), 10_000)
    return () => clearTimeout(timer)
  }, [pending])

  const effective = pending ? new URL(pending, location.origin) : url
  const path = effective.pathname.replace(/\/+$/, '') || '/'
  const web = effective.searchParams.get('web') === '1'
  const onDashboard = path === '/dashboard' || path.startsWith('/dashboard/')

  const [unavailable, setUnavailable] = useState<Record<ScreenKey, boolean>>({ home: false, orders: false, order: false })
  const markUnavailable = useMemo(
    () => ({
      home: () => setUnavailable((u) => ({ ...u, home: true })),
      orders: () => setUnavailable((u) => ({ ...u, orders: true })),
      order: () => setUnavailable((u) => ({ ...u, order: true })),
    }),
    [],
  )

  const detailMatch = path.match(ORDER_DETAIL)
  const orderId = detailMatch && detailMatch[1] !== 'new' ? decodeURIComponent(detailMatch[1]) : null

  /* آخر طلب اتفتح بيفضل مرسوم وهو بيخرج — عشان حركة الرجوع تبان */
  const [lastOrderId, setLastOrderId] = useState<string | null>(orderId)
  useEffect(() => {
    if (orderId) setLastOrderId(orderId)
  }, [orderId])

  useEffect(() => {
    if (/^\/(login|signup|verify|reset)/.test(path)) {
      clearHomeCache()
      clearOrdersCache()
    }
  }, [path])

  useEffect(() => {
    document.documentElement.classList.toggle('zw-native-tabs', onDashboard)
  }, [onDashboard])

  return (
    <>
      <Home visible={path === '/dashboard' && !unavailable.home && !web} onUnavailable={markUnavailable.home} />
      <OrdersScreen
        visible={path === '/dashboard/orders' && !unavailable.orders && !web}
        url={effective}
        onUnavailable={markUnavailable.orders}
      />
      <OrderDetailScreen
        visible={Boolean(orderId) && !unavailable.order && !web}
        orderId={orderId ?? lastOrderId}
        onUnavailable={markUnavailable.order}
      />
      <TabBar path={path} active={onDashboard} />
    </>
  )
}

export function installShell(): void {
  const root = layer()
  const style = document.createElement('style')
  style.textContent = SHELL_CSS + ORDERS_CSS
  root.appendChild(style)
  const mount = document.createElement('div')
  mount.className = 'shell'
  root.appendChild(mount)
  render(<Shell />, mount)
}
