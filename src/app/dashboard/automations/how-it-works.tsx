import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Plug, Zap } from 'lucide-react'
import { Card } from '@/components/ui'

/**
 * شرح «الأتمتة دي بتشتغل إزاي».
 *
 * ## ليه موجود
 * الصفحة كانت بتفتح على مُنشئ قواعد فاضي. التاجر اللي شايف «لما
 * يحصل كذا، اعمل كذا» لأول مرة مش عارف يبدأ منين، ولا إن في قواعد
 * جاهزة تحت، ولا إن إجراءات الواتساب محتاجة ربط قبلها.
 *
 * ## تنبيه الواتساب أهم حتّة
 * القاعدة اللي إجراؤها واتساب بتتحفظ عادي وبتفضل «مفعّلة» — وما
 * بتبعتش. من غير التنبيه ده، التاجر بيبني القاعدة ويستنى، وبعد
 * أسبوع يكتشف إن ولا رسالة خرجت. عشان كده بنقوله قبل ما يبني
 * لا بعدها، والحالة بتتقرا من ربطه الحقيقي مش تحذير عام.
 */
export function HowItWorks({ whatsappReady }: { whatsappReady: boolean }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Zap className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold">بتشتغل إزاي؟</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            تلات خطوات، وبعدها المنصة بتشتغل عنك من غير ما تفتحها.
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {[
          {
            t: 'اختار الحدث',
            d: 'إمتى القاعدة تشتغل — طلب جديد، طلب اتشحن، سلة اتسابت، عميل رجع تاني.',
          },
          {
            t: 'حدّد الشرط (اختياري)',
            d: 'تضيّق القاعدة: الطلبات فوق مبلغ معيّن بس، أو محافظة معيّنة، أو عميل أول مرة.',
          },
          {
            t: 'اختار الإجراء',
            d: 'إيه اللي يحصل — رسالة واتساب للعميل، إشعار ليك، تغيير حالة الطلب، أو وسم للعميل.',
          },
        ].map((s, i) => (
          <li key={s.t} className="flex items-start gap-3">
            <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{s.t}</span>
              <span className="block text-sm leading-relaxed text-[var(--fg-muted)]">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* حالة الواتساب — بتتقرا من ربطه هو، مش تحذير عام */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        style={{
          borderColor: whatsappReady ? 'var(--color-success)' : 'var(--color-warning)',
          background: whatsappReady ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
        }}
      >
        <p
          className="flex min-w-0 items-start gap-2 text-sm"
          style={{ color: whatsappReady ? 'var(--color-success)' : 'var(--color-warning)' }}
        >
          {whatsappReady ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Plug className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            {whatsappReady ? (
              <>
                <strong className="font-semibold">واتساب مربوط.</strong> أي قاعدة إجراؤها رسالة
                واتساب هتشتغل على طول.
              </>
            ) : (
              <>
                <strong className="font-semibold">واتساب لسه مش مربوط.</strong> تقدر تبني قواعدك
                عادي، بس القاعدة اللي إجراؤها رسالة واتساب هتتحفظ وما هتبعتش لحد ما تربطه —
                نفس الربط اللي بيبعت تأكيد الطلبات وحالة الشحن.
              </>
            )}
          </span>
        </p>

        {!whatsappReady && (
          <Link
            href="/dashboard/plugins"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-warning)' }}
          >
            اربط واتساب
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </Card>
  )
}
