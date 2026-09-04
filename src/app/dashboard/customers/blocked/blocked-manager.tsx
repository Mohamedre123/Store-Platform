'use client'

import { useState, useTransition } from 'react'
import { Ban, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { addBlockAction, removeBlockAction, setCustomerBlockedAction } from '../block-actions'
import { BLOCK_MATCH_LABELS } from '@/lib/blocklist-meta'
import type { BlockMatch } from '@/db/schema'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDate } from '@/lib/utils'

export type BlockRow = {
  id: string
  match: BlockMatch
  value: string
  action: 'reject' | 'flag'
  reason: string | null
  hits: number
  lastHitAt: string | null
}

export type RiskyCustomer = {
  id: string
  name: string | null
  phone: string | null
  refused: number
  delivered: number
  isBlocked: boolean
}

/**
 * شاشة الحظر.
 *
 * ## ليه دي مش «قائمة سوداء» وبس
 * التاجر بيحظر رقمًا وينسى ليه حظره، وبعد شهرين يشوف الرقم في القايمة
 * ومش عارف يشيله ولا يسيبه. عشان كده كل صف بيحمل **سبب** و**عدد
 * المرات اللي منع فيها طلبًا فعلًا** — والصف اللي عدّاده صفر بعد شهور
 * غالبًا اتحطّ بالغلط.
 *
 * ## اقتراحات من بيانات المتجر نفسه
 * الأرقام اللي رفضت الاستلام أكتر من مرة بتبان فوق. التاجر ما يحتاجش
 * يفتكرها ولا يدوّر عليها في الطلبات — هي اللي بتيجي له.
 */
export function BlockedManager({
  rows,
  risky,
}: {
  rows: BlockRow[]
  risky: RiskyCustomer[]
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {risky.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[var(--color-warning)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold">أرقام رفضت الاستلام أكتر من مرة</h2>
          </div>
          <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
            كل رفض هنا كلّفك شحن رايح وجاي. بص عليهم قبل ما تشحن تاني — مش كل واحد فيهم لازم
            يتحظر، بس كلهم يستاهلوا مكالمة تأكيد.
          </p>
          <Card className="divide-y divide-[var(--border)]">
            {risky.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name || 'بلا اسم'}</span>
                  <span dir="ltr" className="block truncate text-start text-xs text-[var(--fg-subtle)]">
                    {c.phone}
                  </span>
                </span>
                <span className="tabular shrink-0 text-xs text-[var(--fg-muted)]">
                  {c.refused} رفض · {c.delivered} استلام
                </span>
                <BlockCustomer id={c.id} blocked={c.isBlocked} />
              </div>
            ))}
          </Card>
        </section>
      )}

      {adding ? (
        <AddForm onDone={() => setAdding(false)} />
      ) : (
        <Button onClick={() => setAdding(true)} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          ضيف للحظر
        </Button>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Ban className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مفيش حاجة محظورة</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            لما تلاقي رقمًا بيطلب ويرفض الاستلام، حطّه هنا — الطلب الجاي منه هيتوقف قبل ما يتحوّل
            لشحنة على حسابك.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium',
                  r.action === 'reject'
                    ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                    : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
                )}
              >
                {r.action === 'reject' ? 'يترفض' : 'يعدّي معلَّم'}
              </span>

              <span className="min-w-0 flex-1">
                <span dir="ltr" className="block truncate text-start text-sm font-medium">
                  {r.value}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                  {BLOCK_MATCH_LABELS[r.match]}
                  {r.reason ? ` · ${r.reason}` : ''}
                  {r.hits > 0
                    ? ` · منع ${r.hits} طلب${r.lastHitAt ? `، آخرها ${formatDate(r.lastHitAt)}` : ''}`
                    : ' · لسه ما منعش أي طلب'}
                </span>
              </span>

              <RemoveButton id={r.id} value={r.value} />
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [match, setMatch] = useState<BlockMatch>('phone')
  const [value, setValue] = useState('')
  const [action, setAction] = useState<'reject' | 'flag'>('reject')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">حظر جديد</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="إغلاق"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Field label="بتحظر إيه">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {(Object.keys(BLOCK_MATCH_LABELS) as BlockMatch[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMatch(k)}
              aria-pressed={match === k}
              className={cn(
                'min-h-10 rounded-lg border px-2 text-xs font-medium transition-colors',
                match === k
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
              )}
            >
              {BLOCK_MATCH_LABELS[k]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="القيمة" required>
        <Input
          dir={match === 'name' ? 'rtl' : 'ltr'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={match === 'name' ? '' : 'text-start'}
          placeholder={
            match === 'phone'
              ? '01xxxxxxxxx'
              : match === 'email'
                ? 'name@example.com'
                : match === 'ip'
                  ? '197.x.x.x'
                  : 'الاسم زي ما بيكتبه'
          }
        />
      </Field>

      <Field label="يحصل إيه لما يطلب">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'reject', label: 'ارفض الطلب', hint: 'ما بيتسجّلش أصلًا' },
              { value: 'flag', label: 'اقبله وعلّم عليه', hint: 'بيوصلك وتراجعه بإيدك' },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setAction(o.value)}
              aria-pressed={action === o.value}
              className={cn(
                'flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-start transition-colors',
                action === o.value
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
              )}
            >
              <span
                className={cn('text-sm font-medium', action === o.value && 'text-[var(--primary)]')}
              >
                {o.label}
              </span>
              <span className="text-xs text-[var(--fg-subtle)]">{o.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="السبب"
        hint="اكتبه دلوقتي. بعد شهرين هتبص على القايمة ومش هتفتكر ليه حظرت الرقم ده."
      >
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="رفض الاستلام ٣ مرات" />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await addBlockAction({ match, value, action, reason: reason || null })
              if (res?.error) setError(res.error)
              else {
                toast('اتضاف للحظر')
                onDone()
              }
            })
          }
        >
          احظر
        </Button>
        <Button variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </Card>
  )
}

function RemoveButton({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      aria-label={`شيل ${value} من الحظر`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await removeBlockAction(id)
          toast('اتشال من الحظر')
        })
      }
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

function BlockCustomer({ id, blocked }: { id: string; blocked: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant={blocked ? 'secondary' : 'danger'}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await setCustomerBlockedAction(id, !blocked)
          if (res?.error) toast(res.error, 'error')
          else toast(blocked ? 'اتفكّ الحظر' : 'اتحظر')
        })
      }
    >
      {blocked ? 'فُكّ الحظر' : 'احظره'}
    </Button>
  )
}
