import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { affiliateConversions, affiliates } from '@/db/schema'
import { applyBps } from './utils'

/**
 * تتبّع المسوّقين بالعمولة.
 *
 * الرابط ‎?ref=CODE‎ بيتخزّن في كوكي، ولما العميل يطلب بنقيّد البيعة
 * للمسوّق. الكوكي بيعيش ٣٠ يوم — العميل نادرًا بيشتري من أول زيارة،
 * ولو انتهى بسرعة المسوّق بيخسر بيعة هو سببها فعلًا.
 *
 * العمولة بتتحسب على **المنتجات بعد الخصم** لا على الإجمالي: الشحن مش
 * ربح للتاجر، والعمولة عليه بتاكل من هامشه.
 */

export const REF_COOKIE = 'zw_ref'
export const REF_DAYS = 30

export async function findAffiliateByCode(storeId: string, code: string) {
  const [row] = await db
    .select({
      id: affiliates.id,
      commissionType: affiliates.commissionType,
      commissionValue: affiliates.commissionValue,
    })
    .from(affiliates)
    .where(
      and(
        eq(affiliates.storeId, storeId),
        sql`upper(${affiliates.code}) = ${code.trim().toUpperCase()}`,
        eq(affiliates.isActive, true),
      ),
    )
    .limit(1)

  return row ?? null
}

/** يزوّد عدّاد الضغطات — بيتنادى مرة واحدة لما الكوكي يتحط */
export async function recordAffiliateClick(affiliateId: string) {
  await db
    .update(affiliates)
    .set({ clicks: sql`${affiliates.clicks} + 1` })
    .where(eq(affiliates.id, affiliateId))
}

/**
 * تسجيل بيعة لمسوّق.
 *
 * بتتنادى بعد ما الطلب يتسجّل. الحالة «قيد الانتظار» لحد ما التاجر
 * يعتمدها — الطلب ممكن يتلغي أو يترجّع، والعمولة على بيعة اتلغت خسارة
 * مباشرة.
 */
export async function recordAffiliateConversion(input: {
  storeId: string
  affiliateId: string
  orderId: string
  /** المنتجات بعد الخصم — أساس العمولة */
  eligibleAmount: number
  orderTotal: number
}): Promise<number> {
  const [aff] = await db
    .select({
      commissionType: affiliates.commissionType,
      commissionValue: affiliates.commissionValue,
    })
    .from(affiliates)
    .where(eq(affiliates.id, input.affiliateId))
    .limit(1)

  if (!aff) return 0

  const commission =
    aff.commissionType === 'percent'
      ? applyBps(input.eligibleAmount, aff.commissionValue)
      : Math.min(aff.commissionValue, input.eligibleAmount)

  if (commission <= 0) return 0

  await db.transaction(async (tx) => {
    await tx.insert(affiliateConversions).values({
      affiliateId: input.affiliateId,
      storeId: input.storeId,
      orderId: input.orderId,
      orderTotal: input.orderTotal,
      commission,
      status: 'pending',
    })

    await tx
      .update(affiliates)
      .set({ conversions: sql`${affiliates.conversions} + 1` })
      .where(eq(affiliates.id, input.affiliateId))
  })

  return commission
}

/**
 * اعتماد عمولة — بتتنادى لما الطلب يتسلّم.
 *
 * هنا بس بيتضاف الرصيد. قبل التسليم العمولة مسجّلة بس مش مستحقة.
 */
export async function approveAffiliateCommission(orderId: string) {
  const [row] = await db
    .select({
      id: affiliateConversions.id,
      affiliateId: affiliateConversions.affiliateId,
      commission: affiliateConversions.commission,
      status: affiliateConversions.status,
    })
    .from(affiliateConversions)
    .where(eq(affiliateConversions.orderId, orderId))
    .limit(1)

  if (!row || row.status !== 'pending') return

  await db.transaction(async (tx) => {
    await tx
      .update(affiliateConversions)
      .set({ status: 'approved' })
      .where(eq(affiliateConversions.id, row.id))

    await tx
      .update(affiliates)
      .set({
        balance: sql`${affiliates.balance} + ${row.commission}`,
        totalEarned: sql`${affiliates.totalEarned} + ${row.commission}`,
      })
      .where(eq(affiliates.id, row.affiliateId))
  })
}

/** إلغاء عمولة — الطلب اتلغى أو اترجّع */
export async function cancelAffiliateCommission(orderId: string) {
  const [row] = await db
    .select({
      id: affiliateConversions.id,
      affiliateId: affiliateConversions.affiliateId,
      commission: affiliateConversions.commission,
      status: affiliateConversions.status,
    })
    .from(affiliateConversions)
    .where(eq(affiliateConversions.orderId, orderId))
    .limit(1)

  if (!row || row.status === 'paid' || row.status === 'cancelled') return

  await db.transaction(async (tx) => {
    await tx
      .update(affiliateConversions)
      .set({ status: 'cancelled' })
      .where(eq(affiliateConversions.id, row.id))

    // لو كانت معتمَدة بالفعل، بنسحب الرصيد اللي اتضاف
    if (row.status === 'approved') {
      await tx
        .update(affiliates)
        .set({
          balance: sql`greatest(0, ${affiliates.balance} - ${row.commission})`,
          totalEarned: sql`greatest(0, ${affiliates.totalEarned} - ${row.commission})`,
        })
        .where(eq(affiliates.id, row.affiliateId))
    }
  })
}
