/**
 * خيارات ترتيب المنتجات.
 *
 * في ملف مستقل عن storefront.ts لأن ده `server-only`، ومكوّن الترتيب
 * في المتجر شغّال على المتصفح ومحتاج نفس القائمة — فالمصدر واحد
 * والاتنين بيقروا منه.
 */
export type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'best_selling'

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'best_selling', label: 'الأكثر مبيعًا' },
  { key: 'price_asc', label: 'الأرخص أولًا' },
  { key: 'price_desc', label: 'الأغلى أولًا' },
]

/** يحوّل قيمة الرابط لمفتاح صالح — أي قيمة غريبة تبقى «الأحدث» */
export function parseSort(raw: string | undefined): SortKey {
  return SORT_OPTIONS.some((o) => o.key === raw) ? (raw as SortKey) : 'newest'
}
