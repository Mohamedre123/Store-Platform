'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { shippingMethods } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'

export type MethodState = { ok?: boolean; error?: string; id?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'اكتب اسم الطريقة').max(40),
  hint: z.string().trim().max(80).nullish(),
  /**
   * فرق السعر بالقرش — ممكن يكون سالبًا.
   *
   * الحد الأدنى سالب مليون قرش (١٠ آلاف جنيه) مش صفر: «استلام من
   * الفرع» و«شحن اقتصادي» بيقلّلوا السعر، ومنعهم بيلغي نص فايدة
   * الميزة. والقصّ عند صفر بيحصل وقت الحساب لا وقت الحفظ.
   */
  priceDelta: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  minDays: z.coerce.number().int().min(0).max(120).nullish(),
  maxDays: z.coerce.number().int().min(0).max(120).nullish(),
  enabled: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
})

export async function saveShippingMethodAction(raw: unknown): Promise<MethodState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  /* «من ٣ لـ١ أيام» مالهاش معنى — بنقلبهم بدل ما نرفض */
  const min = input.minDays ?? null
  const max = input.maxDays ?? null
  const [lo, hi] = min !== null && max !== null && min > max ? [max, min] : [min, max]

  const values = {
    name: input.name,
    hint: input.hint?.trim() || null,
    priceDelta: input.priceDelta,
    minDays: lo,
    maxDays: hi,
    enabled: input.enabled,
    sortOrder: input.sortOrder,
  }

  if (input.id) {
    const updated = await db
      .update(shippingMethods)
      .set(values)
      .where(and(eq(shippingMethods.id, input.id), eq(shippingMethods.storeId, store.id)))
      .returning({ id: shippingMethods.id })

    if (!updated.length) return { error: 'الطريقة مش موجودة' }
    revalidatePath('/dashboard/shipping')
    return { ok: true, id: updated[0].id }
  }

  const [created] = await db
    .insert(shippingMethods)
    .values({ storeId: store.id, ...values })
    .returning({ id: shippingMethods.id })

  revalidatePath('/dashboard/shipping')
  return { ok: true, id: created.id }
}

/**
 * حذف طريقة شحن.
 *
 * الطلبات القديمة ما بتتأثرش: سعر الشحن اتحفظ على الطلب نفسه وقت
 * الشرا (`orders.shippingTotal`)، فالفاتورة القديمة بتفضل صح بعد
 * الحذف.
 */
export async function deleteShippingMethodAction(id: string): Promise<MethodState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  await db
    .delete(shippingMethods)
    .where(and(eq(shippingMethods.id, id), eq(shippingMethods.storeId, store.id)))

  revalidatePath('/dashboard/shipping')
  return { ok: true }
}
