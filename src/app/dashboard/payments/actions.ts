'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { paymentMethods } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { toMinorUnits } from '@/lib/utils'

export type PaymentInput = {
  gateway: string
  enabled: boolean
  displayName: string
  instructions: string
  /** رسوم ثابتة تُضاف للطلب (بالجنيه) — مفيدة للدفع عند الاستلام */
  fixedFee: string
}

export type PaymentState = { ok?: boolean; error?: string } | null

/**
 * حفظ طريقة دفع.
 *
 * upsert حسب (المتجر، البوابة): التاجر بيفعّل الدفع عند الاستلام أو
 * التحويل، ويكتب تعليماته ورسومه، فتظهر للعميل في الشيك أوت فورًا.
 * الرسوم بتتحسب في إجمالي الطلب على الخادم — نفس مبدأ الأسعار.
 */
export async function savePaymentMethodAction(input: PaymentInput): Promise<PaymentState> {
  const { store } = await getDashboardContext()

  if (input.enabled && !input.displayName.trim()) {
    return { error: 'اكتب اسمًا للطريقة يشوفه العميل' }
  }

  const values = {
    enabled: input.enabled,
    displayName: input.displayName.trim() || null,
    instructions: input.instructions.trim() || null,
    fixedFee: toMinorUnits(input.fixedFee),
  }

  const [existing] = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.gateway, input.gateway)))
    .limit(1)

  if (existing) {
    await db.update(paymentMethods).set(values).where(eq(paymentMethods.id, existing.id))
  } else {
    await db.insert(paymentMethods).values({ ...values, storeId: store.id, gateway: input.gateway })
  }

  revalidatePath('/dashboard/payments')
  return { ok: true }
}
