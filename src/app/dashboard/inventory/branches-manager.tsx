'use client'

import { useState, useTransition } from 'react'
import { ArrowLeftRight, Check, MapPin, Plus, Star, Trash2, X } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import {
  deleteBranchAction,
  saveBranchAction,
  setBranchLevelAction,
  transferStockAction,
} from './branch-actions'

export type BranchRow = {
  id: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
  isDefault: boolean
  isActive: boolean
}

export type BranchProduct = {
  id: string
  name: string
  /** إجمالي مخزون المنتج — اللي المتجر بيبيع منه */
  total: number
  /** الرصيد لكل فرع: مفتاح الفرع → كمية */
  byBranch: Record<string, number>
}

/**
 * الفروع وتوزيع المخزون.
 *
 * التاجر اللي عنده أكتر من مكان بيسأل سؤالًا واحدًا: «الحتة دي عندي
 * فين؟». الشاشة دي بتجاوب عليه، وبتخلّيه ينقل بين الفروع من غير ما
 * يعدّ من الأول.
 *
 * **الإجمالي بيفضل هو اللي بيبيع.** التوزيع بيقول فين البضاعة قاعدة
 * بس — والفرق بين الاتنين مكتوب على الشاشة عشان التاجر ما يفتكرش
 * إن اللي مش موزّع مش معروض للبيع.
 */
export function BranchesManager({
  branches,
  products,
}: {
  branches: BranchRow[]
  products: BranchProduct[]
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const active = branches.filter((b) => b.isActive)

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      {/* الفروع */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">الفروع والمخازن</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              الفرع الافتراضي هو اللي البيع بيخصم منه. الباقي للتوزيع والنقل.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            فرع جديد
          </button>
        </div>

        {adding && (
          <BranchForm
            onDone={(ok) => {
              setAdding(false)
              if (ok) setMsg({ ok: true, text: 'الفرع اتضاف' })
            }}
            onError={(text) => setMsg({ ok: false, text })}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) =>
            editing === b.id ? (
              <BranchForm
                key={b.id}
                branch={b}
                onDone={(ok) => {
                  setEditing(null)
                  if (ok) setMsg({ ok: true, text: 'اتحفظ' })
                }}
                onError={(text) => setMsg({ ok: false, text })}
              />
            ) : (
              <Card key={b.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-semibold">{b.name}</h3>
                      {b.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          افتراضي
                        </span>
                      )}
                      {!b.isActive && (
                        <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                          موقوف
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                      {[b.city, b.address].filter(Boolean).join('، ') || 'من غير عنوان'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-[var(--border)] pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(b.id)}
                    className="min-h-9 flex-1 rounded-lg bg-[var(--surface-2)] text-sm font-medium transition-colors hover:bg-[var(--border)]"
                  >
                    تعديل
                  </button>
                  {!b.isDefault && (
                    <DeleteBranch id={b.id} onError={(text) => setMsg({ ok: false, text })} />
                  )}
                </div>
              </Card>
            ),
          )}
        </div>
      </section>

      {/* التوزيع */}
      {active.length > 0 && products.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">توزيع المخزون</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              اكتب الموجود في كل فرع. لو المجموع أقل من الإجمالي، الفرق معناه كمية
              لسه ما اتوزّعتش — وهي معروضة للبيع عادي.
            </p>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="scroll-x">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="p-3 text-start font-medium">المنتج</th>
                    <th className="p-3 text-center font-medium">الإجمالي</th>
                    {active.map((b) => (
                      <th key={b.id} className="p-3 text-center font-medium">
                        {b.name}
                      </th>
                    ))}
                    <th className="p-3 text-center font-medium">مش موزّع</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const assigned = active.reduce((n, b) => n + (p.byBranch[b.id] ?? 0), 0)
                    const rest = p.total - assigned
                    return (
                      <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="p-3">
                          <span className="line-clamp-1">{p.name}</span>
                        </td>
                        <td className="tabular p-3 text-center font-semibold">{p.total}</td>
                        {active.map((b) => (
                          <td key={b.id} className="p-2 text-center">
                            <LevelInput
                              locationId={b.id}
                              productId={p.id}
                              initial={p.byBranch[b.id] ?? 0}
                              onError={(text) => setMsg({ ok: false, text })}
                            />
                          </td>
                        ))}
                        <td
                          className={`tabular p-3 text-center ${
                            rest < 0 ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--fg-muted)]'
                          }`}
                          title={rest < 0 ? 'وزّعت أكتر من الإجمالي — راجع الأرقام' : undefined}
                        >
                          {rest}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {active.length > 1 && (
            <TransferForm
              branches={active}
              products={products}
              onDone={(text) => setMsg({ ok: true, text })}
              onError={(text) => setMsg({ ok: false, text })}
            />
          )}
        </section>
      )}
    </div>
  )
}

function BranchForm({
  branch,
  onDone,
  onError,
}: {
  branch?: BranchRow
  onDone: (ok: boolean) => void
  onError: (text: string) => void
}) {
  const [name, setName] = useState(branch?.name ?? '')
  const [city, setCity] = useState(branch?.city ?? '')
  const [address, setAddress] = useState(branch?.address ?? '')
  const [phone, setPhone] = useState(branch?.phone ?? '')
  const [isDefault, setIsDefault] = useState(branch?.isDefault ?? false)
  const [isActive, setIsActive] = useState(branch?.isActive ?? true)
  const [pending, start] = useTransition()

  const field =
    'min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <Card className="flex flex-col gap-3 p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الفرع" className={field} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="المحافظة" className={field} />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="تليفون الفرع"
          dir="ltr"
          className={`${field} text-start`}
        />
      </div>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="العنوان"
        className={field}
      />

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          الفرع الافتراضي (البيع بيخصم منه)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          شغّال
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveBranchAction({
                id: branch?.id,
                name,
                city,
                address,
                phone,
                isDefault,
                isActive,
              })
              if (res?.error) {
                onError(res.error)
                return
              }
              onDone(true)
            })
          }
          className="min-h-10 flex-1 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-60"
        >
          {pending ? 'بيتحفظ…' : 'حفظ'}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          aria-label="إلغاء"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Card>
  )
}

function DeleteBranch({ id, onError }: { id: string; onError: (t: string) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="حذف الفرع"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-subtle)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteBranchAction(id)
          if (res?.error) {
            onError(res.error)
            setConfirming(false)
          }
        })
      }
      className="min-h-9 rounded-lg bg-[var(--color-danger)] px-3 text-xs font-medium text-white disabled:opacity-60"
    >
      {pending ? '…' : 'أكّد الحذف'}
    </button>
  )
}

/**
 * خانة رصيد فرع.
 *
 * بتتحفظ لما التاجر يسيبها لا مع كل حرف: التاجر بيمسح ٥ ويكتب ١٢،
 * والحفظ مع كل ضغطة كان هيسجّل صفر في النص.
 */
function LevelInput({
  locationId,
  productId,
  initial,
  onError,
}: {
  locationId: string
  productId: string
  initial: number
  onError: (t: string) => void
}) {
  const [value, setValue] = useState(String(initial))
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const commit = () => {
    const n = Number(value)
    if (!Number.isFinite(n) || n === initial) return
    start(async () => {
      const res = await setBranchLevelAction({ locationId, productId, available: n })
      if (res?.error) {
        onError(res.error)
        setValue(String(initial))
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  return (
    <span className="relative inline-flex">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        inputMode="numeric"
        dir="ltr"
        aria-label="الرصيد في الفرع"
        className="tabular h-10 w-16 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-center text-sm focus:border-[var(--primary)] focus:outline-none"
      />
      {(saved || pending) && (
        <Check
          className={`absolute -end-1 -top-1 h-3.5 w-3.5 ${
            pending ? 'text-[var(--fg-subtle)]' : 'text-[var(--color-success)]'
          }`}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

function TransferForm({
  branches,
  products,
  onDone,
  onError,
}: {
  branches: BranchRow[]
  products: BranchProduct[]
  onDone: (t: string) => void
  onError: (t: string) => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [fromId, setFromId] = useState(branches[0]?.id ?? '')
  const [toId, setToId] = useState(branches[1]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [pending, start] = useTransition()

  const select =
    'min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />
        <h3 className="font-semibold">نقل بين الفروع</h3>
      </div>
      <p className="text-xs text-[var(--fg-muted)]">
        النقل بيحرّك الكمية بس — الإجمالي ما بيتغيّرش، والحركتين بيتسجّلوا في سجل المخزون.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={select}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={select}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              من: {b.name}
            </option>
          ))}
        </select>

        <select value={toId} onChange={(e) => setToId(e.target.value)} className={select}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              إلى: {b.name}
            </option>
          ))}
        </select>

        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          dir="ltr"
          placeholder="الكمية"
          className={`${select} text-start`}
        />
      </div>

      <button
        type="button"
        disabled={pending || !quantity}
        onClick={() =>
          start(async () => {
            const res = await transferStockAction({
              fromId,
              toId,
              productId,
              quantity: Number(quantity),
            })
            if (res?.error) {
              onError(res.error)
              return
            }
            setQuantity('')
            onDone('اتنقلت')
          })
        }
        className="min-h-10 w-fit rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-60"
      >
        {pending ? 'بينقل…' : 'انقل'}
      </button>
    </Card>
  )
}
