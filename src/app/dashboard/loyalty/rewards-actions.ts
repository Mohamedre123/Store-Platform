'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { rewards } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type RewardState = { ok?: boolean; error?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'اكتب اسم المكافأة').max(60),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['coupon_percent', 'coupon_fixed', 'free_shipping', 'free_product']),
  /** النسبة بالمئة أو المبلغ بالجنيه — التحويل هنا */
  value: z.coerce.number().min(0).max(1_000_000).optional(),
  pointsCost: z.coerce.number().int().min(1, 'حدّد سعر المكافأة بالنقاط').max(1_000_000),
  minTier: z.enum(['bronze', 'silver', 'gold', 'platinum']).nullable().optional(),
  stock: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function saveRewardAction(raw: unknown): Promise<RewardState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store } = await getDashboardContext()

  /*
    النسبة بنقاط الأساس والمبلغ بالقرش — نفس وحدات باقي المشروع.
    الشحن المجاني والمنتج المجاني مالهمش قيمة رقمية.
  */
  const value =
    input.type === 'coupon_percent'
      ? Math.round((input.value ?? 0) * 100)
      : input.type === 'coupon_fixed'
        ? Math.round((input.value ?? 0) * 100)
        : 0

  const values = {
    name: input.name,
    description: input.description?.trim() || null,
    type: input.type,
    value,
    pointsCost: input.pointsCost,
    minTier: input.minTier ?? null,
    stock: input.stock ?? null,
    isActive: input.isActive ?? true,
  }

  if (input.id) {
    const updated = await db
      .update(rewards)
      .set(values)
      .where(and(eq(rewards.id, input.id), eq(rewards.storeId, store.id)))
      .returning({ id: rewards.id })

    if (!updated.length) return { error: 'المكافأة مش موجودة' }
  } else {
    await db.insert(rewards).values({ storeId: store.id, ...values })
  }

  revalidatePath('/dashboard/loyalty')
  return { ok: true }
}

export async function deleteRewardAction(id: string): Promise<RewardState> {
  const { store } = await getDashboardContext()

  const deleted = await db
    .delete(rewards)
    .where(and(eq(rewards.id, id), eq(rewards.storeId, store.id)))
    .returning({ id: rewards.id })

  if (!deleted.length) return { error: 'المكافأة مش موجودة' }

  revalidatePath('/dashboard/loyalty')
  return { ok: true }
}
