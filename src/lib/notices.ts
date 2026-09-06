import 'server-only'
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { noticeDismissals, platformNotices } from '@/db/schema'

/**
 * رسايل إدارة المنصة للتجّار.
 *
 * ## المشكلة اللي بتحلّها
 * الإدارة عايزة تكافئ التاجر اللي وصل لحاجة: «وصّلت ١٠ طلبات، خد
 * شهر ببلاش»، أو «حِيل خمسة وياخدوا اشتراك والشهر عليّنا». الكلام
 * ده كان لازم يتبعت لكل واحد بإيده على واتساب — يعني عمليًّا ما
 * بيتبعتش.
 *
 * ## والشرط بيتقاس لحظة العرض
 * الإدارة بتكتب «لكل واحد وصّل ١٠ طلبات» مرة، والتاجر اللي بيوصل
 * بكرة بيشوفها بكرة لوحده. القايمة الثابتة كانت هتحتاج حد يفتحها
 * كل يوم ويضيف الجداد — يعني ميزة بتموت بعد أسبوع.
 */

export type NoticeTone = 'offer' | 'praise' | 'info'

export type MerchantNotice = {
  id: string
  title: string
  body: string
  ctaLabel: string | null
  ctaHref: string | null
  tone: NoticeTone
}

/** أرقام التاجر اللي الشروط بتتقاس عليها */
export type StoreStats = { deliveredOrders: number; referrals: number }

/**
 * أرقام المتجر — الطلبات المسلَّمة والإحالات اللي اشتركت.
 *
 * ## «مسلَّم» لا «مدفوع» ولا «متعمول»
 * الطلب اللي اتعمل ممكن يتلغي، واللي اتشحن ممكن يرجع. المسلَّم هو
 * الوحيد اللي بيقول إن التاجر باع فعلًا — والمكافأة على البيع
 * الحقيقي لا على رقم بيتغيّر.
 *
 * ## والإحالة بتتحسب لما المُحال **يشترك** لا لما يسجّل
 * التسجيل ببلاش وبيتكرر. المكافأة على تسجيل كانت هتخلّي أي حد
 * يفتح عشر حسابات وياخد عشر مكافآت.
 */
export async function storeStats(storeId: string): Promise<StoreStats> {
  const [row] = await db.execute<{ delivered: number; referrals: number }>(sql`
    select
      (select count(*)::int from orders
        where store_id = ${storeId} and status = 'delivered' and is_incomplete = false
      ) as delivered,
      (select count(*)::int from stores s
        where s.referred_by_store_id = ${storeId}
          and s.status in ('active', 'trial')
          and s.plan is not null
      ) as referrals
  `)

  return {
    deliveredOrders: Number(row?.delivered ?? 0),
    referrals: Number(row?.referrals ?? 0),
  }
}

/**
 * الرسايل اللي التاجر ده المفروض يشوفها دلوقتي.
 *
 * الفلترة على تلات مستويات، وكلها في استعلام واحد:
 * ١. شغّالة، وفي مدتها
 * ٢. جمهورها يشمله — الكل، أو متجره بالاسم، أو شرط حقّقه
 * ٣. ما قفلهاش قبل كده
 */
export async function noticesFor(
  storeId: string,
  stats: StoreStats,
): Promise<MerchantNotice[]> {
  const now = new Date()

  const rows = await db
    .select({
      id: platformNotices.id,
      title: platformNotices.title,
      body: platformNotices.body,
      ctaLabel: platformNotices.ctaLabel,
      ctaHref: platformNotices.ctaHref,
      tone: platformNotices.tone,
      audience: platformNotices.audience,
      targetStoreIds: platformNotices.targetStoreIds,
      minDeliveredOrders: platformNotices.minDeliveredOrders,
      minReferrals: platformNotices.minReferrals,
    })
    .from(platformNotices)
    .leftJoin(
      noticeDismissals,
      and(
        eq(noticeDismissals.noticeId, platformNotices.id),
        eq(noticeDismissals.storeId, storeId),
      ),
    )
    .where(
      and(
        eq(platformNotices.isActive, true),
        /* القفل بيخفيها نهائيًا — التاجر قال «شفتها» */
        isNull(noticeDismissals.noticeId),
        /*
          `lte`/`gte` لا قالب `sql` خام.

          القالب الخام بيمرّر الـ`Date` لسائق بوستجرس كنص، وهو
          بيرفضه: «The "string" argument must be of type string…
          Received an instance of Date». معاملات drizzle بتعرف
          النوع وبتحوّله صح.
        */
        or(isNull(platformNotices.startsAt), lte(platformNotices.startsAt, now))!,
        or(isNull(platformNotices.endsAt), gte(platformNotices.endsAt, now))!,
      ),
    )
    .orderBy(desc(platformNotices.createdAt))
    .limit(20)

  return rows
    .filter((r) => {
      if (r.audience === 'stores') return r.targetStoreIds.includes(storeId)
      if (r.audience === 'rule') {
        /*
          الشرطين **و** لا **أو**.

          الإدارة اللي بتكتب «وصّل ١٠ وحِيل ٥» قاصدة الاتنين. و«أو»
          كانت هتخلّي أي واحد فيهم كافيًا — يعني مكافأة بتتصرف على
          نص الشرط.
        */
        return (
          stats.deliveredOrders >= r.minDeliveredOrders && stats.referrals >= r.minReferrals
        )
      }
      return true
    })
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      ctaLabel: r.ctaLabel,
      ctaHref: r.ctaHref,
      tone: r.tone,
    }))
    /*
      تلاتة كحد أقصى في الشاشة.

      اللوحة مكانها الشغل. عشر بطاقات فوق بعض بتحوّل الصفحة الرئيسية
      للوحة إعلانات، والتاجر بيتعلّم يقفلها كلها من غير ما يقراها.
    */
    .slice(0, 3)
}

/** التاجر قفل الرسالة — بتختفي عنه للأبد */
export async function dismissNotice(storeId: string, noticeId: string): Promise<void> {
  await db.insert(noticeDismissals).values({ storeId, noticeId }).onConflictDoNothing()
}
