import Link from 'next/link'
import { ArrowLeft, CalendarDays, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * كارت الاشتراك.
 *
 * ## الحلقة بتقول المدة من غير قراية
 * الرقم جوّه حلقة بتفضى مع الأيام. التاجر بيبصّ بصّة وبيعرف هو فين —
 * والسطر «٣ أيام حتى التجديد» بيتقرا بعدها لا قبلها.
 *
 * ## واللون بيتغيّر لما الوقت يضيق
 * أخضر، فبرتقالي في آخر خمس أيام، فأحمر في آخر يومين. لو اللون واحد
 * دايمًا، التنبيه بيبقى زخرفة والتاجر بيصحى على متجر مقفول.
 */
export function PlanCard({
  planLabel,
  onTrial,
  daysLeft,
  startedAt,
  endsAt,
  /** الطول الكامل للفترة بالأيام — الحلقة بتتحسب منه */
  periodDays,
  expired,
  isAdmin,
}: {
  planLabel: string
  onTrial: boolean
  daysLeft: number | null
  startedAt: Date | null
  endsAt: Date | null
  periodDays: number
  expired: boolean
  /** حساب الإدارة — مفيش اشتراك ولا عدّاد */
  isAdmin: boolean
}) {
  if (isAdmin) return null

  const days = daysLeft ?? 0
  const tone = expired || days <= 2 ? 'danger' : days <= 5 ? 'warning' : 'success'

  const colors = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
  } as const

  /* النسبة الباقية — مقصوصة بين ٠ و١ عشان فترة متجدّدة ما تلفّش الحلقة */
  const ratio = periodDays > 0 ? Math.min(1, Math.max(0, days / periodDays)) : 0
  const circumference = 2 * Math.PI * 22

  return (
    <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
              الخطة الحالية
            </span>
            {onTrial && (
              <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                تجربة
              </span>
            )}
            {(expired || days <= 3) && (
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
              >
                {expired ? 'انتهى' : 'قرّب يخلص'}
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold tracking-tight">{planLabel}</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            {expired
              ? 'اشتراكك خلص — جدّد عشان تفتح المميزات تاني.'
              : `${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'} حتى التجديد`}
          </p>
        </div>

        {/* الحلقة */}
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="4"
            />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke={colors[tone]}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
            />
          </svg>
          <span className="absolute flex flex-col items-center leading-none">
            <span className="tabular text-base font-bold">{days}</span>
            <span className="text-[9px] text-[var(--fg-subtle)]">يوم</span>
          </span>
        </span>
      </div>

      {(startedAt || endsAt) && (
        <div className="grid grid-cols-2 gap-2">
          <DateChip icon={CalendarDays} label="بدأ في" value={startedAt} />
          <DateChip icon={Clock} label="ينتهي في" value={endsAt} tone={tone} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/subscription"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
        >
          {expired ? 'جدّد الاشتراك' : 'إدارة الاشتراك'}
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/dashboard/subscription"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
        >
          الفواتير والسجل
        </Link>
      </div>
    </section>
  )
}

function DateChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock
  label: string
  value: Date | null
  tone?: 'success' | 'warning' | 'danger'
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5">
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--fg-subtle)]',
        )}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-[11px] text-[var(--fg-subtle)]">{label}</span>
        <span className="block truncate text-sm font-medium">
          {value ? formatDate(value) : '—'}
        </span>
      </span>
    </div>
  )
}
