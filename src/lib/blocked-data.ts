import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { blocklist } from '@/db/schema'

/**
 * بيانات شاشة الحظر — صفحة اللوحة (`/dashboard/customers/blocked`) وتطبيق
 * الموبايل (`/api/app/blocked`) الاتنين بيقروا من هنا، فالقايمة واحدة.
 */
export async function loadBlocked(storeId: string) {
  const [rows, risky] = await Promise.all([
    db
      .select({
        id: blocklist.id,
        match: blocklist.match,
        value: blocklist.value,
        action: blocklist.action,
        reason: blocklist.reason,
        hits: blocklist.hits,
        lastHitAt: blocklist.lastHitAt,
      })
      .from(blocklist)
      .where(eq(blocklist.storeId, storeId))
      .orderBy(desc(blocklist.hits), desc(blocklist.createdAt))
      .limit(300),

    /**
     * أرقام رفضت الاستلام في متجرك أكتر من مرة.
     *
     * **المرتجع والملغي بعد التأكيد بس.** الإلغاء قبل ما التاجر
     * يأكّد ممكن يكون هو نفسه لغاه — نفس القاعدة اللي في درجة الثقة
     * بالحرف، عشان الشاشتين ما يقولوش رقمين مختلفين لنفس العميل.
     */
    db.execute<{
      id: string
      name: string | null
      phone: string | null
      refused: number
      delivered: number
      is_blocked: boolean
    }>(sql`
      select
        c.id, c.name, c.phone, c.is_blocked,
        count(*) filter (
          where o.status = 'returned'
             or (o.status = 'cancelled' and o.confirmed_at is not null)
        )::int as refused,
        count(*) filter (where o.status = 'delivered')::int as delivered
      from customers c
      join orders o on o.customer_id = c.id and o.store_id = ${storeId}
      where c.store_id = ${storeId}
        and o.is_incomplete = false
      group by c.id
      having count(*) filter (
        where o.status = 'returned'
           or (o.status = 'cancelled' and o.confirmed_at is not null)
      ) >= 2
      order by 5 desc
      limit 20
    `),
  ])

  return {
    rows: rows.map((r) => ({
      id: r.id,
      match: r.match,
      value: r.value,
      action: r.action,
      reason: r.reason,
      hits: r.hits,
      lastHitAt: r.lastHitAt?.toISOString() ?? null,
    })),
    risky: [...risky].map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      refused: Number(r.refused),
      delivered: Number(r.delivered),
      isBlocked: Boolean(r.is_blocked),
    })),
  }
}
