import 'server-only'
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, stores } from '@/db/schema'
import { platformOrigin } from '@/lib/domain'

/**
 * إحالة التجّار — تاجر بيجيب تاجر للمنصة.
 *
 * ## غير إحالة العميل تمامًا
 * `src/lib/referrals.ts` بيخصّ **عملاء متجر التاجر**: العميل بيحيل
 * صاحبه للمتجر وياخد نقاط. ده بيخصّ **المنصة**: التاجر بيحيل تاجر
 * تاني، والمكافأة من عندنا إحنا. الاتنين اسمهم إحالة والباقي مختلف
 * — الجمهور، والمكافأة، ومين بيدفعها.
 *
 * ## والكود بيتولّد أول ما يتطلب
 * مش وقت التسجيل: أغلب التجّار ما بيحيلوش حد، فما نملاش الجدول
 * أكوادًا ما اتشافتش. أول ما التاجر يفتح صفحة الإحالة، بيتعمل كوده.
 */

/**
 * كوكي كود الإحالة.
 *
 * الوكيل بيكتبها من ?ref= في رابط التسجيل، والتسجيل بيقراها بعد
 * كده. الكتابة في الوكيل لأن صفحة التسجيل مكوّن خادم وما تقدرش
 * تكتب كوكيز وهي بترسم — ولأن التاجر ممكن يفتح الرابط، يقفل
 * الصفحة، ويرجع يسجّل بعد يومين.
 */
export const REFERRAL_COOKIE = 'zw_mref'

/** حروف بلا شبيه — من غير O و0 وI و1، زي معرّف الحساب بالظبط */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomCode(len = 7): string {
  let out = ''
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

/**
 * كود إحالة المتجر — بيتعمل لو مش موجود.
 *
 * السباق على الكود المكرّر بيتحلّ بالفهرس الفريد: المحاولة التانية
 * بترجّع للقراءة وبتاخد اللي اتكتب. من غير كده، تاجرين يفتحوا
 * الصفحة في نفس اللحظة وواحد فيهم ياخد كود مش بتاعه.
 */
export async function ensureReferralCode(storeId: string): Promise<string> {
  const [row] = await db
    .select({ code: stores.referralCode })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (row?.code) return row.code

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    try {
      const updated = await db
        .update(stores)
        .set({ referralCode: code })
        .where(and(eq(stores.id, storeId), sql`${stores.referralCode} is null`))
        .returning({ code: stores.referralCode })

      if (updated[0]?.code) return updated[0].code

      /* حد تاني كتبه في نفس اللحظة — نقراه */
      const [again] = await db
        .select({ code: stores.referralCode })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1)
      if (again?.code) return again.code
    } catch {
      /* تصادم على الفهرس الفريد — نجرّب كودًا تاني */
    }
  }

  throw new Error('ما قدرناش نعمل كود إحالة')
}

/** الرابط اللي التاجر بيشاركه */
export function referralLink(code: string): string {
  return `${platformOrigin()}/signup?ref=${encodeURIComponent(code)}`
}

export type ReferralSummary = {
  code: string
  link: string
  /** سجّلوا بالرابط */
  signups: number
  /** منهم اللي بقى عنده باقة فعلًا */
  subscribed: number
}

export async function referralSummary(storeId: string): Promise<ReferralSummary> {
  const code = await ensureReferralCode(storeId)

  const [row] = await db.execute<{ signups: number; subscribed: number }>(sql`
    select
      count(*)::int as signups,
      count(*) filter (where plan is not null and status in ('active','trial'))::int as subscribed
      from stores
     where referred_by_store_id = ${storeId}
  `)

  return {
    code,
    link: referralLink(code),
    signups: Number(row?.signups ?? 0),
    subscribed: Number(row?.subscribed ?? 0),
  }
}

/**
 * ربط متجر جديد بمن أحاله — **مرة واحدة وقت التسجيل**.
 *
 * الشرط `referred_by_store_id is null` هو اللي بيمنع إعادة النسب:
 * من غيره، تاجر يعدّل الكوكي بعد شهر وينسب نفسه لحد تاني والمكافأة
 * تتصرف مرتين على نفس التسجيل.
 *
 * وما بيرميش أبدًا: التسجيل أهم من الإحالة. كود غلط أو متجر اتمسح
 * بيتجاهَل، والحساب بيتعمل عادي.
 */
export async function attachReferral(newStoreId: string, code: string | null): Promise<void> {
  const clean = code?.trim().toUpperCase()
  if (!clean || clean.length < 4 || clean.length > 16) return

  try {
    const [referrer] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.referralCode, clean))
      .limit(1)

    /* المتجر ما يحيلش نفسه */
    if (!referrer || referrer.id === newStoreId) return

    await db
      .update(stores)
      .set({ referredByStoreId: referrer.id, referredAt: new Date() })
      .where(and(eq(stores.id, newStoreId), sql`${stores.referredByStoreId} is null`))
  } catch (e) {
    console.error('فشل ربط الإحالة:', e)
  }
}

export type ReferralSignup = {
  newStoreId: string
  newStoreName: string
  newAccountId: string | null
  referrerStoreName: string
  referrerAccountId: string | null
  plan: string | null
  status: string
  at: string
}

/**
 * كل الإحالات — للوحة الإدارة.
 *
 * بتقول: **مين جه من مين**، باسم المتجرين ومعرّفَي حسابيهما. ده
 * بالظبط اللي الإدارة محتاجاه عشان تصرف المكافأة: الاسم بيتقري في
 * المحادثة، والمعرّف بيلاقي الحساب في ثانية.
 */
export async function allReferralSignups(limit = 100): Promise<ReferralSignup[]> {
  const rows = await db.execute<{
    new_store_id: string
    new_store_name: string
    new_account_id: string | null
    referrer_store_name: string
    referrer_account_id: string | null
    plan: string | null
    status: string
    at: Date
  }>(sql`
    select
      s.id                as new_store_id,
      s.name              as new_store_name,
      nu.public_id        as new_account_id,
      r.name              as referrer_store_name,
      ru.public_id        as referrer_account_id,
      s.plan,
      s.status,
      coalesce(s.referred_at, s.created_at) as at
    from stores s
    join stores r on r.id = s.referred_by_store_id
    left join store_members nm on nm.store_id = s.id and nm.role = 'owner'
    left join users nu on nu.id = nm.user_id
    left join store_members rm on rm.store_id = r.id and rm.role = 'owner'
    left join users ru on ru.id = rm.user_id
    where s.deleted_at is null
    order by at desc
    limit ${limit}
  `)

  return [...rows].map((r) => ({
    newStoreId: r.new_store_id,
    newStoreName: r.new_store_name,
    newAccountId: r.new_account_id,
    referrerStoreName: r.referrer_store_name,
    referrerAccountId: r.referrer_account_id,
    plan: r.plan,
    status: r.status,
    at: new Date(r.at).toISOString(),
  }))
}

/** عدد الإحالات لكل متجر — للوحة الإدارة، استعلام واحد */
export async function referralCounts(storeIds: string[]): Promise<Map<string, number>> {
  if (storeIds.length === 0) return new Map()

  /*
    `inArray` لا `any(${array})`.

    القالب الخام بيفرد المصفوفة لمعاملات `($1,$2,$3)` — يعني
    بوستجرس بيشوف قايمة قيم مكان مصفوفة وبيرفض:
    «op ANY/ALL (array) requires array on right side».

    ده عدّى `tsc` و`next build` الاتنين وبان وقت التشغيل بس.
  */
  const rows = await db
    .select({ id: stores.referredByStoreId, n: sql<number>`count(*)::int` })
    .from(stores)
    .where(and(isNotNull(stores.referredByStoreId), inArray(stores.referredByStoreId, storeIds)))
    .groupBy(stores.referredByStoreId)

  return new Map(rows.map((r) => [r.id!, Number(r.n)]))
}

/** عدد الطلبات المسلَّمة لكل متجر — للوحة الإدارة */
export async function deliveredCounts(storeIds: string[]): Promise<Map<string, number>> {
  if (storeIds.length === 0) return new Map()

  const rows = await db
    .select({ storeId: orders.storeId, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        inArray(orders.storeId, storeIds),
        eq(orders.status, 'delivered'),
        eq(orders.isIncomplete, false),
      ),
    )
    .groupBy(orders.storeId)

  return new Map(rows.map((r) => [r.storeId, Number(r.n)]))
}
