'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { affiliateConversions, affiliates } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { normalizePhone, toMinorUnits } from '@/lib/utils'

export type AffiliateInput = {
  id?: string
  name: string
  phone: string
  email: string
  code: string
  commissionType: 'percent' | 'fixed'
  /** نسبة مئوية أو مبلغ بالجنيه */
  commissionValue: string
  isActive: boolean
}

export type AffiliateState = { ok?: boolean; error?: string } | null

/**
 * حفظ مسوّق بالعمولة.
 *
 * الكود هو اللي بيتحط في الرابط (‎?ref=CODE‎) وبيتتبّع البيع. لازم يبقى
 * فريد داخل المتجر، وبنرفض التكرار بوضوح بدل ما نزوّد رقمًا — التاجر
 * بيدّي الكود ده لشخص، فلازم يبقى اللي اتفقوا عليه.
 */
export async function saveAffiliateAction(input: AffiliateInput): Promise<AffiliateState> {
  const { store } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اكتب اسم المسوّق' }

  const code = input.code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{2,24}$/.test(code)) {
    return { error: 'الكود حروف وأرقام إنجليزية بس (٢ لـ٢٤ خانة)' }
  }

  const clash = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(
      and(
        eq(affiliates.storeId, store.id),
        eq(affiliates.code, code),
        input.id ? ne(affiliates.id, input.id) : undefined,
      ),
    )
    .limit(1)

  if (clash.length > 0) return { error: 'الكود ده مستخدم لمسوّق تاني' }

  const raw = Number(input.commissionValue)
  if (!Number.isFinite(raw) || raw <= 0) return { error: 'قيمة العمولة لازم تكون أكبر من صفر' }
  if (input.commissionType === 'percent' && raw > 100) {
    return { error: 'نسبة العمولة مينفعش تزيد عن ١٠٠٪' }
  }

  const values = {
    name,
    phone: input.phone.trim() ? normalizePhone(input.phone, store.country === 'EG' ? '20' : '966') : null,
    email: input.email.trim() || null,
    code,
    commissionType: input.commissionType,
    // النسبة بنقاط الأساس والمبلغ بالوحدة الصغرى
    commissionValue:
      input.commissionType === 'percent' ? Math.round(raw * 100) : toMinorUnits(input.commissionValue),
    isActive: input.isActive,
  }

  if (input.id) {
    const updated = await db
      .update(affiliates)
      .set(values)
      .where(and(eq(affiliates.id, input.id), eq(affiliates.storeId, store.id)))
      .returning({ id: affiliates.id })
    if (!updated.length) return { error: 'المسوّق مش موجود' }
  } else {
    await db.insert(affiliates).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/affiliates')
  return { ok: true }
}

export async function deleteAffiliateAction(id: string): Promise<AffiliateState> {
  const { store } = await getDashboardContext()
  await db.delete(affiliates).where(and(eq(affiliates.id, id), eq(affiliates.storeId, store.id)))
  revalidatePath('/dashboard/affiliates')
  return { ok: true }
}

/**
 * تسجيل صرف العمولات.
 *
 * بنحوّل العمولات المعتمَدة لـ«مدفوعة» ونصفّر الرصيد. الإجمالي المدفوع
 * بيزيد — فالتاجر يقدر يراجع تاريخ الصرف بعدين.
 */
export async function payAffiliateAction(id: string): Promise<AffiliateState> {
  const { store } = await getDashboardContext()

  const [aff] = await db
    .select({ id: affiliates.id, balance: affiliates.balance })
    .from(affiliates)
    .where(and(eq(affiliates.id, id), eq(affiliates.storeId, store.id)))
    .limit(1)

  if (!aff) return { error: 'المسوّق مش موجود' }
  if (aff.balance <= 0) return { error: 'مفيش رصيد للصرف' }

  await db.transaction(async (tx) => {
    await tx
      .update(affiliateConversions)
      .set({ status: 'paid' })
      .where(
        and(eq(affiliateConversions.affiliateId, id), eq(affiliateConversions.status, 'approved')),
      )

    await tx
      .update(affiliates)
      .set({
        balance: 0,
        totalPaid: sql`${affiliates.totalPaid} + ${aff.balance}`,
      })
      .where(eq(affiliates.id, id))
  })

  revalidatePath('/dashboard/affiliates')
  return { ok: true }
}
