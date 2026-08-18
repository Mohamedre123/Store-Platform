'use client'

import { useState, useTransition } from 'react'
import { Check, Percent, Plus, Tag, Ticket, Trash2, X } from 'lucide-react'
import { saveCouponAction, toggleCouponAction, deleteCouponAction, type CouponInput } from './actions'
import type { CouponAppliesTo, CouponEligibility, CouponType } from '@/db/schema'
import { Alert, Button, Card } from '@/components/ui'
import { Choice, Toggle } from '@/components/dashboard/controls'
import { formatMoney } from '@/lib/utils'

// ملاحظة: Toggle مستخدم في الفورم، والمفتاح المضغوط في البطاقة مكتوب يدويًا

export type CouponRow = {
  id: string
  code: string
  description: string | null
  type: CouponType
  value: number
  maxDiscount: number
  minOrder: number
  appliesTo: CouponAppliesTo
  targetIds: string[]
  eligibility: CouponEligibility
  usageLimit: number | null
  usageLimitPerCustomer: number
  usedCount: number
  startsAt: Date | null
  endsAt: Date | null
  isActive: boolean
}

type NamedRef = { id: string; name: string }

const TYPE_LABEL: Record<CouponType, string> = {
  percent: 'نسبة %',
  fixed: 'مبلغ ثابت',
  free_shipping: 'شحن مجاني',
}

const ELIGIBILITY_LABEL: Record<CouponEligibility, string> = {
  all: 'كل العملاء',
  first_order: 'أول طلب بس',
  tier: 'مستوى ولاء',
  specific_customers: 'عملاء محددين',
}

const emptyForm = (): CouponInput => ({
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

const toDateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')

function rowToForm(c: CouponRow): CouponInput {
  return {
    id: c.id,
    code: c.code,
    description: c.description ?? '',
    type: c.type,
    value: c.type === 'percent' ? String(c.value / 100) : c.type === 'fixed' ? String(c.value / 100) : '',
    maxDiscount: c.maxDiscount ? String(c.maxDiscount / 100) : '',
    minOrder: c.minOrder ? String(c.minOrder / 100) : '',
    appliesTo: c.appliesTo,
    targetIds: c.targetIds,
    eligibility: c.eligibility,
    usageLimit: c.usageLimit ? String(c.usageLimit) : '',
    usageLimitPerCustomer: String(c.usageLimitPerCustomer),
    startsAt: toDateInput(c.startsAt),
    endsAt: toDateInput(c.endsAt),
    isActive: c.isActive,
  }
}

export function CouponsManager({
  coupons,
  currency,
  products,
  categories,
}: {
  coupons: CouponRow[]
  currency: string
  products: NamedRef[]
  categories: NamedRef[]
}) {
  const [form, setForm] = useState<CouponInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const set = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await saveCouponAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {!form && (
        <Button onClick={() => setForm(emptyForm())} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          كوبون جديد
        </Button>
      )}

      {form && (
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{form.id ? 'تعديل الكوبون' : 'كوبون جديد'}</h2>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">كود الخصم</span>
            <input
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="EID25"
              dir="ltr"
              className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-sm uppercase tracking-wider focus:border-[var(--primary)] focus:outline-none"
            />
            <span className="text-xs text-[var(--fg-subtle)]">ده اللي العميل بيكتبه في الشيك أوت. حروف وأرقام إنجليزية.</span>
          </label>

          <Choice
            label="نوع الخصم"
            value={form.type}
            options={[
              { value: 'percent' as const, label: 'نسبة %' },
              { value: 'fixed' as const, label: 'مبلغ ثابت' },
              { value: 'free_shipping' as const, label: 'شحن مجاني' },
            ]}
            onChange={(v) => set('type', v)}
            columns={3}
          />

          {form.type !== 'free_shipping' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {form.type === 'percent' ? 'النسبة (%)' : `قيمة الخصم (${currency})`}
              </span>
              <input
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                inputMode="decimal"
                dir="ltr"
                placeholder={form.type === 'percent' ? '25' : '50'}
                className="h-11 w-40 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          )}

          {form.type === 'percent' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">أقصى خصم (اختياري)</span>
              <input
                value={form.maxDiscount}
                onChange={(e) => set('maxDiscount', e.target.value)}
                inputMode="decimal"
                dir="ltr"
                placeholder="200"
                className="h-11 w-40 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
              <span className="text-xs text-[var(--fg-subtle)]">سقف للخصم مهما كان الطلب كبير.</span>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">أقل مبلغ للطلب (اختياري)</span>
            <input
              value={form.minOrder}
              onChange={(e) => set('minOrder', e.target.value)}
              inputMode="decimal"
              dir="ltr"
              placeholder="500"
              className="h-11 w-40 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
            />
          </label>

          <Choice
            label="ينطبق على"
            value={form.appliesTo}
            options={[
              { value: 'all' as const, label: 'كل المنتجات' },
              { value: 'products' as const, label: 'منتجات محددة' },
              { value: 'categories' as const, label: 'أقسام محددة' },
            ]}
            onChange={(v) => set('appliesTo', v)}
            columns={3}
          />

          {form.appliesTo !== 'all' && (
            <TargetPicker
              items={form.appliesTo === 'products' ? products : categories}
              selected={form.targetIds}
              onChange={(ids) => set('targetIds', ids)}
            />
          )}

          <Choice
            label="مين يقدر يستخدمه"
            value={form.eligibility}
            options={[
              { value: 'all' as const, label: 'الكل' },
              { value: 'first_order' as const, label: 'أول طلب' },
            ]}
            onChange={(v) => set('eligibility', v)}
            columns={2}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">حد الاستخدام الكلي (اختياري)</span>
              <input
                value={form.usageLimit}
                onChange={(e) => set('usageLimit', e.target.value)}
                inputMode="numeric"
                dir="ltr"
                placeholder="بدون حد"
                className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">حد الاستخدام لكل عميل</span>
              <input
                value={form.usageLimitPerCustomer}
                onChange={(e) => set('usageLimitPerCustomer', e.target.value)}
                inputMode="numeric"
                dir="ltr"
                className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">يبدأ (اختياري)</span>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                dir="ltr"
                className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">ينتهي (اختياري)</span>
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
                dir="ltr"
                className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          </div>

          <Toggle label="مفعّل" checked={form.isActive} onChange={(v) => set('isActive', v)} />

          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              {form.id ? 'حفظ التعديل' : 'إنشاء الكوبون'}
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {coupons.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Ticket className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">لسه مافيش كوبونات</h2>
          <p className="max-w-sm text-sm text-[var(--fg-muted)]">
            الكوبونات بترفع المبيعات في المواسم والحملات. اعمل أول واحد فوق.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              currency={currency}
              onEdit={() => {
                setError(null)
                setForm(rowToForm(c))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CouponCard({ coupon: c, currency, onEdit }: { coupon: CouponRow; currency: string; onEdit: () => void }) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const amount =
    c.type === 'percent'
      ? `${c.value / 100}%`
      : c.type === 'fixed'
        ? formatMoney(c.value, currency)
        : 'شحن مجاني'

  const expired = c.endsAt && new Date(c.endsAt) < new Date()
  const usedUp = c.usageLimit !== null && c.usedCount >= c.usageLimit
  const live = c.isActive && !expired && !usedUp

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ background: live ? 'var(--primary-soft)' : 'var(--surface-2)', color: live ? 'var(--primary)' : 'var(--fg-subtle)' }}
      >
        {c.type === 'percent' ? <Percent className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold tracking-wider">{c.code}</span>
          <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">{amount}</span>
          {!live && (
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-subtle)]">
              {!c.isActive ? 'متوقّف' : expired ? 'منتهي' : 'خلص'}
            </span>
          )}
        </div>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          {c.minOrder ? `فوق ${formatMoney(c.minOrder, currency)} · ` : ''}
          {ELIGIBILITY_LABEL[c.eligibility]} · استُخدم {c.usedCount}
          {c.usageLimit !== null ? ` من ${c.usageLimit}` : ''} مرة
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={c.isActive}
        aria-label={c.isActive ? 'إيقاف الكوبون' : 'تفعيل الكوبون'}
        disabled={pending}
        onClick={() => start(() => toggleCouponAction(c.id, !c.isActive).then(() => {}))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          c.isActive ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            c.isActive ? 'start-0.5' : 'start-[1.375rem]'
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

      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => start(() => deleteCouponAction(c.id).then(() => {}))}
            disabled={pending}
            className="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-sm font-medium text-white"
          >
            تأكيد الحذف
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2 py-2 text-sm text-[var(--fg-muted)]"
          >
            تراجع
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="حذف"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </Card>
  )
}

function TargetPicker({
  items,
  selected,
  onChange,
}: {
  items: NamedRef[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const set = new Set(selected)
  const toggle = (id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  if (items.length === 0) {
    return <p className="text-sm text-[var(--fg-subtle)]">مافيش عناصر تختار منها لسه.</p>
  }

  return (
    <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
      {items.map((it) => (
        <label
          key={it.id}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]"
        >
          <input
            type="checkbox"
            checked={set.has(it.id)}
            onChange={() => toggle(it.id)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="truncate">{it.name}</span>
        </label>
      ))}
    </div>
  )
}
