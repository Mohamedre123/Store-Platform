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
import { CUSTOMERS_CSS } from './styles-customers'
import { CustomersScreen } from './customers'
import { CustomerDetailScreen } from './customer-detail'
import { clearCustomersCache } from './customers-api'
import { MORE_CSS } from './styles-more'
import { clearMeCache, MoreSheet } from './more'
import { SHELL_CSS } from './styles'
import { TabBar } from './tabbar'
import { VERIFY_CSS } from './styles-verify'
import { VerifyBar } from './verify'
import { AnalyticsScreen } from './analytics'
import { clearAnalyticsCache } from './analytics-api'
import { ANALYTICS_CSS } from './styles-analytics'
import { ShipmentsScreen } from './shipments'
import { clearShipmentsCache } from './shipments-api'
import { clearBusinessCaches } from './business-api'
import { BUSINESS_CSS } from './styles-business'
import { MarketingScreen } from './marketing'
import { InventoryScreen } from './inventory'
import { MessagesScreen } from './messages'
import { SubscriptionScreen } from './subscription'
import { SettingsScreen } from './settings'
import { EditProductScreen, NewProductScreen } from './product-new'
import { ReviewsScreen } from './reviews'
import { ReturnsScreen } from './returns'
import { ComplaintsScreen } from './complaints'
import { clearOpsCaches } from './ops-api'
import { OPS_CSS } from './styles-ops'
import { BlockedScreen } from './blocked'
import { CouriersScreen } from './couriers'
import { BookingsScreen } from './bookings'
import { ExpensesScreen } from './expenses'
import { SuppliersScreen } from './suppliers'
import { CategoriesScreen } from './categories'
import { TrashScreen } from './trash'
import { LoyaltyScreen } from './loyalty'
import { AffiliatesScreen } from './affiliates'
import { ReferralsScreen } from './referrals'
import { MediaScreen } from './media'
import { BlogScreen } from './blog'

const ORDER_DETAIL = /^\/dashboard\/orders\/([^/]+)$/
/* صفحات جوّه المنتجات مش منتجات — new وcategories وimport وtrash بيفضلوا صفحات المنصة */
const PRODUCT_DETAIL = /^\/dashboard\/products\/([0-9a-f-]{36})$/i
/* «blocked» شاشة الحظر — العميل معرّفه uuid بس */
const CUSTOMER_DETAIL = /^\/dashboard\/customers\/([0-9a-f-]{36})$/i

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

type ScreenKey =
  | 'home'
  | 'orders'
  | 'order'
  | 'products'
  | 'product'
  | 'productEdit'
  | 'customers'
  | 'customer'
  | 'analytics'
  | 'shipments'
  | 'marketing'
  | 'inventory'
  | 'messages'
  | 'subscription'
  | 'newProduct'
  | 'reviews'
  | 'returns'
  | 'complaints'
  | 'blocked'
  | 'couriers'
  | 'bookings'
  | 'expenses'
  | 'suppliers'
  | 'categories'
  | 'trash'
  | 'loyalty'
  | 'affiliates'
  | 'referrals'
  | 'media'
  | 'blog'

const SCREEN_KEYS: ScreenKey[] = [
  'media',
  'blog',
  'loyalty',
  'affiliates',
  'referrals',
  'expenses',
  'suppliers',
  'categories',
  'trash',
  'home',
  'orders',
  'order',
  'products',
  'product',
  'productEdit',
  'customers',
  'customer',
  'analytics',
  'shipments',
  'marketing',
  'inventory',
  'messages',
  'subscription',
  'newProduct',
  'reviews',
  'returns',
  'complaints',
  'blocked',
  'couriers',
  'bookings',
]

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
  const editMode = effective.searchParams.get('edit') === '1'
  const onDashboard = path === '/dashboard' || path.startsWith('/dashboard/')

  const [unavailable, setUnavailable] = useState<Record<ScreenKey, boolean>>(
    () => Object.fromEntries(SCREEN_KEYS.map((k) => [k, false])) as Record<ScreenKey, boolean>,
  )
  const markUnavailable = useMemo(
    () =>
      Object.fromEntries(
        SCREEN_KEYS.map((k) => [k, () => setUnavailable((u) => ({ ...u, [k]: true }))]),
      ) as Record<ScreenKey, () => void>,
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

  const customerMatch = path.match(CUSTOMER_DETAIL)
  const customerId = customerMatch ? customerMatch[1] : null
  const [lastCustomerId, setLastCustomerId] = useState<string | null>(customerId)
  useEffect(() => {
    if (customerId) setLastCustomerId(customerId)
  }, [customerId])

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
      clearCustomersCache()
      clearAnalyticsCache()
      clearShipmentsCache()
      clearBusinessCaches()
      clearOpsCaches()
      clearMeCache()
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
        visible={Boolean(productId) && !editMode && !unavailable.product && !web}
        productId={productId ?? lastProductId}
        onUnavailable={markUnavailable.product}
      />
      <EditProductScreen
        visible={Boolean(productId) && editMode && !unavailable.productEdit && !web}
        productId={productId ?? lastProductId}
        onUnavailable={markUnavailable.productEdit}
      />
      <CustomersScreen
        visible={path === '/dashboard/customers' && !unavailable.customers && !web}
        url={effective}
        onUnavailable={markUnavailable.customers}
      />
      <CustomerDetailScreen
        visible={Boolean(customerId) && !unavailable.customer && !web}
        customerId={customerId ?? lastCustomerId}
        onUnavailable={markUnavailable.customer}
      />
      <AnalyticsScreen
        visible={path === '/dashboard/analytics' && !unavailable.analytics && !web}
        onUnavailable={markUnavailable.analytics}
      />
      <ShipmentsScreen
        visible={path === '/dashboard/shipments' && !unavailable.shipments && !web}
        onUnavailable={markUnavailable.shipments}
      />
      <MarketingScreen
        visible={path === '/dashboard/marketing' && !unavailable.marketing && !web}
        onUnavailable={markUnavailable.marketing}
      />
      <InventoryScreen
        visible={path === '/dashboard/inventory' && !unavailable.inventory && !web}
        onUnavailable={markUnavailable.inventory}
      />
      <MessagesScreen
        visible={path === '/dashboard/messages' && !unavailable.messages && !web}
        onUnavailable={markUnavailable.messages}
      />
      <SubscriptionScreen
        visible={path === '/dashboard/subscription' && !unavailable.subscription && !web}
        onUnavailable={markUnavailable.subscription}
      />
      <SettingsScreen visible={path === '/dashboard/settings' && !web} />
      <NewProductScreen
        visible={path === '/dashboard/products/new' && !unavailable.newProduct && !web}
        onUnavailable={markUnavailable.newProduct}
      />
      <ReviewsScreen
        visible={path === '/dashboard/reviews' && !unavailable.reviews && !web}
        onUnavailable={markUnavailable.reviews}
      />
      <ReturnsScreen
        visible={path === '/dashboard/returns' && !unavailable.returns && !web}
        onUnavailable={markUnavailable.returns}
      />
      <ComplaintsScreen
        visible={path === '/dashboard/complaints' && !unavailable.complaints && !web}
        onUnavailable={markUnavailable.complaints}
      />
      <BlockedScreen
        visible={path === '/dashboard/customers/blocked' && !unavailable.blocked && !web}
        onUnavailable={markUnavailable.blocked}
      />
      <CouriersScreen
        visible={path === '/dashboard/couriers' && !unavailable.couriers && !web}
        onUnavailable={markUnavailable.couriers}
      />
      <BookingsScreen
        visible={path === '/dashboard/bookings' && !unavailable.bookings && !web}
        onUnavailable={markUnavailable.bookings}
      />
      <ExpensesScreen
        visible={path === '/dashboard/expenses' && !unavailable.expenses && !web}
        onUnavailable={markUnavailable.expenses}
      />
      <SuppliersScreen
        visible={path === '/dashboard/suppliers' && !unavailable.suppliers && !web}
        onUnavailable={markUnavailable.suppliers}
      />
      <CategoriesScreen
        visible={path === '/dashboard/products/categories' && !unavailable.categories && !web}
        onUnavailable={markUnavailable.categories}
      />
      <TrashScreen
        visible={path === '/dashboard/products/trash' && !unavailable.trash && !web}
        onUnavailable={markUnavailable.trash}
      />
      <LoyaltyScreen
        visible={path === '/dashboard/loyalty' && !unavailable.loyalty && !web}
        onUnavailable={markUnavailable.loyalty}
      />
      <AffiliatesScreen
        visible={path === '/dashboard/affiliates' && !unavailable.affiliates && !web}
        onUnavailable={markUnavailable.affiliates}
      />
      <ReferralsScreen
        visible={path === '/dashboard/referrals' && !unavailable.referrals && !web}
        onUnavailable={markUnavailable.referrals}
      />
      <MediaScreen
        visible={path === '/dashboard/media' && !unavailable.media && !web}
        onUnavailable={markUnavailable.media}
      />
      <BlogScreen
        visible={path === '/dashboard/blog' && !unavailable.blog && !web}
        onUnavailable={markUnavailable.blog}
      />
      <VerifyBar visible={path === '/verify'} />
      <TabBar path={path} active={onDashboard} />
      {onDashboard && <MoreSheet path={path} search={effective.searchParams.toString()} />}
    </>
  )
}

export function installShell(): void {
  const root = layer()
  const style = document.createElement('style')
  style.textContent =
    SHELL_CSS + ORDERS_CSS + PRODUCTS_CSS + CUSTOMERS_CSS + MORE_CSS + VERIFY_CSS + ANALYTICS_CSS + BUSINESS_CSS + OPS_CSS
  root.appendChild(style)
  const mount = document.createElement('div')
  mount.className = 'shell'
  root.appendChild(mount)
  render(<Shell />, mount)
}
