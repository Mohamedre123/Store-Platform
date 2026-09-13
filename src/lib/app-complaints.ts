import 'server-only'
import type { DashboardContext } from '@/lib/store-context'
import { listTickets, ticketMessages } from '@/lib/tickets'
import { categoryLabel, ticketStatusMeta, TICKET_STATUSES } from '@/lib/tickets-meta'
import { formatOrderNumber } from '@/lib/order-number'
import { can } from '@/lib/permissions'

/**
 * شكل الشكاوى اللي تطبيق الموبايل بيستلمه — نفس `listTickets` اللي صفحة
 * الشكاوى بتقرا منها، ونفس قاعدة «مين يقدر يرد».
 */
export async function complaintsPayload(ctx: DashboardContext) {
  const rows = await listTickets(ctx.store.id)
  return {
    canReply: can(ctx.actor, 'orders.manage'),
    open: rows.filter((r) => r.status === 'open').length,
    statuses: TICKET_STATUSES.map((s) => ({ key: s.key, label: s.label })),
    tickets: rows.map((r) => {
      const meta = ticketStatusMeta(r.status)
      return {
        id: r.id,
        number: String(r.ticketNumber),
        subject: r.subject,
        categoryLabel: categoryLabel(r.category),
        status: r.status,
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        orderId: r.orderId,
        orderLabel: r.orderNumber ? formatOrderNumber(ctx.store, r.orderNumber) : null,
        lastMessageBy: r.lastMessageBy,
        lastMessageAt: new Date(r.lastMessageAt).toISOString(),
        messageCount: r.messageCount,
      }
    }),
  }
}

export async function complaintThreadPayload(ctx: DashboardContext, ticketId: string) {
  const messages = await ticketMessages(ctx.store.id, ticketId)
  return {
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      author: m.author,
      authorName: m.authorName,
      images: m.images,
      createdAt: new Date(m.createdAt).toISOString(),
    })),
  }
}
