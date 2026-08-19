'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Mail, Phone, Plus, Truck, Users } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { deleteSupplierAction, saveSupplierAction, setProductSupplierAction } from './actions'

export type SupplierRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  defaultMarginBps: number
  productCount: number
  isActive: boolean
}

export type ReorderRow = {
  id: string
  name: string
  sku: string | null
  stock: number
  lowStockThreshold: number
  costPrice: number | null
  supplierId: string | null
}

type ProductRow = { id: string; name: string; supplierId: string | null }

export function SuppliersManager({
  suppliers,
  reorder,
  products,
  unlinkedCount,
  currency,
}: {
  suppliers: SupplierRow[]
  reorder: ReorderRow[]
  products: ProductRow[]
  unlinkedCount: number
  currency: string
}) {
  const [adding, setAdding] = useState(false)

  /** إعادة الطلب مجمّعة على المورّد — واللي من غير مورّد في مجموعة لوحده */
  const groups = useMemo(() => {
    const byId = new Map(suppliers.map((s) => [s.id, s]))
    const map = new Map<string, { supplier: SupplierRow | null; items: ReorderRow[] }>()

    for (const item of reorder) {
      const key = item.supplierId ?? '—'
      if (!map.has(key)) {
        map.set(key, { supplier: item.supplierId ? (byId.get(item.supplierId) ?? null) : null, items: [] })
      }
      map.get(key)!.items.push(item)
    }

    // اللي من غير مورّد آخر واحد: التاجر يقدر يتصرّف في اللي معروف أولًا
    return [...map.entries()].sort((a, b) => (a[0] === '—' ? 1 : b[0] === '—' ? -1 : 0))
  }, [reorder, suppliers])

  return (
    <div className="flex flex-col gap-6">
      {reorder.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" aria-hidden="true" />
            محتاج تطلبه
            <span className="tabular font-normal text-[var(--fg-muted)]">({reorder.length})</span>
          </h2>

          {groups.map(([key, group]) => (
            <Card key={key} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {group.supplier?.name ?? 'من غير مورّد محدّد'}
                </span>
                {group.supplier?.phone && (
                  <a
                    href={`tel:${group.supplier.phone}`}
                    className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {group.supplier.phone}
                  </a>
                )}
              </div>

              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {group.items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    {p.sku && (
                      <span className="tabular text-xs text-[var(--fg-subtle)]">{p.sku}</span>
                    )}
                    <span
                      className="tabular text-sm font-medium"
                      style={{ color: p.stock === 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}
                    >
                      {p.stock === 0 ? 'نفد' : `باقي ${p.stock}`}
                    </span>
                    {p.costPrice ? (
                      <span className="tabular text-xs text-[var(--fg-subtle)]">
                        تكلفة {formatMoney(p.costPrice, currency)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Users className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />
            الموردون
            <span className="tabular font-normal text-[var(--fg-muted)]">({suppliers.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            مورّد جديد
          </button>
        </div>

        {adding && <SupplierForm onDone={() => setAdding(false)} />}

        {suppliers.length === 0 && !adding ? (
          <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Truck className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h3 className="font-semibold">مافيش موردين مسجّلين</h3>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              سجّل مورّدينك واربط كل منتج بمورّده، وهتلاقي هنا قايمة جاهزة بكل
              اللي قرّب يخلص — مرتّبة على مين تكلّمه.
            </p>
          </Card>
        ) : (
          suppliers.map((s) => (
            <SupplierCard key={s.id} row={s} products={products} unlinkedCount={unlinkedCount} />
          ))
        )}
      </section>
    </div>
  )
}

function SupplierCard({
  row: s,
  products,
  unlinkedCount,
}: {
  row: SupplierRow
  products: ProductRow[]
  unlinkedCount: number
}) {
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)
  const [pending, start] = useTransition()

  const mine = products.filter((p) => p.supplierId === s.id)
  const free = products.filter((p) => !p.supplierId)

  if (editing) {
    return <SupplierForm existing={s} onDone={() => setEditing(false)} />
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{s.name}</span>
            {!s.isActive && (
              <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                موقوف
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--fg-muted)]">
            <span className="tabular">{mine.length} منتج</span>
            <span className="tabular">هامش مقترح {s.defaultMarginBps / 100}٪</span>
            {s.phone && (
              <a
                href={`tel:${s.phone}`}
                className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {s.phone}
              </a>
            )}
            {s.email && (
              <a
                href={`mailto:${s.email}`}
                className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {s.email}
              </a>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLinking((v) => !v)}
            className="min-h-9 rounded-lg border border-[var(--border-strong)] px-3 text-sm transition-colors hover:bg-[var(--surface-2)]"
          >
            المنتجات
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-9 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            تعديل
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => deleteSupplierAction(s.id).then(() => {}))}
            className="min-h-9 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--color-danger)] disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      </div>

      {linking && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3">
          {mine.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {mine.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(() => setProductSupplierAction(p.id, null).then(() => {}))}
                    className="text-xs text-[var(--fg-muted)] hover:text-[var(--color-danger)] disabled:opacity-60"
                  >
                    فكّ الربط
                  </button>
                </li>
              ))}
            </ul>
          )}

          {free.length > 0 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--fg-muted)]">
                اربط منتج بالمورّد ده
              </span>
              <select
                value=""
                disabled={pending}
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  start(() => setProductSupplierAction(id, s.id).then(() => {}))
                }}
                className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="">اختار منتج…</option>
                {free.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-[var(--fg-subtle)]">
              {unlinkedCount === 0
                ? 'كل منتجاتك مربوطة بموردين.'
                : 'كل المنتجات الباقية مربوطة بموردين تانيين.'}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function SupplierForm({ existing, onDone }: { existing?: SupplierRow; onDone: () => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [margin, setMargin] = useState(String((existing?.defaultMarginBps ?? 3000) / 100))
  const [active, setActive] = useState(existing?.isActive ?? true)

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="اسم المورّد">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مصنع النور"
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>
        <Field label="تليفون">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="01xxxxxxxxx"
            className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>
        <Field label="إيميل">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            placeholder="اختياري"
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>
        <Field label="هامش الربح المقترح (٪)">
          <input
            value={margin}
            onChange={(e) => setMargin(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode="decimal"
            className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        مورّد نشط
      </label>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await saveSupplierAction({
                id: existing?.id,
                name,
                phone,
                email,
                defaultMarginPercent: margin ? Number(margin) : 30,
                isActive: active,
              })
              if (res?.error) setError(res.error)
              else onDone()
            })
          }
          className="min-h-10 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
        >
          {pending ? 'بيتحفظ…' : 'حفظ'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-10 rounded-lg px-3 text-sm text-[var(--fg-muted)]"
        >
          إلغاء
        </button>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
      {children}
    </label>
  )
}
