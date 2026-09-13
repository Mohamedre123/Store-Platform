/**
 * فورم عرض الكمية وفورم الباقة — لوحات من تحت في شاشة الكوبونات والعروض.
 *
 * - عرض الكمية: الاسم، الشارة، الشرائح («اشترِ ٣ ووفّر ١٥٪»)، والمنتجات (فاضي = كل المنتجات).
 * - الباقة: الاسم، الشارة، المنتجات (منتجين على الأقل — المختارين بيفضلوا فوق مع البحث)،
 *   وسعر الطقم كله مع حسبة «العميل هيوفّر كام».
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { icons } from '../icons'
import type { MarketingPayload } from './business-api'
import { formatMoney, formatNumber } from './format'
import { postAppJson } from './http'
import { toLatin } from './ops-api'
import { Sheet } from './screen'
import { Icon } from './ui'

export type OfferForm = {
  id: string | null
  name: string
  badge: string
  tiers: Array<{ qty: string; percent: string }>
  productIds: string[]
  isActive: boolean
}

export type BundleForm = {
  id: string | null
  name: string
  badge: string
  productIds: string[]
  bundlePrice: string
  isActive: boolean
}

export const emptyOffer = (): OfferForm => ({
  id: null,
  name: '',
  badge: '',
  tiers: [{ qty: '2', percent: '10' }],
  productIds: [],
  isActive: true,
})

export const emptyBundle = (): BundleForm => ({ id: null, name: '', badge: '', productIds: [], bundlePrice: '', isActive: true })

type Product = NonNullable<MarketingPayload['pickProducts']>[number]

/** اختيار منتجات بالبحث — المختارين بيفضلوا ظاهرين فوق مهما كان البحث */
function ProductPicker({
  products,
  selected,
  onChange,
  currency,
}: {
  products: Product[]
  selected: string[]
  onChange: (ids: string[]) => void
  currency: string
}) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim()
    const picked = products.filter((p) => selected.includes(p.id))
    const rest = products.filter((p) => !selected.includes(p.id) && (!q || p.name.includes(q)))
    return [...picked, ...rest.slice(0, 60)]
  }, [products, selected, query])

  return (
    <div class="cp-targets">
      <input
        class="np-input"
        type="search"
        placeholder="دوّر على منتج…"
        value={query}
        onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
      />
      <small class="fine">اخترت {formatNumber(selected.length)}</small>
      <div class="card ops-list cp-target-list">
        {shown.length === 0 ? (
          <p class="np-note">مفيش نتايج.</p>
        ) : (
          shown.map((p) => {
            const on = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                class={`bl-row sp-free press${on ? ' cp-target--on' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  onChange(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])
                }}
              >
                <span class="bl-main">
                  <b>{p.name}</b>
                  {typeof p.price === 'number' && <small>{formatMoney(p.price, currency)}</small>}
                </span>
                <span class={`cp-check${on ? ' cp-check--on' : ''}`}>{on && <Icon svg={icons.check()} />}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

/** زرار التفعيل + الأزرار + الحذف بتأكيد — مشتركين بين الفورمين */
function Footer({
  isActive,
  onToggle,
  busy,
  error,
  editing,
  confirmDelete,
  setConfirmDelete,
  onRemove,
  onClose,
  saveLabel,
  deleteLabel,
  deleteText,
}: {
  isActive: boolean
  onToggle: () => void
  busy: boolean
  error: string | null
  editing: boolean
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  onRemove: () => void
  onClose: () => void
  saveLabel: string
  deleteLabel: string
  deleteText: string
}) {
  return (
    <>
      <button
        type="button"
        class="switch-row"
        onClick={() => {
          haptic('LIGHT')
          onToggle()
        }}
      >
        <span class="switch-text">
          <b>مفعّل</b>
          <small>{isActive ? 'بيتطبّق في الشيك أوت تلقائي' : 'متوقّف'}</small>
        </span>
        <span class={`switch${isActive ? ' switch--on' : ''}`}>
          <span />
        </span>
      </button>
      {error && <p class="np-error">{error}</p>}
      {confirmDelete ? (
        <div class="ex-confirm">
          <p class="sheet-text">{deleteText}</p>
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
              رجوع
            </button>
            <button type="button" class="btn btn--danger press" disabled={busy} onClick={onRemove}>
              {busy ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
              أيوه، احذف
            </button>
          </div>
        </div>
      ) : (
        <>
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={onClose}>
              رجوع
            </button>
            <button type="submit" class="btn btn--primary press" disabled={busy}>
              {busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
              {saveLabel}
            </button>
          </div>
          {editing && (
            <button
              type="button"
              class="btn btn--ghost btn--danger-text press"
              onClick={() => {
                haptic('LIGHT')
                setConfirmDelete(true)
              }}
            >
              <Icon svg={icons.trash()} />
              {deleteLabel}
            </button>
          )}
        </>
      )}
    </>
  )
}

function useEditor<T extends { id: string | null }>(initial: T | null, onDone: (message: string) => Promise<void>) {
  const [form, setForm] = useState<T | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setForm(initial)
    setError(null)
    setConfirmDelete(false)
  }, [initial])

  const submit = async (url: string, body: object, done: string) => {
    if (busy) return
    setError(null)
    setBusy(true)
    haptic('MEDIUM')
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await onDone(done)
    setBusy(false)
  }

  const remove = (done: string) => {
    if (!form?.id) return
    void submit(`/api/app/marketing/offers/${encodeURIComponent(form.id)}/delete`, {}, done)
  }

  return { form, setForm, busy, error, setError, confirmDelete, setConfirmDelete, submit, remove }
}

export function OfferEditor({
  initial,
  data,
  onClose,
  onDone,
}: {
  initial: OfferForm | null
  data: MarketingPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
}) {
  const e = useEditor(initial, onDone)
  const form = e.form

  return (
    <Sheet open={Boolean(initial)} tall title={form?.id ? 'تعديل عرض الكمية' : 'عرض كمية جديد'} onClose={onClose}>
      {form && (
        <form
          class="np-form ops-form"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!form.name.trim()) return e.setError('اكتب اسم العرض')
            void e.submit(
              '/api/app/marketing/offers/save',
              { ...form, tiers: form.tiers.map((t) => ({ qty: toLatin(t.qty), percent: toLatin(t.percent) })) },
              form.id ? 'العرض اتحفظ' : 'العرض اشتغل في متجرك',
            )
          }}
        >
          <label class="np-label">
            اسم العرض (بيظهر للعميل في ملخّص الطلب)
            <input class="np-input" placeholder="خصم الكمية" value={form.name} onInput={(ev) => e.setForm({ ...form, name: (ev.currentTarget as HTMLInputElement).value })} />
          </label>
          <label class="np-label">
            شارة على المنتج (اختياري)
            <input class="np-input" placeholder="وفّر أكتر" value={form.badge} maxLength={40} onInput={(ev) => e.setForm({ ...form, badge: (ev.currentTarget as HTMLInputElement).value })} />
          </label>

          <div class="np-label">
            الشرائح
            <div class="of-tiers">
              {form.tiers.map((t, i) => (
                <div key={i} class="of-tier">
                  <span>اشترِ</span>
                  <input
                    class="np-input num of-num"
                    type="text"
                    inputMode="numeric"
                    value={t.qty}
                    onInput={(ev) => {
                      const tiers = [...form.tiers]
                      tiers[i] = { ...t, qty: (ev.currentTarget as HTMLInputElement).value }
                      e.setForm({ ...form, tiers })
                    }}
                  />
                  <span>ووفّر</span>
                  <input
                    class="np-input num of-num"
                    type="text"
                    inputMode="decimal"
                    value={t.percent}
                    onInput={(ev) => {
                      const tiers = [...form.tiers]
                      tiers[i] = { ...t, percent: (ev.currentTarget as HTMLInputElement).value }
                      e.setForm({ ...form, tiers })
                    }}
                  />
                  <span>٪</span>
                  {form.tiers.length > 1 && (
                    <button
                      type="button"
                      class="ops-icon press"
                      aria-label="شيل الشريحة"
                      onClick={() => e.setForm({ ...form, tiers: form.tiers.filter((_, j) => j !== i) })}
                    >
                      <Icon svg={icons.x()} />
                    </button>
                  )}
                </div>
              ))}
              {form.tiers.length < 10 && (
                <button type="button" class="act press of-add" onClick={() => e.setForm({ ...form, tiers: [...form.tiers, { qty: '', percent: '' }] })}>
                  <Icon svg={icons.plus()} />
                  ضيف شريحة
                </button>
              )}
            </div>
          </div>

          <div class="np-label">
            ينطبق على
            <p class="np-note">{form.productIds.length ? `${formatNumber(form.productIds.length)} منتج مختار` : 'كل المنتجات — أو اختار منتجات معيّنة من تحت'}</p>
            <ProductPicker products={data.pickProducts ?? []} selected={form.productIds} onChange={(productIds) => e.setForm({ ...form, productIds })} currency={data.currency} />
          </div>

          <Footer
            isActive={form.isActive}
            onToggle={() => e.setForm({ ...form, isActive: !form.isActive })}
            busy={e.busy}
            error={e.error}
            editing={Boolean(form.id)}
            confirmDelete={e.confirmDelete}
            setConfirmDelete={e.setConfirmDelete}
            onRemove={() => e.remove('العرض اتحذف')}
            onClose={onClose}
            saveLabel={form.id ? 'احفظ العرض' : 'اعمل العرض'}
            deleteLabel="احذف العرض"
            deleteText={`هتحذف «${form.name}» — الخصم هيبطّل يتطبّق في الشيك أوت.`}
          />
        </form>
      )}
    </Sheet>
  )
}

export function BundleEditor({
  initial,
  data,
  onClose,
  onDone,
}: {
  initial: BundleForm | null
  data: MarketingPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
}) {
  const e = useEditor(initial, onDone)
  const form = e.form
  const products = data.pickProducts ?? []
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const full = form ? form.productIds.reduce((n, id) => n + (byId.get(id)?.price ?? 0), 0) : 0
  const price = form ? Math.round(Number(toLatin(form.bundlePrice)) * 100) || 0 : 0

  return (
    <Sheet open={Boolean(initial)} tall title={form?.id ? 'تعديل الباقة' : 'باقة جديدة'} onClose={onClose}>
      {form && (
        <form
          class="np-form ops-form"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!form.name.trim()) return e.setError('اكتب اسم الباقة')
            if (form.productIds.length < 2) return e.setError('الباقة لازم تبقى منتجين على الأقل')
            if (!(price > 0)) return e.setError('اكتب سعر الباقة')
            void e.submit(
              '/api/app/marketing/bundles/save',
              { ...form, bundlePrice: toLatin(form.bundlePrice) },
              form.id ? 'الباقة اتحفظت' : 'الباقة اشتغلت في متجرك',
            )
          }}
        >
          <label class="np-label">
            اسم الباقة
            <input class="np-input" placeholder="طقم الصيف" value={form.name} maxLength={80} onInput={(ev) => e.setForm({ ...form, name: (ev.currentTarget as HTMLInputElement).value })} />
          </label>
          <label class="np-label">
            شارة على المنتج (اختياري)
            <input class="np-input" placeholder="باقة" value={form.badge} maxLength={40} onInput={(ev) => e.setForm({ ...form, badge: (ev.currentTarget as HTMLInputElement).value })} />
          </label>

          <div class="np-label">
            المنتجات (منتجين على الأقل)
            <ProductPicker products={products} selected={form.productIds} onChange={(productIds) => e.setForm({ ...form, productIds })} currency={data.currency} />
          </div>

          <label class="np-label">
            سعر الطقم كله ({data.currency === 'EGP' ? 'ج.م' : data.currency})
            <input
              class="np-input num"
              type="text"
              inputMode="decimal"
              placeholder="350"
              value={form.bundlePrice}
              onInput={(ev) => e.setForm({ ...form, bundlePrice: (ev.currentTarget as HTMLInputElement).value })}
            />
          </label>
          {full > 0 && (
            <p class={`np-note${price > 0 && price >= full ? ' of-warn' : ''}`}>
              المنتجات منفصلة بـ{formatMoney(full, data.currency)}
              {price > 0 && price < full && ` — العميل هيوفّر ${formatMoney(full - price, data.currency)}`}
              {price > 0 && price >= full && ' — سعر الباقة مش أقل من المنتجات منفصلة'}
            </p>
          )}

          <Footer
            isActive={form.isActive}
            onToggle={() => e.setForm({ ...form, isActive: !form.isActive })}
            busy={e.busy}
            error={e.error}
            editing={Boolean(form.id)}
            confirmDelete={e.confirmDelete}
            setConfirmDelete={e.setConfirmDelete}
            onRemove={() => e.remove('الباقة اتحذفت')}
            onClose={onClose}
            saveLabel={form.id ? 'احفظ الباقة' : 'اعمل الباقة'}
            deleteLabel="احذف الباقة"
            deleteText={`هتحذف «${form.name}» — الطقم هيبطّل يتطبّق في الشيك أوت.`}
          />
        </form>
      )}
    </Sheet>
  )
}
