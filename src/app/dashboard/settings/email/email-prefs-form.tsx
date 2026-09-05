'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { saveEmailPrefsAction } from './prefs-actions'
import { Group, Toggle } from '@/components/dashboard/controls'
import { Alert, Card } from '@/components/ui'

export type EmailPrefsValues = {
  confirmed: boolean
  processing: boolean
  shipped: boolean
  delivered: boolean
  cancelled: boolean
  returned: boolean
  newOrderToMerchant: boolean
}

/**
 * مفاتيح رسايل البريد.
 *
 * ## المفاتيح موصوفة بأثرها على العميل
 * «بريد تسليم الطلب» مش بتقول للتاجر حاجة. «لما الطلب يوصل — بتقفل
 * الدايرة وبتفتح باب المراجعة» بتخلّيه يقرّر وهو فاهم إيه اللي
 * بيقفله.
 *
 * ## وكلها مفتوحة افتراضيًا
 * الرسايل دي كانت بتتبعت بلا أي مفتاح. الشاشة دي بتدّي تحكّمًا لأول
 * مرة لا بتغيّر سلوكًا — التاجر المبسوط ما يعملش حاجة.
 */
export function EmailPrefsForm({ initial }: { initial: EmailPrefsValues }) {
  const [v, setV] = useState<EmailPrefsValues>(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const set = <K extends keyof EmailPrefsValues>(k: K, value: EmailPrefsValues[K]) =>
    setV((s) => ({ ...s, [k]: value }))

  return (
    <div className="flex flex-col gap-5">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <Card className="flex flex-col gap-6 p-5">
        <Group title="رسايل بتوصل العميل">
          <Toggle
            label="لما تأكّد الطلب"
            hint="بتطمّن العميل إن طلبه اتشاف فعلًا — وبتقلّل المكالمات اللي بتسأل «وصلكم ولا لأ؟»."
            checked={v.confirmed}
            onChange={(x) => set('confirmed', x)}
          />
          <Toggle
            label="لما يبدأ التجهيز"
            hint="أغلب التجّار بيقفلوها: بيغيّروا الحالة دي لتنظيمهم هم، والعميل مش مستنّي خبر هنا."
            checked={v.processing}
            onChange={(x) => set('processing', x)}
          />
          <Toggle
            label="لما يتشحن"
            hint="أهم واحدة — فيها رقم البوليصة ورابط التتبّع، والعميل بيدوّر عليها."
            checked={v.shipped}
            onChange={(x) => set('shipped', x)}
          />
          <Toggle
            label="لما يتسلّم"
            hint="بتقفل الدايرة وبتفتح باب المراجعة — وهي أرخص طريقة تجيب بيها رأي."
            checked={v.delivered}
            onChange={(x) => set('delivered', x)}
          />
          <Toggle
            label="لما يتلغي"
            hint="العميل اللي طلبه اتلغى من غير خبر بيفتكر إن فلوسه ضاعت ويتصل."
            checked={v.cancelled}
            onChange={(x) => set('cancelled', x)}
          />
          <Toggle
            label="لما يتسجّل مرتجع"
            checked={v.returned}
            onChange={(x) => set('returned', x)}
          />
        </Group>

        <Group title="رسايل بتوصلك إنت">
          <Toggle
            label="إشعار بكل طلب جديد"
            hint="بيروح على بريد المتجر. اقفلها لو بتتابع لوحتك طول اليوم — الإشعار ساعتها رسالة زيادة على كل طلب."
            checked={v.newOrderToMerchant}
            onChange={(x) => set('newOrderToMerchant', x)}
          />
        </Group>
      </Card>

      <div>
        <button
          type="button"
          onClick={() => {
            setMsg(null)
            start(async () => {
              const res = await saveEmailPrefsAction(v)
              if (res?.error) setMsg({ ok: false, text: res.error })
              else setMsg({ ok: true, text: 'اتحفظ' })
            })
          }}
          disabled={pending}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : msg?.ok ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          احفظ التعديلات
        </button>
      </div>
    </div>
  )
}
