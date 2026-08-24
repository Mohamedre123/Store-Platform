import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { productOptionValues, productOptions, productVariants } from '@/db/schema'

/**
 * خيارات المنتجات (المقاس واللون) لمجموعة منتجات مرة واحدة.
 *
 * ## ليه دفعة واحدة
 * صفحة فيها ٢٤ منتج، لو كل بطاقة جابت خياراتها لوحدها بتبقى ٧٢
 * رحلة لقاعدة البيانات. هنا تلات استعلامات مهما كان عدد المنتجات.
 *
 * ## ليه أصلًا على البطاقة
 * المنتج اللي ليه مقاسات، «أضف للسلة» من غير اختيار معناها إننا
 * بنختار نيابةً عن العميل — بيستلم مقاسًا مش بتاعه ويرجّعه. الحل
 * إن العميل يختار من غير ما يسيب مكانه: على البطاقة، أو جوّه السلة
 * لو ضاف من غير اختيار.
 */

export type CardOption = {
  id: string
  name: string
  displayAs: 'swatch' | 'button' | 'dropdown'
  values: Array<{ id: string; value: string; hex: string | null }>
}

export type CardVariant = {
  id: string
  title: string
  price: number
  compareAtPrice: number | null
  stock: number
  image: string | null
  optionValueIds: string[]
}

export type ProductOptionSet = {
  options: CardOption[]
  variants: CardVariant[]
}

/**
 * بيرجّع خيارات المنتجات اللي ليها خيارات بس.
 *
 * المنتج البسيط ما بيدخلش الخريطة أصلًا — الواجهة بتقرا الغياب
 * على إنه «مالوش خيارات» وتعرض زر الإضافة العادي.
 */
export async function loadProductOptions(
  storeId: string,
  productIds: string[],
): Promise<Map<string, ProductOptionSet>> {
  const ids = [...new Set(productIds)].filter(Boolean)
  if (ids.length === 0) return new Map()

  /*
    بنبدأ بالمتغيّرات: المنتج اللي مالوش متغيّرات نشطة مالوش خيارات
    فعليًا حتى لو التاجر ساب خانات خيارات فاضية ورا. فبنستبعده من
    استعلامي الخيارات بدل ما نجيب صفوفًا هنرميها.
  */
  const variantRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      title: productVariants.title,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      stock: productVariants.stock,
      image: productVariants.image,
      optionValueIds: productVariants.optionValueIds,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.storeId, storeId),
        eq(productVariants.isActive, true),
        inArray(productVariants.productId, ids),
      ),
    )
    .orderBy(asc(productVariants.position))

  if (variantRows.length === 0) return new Map()

  const withVariants = [...new Set(variantRows.map((v) => v.productId))]

  const optionRows = await db
    .select({
      id: productOptions.id,
      productId: productOptions.productId,
      name: productOptions.name,
      displayAs: productOptions.displayAs,
    })
    .from(productOptions)
    .where(inArray(productOptions.productId, withVariants))
    .orderBy(asc(productOptions.position))

  if (optionRows.length === 0) return new Map()

  const valueRows = await db
    .select({
      id: productOptionValues.id,
      optionId: productOptionValues.optionId,
      value: productOptionValues.value,
      hex: productOptionValues.hex,
    })
    .from(productOptionValues)
    .where(
      inArray(
        productOptionValues.optionId,
        optionRows.map((o) => o.id),
      ),
    )
    .orderBy(asc(productOptionValues.position))

  const valuesByOption = new Map<string, CardOption['values']>()
  for (const v of valueRows) {
    const list = valuesByOption.get(v.optionId) ?? []
    list.push({ id: v.id, value: v.value, hex: v.hex })
    valuesByOption.set(v.optionId, list)
  }

  const out = new Map<string, ProductOptionSet>()

  for (const product of withVariants) {
    const options = optionRows
      .filter((o) => o.productId === product)
      .map((o) => ({
        id: o.id,
        name: o.name,
        displayAs: o.displayAs,
        values: valuesByOption.get(o.id) ?? [],
      }))
      .filter((o) => o.values.length > 0)

    if (options.length === 0) continue

    out.set(product, {
      options,
      variants: variantRows
        .filter((v) => v.productId === product)
        .map((v) => ({
          id: v.id,
          title: v.title,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
          image: v.image,
          optionValueIds: v.optionValueIds,
        })),
    })
  }

  return out
}
