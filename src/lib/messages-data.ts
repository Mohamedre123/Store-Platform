import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { messageLog } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import type { MessageRow } from '@/app/dashboard/messages/messages-list'

/** بيانات «سجل الرسايل» — صفحة اللوحة و`/api/app/messages` بيقروا من هنا */
export async function loadMessages(store: ActiveStore) {
  const rows = (await db
    .select({
      id: messageLog.id,
      channel: messageLog.channel,
      event: messageLog.event,
      recipient: messageLog.recipient,
      body: messageLog.body,
      status: messageLog.status,
      provider: messageLog.provider,
      errorMessage: messageLog.errorMessage,
      orderId: messageLog.orderId,
      sentAt: messageLog.sentAt,
      createdAt: messageLog.createdAt,
    })
    .from(messageLog)
    .where(eq(messageLog.storeId, store.id))
    .orderBy(desc(messageLog.createdAt))
    .limit(300)) as MessageRow[]

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where ${messageLog.status} = 'failed')::int`,
      last7: sql<number>`count(*) filter (where ${messageLog.createdAt} > now() - interval '7 days')::int`,
    })
    .from(messageLog)
    .where(eq(messageLog.storeId, store.id))

  return {
    rows,
    total: Number(counts?.total ?? 0),
    failed: Number(counts?.failed ?? 0),
    last7: Number(counts?.last7 ?? 0),
  }
}
