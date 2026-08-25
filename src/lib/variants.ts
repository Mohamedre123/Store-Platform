import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { productOptionValues, productOptions, productVariants } from '@/db/schema'
import { fromMinorUnits } from './utils'

/**
 * خيارات المنتج ومتغيّراته — الحفظ والقراءة من اللوحة.
 *
 * ## المشكلة اللي بيحلّها
 * جداول الخيارات والمتغيّرات موجودة من البداية، والمتجر كله بيحترمها:
 * البطاقة بتعرض المقاسات، السلة بتقف لحد ما العميل يختار، والشيك أوت
 * بيرفض السطر اللي بلا مقاس. بس ما كانش فيه أي مكان **التاجر يعرّف
 * منها فيه المقاس أصلًا** — فالمنظومة كلها كانت بتشتغل على فراغ،
 * والتاجر اللي بيبيع هدوم بيكتب «المقاسات: S M L» في وصف المنتج
 * ويستلم طلبات من غير مقاس.
 *
 * ## التركيبات بتتولّد على الخادم
 * الضرب الديكارتي (٣ مقاسات × ٢ ألوان = ٦ متغيّرات) بيتعمل هنا لا في
 * المتصفح: المتصفح ممكن يبعت تركيبة مش موجودة أو يكرّر واحدة، والسعر
 * والمخزون مالهمش قيمة لو التركيبة نفسها مش موثوقة.
 *
 * ## الحفظ بيحافظ على المعرّفات
 * القيمة اللي اسمها ما اتغيّرش بتفضل بمعرّفها. لو مسحنا وأنشأنا من
 * جديد كل مرة، أي طلب قديم بيشاور على قيمة اتمسحت — والمخزون اللي
 * التاجر ظبّطه على «أحمر XL» بيتصفّر مع كل حفظة.
 */

export type OptionInput = {
  name: string
  displayAs: 'swatch' | 'button' | 'dropdown'
  values: Array<{ value: string; hex?: string | null }>
}

export type VariantInput = {
  /** أسماء القيم بترتيب الخيارات — «أحمر» ثم «XL» */
  values: string[]
  price: number
  compareAtPrice?: number | null
  costPrice?: number | null
  stock: number
  sku?: string | null
  isActive: boolean
}

export type SavedOption = {
  id: string
  name: string
  displayAs: 'swatch' | 'button' | 'dropdown'
  values: Array<{ id: string; value: string; hex: string | null }>
}

export type SavedVariant = {
  id: string
  title: string
  values: string[]
  price: number
  compareAtPrice: number | null
  costPrice: number | null
  stock: number
  sku: string | null
  isActive: boolean
}

/** خيارات منتج واحد ومتغيّراته — لصفحة التعديل */
export async function loadProductVariants(
  productId: string,
): Promise<{ options: SavedOption[]; variants: SavedVariant[] }> {
  const optionRows = await db
    .select()
    .from(productOptions)
    .where(eq(productOptions.productId, productId))
    .orderBy(asc(productOptions.position))

  if (optionRows.length === 0) return { options: [], variants: [] }

  const valueRows = await db
    .select()
    .from(productOptionValues)
    .where(
      inArray(
        productOptionValues.optionId,
        optionRows.map((o) => o.id),
      ),
    )
    .orderBy(asc(productOptionValues.position))

  const variantRows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.position))

  const valueById = new Map(valueRows.map((v) => [v.id, v]))

  const options: SavedOption[] = optionRows.map((o) => ({
    id: o.id,
    name: o.name,
    displayAs: o.displayAs,
    values: valueRows
      .filter((v) => v.optionId === o.id)
      .map((v) => ({ id: v.id, value: v.value, hex: v.hex })),
  }))

  const variants: SavedVariant[] = variantRows.map((v) => ({
    id: v.id,
    title: v.title,
    /*
      بنرجّع الأسماء لا المعرّفات: الواجهة بتطابق التركيبة بالأسماء
      عشان تفضل شغّالة حتى لو التاجر ضاف قيمة جديدة قبل ما يحفظ —
      والمعرّف الجديد لسه ما اتولّدش وقتها.
    */
    values: (v.optionValueIds ?? [])
      .map((id) => valueById.get(id)?.value)
      .filter((s): s is string => Boolean(s)),
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    costPrice: v.costPrice,
    stock: v.stock,
    sku: v.sku,
    isActive: v.isActive,
  }))

  return { options, variants }
}

/**
 * يحوّل المتغيّرات المحفوظة لشكل المحرّر.
 *
 * هنا لا في ملف المحرّر: المحرّر مكوّن عميل، والصفحة اللي بتناديها
 * بتشتغل على الخادم — واستدعاء دالة من ملف `'use client'` على
 * الخادم بيقع.
 */
export function toEditorVariants(
  saved: SavedVariant[],
): Array<{ values: string[]; price: string; stock: string; sku: string; isActive: boolean }> {
  return saved.map((v) => ({
    values: v.values,
    price: String(fromMinorUnits(v.price)),
    stock: String(v.stock),
    sku: v.sku ?? '',
    isActive: v.isActive,
  }))
}

/** كل تركيبات القيم الممكنة — «أحمر/S»، «أحمر/M»، «أزرق/S»… */
export function combinations(options: OptionInput[]): string[][] {
  return options.reduce<string[][]>(
    (acc, option) => acc.flatMap((row) => option.values.map((v) => [...row, v.value])),
    [[]],
  )
}

const key = (values: string[]) => values.join(' / ')

/**
 * حفظ الخيارات والمتغيّرات.
 *
 * قايمة خيارات فاضية معناها إن التاجر شال الخيارات كلها — بنمسح
 * كل حاجة والمنتج يرجع بسيطًا بسعر ومخزون واحد.
 */
export async function saveProductVariants(
  storeId: string,
  productId: string,
  options: OptionInput[],
  variants: VariantInput[],
): Promise<void> {
  const clean = options
    .map((o) => ({
      ...o,
      name: o.name.trim(),
      values: o.values
        .map((v) => ({ value: v.value.trim(), hex: v.hex?.trim() || null }))
        .filter((v) => v.value)
        /* التكرار بيولّد تركيبتين بنفس الاسم وبيلخبط اختيار العميل */
        .filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i),
    }))
    .filter((o) => o.name && o.values.length > 0)

  if (clean.length === 0) {
    await db.delete(productVariants).where(eq(productVariants.productId, productId))
    await db.delete(productOptions).where(eq(productOptions.productId, productId))
    return
  }

  const existingOptions = await db
    .select()
    .from(productOptions)
    .where(eq(productOptions.productId, productId))

  const existingValues = existingOptions.length
    ? await db
        .select()
        .from(productOptionValues)
        .where(
          inArray(
            productOptionValues.optionId,
            existingOptions.map((o) => o.id),
          ),
        )
    : []

  /* «المقاس|XL» → معرّف القيمة القديم، عشان المخزون ما يتصفّرش */
  const valueIdByKey = new Map<string, string>()
  for (const v of existingValues) {
    const option = existingOptions.find((o) => o.id === v.optionId)
    if (option) valueIdByKey.set(`${option.name}|${v.value}`, v.id)
  }

  const optionIdByName = new Map(existingOptions.map((o) => [o.name, o.id]))

  /* الخيارات اللي التاجر شالها — الحذف المتتالي بيشيل قيمها معاها */
  const keptNames = new Set(clean.map((o) => o.name))
  const dropped = existingOptions.filter((o) => !keptNames.has(o.name))
  if (dropped.length) {
    await db.delete(productOptions).where(
      inArray(
        productOptions.id,
        dropped.map((o) => o.id),
      ),
    )
  }

  const savedValueIds = new Map<string, string>()

  for (const [position, option] of clean.entries()) {
    let optionId = optionIdByName.get(option.name)

    if (optionId) {
      await db
        .update(productOptions)
        .set({ displayAs: option.displayAs, position })
        .where(eq(productOptions.id, optionId))
    } else {
      const [created] = await db
        .insert(productOptions)
        .values({ productId, name: option.name, displayAs: option.displayAs, position })
        .returning({ id: productOptions.id })
      optionId = created.id
    }

    const keptValues = new Set(option.values.map((v) => v.value))
    const staleValues = existingValues.filter(
      (v) => v.optionId === optionId && !keptValues.has(v.value),
    )
    if (staleValues.length) {
      await db.delete(productOptionValues).where(
        inArray(
          productOptionValues.id,
          staleValues.map((v) => v.id),
        ),
      )
    }

    for (const [vPosition, value] of option.values.entries()) {
      const existingId = valueIdByKey.get(`${option.name}|${value.value}`)

      if (existingId) {
        await db
          .update(productOptionValues)
          .set({ hex: value.hex, position: vPosition })
          .where(eq(productOptionValues.id, existingId))
        savedValueIds.set(`${option.name}|${value.value}`, existingId)
      } else {
        const [created] = await db
          .insert(productOptionValues)
          .values({ optionId, value: value.value, hex: value.hex, position: vPosition })
          .returning({ id: productOptionValues.id })
        savedValueIds.set(`${option.name}|${value.value}`, created.id)
      }
    }
  }

  /*
    التركيبات بتتولّد هنا لا بتتاخد من المتصفح.

    اللي جاي من المتصفح هو السعر والمخزون لكل تركيبة بس؛ التركيبات
    نفسها بتتحسب من الخيارات المحفوظة. كده مستحيل يتحفظ متغيّر
    لتركيبة مش موجودة، ولا تركيبة تتكرّر.
  */
  const wanted = combinations(clean)
  const byKey = new Map(variants.map((v) => [key(v.values), v]))

  const existingVariants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))

  const valueNameById = new Map<string, string>()
  for (const [k, id] of savedValueIds) valueNameById.set(id, k.split('|')[1])

  const variantIdByKey = new Map<string, string>()
  for (const v of existingVariants) {
    const names = (v.optionValueIds ?? [])
      .map((id) => valueNameById.get(id))
      .filter((s): s is string => Boolean(s))
    if (names.length === clean.length) variantIdByKey.set(key(names), v.id)
  }

  const wantedKeys = new Set(wanted.map(key))

  /* التركيبات اللي بقت مستحيلة بعد ما التاجر شال قيمة */
  const staleVariants = existingVariants.filter((v) => {
    const names = (v.optionValueIds ?? [])
      .map((id) => valueNameById.get(id))
      .filter((s): s is string => Boolean(s))
    return names.length !== clean.length || !wantedKeys.has(key(names))
  })

  if (staleVariants.length) {
    await db.delete(productVariants).where(
      inArray(
        productVariants.id,
        staleVariants.map((v) => v.id),
      ),
    )
  }

  for (const [position, combo] of wanted.entries()) {
    const input = byKey.get(key(combo))
    if (!input) continue

    const optionValueIds = combo
      .map((value, i) => savedValueIds.get(`${clean[i].name}|${value}`))
      .filter((s): s is string => Boolean(s))

    const values = {
      title: key(combo),
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      costPrice: input.costPrice ?? null,
      stock: Math.max(0, input.stock),
      sku: input.sku || null,
      optionValueIds,
      isActive: input.isActive,
      position,
    }

    const existingId = variantIdByKey.get(key(combo))
    if (existingId) {
      await db.update(productVariants).set(values).where(eq(productVariants.id, existingId))
    } else {
      await db.insert(productVariants).values({ ...values, productId, storeId })
    }
  }

  /*
    المنتج اللي كل متغيّراته متوقّفة زيّه زي اللي مالوش متغيّرات
    أصلًا — والواجهة بتقرا الغياب ده على إنه «منتج بسيط». بنسيبه
    كده عن قصد: التاجر ممكن يوقّف المقاسات مؤقّتًا من غير ما يمسحها.
  */
}

/** يقفل حذف المتجر من التسرّب: المتغيّر لازم يكون تابع للمتجر ده */
export async function assertProductInStore(storeId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.storeId, storeId), eq(productVariants.productId, productId)))
    .limit(1)
  return Boolean(row)
}
