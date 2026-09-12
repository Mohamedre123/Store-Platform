import 'server-only'
import { and, count, desc, eq, gte, sum } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orderItems, orders, paymentMethods, products, shippingZones } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { loadDashboardStats } from '@/lib/dashboard-stats'
import { getEntitlements, getOrderQuota } from '@/lib/entitlements'
import { noticesFor, storeStats } from '@/lib/notices'
import type { SetupStep } from '@/app/dashboard/setup-guide'

/**
 * بيانات الصفحة الرئيسية للوحة — مصدر واحد للويب والتطبيق.
 *
 * ## ليه مفصولة عن الصفحة
 * تطبيق الموبايل بيرسم الرئيسية بنفسه من `/api/app/home`. لو كل واحد
 * فيهم كتب استعلاماته، أول تعديل على تعريف «طلب مستني» أو «خطوة
 * تجهيز» كان هيتعمل في مكان واحد — والتاجر يلاقي رقمين مختلفين لنفس
 * الحاجة على الموبايل واللابتوب، ويبطّل يثق في الاتنين.
 */
export async function loadHomeData(store: ActiveStore) {
  /* آخر تلاتين يوم — نافذة «الأكتر مبيعًا» */
  const last30 = new Date(Date.now() - 30 * 24 * 3600_000)

  /*
    كل حاجة في دفعة واحدة متوازية.

    الصفحة دي بيفتحها التاجر كل صباح، وأي استعلام متتالي بيتحوّل
    لثانية إضافية بيقعد يبصّ فيها على شاشة فاضية.
  */
  const [
    ent,
    quota,
    stats,
    [pending],
    [incomplete],
    [productCount],
    [customerCount],
    [hasPayment],
    [hasShipping],
    latestOrders,
    topProducts,
    rewardStats,
  ] = await Promise.all([
    /*
      حالة الاشتراك.

      الحد اللي بيوقف الطلبات لازم يوصل للتاجر **قبل** ما يقف — لو
      اكتشفه لما عميل قاله «مش عارف أطلب»، الرسالة وصلت متأخرة يوم
      كامل من البيع.
    */
    getEntitlements(store),
    getOrderQuota(store),
    loadDashboardStats(store.id),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.status, 'pending'))),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.isIncomplete, true))),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, 'active'))),
    db.select({ n: count() }).from(customers).where(eq(customers.storeId, store.id)),
    db
      .select({ n: count() })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.enabled, true))),
    db
      .select({ n: count() })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.enabled, true))),
    db
      .select({
        id: orders.id,
        number: orders.orderNumber,
        name: orders.customerName,
        total: orders.total,
        status: orders.status,
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.isIncomplete, false)))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db
      .select({
        productId: orderItems.productId,
        name: orderItems.name,
        image: orderItems.image,
        sold: sum(orderItems.quantity),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.storeId, store.id),
          eq(orders.isIncomplete, false),
          gte(orders.createdAt, last30),
        ),
      )
      .groupBy(orderItems.productId, orderItems.name, orderItems.image)
      .orderBy(desc(sum(orderItems.quantity)))
      .limit(5),
    /*
      أرقام المتجر لرسايل المنصة (طلبات مسلَّمة وإحالات). الشرط بيتقاس
      هنا لا وقت الكتابة — التاجر اللي بيوصل للرقم بكرة بيشوف العرض
      بكرة لوحده.
    */
    storeStats(store.id),
  ])

  const notices = await noticesFor(store.id, rewardStats)

  const counts = {
    pending: pending?.n ?? 0,
    incomplete: incomplete?.n ?? 0,
    products: productCount?.n ?? 0,
    customers: customerCount?.n ?? 0,
  }

  /**
   * خطوات التجهيز — بترتيب الاحتياج لا بترتيب الشاشات.
   *
   * من غير منتج مفيش حاجة تتشحن، ومن غير شحن مفيش سعر يتحسب،
   * ومن غير دفع الطلب ما بيقفلش. والنشر آخر خطوة لأنه بيفتح الباب
   * للعملاء — وفتحه قبل ما الباقي يجهز بيوصّل زائرًا لمتجر ناقص.
   */
  const setup: SetupStep[] = [
    {
      key: 'product',
      label: 'ضيف أول منتج',
      hint: 'من غير منتج مفيش حاجة تتباع',
      href: '/dashboard/products/new',
      done: counts.products > 0,
      icon: 'product',
    },
    {
      key: 'logo',
      label: 'ارفع شعار متجرك',
      hint: 'بيظهر في الهيدر والفاتورة ورسايل العملاء',
      href: '/dashboard/settings',
      done: Boolean(store.logoLight),
      icon: 'logo',
    },
    {
      key: 'shipping',
      label: 'ظبّط مناطق الشحن',
      hint: 'السعر اللي العميل بيشوفه في الشيك أوت',
      href: '/dashboard/shipping',
      done: (hasShipping?.n ?? 0) > 0,
      icon: 'shipping',
    },
    {
      key: 'payment',
      label: 'فعّل طريقة دفع',
      hint: 'الدفع عند الاستلام أو بوابة بمفاتيحك',
      href: '/dashboard/payments',
      done: (hasPayment?.n ?? 0) > 0,
      icon: 'payment',
    },
    {
      key: 'theme',
      label: 'اختار شكل متجرك',
      hint: 'الألوان والخطوط والصفحة الرئيسية',
      href: '/dashboard/storefront',
      done: Boolean(store.logoLight) && counts.products > 0,
      icon: 'theme',
    },
    {
      key: 'publish',
      label: 'انشر المتجر',
      hint: 'آخر خطوة — بعدها العملاء يقدروا يطلبوا',
      href: '/dashboard/settings',
      done: store.isPublished,
      icon: 'publish',
    },
  ]

  return {
    ent,
    quota,
    stats,
    counts,
    setup,
    notices,
    latestOrders,
    topProducts: topProducts.map((p) => ({ ...p, sold: Number(p.sold ?? 0) })),
  }
}

export type HomeData = Awaited<ReturnType<typeof loadHomeData>>
