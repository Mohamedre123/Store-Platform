'use client'

import { useMemo, useState, useTransition } from 'react'
import { Pencil, Plus, Repeat, Trash2, X } from 'lucide-react'
import { deleteExpenseAction, saveExpenseAction } from './actions'
import { EXPENSE_CATEGORIES, EXPENSE_COLORS, expenseLabel } from '@/lib/expenses'
import type { ExpenseCategory } from '@/db/schema'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { toast } from '@/components/dashboard/toast'
import { cn, formatMoney, fromMinorUnits, toMinorUnits } from '@/lib/utils'

export type ExpenseRow = {
  id: string
  title: string
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  isRecurring: boolean
}

export type CategoryTotal = { category: ExpenseCategory; total: number }

/**
 * شاشة المصروفات.
 *
 * ## الشكل ده مقصود
 * التاجر بيسجّل مصروف واحد ويقفل الشاشة. أي خطوة زيادة — نموذج
 * في صفحة لوحدها، أو تصنيفات لازم يبنيها الأول — بتخلّيه يأجّل،
 * وبعد أسبوعين يبقى عنده تقرير ربح مبني على نص المصاريف.
 *
 * فالنموذج جوّه الصفحة، والتصنيفات جاهزة، والتاريخ بيفتح على
 * النهارده. الحاجة الوحيدة اللي بيكتبها من الأول: المبلغ وعلى إيه.
 */
export function ExpensesManager({
  rows,
  totals,
  currency,
  monthTotal,
}: {
  rows: ExpenseRow[]
  totals: CategoryTotal[]
  currency: string
  monthTotal: number
}) {
  const [editing, setEditing] = useState<ExpenseRow | 'new' | null>(null)
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all')

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter],
  )

  const biggest = totals.length ? Math.max(...totals.map((t) => t.total)) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* التوزيع — التاجر بيشوف فلوسه رايحة فين قبل أي حاجة تانية */}
      {totals.length > 0 && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">فلوسك رايحة فين</h2>
            <span className="tabular text-sm text-[var(--fg-muted)]">
              {formatMoney(monthTotal, currency)} آخر ٣٠ يوم
            </span>
          </div>

          <ul className="flex flex-col gap-2.5">
            {totals.map((t) => (
              <li key={t.category} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{expenseLabel(t.category)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${biggest ? Math.max(2, (t.total / biggest) * 100) : 0}%`,
                      background: EXPENSE_COLORS[t.category],
                    }}
                  />
                </span>
                <span className="tabular w-24 shrink-0 text-end text-sm font-medium">
                  {formatMoney(t.total, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing ? (
        <ExpenseForm
          row={editing === 'new' ? null : editing}
          currency={currency}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button onClick={() => setEditing('new')} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          سجّل مصروف
        </Button>
      )}

      {/* الفلترة */}
      {rows.length > 0 && (
        <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
          {(['all', ...EXPENSE_CATEGORIES.map((c) => c.key)] as const).map((key) => {
            const active = filter === key
            const n = key === 'all' ? rows.length : rows.filter((r) => r.category === key).length
            if (key !== 'all' && n === 0) return null
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as ExpenseCategory | 'all')}
                aria-pressed={active}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                )}
              >
                {key === 'all' ? 'الكل' : expenseLabel(key)}
                <span className="tabular ms-1.5 opacity-60">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">مافيش مصروفات مسجّلة</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            من غيرها رقم «صافي الربح» في التحليلات بيحسب تكلفة البضاعة بس — والإعلانات والإيجار
            والمرتبات بتفضل مخفية. سجّل مصروفاتك وهتشوف ربحك الحقيقي.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border)]">
          {shown.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <span
                className="h-9 w-1.5 shrink-0 rounded-full"
                style={{ background: EXPENSE_COLORS[r.category] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.title}</span>
                  {r.isRecurring && (
                    <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                      <Repeat className="h-3 w-3" aria-hidden="true" />
                      شهري
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                  {expenseLabel(r.category)} · {new Date(r.spentAt).toLocaleDateString('ar-EG')}
                  {r.note ? ` · ${r.note}` : ''}
                </span>
              </span>

              <span className="tabular shrink-0 text-sm font-semibold">
                {formatMoney(r.amount, currency)}
              </span>

              <span className="flex shrink-0 gap-1">
                <IconButton label={`عدّل ${r.title}`} onClick={() => setEditing(r)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
                <DeleteButton id={r.id} title={r.title} />
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function ExpenseForm({
  row,
  currency,
  onDone,
}: {
  row: ExpenseRow | null
  currency: string
  onDone: () => void
}) {
  const [title, setTitle] = useState(row?.title ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(row?.category ?? 'ads')
  const [amount, setAmount] = useState(row ? String(fromMinorUnits(row.amount)) : '')
  const [spentAt, setSpentAt] = useState(
    (row?.spentAt ?? new Date().toISOString()).slice(0, 10),
  )
  const [note, setNote] = useState(row?.note ?? '')
  const [isRecurring, setIsRecurring] = useState(row?.isRecurring ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    setError(null)
    start(async () => {
      const res = await saveExpenseAction({
        id: row?.id,
        title,
        category,
        amount: toMinorUnits(amount || '0'),
        spentAt,
        note: note.trim() || null,
        isRecurring,
      })
      if (res?.error) setError(res.error)
      else {
        toast(row ? 'اتعدّل' : 'اتسجّل')
        onDone()
      }
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{row ? 'تعديل مصروف' : 'مصروف جديد'}</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="إغلاق"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Field label="التصنيف">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
              title={c.hint}
              className={cn(
                'min-h-10 rounded-lg border px-2 text-xs font-medium transition-colors',
                category === c.key
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="على إيه" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={EXPENSE_CATEGORIES.find((c) => c.key === category)?.hint}
          />
        </Field>

        <Field label={`المبلغ (${currency})`} required>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            className="tabular"
          />
        </Field>

        <Field label="اتصرف امتى" hint="تاريخ الصرف مش تاريخ التسجيل — عشان التقرير يطلع مظبوط.">
          <Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} dir="ltr" />
        </Field>
      </div>

      <Field label="ملاحظة">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <Toggle
        label="بيتكرر كل شهر"
        hint="بنفكّرك بيه أول كل شهر. مش بنسجّله لوحدنا — المصروف اللي محصلش ما ينفعش يدخل تقريرك."
        checked={isRecurring}
        onChange={setIsRecurring}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button onClick={save} loading={pending}>
          {row ? 'احفظ' : 'سجّل'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </Card>
  )
}

function DeleteButton({ id, title }: { id: string; title: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() =>
            start(async () => {
              const res = await deleteExpenseAction(id)
              if (res?.error) toast(res.error, 'error')
              else toast('اتحذف')
            })
          }
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--color-danger)] px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          أكيد؟
        </button>
        <IconButton label="إلغاء" onClick={() => setConfirming(false)}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      </span>
    )
  }

  return (
    <IconButton label={`احذف ${title}`} onClick={() => setConfirming(true)} danger>
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </IconButton>
  )
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-strong)] transition-colors',
        danger
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
      )}
    >
      {children}
    </button>
  )
}
