/**
 * تنسيق رقم الطلب للعرض.
 *
 * ## ليه التنسيق مفصول عن الرقم
 * الرقم نفسه `integer` وبيتولّد من `stores.orderSequence`، وهو
 * المفتاح اللي الروابط بتشتغل بيه (`/order/1024`) واللي شركات الشحن
 * والبوابات بتتعامل بيه. لو خلّينا البادئة جزءًا من الرقم المخزّن،
 * أول مرة التاجر يغيّرها بتبوظ كل رابط طلب قديم وكل مرجع عند مزوّد.
 *
 * فالبادئة واللاحقة **تنسيق عرض** بس: بيتحطّوا في اللوحة والفاتورة
 * والرسايل، والقاعدة والروابط ما بيعرفوهمش.
 */

export type OrderNumberFormat = {
  orderPrefix?: string | null
  orderSuffix?: string | null
}

/**
 * الرقم زي ما التاجر وعميله بيشوفوه — من غير علامة `#`.
 *
 * العلامة مش هنا لأن أماكن كتير بتحطّها بنفسها، ولو كانت جوّه
 * بتطلع `##`. الاستدعاء بيقول `#{formatOrderNumber(...)}`.
 */
export function formatOrderNumber(store: OrderNumberFormat, n: number): string {
  const prefix = store.orderPrefix?.trim() ?? ''
  const suffix = store.orderSuffix?.trim() ?? ''
  return `${prefix}${n}${suffix}`
}

/**
 * قراءة رقم من نص كتبه التاجر في خانة البحث.
 *
 * بيقبل الاتنين: «1024» و«VS-1024-EG» و«#1024». لو ألزمناه بالرقم
 * الخام، التاجر اللي بينسخ الرقم من الفاتورة اللي إحنا طبعناها ما
 * بيلاقيش طلبه — وده أسوأ بحث ممكن.
 *
 * الأرقام العربية بتتحوّل كمان: اللي بيكتب من كيبورد عربي بيكتب
 * «١٠٢٤»، والقاعدة عمرها ما هتلاقيها.
 */
export function parseOrderNumber(input: string): number | null {
  const western = input.replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660),
  )
  const digits = western.match(/\d+/g)
  if (!digits?.length) return null
  // أطول تتابع أرقام هو الرقم نفسه — البادئة زي «EG2» ممكن يبقى فيها رقم
  const longest = digits.reduce((a, b) => (b.length >= a.length ? b : a))
  const n = Number(longest)
  return Number.isSafeInteger(n) ? n : null
}
