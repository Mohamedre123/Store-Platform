/**
 * الأنواع المشتركة بين شاشات الشرا.
 *
 * الشيك أوت الكامل والدفع السريع بيرسموا **نفس الحاجة**: نفس الخانات،
 * نفس طرق الدفع، نفس حساب الشحن. لما كانوا كل واحد معرّف أنواعه
 * لوحده، أي إضافة في إعدادات التاجر كانت بتتوصّل لواحد وتُنسى في
 * التاني — والتاجر يقفل خانة فتختفي من مكان وتفضل في مكان.
 *
 * الملف ده مالوش `server-only` عن قصد: الطرفين بيقراه، والخادم بيبني
 * القيم والمتصفح بيرسمها.
 */

/** الخانة: مطلوبة / اختيارية / مخفية */
export type FieldMode = 'required' | 'optional' | 'hidden'

export type AddressMode = 'structured' | 'simple' | 'hidden'

export type PaymentOption = {
  gateway: string
  displayName: string | null
  instructions: string | null
  /** اسم الشركة زي ما هو — بيطمّن العميل إنه بيدفع لجهة معروفة */
  brand: string | null
  color: string | null
  /** بوابة أونلاين (هيتحوّل لصفحة دفع) ولا تحصيل بره النظام؟ */
  online: boolean
}

/** أسعار الشحن اللي المتصفح بيحسب بيها — نفس مصدر الخادم */
export type ShippingRates = {
  byCity: Record<string, number>
  defaultPrice: number
  freeOver: number | null
  /**
   * فرق الطريقة الافتراضية — أول طريقة شحن مفعّلة عند التاجر.
   *
   * ## ليه لازم يكون هنا
   * الدفع السريع مالوش منتقي طرق عن قصد: هو مسار «منتج واحد من
   * إعلان»، وأي شاشة زيادة بتنزّل التحويل. لكن الخادم بيحاسب بأول
   * طريقة — فلو الشاشة حسبت من غير الفرق، العميل يشوف ٥٠ ويتحاسب
   * ٨٠، وده بالظبط اللي قاعدة «السعر المعروض والمحصّل من مصدر
   * واحد» موجودة عشانه.
   *
   * والقيمة دي هي **نفس** اللي `resolveShippingMethod` بيختاره على
   * الخادم لما ما يجيش معرّف.
   */
  methodDelta?: number
}

export function shippingFor(rates: ShippingRates, city: string, subtotal: number): number {
  if (rates.freeOver !== null && subtotal >= rates.freeOver) return 0
  /* الفرق قبل الشحن المجاني — نفس ترتيب الخادم بالحرف */
  return Math.max(0, (rates.byCity[city] ?? rates.defaultPrice) + (rates.methodDelta ?? 0))
}
