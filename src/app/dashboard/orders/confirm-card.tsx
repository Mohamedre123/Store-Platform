'use client'

import { useState, useTransition } from 'react'
import { Check, Clock, Loader2, MessageCircle, X } from 'lucide-react'
import { requestConfirmationAction } from './confirm-actions'
import { Card } from '@/components/ui'

export type ConfirmStatus = {
  sentAt: string | null
  reply: 'yes' | 'no' | null
  repliedAt: string | null
  hasPhone: boolean
}

/**
 * تأكيد العميل — طلبه ومتابعته.
 *
 * ## الحالات التلاتة بتقول حاجات مختلفة تمامًا
 * «ما اتبعتش» يعني لسه مخاطرة كاملة. «اتبعت وما ردّش» يعني مخاطرة
 * برضه — والصمت هنا إشارة مش حياد. و«أكّد» يعني الشحن بقى مضمون
 * لدرجة كبيرة. خلطهم في وسم واحد بيضيّع كل الفايدة.
 */
export function ConfirmCard({ orderId, status }: { orderId: string; status: ConfirmStatus }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!status.hasPhone) return null

  const meta =
    status.reply === 'yes'
      ? { bg: 'var(--color-success-soft)', fg: 'var(--color-success)', icon: Check }
      : status.reply === 'no'
        ? { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', icon: X }
        : status.sentAt
          ? { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)', icon: Clock }
          : { bg: 'var(--surface-2)', fg: 'var(--fg-muted)', icon: MessageCircle }

  const Icon = meta.icon

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">تأكيد العميل</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">
            {status.reply === 'yes'
              ? `العميل أكّد الطلب${status.repliedAt ? ' — ' + status.repliedAt : ''}`
              : status.reply === 'no'
                ? `العميل ألغى الطلب${status.repliedAt ? ' — ' + status.repliedAt : ''}`
                : status.sentAt
                  ? `بعتنا الطلب${' — ' + status.sentAt} ولسه ما ردّش. الصمت مخاطرة زي الرفض.`
                  : 'ابعتله رسالة واتساب يرد عليها بـ١ أو ٢، والرد بيتسجّل هنا لوحده.'}
          </p>
        </div>
      </div>

      {!status.reply && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null)
            start(async () => {
              const res = await requestConfirmationAction(orderId)
              if (res?.error) setMsg(res.error)
            })
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          )}
          {status.sentAt ? 'ابعت التأكيد تاني' : 'اطلب تأكيد على واتساب'}
        </button>
      )}

      {msg && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-xs font-medium text-[var(--color-danger)]">
          {msg}
        </p>
      )}
    </Card>
  )
}
