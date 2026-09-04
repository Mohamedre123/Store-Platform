'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { saveReceiptAction } from './actions'
import { Group, TextField, Toggle } from '@/components/dashboard/controls'
import { Alert, Card } from '@/components/ui'

export type ReceiptValues = {
  showOrderSummary: boolean
  showProgressTracker: boolean
  showWhatsappButton: boolean
  showTelegramButton: boolean
  allowDownloadReceipt: boolean
  customMessage: string
}

/**
 * إعدادات صفحة الطلب.
 *
 * الصفحة دي العميل بيوصلها بعد ما يدفع، وبيرجعلها كل مرة يسأل «طلبي
 * فين». يعني هي أكتر صفحة بيفتحها بعد الشرا — وكل حاجة فيها إما
 * بتطمّنه أو بتخلّيه يتصل بالتاجر.
 */
export function ReceiptForm({
  initial,
  hasWhatsapp,
  hasTelegram,
}: {
  initial: ReceiptValues
  /** رقم واتساب المتجر — الزرار من غيره بيودّي على رابط مكسور */
  hasWhatsapp: boolean
  /** تيليجرام مفعّل في شريط الأدوات؟ نفس الحساب، مصدر واحد */
  hasTelegram: boolean
}) {
  const [v, setV] = useState<ReceiptValues>(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const set = <K extends keyof ReceiptValues>(k: K, value: ReceiptValues[K]) =>
    setV((s) => ({ ...s, [k]: value }))

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <Card className="flex flex-col gap-6 p-5">
        <Group title="اللي العميل بيشوفه بعد الطلب">
          <Toggle
            label="شريط مراحل الطلب"
            hint="اتسجّل ← اتأكد ← اتشحن ← اتسلّم. بيقلّل رسايل «طلبي فين» أكتر من أي حاجة تانية."
            checked={v.showProgressTracker}
            onChange={(x) => set('showProgressTracker', x)}
          />

          <Toggle
            label="ملخّص الطلب"
            hint="المنتجات والأسعار والعنوان. اقفله لو بتبيع حاجة العميل مش عايزها تبان على شاشته."
            checked={v.showOrderSummary}
            onChange={(x) => set('showOrderSummary', x)}
          />

          <Toggle
            label="زرار عرض الفاتورة"
            hint="العميل بيدوّر على فاتورته هنا. اقفله لو بتبعتها بطريقة تانية بس."
            checked={v.allowDownloadReceipt}
            onChange={(x) => set('allowDownloadReceipt', x)}
          />
        </Group>

        <Group title="التواصل من صفحة الطلب">
          <Toggle
            label="زرار واتساب"
            hint={
              hasWhatsapp
                ? 'بيفتح محادثة معاك ومعاها رقم الطلب.'
                : 'محتاج رقم واتساب في بيانات المتجر — من غيره الزرار مش هيظهر.'
            }
            checked={v.showWhatsappButton}
            onChange={(x) => set('showWhatsappButton', x)}
          />

          <Toggle
            label="زرار تيليجرام"
            hint={
              hasTelegram
                ? 'بيفتح محادثتك على تيليجرام.'
                : 'محتاج تفعّل تيليجرام في تخصيص المتجر ← شريط الأدوات — نفس الحساب، مكتوب مرة واحدة.'
            }
            checked={v.showTelegramButton}
            onChange={(x) => set('showTelegramButton', x)}
          />
        </Group>

        <Group title="رسالتك">
          <TextField
            label="رسالة تظهر تحت رقم الطلب"
            value={v.customMessage}
            onChange={(x) => set('customMessage', x)}
            placeholder="هنكلّمك خلال ساعة لتأكيد الطلب. شكرًا لثقتك."
            multiline
            hint="المكان ده بيتقرا فعلًا — العميل لسه فرحان بالشرا وعينه على الشاشة."
          />
        </Group>
      </Card>

      <div className="safe-bottom sticky bottom-0 z-10 -mx-4 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <button
          type="button"
          onClick={() => {
            setMsg(null)
            start(async () => {
              const res = await saveReceiptAction(v)
              if (res?.error) setMsg({ ok: false, text: res.error })
              else setMsg({ ok: true, text: 'اتحفظ — شغّال على متجرك دلوقتي' })
            })
          }}
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
