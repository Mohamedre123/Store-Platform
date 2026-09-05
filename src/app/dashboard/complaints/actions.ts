'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { replyToTicket, setTicketStatus, ticketMessages } from '@/lib/tickets'
import type { TicketMessage } from '@/lib/tickets-meta'

export type TicketState = { ok?: boolean; error?: string } | null

/**
 * رسايل شكوى — بتتحمّل عند الفتح لا مع الصفحة.
 *
 * متجر عنده مية شكوى فيها ألف رسالة، وتحميلهم كلهم مع القايمة
 * معناه صفحة بتوصل بعد تلات ثواني عشان محتوى التاجر هيقرا منه
 * واحد. الفتح بيجيب بتاعتها هي بس.
 */
export async function loadTicketAction(
  ticketId: string,
): Promise<{ messages: TicketMessage[] } | { error: string }> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.view')
  return { messages: await ticketMessages(store.id, ticketId) }
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, 'اكتب ردّك').max(4000),
})

export async function replyTicketAction(raw: unknown): Promise<TicketState> {
  const parsed = replySchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, actor, user } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const res = await replyToTicket({
    storeId: store.id,
    ticketId: parsed.data.ticketId,
    author: 'merchant',
    authorUserId: user.id,
    authorName: user.name ?? null,
    body: parsed.data.body,
  })

  if (!res.ok) return { error: res.error }
  revalidatePath('/dashboard/complaints')
  return { ok: true }
}

export async function setTicketStatusAction(
  ticketId: string,
  status: 'open' | 'answered' | 'resolved' | 'closed',
): Promise<TicketState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const res = await setTicketStatus(store.id, ticketId, status)
  if (!res.ok) return { error: res.error }
  revalidatePath('/dashboard/complaints')
  return { ok: true }
}
