import 'server-only'
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { dailyStats, orders, storeEvents } from '@/db/schema'

/**
 * أحداث المتجر والتجميع اليومي.
 *
 * القُمع (زائر → شاف منتج → ضاف للسلة → بدأ الشيك أوت → طلب) هو
 * الحاجة الوحيدة اللي بتقول للتاجر **فين بيخسر**. الطلبات لوحدها
 * بتقول كام باع، مش ليه الباقي مشي.
 *
 * الأحداث الخام بتتجمّع في صف يومي واحد لكل متجر: جدول الأحداث
 * بيكبر بالآلاف في اليوم، وقراءة تقرير منه على الطاير بتبقى أبطأ
 * كل يوم. الصف المجمّع ثابت التكلفة مهما كبر المتجر.
 */

export type TrackableEvent = 'page_view' | 'product_view' | 'add_to_cart' | 'begin_checkout'

const ALLOWED: TrackableEvent[] = ['page_view', 'product_view', 'add_to_cart', 'begin_checkout']

export function isTrackable(type: string): type is TrackableEvent {
  return (ALLOWED as string[]).includes(type)
}

export async function recordEvent(input: {
  storeId: string
  type: TrackableEvent
  sessionId: string
  productId?: string
  path?: string
  referrer?: string
  device?: 'mobile' | 'tablet' | 'desktop'
  /**
   * من فين جه الزائر — من كوكي الإسناد اللي الوكيل كتبها.
   *
   * عمود `utm` كان موجودًا في المخطط ومحدّش بيكتب فيه، فتقرير
   * «الزيارات حسب المصدر» مكانش ممكن أصلًا. بيتكتب على كل حدث لأن
   * الجلسة الواحدة ممكن تمتد لأكتر من يوم، وربط الجلسة بمصدرها
   * بأثر رجعي بيحتاج قراءة تانية.
   */
  utm?: Record<string, string> | null
  /**
   * البلد والمدينة — من ترويسات المستضيف لا من المتصفح.
   *
   * العمودين دول كانوا في المخطط من أول يوم ومحدّش بيكتب فيهم، فأي
   * سؤال عن «الزوار دول منين» مكانش ليه إجابة. وده مش رفاهية: التاجر
   * اللي بيشحن للقاهرة بس محتاج يعرف إن نص زواره من الإسكندرية
   * **قبل** ما يقرّر يوسّع مناطق شحنه.
   *
   * ومن الترويسة لا من المتصفح لأن المتصفح مُدخل غير موثوق — زي
   * الإسناد بالظبط. المحلي بيرجّع فاضي، والشاشة بتقول «مش معروفة».
   */
  country?: string | null
  city?: string | null
}): Promise<void> {
  await db.insert(storeEvents).values({
    storeId: input.storeId,
    type: input.type,
    sessionId: input.sessionId.slice(0, 64),
    productId: input.productId ?? null,
    path: input.path?.slice(0, 300) ?? null,
    referrer: input.referrer?.slice(0, 300) ?? null,
    device: input.device ?? null,
    country: input.country?.slice(0, 4) ?? null,
    city: input.city?.slice(0, 80) ?? null,
    utm: input.utm ?? null,
  })
}

/**
 * تجميع يوم واحد.
 *
 * الزوّار بتتحسب بالجلسات المميّزة لا بعدد الأحداث: عميل بيفتح عشر
 * صفحات زائر واحد مش عشرة، وإلا كل تقرير بيبان أحسن ٥ مرات من
 * الحقيقة والتاجر يبني قراراته على رقم متضخّم.
 *
 * `onConflictDoUpdate` عشان إعادة التشغيل تصلّح الصف بدل ما تفشل أو
 * تضاعفه — المهمة ممكن تتأخّر وتتنادى مرتين لنفس اليوم.
 */
export async function rollupDay(storeId: string, day: Date): Promise<void> {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const end = new Date(start.getTime() + 86_400_000)
  const dayKey = start.toISOString().slice(0, 10)

  const [events] = await db
    .select({
      visitors: sql<number>`count(distinct ${storeEvents.sessionId})::int`,
      pageViews: sql<number>`count(*) filter (where ${storeEvents.type} = 'page_view')::int`,
      productViews: sql<number>`count(*) filter (where ${storeEvents.type} = 'product_view')::int`,
      addToCarts: sql<number>`count(*) filter (where ${storeEvents.type} = 'add_to_cart')::int`,
      checkoutsStarted: sql<number>`count(*) filter (where ${storeEvents.type} = 'begin_checkout')::int`,
    })
    .from(storeEvents)
    .where(
      and(
        eq(storeEvents.storeId, storeId),
        gte(storeEvents.createdAt, start),
        lt(storeEvents.createdAt, end),
      ),
    )

  const [sales] = await db
    .select({
      orders: sql<number>`count(*) filter (where ${orders.isIncomplete} = false)::int`,
      incompleteOrders: sql<number>`count(*) filter (where ${orders.isIncomplete} = true)::int`,
      cancelledOrders: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
      returnedOrders: sql<number>`count(*) filter (where ${orders.status} = 'returned')::int`,
      revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.isIncomplete} = false and ${orders.status} not in ('cancelled','returned')), 0)::int`,
      cogs: sql<number>`coalesce(sum(${orders.costTotal}) filter (where ${orders.isIncomplete} = false and ${orders.status} not in ('cancelled','returned')), 0)::int`,
      shippingCost: sql<number>`coalesce(sum(${orders.shippingTotal}) filter (where ${orders.isIncomplete} = false and ${orders.status} not in ('cancelled','returned')), 0)::int`,
      discounts: sql<number>`coalesce(sum(${orders.discountTotal}) filter (where ${orders.isIncomplete} = false and ${orders.status} not in ('cancelled','returned')), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, start), lt(orders.createdAt, end)))

  const revenue = Number(sales?.revenue ?? 0)
  const cogs = Number(sales?.cogs ?? 0)
  const discounts = Number(sales?.discounts ?? 0)

  const values = {
    storeId,
    day: dayKey,
    visitors: Number(events?.visitors ?? 0),
    pageViews: Number(events?.pageViews ?? 0),
    productViews: Number(events?.productViews ?? 0),
    addToCarts: Number(events?.addToCarts ?? 0),
    checkoutsStarted: Number(events?.checkoutsStarted ?? 0),
    orders: Number(sales?.orders ?? 0),
    incompleteOrders: Number(sales?.incompleteOrders ?? 0),
    cancelledOrders: Number(sales?.cancelledOrders ?? 0),
    returnedOrders: Number(sales?.returnedOrders ?? 0),
    revenue,
    cogs,
    shippingCost: Number(sales?.shippingCost ?? 0),
    discounts,
    /*
      الربح هنا = الإيراد − التكلفة − الخصومات.
      الشحن مش مطروح: العميل بيدفعه وهو داخل في الإيراد أصلًا، وطرحه
      كان هيحسبه مرتين. تكلفة الشحن الحقيقية على التاجر مسجّلة على
      الشحنة لا على الطلب.
    */
    netProfit: revenue - cogs - discounts,
  }

  await db
    .insert(dailyStats)
    .values(values)
    .onConflictDoUpdate({ target: [dailyStats.storeId, dailyStats.day], set: values })
}

/**
 * تجميع كل المتاجر اللي عندها نشاط في اليوم.
 * بيرجّع عدد الصفوف عشان المهمة المجدولة تقول عملت إيه.
 */
export async function rollupAllStores(day: Date): Promise<number> {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const end = new Date(start.getTime() + 86_400_000)

  /*
    استعلامين مبنيّين بالمنشئ بدل SQL خام: db.execute بيرجّع شكل
    مختلف حسب السائق، وده اللي خلّى النسخة الأولى ترجّع صفر وهي
    لاقية بيانات فعلًا. الدمج في الذاكرة أوضح والعدد صغير أصلًا.
  */
  const [fromEvents, fromOrders] = await Promise.all([
    db
      .selectDistinct({ storeId: storeEvents.storeId })
      .from(storeEvents)
      .where(and(gte(storeEvents.createdAt, start), lt(storeEvents.createdAt, end))),
    db
      .selectDistinct({ storeId: orders.storeId })
      .from(orders)
      .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end))),
  ])

  const ids = [...new Set([...fromEvents, ...fromOrders].map((r) => r.storeId))]

  for (const storeId of ids) {
    await rollupDay(storeId, start)
  }

  return ids.length
}

/**
 * قُمع آخر N يوم من الصفوف المجمّعة.
 * بيرجّع صفر لو لسه مفيش تجميع — والصفحة بتقول للتاجر يستنى بكرة.
 */
export async function getFunnel(storeId: string, days = 30) {
  const [row] = await db
    .select({
      visitors: sql<number>`coalesce(sum(${dailyStats.visitors}), 0)::int`,
      productViews: sql<number>`coalesce(sum(${dailyStats.productViews}), 0)::int`,
      addToCarts: sql<number>`coalesce(sum(${dailyStats.addToCarts}), 0)::int`,
      checkoutsStarted: sql<number>`coalesce(sum(${dailyStats.checkoutsStarted}), 0)::int`,
      orders: sql<number>`coalesce(sum(${dailyStats.orders}), 0)::int`,
      netProfit: sql<number>`coalesce(sum(${dailyStats.netProfit}), 0)::int`,
      dayCount: sql<number>`count(*)::int`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.storeId, storeId),
        sql`${dailyStats.day} >= current_date - ${days}::int`,
      ),
    )

  return {
    visitors: Number(row?.visitors ?? 0),
    productViews: Number(row?.productViews ?? 0),
    addToCarts: Number(row?.addToCarts ?? 0),
    checkoutsStarted: Number(row?.checkoutsStarted ?? 0),
    orders: Number(row?.orders ?? 0),
    netProfit: Number(row?.netProfit ?? 0),
    dayCount: Number(row?.dayCount ?? 0),
  }
}
