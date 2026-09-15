/**
 * إعدادات الشيك أوت — شاشة أصلية (`/dashboard/settings/checkout`).
 *
 * نفس `CheckoutSettingsForm` في اللوحة بكل مجموعاته: خانات الشيك أوت (الاسم والرقم من غير «مخفية»)، العنوان والتوصيل،
 * شاشة الشيك أوت، الدفع السريع والطلب عبر واتساب (بتنبيه لو مفيش رقم واتساب)، السلة (منتجات المقترحات بالبحث
 * — فاضي = الأكثر مبيعًا — والحد الأدنى للطلب)، والتحقّق والتأكيد التلقائي على واتساب.
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { Group, latinDigits, LoadState, Modes, SaveBar, Toggle, useSyncedForm } from './settings-forms'
import { checkoutSettingsData, type CheckoutValues, type FieldMode, type PickProduct } from './store-settings-api'
import { Icon } from './ui'

const MODES: ReadonlyArray<{ value: FieldMode; label: string }> = [
  { value: 'required', label: 'مطلوبة' },
  { value: 'optional', label: 'اختيارية' },
  { value: 'hidden', label: 'مخفية' },
]
/** الاسم والرقم من غير «مخفية» — الطلب من غيرهم مالوش صاحب */
const MODES_LOCKED = MODES.filter((m) => m.value !== 'hidden')

const FIELDS: ReadonlyArray<{ key: keyof CheckoutValues; label: string; hint?: string; locked?: boolean }> = [
  { key: 'fieldName', label: 'الاسم', hint: 'ما ينفعش يتخفي — الطلب لازم يكون ليه صاحب.', locked: true },
  { key: 'fieldPhone', label: 'رقم التليفون', hint: 'ما ينفعش يتخفي — بيه بتتواصل وبيه بتتشحن.', locked: true },
  { key: 'fieldEmail', label: 'البريد الإلكتروني', hint: 'من غيره الفاتورة وتذكيرة السلة المتروكة مالهاش طريق توصل بيه.' },
  { key: 'fieldCity', label: 'المحافظة', hint: 'سعر الشحن بيتحسب منها.' },
  { key: 'fieldArea', label: 'المنطقة' },
  { key: 'fieldStreet', label: 'الشارع والعنوان' },
  { key: 'fieldBuilding', label: 'المبنى / الشقة' },
  { key: 'fieldPostalCode', label: 'الرقم البريدي', hint: 'أغلب المتاجر المصرية مش محتاجاه.' },
  { key: 'fieldCountry', label: 'الدولة', hint: 'شغّلها لو بتشحن لأكتر من بلد. المتجر اللي بيبيع في بلد واحدة، القايمة دي خانة زيادة مالهاش لازمة.' },
  { key: 'fieldNotes', label: 'ملاحظات العميل' },
]

/** نفس حد `cartUpsellProductIds` في فعل الحفظ */
const MAX_UPSELL = 12

type Form = CheckoutValues & { minText: string; delayText: string }

function UpsellSheet({
  open,
  currency,
  selected,
  known,
  onFound,
  onChange,
  onClose,
}: {
  open: boolean
  currency: string
  selected: string[]
  known: Map<string, PickProduct>
  onFound: (products: PickProduct[]) => void
  onChange: (ids: string[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickProduct[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/app/checkout-settings/products?q=${encodeURIComponent(query.trim())}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { products: PickProduct[] }
        if (cancelled) return
        setResults(body.products)
        setFailed(false)
        onFound(body.products)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }, query ? 320 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query])

  const shown = useMemo(() => {
    const picked = selected.map((id) => known.get(id)).filter((p): p is PickProduct => Boolean(p))
    const rest = (results ?? []).filter((p) => !selected.includes(p.id))
    return [...picked, ...rest]
  }, [selected, results, known])

  const toggle = (id: string) => {
    haptic('LIGHT')
    if (selected.includes(id)) return onChange(selected.filter((x) => x !== id))
    if (selected.length >= MAX_UPSELL) return toast(`أقصى حاجة ${formatNumber(MAX_UPSELL)} منتج`, { tone: 'danger', duration: 2400 })
    onChange([...selected, id])
  }

  return (
    <Sheet open={open} tall title="منتجات مقترحات السلة" onClose={onClose}>
      <div class="np-form ops-form">
        <input
          class="np-input"
          type="search"
          placeholder="دوّر بالاسم أو الكود…"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        <small class="fine">
          {selected.length ? `اخترت ${formatNumber(selected.length)} من ${formatNumber(MAX_UPSELL)}` : 'مش مختار حاجة — المتجر بيقترح الأكثر مبيعًا'}
        </small>
        <div class="card ops-list cp-target-list">
          {results === null && !failed ? (
            <p class="np-note">بندوّر…</p>
          ) : failed && shown.length === 0 ? (
            <p class="np-note">ما قدرناش نجيب المنتجات — اتأكد من النت.</p>
          ) : shown.length === 0 ? (
            <p class="np-note">مفيش نتايج.</p>
          ) : (
            shown.map((p) => {
              const on = selected.includes(p.id)
              return (
                <button key={p.id} type="button" class={`bl-row sp-free press${on ? ' cp-target--on' : ''}`} onClick={() => toggle(p.id)}>
                  <span class="inv-thumb">{p.image ? <img src={assetUrl(p.image) ?? ''} alt="" loading="lazy" /> : <Icon svg={icons.image()} />}</span>
                  <span class="bl-main">
                    <b>{p.name}</b>
                    <small>
                      {formatMoney(p.price, currency)}
                      {p.status !== 'active' && <span class="pst-pill pst-pill--muted st-pill">مخفي</span>}
                    </small>
                  </span>
                  <span class={`cp-check${on ? ' cp-check--on' : ''}`}>{on && <Icon svg={icons.check()} />}</span>
                </button>
              )
            })
          )}
        </div>
        <div class="btn-row pv-sticky">
          {selected.length > 0 && (
            <button type="button" class="btn btn--ghost press" onClick={() => (haptic('LIGHT'), onChange([]))}>
              رجّعها تلقائي
            </button>
          )}
          <button type="button" class="btn btn--primary press" onClick={onClose}>
            <Icon svg={icons.check()} />
            تمام
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function CheckoutSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(checkoutSettingsData, visible, onUnavailable)
  const { form: v, patch, saved } = useSyncedForm<typeof data & object, Form>(data, (d) => ({
    ...d.values,
    minText: String(d.values.minOrderAmount / 100),
    delayText: String(d.values.autoConfirmDelay),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [known, setKnown] = useState<Map<string, PickProduct>>(() => new Map())

  useEffect(() => {
    if (data?.picked.length) setKnown((m) => new Map([...m, ...data.picked.map((p) => [p.id, p] as const)]))
  }, [data])

  const save = async () => {
    if (!v || busy) return
    setBusy(true)
    setError(null)
    const { minText, delayText, ...values } = v
    const pounds = Number(latinDigits(minText).replace(/[^\d.]/g, ''))
    const delay = parseInt(latinDigits(delayText), 10)
    const res = await postAppJson('/api/app/checkout-settings/save', {
      ...values,
      minOrderAmount: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
      autoConfirmDelay: Number.isFinite(delay) ? delay : values.autoConfirmDelay,
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
    toast('اتحفظ — شغّال على متجرك دلوقتي', { tone: 'success', duration: 2400 })
  }

  const currency = data?.currency ?? 'EGP'

  return (
    <Screen visible={visible} title="الشيك أوت" onRefresh={load} overlay={v ? <SaveBar busy={busy} onSave={() => void save()} /> : null}>
      <div class="home-body np-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">إعدادات الشيك أوت</h1>
            <p class="page-sub">كل خانة زيادة بتقلّل عدد اللي بيكمّلوا الطلب — ظبّط اللي محتاجه بس.</p>
          </div>
        </header>

        {!v || !data ? (
          <LoadState failed={failed} what="إعدادات الشيك أوت" />
        ) : (
          <>
            <Group title="خانات الشيك أوت" lead="كل خانة زيادة بتقلّل عدد اللي بيكمّلوا الطلب. خلّي المطلوب هو اللي محتاجه فعلًا عشان توصّل.">
              {FIELDS.map((f) => (
                <Modes
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  value={v[f.key] as FieldMode}
                  options={f.locked ? MODES_LOCKED : MODES}
                  onChange={(x) => patch({ [f.key]: x } as Partial<Form>)}
                />
              ))}
            </Group>

            <Group title="العنوان والتوصيل">
              <Modes
                label="شكل العنوان"
                hint="المبسّط خانة واحدة للعنوان كله — أسرع، بس الشحن بيبقى محتاج تأكيد."
                value={v.addressMode}
                options={[
                  { value: 'structured', label: 'مفصّل' },
                  { value: 'simple', label: 'مبسّط' },
                  { value: 'hidden', label: 'مخفي' },
                ]}
                onChange={(x) => patch({ addressMode: x })}
              />
              <Modes
                label="طريقة الاستلام"
                value={v.deliveryMode}
                options={[
                  { value: 'delivery', label: 'توصيل' },
                  { value: 'pickup', label: 'استلام من الفرع' },
                  { value: 'delivery_pickup', label: 'الاتنين' },
                ]}
                onChange={(x) => patch({ deliveryMode: x })}
              />
              <Toggle label="اختيار كود الدولة" hint="اقفله لو بتبيع في بلد واحد — خانة أقل." on={v.showCountryCodePicker} onChange={(x) => patch({ showCountryCodePicker: x })} />
            </Group>

            <Group title="شاشة الشيك أوت">
              <Toggle label="الوضع الذكي" hint="بيخفي العنوان تلقائيًا لو السلة كلها منتجات رقمية." on={v.smartMode} onChange={(x) => patch({ smartMode: x })} />
              <Toggle label="اختيار طريقة الدفع" on={v.showPaymentSelector} onChange={(x) => patch({ showPaymentSelector: x })} />
              <Toggle
                label="خانة كود الخصم"
                hint="خانة الكوبون الفاضية بتخلّي بعض العملاء يسيبوا الصفحة يدوّروا على كود."
                on={v.showCouponField}
                onChange={(x) => patch({ showCouponField: x })}
              />
            </Group>

            <Group title="الدفع السريع من صفحة المنتج">
              <Toggle
                label="تشغيل الدفع السريع"
                hint="العميل بيطلب من صفحة المنتج من غير ما يعدّي على السلة."
                on={v.quickCheckoutEnabled}
                onChange={(x) => patch({ quickCheckoutEnabled: x })}
              />
              {v.quickCheckoutEnabled && (
                <>
                  <Modes
                    label="شكله"
                    value={v.quickCheckoutStyle}
                    options={[
                      { value: 'drawer', label: 'درج جانبي' },
                      { value: 'inline', label: 'في الصفحة' },
                    ]}
                    onChange={(x) => patch({ quickCheckoutStyle: x })}
                  />
                  <Toggle label="عرض المنتجات جوّاه" on={v.quickCheckoutShowItems} onChange={(x) => patch({ quickCheckoutShowItems: x })} />
                </>
              )}
              <Toggle
                label="الطلب عبر واتساب"
                hint="زر في صفحة المنتج بيفتح محادثة فيها المنتج والكمية والرابط جاهزين — للعملاء اللي بيفضّلوا يتكلموا قبل ما يدفعوا."
                on={v.whatsappOrderEnabled}
                onChange={(x) => patch({ whatsappOrderEnabled: x })}
              />
              {v.whatsappOrderEnabled && !data.storeWhatsapp && (
                <div class="np-note st-warn">
                  الزر مش هيظهر لحد ما تحطّ رقم واتساب المتجر — ده الرقم اللي العميل هيكلّمك عليه.
                  <button type="button" class="st-link" onClick={() => navigate('/dashboard/settings?web=1')}>
                    إعدادات ← بيانات المتجر
                  </button>
                </div>
              )}
            </Group>

            <Group title="السلة">
              <div class="np-label">
                منتجات مقترحات السلة
                <button type="button" class="st-picker press" onClick={() => (haptic('LIGHT'), setPicker(true))}>
                  <Icon svg={icons.bag()} />
                  <span>{v.cartUpsellProductIds.length > 0 ? `${formatNumber(v.cartUpsellProductIds.length)} منتج مختار` : 'الأكثر مبيعًا (تلقائي)'}</span>
                  <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                </button>
                <small class="pv-hint">
                  سيبها فاضية والمتجر بيقترح الأكثر مبيعًا. اختار لما يكون عندك حاجة صغيرة مربحة عايز تدفعها مع كل طلب — شاحن، أو تغليف هدية.
                </small>
              </div>

              <Toggle label="حد أدنى للطلب" on={v.minOrderEnabled} onChange={(x) => patch({ minOrderEnabled: x })} />
              {v.minOrderEnabled && (
                <label class="np-label">
                  أقل مبلغ ({currency})
                  <input class="np-input num" inputMode="decimal" dir="ltr" value={v.minText} onInput={(e) => patch({ minText: (e.currentTarget as HTMLInputElement).value })} />
                </label>
              )}
            </Group>

            <Group title="التحقّق وتأكيد الطلب">
              <Toggle
                label="التقاط الطلبات الناقصة"
                hint="بيحفظ الطلب أول ما العميل يكتب رقمه — فتشوف اللي قرّب يشتري وساب."
                on={v.captureIncompleteOrders}
                onChange={(x) => patch({ captureIncompleteOrders: x })}
              />
              <Toggle
                label="رمز تحقّق قبل تأكيد الطلب"
                hint="بيقلّل الطلبات الوهمية، وبيضيف خطوة على العميل الحقيقي — شغّله لو بتشوف طلبات بأرقام غلط."
                on={v.otpEnabled}
                onChange={(x) => patch({ otpEnabled: x })}
              />
              <Toggle
                label="طلب تأكيد على واتساب بعد الطلب"
                hint={
                  data.whatsappReady
                    ? 'العميل بيرد ١ أو ٢، والطلب بينتقل لـ«بيتجهّز» لوحده ويوصله بريد وواتساب.'
                    : 'محتاج تربط واتساب الأول من الإضافات — من غيره مش هيتبعت.'
                }
                on={v.autoConfirmEnabled}
                onChange={(x) => patch({ autoConfirmEnabled: x })}
              />
              {v.autoConfirmEnabled && (
                <label class="np-label">
                  بعد كام دقيقة
                  <input class="np-input num" inputMode="numeric" dir="ltr" value={v.delayText} onInput={(e) => patch({ delayText: (e.currentTarget as HTMLInputElement).value })} />
                  <small class="pv-hint">من ١ لـ١٨٠ دقيقة. المهلة بتمنع إنها توصل مع رسالة تأكيد الطلب العادية فيحتار.</small>
                </label>
              )}
            </Group>

            {error && <p class="np-error">{error}</p>}
          </>
        )}
      </div>

      {v && data && (
        <UpsellSheet
          open={picker}
          currency={currency}
          selected={v.cartUpsellProductIds}
          known={known}
          onFound={(products) => setKnown((m) => new Map([...m, ...products.map((p) => [p.id, p] as const)]))}
          onChange={(ids) => patch({ cartUpsellProductIds: ids })}
          onClose={() => setPicker(false)}
        />
      )}
    </Screen>
  )
}
