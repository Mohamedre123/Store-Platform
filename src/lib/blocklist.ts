import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { blocklist, customers } from '@/db/schema'
import { normalizePhone } from './utils'
import type { BlockMatch } from '@/db/schema'

/**
 * فحص الحظر قبل تسجيل الطلب.
 *
 * ## المشكلة اللي بيحلّها
 * الدفع عند الاستلام معناه إن التاجر بيشحن على أمل. واللي بيطلب
 * بأرقام وهمية بيكلّفه شحن رايح وجاي في كل مرة — وهو أكبر بند خسارة
 * عنده. ولحد دلوقتي الطريقة الوحيدة قدامه إنه يفتكر الرقم بنفسه.
 *
 * ## استعلام واحد للطلب كله
 * الفحص بيتنادى في مسار العميل، ومسار العميل مقدّس: أي استعلام
 * زيادة بيتضاعف على كل طلب في المنصة. فبنسأل مرة واحدة عن كل
 * القيم مع بعض بدل استعلام لكل نوع.
 */

export type BlockDecision =
  | { blocked: false; flagged: false }
  | { blocked: true; flagged: false; reason: string | null; ids: string[] }
  | { blocked: false; flagged: true; reason: string | null; ids: string[] }

const NONE: BlockDecision = { blocked: false, flagged: false }

/** التطبيع لازم يبقى واحد وقت الحفظ ووقت الفحص — وإلا الحظر ما بيطابقش أبدًا */
export function normalizeBlockValue(match: BlockMatch, value: string, country = 'EG'): string {
  const v = value.trim()
  if (match === 'phone') return normalizePhone(v, country === 'EG' ? '20' : '966')
  if (match === 'email') return v.toLowerCase()
  if (match === 'name') return v.toLowerCase().replace(/\s+/g, ' ')
  return v
}

export async function checkBlocked(input: {
  storeId: string
  country?: string
  phone?: string | null
  email?: string | null
  ip?: string | null
  name?: string | null
}): Promise<BlockDecision> {
  const country = input.country ?? 'EG'

  const pairs: Array<{ match: BlockMatch; value: string }> = []
  if (input.phone) pairs.push({ match: 'phone', value: normalizeBlockValue('phone', input.phone, country) })
  if (input.email) pairs.push({ match: 'email', value: normalizeBlockValue('email', input.email) })
  if (input.ip) pairs.push({ match: 'ip', value: input.ip.trim() })
  if (input.name) pairs.push({ match: 'name', value: normalizeBlockValue('name', input.name) })

  if (pairs.length === 0) return NONE

  /*
    القيم كلها في شرط واحد.

    استعلام لكل نوع كان معناه ٤ رحلات على كل طلب — وده تمن غالي
    على فحص أغلب نتيجته «مفيش حاجة».
  */
  const rows = await db
    .select({
      id: blocklist.id,
      action: blocklist.action,
      reason: blocklist.reason,
    })
    .from(blocklist)
    .where(
      and(
        eq(blocklist.storeId, input.storeId),
        sql`(${blocklist.match}, ${blocklist.value}) in (${sql.join(
          pairs.map((p) => sql`(${p.match}, ${p.value})`),
          sql`, `,
        )})`,
      ),
    )

  if (rows.length === 0) return NONE

  /*
    الرفض بيغلب التعليم.

    لو الرقم متعلّم عليه والبريد مرفوض، الطلب بيترفض: الأخطر بيحكم،
    لأن السماح بناءً على أضعف تطابق بيفضي الحظر من معناه.
  */
  const rejecting = rows.filter((r) => r.action === 'reject')
  const chosen = rejecting.length ? rejecting : rows

  await recordHits(chosen.map((r) => r.id))

  return rejecting.length
    ? { blocked: true, flagged: false, reason: chosen[0].reason, ids: chosen.map((r) => r.id) }
    : { blocked: false, flagged: true, reason: chosen[0].reason, ids: chosen.map((r) => r.id) }
}

/**
 * تسجيل إن الصف ده منع طلبًا فعلًا.
 *
 * بيتنفّذ من غير انتظار عن قصد — ولا بيرمي: عدّاد إحصائي ما يصحّش
 * يوقّف قرار الحظر نفسه ولا يبطّئ رد الشيك أوت.
 */
async function recordHits(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    await db
      .update(blocklist)
      .set({ hits: sql`${blocklist.hits} + 1`, lastHitAt: new Date() })
      .where(inArray(blocklist.id, ids))
  } catch {
    /* العدّاد مش أهم من الطلب */
  }
}

/**
 * العميل نفسه محظور؟
 *
 * `customers.isBlocked` كان موجودًا في المخطط من غير أي فحص في أي
 * مكان — يعني التاجر يقدر يدوس «احظر» ويلاقي نفس العميل بيطلب تاني.
 * ده بيقفل الفجوة دي.
 */
export async function isCustomerBlocked(storeId: string, customerId: string): Promise<boolean> {
  const [row] = await db
    .select({ blocked: customers.isBlocked })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))
    .limit(1)
  return Boolean(row?.blocked)
}
