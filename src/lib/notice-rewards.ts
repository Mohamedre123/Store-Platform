import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { noticeRedemptions, stores, subscriptions } from '@/db/schema'
import { eligibleNotice } from './notices'
import { getPlan } from './plans'

/**
 * تفعيل مكافأة الرسالة بضغطة.
 *
 * ## المشكلة اللي بيحلّها
 * الزرار كان بياخد رابطًا الإدارة بتكتبه بإيدها. اللي بيكتب الرسالة
 * مش مبرمج، فأحسن حالات الرابط إنه يوصّل التاجر لصفحة يدوّر فيها
 * على مكافأته — وأسوأ حالاته إنه يوديه على ٤٠٤. المكافأة اللي
 * محتاجة الطرفين يتكلّموا على واتساب عشان تتفعّل مش مكافأة، دي
 * مهمة.
 *
 * ## والأيام بتتضاف على آخر اشتراكه لا بتستبدله
 * التاجر اللي فاضله عشر أيام وخد شهر بيبقى عنده أربعين — لا تلاتين.
 * الاستبدال كان بياخد منه أيام دفع تمنها، والمكافأة تتحوّل لعقاب
 * على إنه جدّد بدري. ونفس القاعدة بالظبط في `activateStore`:
 * `max(دلوقتي, نهاية الفترة)`.
 */

export type RedeemResult =
  | { ok: true; until: Date; days: number }
  | { ok: false; error: string }

export async function redeemNoticeReward(
  storeId: string,
  noticeId: string,
): Promise<RedeemResult> {
  /*
    الاستحقاق بيتفحص من الأول.

    المعرّف بييجي من المتصفح — من غير الفحص ده أي تاجر بيبعت أي
    معرّف وياخد مكافأة مكتوبة لحد تاني.
  */
  const notice = await eligibleNotice(storeId, noticeId)
  if (!notice) return { ok: false, error: 'المكافأة دي مش متاحة لك' }

  if (notice.rewardKind !== 'free_days') {
    return { ok: false, error: 'الرسالة دي مالهاش مكافأة تتفعّل' }
  }

  const days = Math.max(1, Math.min(365, notice.rewardDays))

  const [store] = await db
    .select({
      id: stores.id,
      currency: stores.currency,
      plan: stores.plan,
      subscribedUntil: stores.subscribedUntil,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const now = new Date()

  /*
    من النهاردة أو من نهاية اشتراكه، أيّهما أبعد.

    نفس قاعدة `activateStore` بالحرف — التاجر اللي بيجدّد بدري
    مش المفروض يخسر الأيام الفاضلة.
  */
  const from =
    store.subscribedUntil && new Date(store.subscribedUntil) > now
      ? new Date(store.subscribedUntil)
      : now

  const until = new Date(from)
  until.setDate(until.getDate() + days)

  /*
    الباقة: اللي عنده لو مدفوعة، وإلا الشهرية.

    «شهر ببلاش» لتاجر لسه في التجربة معناه شهر من المنتج الكامل —
    مدّ التجربة كان هيديله نفس القيود اللي المكافأة المفروض تفتحها،
    والإدارة اللي كتبت المكافأة ما قصدتش كده.
  */
  const paid = getPlan(store.plan)
  const plan = paid && paid.price > 0 ? paid.key : 'monthly'

  /*
    الحجز الأول، والمنح بعده.

    الصف بيتحجز بـ`onConflictDoNothing`؛ لو رجع فاضي يبقى حد سبقنا
    وبنقف من غير ما نمنح تاني. والعكس — نمنح الأول ونسجّل بعدين —
    كان بيدّي التاجر اللي بيدوس مرتين بسرعة شهرين، لأن الطلبين
    بيقروا «لسه ماخدهاش» قبل ما أي واحد فيهم يكتب.
  */
  const claimed = await db
    .insert(noticeRedemptions)
    .values({ noticeId, storeId, grantedDays: days, grantedUntil: until })
    .onConflictDoNothing()
    .returning({ id: noticeRedemptions.id })

  if (claimed.length === 0) {
    return { ok: false, error: 'المكافأة دي اتفعّلت قبل كده' }
  }

  await db
    .update(stores)
    .set({ status: 'active', plan, subscribedUntil: until, activatedAt: now })
    .where(eq(stores.id, storeId))

  /*
    وصف في سجل الفترات — التاجر بيشوفه في صفحة اشتراكه.

    من غيره بيلاقي مدته اتمدّت ومفيش سطر بيفسّر ليه، فبيفتكرها غلطة
    وبيسأل. و`amount: 0` بيخلّي التقارير المالية ما تحسبهاش إيرادًا
    ما دخلش.
  */
  await db.insert(subscriptions).values({
    storeId,
    plan,
    status: 'active',
    amount: 0,
    currency: store.currency,
    interval: 'month',
    startedAt: now,
    currentPeriodEnd: until,
    autoRenew: false,
    paymentReference: `reward:${noticeId}`,
  })

  return { ok: true, until, days }
}
