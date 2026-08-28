import Link from 'next/link'
import { AlertTriangle, Clock, Crown } from 'lucide-react'

/**
 * شريط حالة الاشتراك — أول حاجة في الصفحة الرئيسية.
 *
 * ## ليه بالرقم لا بالكلام
 * «اشترك عشان تفتح المميزات» إعلان بيتقرا ويتنسي. «متبقّي لك ٣
 * طلبات» حقيقة عن متجره هو، والرقم بينقص قدام عينه كل ما يبيع —
 * فالتاجر عارف بالظبط هو فين قبل ما يقف، مش بعد ما عميل يقوله
 * «مش عارف أطلب».
 *
 * ## بيختفي لما ما يبقاش مهمًّا
 * المشترك ما بيشوفوش خالص، وصاحب التجربة ما بيشوفهوش غير في آخر
 * يومين. الشريط الدايم بيتحوّل لخلفية بعد يومين وبيبطّل يتقرا.
 */
export function QuotaBanner({
  used,
  limit,
  blocked,
  expired,
  trialDaysLeft,
}: {
  used: number
  limit: number | null
  blocked: boolean
  expired?: boolean
  trialDaysLeft?: number
}) {
  const left = limit === null ? null : Math.max(0, limit - used)

  const danger = blocked
  const tone = danger
    ? {
        border: 'var(--color-danger)',
        bg: 'var(--color-danger-soft)',
        fg: 'var(--color-danger)',
        icon: AlertTriangle,
      }
    : {
        border: 'var(--color-warning)',
        bg: 'var(--color-warning-soft)',
        fg: 'var(--color-warning)',
        icon: trialDaysLeft !== undefined ? Clock : Crown,
      }

  const Icon = tone.icon

  /* التجربة على وشك تخلص — رسالة مختلفة تمامًا عن حدّ الطلبات */
  if (trialDaysLeft !== undefined) {
    return (
      <Shell tone={tone} alert={false}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tone.fg }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: tone.fg }}>
            {trialDaysLeft <= 0
              ? 'تجربتك المجانية بتنتهي النهاردة'
              : `متبقّي لك ${trialDaysLeft} يوم في التجربة المجانية`}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: tone.fg, opacity: 0.85 }}>
            بعدها الطلبات بترجع محدودة، وأدوات الذكاء وصفحات الهبوط والنطاق بيتقفلوا. اشترك
            دلوقتي وكمّل من غير ما يقف عندك حاجة.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell tone={tone} alert={blocked}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tone.fg }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold" style={{ color: tone.fg }}>
          {blocked
            ? 'متجرك وقف عن استقبال الطلبات'
            : left !== null
              ? `متبقّي لك ${left} ${left === 1 ? 'طلب' : 'طلبات'} فقط`
              : expired
                ? 'اشتراكك انتهى'
                : 'إنت على الباقة المجانية'}
        </p>
        <p className="mt-0.5 text-sm" style={{ color: tone.fg, opacity: 0.85 }}>
          {blocked ? (
            <>
              وصلت {used} من {limit} طلب — أي طلب جديد بيترفض. اشترك وخلّي الطلبات غير محدودة.
            </>
          ) : (
            <>
              اشترك وخلّي الطلبات غير محدودة، وافتح أدوات الذكاء وصفحات الهبوط ونطاقك الخاص.
            </>
          )}
        </p>
      </div>
    </Shell>
  )
}

function Shell({
  tone,
  alert,
  children,
}: {
  tone: { border: string; bg: string; fg: string }
  alert: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      style={{ borderColor: tone.border, background: tone.bg }}
      role={alert ? 'alert' : undefined}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">{children}</div>

      <Link
        href="/dashboard/subscription"
        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 sm:w-auto"
        style={{ background: tone.fg }}
      >
        <Crown className="h-4 w-4" aria-hidden="true" />
        اشترك دلوقتي
      </Link>
    </div>
  )
}
