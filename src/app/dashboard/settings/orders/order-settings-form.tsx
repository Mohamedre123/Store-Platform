'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { saveOrderSettingsAction } from './actions'
import { Group, NumberField, TextField, Toggle } from '@/components/dashboard/controls'
import { Alert, Card } from '@/components/ui'

export type OrderSettingsValues = {
  manualOrdersEnabled: boolean
  manualOversell: boolean
  manualCustomPricing: boolean
  manualDepositEnabled: boolean
  orderPrefix: string
  orderSuffix: string
  nextOrderNumber: number
}

/**
 * إعدادات الطلبات.
 *
 * المفاتيح مرتّبة من الأقل خطرًا للأخطر: التشغيل، بعدين الترقيم،
 * وآخر حاجة المفاتيح اللي بتفكّ قيودًا على الموظفين. الترتيب ده
 * مقصود — التاجر بيقرا من فوق لتحت، والمفتاح الخطر لازم يقابله
 * وهو مركّز فيه لا وهو بيمرّ على أول الصفحة بسرعة.
 */
export function OrderSettingsForm({ initial }: { initial: OrderSettingsValues }) {
  const [v, setV] = useState<OrderSettingsValues>(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const set = <K extends keyof OrderSettingsValues>(k: K, value: OrderSettingsValues[K]) =>
    setV((s) => ({ ...s, [k]: value }))

  function save() {
    setMsg(null)
    start(async () => {
      const res = await saveOrderSettingsAction(v)
      if (res?.error) setMsg({ ok: false, text: res.error })
      else setMsg({ ok: true, text: 'اتحفظ' })
    })
  }

  const preview = `${v.orderPrefix.trim()}${v.nextOrderNumber}${v.orderSuffix.trim()}`

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <Card className="flex flex-col gap-6 p-5">
        <Group title="الطلب اليدوي">
          <Toggle
            label="سجّل طلبات بإيدك من اللوحة"
            hint="الطلب اللي جالك على واتساب أو انستجرام بيتسجّل زي أي طلب: بيخصم من المخزون، وبيدخل التقارير، وبيتضاف لسجل العميل."
            checked={v.manualOrdersEnabled}
            onChange={(x) => set('manualOrdersEnabled', x)}
          />

          {v.manualOrdersEnabled && (
            <Toggle
              label="حصّل عربون مقدّم"
              hint="بيظهر خانة عربون في شاشة الطلب، والباقي بيتحصّل عند الاستلام. الطلب بيفضل «غير مدفوع» عشان ما تشحنش على إنه اتدفع كله."
              checked={v.manualDepositEnabled}
              onChange={(x) => set('manualDepositEnabled', x)}
            />
          )}
        </Group>

        <Group title="ترقيم الطلبات">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="بادئة"
              value={v.orderPrefix}
              onChange={(x) => set('orderPrefix', x)}
              placeholder="ZW-"
              ltr
            />
            <TextField
              label="لاحقة"
              value={v.orderSuffix}
              onChange={(x) => set('orderSuffix', x)}
              placeholder="-EG"
              ltr
            />
          </div>

          <NumberField
            label="رقم الطلب الجاي"
            value={v.nextOrderNumber}
            onChange={(x) => set('nextOrderNumber', x)}
            min={initial.nextOrderNumber}
            hint={`مينفعش يقلّ عن ${initial.nextOrderNumber} — الأقل بيتصادم مع طلب موجود. مفيد لو بتنقل من منصة تانية وعايز تكمّل من رقمك هناك.`}
          />

          <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-sm">
            الشكل النهائي: <span dir="ltr" className="tabular font-bold">#{preview}</span>
          </p>

          <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
            البادئة واللاحقة للعرض بس — روابط الطلبات القديمة بتفضل شغّالة زي ما هي حتى لو
            غيّرتهم بعدين.
          </p>
        </Group>

        <Group title="مفاتيح بتفكّ قيودًا">
          <Toggle
            label="اسمح بالبيع من غير مخزون"
            hint="لما تكون بتجيب من مورّدك ساعة الطلب. سيبها مقفولة لو بتبيع اللي عندك بس — من غيرها مش هتوعد عميل بحاجة مش موجودة."
            checked={v.manualOversell}
            onChange={(x) => set('manualOversell', x)}
          />

          <Toggle
            label="اسمح بتعديل سعر البند"
            hint="بتخلّي أي حد بيسجّل طلب يقدر يبيع بأي سعر. كل سعر بيتغيّر بيتسجّل في سجل النشاط باسم اللي عمله — بص عليه من وقت للتاني."
            checked={v.manualCustomPricing}
            onChange={(x) => set('manualCustomPricing', x)}
          />
        </Group>
      </Card>

      <div className="safe-bottom sticky bottom-0 z-10 -mx-4 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
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
