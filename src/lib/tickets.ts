import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, supportMessages, supportTickets } from '@/db/schema'
import type { TicketMessage, TicketRow } from './tickets-meta'

/**
 * الشكاوى — قراءة وكتابة.
 *
 * الملف ده بيخدم الجهتين: لوحة التاجر وحساب العميل في المتجر.
 * القراءة مفلترة بـ`storeId` دايمًا، والقراءة من جهة العميل مفلترة
 * بـ`customerId` كمان — ومن غير الشرط التاني، أي عميل مسجّل كان
 * يقدر يفتح شكوى أي عميل تاني في نفس المتجر بمعرّفها.
 */

export type { TicketMessage, TicketRow } from './tickets-meta'

/**
 * رقم الشكوى الجاي.
 *
 * `max + 1` لا عدّاد على المتجر: الشكاوى أندر من الطلبات بكتير،
 * فسباق الاتنين اللي بيشتكوا في نفس الجزء من الثانية احتماله
 * مهمَل — والفهرس الفريد بيرفض التاني لو حصل، فالأسوأ إن العميل
 * يدوس تاني.
 */
async function nextTicketNumber(storeId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(${supportTickets.ticketNumber}), 0) + 1` })
    .from(supportTickets)
    .where(eq(supportTickets.storeId, storeId))
  return Number(row?.n ?? 1)
}

/** شكاوى المتجر للوحة التاجر — بالطلب المربوط وعدد الرسايل */
export async function listTickets(
  storeId: string,
  filter?: { status?: string },
): Promise<TicketRow[]> {
  const rows = await db
    .select({
      id: supportTickets.id,
      ticketNumber: supportTickets.ticketNumber,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      customerName: supportTickets.customerName,
      customerPhone: supportTickets.customerPhone,
      customerEmail: supportTickets.customerEmail,
      orderId: supportTickets.orderId,
      orderNumber: orders.orderNumber,
      lastMessageBy: supportTickets.lastMessageBy,
      lastMessageAt: supportTickets.lastMessageAt,
      createdAt: supportTickets.createdAt,
      messageCount: sql<number>`(
        select count(*)::int from support_messages m where m.ticket_id = ${supportTickets.id}
      )`,
    })
    .from(supportTickets)
    .leftJoin(orders, eq(orders.id, supportTickets.orderId))
    .where(
      and(
        eq(supportTickets.storeId, storeId),
        filter?.status ? eq(supportTickets.status, filter.status as never) : undefined,
      ),
    )
    /*
      المستنية ردّ التاجر فوق، وبعدين الأحدث.

      الترتيب الزمني وحده كان بيحطّ شكوى ردّ عليها من خمس دقايق فوق
      شكوى مستنية من أمس — وهي بالظبط اللي بتضيّع العميل.
    */
    .orderBy(
      sql`case when ${supportTickets.status} = 'open' then 0
                when ${supportTickets.status} = 'answered' then 1
                else 2 end`,
      desc(supportTickets.lastMessageAt),
    )
    .limit(200)

  return rows.map(
    (r): TicketRow => ({
      ...r,
      lastMessageAt: r.lastMessageAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      messageCount: Number(r.messageCount),
    }),
  )
}

/** رسايل شكوى واحدة — مفلترة بالمتجر عشان محدّش يقرا شكوى متجر تاني */
export async function ticketMessages(
  storeId: string,
  ticketId: string,
): Promise<TicketMessage[]> {
  const rows = await db
    .select({
      id: supportMessages.id,
      body: supportMessages.body,
      author: supportMessages.author,
      authorName: supportMessages.authorName,
      images: supportMessages.images,
      createdAt: supportMessages.createdAt,
    })
    .from(supportMessages)
    .where(and(eq(supportMessages.storeId, storeId), eq(supportMessages.ticketId, ticketId)))
    .orderBy(supportMessages.createdAt)

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

/** شكاوى عميل واحد — لصفحة حسابه في المتجر */
export async function customerTickets(storeId: string, customerId: string) {
  const rows = await db
    .select({
      id: supportTickets.id,
      ticketNumber: supportTickets.ticketNumber,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      orderNumber: orders.orderNumber,
      lastMessageBy: supportTickets.lastMessageBy,
      lastMessageAt: supportTickets.lastMessageAt,
    })
    .from(supportTickets)
    .leftJoin(orders, eq(orders.id, supportTickets.orderId))
    .where(and(eq(supportTickets.storeId, storeId), eq(supportTickets.customerId, customerId)))
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(50)

  return rows.map((r) => ({ ...r, lastMessageAt: r.lastMessageAt.toISOString() }))
}

/**
 * فتح شكوى — من العميل.
 *
 * بيتعمل الصف والرسالة الأولى مع بعض في معاملة واحدة: شكوى بلا
 * رسالة بتطلع للتاجر كعنوان بلا محتوى، وهو أسوأ من ما تتفتحش.
 */
export async function openTicket(input: {
  storeId: string
  customerId: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  orderId?: string | null
  subject: string
  category: string
  body: string
  images?: string[]
}): Promise<{ ok: boolean; ticketNumber?: number; error?: string }> {
  const ticketNumber = await nextTicketNumber(input.storeId)

  try {
    const created = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(supportTickets)
        .values({
          storeId: input.storeId,
          ticketNumber,
          customerId: input.customerId,
          orderId: input.orderId ?? null,
          subject: input.subject,
          category: input.category as never,
          status: 'open',
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          lastMessageBy: 'customer',
          lastMessageAt: new Date(),
        })
        .returning({ id: supportTickets.id })

      await tx.insert(supportMessages).values({
        ticketId: t.id,
        storeId: input.storeId,
        body: input.body,
        author: 'customer',
        authorName: input.customerName,
        images: input.images ?? [],
      })

      return t
    })

    return { ok: Boolean(created), ticketNumber }
  } catch {
    return { ok: false, error: 'حصلت مشكلة عندنا — جرّب تاني' }
  }
}

/**
 * رد على شكوى.
 *
 * الحالة بتتغيّر مع كل رد: رد التاجر بيخلّيها `answered`، ورد
 * العميل بيرجّعها `open`. يعني الشكوى اللي التاجر قفلها والعميل
 * رجع كتب فيها **بتفتح تاني** — من غير كده، الرد الأخير بيروح في
 * شكوى مقفولة ومحدّش بيشوفه.
 */
export async function replyToTicket(input: {
  storeId: string
  ticketId: string
  author: 'customer' | 'merchant'
  authorUserId?: string | null
  authorName?: string | null
  body: string
  images?: string[]
  /** فلترة زيادة لجهة العميل — يرد على شكواه هو بس */
  customerId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const [ticket] = await db
    .select({ id: supportTickets.id })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, input.ticketId),
        eq(supportTickets.storeId, input.storeId),
        input.customerId ? eq(supportTickets.customerId, input.customerId) : undefined,
      ),
    )
    .limit(1)

  if (!ticket) return { ok: false, error: 'الشكوى مش موجودة' }

  await db.transaction(async (tx) => {
    await tx.insert(supportMessages).values({
      ticketId: input.ticketId,
      storeId: input.storeId,
      body: input.body,
      author: input.author,
      authorUserId: input.authorUserId ?? null,
      authorName: input.authorName ?? null,
      images: input.images ?? [],
    })

    await tx
      .update(supportTickets)
      .set({
        status: input.author === 'merchant' ? 'answered' : 'open',
        lastMessageBy: input.author,
        lastMessageAt: new Date(),
        resolvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, input.ticketId))
  })

  return { ok: true }
}

/** التاجر بيقفل الشكوى — «اتحلّت» أو «مقفولة» */
export async function setTicketStatus(
  storeId: string,
  ticketId: string,
  status: 'open' | 'answered' | 'resolved' | 'closed',
): Promise<{ ok: boolean; error?: string }> {
  const updated = await db
    .update(supportTickets)
    .set({
      status,
      resolvedAt: status === 'resolved' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.storeId, storeId)))
    .returning({ id: supportTickets.id })

  if (!updated.length) return { ok: false, error: 'الشكوى مش موجودة' }
  return { ok: true }
}

/** عدد الشكاوى المستنية رد — للشارة في القايمة */
export async function openTicketCount(storeId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(and(eq(supportTickets.storeId, storeId), eq(supportTickets.status, 'open')))
  return Number(row?.n ?? 0)
}
