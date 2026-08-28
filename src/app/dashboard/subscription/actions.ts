'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { stores, subscriptionRequests } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { activateStore } from '@/lib/subscription'
import { ensureAccountId } from '@/lib/account-id'
import { getPlan } from '@/lib/plans'
import { paymentMessage, whatsappLink } from '@/lib/billing'
import { formatMoney } from '@/lib/utils'

export type RequestState =
  | { ok: true; whatsapp: string; alreadyPending: boolean }
  | { ok: false; error: string }

const schema = z.object({
  plan: z.enum(['monthly', 'yearly']),
  method: z.enum(['wallet', 'instapay']),
})

/**
 * «تم الدفع» — بيسجّل الطلب **قبل** ما يفتح واتساب.
 *
 * الترتيب ده هو كل الفكرة: التاجر اللي بيدوس الزرار وبعدين يقفل
 * الشباك، أو رسالته ما تتبعتش، أو يغيّر رأيه في الكتابة — بيفضل
 * ظاهر في لوحة الإدارة باسمه ومعرّفه ومتجره وباقته. لو استنينا
 * الرسالة، اللي ما بيبعتش بيبقى دافع ومستني ومحدّش يعرف إنه موجود.
 *
 * والزرار **ما بيفعّلش حاجة**. بيقول «ده بيقول إنه دفع» بس —
 * التفعيل قرار الإدارة بعد ما تشوف إيصال التحويل.
 */
export async function requestSubscriptionAction(raw: unknown): Promise<RequestState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'اختار الباقة الأول' }

  const { store, user } = await getDashboardContext()
  const plan = getPlan(parsed.data.plan)
  if (!plan) return { ok: false, error: 'الباقة مش معروفة' }

  const accountId = await ensureAccountId(user.id, user.publicId)

  /*
    طلب معلّق واحد لكل متجر.

    التاجر اللي بيدوس الزرار تلات مرات وهو مستني مش عايز تلات صفوف —
    ده بيخلّي قايمة الإدارة تكرارًا، وأول تفعيل بيسيب وراه طلبين
    شكلهم لسه مستنيين.
  */
  const [pending] = await db
    .select({ id: subscriptionRequests.id })
    .from(subscriptionRequests)
    .where(
      and(
        eq(subscriptionRequests.storeId, store.id),
        eq(subscriptionRequests.status, 'pending'),
      ),
    )
    .orderBy(desc(subscriptionRequests.createdAt))
    .limit(1)

  if (pending) {
    await db
      .update(subscriptionRequests)
      .set({ plan: plan.key, amount: plan.price, method: parsed.data.method, userId: user.id })
      .where(eq(subscriptionRequests.id, pending.id))
  } else {
    await db.insert(subscriptionRequests).values({
      storeId: store.id,
      userId: user.id,
      plan: plan.key,
      amount: plan.price,
      method: parsed.data.method,
      status: 'pending',
    })
  }

  revalidatePath('/dashboard/subscription')

  return {
    ok: true,
    alreadyPending: Boolean(pending),
    whatsapp: whatsappLink(
      paymentMessage({
        accountId,
        storeName: store.name,
        planName: plan.name,
        amount: formatMoney(plan.price, store.currency),
        method: parsed.data.method,
      }),
    ),
  }
}

/**
 * بدء التجربة المجانية — **بإيد التاجر من غير ما يكلّم حد**.
 *
 * ## ليه دي مختلفة عن الباقات المدفوعة
 * التجربة مبتكلّفش حاجة، فمفيش تحويل يتراجع ومفيش حاجة تتأكّد منها.
 * تعليقها على موافقة الإدارة كان هيخلّي التاجر يستنى مننا عشان
 * يجرّب — وده أسوأ من إنه ما يجرّبش.
 *
 * الباقات المدفوعة عكسها تمامًا: ما بتلمسش حالة المتجر خالص لحد ما
 * الإدارة تفعّل، عشان محدّش ياخد اشتراك بضغطة زرار من غير ما يدفع.
 *
 * ## مرة واحدة بس
 * الشرط `trialEndsAt IS NULL`. من غيره التاجر بيدوس الزرار كل ٣
 * أيام ويفضل مجرّب للأبد.
 */
export async function startTrialAction(): Promise<{ ok?: boolean; error?: string }> {
  const { store, user } = await getDashboardContext()

  const [row] = await db
    .select({ trialEndsAt: stores.trialEndsAt, subscribedUntil: stores.subscribedUntil })
    .from(stores)
    .where(eq(stores.id, store.id))
    .limit(1)

  if (!row) return { error: 'المتجر مش موجود' }
  if (row.trialEndsAt) return { error: 'التجربة المجانية اتستخدمت قبل كده.' }
  if (row.subscribedUntil && new Date(row.subscribedUntil) > new Date()) {
    return { error: 'عندك اشتراك شغّال بالفعل.' }
  }

  const res = await activateStore({
    storeId: store.id,
    plan: 'trial',
    adminId: user.id,
    selfServe: true,
  })
  if (!res.ok) return { error: res.error }

  revalidatePath('/dashboard/subscription')
  revalidatePath('/dashboard')
  return { ok: true }
}

/** إلغاء طلب معلّق — التاجر اللي دفع بالغلط أو غيّر رأيه */
export async function cancelRequestAction(): Promise<{ ok: boolean }> {
  const { store } = await getDashboardContext()
  await db
    .delete(subscriptionRequests)
    .where(
      and(eq(subscriptionRequests.storeId, store.id), eq(subscriptionRequests.status, 'pending')),
    )
  revalidatePath('/dashboard/subscription')
  return { ok: true }
}
