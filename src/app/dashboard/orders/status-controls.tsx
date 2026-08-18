'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react'
import {
  addOrderNoteAction,
  dismissIncompleteAction,
  updateOrderStatusAction,
} from './actions'
import { ORDER_STATUSES, nextStatus, statusMeta } from '@/lib/order-status'
import type { OrderStatus } from '@/db/schema'
import { Button, Card, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * تغيير حالة الطلب.
 *
 * الخطوة التالية المنطقية معروضة كزرار كبير، والباقي تحتها. التاجر
 * بيمشي في مسار واحد ٩٠٪ من الوقت — فالمفروض يكون ضغطة واحدة، مش
 * يدوّر في قايمة كل مرة.
 */
export function StatusControls({
  orderId,
  status,
  isIncomplete,
}: {
  orderId: string
  status: OrderStatus
  isIncomplete: boolean
}) {
  const [pending, start] = useTransition()
  const [target, setTarget] = useState<OrderStatus | null>(null)
  const router = useRouter()

  const next = isIncomplete ? null : nextStatus(status)

  function change(to: OrderStatus) {
    setTarget(to)
    start(async () => {
      await updateOrderStatusAction(orderId, to)
      setTarget(null)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-semibold">حالة الطلب</h2>

      {next && (
        <Button size="lg" loading={pending && target === next} onClick={() => change(next)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {statusMeta(next).label}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {ORDER_STATUSES.filter((s) => s.key !== 'incomplete' && s.key !== next).map((s) => {
          const active = s.key === status
          return (
            <button
              key={s.key}
              type="button"
              disabled={active || pending}
              onClick={() => change(s.key)}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors',
                active
                  ? 'border-transparent'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                pending && 'opacity-60',
              )}
              style={active ? { background: s.bg, color: s.fg } : undefined}
            >
              {pending && target === s.key ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : active ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : null}
              {s.label}
            </button>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
        الإلغاء والإرجاع بيرجّعوا الكمية للمخزون تلقائيًا.
      </p>

      {isIncomplete && (
        <Button
          variant="ghost"
          className="text-[var(--color-danger)]"
          onClick={() => {
            if (!confirm('هتمسح السلة المتروكة دي نهائيًا. متأكد؟')) return
            start(async () => {
              await dismissIncompleteAction(orderId)
              router.push('/dashboard/orders?filter=incomplete')
            })
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          تجاهل السلة دي
        </Button>
      )}
    </Card>
  )
}

/** إضافة ملاحظة داخلية على الطلب */
export function OrderNote({ orderId }: { orderId: string }) {
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="ملاحظة داخلية — العميل مش بيشوفها"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={!note.trim()}
        loading={pending}
        className="self-start"
        onClick={() =>
          start(async () => {
            await addOrderNoteAction(orderId, note)
            setNote('')
          })
        }
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        إضافة ملاحظة
      </Button>
    </div>
  )
}
