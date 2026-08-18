'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { coupons } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { toMinorUnits } from '@/lib/utils'
import type { CouponAppliesTo, CouponEligibility, CouponType } from '@/db/schema'

export type CouponInput = {
  id?: string
  code: string
  description: string
  type: CouponType
  /** للنسبة: رقم من 1 لـ100 · للثابت: مبلغ بالجنيه · لشحن مجاني: يتجاهَل */
  value: string
  maxDiscount: string
  minOrder: string
  appliesTo: CouponAppliesTo
  targetIds: string[]
  eligibility: CouponEligibility
  usageLimit: string
  usageLimitPerCustomer: string
  startsAt: string
  endsAt: string
  isActive: boolean
}

export type CouponState = { ok?: boolean; error?: string } | null

function normalize(input: CouponInput, storeId: string) {
  const code = input.code.trim().toUpperCase()
  if (!code) return { error: 'اكتب كود الخصم' as const }
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    return { error: 'الكود حروف وأرقام إنجليزية بس (٢ لـ٣٢ خانة)' as const }
  }

  // النسبة تتخزّن بنقاط الأساس (10% → 1000)، الثابت بالوحدة الصغرى
  let value = 0
  if (input.type === 'percent') {
    const pct = Number(input.value)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { error: 'النسبة لازم تكون من ١ لـ١٠٠' as const }
    value = Math.round(pct * 100)
  } else if (input.type === 'fixed') {
    value = toMinorUnits(input.value)
    if (value <= 0) return { error: 'قيمة الخصم لازم تكون أكبر من صفر' as const }
  }

  const parseDate = (s: string) => (s ? new Date(s) : null)
  const startsAt = parseDate(input.startsAt)
  const endsAt = parseDate(input.endsAt)
  if (startsAt && endsAt && endsAt < startsAt) return { error: 'تاريخ الانتهاء قبل البداية' as const }

  return {
    values: {
      storeId,
      code,
      description: input.description.trim() || null,
      type: input.type,
      value,
      maxDiscount: input.type === 'percent' ? toMinorUnits(input.maxDiscount) : 0,
      minOrder: toMinorUnits(input.minOrder),
      appliesTo: input.appliesTo,
      targetIds: input.appliesTo === 'all' ? [] : input.targetIds,
      eligibility: input.eligibility,
      usageLimit: input.usageLimit.trim() ? Math.max(1, Math.trunc(Number(input.usageLimit))) : null,
      usageLimitPerCustomer: Math.max(1, Math.trunc(Number(input.usageLimitPerCustomer) || 1)),
      startsAt,
      endsAt,
      isActive: input.isActive,
    },
  }
}

export async function saveCouponAction(input: CouponInput): Promise<CouponState> {
  const { store } = await getDashboardContext()
  const result = normalize(input, store.id)
  if ('error' in result) return { error: result.error }

  try {
    if (input.id) {
      const updated = await db
        .update(coupons)
        .set(result.values)
        .where(and(eq(coupons.id, input.id), eq(coupons.storeId, store.id)))
        .returning({ id: coupons.id })
      if (!updated.length) return { error: 'الكوبون مش موجود' }
    } else {
      await db.insert(coupons).values(result.values)
    }
  } catch (e) {
    // الفهرس الفريد (store_id, code) بيمنع التكرار
    if (String(e).includes('coupons_store_code_unique')) return { error: 'فيه كوبون بنفس الكود' }
    throw e
  }

  revalidatePath('/dashboard/marketing')
  return { ok: true }
}

export async function toggleCouponAction(id: string, isActive: boolean): Promise<CouponState> {
  const { store } = await getDashboardContext()
  await db
    .update(coupons)
    .set({ isActive })
    .where(and(eq(coupons.id, id), eq(coupons.storeId, store.id)))
  revalidatePath('/dashboard/marketing')
  return { ok: true }
}

export async function deleteCouponAction(id: string): Promise<CouponState> {
  const { store } = await getDashboardContext()
  await db.delete(coupons).where(and(eq(coupons.id, id), eq(coupons.storeId, store.id)))
  revalidatePath('/dashboard/marketing')
  return { ok: true }
}
