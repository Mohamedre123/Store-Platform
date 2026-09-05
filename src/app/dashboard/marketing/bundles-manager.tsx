'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Package, Plus, Trash2, X } from 'lucide-react'
import {
  deleteOfferAction,
  saveBundleAction,
  toggleOfferAction,
  type BundleInput,
} from './offer-actions'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { cn, formatMoney } from '@/lib/utils'

export type BundleRow = {
  id: string
  name: string
  badge: string | null
  config: { productIds?: string[]; bundlePrice?: number }
  isActive: boolean
}

export type PickProduct = { id: string; name: string; price: number }

const empty = (): BundleInput => ({
  name: '',
  badge: '',
  productIds: [],
  bundlePrice: '',
  isActive: true,
})

function rowToInput(b: BundleRow): BundleInput {
  return {
    id: b.id,
    name: b.name,
    badge: b.badge ?? '',
    productIds: b.config.productIds ?? [],
    bundlePrice: String((b.config.bundlePrice ?? 0) / 100),
    isActive: b.isActive,
  }
}

/**
 * الباقات — «خد التلاتة دول بـ٣٥٠».
 *
 * ## غير عرض الكمية في المعنى والاستعمال
 * عرض الكمية بيقول «كل ما تشتري أكتر من **نفس** الحاجة توفّر
 * أكتر» — بيصرّف مخزون منتج واحد. الباقة بتقول «الحاجات دي مع
 * بعض» — بتبيع منتجات **مختلفة** مع بعض، وبتدخّل منتجًا بطيء
 * البيع جنب منتج ماشي.
 *
 * ## والسعر بيتكتب لا النسبة
 * التاجر بيفكّر «الطقم بـ٣٥٠»، مش «خصم ١٦.٧٪». النسبة كانت هتخلّيه
 * يحسب في دماغه وياخد رقمًا ما قصدهوش. الشاشة بتوري الفرق وهو
 * بيكتب، فبيشوف كام هيوفّر للعميل وكام هيسيب من هامشه.
 */
export function BundlesManager({
  bundles,
  products,
  currency,
}: {
  bundles: BundleRow[]
  products: PickProduct[]
  currency: string
}) {
  const [form, setForm] = useState<BundleInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await saveBundleAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {bundles.length === 0 && !form && (
        <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Package className="h-7 w-7 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h3 className="font-semibold">مفيش باقات</h3>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            الباقة بتبيع منتجات مختلفة مع بعض بسعر واحد — وبتدخّل منتجًا بطيء البيع جنب منتج
            ماشي. بتتطبّق لوحدها في الشيك أوت لما العميل يحطّ الطقم كله.
          </p>
        </Card>
      )}

      {bundles.map((b) => {
        const ids = b.config.productIds ?? []
        const full = ids.reduce((n, id) => n + (byId.get(id)?.price ?? 0), 0)
        const price = b.config.bundlePrice ?? 0

        return form?.id === b.id ? (
          <BundleForm
            key={b.id}
            form={form}
            setForm={setForm}
            products={products}
            currency={currency}
            error={error}
            pending={pending}
            onSave={save}
            onCancel={() => setForm(null)}
          />
        ) : (
          <Card key={b.id} className={cn('flex flex-wrap items-center gap-3 p-4', !b.isActive && 'opacity-60')}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Package className="h-4 w-4" aria-hidden="true" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{b.name}</span>
              <span className="block truncate text-xs text-[var(--fg-subtle)]">
                {ids.map((id) => byId.get(id)?.name ?? '—').join(' + ')}
              </span>
            </span>

            <span className="shrink-0 text-end">
              <span className="tabular block text-sm font-bold text-[var(--primary)]">
                {formatMoney(price, currency)}
              </span>
              {full > price && (
                <span className="tabular block text-xs text-[var(--fg-subtle)] line-through">
                  {formatMoney(full, currency)}
                </span>
              )}
            </span>

            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => setForm(rowToInput(b))}>
                تعديل
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => start(async () => void (await toggleOfferAction(b.id, !b.isActive)))}
              >
                {b.isActive ? 'وقّفها' : 'شغّلها'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`احذف ${b.name}`}
                onClick={() => {
                  if (!confirm('هتحذف الباقة دي خالص؟')) return
                  start(async () => void (await deleteOfferAction(b.id)))
                }}
              >
                <Trash2 className="h-4 w-4 text-[var(--color-danger)]" aria-hidden="true" />
              </Button>
            </div>
          </Card>
        )
      })}

      {form && !form.id && (
        <BundleForm
          form={form}
          setForm={setForm}
          products={products}
          currency={currency}
          error={error}
          pending={pending}
          onSave={save}
          onCancel={() => setForm(null)}
        />
      )}

      {!form && (
        <Button variant="secondary" className="self-start" onClick={() => setForm(empty())}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          باقة جديدة
        </Button>
      )}
    </div>
  )
}

function BundleForm({
  form,
  setForm,
  products,
  currency,
  error,
  pending,
  onSave,
  onCancel,
}: {
  form: BundleInput
  setForm: (f: BundleInput) => void
  products: PickProduct[]
  currency: string
  error: string | null
  pending: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const full = form.productIds.reduce((n, id) => n + (byId.get(id)?.price ?? 0), 0)
  const price = Math.round(Number(form.bundlePrice) * 100) || 0
  const saving = full - price

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    /*
      المختارين بيفضلوا ظاهرين مهما كان البحث.

      من غير كده التاجر بيختار تلاتة، يكتب في البحث عشان يلاقي
      الرابع، فيلاقي التلاتة اختفوا ويفتكر إن اختياره ضاع.
    */
    const picked = products.filter((p) => form.productIds.includes(p.id))
    const rest = products.filter(
      (p) => !form.productIds.includes(p.id) && (!q || p.name.toLowerCase().includes(q)),
    )
    return [...picked, ...rest.slice(0, 40)]
  }, [products, query, form.productIds])

  function toggleProduct(id: string) {
    setForm({
      ...form,
      productIds: form.productIds.includes(id)
        ? form.productIds.filter((x) => x !== id)
        : [...form.productIds, id],
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الباقة" required htmlFor="b-name">
          <Input
            id="b-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="طقم الصيف"
            maxLength={80}
          />
        </Field>

        <Field label="شارة على المنتج" htmlFor="b-badge" hint="اختياري — بتظهر على صفحة المنتج">
          <Input
            id="b-badge"
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
            placeholder="وفّر ٧٠ جنيه"
            maxLength={40}
          />
        </Field>
      </div>

      <Field
        label="منتجات الباقة"
        hint="منتجين على الأقل. الخصم بيتطبّق لما العميل يحطّ الطقم كله — لو ناقص واحد، السعر بيرجع لأصله."
      >
        <div className="flex flex-col gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دوّر على منتج…"
            aria-label="بحث في المنتجات"
          />
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
            {shown.map((p) => {
              const on = form.productIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={cn(
                    'flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-start text-sm transition-colors',
                    on ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'hover:bg-[var(--surface-2)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      on ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border-strong)]',
                    )}
                  >
                    {on && <Check className="h-3 w-3 text-[var(--primary-fg)]" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
                    {formatMoney(p.price, currency)}
                  </span>
                </button>
              )
            })}
            {shown.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-[var(--fg-subtle)]">مفيش نتايج</p>
            )}
          </div>
        </div>
      </Field>

      <Field label="سعر الباقة" required htmlFor="b-price" hint={`بالـ${currency === 'EGP' ? 'جنيه' : currency}`}>
        <Input
          id="b-price"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={form.bundlePrice}
          onChange={(e) => setForm({ ...form, bundlePrice: e.target.value })}
          placeholder="350"
        />
      </Field>

      {/*
        الفرق بيتحسب وهو بيكتب.

        التاجر بيفكّر «الطقم بـ٣٥٠» من غير ما يحسب إن ده معناه إنه
        سايب ٧٠ جنيه من هامشه. السطر ده بيوريه الرقم قبل ما يحفظ.
      */}
      {form.productIds.length >= 2 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs">
          <span>
            مجموع المنتجات: <strong className="tabular">{formatMoney(full, currency)}</strong>
          </span>
          {price > 0 &&
            (saving > 0 ? (
              <span className="text-[var(--color-success)]">
                العميل بيوفّر <strong className="tabular">{formatMoney(saving, currency)}</strong> —
                وأنت سايب نفس المبلغ من هامشك
              </span>
            ) : (
              <span className="text-[var(--color-warning)]">
                سعر الباقة مش أقل من مجموع المنتجات — الخصم مش هيتطبّق
              </span>
            ))}
        </div>
      )}

      <Toggle
        label="شغّالة"
        checked={form.isActive}
        onChange={(x) => setForm({ ...form, isActive: x })}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} loading={pending}>
          احفظ الباقة
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" aria-hidden="true" />
          إلغاء
        </Button>
      </div>
    </Card>
  )
}
