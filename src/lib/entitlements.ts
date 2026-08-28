import 'server-only'
import { cache } from 'react'
import { and, count, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, storeMembers, stores, users } from '@/db/schema'
import { getPlan, daysLeft, type Plan } from './plans'
import { adminEmails } from './admin'
import { getDashboardContext } from './store-context'
import type { PlanKey, StoreStatus } from '@/db/schema'

/**
 * بوابة المميزات — المكان الوحيد اللي بيقرّر مين يقدر يعمل إيه.
 *
 * ## ليه ملف واحد
 * القفل موجود في تلات مستويات: الشاشة بتعمل بلور، والفعل على الخادم
 * بيرفض، والمهمة اليومية بتنهي الفترة. لو كل واحد فيهم حسب الشرط
 * بنفسه، أول تعديل في التسعير بيخلّيهم يختلفوا — وشاشة بتقول «مفتوح»
 * وخادم بيقول «مقفول» أسوأ من الاتنين.
 *
 * ## القرار بالتواريخ لا بالحالة
 * `stores.status` نص بيتكتب بإيد الإدارة وممكن يبقى قديم لو المهمة
 * اليومية اتأخرت. الحقيقة في `subscribedUntil` و`trialEndsAt`:
 * التاريخ عدّى يبقى مقفول، مهما كان مكتوب في الحالة.
 */

/** أقصى عدد طلبات للمتجر غير المشترك — بعدها بيقف عن الاستقبال */
export const FREE_ORDER_LIMIT = 5

export type StoreBilling = {
  id: string
  status: StoreStatus
  plan: PlanKey | null
  trialEndsAt: Date | null
  subscribedUntil: Date | null
}

export type Entitlements = {
  /** مشترك فعلًا (أو تجربة سارية أو حساب الإدارة) */
  active: boolean
  /** حساب إدارة المنصة — كل حاجة مفتوحة من غير اشتراك */
  isAdmin: boolean
  plan: Plan | null
  /** الفترة التجريبية شغّالة دلوقتي؟ */
  onTrial: boolean
  /** التاريخ اللي بتنتهي فيه الفترة السارية */
  until: Date | null
  daysLeft: number | null
  /** كان مشترك وخلص — بيفرق عن اللي عمره ما اشترك في نص الرسالة */
  expired: boolean
  features: {
    ai: boolean
    landing: boolean
    customDomain: boolean
  }
  /** null = بلا حد */
  orderLimit: number | null
}

/**
 * المتجر ده بتاع إدارة المنصة؟
 *
 * مربوط بعلامة `is_platform_admin` على المستخدم لا باسم المتجر ولا
 * بمعرّف مكتوب في الكود: لو الأدمن عمل متجر تاني، بيشتغل من غير ما
 * حد يفتكر يضيفه في أي مكان.
 *
 * مغلّفة بـcache فبتتنادى مرة واحدة في الطلب مهما اتسألت.
 */
export const isAdminStore = cache(async (storeId: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: users.id })
    .from(storeMembers)
    .innerJoin(users, eq(users.id, storeMembers.userId))
    .where(
      and(
        eq(storeMembers.storeId, storeId),
        /*
          العلامة **أو** البريد.

          العلامة بتتكتب أول دخول، لكن الأدمن ممكن يكون داخل بجلسة
          قديمة من قبل الهجرة — ساعتها بيلاقي مميزاته مقفولة على
          متجره هو. البريد بيغطّي اللحظة دي.
        */
        or(
          eq(users.isPlatformAdmin, true),
          inArray(sql`lower(${users.email})`, adminEmails()),
        ),
      ),
    )
    .limit(1)
  return Boolean(row)
})

const LOCKED_FEATURES = { ai: false, landing: false, customDomain: false }
const OPEN_FEATURES = { ai: true, landing: true, customDomain: true }

/** حالة اشتراك المتجر ومميزاته */
export async function getEntitlements(store: StoreBilling): Promise<Entitlements> {
  const admin = await isAdminStore(store.id)

  if (admin) {
    return {
      active: true,
      isAdmin: true,
      plan: null,
      onTrial: false,
      until: null,
      daysLeft: null,
      expired: false,
      features: OPEN_FEATURES,
      orderLimit: null,
    }
  }

  const now = Date.now()
  const paidUntil = store.subscribedUntil ? new Date(store.subscribedUntil) : null
  const trialUntil = store.trialEndsAt ? new Date(store.trialEndsAt) : null

  const paidLive = Boolean(paidUntil && paidUntil.getTime() > now)
  const trialLive = !paidLive && Boolean(trialUntil && trialUntil.getTime() > now)
  const active = paidLive || trialLive

  const until = paidLive ? paidUntil : trialLive ? trialUntil : (paidUntil ?? trialUntil)

  return {
    active,
    isAdmin: false,
    plan: getPlan(trialLive ? 'trial' : store.plan),
    onTrial: trialLive,
    until,
    daysLeft: daysLeft(until),
    expired: !active && Boolean(until),
    features: active ? OPEN_FEATURES : LOCKED_FEATURES,
    orderLimit: active ? null : FREE_ORDER_LIMIT,
  }
}

/**
 * عدد الطلبات الحقيقية للمتجر — الناقصة مش محسوبة.
 *
 * الطلب الناقص سلة اتسابت في نصها، والعميل ممكن يرجع يكمّلها.
 * لو حسبناه في الحد، متجر بخمس سلات متروكة بيتقفل من غير ما يبيع
 * ولا طلب واحد.
 */
export const countStoreOrders = cache(async (storeId: string): Promise<number> => {
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isIncomplete, false)))
  return row?.n ?? 0
})

export type OrderQuota = { limit: number | null; used: number; left: number | null; blocked: boolean }

/** حصّة الطلبات — بتتنادى من الشيك أوت ومن اللوحة بنفس الحساب */
export async function getOrderQuota(store: StoreBilling): Promise<OrderQuota> {
  const ent = await getEntitlements(store)
  if (ent.orderLimit === null) return { limit: null, used: 0, left: null, blocked: false }

  const used = await countStoreOrders(store.id)
  const left = Math.max(0, ent.orderLimit - used)
  return { limit: ent.orderLimit, used, left, blocked: left === 0 }
}

/**
 * نفس البوابة، بس بمعرّف المتجر لوحده — للأماكن اللي مالهاش سياق لوحة
 * (الشيك أوت، الويب هوك، المهام المجدولة).
 */
export const getStoreBilling = cache(async (storeId: string): Promise<StoreBilling | null> => {
  const [row] = await db
    .select({
      id: stores.id,
      status: stores.status,
      plan: stores.plan,
      trialEndsAt: stores.trialEndsAt,
      subscribedUntil: stores.subscribedUntil,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)
  return row ?? null
})

/* ────────────────────────── حرّاس الأفعال ────────────────────────── */

/**
 * رسالة القفل — نص واحد لكل ميزة.
 *
 * التاجر بيقابل نفس الجملة في الشاشة وفي رد الخادم. لو كل مكان كتبها
 * بطريقته، اللي بيتصل بالدعم بيقول جملة مالهاش أثر عندنا.
 */
export const LOCKED_MESSAGE: Record<keyof Entitlements['features'], string> = {
  ai: 'أدوات الذكاء الاصطناعي للمشتركين — اشترك من صفحة الاشتراك وهتتفتح على طول.',
  landing: 'صفحات الهبوط للمشتركين — اشترك من صفحة الاشتراك وهتتفتح على طول.',
  customDomain: 'ربط نطاقك الخاص للمشتركين — اشترك من صفحة الاشتراك وهيتفتح على طول.',
}

/**
 * الميزة مسموحة للمتجر النشط في اللوحة؟
 *
 * **بتتنادى من كل فعل بيغيّر حاجة**، مش من الصفحة بس. الصفحة بتعمل
 * بلور، والبلور بيتشال من أدوات المطوّرين — وفعل الخادم مسار مستقل
 * بيتنادى من غير ما الصفحة تتفتح أصلًا.
 */
export async function featureAllowed(
  feature: keyof Entitlements['features'],
): Promise<boolean> {
  const { store } = await getDashboardContext()
  const ent = await getEntitlements(store)
  return ent.features[feature]
}

/** رد الرفض الجاهز — أو null لو الميزة مفتوحة */
export async function featureBlock(
  feature: keyof Entitlements['features'],
): Promise<{ error: string } | null> {
  return (await featureAllowed(feature)) ? null : { error: LOCKED_MESSAGE[feature] }
}

/**
 * حصّة الطلبات بمعرّف المتجر — للشيك أوت اللي مالوش سياق لوحة.
 *
 * المتجر المش موجود بيرجع «مفتوح» عن قصد: الاستدعاء ده بيتم بعد ما
 * الشيك أوت لقى المتجر أصلًا، ولو وصل هنا فاضي فالمشكلة مش في
 * الاشتراك — وإرجاع «مقفول» كان هيدّي العميل رسالة غلط عن السبب.
 */
export async function orderQuotaForStore(storeId: string): Promise<OrderQuota> {
  const billing = await getStoreBilling(storeId)
  if (!billing) return { limit: null, used: 0, left: null, blocked: false }
  return getOrderQuota(billing)
}
