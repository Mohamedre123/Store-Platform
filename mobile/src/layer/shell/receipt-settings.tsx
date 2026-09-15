/**
 * صفحة الطلب والإيصال — شاشة أصلية (`/dashboard/settings/receipt`).
 *
 * نفس `ReceiptForm` في اللوحة: شريط مراحل الطلب، ملخّص الطلب، زرار الفاتورة، زرار واتساب (بتنبيه لو مفيش رقم)،
 * زرار تيليجرام (بتنبيه لو مش مفعّل في شريط الأدوات)، والرسالة اللي تحت رقم الطلب؛ وزرار الحفظ لاصق تحت.
 */
import { useState } from 'preact/hooks'
import { hapticNotify } from '../bridge'
import { toast } from '../dom'
import { postAppJson, useResource } from './http'
import { Screen } from './screen'
import { Group, LoadState, SaveBar, Toggle, useSyncedForm } from './settings-forms'
import { receiptData } from './store-settings-api'

export function ReceiptSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(receiptData, visible, onUnavailable)
  const { form: v, patch, saved } = useSyncedForm(data, (d) => ({ ...d.values }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!v || busy) return
    setBusy(true)
    setError(null)
    const res = await postAppJson('/api/app/receipt/save', v)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      toast(res.error, { tone: 'danger', duration: 4000 })
      return
    }
    saved()
    await load()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast('اتحفظ — شغّال على متجرك دلوقتي', { tone: 'success', duration: 2400 })
  }

  return (
    <Screen visible={visible} title="صفحة الطلب" onRefresh={load} overlay={v ? <SaveBar busy={busy} onSave={() => void save()} /> : null}>
      <div class="home-body np-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">صفحة الطلب والإيصال</h1>
            <p class="page-sub">أكتر صفحة العميل بيفتحها بعد ما يشتري — وكل حاجة فيها إما بتطمّنه أو بتخلّيه يتصل بيك.</p>
          </div>
        </header>

        {!v || !data ? (
          <LoadState failed={failed} what="إعدادات صفحة الطلب" />
        ) : (
          <>
            <Group title="اللي العميل بيشوفه بعد الطلب">
              <Toggle
                label="شريط مراحل الطلب"
                hint="اتسجّل ← اتأكد ← اتشحن ← اتسلّم. بيقلّل رسايل «طلبي فين» أكتر من أي حاجة تانية."
                on={v.showProgressTracker}
                onChange={(x) => patch({ showProgressTracker: x })}
              />
              <Toggle
                label="ملخّص الطلب"
                hint="المنتجات والأسعار والعنوان. اقفله لو بتبيع حاجة العميل مش عايزها تبان على شاشته."
                on={v.showOrderSummary}
                onChange={(x) => patch({ showOrderSummary: x })}
              />
              <Toggle
                label="زرار عرض الفاتورة"
                hint="العميل بيدوّر على فاتورته هنا. اقفله لو بتبعتها بطريقة تانية بس."
                on={v.allowDownloadReceipt}
                onChange={(x) => patch({ allowDownloadReceipt: x })}
              />
            </Group>

            <Group title="التواصل من صفحة الطلب">
              <Toggle
                label="زرار واتساب"
                hint={data.hasWhatsapp ? 'بيفتح محادثة معاك ومعاها رقم الطلب.' : 'محتاج رقم واتساب في بيانات المتجر — من غيره الزرار مش هيظهر.'}
                on={v.showWhatsappButton}
                onChange={(x) => patch({ showWhatsappButton: x })}
              />
              <Toggle
                label="زرار تيليجرام"
                hint={
                  data.hasTelegram
                    ? 'بيفتح محادثتك على تيليجرام.'
                    : 'محتاج تفعّل تيليجرام في تخصيص المتجر ← شريط الأدوات — نفس الحساب، مكتوب مرة واحدة.'
                }
                on={v.showTelegramButton}
                onChange={(x) => patch({ showTelegramButton: x })}
              />
            </Group>

            <Group title="رسالتك">
              <label class="np-label">
                رسالة تظهر تحت رقم الطلب
                <textarea
                  class="np-input np-textarea"
                  rows={3}
                  maxLength={300}
                  placeholder="هنكلّمك خلال ساعة لتأكيد الطلب. شكرًا لثقتك."
                  value={v.customMessage}
                  onInput={(e) => patch({ customMessage: (e.currentTarget as HTMLTextAreaElement).value })}
                />
                <small class="pv-hint">المكان ده بيتقرا فعلًا — العميل لسه فرحان بالشرا وعينه على الشاشة.</small>
              </label>
            </Group>

            {error && <p class="np-error">{error}</p>}
          </>
        )}
      </div>
    </Screen>
  )
}
