import { AlertTriangle, ShieldCheck, ShieldQuestion, Sparkles } from 'lucide-react'
import { TRUST_META, type TrustScore } from '@/lib/trust-score'

const ICONS = {
  new: Sparkles,
  good: ShieldCheck,
  watch: ShieldQuestion,
  risky: AlertTriangle,
} as const

/**
 * وسم ثقة العميل.
 *
 * ## `compact` للقايمة و`full` لصفحة الطلب
 * في القايمة التاجر بيمسح بعينه ١٠٠ صف — عايز إشارة لون وكلمة،
 * وخلاص. وفي صفحة الطلب هو واقف قدام قرار «أشحن ولا أتصل الأول»،
 * فعايز الأرقام اللي بنى عليها الحكم.
 *
 * والعميل الجديد ما بيتوسمش في القايمة: أغلب الطلبات من عملاء جدد،
 * فوسم على كل صف بيبقى ضجيج بيخفي التحذير الحقيقي لما يظهر.
 */
export function TrustBadge({ trust, compact }: { trust: TrustScore; compact?: boolean }) {
  const meta = TRUST_META[trust.level]
  const Icon = ICONS[trust.level]

  if (compact) {
    if (trust.level === 'new') return null
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
        style={{ background: meta.bg, color: meta.fg }}
        title={trust.reasons.join(' · ')}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {trust.level === 'risky' ? 'خطر' : meta.label}
      </span>
    )
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-4"
      style={{ borderColor: meta.fg + '55', background: meta.bg }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold" style={{ color: meta.fg }}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {meta.label}
        </span>

        {trust.score !== null && (
          <span className="tabular text-sm font-bold" style={{ color: meta.fg }}>
            {trust.score}٪ ثقة
          </span>
        )}
      </div>

      {trust.reasons.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {trust.reasons.map((r) => (
            <li
              key={r}
              className="flex items-start gap-1.5 text-xs leading-relaxed"
              style={{ color: meta.fg, opacity: 0.9 }}
            >
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                style={{ background: meta.fg }}
                aria-hidden="true"
              />
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: meta.fg, opacity: 0.9 }}>
          أول طلب من الرقم ده — مفيش سجل نحكم بيه.
        </p>
      )}

      {/*
        السطر ده بيقول للتاجر إن الأرقام مجمّعة.

        من غيره ممكن يفتكر إننا بنوريه عملاء متاجر تانية بالاسم —
        وده بيخوّفه على بياناته هو قبل ما يطمّنه على عملائه.
      */}
      {trust.network.stores > 0 && (
        <p className="text-[11px]" style={{ color: meta.fg, opacity: 0.7 }}>
          أرقام المنصة مجمّعة — من غير أي بيانات عن المتاجر التانية.
        </p>
      )}
    </div>
  )
}
