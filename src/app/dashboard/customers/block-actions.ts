'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { blocklist, customers } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { normalizeBlockValue } from '@/lib/blocklist'
import { recordAudit } from '@/lib/audit'

export type BlockState = { ok?: boolean; error?: string } | null

const addSchema = z.object({
  match: z.enum(['phone', 'email', 'ip', 'name']),
  value: z.string().trim().min(2, 'اكتب القيمة').max(160),
  action: z.enum(['reject', 'flag']).default('reject'),
  reason: z.string().trim().max(200).nullish(),
})

/**
 * إضافة صف للحظر.
 *
 * القيمة بتتخزّن **مطبّعة** بنفس الدالة اللي الفحص بيستخدمها: من
 * غير كده التاجر بيحظر «01001234567» والعميل بيكتب «+201001234567»
 * ويعدّي — ويفضل التاجر شايف الحظر مسجّل ومش فاهم ليه مش شغّال.
 */
export async function addBlockAction(raw: unknown): Promise<BlockState> {
  const parsed = addSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const value = normalizeBlockValue(input.match, input.value, store.country)
  if (!value) return { error: 'القيمة مش مظبوطة' }

  await db
    .insert(blocklist)
    .values({
      storeId: store.id,
      match: input.match,
      value,
      action: input.action,
      reason: input.reason?.trim() || null,
      createdBy: user.id,
    })
    /*
      نفس القيمة مرتين مش خطأ.

      التاجر بيحظر رقمًا وبينسى إنه حظره وبيحظره تاني. رسالة خطأ هنا
      كانت هتخلّيه يفتكر إن الحظر ما اشتغلش — والنتيجة اللي عايزها
      (الرقم محظور) حاصلة في الحالتين.
    */
    .onConflictDoUpdate({
      target: [blocklist.storeId, blocklist.match, blocklist.value],
      set: { action: input.action, reason: input.reason?.trim() || null },
    })

  revalidatePath('/dashboard/customers/blocked')
  return { ok: true }
}

export async function removeBlockAction(id: string): Promise<BlockState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  await db.delete(blocklist).where(and(eq(blocklist.id, id), eq(blocklist.storeId, store.id)))

  revalidatePath('/dashboard/customers/blocked')
  return { ok: true }
}

/**
 * حظر عميل بعينه — أو فكّ حظره.
 *
 * بيحظر **الصف والرقم معًا**: الصف بيمنعه لو رجع بنفس الحساب،
 * والرقم بيمنعه لو طلب كضيف من غير تسجيل. من غير التانية، أي
 * محظور بيعمل طلبًا جديدًا كضيف ويعدّي.
 */
export async function setCustomerBlockedAction(
  customerId: string,
  blocked: boolean,
): Promise<BlockState> {
  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const [row] = await db
    .select({ id: customers.id, phone: customers.phone, name: customers.name })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, store.id)))
    .limit(1)

  if (!row) return { error: 'العميل مش موجود' }

  await db
    .update(customers)
    .set({ isBlocked: blocked })
    .where(and(eq(customers.id, row.id), eq(customers.storeId, store.id)))

  if (row.phone) {
    const value = normalizeBlockValue('phone', row.phone, store.country)
    if (blocked) {
      await db
        .insert(blocklist)
        .values({
          storeId: store.id,
          match: 'phone',
          value,
          action: 'reject',
          reason: `حظر العميل ${row.name ?? ''}`.trim(),
          createdBy: user.id,
        })
        .onConflictDoNothing()
    } else {
      await db
        .delete(blocklist)
        .where(
          and(
            eq(blocklist.storeId, store.id),
            eq(blocklist.match, 'phone'),
            eq(blocklist.value, value),
          ),
        )
    }
  }

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'order.cancel',
    resource: 'customer',
    resourceId: row.id,
    after: { blocked },
  })

  revalidatePath('/dashboard/customers')
  revalidatePath('/dashboard/customers/blocked')
  return { ok: true }
}
