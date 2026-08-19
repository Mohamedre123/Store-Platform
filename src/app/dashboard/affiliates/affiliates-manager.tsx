'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Plus, Trash2, Users, Wallet, X } from 'lucide-react'
import {
  deleteAffiliateAction,
  payAffiliateAction,
  saveAffiliateAction,
  type AffiliateInput,
} from './actions'
import { Alert, Button, Card } from '@/components/ui'
import { Choice, Toggle } from '@/components/dashboard/controls'
import { formatMoney } from '@/lib/utils'

export type AffiliateRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  code: string
  commissionType: 'percent' | 'fixed'
  commissionValue: number
  balance: number
  totalEarned: number
  totalPaid: number
  clicks: number
  conversions: number
  isActive: boolean
}

const emptyAffiliate = (): AffiliateInput => ({
  name: '',
  phone: '',
  email: '',
  code: '',
  commissionType: 'percent',
  commissionValue: '10',
  isActive: true,
})

const field =
  'h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

export function AffiliatesManager({
  affiliates,
  currency,
  storeUrl,
}: {
  affiliates: AffiliateRow[]
  currency: string
  storeUrl: string
}) {
  const [form, setForm] = useState<AffiliateInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await saveAffiliateAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!form && (
        <Button onClick={() => setForm(emptyAffiliate())} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          مسوّق جديد
        </Button>
      )}

      {form && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{form.id ? 'تعديل المسوّق' : 'مسوّق جديد'}</h2>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">الاسم</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">كود الإحالة</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                dir="ltr"
                placeholder="AHMED"
                className={`${field} text-start font-mono uppercase`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">التليفون</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                dir="ltr"
                className={`${field} text-start`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">البريد</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                dir="ltr"
                className={`${field} text-start`}
              />
            </label>
          </div>

          <Choice
            label="نوع العمولة"
            value={form.commissionType}
            options={[
              { value: 'percent' as const, label: 'نسبة ٪' },
              { value: 'fixed' as const, label: 'مبلغ ثابت' },
            ]}
            onChange={(v) => setForm({ ...form, commissionType: v })}
            columns={2}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {form.commissionType === 'percent' ? 'النسبة (%)' : `المبلغ (${currency})`}
            </span>
            <input
              value={form.commissionValue}
              onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
              inputMode="decimal"
              dir="ltr"
              className={`${field} w-40 text-start tabular-nums`}
            />
            <span className="text-xs text-[var(--fg-subtle)]">
              العمولة بتتحسب على المنتجات بعد الخصم — من غير الشحن.
            </span>
          </label>

          <Toggle
            label="مفعّل"
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />

          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              حفظ
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {affiliates.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Users className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مافيش مسوّقين</h2>
          <p className="max-w-sm text-sm text-[var(--fg-muted)]">
            ادّي كود لكل مسوّق، وكل بيعة تيجي من رابطه تتحسبله عمولة تلقائيًا.
          </p>
        </Card>
      ) : (
        affiliates.map((a) => (
          <AffiliateCard
            key={a.id}
            affiliate={a}
            currency={currency}
            storeUrl={storeUrl}
            onEdit={() =>
              setForm({
                id: a.id,
                name: a.name,
                phone: a.phone ?? '',
                email: a.email ?? '',
                code: a.code,
                commissionType: a.commissionType,
                commissionValue:
                  a.commissionType === 'percent'
                    ? String(a.commissionValue / 100)
                    : String(a.commissionValue / 100),
                isActive: a.isActive,
              })
            }
          />
        ))
      )}
    </div>
  )
}

function AffiliateCard({
  affiliate: a,
  currency,
  storeUrl,
  onEdit,
}: {
  affiliate: AffiliateRow
  currency: string
  storeUrl: string
  onEdit: () => void
}) {
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)
  const link = `${storeUrl}?ref=${a.code}`

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{a.name}</span>
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 font-mono text-xs">
              {a.code}
            </span>
            {!a.isActive && (
              <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-subtle)]">
                متوقّف
              </span>
            )}
          </div>
          <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
            عمولة{' '}
            {a.commissionType === 'percent'
              ? `${a.commissionValue / 100}٪`
              : formatMoney(a.commissionValue, currency)}{' '}
            · {a.clicks} ضغطة · {a.conversions} بيعة
          </span>
        </div>

        <div className="text-end">
          <span className="tabular block font-bold">{formatMoney(a.balance, currency)}</span>
          <span className="block text-xs text-[var(--fg-subtle)]">رصيد مستحق</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? 'اتنسخ' : 'انسخ رابطه'}
        </button>

        {a.balance > 0 && (
          <button
            type="button"
            onClick={() => start(() => payAffiliateAction(a.id).then(() => {}))}
            disabled={pending}
            className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            سجّل صرف {formatMoney(a.balance, currency)}
          </button>
        )}

        <button
          type="button"
          onClick={onEdit}
          className="min-h-9 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          تعديل
        </button>

        <button
          type="button"
          onClick={() => start(() => deleteAffiliateAction(a.id).then(() => {}))}
          disabled={pending}
          aria-label="حذف"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>

        {a.totalPaid > 0 && (
          <span className="ms-auto text-xs text-[var(--fg-subtle)]">
            اتصرفله {formatMoney(a.totalPaid, currency)}
          </span>
        )}
      </div>
    </Card>
  )
}
