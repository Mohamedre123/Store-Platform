'use client'

import { useState, useTransition } from 'react'
import { Gift, Plus } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { REWARD_TYPES, TIER_LABELS, TIER_ORDER } from '@/lib/rewards-meta'
import { deleteRewardAction, saveRewardAction } from './rewards-actions'

export type RewardItem = {
  id: string
  name: string
  description: string | null
  type: 'coupon_percent' | 'coupon_fixed' | 'free_shipping' | 'free_product'
  value: number
  pointsCost: number
  minTier: string | null
  stock: number | null
  redeemedCount: number
  isActive: boolean
}

export function RewardsForm({ rewards, currency }: { rewards: RewardItem[]; currency: string }) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">متجر المكافآت</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            النقاط من غير حاجة تتصرف فيها مجرد رقم بيكبر. حدّد العميل ياخد إيه
            مقابل كام نقطة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          مكافأة جديدة
        </button>
      </div>

      {adding && <RewardForm onDone={() => setAdding(false)} />}

      {rewards.length === 0 && !adding ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Gift className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
          <p className="text-sm text-[var(--fg-muted)]">
            مافيش مكافآت. من غيرها العميل بيجمع نقاطًا ما بيقدرش يستخدمها.
          </p>
        </Card>
      ) : (
        rewards.map((r) => <RewardCard key={r.id} row={r} currency={currency} />)
      )}
    </div>
  )
}

function RewardCard({ row: r, currency }: { row: RewardItem; currency: string }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()

  if (editing) return <RewardForm existing={r} onDone={() => setEditing(false)} />

  const worth =
    r.type === 'coupon_percent'
      ? `خصم ${r.value / 100}٪`
      : r.type === 'coupon_fixed'
        ? `خصم ${formatMoney(r.value, currency)}`
        : r.type === 'free_shipping'
          ? 'شحن مجاني'
          : 'منتج مجاني'

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{r.name}</span>
          <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
            {worth}
          </span>
          {r.minTier && (
            <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-xs text-[var(--primary)]">
              {TIER_LABELS[r.minTier as keyof typeof TIER_LABELS]} فأعلى
            </span>
          )}
          {!r.isActive && (
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
              موقوفة
            </span>
          )}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[var(--fg-muted)]">
          <span className="tabular font-medium text-[var(--primary)]">{r.pointsCost} نقطة</span>
          {r.stock !== null && <span className="tabular">باقي {r.stock}</span>}
          {r.redeemedCount > 0 && <span className="tabular">اتسحبت {r.redeemedCount} مرة</span>}
        </p>
      </div>

      <div className="flex gap-1.5">
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
          onClick={() => start(() => deleteRewardAction(r.id).then(() => {}))}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--color-danger)] disabled:opacity-60"
        >
          حذف
        </button>
      </div>
    </Card>
  )
}

function RewardForm({ existing, onDone }: { existing?: RewardItem; onDone: () => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [type, setType] = useState<RewardItem['type']>(existing?.type ?? 'coupon_percent')
  const [value, setValue] = useState(existing ? String(existing.value / 100) : '10')
  const [pointsCost, setPointsCost] = useState(String(existing?.pointsCost ?? 100))
  const [minTier, setMinTier] = useState(existing?.minTier ?? '')
  const [limited, setLimited] = useState(existing?.stock !== null && existing !== undefined)
  const [stock, setStock] = useState(String(existing?.stock ?? 50))
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)

  const needsValue = type === 'coupon_percent' || type === 'coupon_fixed'
  const unit = REWARD_TYPES.find((t) => t.key === type)?.unit

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="اسم المكافأة">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="خصم ١٠٪ على أي طلب"
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>

        <Field label="النوع">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RewardItem['type'])}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          >
            {REWARD_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {needsValue && (
          <Field label={`القيمة (${unit})`}>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </Field>
        )}

        <Field label="سعرها بالنقاط">
          <input
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>

        <Field label="أقل مستوى">
          <select
            value={minTier}
            onChange={(e) => setMinTier(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="">أي مستوى</option>
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]} فأعلى
              </option>
            ))}
          </select>
        </Field>

        {limited && (
          <Field label="الكمية المتاحة">
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </Field>
        )}
      </div>

      <Field label="وصف قصير (اختياري)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="بيتطبّق على أي منتج، صالح ٩٠ يوم"
          className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={limited}
            onChange={(e) => setLimited(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          كمية محدودة
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          معروضة للعملاء
        </label>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await saveRewardAction({
                id: existing?.id,
                name,
                description,
                type,
                value: needsValue ? Number(value || 0) : 0,
                pointsCost: Number(pointsCost || 0),
                minTier: minTier || null,
                stock: limited ? Number(stock || 0) : null,
                isActive,
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
