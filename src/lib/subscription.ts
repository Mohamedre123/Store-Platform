import 'server-only'
import { and, eq, isNotNull, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { stores, subscriptionRequests, subscriptions } from '@/db/schema'
import { getPlan, periodEnd, type Plan } from './plans'
import type { PlanKey } from '@/db/schema'

/**
 * دورة حياة الاشتراك.
 *
 * تلات أفعال بس: فعّل، ألغِ، وأنهِ اللي خلص. كلها هنا لأن كلها
 * بتكتب في نفس الأعمدة — ولو اتفرّقوا، حالة المتجر بتبقى نتيجة
 * أربع أماكن بتكتب فيها بترتيب مش مضمون.
 *
 * **التفعيل بياخد قرار الإدارة كمُدخَل، مش بيتّخذه.** مفيش هنا أي
 * فحص لـ«هل دفع فعلًا» لأن الدفع برّه المنصة أصلًا — اللي بيتحقّق
 * من صورة التحويل بني آدم، والدالة دي بتنفّذ قراره وتسجّله.
 */

export type ActivationResult = { ok: true; until: Date } | { ok: false; error: string }

/**
 * تفعيل باقة على متجر.
 *
 * التاريخ بيتحسب من **النهاردة أو من نهاية الفترة الحالية، أيّهما
 * أبعد**. التاجر اللي بيجدّد قبل ما اشتراكه يخلص مش المفروض يخسر
 * الأيام الفاضلة عشان دفع بدري.
 */
export async function activateStore(input: {
  storeId: string
  plan: PlanKey
  adminId: string
  /** طلب الاشتراك اللي اتقبل — لو التفعيل جه من طلب */
  requestId?: string
  note?: string
  /**
   * التاجر بدأها بنفسه — التجربة بس.
   *
   * بيتكتب في `paymentReference` عشان السجل يفرّق بين «الإدارة
   * فعّلت» و«التاجر بدأ تجربته». من غير التفرقة دي، صف في
   * `subscriptions` مالوش أب معروف.
   */
  selfServe?: boolean
}): Promise<ActivationResult> {
  const plan = getPlan(input.plan)
  if (!plan) return { ok: false, error: 'الباقة مش معروفة' }

  const [store] = await db
    .select({
      id: stores.id,
      currency: stores.currency,
      subscribedUntil: stores.subscribedUntil,
      trialEndsAt: stores.trialEndsAt,
    })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const now = new Date()
  const current = plan.key === 'trial' ? store.trialEndsAt : store.subscribedUntil
  const from = current && new Date(current) > now ? new Date(current) : now
  const until = periodEnd(plan, from)

  if (plan.key === 'trial') {
    await db
      .update(stores)
      .set({
        status: 'trial',
        plan: 'trial',
        trialEndsAt: until,
        activatedAt: now,
        activatedBy: input.adminId,
      })
      .where(eq(stores.id, store.id))
  } else {
    await db
      .update(stores)
      .set({
        status: 'active',
        plan: plan.key,
        subscribedUntil: until,
        activatedAt: now,
        activatedBy: input.adminId,
      })
      .where(eq(stores.id, store.id))
  }

  // سجل الفترات — التاجر بيشوفه في صفحة اشتراكه لما يسأل «أنا دفعت إمتى»
  await db.insert(subscriptions).values({
    storeId: store.id,
    plan: plan.key,
    status: plan.key === 'trial' ? 'trialing' : 'active',
    amount: plan.price,
    currency: store.currency,
    interval: plan.interval === 'year' ? 'year' : 'month',
    startedAt: now,
    currentPeriodEnd: until,
    /*
      التجديد مش تلقائي — مفيش بوابة تسحب من كارت. الفترة بتخلص
      وبتقف، والتاجر بيحوّل تاني. الكذب هنا كان هيخلّي التاجر
      يستنى تجديدًا مش هييجي.
    */
    autoRenew: false,
    paymentReference: input.requestId ?? (input.selfServe ? 'self_trial' : null),
  })

  if (input.requestId) {
    await db
      .update(subscriptionRequests)
      .set({
        status: 'approved',
        reviewedBy: input.adminId,
        reviewedAt: now,
        note: input.note ?? null,
      })
      .where(eq(subscriptionRequests.id, input.requestId))
  }

  return { ok: true, until }
}

/**
 * إلغاء التفعيل — فورًا لا في آخر الفترة.
 *
 * الزرار ده بيتضغط لما يتبيّن إن التحويل ما وصلش أو اترجع. تأجيل
 * الإيقاف لآخر الفترة في الحالة دي معناه شهر مجاني لحد ما دفعش.
 *
 * التواريخ بتترجّع لـ«عدّت» بدل ما تتمسح: الصفر بيخلّي المتجر يبان
 * كأنه عمره ما اشترك، والفرق ده بيغيّر الرسالة اللي بيشوفها.
 */
export async function deactivateStore(storeId: string, adminId: string): Promise<void> {
  const past = new Date(Date.now() - 1000)
  await db
    .update(stores)
    .set({
      status: 'suspended',
      /*
        الباقة بتتشال كمان.

        سيبها كانت بتخلّي صف الإدارة يقول «موقوف · الباقة: شهري»
        في نفس السطر — والاتنين مع بعض بيخلّوا اللي بيقرا يشك هو
        مشترك ولا لأ.
      */
      plan: null,
      subscribedUntil: past,
      trialEndsAt: past,
      activatedAt: new Date(),
      activatedBy: adminId,
    })
    .where(eq(stores.id, storeId))

  await db
    .update(subscriptions)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(and(eq(subscriptions.storeId, storeId), eq(subscriptions.status, 'active')))
}

/**
 * إنهاء الفترات اللي خلصت — بتتنادى من المهمة اليومية.
 *
 * **البوابة مش مستنية المهمة دي.** `getEntitlements` بيقارن التاريخ
 * بالوقت الحالي، فالمميزات بتتقفل في نفس الثانية اللي الفترة بتخلص
 * فيها حتى لو المهمة اتأخرت يومين. الدالة دي بتظبّط الحالة المكتوبة
 * عشان تطابق الحقيقة — لا عشان تصنعها.
 */
export async function expireSubscriptions(): Promise<{ expired: number }> {
  const now = new Date()

  const rows = await db
    .update(stores)
    .set({ status: 'past_due' })
    .where(
      or(
        and(eq(stores.status, 'active'), isNotNull(stores.subscribedUntil), lt(stores.subscribedUntil, now)),
        and(eq(stores.status, 'trial'), isNotNull(stores.trialEndsAt), lt(stores.trialEndsAt, now)),
      ),
    )
    .returning({ id: stores.id })

  if (rows.length > 0) {
    await db
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: now })
      .where(
        and(
          eq(subscriptions.status, 'active'),
          isNotNull(subscriptions.currentPeriodEnd),
          lt(subscriptions.currentPeriodEnd, now),
        ),
      )
  }

  return { expired: rows.length }
}

export type { Plan }
