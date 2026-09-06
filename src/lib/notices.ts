import 'server-only'
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { noticeDismissals, noticeRedemptions, platformNotices } from '@/db/schema'

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
export type RewardKind = 'none' | 'free_days' | 'link'

export type MerchantNotice = {
  id: string
  title: string
  body: string
  ctaLabel: string | null
  ctaHref: string | null
  tone: NoticeTone
  rewardKind: RewardKind
  rewardDays: number
  /** التاجر فعّلها خلاص — البطاقة بتوري «تمّت» بدل الزرار */
  redeemedUntil: Date | null
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

/** الأعمدة اللي بتتقرا للتاجر — مصدر واحد للعرض وللتفعيل */
const noticeFields = {
  id: platformNotices.id,
  title: platformNotices.title,
  body: platformNotices.body,
  ctaLabel: platformNotices.ctaLabel,
  ctaHref: platformNotices.ctaHref,
  tone: platformNotices.tone,
  rewardKind: platformNotices.rewardKind,
  rewardDays: platformNotices.rewardDays,
  audience: platformNotices.audience,
  targetStoreIds: platformNotices.targetStoreIds,
  minDeliveredOrders: platformNotices.minDeliveredOrders,
  minReferrals: platformNotices.minReferrals,
}

type NoticeRule = {
  audience: 'all' | 'stores' | 'rule'
  targetStoreIds: string[]
  minDeliveredOrders: number
  minReferrals: number
}

/**
 * التاجر ده مستحقّها؟
 *
 * ## نفس الدالة بتحرس العرض والتفعيل
 * لو الفحص اتكتب مرتين، نسخة العرض ونسخة التفعيل بيفرقوا مع أول
 * تعديل — والفرق ده معناه تاجر بياخد مكافأة مش من حقّه (أو العكس،
 * وهو بيشوفها ومش قادر ياخدها).
 */
function qualifies(rule: NoticeRule, storeId: string, stats: StoreStats): boolean {
  if (rule.audience === 'stores') return rule.targetStoreIds.includes(storeId)
  if (rule.audience === 'rule') {
    /*
      الشرطين **و** لا **أو**.

      الإدارة اللي بتكتب «وصّل ١٠ وحِيل ٥» قاصدة الاتنين. و«أو»
      كانت هتخلّي أي واحد فيهم كافيًا — يعني مكافأة بتتصرف على
      نص الشرط.
    */
    return (
      stats.deliveredOrders >= rule.minDeliveredOrders && stats.referrals >= rule.minReferrals
    )
  }
  return true
}

/** الرسالة شغّالة ووقتها جه؟ — بيتفحص في العرض وفي التفعيل */
const liveWindow = (now: Date) =>
  and(
    eq(platformNotices.isActive, true),
    /*
      `lte`/`gte` لا قالب `sql` خام.

      القالب الخام بيمرّر الـ`Date` لسائق بوستجرس كنص، وهو
      بيرفضه: «The "string" argument must be of type string…
      Received an instance of Date». معاملات drizzle بتعرف
      النوع وبتحوّله صح.
    */
    or(isNull(platformNotices.startsAt), lte(platformNotices.startsAt, now))!,
    or(isNull(platformNotices.endsAt), gte(platformNotices.endsAt, now))!,
  )

/**
 * الرسايل اللي التاجر ده المفروض يشوفها دلوقتي.
 *
 * الفلترة على تلات مستويات:
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
      ...noticeFields,
      /*
        تاريخ التفعيل بييجي مع الصف لا في استعلام تاني.

        البطاقة محتاجة تعرف «خد المكافأة ولا لأ» عشان ترسم زرارًا
        أو تأكيدًا — والقراءة المنفصلة كانت هتبقى رحلة زيادة لكل
        فتحة لوحة.
      */
      redeemedUntil: noticeRedemptions.grantedUntil,
      redeemedAt: noticeRedemptions.createdAt,
    })
    .from(platformNotices)
    .leftJoin(
      noticeDismissals,
      and(
        eq(noticeDismissals.noticeId, platformNotices.id),
        eq(noticeDismissals.storeId, storeId),
      ),
    )
    .leftJoin(
      noticeRedemptions,
      and(
        eq(noticeRedemptions.noticeId, platformNotices.id),
        eq(noticeRedemptions.storeId, storeId),
      ),
    )
    .where(
      and(
        liveWindow(now),
        /* القفل بيخفيها نهائيًا — التاجر قال «شفتها» */
        isNull(noticeDismissals.noticeId),
      ),
    )
    .orderBy(desc(platformNotices.createdAt))
    .limit(20)

  return rows
    .filter((r) => qualifies(r, storeId, stats))
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      ctaLabel: r.ctaLabel,
      ctaHref: r.ctaHref,
      tone: r.tone,
      rewardKind: r.rewardKind,
      rewardDays: r.rewardDays,
      redeemedUntil: r.redeemedAt ? (r.redeemedUntil ?? new Date(0)) : null,
    }))
    /*
      تلاتة كحد أقصى في الشاشة.

      اللوحة مكانها الشغل. عشر بطاقات فوق بعض بتحوّل الصفحة الرئيسية
      للوحة إعلانات، والتاجر بيتعلّم يقفلها كلها من غير ما يقراها.
    */
    .slice(0, 3)
}

/**
 * رسالة واحدة بشرط إن التاجر ده يستاهلها — **لحظة التفعيل**.
 *
 * ## الفحص بيتعاد هنا كامل
 * البطاقة عند التاجر ممكن تكون بقالها ساعة مفتوحة: الرسالة اتقفلت
 * من الإدارة، أو مدتها خلصت، أو التاجر رجّع طلبات فنزل تحت الشرط.
 * والأهم إن معرّف الرسالة بيتبعت من المتصفح — من غير الفحص ده أي
 * تاجر بيبعت أي معرّف وياخد مكافأة مش مكتوبة له أصلًا.
 */
export async function eligibleNotice(
  storeId: string,
  noticeId: string,
): Promise<{
  id: string
  rewardKind: RewardKind
  rewardDays: number
} | null> {
  const [row] = await db
    .select(noticeFields)
    .from(platformNotices)
    .where(and(eq(platformNotices.id, noticeId), liveWindow(new Date())))
    .limit(1)

  if (!row) return null

  const stats = await storeStats(storeId)
  if (!qualifies(row, storeId, stats)) return null

  return { id: row.id, rewardKind: row.rewardKind, rewardDays: row.rewardDays }
}

/** التاجر قفل الرسالة — بتختفي عنه للأبد */
export async function dismissNotice(storeId: string, noticeId: string): Promise<void> {
  await db.insert(noticeDismissals).values({ storeId, noticeId }).onConflictDoNothing()
}
