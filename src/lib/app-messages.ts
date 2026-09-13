import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { isEmailConfigured } from '@/lib/email'
import { loadMessages } from '@/lib/messages-data'
import { MESSAGE_EVENT_LABELS, MESSAGE_STATUS_META } from '@/lib/message-labels'

/** شكل «سجل الرسايل» اللي تطبيق الموبايل بيستلمه */
export async function messagesPayload(store: ActiveStore) {
  const data = await loadMessages(store)

  return {
    emailConfigured: isEmailConfigured(),
    counts: { total: data.total, last7: data.last7, failed: data.failed },
    messages: data.rows.slice(0, 150).map((m) => {
      const meta = MESSAGE_STATUS_META[m.status] ?? MESSAGE_STATUS_META.queued
      return {
        id: m.id,
        channel: m.channel,
        eventLabel: (m.event && MESSAGE_EVENT_LABELS[m.event]) || m.event || 'رسالة',
        recipient: m.recipient,
        body: m.body,
        status: m.status,
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
        error: m.errorMessage,
        orderId: m.orderId,
        createdAt: new Date(m.createdAt).toISOString(),
      }
    }),
  }
}
