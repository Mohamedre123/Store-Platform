'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, ChevronDown, MessageSquare, Phone, Send, XCircle } from 'lucide-react'
import { loadTicketAction, replyTicketAction, setTicketStatusAction } from './actions'
import {
  categoryLabel,
  ticketStatusMeta,
  type TicketMessage,
  type TicketRow,
} from '@/lib/tickets-meta'
import { Button, Card, Textarea } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDateTime } from '@/lib/utils'

type Row = TicketRow & { orderLabel: string | null }

/**
 * شاشة الشكاوى.
 *
 * ## قايمة واحدة بتفتح في مكانها
 * مش قايمة وصفحة تفاصيل. الشكوى بتنفتح تحت عنوانها والرسايل
 * بتتحمّل ساعتها — عشان التاجر اللي بيرد على عشر شكاوى ما يفضلش
 * يروح ويرجع عشرين مرة ويفقد مكانه في القايمة كل مرة.
 *
 * ## والرسايل بتتحمّل عند الفتح
 * متجر بمية شكوى فيها ألف رسالة، وتحميلهم مع الصفحة معناه تلات
 * ثواني انتظار لمحتوى هيتقرا منه واحد.
 */
export function ComplaintsManager({ rows, canReply }: { rows: Row[]; canReply: boolean }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const shown = rows.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'open'
        ? r.status === 'open' || r.status === 'answered'
        : r.status === 'resolved' || r.status === 'closed',
  )

  const openCount = rows.filter((r) => r.status === 'open').length

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <MessageSquare className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
        <h2 className="text-lg font-semibold">مفيش شكاوى</h2>
        <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
          عميلك بيقدر يفتح شكوى من صفحة حسابه في متجرك أو من صفحة طلبه. أول واحدة هتيجي هنا،
          وهتفضل ظاهرة لحد ما تقفلها — مش هتضيع وسط رسايل واتساب.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', `الكل (${rows.length})`],
            ['open', `شغّالة (${rows.filter((r) => r.status === 'open' || r.status === 'answered').length})`],
            ['resolved', 'مقفولة'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'h-9 rounded-lg border px-3 text-sm transition-colors',
              filter === key
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
            )}
          >
            {label}
          </button>
        ))}

        {openCount > 0 && (
          <span className="ms-auto text-xs text-[var(--color-warning)]">
            {openCount} مستنية ردّك
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {shown.map((t) => (
          <TicketCard key={t.id} ticket={t} canReply={canReply} />
        ))}
      </div>
    </div>
  )
}

function TicketCard({ ticket, canReply }: { ticket: Row; canReply: boolean }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<TicketMessage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState('')

  const meta = ticketStatusMeta(ticket.status)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && messages === null) {
      setLoading(true)
      const res = await loadTicketAction(ticket.id)
      setLoading(false)
      if ('error' in res) toast(res.error, 'error')
      else setMessages(res.messages)
    }
  }

  function send() {
    const body = draft.trim()
    if (!body) return
    start(async () => {
      const res = await replyTicketAction({ ticketId: ticket.id, body })
      if (res?.error) {
        toast(res.error, 'error')
        return
      }
      /*
        الرد بيتضاف للشاشة فورًا بدل ما نعيد تحميل الرسايل.

        التاجر بيرد على أكتر من شكوى ورا بعض، ورحلة زيادة للخادم بعد
        كل رد بتخلّي كل واحدة تاخد ضعف الوقت من غير أي فايدة.
      */
      setMessages((m) => [
        ...(m ?? []),
        {
          id: crypto.randomUUID(),
          body,
          author: 'merchant',
          authorName: null,
          images: [],
          createdAt: new Date().toISOString(),
        },
      ])
      setDraft('')
      toast('ردّك اتبعت')
    })
  }

  return (
    <Card className="flex flex-col">
      {/* ────────── الرأس ────────── */}
      <button
        type="button"
        onClick={toggle}
        className="flex flex-wrap items-center gap-3 p-4 text-start"
        aria-expanded={open}
      >
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ background: meta.bg, color: meta.fg }}
        >
          {meta.label}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{ticket.subject}</span>
          <span className="block truncate text-xs text-[var(--fg-subtle)]">
            #{ticket.ticketNumber} · {categoryLabel(ticket.category)} ·{' '}
            {ticket.customerName || 'بلا اسم'}
            {ticket.orderLabel && ` · طلب #${ticket.orderLabel}`}
          </span>
        </span>

        <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
          {formatDateTime(ticket.lastMessageAt)}
        </span>

        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* ────────── المحتوى ────────── */}
      {open && (
        <div className="flex flex-col gap-4 border-t border-[var(--border)] p-4">
          {/* بيانات العميل */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ticket.customerPhone && (
              <>
                <a
                  href={`tel:${ticket.customerPhone}`}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <bdi dir="ltr">{ticket.customerPhone}</bdi>
                </a>
                <a
                  href={`https://wa.me/${ticket.customerPhone.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 items-center rounded-lg bg-[var(--color-success)] px-2.5 font-medium text-white"
                >
                  واتساب
                </a>
              </>
            )}
            {ticket.orderId && (
              <Link
                href={`/dashboard/orders/${ticket.orderId}`}
                className="flex h-8 items-center rounded-lg border border-[var(--border-strong)] px-2.5"
              >
                افتح الطلب
              </Link>
            )}
          </div>

          {/* الرسايل */}
          {loading ? (
            <p className="text-xs text-[var(--fg-subtle)]">بيحمّل…</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {(messages ?? []).map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    'flex max-w-[85%] flex-col gap-1.5 rounded-xl px-3.5 py-2.5 text-sm',
                    m.author === 'merchant'
                      ? 'self-start bg-[var(--primary-soft)]'
                      : 'self-end bg-[var(--surface-2)]',
                  )}
                >
                  <span className="whitespace-pre-wrap leading-relaxed">{m.body}</span>

                  {m.images.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {m.images.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                          <Image
                            src={src}
                            alt="مرفق من العميل"
                            width={72}
                            height={72}
                            className="h-18 w-18 rounded-lg object-cover"
                          />
                        </a>
                      ))}
                    </span>
                  )}

                  <span className="text-[11px] text-[var(--fg-subtle)]">
                    {m.author === 'merchant' ? (m.authorName ?? 'المتجر') : 'العميل'} ·{' '}
                    {formatDateTime(m.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* الرد */}
          {canReply && (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="اكتب ردّك للعميل…"
                maxLength={4000}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={send} loading={pending} disabled={!draft.trim()}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  ابعت
                </Button>

                {ticket.status !== 'resolved' && (
                  <Button
                    variant="secondary"
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setTicketStatusAction(ticket.id, 'resolved')
                        if (res?.error) toast(res.error, 'error')
                        else toast('اتعلّمت «اتحلّت»')
                      })
                    }
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    اتحلّت
                  </Button>
                )}

                {ticket.status !== 'closed' && (
                  <Button
                    variant="ghost"
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setTicketStatusAction(ticket.id, 'closed')
                        if (res?.error) toast(res.error, 'error')
                        else toast('اتقفلت')
                      })
                    }
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    اقفلها
                  </Button>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--fg-subtle)]">
                لو العميل رجع كتب في شكوى قفلتها، هتفتح تاني وتبان فوق — عشان ردّه ما يضيعش.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
