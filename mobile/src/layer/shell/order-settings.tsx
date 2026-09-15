/**
 * إعدادات الطلبات — شاشة أصلية (`/dashboard/settings/orders`).
 *
 * نفس `OrderSettingsForm` في اللوحة: الطلب اليدوي والعربون، البادئة واللاحقة والرقم الجاي (مينفعش يقلّ)
 * بمعاينة الشكل النهائي، والمفاتيح اللي بتفكّ قيود (البيع من غير مخزون، تعديل سعر البند).
 */
import { useState } from 'preact/hooks'
import { hapticNotify } from '../bridge'
import { toast } from '../dom'
import { postAppJson, useResource } from './http'
import { Screen } from './screen'
import { Group, latinDigits, LoadState, SaveBar, Toggle, useSyncedForm } from './settings-forms'
import { orderSettingsData } from './store-settings-api'

export function OrderSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(orderSettingsData, visible, onUnavailable)
  const { form: v, patch, saved } = useSyncedForm(data, (d) => ({ ...d.values, next: String(d.values.nextOrderNumber) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const min = data?.values.nextOrderNumber ?? 1
  const nextNumber = v ? parseInt(latinDigits(v.next), 10) : NaN

  const save = async () => {
    if (!v || busy) return
    setBusy(true)
    setError(null)
    const res = await postAppJson('/api/app/order-settings/save', {
      manualOrdersEnabled: v.manualOrdersEnabled,
      manualOversell: v.manualOversell,
      manualCustomPricing: v.manualCustomPricing,
      manualDepositEnabled: v.manualDepositEnabled,
      orderPrefix: v.orderPrefix,
      orderSuffix: v.orderSuffix,
      nextOrderNumber: Number.isFinite(nextNumber) ? nextNumber : min,
    })
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
    toast('اتحفظ', { tone: 'success', duration: 2000 })
  }

  return (
    <Screen visible={visible} title="إعدادات الطلبات" onRefresh={load} overlay={v ? <SaveBar busy={busy} onSave={() => void save()} /> : null}>
      <div class="home-body np-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">إعدادات الطلبات</h1>
            <p class="page-sub">تسجيل الطلبات بإيدك، وشكل رقم الطلب، والقيود اللي تفكّها لموظفينك.</p>
          </div>
        </header>

        {!v ? (
          <LoadState failed={failed} what="إعدادات الطلبات" />
        ) : (
          <>
            <Group title="الطلب اليدوي">
              <Toggle
                label="سجّل طلبات بإيدك من اللوحة"
                hint="الطلب اللي جالك على واتساب أو انستجرام بيتسجّل زي أي طلب: بيخصم من المخزون، وبيدخل التقارير، وبيتضاف لسجل العميل."
                on={v.manualOrdersEnabled}
                onChange={(x) => patch({ manualOrdersEnabled: x })}
              />
              {v.manualOrdersEnabled && (
                <Toggle
                  label="حصّل عربون مقدّم"
                  hint="بيظهر خانة عربون في شاشة الطلب، والباقي بيتحصّل عند الاستلام. الطلب بيفضل «غير مدفوع» عشان ما تشحنش على إنه اتدفع كله."
                  on={v.manualDepositEnabled}
                  onChange={(x) => patch({ manualDepositEnabled: x })}
                />
              )}
            </Group>

            <Group title="ترقيم الطلبات">
              <div class="st-grid2">
                <label class="np-label">
                  بادئة
                  <input class="np-input" dir="ltr" maxLength={12} placeholder="ZW-" value={v.orderPrefix} onInput={(e) => patch({ orderPrefix: (e.currentTarget as HTMLInputElement).value })} />
                </label>
                <label class="np-label">
                  لاحقة
                  <input class="np-input" dir="ltr" maxLength={12} placeholder="-EG" value={v.orderSuffix} onInput={(e) => patch({ orderSuffix: (e.currentTarget as HTMLInputElement).value })} />
                </label>
              </div>

              <label class="np-label">
                رقم الطلب الجاي
                <input class="np-input num" inputMode="numeric" dir="ltr" value={v.next} onInput={(e) => patch({ next: (e.currentTarget as HTMLInputElement).value })} />
                <small class={`pv-hint${Number.isFinite(nextNumber) && nextNumber < min ? ' st-bad' : ''}`}>
                  مينفعش يقلّ عن {min} — الأقل بيتصادم مع طلب موجود. مفيد لو بتنقل من منصة تانية وعايز تكمّل من رقمك هناك.
                </small>
              </label>

              <p class="st-preview">
                الشكل النهائي:
                <b dir="ltr">
                  #{v.orderPrefix.trim()}
                  {Number.isFinite(nextNumber) ? nextNumber : min}
                  {v.orderSuffix.trim()}
                </b>
              </p>
              <small class="pv-hint">البادئة واللاحقة للعرض بس — روابط الطلبات القديمة بتفضل شغّالة زي ما هي حتى لو غيّرتهم بعدين.</small>
            </Group>

            <Group title="مفاتيح بتفكّ قيودًا">
              <Toggle
                label="اسمح بالبيع من غير مخزون"
                hint="لما تكون بتجيب من مورّدك ساعة الطلب. سيبها مقفولة لو بتبيع اللي عندك بس — من غيرها مش هتوعد عميل بحاجة مش موجودة."
                on={v.manualOversell}
                onChange={(x) => patch({ manualOversell: x })}
              />
              <Toggle
                label="اسمح بتعديل سعر البند"
                hint="بتخلّي أي حد بيسجّل طلب يقدر يبيع بأي سعر. كل سعر بيتغيّر بيتسجّل في سجل النشاط باسم اللي عمله — بص عليه من وقت للتاني."
                on={v.manualCustomPricing}
                onChange={(x) => patch({ manualCustomPricing: x })}
              />
            </Group>

            {error && <p class="np-error">{error}</p>}
          </>
        )}
      </div>
    </Screen>
  )
}
