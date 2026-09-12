/**
 * قايمة الطلبات — شاشة أصلية.
 *
 * نفس محتوى صفحة الطلبات في اللوحة (نفس الترتيب والفلاتر ودرجة الثقة)،
 * بشكل تطبيق: فلاتر بالسحب بتبدّل فورًا، كروت بتفتح التفاصيل من غير
 * تحميل، وأزرار اتصال وواتساب على كل طلب.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import {
  fetchOrders,
  ordersVersion,
  previews,
  readOrdersCache,
  whatsappLink,
  type ListOrder,
  type OrdersPayload,
} from './orders-api'
import { formatDateTime, formatMoney, formatNumber } from './format'
import { navigate } from './navigate'
import { Screen } from './screen'
import { Icon } from './ui'

/* نفس ألوان `ORDER_STATUSES` في المنصة */
export const STATUS_COLORS: Record<string, [string, string]> = {
  incomplete: ['var(--color-warning-soft)', 'var(--color-warning)'],
  pending: ['var(--color-info-soft)', 'var(--color-info)'],
  confirmed: ['var(--primary-soft)', 'var(--primary)'],
  processing: ['var(--primary-soft)', 'var(--primary)'],
  shipped: ['var(--color-info-soft)', 'var(--color-info)'],
  delivered: ['var(--color-success-soft)', 'var(--color-success)'],
  cancelled: ['var(--color-danger-soft)', 'var(--color-danger)'],
  returned: ['var(--color-danger-soft)', 'var(--color-danger)'],
}

export const statusColors = (status: string) => STATUS_COLORS[status] ?? STATUS_COLORS.pending

/* التبويبات قبل أول رد — نفس ترتيب المنصة من غير الأعداد */
const DEFAULT_TABS = [
  { key: 'all', label: 'الكل', n: 0 },
  { key: 'pending', label: 'قيد الانتظار', n: 0 },
  { key: 'confirmed', label: 'مؤكّد', n: 0 },
  { key: 'processing', label: 'بيتجهّز', n: 0 },
  { key: 'shipped', label: 'اتشحن', n: 0 },
  { key: 'delivered', label: 'اتسلّم', n: 0 },
  { key: 'cancelled', label: 'ملغي', n: 0 },
]

export function TrustChip({ level, label }: { level: string; label: string }) {
  const icon = level === 'good' ? icons.shieldCheck() : level === 'watch' ? icons.shieldQuestion() : icons.alertTriangle()
  return (
    <span class={`tchip tchip--${level}`}>
      <Icon svg={icon} />
      {label}
    </span>
  )
}

export function OrdersScreen({
  visible,
  url,
  onUnavailable,
}: {
  visible: boolean
  url: URL
  onUnavailable: () => void
}) {
  const urlFilter = url.searchParams.get('filter') || 'all'
  const [filter, setFilter] = useState(urlFilter)
  const [store, setStore] = useState<Record<string, { at: number; data: OrdersPayload }>>({})
  const [failed, setFailed] = useState(false)
  const seenVersion = useRef(ordersVersion())
  const busy = useRef<string | null>(null)

  useEffect(() => {
    if (visible) setFilter(urlFilter)
  }, [urlFilter, visible])

  const current = useMemo(() => store[filter] ?? readOrdersCache(filter), [store, filter])

  const load = useCallback(
    async (f: string) => {
      if (busy.current === f) return
      busy.current = f
      const res = await fetchOrders(f)
      busy.current = null
      if (res.kind === 'ok') {
        seenVersion.current = ordersVersion()
        setStore((s) => ({ ...s, [f]: { at: res.at, data: res.data } }))
        setFailed(false)
      } else if (res.kind === 'unavailable') {
        onUnavailable()
      } else if (res.kind === 'error') {
        setFailed(true)
      }
    },
    [onUnavailable],
  )

  useEffect(() => {
    if (!visible) return
    const stale = !current || Date.now() - current.at > 20_000 || seenVersion.current !== ordersVersion()
    if (stale) void load(filter)
  }, [visible, filter])

  const choose = (key: string) => {
    if (key === filter) return
    haptic('LIGHT')
    setFilter(key)
    navigate(key === 'all' ? '/dashboard/orders' : `/dashboard/orders?filter=${key}`, { replace: true })
  }

  const data = current?.data ?? null
  const tabs = data?.tabs ?? DEFAULT_TABS

  return (
    <Screen visible={visible} title="الطلبات" onRefresh={() => load(filter)}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الطلبات</h1>
            <p class="page-sub">
              {data
                ? `${formatNumber(data.totalCount)} طلب${data.incompleteCount ? ` · ${formatNumber(data.incompleteCount)} سلة متروكة` : ''}`
                : 'بنجهّز طلباتك…'}
            </p>
          </div>
          {data?.canCreate && (
            <button type="button" class="pill-btn press" onClick={() => navigate('/dashboard/orders/new')}>
              <Icon svg={icons.plus()} />
              طلب جديد
            </button>
          )}
        </header>

        {data && data.incompleteCount > 0 && filter !== 'incomplete' && (
          <button type="button" class="alert alert--warning press rise" onClick={() => choose('incomplete')}>
            <span class="alert-icon">
              <Icon svg={icons.bag()} />
            </span>
            <span class="alert-text">
              <span class="alert-title">{formatNumber(data.incompleteCount)} عميل كتب رقمه وما كمّلش الطلب</span>
              <span class="alert-hint">كلّمهم على واتساب — دي أسرع فلوس ممكن ترجّعها</span>
            </span>
            <Icon svg={icons.chevronLeft()} className="chev" />
          </button>
        )}

        <div class="frail" role="tablist" aria-label="فلترة الطلبات">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              class={`fchip${filter === t.key ? ' fchip--on' : ''}`}
              onClick={() => choose(t.key)}
            >
              {t.label}
              {t.n > 0 && <span class="fchip-n">{formatNumber(t.n)}</span>}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'incomplete'}
            class={`fchip fchip--warn${filter === 'incomplete' ? ' fchip--on' : ''}`}
            onClick={() => choose('incomplete')}
          >
            سلات متروكة
            {(data?.incompleteCount ?? 0) > 0 && <span class="fchip-n">{formatNumber(data!.incompleteCount)}</span>}
          </button>
        </div>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الطلبات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} class="sk" style="height:132px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.orders.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.package()} />
            </span>
            <b>{filter === 'incomplete' ? 'مافيش سلات متروكة' : 'مافيش طلبات هنا'}</b>
            <p>
              {filter === 'incomplete'
                ? 'لما عميل يكتب رقمه في الشيك أوت ويسيب الطلب، هيظهر هنا.'
                : 'أول ما يجيلك طلب هيظهر في الصفحة دي على طول.'}
            </p>
          </div>
        ) : (
          <div class="olist">
            {data.orders.map((o, i) => (
              <OrderCard key={o.id} order={o} currency={data.currency} delay={Math.min(i, 8) * 35} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}

function OrderCard({ order: o, currency, delay }: { order: ListOrder; currency: string; delay: number }) {
  const [bg, fg] = statusColors(o.status)

  const open = () => {
    previews.set(o.id, { ...o, currency })
    haptic('LIGHT')
    navigate(`/dashboard/orders/${o.id}`)
  }

  const act = (href: string) => (e: Event) => {
    e.stopPropagation()
    haptic('LIGHT')
    location.assign(href)
  }

  return (
    <div
      class="ocard press rise"
      style={{ animationDelay: `${delay}ms` }}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open()
      }}
    >
      <div class="ocard-top">
        <span class="ocard-no num">#{o.number}</span>
        <span class="pill" style={{ background: bg, color: fg }}>
          {o.statusLabel}
        </span>
        {o.trust && <TrustChip level={o.trust.level} label={o.trust.label} />}
        <span class="ocard-total">{formatMoney(o.total, currency)}</span>
      </div>
      <div class="ocard-name">
        {o.name || 'بدون اسم'}
        {o.city && <span class="ocard-city"> · {o.city}</span>}
      </div>
      <div class="ocard-meta">
        {formatDateTime(o.createdAt)}
        {o.phone && (
          <>
            {' · '}
            <bdi class="num">{o.phone}</bdi>
          </>
        )}
      </div>
      {(o.phone || o.email) && (
        <div class="ocard-actions">
          {o.phone && (
            <>
              <button type="button" class="act press" onClick={act(`tel:${o.phone}`)}>
                <Icon svg={icons.phone()} />
                اتصال
              </button>
              <button type="button" class="act act--wa press" onClick={act(whatsappLink(o.phone, o.whatsappText))}>
                <Icon svg={icons.messageCircle()} />
                واتساب
              </button>
            </>
          )}
          {o.email && (
            <button type="button" class="act press" onClick={act(`mailto:${o.email}`)}>
              <Icon svg={icons.mail()} />
              بريد
            </button>
          )}
        </div>
      )}
    </div>
  )
}
