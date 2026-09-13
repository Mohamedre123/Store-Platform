/**
 * فورم الكوبون — لوحة من تحت في شاشة الكوبونات.
 *
 * نفس خانات فورم اللوحة: الكود (أو «ولّد كود»)، نوع الخصم وقيمته، أقصى خصم،
 * أقل طلب، ينطبق على (كل المنتجات / منتجات / أقسام — باختيار بالبحث)، مين
 * يستخدمه، حدود الاستخدام، التواريخ، والتفعيل. والحذف بتأكيد.
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { icons } from '../icons'
import type { MarketingPayload } from './business-api'
import { formatNumber } from './format'
import { postAppJson } from './http'
import { toLatin } from './ops-api'
import { Sheet } from './screen'
import { Icon } from './ui'

type FormFields = NonNullable<MarketingPayload['coupons'][number]['form']>

export type CouponForm = FormFields & { id: string | null; code: string; description: string; isActive: boolean }

export const emptyCoupon = (): CouponForm => ({
  id: null,
  code: '',
  description: '',
  type: 'percent',
  value: '',
  maxDiscount: '',
  minOrder: '',
  appliesTo: 'all',
  targetIds: [],
  eligibility: 'all',
  usageLimit: '',
  usageLimitPerCustomer: '1',
  startsAt: '',
  endsAt: '',
  isActive: true,
})

const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function CouponEditor({
  initial,
  data,
  onClose,
  onDone,
}: {
  initial: CouponForm | null
  data: MarketingPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
}) {
  const [form, setForm] = useState<CouponForm | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setForm(initial)
    setError(null)
    setConfirmDelete(false)
    setSearch('')
  }, [initial])

  const currency = data.currency === 'EGP' ? 'ج.م' : data.currency
  const targets = form?.appliesTo === 'categories' ? (data.pickCategories ?? []) : (data.pickProducts ?? [])
  const shownTargets = useMemo(() => {
    const q = search.trim()
    return q ? targets.filter((t) => t.name.includes(q)) : targets
  }, [targets, search])

  if (!form) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const set = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) => setForm({ ...form, [key]: value })

  const save = async (e: Event) => {
    e.preventDefault()
    if (busy) return
    if (!/^[A-Z0-9_-]{2,32}$/.test(form.code.trim().toUpperCase())) return setError('الكود حروف وأرقام إنجليزي بس (٢ لـ٣٢ خانة)')
    if (form.type !== 'free_shipping' && !(Number(toLatin(form.value)) > 0)) return setError('اكتب قيمة الخصم')
    if (form.appliesTo !== 'all' && form.targetIds.length === 0) {
      return setError(form.appliesTo === 'products' ? 'اختار منتج واحد على الأقل' : 'اختار قسم واحد على الأقل')
    }
    setError(null)
    setBusy(true)
    haptic('MEDIUM')
    const res = await postAppJson('/api/app/marketing/coupons/save', { ...form, code: form.code.trim().toUpperCase() })
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await onDone(form.id ? 'الكوبون اتحفظ' : `الكوبون ${form.code.trim().toUpperCase()} جاهز — ابعته لعملاءك`)
    setBusy(false)
  }

  const remove = async () => {
    if (!form.id || busy) return
    setBusy(true)
    const res = await postAppJson(`/api/app/marketing/coupons/${encodeURIComponent(form.id)}/delete`)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await onDone('الكوبون اتحذف')
    setBusy(false)
  }

  const chip = (on: boolean, label: string, run: () => void, key: string) => (
    <button
      key={key}
      type="button"
      class={`fchip${on ? ' fchip--on' : ''}`}
      onClick={() => {
        haptic('LIGHT')
        run()
      }}
    >
      {label}
    </button>
  )

  return (
    <Sheet open={Boolean(initial)} tall title={form.id ? 'تعديل الكوبون' : 'كوبون جديد'} onClose={onClose}>
      <form class="np-form ops-form" onSubmit={save}>
        <label class="np-label">
          كود الخصم (اللي العميل بيكتبه في الشيك أوت)
          <span class="cp-code-row">
            <input
              class="np-input aff-input-code"
              dir="ltr"
              placeholder="EID25"
              autocapitalize="characters"
              value={form.code}
              maxLength={32}
              onInput={(e) => set('code', (e.currentTarget as HTMLInputElement).value.toUpperCase())}
            />
            <button type="button" class="act press cp-gen" onClick={() => set('code', randomCode())}>
              <Icon svg={icons.sparkles()} />
              ولّد
            </button>
          </span>
        </label>

        <div class="np-label">
          نوع الخصم
          <div class="chips">
            {chip(form.type === 'percent', 'نسبة ٪', () => set('type', 'percent'), 'percent')}
            {chip(form.type === 'fixed', 'مبلغ ثابت', () => set('type', 'fixed'), 'fixed')}
            {chip(form.type === 'free_shipping', 'شحن مجاني', () => set('type', 'free_shipping'), 'ship')}
          </div>
        </div>

        {form.type !== 'free_shipping' && (
          <div class="np-two">
            <label class="np-label">
              {form.type === 'percent' ? 'النسبة (٪)' : `قيمة الخصم (${currency})`}
              <input
                class="np-input num"
                type="text"
                inputMode="decimal"
                placeholder={form.type === 'percent' ? '25' : '50'}
                value={form.value}
                onInput={(e) => set('value', (e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            {form.type === 'percent' && (
              <label class="np-label">
                أقصى خصم (اختياري)
                <input
                  class="np-input num"
                  type="text"
                  inputMode="decimal"
                  placeholder="200"
                  value={form.maxDiscount}
                  onInput={(e) => set('maxDiscount', (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            )}
          </div>
        )}

        <label class="np-label">
          أقل مبلغ للطلب (اختياري)
          <input
            class="np-input num"
            type="text"
            inputMode="decimal"
            placeholder="500"
            value={form.minOrder}
            onInput={(e) => set('minOrder', (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <div class="np-label">
          ينطبق على
          <div class="chips">
            {chip(form.appliesTo === 'all', 'كل المنتجات', () => setForm({ ...form, appliesTo: 'all', targetIds: [] }), 'all')}
            {chip(form.appliesTo === 'products', 'منتجات محددة', () => setForm({ ...form, appliesTo: 'products', targetIds: form.appliesTo === 'products' ? form.targetIds : [] }), 'products')}
            {chip(form.appliesTo === 'categories', 'أقسام محددة', () => setForm({ ...form, appliesTo: 'categories', targetIds: form.appliesTo === 'categories' ? form.targetIds : [] }), 'categories')}
          </div>
        </div>

        {form.appliesTo !== 'all' && (
          <div class="cp-targets">
            <input
              class="np-input"
              type="search"
              placeholder={form.appliesTo === 'products' ? 'دوّر على منتج…' : 'دوّر على قسم…'}
              value={search}
              onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            />
            <small class="fine">اخترت {formatNumber(form.targetIds.length)}</small>
            <div class="card ops-list cp-target-list">
              {shownTargets.length === 0 ? (
                <p class="np-note">مفيش نتايج.</p>
              ) : (
                shownTargets.slice(0, 80).map((t) => {
                  const on = form.targetIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      class={`bl-row sp-free press${on ? ' cp-target--on' : ''}`}
                      onClick={() => {
                        haptic('LIGHT')
                        set('targetIds', on ? form.targetIds.filter((x) => x !== t.id) : [...form.targetIds, t.id])
                      }}
                    >
                      <span class="bl-main">
                        <b>{t.name}</b>
                      </span>
                      <span class={`cp-check${on ? ' cp-check--on' : ''}`}>{on && <Icon svg={icons.check()} />}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        <div class="np-label">
          مين يقدر يستخدمه
          <div class="chips">
            {chip(form.eligibility === 'all', 'كل العملاء', () => set('eligibility', 'all'), 'all')}
            {chip(form.eligibility === 'first_order', 'أول طلب بس', () => set('eligibility', 'first_order'), 'first')}
          </div>
          {(form.eligibility === 'tier' || form.eligibility === 'specific_customers') && (
            <p class="np-note">الكوبون ده {form.eligibility === 'tier' ? 'لمستوى ولاء معيّن' : 'لعملاء محدّدين'} — بيفضل كده لو ما غيّرتش.</p>
          )}
        </div>

        <div class="np-two">
          <label class="np-label">
            حد الاستخدام الكلي
            <input
              class="np-input num"
              type="text"
              inputMode="numeric"
              placeholder="بدون حد"
              value={form.usageLimit}
              onInput={(e) => set('usageLimit', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="np-label">
            لكل عميل
            <input
              class="np-input num"
              type="text"
              inputMode="numeric"
              value={form.usageLimitPerCustomer}
              onInput={(e) => set('usageLimitPerCustomer', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
        </div>

        <div class="np-two">
          <label class="np-label">
            يبدأ (اختياري)
            <input class="np-input num" type="date" value={form.startsAt} onInput={(e) => set('startsAt', (e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="np-label">
            ينتهي (اختياري)
            <input class="np-input num" type="date" value={form.endsAt} onInput={(e) => set('endsAt', (e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>

        <label class="np-label">
          وصف داخلي (اختياري)
          <input
            class="np-input"
            placeholder="خصم العيد للمتابعين"
            value={form.description}
            maxLength={300}
            onInput={(e) => set('description', (e.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <button
          type="button"
          class="switch-row"
          onClick={() => {
            haptic('LIGHT')
            set('isActive', !form.isActive)
          }}
        >
          <span class="switch-text">
            <b>مفعّل</b>
            <small>{form.isActive ? 'بيتطبّق في الشيك أوت فورًا' : 'متوقّف — العميل مش هيقدر يستخدمه'}</small>
          </span>
          <span class={`switch${form.isActive ? ' switch--on' : ''}`}>
            <span />
          </span>
        </button>

        {error && <p class="np-error">{error}</p>}

        {confirmDelete ? (
          <div class="ex-confirm">
            <p class="sheet-text">هتحذف الكوبون «{form.code}» نهائيًا. الطلبات اللي اتعملت بيه قبل كده بتفضل زي ما هي.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                رجوع
              </button>
              <button type="button" class="btn btn--danger press" disabled={busy} onClick={() => void remove()}>
                {busy ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                أيوه، احذفه
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
                {form.id ? 'احفظ' : 'اعمل الكوبون'}
              </button>
            </div>
            {form.id && (
              <button
                type="button"
                class="btn btn--ghost btn--danger-text press"
                onClick={() => {
                  haptic('LIGHT')
                  setConfirmDelete(true)
                }}
              >
                <Icon svg={icons.trash()} />
                احذف الكوبون
              </button>
            )}
          </>
        )}
      </form>
    </Sheet>
  )
}
