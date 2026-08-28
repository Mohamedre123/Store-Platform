import Link from 'next/link'
import { AlertTriangle, Clock, Crown } from 'lucide-react'

/**
 * شريط حالة الاشتراك على الصفحة الرئيسية.
 *
 * تلات حالات بترتيب الإلحاح: المتجر واقف عن استقبال الطلبات، قرّب
 * يقف، أو التجربة على وشك تنتهي. اللي مش في واحدة منهم ما بيشوفش
 * الشريط أصلًا — الشريط الدائم بيتحوّل لخلفية بعد يومين وبيتقفل
 * عليه في الحالة اللي بيهمّ فيها فعلًا.
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
  const tone = blocked
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

  const title = blocked
    ? 'متجرك وقف عن استقبال الطلبات'
    : trialDaysLeft !== undefined
      ? trialDaysLeft <= 0
        ? 'تجربتك المجانية بتنتهي النهاردة'
        : `فاضل ${trialDaysLeft} يوم على انتهاء تجربتك`
      : expired
        ? 'اشتراكك انتهى'
        : 'متجرك على الباقة المجانية'

  const body = blocked
    ? `وصلت ${used} من ${limit} طلب. أي طلب جديد بيترفض لحد ما تشترك.`
    : trialDaysLeft !== undefined
      ? 'بعدها أدوات الذكاء وصفحات الهبوط والنطاق بتتقفل، والطلبات بتتحدّد.'
      : limit !== null
        ? `استقبلت ${used} من ${limit} طلب. بعدهم المتجر بيقف عن الاستقبال لحد ما تشترك.`
        : 'اشترك عشان تفتح كل المميزات.'

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      style={{ borderColor: tone.border, background: tone.bg }}
      role={blocked ? 'alert' : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tone.fg }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: tone.fg }}>
            {title}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: tone.fg, opacity: 0.85 }}>
            {body}
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/subscription"
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: tone.fg }}
      >
        <Crown className="h-4 w-4" aria-hidden="true" />
        اشترك دلوقتي
      </Link>
    </div>
  )
}
