import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingMethods } from '@/db/schema'

/**
 * طرق الشحن المتعددة.
 *
 * ## القاعدة الحاكمة: الفاضي = السلوك القديم
 * المتجر اللي مضافش ولا طريقة بيشتغل بالظبط زي ما كان — سعر واحد
 * بلا أي اختيار في الشيك أوت. الميزة بتتفتح لما التاجر يضيف أول
 * طريقة، ولحد ساعتها مفيش سطر واحد بيتغيّر عند العميل.
 *
 * ## والسعر بيتحسب على الخادم
 * الطريقة اللي المتصفح بيبعتها **معرّف بس**. لو صدّقنا فرق السعر
 * الجاي منه، أي حد يبعت `priceDelta: -5000` ويشحن ببلاش. الفرق
 * بيتقرا من القاعدة في كل مرة.
 */

export type ShippingMethod = {
  id: string
  name: string
  hint: string | null
  priceDelta: number
  minDays: number | null
  maxDays: number | null
}

/** طرق المتجر المفعّلة بترتيب التاجر */
export async function listShippingMethods(storeId: string): Promise<ShippingMethod[]> {
  return db
    .select({
      id: shippingMethods.id,
      name: shippingMethods.name,
      hint: shippingMethods.hint,
      priceDelta: shippingMethods.priceDelta,
      minDays: shippingMethods.minDays,
      maxDays: shippingMethods.maxDays,
    })
    .from(shippingMethods)
    .where(and(eq(shippingMethods.storeId, storeId), eq(shippingMethods.enabled, true)))
    .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.createdAt))
}

export type ResolvedMethod = {
  method: ShippingMethod | null
  /** السعر بعد الفرق — مقصوص عند صفر */
  price: number
  minDays: number | null
  maxDays: number | null
}

/**
 * السعر النهائي بعد الطريقة المختارة.
 *
 * ## المعرّف الغلط بيرجع للافتراضي لا بيرفض
 * الطريقة ممكن تكون اتقفلت أو اتحذفت بين ما العميل فتح الصفحة وبين
 * ما ضغط «أكّد». رفض الطلب ساعتها بيضيّع بيعة عشان تغيير التاجر
 * عمله دلوقتي — والرجوع للأولى بيخلّي الطلب يعدّي بسعر صحيح.
 *
 * ## والقصّ عند صفر
 * فرق سالب أكبر من سعر المحافظة بيطلّع شحنًا بالسالب — يعني التاجر
 * بيدفع للعميل عشان يشتري.
 */
export async function resolveShippingMethod(
  storeId: string,
  basePrice: number,
  methodId: string | null | undefined,
  base: { minDays: number | null; maxDays: number | null },
): Promise<ResolvedMethod> {
  const methods = await listShippingMethods(storeId)

  if (methods.length === 0) {
    return { method: null, price: basePrice, minDays: base.minDays, maxDays: base.maxDays }
  }

  const chosen = methods.find((m) => m.id === methodId) ?? methods[0]

  return {
    method: chosen,
    price: Math.max(0, basePrice + chosen.priceDelta),
    minDays: chosen.minDays ?? base.minDays,
    maxDays: chosen.maxDays ?? base.maxDays,
  }
}
