'use server'

import { loadProductOptions, type ProductOptionSet } from '@/lib/product-options'
import { getStore } from '@/lib/storefront'

/**
 * خيارات منتجات السلة.
 *
 * السلة بتتخزّن في متصفّح العميل، وما بتعرفش غير معرّف المنتج وسعره
 * وقت الإضافة. لما العميل يضيف منتج ليه مقاسات من غير ما يختار،
 * محتاجين نجيب خياراته عشان يحدّدها من مكانه بدل ما يرجع لصفحة
 * المنتج ويضيفه تاني.
 *
 * المعرّفات جاية من المتصفح، فبنقيّد الاستعلام بالمتجر: من غير كده
 * حد يبعت معرّف منتج تاجر تاني ويقرا كتالوجه.
 */
export async function cartOptionsAction(input: {
  storeIdentifier: string
  productIds: string[]
}): Promise<Record<string, ProductOptionSet>> {
  const ids = [...new Set(input.productIds)].filter(Boolean).slice(0, 40)
  if (ids.length === 0) return {}

  const store = await getStore(input.storeIdentifier)
  if (!store) return {}

  const map = await loadProductOptions(store.id, ids)

  /* Map مش بتعدّي حدود الخادم — بنرجّعها كائنًا عاديًا */
  return Object.fromEntries(map)
}
