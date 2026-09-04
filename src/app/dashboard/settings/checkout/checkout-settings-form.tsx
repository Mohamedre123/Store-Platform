'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Save, ShoppingBasket } from 'lucide-react'
import { saveCheckoutSettingsAction } from './actions'
import { Choice, Group, NumberField, Row, Toggle } from '@/components/dashboard/controls'
import { Alert, Card } from '@/components/ui'
import { fromMinorUnits, toMinorUnits } from '@/lib/utils'
import { ProductPicker } from '../../storefront/product-picker'
import type { PickerCategory } from '../../storefront/picker-actions'

export type CheckoutSettingsValues = {
  fieldName: FieldMode
  fieldPhone: FieldMode
  fieldEmail: FieldMode
  fieldCity: FieldMode
  fieldArea: FieldMode
  fieldStreet: FieldMode
  fieldBuilding: FieldMode
  fieldPostalCode: FieldMode
  fieldCountry: FieldMode
  fieldNotes: FieldMode
  addressMode: 'structured' | 'simple' | 'hidden'
  deliveryMode: 'delivery_pickup' | 'delivery' | 'pickup'
  showCountryCodePicker: boolean
  smartMode: boolean
  showPaymentSelector: boolean
  showCouponField: boolean
  quickCheckoutEnabled: boolean
  quickCheckoutStyle: 'inline' | 'drawer'
  quickCheckoutShowItems: boolean
  whatsappOrderEnabled: boolean
  cartUpsellEnabled: boolean
  cartUpsellProductIds: string[]
  minOrderEnabled: boolean
  minOrderAmount: number
  otpEnabled: boolean
  captureIncompleteOrders: boolean
  autoConfirmEnabled: boolean
  autoConfirmDelay: number
}

type FieldMode = 'required' | 'optional' | 'hidden'

const MODES = [
  { value: 'required' as const, label: 'مطلوبة' },
  { value: 'optional' as const, label: 'اختيارية' },
  { value: 'hidden' as const, label: 'مخفية' },
]

/** الاسم والرقم من غير «مخفية» — الطلب من غيرهم مالوش صاحب */
const MODES_LOCKED = MODES.filter((m) => m.value !== 'hidden')

export function CheckoutSettingsForm({
  initial,
  pickerCategories,
  currency,
  whatsappReady,
  storeWhatsapp,
}: {
  initial: CheckoutSettingsValues
  /** أقسام المتجر بعدد منتجاتها — منتقي مقترحات السلة بيقرا منها */
  pickerCategories: PickerCategory[]
  currency: string
  /** واتساب مربوط؟ التأكيد التلقائي مالوش معنى من غيره */
  whatsappReady: boolean
  /** رقم واتساب المتجر — الطلب عبر واتساب مالوش معنى من غيره */
  storeWhatsapp: string | null
}) {
  const [v, setV] = useState<CheckoutSettingsValues>(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  /** المبلغ بيتعرض بالجنيه وبيتخزّن بالقرش */
  const [minAmount, setMinAmount] = useState(String(fromMinorUnits(initial.minOrderAmount)))

  /* منتجات مقترحات السلة — الفاضي معناه «الأكثر مبيعًا» زي ما كان */
  const [upsellPicker, setUpsellPicker] = useState(false)

  const set = <K extends keyof CheckoutSettingsValues>(k: K, value: CheckoutSettingsValues[K]) =>
    setV((s) => ({ ...s, [k]: value }))

  function save() {
    setMsg(null)
    start(async () => {
      const res = await saveCheckoutSettingsAction({
        ...v,
        minOrderAmount: toMinorUnits(minAmount || '0'),
      })
      if (res?.error) setMsg({ ok: false, text: res.error })
      else setMsg({ ok: true, text: 'اتحفظ — شغّال على متجرك دلوقتي' })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <Card className="flex flex-col gap-6 p-5">
        <Group title="خانات الشيك أوت">
          <p className="-mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
            كل خانة زيادة بتقلّل عدد اللي بيكمّلوا الطلب. خلّي المطلوب هو اللي محتاجه فعلًا
            عشان توصّل.
          </p>

          <Choice
            label="الاسم"
            value={v.fieldName}
            options={MODES_LOCKED}
            onChange={(x) => set('fieldName', x)}
            columns={2}
            hint="ما ينفعش يتخفي — الطلب لازم يكون ليه صاحب."
          />
          <Choice
            label="رقم التليفون"
            value={v.fieldPhone}
            options={MODES_LOCKED}
            onChange={(x) => set('fieldPhone', x)}
            columns={2}
            hint="ما ينفعش يتخفي — بيه بتتواصل وبيه بتتشحن."
          />
          <Choice
            label="البريد الإلكتروني"
            value={v.fieldEmail}
            options={MODES}
            onChange={(x) => set('fieldEmail', x)}
            hint="من غيره الفاتورة وتذكيرة السلة المتروكة مالهاش طريق توصل بيه."
          />
          <Choice
            label="المحافظة"
            value={v.fieldCity}
            options={MODES}
            onChange={(x) => set('fieldCity', x)}
            hint="سعر الشحن بيتحسب منها."
          />
          <Choice
            label="المنطقة"
            value={v.fieldArea}
            options={MODES}
            onChange={(x) => set('fieldArea', x)}
          />
          <Choice
            label="الشارع والعنوان"
            value={v.fieldStreet}
            options={MODES}
            onChange={(x) => set('fieldStreet', x)}
          />
          <Choice
            label="المبنى / الشقة"
            value={v.fieldBuilding}
            options={MODES}
            onChange={(x) => set('fieldBuilding', x)}
          />
          <Choice
            label="الرقم البريدي"
            value={v.fieldPostalCode}
            options={MODES}
            onChange={(x) => set('fieldPostalCode', x)}
            hint="أغلب المتاجر المصرية مش محتاجاه."
          />
          <Choice
            label="الدولة"
            value={v.fieldCountry}
            options={MODES}
            onChange={(x) => set('fieldCountry', x)}
            hint="شغّلها لو بتشحن لأكتر من بلد. المتجر اللي بيبيع في بلد واحدة، القايمة دي خانة زيادة مالهاش لازمة."
          />
          <Choice
            label="ملاحظات العميل"
            value={v.fieldNotes}
            options={MODES}
            onChange={(x) => set('fieldNotes', x)}
          />
        </Group>

        <Group title="العنوان والتوصيل">
          <Choice
            label="شكل العنوان"
            value={v.addressMode}
            options={[
              { value: 'structured', label: 'مفصّل' },
              { value: 'simple', label: 'مبسّط' },
              { value: 'hidden', label: 'مخفي' },
            ]}
            onChange={(x) => set('addressMode', x)}
            hint="المبسّط خانة واحدة للعنوان كله — أسرع، بس الشحن بيبقى محتاج تأكيد."
          />
          <Choice
            label="طريقة الاستلام"
            value={v.deliveryMode}
            options={[
              { value: 'delivery', label: 'توصيل' },
              { value: 'pickup', label: 'استلام من الفرع' },
              { value: 'delivery_pickup', label: 'الاتنين' },
            ]}
            onChange={(x) => set('deliveryMode', x)}
          />
          <Toggle
            label="اختيار كود الدولة"
            checked={v.showCountryCodePicker}
            onChange={(x) => set('showCountryCodePicker', x)}
            hint="اقفله لو بتبيع في بلد واحد — خانة أقل."
          />
        </Group>

        <Group title="شاشة الشيك أوت">
          <Toggle
            label="الوضع الذكي"
            checked={v.smartMode}
            onChange={(x) => set('smartMode', x)}
            hint="بيخفي العنوان تلقائيًا لو السلة كلها منتجات رقمية."
          />
          <Toggle
            label="اختيار طريقة الدفع"
            checked={v.showPaymentSelector}
            onChange={(x) => set('showPaymentSelector', x)}
          />
          <Toggle
            label="خانة كود الخصم"
            checked={v.showCouponField}
            onChange={(x) => set('showCouponField', x)}
            hint="خانة الكوبون الفاضية بتخلّي بعض العملاء يسيبوا الصفحة يدوّروا على كود."
          />
        </Group>

        <Group title="الدفع السريع من صفحة المنتج">
          <Toggle
            label="تشغيل الدفع السريع"
            checked={v.quickCheckoutEnabled}
            onChange={(x) => set('quickCheckoutEnabled', x)}
            hint="العميل بيطلب من صفحة المنتج من غير ما يعدّي على السلة."
          />
          {v.quickCheckoutEnabled && (
            <>
              <Choice
                label="شكله"
                value={v.quickCheckoutStyle}
                options={[
                  { value: 'drawer', label: 'درج جانبي' },
                  { value: 'inline', label: 'في الصفحة' },
                ]}
                onChange={(x) => set('quickCheckoutStyle', x)}
                columns={2}
              />
              <Toggle
                label="عرض المنتجات جوّاه"
                checked={v.quickCheckoutShowItems}
                onChange={(x) => set('quickCheckoutShowItems', x)}
              />
            </>
          )}
          <Toggle
            label="الطلب عبر واتساب"
            checked={v.whatsappOrderEnabled}
            onChange={(x) => set('whatsappOrderEnabled', x)}
            hint="زر في صفحة المنتج بيفتح محادثة فيها المنتج والكمية والرابط جاهزين — للعملاء اللي بيفضّلوا يتكلموا قبل ما يدفعوا."
          />

          {/*
            الميزة محتاجة رقم، والرقم مش هنا.

            التاجر بيفتح المفتاح، ويروح لصفحة المنتج، وما بيلاقيش زرار —
            وما عندوش أي طريقة يعرف السبب. الشرط التاني (وجود رقم واتساب
            على المتجر) في شاشة تانية خالص، فلازم يتقال هنا وقت ما
            بيفتحها لا بعد ما يدوّر.
          */}
          {v.whatsappOrderEnabled && !storeWhatsapp && (
            <p className="rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--color-warning)]">
              الزر مش هيظهر لحد ما تحطّ رقم واتساب المتجر — من{' '}
              <a href="/dashboard/settings" className="underline">
                إعدادات ← بيانات المتجر
              </a>
              . ده الرقم اللي العميل هيكلّمك عليه.
            </p>
          )}
        </Group>

        <Group title="السلة">
          {/*
            «اقتراح منتجات في السلة» كان هنا وما كانش بيعمل حاجة.

            الميزة شغّالة فعلًا، بس مفتاحها في تخصيص المتجر ← السلة
            (`cart.showUpsell`) — وده اللي الواجهة بتقراه. المفتاح اللي
            كان هنا بيتحفظ في عمود محدّش بيقراه، فالتاجر بيقفله
            ويلاقي الاقتراحات لسه ظاهرة.

            مفتاحان لنفس السلوك أسوأ من مفتاح واحد: التاجر بيغيّر الغلط
            منهم ويفتكر إن الميزة بايظة. فشِلناه من هنا وسبنا اللي
            بيشتغل مكانه.
          */}
          {/*
            اختيار المنتجات هنا، والتشغيل في تخصيص المتجر ← السلة.

            المفتاح مش بيتكرر عن قصد (شوف التعليق فوق). اللي هنا
            **بيانات** لا مفتاح: أنهي منتجات تظهر لما الميزة تكون
            شغّالة. والفاضي بيرجع للأكثر مبيعًا، فالمتجر الجديد
            بيشتغل من غير أي اختيار.
          */}
          <Row
            label="منتجات مقترحات السلة"
            hint="سيبها فاضية والمتجر بيقترح الأكثر مبيعًا. اختار لما يكون عندك حاجة صغيرة مربحة عايز تدفعها مع كل طلب — شاحن، أو تغليف هدية."
          >
            <button
              type="button"
              onClick={() => setUpsellPicker(true)}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            >
              <ShoppingBasket className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
              <span className="flex-1 text-start">
                {v.cartUpsellProductIds.length > 0
                  ? `${v.cartUpsellProductIds.length} منتج مختار`
                  : 'الأكثر مبيعًا (تلقائي)'}
              </span>
            </button>
          </Row>

          <ProductPicker
            open={upsellPicker}
            value={v.cartUpsellProductIds}
            categories={pickerCategories}
            currency={currency}
            onClose={() => setUpsellPicker(false)}
            onChange={(ids) => set('cartUpsellProductIds', ids)}
          />

          <Toggle
            label="حد أدنى للطلب"
            checked={v.minOrderEnabled}
            onChange={(x) => set('minOrderEnabled', x)}
          />
          {v.minOrderEnabled && (
            <NumberField
              label="أقل مبلغ"
              value={Number(minAmount) || 0}
              onChange={(x) => setMinAmount(String(x))}
              min={0}
              suffix={currency}
            />
          )}
        </Group>

        <Group title="التحقّق وتأكيد الطلب">
          <Toggle
            label="التقاط الطلبات الناقصة"
            checked={v.captureIncompleteOrders}
            onChange={(x) => set('captureIncompleteOrders', x)}
            hint="بيحفظ الطلب أول ما العميل يكتب رقمه — فتشوف اللي قرّب يشتري وساب."
          />
          <Toggle
            label="رمز تحقّق قبل تأكيد الطلب"
            checked={v.otpEnabled}
            onChange={(x) => set('otpEnabled', x)}
            hint="بيقلّل الطلبات الوهمية، وبيضيف خطوة على العميل الحقيقي — شغّله لو بتشوف طلبات بأرقام غلط."
          />

          <Toggle
            label="طلب تأكيد على واتساب بعد الطلب"
            checked={v.autoConfirmEnabled}
            onChange={(x) => set('autoConfirmEnabled', x)}
            hint={
              whatsappReady
                ? 'العميل بيرد ١ أو ٢، والطلب بينتقل لـ«بيتجهّز» لوحده ويوصله بريد وواتساب.'
                : 'محتاج تربط واتساب الأول من الإضافات — من غيره مش هيتبعت.'
            }
          />
          {v.autoConfirmEnabled && (
            <NumberField
              label="بعد كام دقيقة"
              value={v.autoConfirmDelay}
              onChange={(x) => set('autoConfirmDelay', x)}
              min={1}
              max={180}
              suffix="دقيقة"
              hint="المهلة بتمنع إنها توصل مع رسالة تأكيد الطلب العادية فيحتار."
            />
          )}
        </Group>
      </Card>

      {/*
        زر الحفظ لاصق تحت.

        الصفحة طويلة، والتاجر اللي بيغيّر إعدادًا في أولها كان لازم
        ينزل لآخرها عشان يحفظ — وعلى الموبايل ده تمرير طويل بيخلّيه
        يسيب التغيير من غير حفظ.
      */}
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
