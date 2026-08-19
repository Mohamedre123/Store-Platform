'use client'

import { useState, useTransition } from 'react'
import { Check, Layers, Plus, Trash2, X } from 'lucide-react'
import { deleteOfferAction, saveOfferAction, toggleOfferAction, type OfferInput } from './offer-actions'
import { Alert, Button, Card } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'

export type OfferRow = {
  id: string
  name: string
  badge: string | null
  config: { tiers?: Array<{ qty: number; discountBps: number }> }
  productIds: string[]
  isActive: boolean
}

const emptyOffer = (): OfferInput => ({
  name: '',
  badge: '',
  tiers: [{ qty: '2', percent: '10' }],
  productIds: [],
  isActive: true,
})

function rowToInput(o: OfferRow): OfferInput {
  return {
    id: o.id,
    name: o.name,
    badge: o.badge ?? '',
    tiers: (o.config.tiers ?? []).map((t) => ({
      qty: String(t.qty),
      percent: String(t.discountBps / 100),
    })),
    productIds: o.productIds,
    isActive: o.isActive,
  }
}

export function OffersManager({
  offers,
  products,
}: {
  offers: OfferRow[]
  products: Array<{ id: string; name: string }>
}) {
  const [form, setForm] = useState<OfferInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await saveOfferAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  const field =
    'h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <div className="flex flex-col gap-4">
      {!form && (
        <Button variant="secondary" onClick={() => setForm(emptyOffer())} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          عرض كمية جديد
        </Button>
      )}

      {form && (
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{form.id ? 'تعديل العرض' : 'عرض كمية جديد'}</h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              aria-label="إغلاق"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">اسم العرض</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="خصم الكمية"
              className={field}
            />
            <span className="text-xs text-[var(--fg-subtle)]">بيظهر للعميل في ملخّص الطلب.</span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">الشرائح</span>
            {form.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-[var(--fg-muted)]">اشترِ</span>
                <input
                  value={t.qty}
                  onChange={(e) => {
                    const tiers = [...form.tiers]
                    tiers[i] = { ...t, qty: e.target.value }
                    setForm({ ...form, tiers })
                  }}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} w-20 text-start tabular-nums`}
                />
                <span className="text-sm text-[var(--fg-muted)]">ووفّر</span>
                <input
                  value={t.percent}
                  onChange={(e) => {
                    const tiers = [...form.tiers]
                    tiers[i] = { ...t, percent: e.target.value }
                    setForm({ ...form, tiers })
                  }}
                  inputMode="decimal"
                  dir="ltr"
                  className={`${field} w-20 text-start tabular-nums`}
                />
                <span className="text-sm text-[var(--fg-muted)]">٪</span>
                {form.tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, j) => j !== i) })}
                    aria-label="حذف الشريحة"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, tiers: [...form.tiers, { qty: '', percent: '' }] })
              }
              className="w-fit text-sm font-medium text-[var(--primary)] hover:underline"
            >
              + ضيف شريحة
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">ينطبق على</span>
            <p className="text-xs text-[var(--fg-subtle)]">
              سيبها فاضية عشان ينطبق على كل المنتجات.
            </p>
            {products.length > 0 && (
              <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={form.productIds.includes(p.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          productIds: e.target.checked
                            ? [...form.productIds, p.id]
                            : form.productIds.filter((id) => id !== p.id),
                        })
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Toggle
            label="مفعّل"
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />

          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              حفظ العرض
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {offers.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">
          مافيش عروض كمية. «اشترِ ٣ ووفّر ١٥٪» بترفع قيمة الطلب من غير ما تخصم من هامش المنتج الواحد.
        </p>
      ) : (
        offers.map((o) => (
          <OfferCard key={o.id} offer={o} onEdit={() => setForm(rowToInput(o))} />
        ))
      )}
    </div>
  )
}

function OfferCard({ offer: o, onEdit }: { offer: OfferRow; onEdit: () => void }) {
  const [pending, start] = useTransition()
  const tiers = o.config.tiers ?? []

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        <Layers className="h-5 w-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <span className="font-medium">{o.name}</span>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          {tiers.map((t) => `${t.qty} ← ${t.discountBps / 100}٪`).join(' · ')}
          {o.productIds.length > 0 ? ` · ${o.productIds.length} منتج` : ' · كل المنتجات'}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={o.isActive}
        aria-label={o.isActive ? 'إيقاف العرض' : 'تفعيل العرض'}
        disabled={pending}
        onClick={() => start(() => toggleOfferAction(o.id, !o.isActive).then(() => {}))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          o.isActive ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            o.isActive ? 'start-0.5' : 'start-[1.375rem]'
          }`}
        />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
      >
        تعديل
      </button>

      <button
        type="button"
        onClick={() => start(() => deleteOfferAction(o.id).then(() => {}))}
        disabled={pending}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
