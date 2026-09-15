/**
 * التحليلات — شاشة أصلية.
 *
 * نفس أرقام صفحة التحليلات في اللوحة (آخر ٣٠ يوم مقابل اللي قبلها)، بشكل
 * تطبيق: المؤشرات الأربعة، رسم الإيرادات بتسحب عليه صباعك يوم بيوم،
 * قُمع التحويل بنسبة اللي وقعوا في كل خطوة، توزيع الطلبات والأكثر مبيعًا.
 * بتفتح فورًا من آخر نسخة محفوظة، وبتتحدّث في الخلفية.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { fetchAnalytics, readAnalyticsCache, type AnalyticsPayload } from './analytics-api'
import { formatMoney, formatNumber } from './format'
import { navigate } from './navigate'
import { Screen } from './screen'
import { Delta, Icon } from './ui'

export function AnalyticsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const [state, setState] = useState(() => readAnalyticsCache())
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const res = await fetchAnalytics()
    busy.current = false
    if (res.kind === 'ok') {
      setState({ at: res.at, data: res.data })
      setFailed(false)
    } else if (res.kind === 'unavailable') onUnavailable()
    else if (res.kind === 'error') setFailed(true)
  }, [onUnavailable])

  useEffect(() => {
    if (visible && (!state || Date.now() - state.at > 60_000)) void load()
  }, [visible])

  const data = state?.data ?? null

  return (
    <Screen visible={visible} title="التحليلات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">التحليلات</h1>
            <p class="page-sub">أداء متجرك في آخر ٣٠ يوم مقارنة باللي قبلهم</p>
          </div>
        </header>

        {data ? (
          <AnalyticsContent data={data} />
        ) : failed ? (
          <div class="empty">
            <span class="empty-icon">
              <Icon svg={icons.wifiOff()} />
            </span>
            <b>مش قادرين نجيب التحليلات</b>
            <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
          </div>
        ) : (
          <div class="an-kpis">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} class="sk" style="height:96px;border-radius:20px" />
            ))}
            <span class="sk" style="grid-column:1/-1;height:250px;border-radius:22px" />
            <span class="sk" style="grid-column:1/-1;height:220px;border-radius:22px" />
          </div>
        )}
      </div>
    </Screen>
  )
}

function AnalyticsContent({ data }: { data: AnalyticsPayload }) {
  const go = (href: string) => {
    haptic('LIGHT')
    navigate(href)
  }

  return (
    <>
      {data.expensesMissing && (
        <button type="button" class="alert alert--warning press rise" onClick={() => go('/dashboard/expenses')}>
          <span class="alert-icon">
            <Icon svg={icons.creditCard()} />
          </span>
          <span class="alert-text">
            <span class="alert-title">«صافي الربح» لسه ما فيهوش إعلاناتك ولا إيجارك</span>
            <span class="alert-hint">سجّل مصروفاتك عشان الرقم يبقى حقيقي</span>
          </span>
        </button>
      )}

      <div class="an-kpis">
        {data.kpis.map((k, i) => (
          <div key={k.key} class="card an-kpi rise" style={{ animationDelay: `${i * 45}ms` }}>
            <span class="an-kpi-label">{k.label}</span>
            <b class={`an-kpi-value${k.key === 'net' && k.value < 0 ? ' an-kpi-value--neg' : ''}`}>
              {k.money ? formatMoney(k.value, data.currency) : formatNumber(k.value)}
            </b>
            <Delta change={k.change} />
          </div>
        ))}
      </div>

      <RevenueCard series={data.series} currency={data.currency} />
      <FunnelCard funnel={data.funnel} />

      <section class="card sec rise">
        <div class="an-head">
          <b>توزيع الطلبات</b>
        </div>
        {data.statuses.length === 0 ? (
          <p class="an-none">لسه مافيش طلبات.</p>
        ) : (
          <div class="an-meters">
            {data.statuses.map((s, i) => (
              <div key={s.key}>
                <div class="an-meter-top">
                  <span>{s.label}</span>
                  <span>
                    {formatNumber(s.n)} · {formatNumber(s.pct)}%
                  </span>
                </div>
                <div class="an-track">
                  <i style={{ width: `${Math.max(2, s.pct)}%`, background: s.color, animationDelay: `${i * 50}ms` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section class="card sec rise">
        <div class="an-head">
          <b>الأكثر مبيعًا</b>
        </div>
        {data.top.length === 0 ? (
          <p class="an-none">لسه مافيش مبيعات.</p>
        ) : (
          <div class="an-meters">
            {data.top.map((p, i) => (
              <div key={p.name}>
                <div class="an-meter-top">
                  <span>{p.name}</span>
                  <span>{formatNumber(p.sold)} قطعة</span>
                </div>
                <div class="an-track">
                  <i style={{ width: `${Math.max(2, p.pct)}%`, animationDelay: `${i * 50}ms` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div class="an-links rise">
        <button type="button" class="an-link press" onClick={() => go('/dashboard/analytics/live')}>
          <Icon svg={icons.globe()} />
          <span>
            العرض المباشر
            <small>مين على متجرك دلوقتي</small>
          </span>
          <Icon svg={icons.chevronLeft()} className="ic an-chev" />
        </button>
        <button type="button" class="an-link press" onClick={() => go('/dashboard/analytics/reports')}>
          <Icon svg={icons.layers()} />
          <span>
            تقارير مفصّلة
            <small>المبيعات والمنتجات والعملاء بالتفصيل</small>
          </span>
          <Icon svg={icons.chevronLeft()} className="ic an-chev" />
        </button>
        <button type="button" class="an-link press" onClick={() => go('/dashboard/analytics/signal')}>
          <Icon svg={icons.trending()} />
          <span>
            جودة إشارة التحويل
            <small>مبيعاتك بتوصل ميتا وتيك توك كاملة ولا لأ</small>
          </span>
          <Icon svg={icons.chevronLeft()} className="ic an-chev" />
        </button>
      </div>

      <p class="fine center">«صافي الربح» = المبيعات ناقص تكلفة المنتجات والمصروفات المسجّلة.</p>
    </>
  )
}

function RevenueCard({ series, currency }: { series: AnalyticsPayload['series']; currency: string }) {
  const [pick, setPick] = useState(series.length - 1)
  const box = useRef<HTMLDivElement>(null)
  const last = useRef(pick)
  const max = Math.max(1, ...series.map((s) => s.value))
  const total = series.reduce((n, s) => n + s.value, 0)

  const choose = (clientX: number) => {
    const el = box.current
    if (!el || !series.length) return
    const rect = el.getBoundingClientRect()
    const i = Math.max(0, Math.min(series.length - 1, Math.floor(((clientX - rect.left) / rect.width) * series.length)))
    if (i !== last.current) {
      last.current = i
      setPick(i)
      haptic('LIGHT')
    }
  }

  const point = series[pick] ?? series[series.length - 1]

  return (
    <section class="card sec rise">
      <div class="an-head">
        <b>الإيرادات</b>
        <span>آخر ١٤ يوم</span>
      </div>
      {total === 0 || !point ? (
        <p class="an-none">مافيش مبيعات في آخر ١٤ يوم. أول ما تيجي طلبات هتشوفها هنا.</p>
      ) : (
        <>
          <div class="an-pick">
            <b>{formatMoney(point.value, currency)}</b>
            <span class="num">{point.label}</span>
          </div>
          <div
            ref={box}
            class="an-bars"
            onTouchStart={(e) => choose((e as TouchEvent).touches[0].clientX)}
            onTouchMove={(e) => choose((e as TouchEvent).touches[0].clientX)}
            onClick={(e) => choose((e as MouseEvent).clientX)}
          >
            {series.map((s, i) => (
              <span key={s.label} class={`an-bar${i === pick ? ' an-bar--on' : ''}`}>
                <i style={{ height: `${Math.max(2, (s.value / max) * 100)}%`, animationDelay: `${i * 22}ms` }} />
              </span>
            ))}
          </div>
          <div class="an-x">
            <span>{series[0].label}</span>
            <span>{series[series.length - 1].label}</span>
          </div>
          <p class="an-foot">
            إجمالي الأسبوعين: <b>{formatMoney(total, currency)}</b>
          </p>
        </>
      )}
    </section>
  )
}

function FunnelCard({ funnel }: { funnel: AnalyticsPayload['funnel'] }) {
  const visitors = funnel.steps[0]?.value ?? 0
  const orders = funnel.steps[funnel.steps.length - 1]?.value ?? 0
  const top = Math.max(1, visitors)

  return (
    <section class="card sec rise">
      <div class="an-head">
        <b>قُمع التحويل</b>
        {funnel.dayCount > 0 && visitors > 0 && (
          <span>التحويل {((orders / visitors) * 100).toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%</span>
        )}
      </div>
      {funnel.dayCount === 0 ? (
        <p class="an-none">القُمع لسه بيتجمّع — الأرقام بتتحدّث مرة كل يوم، ارجع بكرة.</p>
      ) : (
        <div class="an-meters">
          {funnel.steps.map((s, i) => {
            const prev = i > 0 ? funnel.steps[i - 1].value : 0
            const drop = i > 0 && prev > 0 ? Math.round((1 - s.value / prev) * 100) : null
            return (
              <div key={s.label}>
                <div class="an-meter-top">
                  <span>{s.label}</span>
                  <span>{formatNumber(s.value)}</span>
                </div>
                <div class="an-track">
                  <i style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, animationDelay: `${i * 60}ms` }} />
                </div>
                {drop !== null && drop > 0 && <span class="an-drop">وقع {formatNumber(drop)}% من الخطوة اللي قبلها</span>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
