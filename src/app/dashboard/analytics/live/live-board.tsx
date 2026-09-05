'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, CreditCard, Eye, RefreshCw, ShoppingCart } from 'lucide-react'
import { refreshLiveAction } from './actions'
import type { LiveSnapshot } from '@/lib/live-view'
import { Card } from '@/components/ui'
import { cn, formatMoney } from '@/lib/utils'

/**
 * شاشة «دلوقتي».
 *
 * ## بتتحدّث لوحدها، وبتقف لما التاجر يسيبها
 * `document.hidden` بيوقّف المؤقّت. من غير ده، تاب متنسي مفتوح
 * على مكتب التاجر كان هيفضل بيضرب استعلامًا كل ١٥ ثانية طول
 * اليوم — يعني ٥٧٦٠ استعلامًا في اليوم من حد مش شايف الشاشة
 * أصلًا.
 *
 * ## والرقم بيتحرّك لما يتغيّر بس
 * النبضة على «الزوار دلوقتي» بتشتغل لما القيمة تتغيّر فعلًا. لو
 * اشتغلت مع كل تحديث، الشاشة كانت هتبقى بتلمع كل ربع دقيقة وهي
 * ساكتة — والتاجر بيتعوّد يتجاهلها.
 */
export function LiveBoard({
  initial,
  currency,
  showMoney,
}: {
  initial: LiveSnapshot
  currency: string
  showMoney: boolean
}) {
  const [data, setData] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [pulse, setPulse] = useState(false)
  const prevActive = useRef(initial.activeNow)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await refreshLiveAction()
      if (!('error' in next)) {
        if (next.activeNow !== prevActive.current) {
          prevActive.current = next.activeNow
          setPulse(true)
          setTimeout(() => setPulse(false), 900)
        }
        setData(next)
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer) return
      timer = setInterval(refresh, 15_000)
    }
    const stop = () => {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        /* رجع للتاب؟ حدّث فورًا بدل ما يبص على أرقام قديمة ١٥ ثانية */
        void refresh()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const quiet =
    data.activeNow === 0 && data.sessionsHour === 0 && data.activeCarts === 0

  return (
    <div className="flex flex-col gap-6">
      {/* ────────── الشريط العلوي ────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="flex flex-col gap-1 p-4">
          <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
            <span className="relative flex h-2 w-2">
              {data.activeNow > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  data.activeNow > 0 ? 'bg-[var(--color-success)]' : 'bg-[var(--fg-subtle)]',
                )}
              />
            </span>
            زوّار دلوقتي
          </span>
          <span
            className={cn(
              'tabular text-2xl font-bold transition-colors',
              pulse && 'text-[var(--color-success)]',
            )}
          >
            {data.activeNow}
          </span>
        </Card>

        <Stat icon={Eye} label="جلسات آخر ساعة" value={String(data.sessionsHour)} />
        <Stat icon={ShoppingCart} label="سلات مفتوحة" value={String(data.activeCarts)} />
        {showMoney ? (
          <Stat
            icon={CreditCard}
            label="مبيعات آخر ساعة"
            value={formatMoney(data.revenueHour, currency)}
            hint={`${data.ordersHour} طلب`}
          />
        ) : (
          <Stat icon={CreditCard} label="طلبات آخر ساعة" value={String(data.ordersHour)} />
        )}
      </div>

      {quiet && (
        <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
          مفيش حركة على المتجر في الساعة اللي فاتت. الشاشة دي بتتملي لوحدها أول ما حد يفتح
          متجرك — سيبها مفتوحة وأنت بتشغّل إعلان وهتشوف أثره في ثواني.
        </p>
      )}

      {/* ────────── القُمع الحيّ ────────── */}
      {!quiet && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">آخر ساعة، خطوة بخطوة</h2>
          <FunnelBar
            steps={[
              { label: 'دخلوا', n: data.sessionsHour },
              { label: 'حطّوا في السلة', n: data.activeCarts },
              { label: 'بدأوا الدفع', n: data.checkoutsHour },
              { label: 'اشتروا', n: data.ordersHour },
            ]}
          />
        </Card>
      )}

      {/* ────────── التوزيعات ────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown
          title="الأجهزة"
          rows={data.byDevice.map((d) => ({ ...d, key: deviceLabel(d.key) }))}
          empty="لسه مفيش زيارات"
        />
        <Breakdown title="المدن" rows={data.byCity} empty="لسه مفيش زيارات" />
        <Breakdown title="جايين منين" rows={data.bySource} empty="لسه مفيش زيارات" />
      </div>

      {/* ────────── الصفحات والنشاط ────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">الصفحات اللي بيتفرّجوا عليها</h2>
          {data.topPages.length === 0 ? (
            <p className="text-xs text-[var(--fg-subtle)]">لسه مفيش.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.topPages.map((p) => (
                <li key={p.path} className="flex items-center gap-3 text-sm">
                  <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[var(--fg-muted)]">
                    {prettyPath(p.path)}
                  </span>
                  <span className="tabular shrink-0 text-xs font-semibold">{p.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
              اللي بيحصل
            </h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              حدّث
            </button>
          </div>

          {data.feed.length === 0 ? (
            <p className="text-xs text-[var(--fg-subtle)]">مفيش نشاط في آخر ساعتين.</p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {data.feed.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-start gap-2.5 text-xs">
                  <span
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      e.type === 'purchase'
                        ? 'bg-[var(--color-success)]'
                        : e.type === 'begin_checkout'
                          ? 'bg-[var(--color-warning)]'
                          : e.type === 'add_to_cart'
                            ? 'bg-[var(--primary)]'
                            : 'bg-[var(--fg-subtle)]',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    <span className="font-medium">{eventLabel(e.type)}</span>
                    {e.productName && (
                      <span className="text-[var(--fg-muted)]"> — {e.productName}</span>
                    )}
                    {e.type === 'purchase' && showMoney && e.value ? (
                      <span className="tabular text-[var(--color-success)]">
                        {' '}
                        {formatMoney(e.value, currency)}
                      </span>
                    ) : null}
                    {e.city && <span className="text-[var(--fg-subtle)]"> · {e.city}</span>}
                  </span>
                  <span className="tabular shrink-0 text-[var(--fg-subtle)]">{ago(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ────────────────────────── أجزاء ────────────────────────── */

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Eye
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className="tabular text-2xl font-bold">{value}</span>
      {hint && <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>}
    </Card>
  )
}

/**
 * القُمع كأشرطة نسبية.
 *
 * النسبة من **أول خطوة** لا من اللي قبلها مباشرةً: التاجر بيقارن
 * «مية دخلوا وخمسة اشتروا» — ده الرقم اللي بيقرّر بيه يزوّد
 * الإعلان ولا يصلّح الصفحة.
 */
function FunnelBar({ steps }: { steps: Array<{ label: string; n: number }> }) {
  const top = Math.max(1, steps[0]?.n ?? 1)
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-[var(--fg-muted)]">{s.label}</span>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <span
              className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-500"
              style={{ width: `${Math.min(100, (s.n / top) * 100)}%` }}
            />
          </span>
          <span className="tabular w-14 shrink-0 text-end text-xs font-semibold">
            {s.n}
            {top > 0 && s.n > 0 && (
              <span className="ms-1 font-normal text-[var(--fg-subtle)]">
                {Math.round((s.n / top) * 100)}%
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string
  rows: Array<{ key: string; n: number }>
  empty: string
}) {
  const total = rows.reduce((s, r) => s + r.n, 0)
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--fg-subtle)]">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.key}</span>
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <span
                  className="block h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${total ? (r.n / total) * 100 : 0}%` }}
                />
              </span>
              <span className="tabular w-6 shrink-0 text-end text-xs font-semibold">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ────────────────────────── أسماء ────────────────────────── */

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'موبايل',
  tablet: 'تابلت',
  desktop: 'كمبيوتر',
}

function deviceLabel(key: string): string {
  return DEVICE_LABELS[key] ?? key
}

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

function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type
}

/**
 * المسار زي ما التاجر يقراه.
 *
 * المسارات بتتخزّن مرمَّزة بـURL زي ما المتصفح بيبعتها، فمنتج اسمه
 * عربي بيتخزّن كأربعين علامة نسبة. من غير فكّ الترميز، لوحة
 * «الصفحات اللي بيتفرّجوا عليها» كانت هتبقى سطور مالهاش أي معنى
 * لصاحب متجر عربي — وهو كل جمهورنا.
 *
 * وبنشيل بادئة `/s/<اسم المتجر>`: هي تفصيلة توجيه داخلية عندنا،
 * والتاجر شايف نفس الصفحة مرتين بشكلين لأن نُص الزيارات بتيجي من
 * نطاقه ونُصّها من مسار المعاينة.
 */
function prettyPath(path: string): string {
  const withoutPrefix = path.replace(/^\/s\/[^/]+/, '') || '/'
  try {
    return decodeURIComponent(withoutPrefix)
  } catch {
    return withoutPrefix
  }
}

/** «من ٣ د» — الوقت النسبي أوضح من الساعة في شاشة بتتحدّث لوحدها */
function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'دلوقتي'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} د`
  return `${Math.round(mins / 60)} س`
}
