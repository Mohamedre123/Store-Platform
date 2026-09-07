import type { MsgKey } from './i18n'

/**
 * خيارات ترتيب المنتجات.
 *
 * في ملف مستقل عن storefront.ts لأن ده `server-only`، ومكوّن الترتيب
 * في المتجر شغّال على المتصفح ومحتاج نفس القائمة — فالمصدر واحد
 * والاتنين بيقروا منه.
 */
export type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'best_selling'

/**
 * الترتيب بمفتاح ترجمة لا بنص جاهز.

 * النص المكتوب هنا كان بيوصل للمتجر الإنجليزي عربي — والقايمة دي
 * بتترسم في مكوّن عميل، فمكانه الطبيعي هو القاموس.
 */
export const SORT_OPTIONS: Array<{ key: SortKey; msg: MsgKey }> = [
  { key: 'newest', msg: 'sort.newest' },
  { key: 'best_selling', msg: 'sort.best' },
  { key: 'price_asc', msg: 'sort.priceAsc' },
  { key: 'price_desc', msg: 'sort.priceDesc' },
]

/** يحوّل قيمة الرابط لمفتاح صالح — أي قيمة غريبة تبقى «الأحدث» */
export function parseSort(raw: string | undefined): SortKey {
  return SORT_OPTIONS.some((o) => o.key === raw) ? (raw as SortKey) : 'newest'
}
