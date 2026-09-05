'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, LifeBuoy, Plus, Send, X } from 'lucide-react'
import {
  customerReplyAction,
  loadMyTicketAction,
  openTicketAction,
} from '@/app/s/[store]/account/ticket-actions'
import {
  CUSTOMER_STATUS_LABELS,
  TICKET_CATEGORIES,
  categoryLabel,
  type TicketMessage,
} from '@/lib/tickets-meta'
import type { TicketCategory, TicketStatus } from '@/db/schema'
import { cn, formatDateTime } from '@/lib/utils'

export type MyTicket = {
  id: string
  ticketNumber: number
  subject: string
  category: TicketCategory
  status: TicketStatus
  orderNumber: number | null
  lastMessageBy: 'customer' | 'merchant'
  lastMessageAt: string
}

export type OrderChoice = { id: string; orderNumber: number }

/**
 * شكاوى العميل في صفحة حسابه.
 *
 * ## ليه ده مش «اتصل بنا»
 * زرار «اتصل بنا» بيفتح واتساب أو بريد، والرسالة بتروح في مكان
 * التاجر مش شايفه كـ«شكوى مستنية». هنا العميل بيشوف **رقم شكواه
 * وحالتها ورد التاجر** في نفس المكان — يعني عارف إن كلامه وصل،
 * وده لوحده بيقلّل تكرار الرسايل.
 *
 * ## والطلب بيتربط من قايمة طلباته
 * العميل ما بيفتكرش رقم طلبه. لو سألناه عنه بيسيب الشكوى.
 */
export function TicketsPanel({
  storeIdentifier,
  tickets,
  orders,
}: {
  storeIdentifier: string
  tickets: MyTicket[]
  orders: OrderChoice[]
}) {
  const [composing, setComposing] = useState(false)

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          <LifeBuoy className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
          شكاويّ واستفساراتي
        </h2>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex h-10 items-center gap-1.5 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-3.5 text-sm font-semibold text-[var(--sf-primary-fg,#fff)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            افتح شكوى
          </button>
        )}
      </div>

      {composing && (
        <NewTicketForm
          storeIdentifier={storeIdentifier}
          orders={orders}
          onDone={() => setComposing(false)}
        />
      )}

      {tickets.length === 0 && !composing ? (
        <p className="py-6 text-center text-sm opacity-60">
          مفيش شكاوى. لو فيه حاجة مضايقاك في طلب أو عندك سؤال، افتح شكوى وهنرد عليك هنا.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <TicketItem key={t.id} ticket={t} storeIdentifier={storeIdentifier} />
          ))}
        </ul>
      )}
    </section>
  )
}

/* ────────────────────────── شكوى واحدة ────────────────────────── */

function TicketItem({
  ticket,
  storeIdentifier,
}: {
  ticket: MyTicket
  storeIdentifier: string
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<TicketMessage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const closed = ticket.status === 'closed' || ticket.status === 'resolved'

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && messages === null) {
      setLoading(true)
      const res = await loadMyTicketAction(storeIdentifier, ticket.id)
      setLoading(false)
      if ('error' in res) setError(res.error)
      else setMessages(res.messages)
    }
  }

  function send() {
    const body = draft.trim()
    if (!body) return
    setError(null)
    start(async () => {
      const res = await customerReplyAction({ storeIdentifier, ticketId: ticket.id, body })
      if (res?.error) {
        setError(res.error)
        return
      }
      setMessages((m) => [
        ...(m ?? []),
        {
          id: crypto.randomUUID(),
          body,
          author: 'customer',
          authorName: null,
          images: [],
          createdAt: new Date().toISOString(),
        },
      ])
      setDraft('')
    })
  }

  return (
    <li className="overflow-hidden rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full flex-wrap items-center gap-3 p-3 text-start"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{ticket.subject}</span>
          <span className="block truncate text-xs opacity-60">
            #{ticket.ticketNumber} · {categoryLabel(ticket.category)}
            {ticket.orderNumber && ` · طلب #${ticket.orderNumber}`}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 rounded-md px-2 py-0.5 text-xs',
            ticket.status === 'answered'
              ? 'bg-[var(--sf-primary)]/12 text-[var(--sf-primary)]'
              : 'bg-[var(--sf-text)]/8 opacity-70',
          )}
        >
          {CUSTOMER_STATUS_LABELS[ticket.status]}
        </span>

        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[var(--sf-text)]/12 p-3">
          {loading ? (
            <p className="text-xs opacity-60">بيحمّل…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(messages ?? []).map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    'max-w-[85%] rounded-[var(--sf-radius)] px-3 py-2 text-sm',
                    m.author === 'customer'
                      ? 'self-end bg-[var(--sf-primary)]/10'
                      : 'self-start bg-[var(--sf-text)]/6',
                  )}
                >
                  <span className="block whitespace-pre-wrap leading-relaxed">{m.body}</span>
                  <span className="mt-1 block text-[11px] opacity-55">
                    {m.author === 'customer' ? 'أنا' : 'المتجر'} · {formatDateTime(m.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-xs text-[var(--sf-danger,#dc2626)]">{error}</p>}

          {/*
            الرد مفتوح حتى على الشكوى المقفولة.

            التاجر بيقفلها لما يفتكر إنها خلصت، والعميل ساعات بيبقى
            شايف غير كده. لو قفلنا الرد عليه، بيرجع لواتساب — وهو
            بالظبط اللي الشاشة دي اتعملت عشانه.
          */}
          <div className="flex flex-col gap-2">
            {closed && (
              <p className="text-xs opacity-60">
                الشكوى دي اتقفلت. لو لسه فيه حاجة، اكتبها وهتفتح تاني.
              </p>
            )}
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="اكتب رسالتك…"
              maxLength={4000}
              className="w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/16 bg-transparent p-2.5 text-base sm:text-sm"
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || !draft.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-4 text-sm font-semibold text-[var(--sf-primary-fg,#fff)] disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              ابعت
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/* ────────────────────────── شكوى جديدة ────────────────────────── */

function NewTicketForm({
  storeIdentifier,
  orders,
  onDone,
}: {
  storeIdentifier: string
  orders: OrderChoice[]
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [category, setCategory] = useState<TicketCategory>('order')

  if (done !== null) {
    return (
      <div className="mb-4 flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-primary)]/30 bg-[var(--sf-primary)]/8 p-4">
        <p className="text-sm font-semibold">شكواك وصلت — رقمها #{done}</p>
        <p className="text-sm opacity-70">
          هتلاقي رد المتجر في نفس الصفحة دي. مش محتاج تبعت تاني.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="h-10 self-start rounded-[var(--sf-radius)] border border-[var(--sf-text)]/16 px-3.5 text-sm"
        >
          تمام
        </button>
      </div>
    )
  }

  return (
    <form
      className="mb-4 flex flex-col gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        const fd = new FormData(e.currentTarget)
        start(async () => {
          const res = await openTicketAction({
            storeIdentifier,
            subject: fd.get('subject'),
            category,
            body: fd.get('body'),
            orderId: fd.get('orderId') || null,
          })
          if (res?.error) setError(res.error)
          else setDone(res?.ticketNumber ?? 0)
        })
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {TICKET_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              category === c.key
                ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/10 text-[var(--sf-primary)]'
                : 'border-[var(--sf-text)]/16 opacity-70',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === 'order' && orders.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">أنهي طلب؟</span>
          <select
            name="orderId"
            className="h-11 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/16 bg-transparent px-3 text-base sm:text-sm"
            defaultValue={orders[0]?.id}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                طلب #{o.orderNumber}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">الموضوع</span>
        <input
          name="subject"
          required
          maxLength={160}
          placeholder="مثلًا: الطلب وصل ناقص قطعة"
          className="h-11 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/16 bg-transparent px-3 text-base sm:text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">اشرح المشكلة</span>
        <textarea
          name="body"
          required
          rows={4}
          maxLength={4000}
          placeholder="كل التفاصيل اللي هتساعد المتجر يفهم ويحلّها بسرعة"
          className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/16 bg-transparent p-2.5 text-base sm:text-sm"
        />
      </label>

      {error && <p className="text-sm text-[var(--sf-danger,#dc2626)]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-5 text-sm font-semibold text-[var(--sf-primary-fg,#fff)] disabled:opacity-50"
        >
          ابعت الشكوى
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex h-11 items-center gap-1.5 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/16 px-4 text-sm"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          إلغاء
        </button>
      </div>
    </form>
  )
}
