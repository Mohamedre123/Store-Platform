/**
 * الشاشة الرئيسية — أول شاشة أصلية في التطبيق.
 *
 * نفس محتوى رئيسية اللوحة بالظبط (نفس الأرقام من نفس الاستعلامات عبر
 * `/api/app/home`)، لكن مرسومة كتطبيق: بتفتح فورًا من آخر بيانات،
 * هيدر بيصغر مع التمرير، رسم بالإصبع، كروت بالسحب، وسحب للتحديث من
 * غير ما الصفحة تتحمّل من أول.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { assetUrl, fetchHome, readHomeCache, type HomePayload } from './api'
import { HeroChart } from './chart'
import { daysWord, formatBps, formatMoney, formatNumber, greeting, initials, pctChange, timeAgo } from './format'
import { navigate, openExternal } from './navigate'
import { Delta, Icon, Ring, SectionHead, Sparkline } from './ui'

const SETUP_ICONS = {
  product: icons.package,
  logo: icons.palette,
  shipping: icons.truck,
  payment: icons.creditCard,
  theme: icons.image,
  publish: icons.bag,
}

/* نفس ألوان `ORDER_STATUSES` في المنصة */
const STATUS_COLORS: Record<string, [string, string]> = {
  incomplete: ['var(--color-warning-soft)', 'var(--color-warning)'],
  pending: ['var(--color-info-soft)', 'var(--color-info)'],
  confirmed: ['var(--primary-soft)', 'var(--primary)'],
  processing: ['var(--primary-soft)', 'var(--primary)'],
  shipped: ['var(--color-info-soft)', 'var(--color-info)'],
  delivered: ['var(--color-success-soft)', 'var(--color-success)'],
  cancelled: ['var(--color-danger-soft)', 'var(--color-danger)'],
  returned: ['var(--color-danger-soft)', 'var(--color-danger)'],
}

export function Home({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const cached = useMemo(() => readHomeCache(), [])
  const [data, setData] = useState<HomePayload | null>(cached?.data ?? null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.at ?? null)
  const [failed, setFailed] = useState(false)
  const [compact, setCompact] = useState(false)
  const busy = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const res = await fetchHome()
    busy.current = false
    if (res.kind === 'ok') {
      setData(res.data)
      setUpdatedAt(res.at)
      setFailed(false)
    } else if (res.kind === 'unavailable') {
      onUnavailable()
    } else if (res.kind === 'unauthorized') {
      setData(null)
    } else {
      setFailed(true)
    }
  }, [onUnavailable])

  /* تحديث هادي كل ما الشاشة تظهر وبياناتها أقدم من نص دقيقة */
  useEffect(() => {
    if (!visible) return
    if (!updatedAt || failed || Date.now() - updatedAt > 30_000) void load()
  }, [visible])

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && visible && (!updatedAt || Date.now() - updatedAt > 60_000)) void load()
    }
    const toTop = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('zw:home-top', toTop)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('zw:home-top', toTop)
    }
  }, [visible, updatedAt, load])

  /*
    السحب للتحديث جوّه الشاشة نفسها.

    بيحدّث البيانات بس — مش الصفحة. التحديث بيخلص في أقل من ثانية
    والتمرير ما بيرجعش لأوله، زي أي تطبيق.
  */
  useEffect(() => {
    const el = scroller.current
    const ind = indicator.current
    if (!el || !ind) return
    let startY = 0
    let tracking = false
    let armed = false
    let refreshing = false
    let dist = 0

    const paint = () => {
      ind.style.opacity = String(Math.min(1, dist / 36))
      ind.style.transform = `translate3d(-50%, ${dist - 48}px, 0) rotate(${dist * 3}deg)`
    }
    const onStart = (e: TouchEvent) => {
      if (refreshing || el.scrollTop > 0 || e.touches.length !== 1) return
      tracking = true
      armed = false
      dist = 0
      startY = e.touches[0].clientY
      ind.classList.remove('hptr--settle')
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || el.scrollTop > 0) {
        if (dist) {
          dist = 0
          paint()
        }
        return
      }
      dist = Math.min(112, dy * 0.5)
      paint()
      if (dist >= 70 && !armed) {
        armed = true
        haptic('MEDIUM')
      } else if (dist < 62) armed = false
    }
    const onEnd = async () => {
      if (!tracking) return
      tracking = false
      ind.classList.add('hptr--settle')
      if (!armed) {
        dist = 0
        paint()
        return
      }
      refreshing = true
      ind.classList.add('hptr--spin')
      dist = 66
      paint()
      await load()
      refreshing = false
      ind.classList.remove('hptr--spin')
      dist = 0
      paint()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [load])

  return (
    <div class={`home${visible ? '' : ' home--hidden'}`} aria-hidden={!visible}>
      <div class={`home-bar${compact ? ' home-bar--on' : ''}`}>{data?.store.name ?? 'زاوية'}</div>
      <div ref={indicator} class="hptr" aria-hidden="true">
        <Icon svg={icons.refresh()} />
      </div>
      <div
        ref={scroller}
        class="home-scroll"
        onScroll={(e) => {
          const next = (e.currentTarget as HTMLElement).scrollTop > 64
          if (next !== compact) setCompact(next)
        }}
      >
        {data ? (
          <HomeContent data={data} updatedAt={updatedAt} failed={failed} />
        ) : failed ? (
          <ErrorState onRetry={() => void load()} />
        ) : (
          <Skeleton />
        )}
      </div>
    </div>
  )
}

function HomeContent({ data, updatedAt, failed }: { data: HomePayload; updatedAt: number | null; failed: boolean }) {
  const { store, subscription: sub, counts, stats } = data
  const currency = store.currency
  let order = 0
  const rise = () => ({ animationDelay: `${order++ * 45}ms` })

  const doneCount = data.setup.filter((s) => s.done).length
  const nextStep = data.setup.find((s) => !s.done)
  const firstName = (data.user.name ?? '').trim().split(/\s+/)[0]

  const tiles = [
    {
      label: 'المبيعات',
      value: formatMoney(stats.current.revenue, currency),
      change: pctChange(stats.current.revenue, stats.previous.revenue),
      spark: stats.series.map((d) => d.revenue),
      href: '/dashboard/analytics',
    },
    {
      label: 'الطلبات',
      value: formatNumber(stats.current.orders),
      change: pctChange(stats.current.orders, stats.previous.orders),
      spark: stats.series.map((d) => d.orders),
      href: '/dashboard/orders',
    },
    {
      label: 'الزيارات',
      value: formatNumber(stats.current.sessions),
      change: pctChange(stats.current.sessions, stats.previous.sessions),
      spark: stats.series.map((d) => d.sessions),
      href: '/dashboard/analytics',
    },
    {
      label: 'معدل التحويل',
      value: formatBps(stats.current.conversionBps),
      change: pctChange(stats.current.conversionBps, stats.previous.conversionBps),
      spark: stats.series.map((d) => d.conversion),
      href: '/dashboard/analytics',
    },
  ]

  const quotaLeft = sub.quota.limit === null ? null : Math.max(0, sub.quota.limit - sub.quota.used)
  const days = sub.daysLeft ?? 0
  const planTone =
    sub.expired || days <= 2 ? 'var(--color-danger)' : days <= 5 ? 'var(--color-warning)' : 'var(--color-success)'

  return (
    <div class="home-body">
      <header class="h-top rise" style={rise()}>
        <div class="h-ident">
          <span class="h-logo">
            {store.logo ? <img src={assetUrl(store.logo) ?? ''} alt="" /> : initials(store.name)}
          </span>
          <div class="h-names">
            <p class="h-hello">
              {greeting()}
              {firstName ? `، ${firstName}` : ''}
            </p>
            <h1 class="h-title">{store.name}</h1>
          </div>
        </div>
        <button type="button" class="icon-btn press" aria-label="زيارة المتجر" onClick={() => openExternal(store.url)}>
          <Icon svg={icons.externalLink()} />
        </button>
      </header>

      {/* الاشتراك — قبل أي حاجة: الحد اللي بيوقف الطلبات لازم يوصل قبل ما يقف */}
      {!sub.active && (
        <div class="rise" style={rise()}>
          <Alert
            tone={sub.quota.blocked ? 'danger' : 'warning'}
            icon={sub.quota.blocked ? icons.alert() : icons.crown()}
            title={
              sub.quota.blocked
                ? 'متجرك وقف عن استقبال الطلبات'
                : quotaLeft !== null
                  ? `متبقّي لك ${formatNumber(quotaLeft)} ${quotaLeft === 1 ? 'طلب' : 'طلبات'} فقط`
                  : sub.expired
                    ? 'اشتراكك انتهى'
                    : 'إنت على الباقة المجانية'
            }
            hint={
              sub.quota.blocked
                ? `وصلت ${formatNumber(sub.quota.used)} من ${formatNumber(sub.quota.limit ?? 0)} طلب — اشترك وخلّي الطلبات غير محدودة.`
                : 'اشترك وخلّي الطلبات غير محدودة، وافتح أدوات الذكاء ونطاقك الخاص.'
            }
            onClick={() => navigate('/dashboard/subscription')}
          />
        </div>
      )}

      {sub.active && sub.onTrial && sub.daysLeft !== null && sub.daysLeft <= 2 && (
        <div class="rise" style={rise()}>
          <Alert
            tone="warning"
            icon={icons.clock()}
            title={
              sub.daysLeft <= 0
                ? 'تجربتك المجانية بتنتهي النهاردة'
                : `متبقّي لك ${daysWord(sub.daysLeft)} في التجربة المجانية`
            }
            hint="اشترك دلوقتي وكمّل من غير ما يقف عندك حاجة."
            onClick={() => navigate('/dashboard/subscription')}
          />
        </div>
      )}

      {!store.published && (
        <div class="rise" style={rise()}>
          <Alert
            tone="warning"
            icon={icons.eyeOff()}
            title="متجرك لسه مش منشور"
            hint="العملاء مش هيقدروا يطلبوا منه لحد ما تنشره."
            onClick={() => navigate('/dashboard/storefront')}
          />
        </div>
      )}

      {data.notices.map((notice) => (
        <div key={notice.id} class="rise" style={rise()}>
          <Notice notice={notice} />
        </div>
      ))}

      {nextStep && (
        <section class="card setup rise" style={rise()}>
          <div class="setup-top">
            <Ring ratio={doneCount / data.setup.length} tone="var(--primary)">
              {formatNumber(doneCount)}/{formatNumber(data.setup.length)}
            </Ring>
            <div class="setup-copy">
              <span class="badge">
                <Icon svg={icons.sparkles()} /> دليل الإعداد
              </span>
              <h3>لنجهّز متجرك للانطلاق</h3>
              <p>فاضل {formatNumber(data.setup.length - doneCount)} خطوة وتبقى جاهز تستقبل أول طلب.</p>
            </div>
          </div>
          <button type="button" class="setup-next press" onClick={() => navigate(nextStep.href)}>
            <span class="setup-next-icon">
              <Icon svg={SETUP_ICONS[nextStep.icon]()} />
            </span>
            <span class="setup-next-text">
              <b>{nextStep.label}</b>
              <small>{nextStep.hint}</small>
            </span>
            <Icon svg={icons.chevronLeft()} className="chev" />
          </button>
          <div class="chips">
            {data.setup
              .filter((s) => s.key !== nextStep.key)
              .map((s) => (
                <button
                  key={s.key}
                  type="button"
                  class={`chip press${s.done ? ' chip--done' : ''}`}
                  onClick={() => navigate(s.href)}
                >
                  <Icon svg={(s.done ? icons.check : SETUP_ICONS[s.icon])()} />
                  {s.label}
                </button>
              ))}
          </div>
        </section>
      )}

      <div class="rise" style={rise()}>
        <HeroChart series={stats.series} current={stats.current} previous={stats.previous} currency={currency} />
      </div>

      <div class="rail rise" style={rise()}>
        {tiles.map((t) => (
          <button key={t.label} type="button" class="tile press" onClick={() => navigate(t.href)}>
            <span class="tile-label">{t.label} · ١٤ يوم</span>
            <span class="tile-value">{t.value}</span>
            <span class="tile-foot">
              <Delta change={t.change} />
              <Sparkline points={t.spark} />
            </span>
          </button>
        ))}
      </div>

      {(counts.pending > 0 || counts.incomplete > 0) && (
        <div class="stack rise" style={rise()}>
          {counts.pending > 0 && (
            <Alert
              tone="default"
              icon={icons.package()}
              title={`${formatNumber(counts.pending)} طلب مستني تأكيدك`}
              hint="أكّدهم عشان يتشحنوا"
              onClick={() => navigate('/dashboard/orders?filter=pending')}
            />
          )}
          {counts.incomplete > 0 && (
            <Alert
              tone="warning"
              icon={icons.users()}
              title={`${formatNumber(counts.incomplete)} سلة متروكة`}
              hint="كلّمهم على واتساب — أسرع فلوس ترجّعها"
              onClick={() => navigate('/dashboard/orders?filter=incomplete')}
            />
          )}
        </div>
      )}

      <div class="rise" style={rise()}>
        <SectionHead title="اختصارات" />
        <div class="quick">
          {[
            { label: 'ضيف منتج', icon: icons.plus(), run: () => navigate('/dashboard/products/new') },
            { label: 'سجّل طلب', icon: icons.bag(), run: () => navigate('/dashboard/orders/new') },
            { label: 'شكل المتجر', icon: icons.palette(), run: () => navigate('/dashboard/storefront') },
            { label: 'زيارة المتجر', icon: icons.globe(), run: () => openExternal(store.url) },
          ].map((q) => (
            <button key={q.label} type="button" class="press" onClick={q.run}>
              <span class="qi">
                <Icon svg={q.icon} />
              </span>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {!sub.isAdmin && (
        <button type="button" class="card plan press rise" style={rise()} onClick={() => navigate('/dashboard/subscription')}>
          <Ring ratio={sub.periodDays > 0 ? days / sub.periodDays : 0} tone={planTone} size={52}>
            <Icon svg={icons.crown()} />
          </Ring>
          <span class="plan-text">
            <span class="plan-label">الخطة الحالية{sub.onTrial ? ' · تجربة' : ''}</span>
            <b>{sub.planName}</b>
            <small>
              {sub.expired
                ? 'اشتراكك خلص — جدّد عشان تفتح المميزات تاني'
                : sub.daysLeft === null
                  ? 'من غير ميعاد تجديد'
                  : `${daysWord(days)} حتى التجديد`}
            </small>
          </span>
          <Icon svg={icons.chevronLeft()} className="chev" />
        </button>
      )}

      {data.latestOrders.length > 0 && (
        <div class="rise" style={rise()}>
          <SectionHead title="آخر الطلبات" action="كلها" onAction={() => navigate('/dashboard/orders')} />
          <div class="card list">
            {data.latestOrders.map((o) => {
              const [bg, fg] = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending
              return (
                <button key={o.id} type="button" class="row" onClick={() => navigate(`/dashboard/orders/${o.id}`)}>
                  <span class="avatar">{initials(o.name)}</span>
                  <span class="row-main">
                    <span class="row-title">{o.name || 'بلا اسم'}</span>
                    <span class="row-sub">
                      <span class="num">#{o.number}</span>
                      <span class="pill" style={{ background: bg, color: fg }}>
                        {o.statusLabel}
                      </span>
                    </span>
                  </span>
                  <span class="row-end">{formatMoney(o.total, currency)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {data.topProducts.length > 0 && (
        <div class="rise" style={rise()}>
          <SectionHead title="الأكتر مبيعًا · آخر ٣٠ يوم" />
          <div class="card list">
            {data.topProducts.map((p, i) => (
              <div key={p.productId ?? p.name} class="row">
                <span class="thumb">
                  {p.image ? <img src={assetUrl(p.image) ?? ''} alt="" loading="lazy" /> : <Icon svg={icons.package()} />}
                  <span class="rank">{formatNumber(i + 1)}</span>
                </span>
                <span class="row-main">
                  <span class="row-title">{p.name}</span>
                  <span class="row-sub">{formatNumber(p.sold)} مبيع</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p class="home-foot rise" style={rise()}>
        عندك {formatNumber(counts.products)} منتج نشط و{formatNumber(counts.customers)} عميل مسجّل.
        {updatedAt !== null && (
          <span class={`updated${failed ? ' updated--stale' : ''}`}>
            {failed ? 'مش قادرين نحدّث دلوقتي — آخر بيانات ' : 'آخر تحديث '}
            {timeAgo(updatedAt)}
          </span>
        )}
      </p>
    </div>
  )
}

function Alert({
  tone,
  icon,
  title,
  hint,
  onClick,
}: {
  tone: 'default' | 'warning' | 'danger'
  icon: string
  title: string
  hint?: string
  onClick?: () => void
}) {
  return (
    <button type="button" class={`alert alert--${tone} press`} onClick={onClick}>
      <span class="alert-icon">
        <Icon svg={icon} />
      </span>
      <span class="alert-text">
        <span class="alert-title">{title}</span>
        {hint && <span class="alert-hint">{hint}</span>}
      </span>
      <Icon svg={icons.chevronLeft()} className="chev" />
    </button>
  )
}

function Notice({ notice }: { notice: HomePayload['notices'][number] }) {
  const icon = notice.tone === 'offer' ? icons.gift() : notice.tone === 'praise' ? icons.sparkles() : icons.bell()
  const reward = notice.rewardKind === 'free_days'
  const label = notice.redeemed ? 'تمّت ✓' : reward ? notice.ctaLabel ?? 'فعّل المكافأة' : notice.ctaLabel

  const act = () => {
    if (notice.redeemed) return
    /* تفعيل المكافأة فعل على الخادم — بيتعمل من كارت المنصة نفسه */
    if (reward) return navigate('/dashboard?web=1')
    if (!notice.ctaHref) return
    if (notice.ctaHref.startsWith('/')) navigate(notice.ctaHref)
    else openExternal(notice.ctaHref)
  }

  return (
    <section class={`card notice notice--${notice.tone}`}>
      <span class="notice-icon">
        <Icon svg={icon} />
      </span>
      <div class="notice-text">
        <b>{notice.title}</b>
        <p>{notice.body}</p>
        {label && (reward || notice.ctaHref) && (
          <button type="button" class="notice-cta press" disabled={notice.redeemed} onClick={act}>
            {label}
          </button>
        )}
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <div class="home-body" aria-busy="true" aria-label="جاري تحميل متجرك">
      <div class="h-top">
        <div class="h-ident">
          <span class="sk" style="width:48px;height:48px;border-radius:16px" />
          <div>
            <span class="sk" style="display:block;width:96px;height:12px" />
            <span class="sk" style="display:block;width:170px;height:24px;margin-top:8px" />
          </div>
        </div>
      </div>
      <div class="sk" style="height:250px;border-radius:22px" />
      <div class="rail">
        {[0, 1, 2].map((i) => (
          <span key={i} class="sk tile" style="height:112px;border:0" />
        ))}
      </div>
      <div class="sk" style="height:72px;margin-top:16px;border-radius:18px" />
      <div class="sk" style="height:280px;margin-top:16px;border-radius:22px" />
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div class="home-empty">
      <span class="home-empty-icon">
        <Icon svg={icons.wifiOff()} />
      </span>
      <b>مش قادرين نجيب بيانات متجرك</b>
      <p>اتأكد من النت وجرّب تاني.</p>
      <button type="button" class="setup-next press" style="justify-content:center" onClick={onRetry}>
        حاول تاني
      </button>
    </div>
  )
}
