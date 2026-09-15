/**
 * العرض المباشر — شاشة أصلية (`/dashboard/analytics/live`).
 *
 * نفس `LiveBoard` في اللوحة: الزوار دلوقتي (بتنبض لما الرقم يتغيّر)، جلسات آخر ساعة، سلات مفتوحة، مبيعات/طلبات
 * آخر ساعة، «مفيش حركة» لو هادي، قُمع آخر ساعة، الأجهزة والمدن والمصادر، الصفحات اللي بيتفرّجوا عليها، و«اللي بيحصل»
 * بزرار «حدّث». بتتحدّث لوحدها كل ١٥ ثانية وهي ظاهرة بس (ولما التطبيق في الخلفية بتقف).
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { useResource } from './http'
import { liveData } from './reports-api'
import { Screen } from './screen'
import { LoadState } from './settings-forms'
import { Icon } from './ui'

/* نفس أسماء `live-board.tsx` في اللوحة */
const DEVICE_LABELS: Record<string, string> = { mobile: 'موبايل', tablet: 'تابلت', desktop: 'كمبيوتر' }
const EVENT_LABELS: Record<string, string> = {
  page_view: 'فتح صفحة',
  product_view: 'بص على منتج',
  add_to_cart: 'حطّ في السلة',
  remove_from_cart: 'شال من السلة',
  begin_checkout: 'بدأ الدفع',
  add_payment_info: 'كتب بيانات الدفع',
  purchase: 'اشترى',
  search: 'بحث',
  whatsapp_click: 'دوس واتساب',
  funnel_view: 'فتح صفحة هبوط',
}

function prettyPath(path: string): string {
  const withoutPrefix = path.replace(/^\/s\/[^/]+/, '') || '/'
  try {
    return decodeURIComponent(withoutPrefix)
  } catch {
    return withoutPrefix
  }
}

function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'دلوقتي'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${formatNumber(mins)} د`
  return `${formatNumber(Math.round(mins / 60))} س`
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; n: number }> }) {
  const total = rows.reduce((s, r) => s + r.n, 0)
  return (
    <section class="card sec rise">
      <div class="an-head">
        <b>{title}</b>
      </div>
      {rows.length === 0 ? (
        <p class="an-none">لسه مفيش زيارات</p>
      ) : (
        <div class="an-meters">
          {rows.map((r) => (
            <div key={r.key}>
              <div class="an-meter-top">
                <span>{r.key}</span>
                <span>{formatNumber(r.n)}</span>
              </div>
              <div class="an-track">
                <i style={{ width: `${total ? Math.max(2, (r.n / total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function LiveScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(liveData, visible, onUnavailable, 5_000)
  const [refreshing, setRefreshing] = useState(false)
  const [pulse, setPulse] = useState(false)
  const prev = useRef<number | null>(null)

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  /* كل ١٥ ثانية وهي ظاهرة — ولما التطبيق يرجع من الخلفية بتتحدّث فورًا */
  useEffect(() => {
    if (!visible) return
    const tick = () => {
      if (!document.hidden) void load()
    }
    const id = setInterval(tick, 15_000)
    const onVisibility = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [visible])

  useEffect(() => {
    if (!data) return
    if (prev.current !== null && prev.current !== data.activeNow) {
      setPulse(true)
      setTimeout(() => setPulse(false), 900)
    }
    prev.current = data.activeNow
  }, [data?.activeNow])

  const quiet = data ? data.activeNow === 0 && data.sessionsHour === 0 && data.activeCarts === 0 : false
  const top = data ? Math.max(1, data.sessionsHour) : 1

  return (
    <Screen visible={visible} title="العرض المباشر" onRefresh={refresh}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">العرض المباشر</h1>
            <p class="page-sub">مين على متجرك دلوقتي وبيعمل إيه. الشاشة دي بتتحدّث لوحدها كل ١٥ ثانية.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="العرض المباشر" />
        ) : (
          <>
            <div class="an-kpis">
              <div class="card an-kpi rise">
                <span class="an-kpi-label">
                  <span class={`lv-dot${data.activeNow > 0 ? ' lv-dot--on' : ''}`} />
                  زوّار دلوقتي
                </span>
                <b class={`an-kpi-value${pulse ? ' lv-pulse' : ''}`}>{formatNumber(data.activeNow)}</b>
              </div>
              <div class="card an-kpi rise">
                <span class="an-kpi-label">جلسات آخر ساعة</span>
                <b class="an-kpi-value">{formatNumber(data.sessionsHour)}</b>
              </div>
              <div class="card an-kpi rise">
                <span class="an-kpi-label">سلات مفتوحة</span>
                <b class="an-kpi-value">{formatNumber(data.activeCarts)}</b>
              </div>
              {data.showMoney ? (
                <div class="card an-kpi rise">
                  <span class="an-kpi-label">مبيعات آخر ساعة</span>
                  <b class="an-kpi-value">{formatMoney(data.revenueHour, data.currency)}</b>
                  <span class="lv-hint">{formatNumber(data.ordersHour)} طلب</span>
                </div>
              ) : (
                <div class="card an-kpi rise">
                  <span class="an-kpi-label">طلبات آخر ساعة</span>
                  <b class="an-kpi-value">{formatNumber(data.ordersHour)}</b>
                </div>
              )}
            </div>

            {quiet ? (
              <p class="np-note rise lv-quiet">
                مفيش حركة على المتجر في الساعة اللي فاتت. الشاشة دي بتتملي لوحدها أول ما حد يفتح متجرك — سيبها مفتوحة وأنت بتشغّل إعلان وهتشوف أثره في ثواني.
              </p>
            ) : (
              <section class="card sec rise">
                <div class="an-head">
                  <b>آخر ساعة، خطوة بخطوة</b>
                </div>
                <div class="an-meters">
                  {[
                    { label: 'دخلوا', n: data.sessionsHour },
                    { label: 'حطّوا في السلة', n: data.activeCarts },
                    { label: 'بدأوا الدفع', n: data.checkoutsHour },
                    { label: 'اشتروا', n: data.ordersHour },
                  ].map((s) => (
                    <div key={s.label}>
                      <div class="an-meter-top">
                        <span>{s.label}</span>
                        <span>
                          {formatNumber(s.n)}
                          {s.n > 0 ? ` · ${formatNumber(Math.round((s.n / top) * 100))}%` : ''}
                        </span>
                      </div>
                      <div class="an-track">
                        <i style={{ width: `${Math.min(100, Math.max(2, (s.n / top) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <Breakdown title="الأجهزة" rows={data.byDevice.map((d) => ({ ...d, key: DEVICE_LABELS[d.key] ?? d.key }))} />
            <Breakdown title="المدن" rows={data.byCity} />
            <Breakdown title="جايين منين" rows={data.bySource} />

            <section class="card sec rise">
              <div class="an-head">
                <b>الصفحات اللي بيتفرّجوا عليها</b>
              </div>
              {data.topPages.length === 0 ? (
                <p class="an-none">لسه مفيش.</p>
              ) : (
                <ul class="lv-pages">
                  {data.topPages.map((p) => (
                    <li key={p.path}>
                      <bdi dir="ltr">{prettyPath(p.path)}</bdi>
                      <b>{formatNumber(p.n)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section class="card sec rise">
              <div class="an-head">
                <b>اللي بيحصل</b>
                <button type="button" class="act press" disabled={refreshing} onClick={() => (haptic('LIGHT'), void refresh())}>
                  {refreshing ? <span class="spinner" /> : <Icon svg={icons.refresh()} />}
                  حدّث
                </button>
              </div>
              {data.feed.length === 0 ? (
                <p class="an-none">مفيش نشاط في آخر ساعتين.</p>
              ) : (
                <ul class="lv-feed">
                  {data.feed.map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      <i class={`lv-ev lv-ev--${e.type}`} aria-hidden="true" />
                      <span>
                        <b>{EVENT_LABELS[e.type] ?? e.type}</b>
                        {e.productName && <span class="lv-muted"> — {e.productName}</span>}
                        {e.type === 'purchase' && data.showMoney && e.value ? <span class="lv-money"> {formatMoney(e.value, data.currency)}</span> : null}
                        {e.city && <span class="lv-subtle"> · {e.city}</span>}
                      </span>
                      <time>{ago(e.at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Screen>
  )
}
