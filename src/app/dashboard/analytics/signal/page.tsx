import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Radio } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { signalQuality } from '@/lib/signal-quality'
import { capiConfigured } from '@/lib/capi'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

export const metadata = { title: 'جودة إشارة التحويل' }
export const dynamic = 'force-dynamic'

export default async function SignalPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'reports.view')

  const [snap, configured] = await Promise.all([
    signalQuality(store.id),
    capiConfigured(store.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="جودة إشارة التحويل"
        description="قد إيه مبيعاتك بتوصل ميتا وتيك توك كاملة. الرقم ده بيحدّد إعلانك بيتحسّن على مين."
      />

      {/* ────────── مش مربوط ────────── */}
      {!configured && (
        <Reveal>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-[var(--color-warning)]">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              مبيعاتك مش بتوصل ميتا
            </h2>
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-[var(--fg-muted)]">
              <p>
                البكسل لوحده بيقول لميتا مين <strong>فتح</strong> متجرك. عشان تقول لها مين{' '}
                <strong>اشترى</strong>، محتاج توكن واجهة التحويلات كمان — من غيره الخوارزمية بتحسّن
                على اللي بيتفرّج لا اللي بيدفع، وده بياكل ميزانيتك على أسوأ جمهور ممكن.
              </p>
              <p>
                والحدث من الخادم بيعدّي حتى لو مانع الإعلانات أو iOS وقّفوا البكسل في متصفح العميل —
                وده جزء كبير من زوّارك.
              </p>
            </div>
            <Link
              href="/dashboard/plugins"
              className="flex h-11 w-fit items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
            >
              اربط التوكن من صفحة الإضافات
            </Link>
          </Card>
        </Reveal>
      )}

      {/* ────────── الدرجة ────────── */}
      <Reveal delay={40}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              درجة الإشارة
            </span>
            <span
              className={cn(
                'tabular text-2xl font-bold',
                snap.score === null
                  ? 'text-[var(--fg-subtle)]'
                  : snap.score >= 7
                    ? 'text-[var(--color-success)]'
                    : snap.score >= 4
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-danger)]',
              )}
            >
              {snap.score === null ? '—' : `${snap.score} / 10`}
            </span>
          </Card>

          <Stat label="طلبات آخر ٧ أيام" value={String(snap.purchases)} />
          <Stat
            label="وصلت للمنصات"
            value={String(snap.delivered)}
            tone={snap.purchases > 0 && snap.delivered === 0 ? 'danger' : undefined}
          />
          <Stat label="متوسط مفاتيح المطابقة" value={`${snap.avgMatchKeys} / 7`} />
        </div>
      </Reveal>

      {snap.purchases === 0 ? (
        <Reveal delay={80}>
          <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Radio className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مفيش طلبات في آخر ٧ أيام</h2>
            <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
              الشاشة دي بتتملي مع كل طلب. أول طلب هيوريك كام مفتاح مطابقة خرج معاه، وإذا كان وصل
              ميتا ولا لأ.
            </p>
          </Card>
        </Reveal>
      ) : (
        <>
          {/* ────────── تغطية المفاتيح ────────── */}
          <Reveal delay={80}>
            <Card className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-semibold">مفاتيح المطابقة</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--fg-muted)]">
                  ميتا بتطابق طلبك بحساب العميل عندها بالمفاتيح دي. كل مفتاح ناقص = عملاء أقل
                  بيتطابقوا = جمهور مشابه أضعف.
                </p>
              </div>

              <ul className="flex flex-col gap-3">
                {snap.coverage.map((c) => (
                  <li key={c.key} className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 font-medium">{c.label}</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <span
                          className={cn(
                            'block h-full rounded-full transition-[width]',
                            c.pct >= 80
                              ? 'bg-[var(--color-success)]'
                              : c.pct >= 40
                                ? 'bg-[var(--color-warning)]'
                                : 'bg-[var(--color-danger)]',
                          )}
                          style={{ width: `${c.pct}%` }}
                        />
                      </span>
                      <span className="tabular w-12 shrink-0 text-end text-xs font-semibold">
                        {c.pct}%
                      </span>
                    </div>
                    {c.pct < 80 && (
                      <p className="ps-24 text-xs leading-relaxed text-[var(--fg-subtle)]">
                        {c.hint}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          {/* ────────── التسليم ────────── */}
          <Reveal delay={120}>
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-semibold">التسليم</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                <Pill
                  icon={CheckCircle2}
                  label={`${snap.delivered} وصلت`}
                  tone={snap.delivered > 0 ? 'success' : 'muted'}
                />
                {snap.skipped > 0 && <Pill label={`${snap.skipped} اتخطّت — المتجر مش مربوط`} tone="muted" />}
                {snap.failed > 0 && (
                  <Pill icon={AlertTriangle} label={`${snap.failed} فشلت`} tone="danger" />
                )}
              </div>

              {snap.errors.length > 0 && (
                <>
                  {/*
                    رسالة المنصة زي ما هي — مش مترجمة ولا مبسّطة.

                    التاجر بينسخها ويبعتها لدعم ميتا، أو بيلزقها في
                    بحث. الترجمة كانت هتخلّيها مالهاش نتايج.
                  */}
                  <ul className="flex flex-col gap-1.5">
                    {snap.errors.map((e) => (
                      <li
                        key={e.message}
                        className="flex flex-wrap items-start gap-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-xs"
                      >
                        <span className="tabular shrink-0 font-semibold text-[var(--color-danger)]">
                          ×{e.count}
                        </span>
                        <code dir="ltr" className="min-w-0 flex-1 break-all text-start">
                          {e.message}
                        </code>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </Reveal>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger'
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span
        className={cn('tabular text-2xl font-bold', tone === 'danger' && 'text-[var(--color-danger)]')}
      >
        {value}
      </span>
    </Card>
  )
}

function Pill({
  icon: Icon,
  label,
  tone,
}: {
  icon?: typeof CheckCircle2
  label: string
  tone: 'success' | 'danger' | 'muted'
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
        tone === 'success' && 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
        tone === 'danger' && 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
        tone === 'muted' && 'bg-[var(--surface-2)] text-[var(--fg-muted)]',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  )
}
