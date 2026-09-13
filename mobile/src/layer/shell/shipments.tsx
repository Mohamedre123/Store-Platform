/**
 * الشحنات — شاشة أصلية.
 *
 * اللي التاجر بيفتح الشحنات عشانه من الموبايل: كام شحنة في الطريق، فلوسه
 * اللي لسه عند شركة الشحن، الطلبات المؤكّدة اللي مستنية تتشحن، وحالة كل
 * شحنة ورقم بوليصتها وتتبّعها. الضغط على أي شحنة أو طلب بيفتح الطلب نفسه.
 *
 * تسجيل شحنة جديدة وتغيير الحالة والتحصيل فضلوا في صفحة المنصة
 * (زرار «شحنة») — نفس الشاشة اللي التاجر متعوّد عليها.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatDateTime, formatMoney, formatNumber } from './format'
import { navigate, openExternal } from './navigate'
import { Screen } from './screen'
import { fetchShipments, readShipmentsCache, type ShipmentItem } from './shipments-api'
import { Icon } from './ui'

type Filter = 'all' | 'active' | 'unsettled' | 'problem'

const FINISHED = ['delivered', 'failed', 'returned']

export function ShipmentsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const [state, setState] = useState(() => readShipmentsCache())
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const res = await fetchShipments()
    busy.current = false
    if (res.kind === 'ok') {
      setState({ at: res.at, data: res.data })
      setFailed(false)
    } else if (res.kind === 'unavailable') onUnavailable()
    else if (res.kind === 'error') setFailed(true)
  }, [onUnavailable])

  useEffect(() => {
    if (visible && (!state || Date.now() - state.at > 30_000)) void load()
  }, [visible])

  const data = state?.data ?? null

  const counts = useMemo(() => {
    const list = data?.shipments ?? []
    return {
      all: list.length,
      active: list.filter((s) => !FINISHED.includes(s.status)).length,
      unsettled: list.filter((s) => s.status === 'delivered' && !s.collected && s.codAmount > 0).length,
      problem: list.filter((s) => s.status === 'failed' || s.status === 'returned').length,
    }
  }, [data])

  const shown = useMemo(() => {
    const list = data?.shipments ?? []
    if (filter === 'active') return list.filter((s) => !FINISHED.includes(s.status))
    if (filter === 'unsettled') return list.filter((s) => s.status === 'delivered' && !s.collected && s.codAmount > 0)
    if (filter === 'problem') return list.filter((s) => s.status === 'failed' || s.status === 'returned')
    return list
  }, [data, filter])

  const manage = () => {
    haptic('LIGHT')
    navigate('/dashboard/shipments?web=1')
  }

  const openOrder = (orderId: string) => {
    haptic('LIGHT')
    navigate(`/dashboard/orders/${orderId}`)
  }

  return (
    <Screen visible={visible} title="الشحنات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الشحنات</h1>
            <p class="page-sub">
              {data
                ? `${formatNumber(data.shipments.length)} شحنة · ${formatNumber(data.pending.length)} طلب مستني يتشحن`
                : 'بنجهّز شحناتك…'}
            </p>
          </div>
          <button type="button" class="pill-btn press" onClick={manage}>
            <Icon svg={icons.plus()} />
            شحنة
          </button>
        </header>

        {data && (
          <section class="card sec facts rise">
            <div class="fact">
              <span class="fact-label">في الطريق</span>
              <b>{formatNumber(data.stats.inTransit)}</b>
            </div>
            <div class="fact">
              <span class="fact-label">عند شركة الشحن</span>
              <b class={data.stats.outstandingAmount > 0 ? 'warn' : ''}>
                {formatMoney(data.stats.outstandingAmount, data.currency)}
              </b>
            </div>
            <div class="fact">
              <span class="fact-label">فشل أو رجع</span>
              <b class={data.stats.failed > 0 ? 'bad' : ''}>{formatNumber(data.stats.failed)}</b>
            </div>
          </section>
        )}

        {data?.autoCarrier && (
          <p class="fine">مربوط بـ{data.autoCarrier} — من «شحنة» تبعت الطلب للشركة بضغطة.</p>
        )}

        {data && data.pending.length > 0 && (
          <section class="card list rise">
            <div class="sh-list-head">
              <b>مستني يتشحن</b>
              <span class="count">{formatNumber(data.pending.length)}</span>
            </div>
            {data.pending.map((p) => (
              <div
                key={p.orderId}
                class="row press"
                role="button"
                tabIndex={0}
                onClick={() => openOrder(p.orderId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openOrder(p.orderId)
                }}
              >
                <span class="sh-icon">
                  <Icon svg={icons.package()} />
                </span>
                <span class="row-main">
                  <span class="row-title">
                    <span class="num">#{p.orderNumber}</span> · {p.customerName || 'بدون اسم'}
                  </span>
                  <span class="row-sub">
                    {p.city ?? 'من غير محافظة'} · {p.cod ? 'الدفع عند الاستلام' : p.paid ? 'مدفوع' : 'لسه ما اتدفعش'}
                  </span>
                </span>
                <span class="row-end">{formatMoney(p.total, data.currency)}</span>
              </div>
            ))}
          </section>
        )}

        <div class="frail" role="tablist" aria-label="فلترة الشحنات">
          {(
            [
              { key: 'all', label: 'الكل', n: counts.all },
              { key: 'active', label: 'في الطريق', n: counts.active },
              { key: 'unsettled', label: 'فلوس لسه ما اتحصّلتش', n: counts.unsettled },
              { key: 'problem', label: 'مشاكل', n: counts.problem },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              class={`fchip${filter === t.key ? ' fchip--on' : ''}${t.key === 'problem' && t.n > 0 ? ' fchip--warn' : ''}`}
              onClick={() => {
                haptic('LIGHT')
                setFilter(t.key)
              }}
            >
              {t.label}
              {t.n > 0 && <span class="fchip-n">{formatNumber(t.n)}</span>}
            </button>
          ))}
        </div>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الشحنات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} class="sk" style="height:128px;border-radius:20px" />
              ))}
            </div>
          )
        ) : shown.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.truck()} />
            </span>
            <b>{filter === 'all' ? 'مافيش شحنات لسه' : 'مافيش شحنات هنا'}</b>
            <p>
              {filter === 'all'
                ? 'أول ما تسجّل بوليصة لطلب مؤكّد، هتتابعها من هنا.'
                : 'جرّب فلتر تاني.'}
            </p>
            {filter === 'all' && (
              <button type="button" class="btn btn--primary press" onClick={manage}>
                <Icon svg={icons.plus()} />
                سجّل شحنة
              </button>
            )}
          </div>
        ) : (
          <div class="olist">
            {shown.map((s, i) => (
              <ShipmentCard key={s.id} item={s} currency={data.currency} delay={Math.min(i, 8) * 35} onOpen={openOrder} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}

function ShipmentCard({
  item: s,
  currency,
  delay,
  onOpen,
}: {
  item: ShipmentItem
  currency: string
  delay: number
  onOpen: (orderId: string) => void
}) {
  const stop = (run: () => void) => (e: Event) => {
    e.stopPropagation()
    haptic('LIGHT')
    run()
  }

  const copy = async () => {
    if (!s.trackingNumber) return
    try {
      await navigator.clipboard.writeText(s.trackingNumber)
      toast('اتنسخ رقم البوليصة', { tone: 'success' })
    } catch {
      toast(s.trackingNumber)
    }
  }

  return (
    <div
      class="ocard press rise"
      style={{ animationDelay: `${delay}ms` }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(s.orderId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(s.orderId)
      }}
    >
      <div class="ocard-top">
        <span class="ocard-no num">#{s.orderNumber}</span>
        <span class="pill" style={{ background: s.bg, color: s.fg }}>
          {s.statusLabel}
        </span>
        <span class="ocard-total">{s.codAmount > 0 ? formatMoney(s.codAmount, currency) : 'مدفوع'}</span>
      </div>
      <div class="ocard-name">
        {s.customerName || 'بدون اسم'}
        {s.city && <span class="ocard-city"> · {s.city}</span>}
      </div>
      <div class="ocard-meta">
        {s.carrierLabel}
        {s.trackingNumber && (
          <>
            {' · '}
            <bdi class="num">{s.trackingNumber}</bdi>
          </>
        )}
        {' · '}
        {formatDateTime(s.createdAt)}
      </div>
      {s.status === 'delivered' && s.codAmount > 0 && !s.collected && (
        <div class="sh-cod">اتسلّمت — والفلوس لسه عند شركة الشحن</div>
      )}
      {(s.trackingUrl || s.trackingNumber || s.customerPhone) && (
        <div class="ocard-actions">
          {s.trackingUrl && (
            <button type="button" class="act press" onClick={stop(() => openExternal(s.trackingUrl!))}>
              <Icon svg={icons.truck()} />
              تتبّع
            </button>
          )}
          {s.trackingNumber && (
            <button type="button" class="act press" onClick={stop(() => void copy())}>
              <Icon svg={icons.layers()} />
              نسخ البوليصة
            </button>
          )}
          {s.customerPhone && (
            <button type="button" class="act press" onClick={stop(() => location.assign(`tel:${s.customerPhone}`))}>
              <Icon svg={icons.phone()} />
              اتصال
            </button>
          )}
        </div>
      )}
    </div>
  )
}
