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
import { PRODUCTS_CSS } from './styles-products'
import { ProductsScreen } from './products'
import { ProductDetailScreen } from './product-detail'
import { clearProductsCache } from './products-api'
import { SHELL_CSS } from './styles'
import { TabBar } from './tabbar'

const ORDER_DETAIL = /^\/dashboard\/orders\/([^/]+)$/
/* صفحات جوّه المنتجات مش منتجات — new وcategories وimport وtrash بيفضلوا صفحات المنصة */
const PRODUCT_DETAIL = /^\/dashboard\/products\/([0-9a-f-]{36})$/i

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

type ScreenKey = 'home' | 'orders' | 'order' | 'products' | 'product'

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

  const [unavailable, setUnavailable] = useState<Record<ScreenKey, boolean>>({
    home: false,
    orders: false,
    order: false,
    products: false,
    product: false,
  })
  const markUnavailable = useMemo(
    () => ({
      home: () => setUnavailable((u) => ({ ...u, home: true })),
      orders: () => setUnavailable((u) => ({ ...u, orders: true })),
      order: () => setUnavailable((u) => ({ ...u, order: true })),
      products: () => setUnavailable((u) => ({ ...u, products: true })),
      product: () => setUnavailable((u) => ({ ...u, product: true })),
    }),
    [],
  )

  const detailMatch = path.match(ORDER_DETAIL)
  const orderId = detailMatch && detailMatch[1] !== 'new' ? decodeURIComponent(detailMatch[1]) : null

  const productMatch = path.match(PRODUCT_DETAIL)
  const productId = productMatch ? productMatch[1] : null
  const [lastProductId, setLastProductId] = useState<string | null>(productId)
  useEffect(() => {
    if (productId) setLastProductId(productId)
  }, [productId])

  /* آخر طلب اتفتح بيفضل مرسوم وهو بيخرج — عشان حركة الرجوع تبان */
  const [lastOrderId, setLastOrderId] = useState<string | null>(orderId)
  useEffect(() => {
    if (orderId) setLastOrderId(orderId)
  }, [orderId])

  useEffect(() => {
    if (/^\/(login|signup|verify|reset)/.test(path)) {
      clearHomeCache()
      clearOrdersCache()
      clearProductsCache()
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
      <ProductsScreen
        visible={path === '/dashboard/products' && !unavailable.products && !web}
        onUnavailable={markUnavailable.products}
      />
      <ProductDetailScreen
        visible={Boolean(productId) && !unavailable.product && !web}
        productId={productId ?? lastProductId}
        onUnavailable={markUnavailable.product}
      />
      <TabBar path={path} active={onDashboard} />
    </>
  )
}

export function installShell(): void {
  const root = layer()
  const style = document.createElement('style')
  style.textContent = SHELL_CSS + ORDERS_CSS + PRODUCTS_CSS
  root.appendChild(style)
  const mount = document.createElement('div')
  mount.className = 'shell'
  root.appendChild(mount)
  render(<Shell />, mount)
}
