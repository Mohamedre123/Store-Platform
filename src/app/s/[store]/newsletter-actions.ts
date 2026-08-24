'use server'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { getStore } from '@/lib/storefront'

/**
 * تسجيل بريد في نشرة المتجر.
 *
 * بيروح على **جدول عملاء التاجر** لا قايمة منفصلة: العميل اللي سجّل
 * بريده هنا وبعدين طلب لازم يبقى شخصًا واحدًا. القايمتين المنفصلتين
 * معناهما إن التاجر بيبعت نفس الحملة لنفس الشخص مرتين ويحسبه اتنين.
 */
export async function subscribeAction(input: {
  storeIdentifier: string
  email: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'اكتب بريدًا صحيحًا' }
  }

  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const [existing] = await db
    .select({ id: customers.id, accepts: customers.acceptsMarketing })
    .from(customers)
    .where(and(eq(customers.storeId, store.id), eq(customers.email, email)))
    .limit(1)

  if (existing) {
    /*
      اللي سجّل قبل كده بيتقاله «تمام» زي أي حد تاني.
      «إنت مسجّل أصلًا» بتكشف إن البريد ده عنده حساب في المتجر —
      وده تسريب لأي حد بيجرّب بريد حدّ تاني.
    */
    if (!existing.accepts) {
      await db
        .update(customers)
        .set({ acceptsMarketing: true })
        .where(eq(customers.id, existing.id))
    }
    return { ok: true }
  }

  await db.insert(customers).values({
    storeId: store.id,
    email,
    acceptsMarketing: true,
    tags: ['نشرة'],
  })

  return { ok: true }
}
