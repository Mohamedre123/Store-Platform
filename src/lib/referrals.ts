import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, referrals } from '@/db/schema'
import { getLoyaltySettings, recordPoints } from './loyalty'

/**
 * «هات صاحبك».
 *
 * العميل بيشارك كوده، وصاحبه يطلب لأول مرة، فالاتنين ياخدوا نقاط.
 * أرخص قناة تسويق عند التاجر الصغير: توصية من حد تعرفه بتحوّل أضعاف
 * أي إعلان.
 *
 * قاعدتين:
 *
 * 1. **الإحالة للعميل الجديد بس.** لو حسبناها على أي طلب، عميل قديم
 *    يستخدم كود صاحبه في كل طلب والاتنين ياخدوا نقاط بلا نهاية.
 * 2. **النقاط عند التسليم لا عند الطلب** — زي نقاط الشراء بالظبط.
 *    الطلب ممكن يتلغي، والنقاط على بيعة اتلغت خسارة.
 */

export const REFERRAL_COOKIE = 'zw_rf'

/** كود العميل — بيتولّد أول مرة يحتاجه وبيفضل ثابت بعدها */
export async function getOrCreateReferralCode(
  storeId: string,
  customerId: string,
): Promise<string> {
  const [row] = await db
    .select({ code: customers.referralCode })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))
    .limit(1)

  if (row?.code) return row.code

  /*
    محاولات قليلة عشان التصادم النادر. الكود قصير عن قصد — العميل
    بيمليه على صاحبه بصوته أحيانًا، والكود الطويل بيتقال غلط.
  */
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const [clash] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.referralCode, code)))
      .limit(1)

    if (clash) continue

    await db
      .update(customers)
      .set({ referralCode: code })
      .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))

    return code
  }

  throw new Error('تعذّر توليد كود إحالة')
}

/** صاحب الكود — أو null لو الكود مش صحيح */
export async function findReferrer(storeId: string, code: string) {
  const clean = code.trim().toUpperCase()
  if (!clean) return null

  const [row] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(and(eq(customers.storeId, storeId), sql`upper(${customers.referralCode}) = ${clean}`))
    .limit(1)

  return row ?? null
}

/**
 * تسجيل إحالة وقت الطلب.
 *
 * بيرجّع false من غير ما يرمي: الإحالة إضافة على الطلب مش شرط ليه،
 * وأي فشل هنا ما يصحّش يمنع بيعة.
 */
export async function recordReferral(input: {
  storeId: string
  code: string
  referredCustomerId: string
  /** عدد طلبات العميل قبل الطلب ده — الإحالة للجديد بس */
  previousOrders: number
  orderId: string
}): Promise<boolean> {
  if (input.previousOrders > 0) return false

  const settings = await getLoyaltySettings(input.storeId)
  if (!settings?.enabled || settings.referralPoints <= 0) return false

  const referrer = await findReferrer(input.storeId, input.code)
  if (!referrer) return false
  // العميل ما يحيلش نفسه
  if (referrer.id === input.referredCustomerId) return false

  try {
    await db.insert(referrals).values({
      storeId: input.storeId,
      referrerCustomerId: referrer.id,
      referredCustomerId: input.referredCustomerId,
      code: input.code.trim().toUpperCase(),
      orderId: input.orderId,
      rewardPoints: settings.referralPoints,
      status: 'completed',
    })
    return true
  } catch {
    // الفهرس الفريد بيرفض العميل المُحال مرتين — ده المطلوب
    return false
  }
}

/**
 * صرف نقاط الإحالة لما الطلب يتسلّم.
 *
 * الاتنين بياخدوا: اللي حوّل واللي اتحوّل. المكافأة من طرف واحد
 * بتخلّي المُحال يحس إنه اتستخدم.
 */
export async function rewardReferralForOrder(storeId: string, orderId: string): Promise<void> {
  const [row] = await db
    .select({
      id: referrals.id,
      referrerCustomerId: referrals.referrerCustomerId,
      referredCustomerId: referrals.referredCustomerId,
      rewardPoints: referrals.rewardPoints,
      status: referrals.status,
    })
    .from(referrals)
    .where(and(eq(referrals.storeId, storeId), eq(referrals.orderId, orderId)))
    .limit(1)

  if (!row || row.status === 'rewarded' || row.rewardPoints <= 0) return

  // الحالة الأول: لو المنح فشل في النص، إعادة المحاولة ما تمنحش مرتين
  const claimed = await db
    .update(referrals)
    .set({ status: 'rewarded' })
    .where(and(eq(referrals.id, row.id), eq(referrals.status, 'completed')))
    .returning({ id: referrals.id })

  if (!claimed.length) return

  await recordPoints({
    storeId,
    customerId: row.referrerCustomerId,
    points: row.rewardPoints,
    type: 'earn',
    reason: 'إحالة صاحب',
    orderId,
  })

  if (row.referredCustomerId) {
    await recordPoints({
      storeId,
      customerId: row.referredCustomerId,
      points: row.rewardPoints,
      type: 'earn',
      reason: 'دخلت بكود إحالة',
      orderId,
    })
  }
}

/** إحصائيات العميل — كام حوّل وكام نقطة كسب منهم */
export async function getReferralStats(storeId: string, customerId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      rewarded: sql<number>`count(*) filter (where ${referrals.status} = 'rewarded')::int`,
      points: sql<number>`coalesce(sum(${referrals.rewardPoints}) filter (where ${referrals.status} = 'rewarded'), 0)::int`,
    })
    .from(referrals)
    .where(and(eq(referrals.storeId, storeId), eq(referrals.referrerCustomerId, customerId)))

  return { total: row?.total ?? 0, rewarded: row?.rewarded ?? 0, points: row?.points ?? 0 }
}

/**
 * كود الإحالة.
 * من غير الحروف اللي بتتلخبط في القراءة أو النطق: 0/O و1/I/L.
 */
function randomCode(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}
