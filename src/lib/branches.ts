import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { inventoryLevels, inventoryLocations, inventoryMovements } from '@/db/schema'

/**
 * توزيع المخزون على الفروع.
 *
 * **الفروع بتقسّم المخزون، مش بتحلّ محلّه.**
 *
 * القرار ده هو الأهم في الملف. `products.stock` بيفضل هو الرقم اللي
 * المتجر بيبيع منه، والفروع بتقول **فين** الكمية دي قاعدة. ليه؟
 *
 * لو خلّينا البيع يقرا من الفروع، كل طلب كان محتاج يقرّر يخصم من
 * أنهي فرع قبل ما يعرف عنوان العميل، والتاجر اللي نسي يوزّع منتجًا
 * على فرع كان بيلاقيه «نافد» وهو موجود في المخزن قدامه. الخسارة
 * دي أكبر بكتير من فايدة الدقة.
 *
 * فاللي بيحصل: البيع بيخصم من الإجمالي ومن الفرع الافتراضي، والتاجر
 * بينقل بين الفروع من غير ما الإجمالي يتغيّر. النقل مش بيخلق ولا
 * بيفني كمية — بيحرّكها.
 */

export type Branch = {
  id: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
  isDefault: boolean
  isActive: boolean
}

export async function listBranches(storeId: string): Promise<Branch[]> {
  return db
    .select({
      id: inventoryLocations.id,
      name: inventoryLocations.name,
      city: inventoryLocations.city,
      address: inventoryLocations.address,
      phone: inventoryLocations.phone,
      isDefault: inventoryLocations.isDefault,
      isActive: inventoryLocations.isActive,
    })
    .from(inventoryLocations)
    .where(eq(inventoryLocations.storeId, storeId))
    .orderBy(sql`${inventoryLocations.isDefault} desc`, inventoryLocations.name)
}

/**
 * الفرع الافتراضي — بيتعمل لوحده أول مرة.
 *
 * التاجر اللي عنده مكان واحد ما ينفعش نطلب منه يعرّفه قبل ما يشوف
 * أي حاجة. بنعمله «المخزن الرئيسي» في أول قراءة، فالشاشة بتشتغل
 * من غير خطوة إعداد.
 */
export async function defaultBranch(storeId: string): Promise<Branch> {
  const existing = await listBranches(storeId)
  const found = existing.find((b) => b.isDefault) ?? existing[0]
  if (found) return found

  /*
    `onConflictDoNothing` مع القيد الفريد على الفرع الافتراضي:
    لو طلبان وصلوا في نفس اللحظة، واحد بينجح والتاني بيعدّي بهدوء
    ويقرا اللي اتعمل. من غير كده الاتنين بيعملوا فرعًا — وده حصل.
  */
  await db
    .insert(inventoryLocations)
    .values({ storeId, name: 'المخزن الرئيسي', isDefault: true })
    .onConflictDoNothing()

  const after = await listBranches(storeId)
  return after.find((b) => b.isDefault) ?? after[0]
}

export type BranchLevel = {
  locationId: string
  productId: string | null
  variantId: string | null
  available: number
}

/** أرصدة الفروع لمجموعة منتجات — استعلام واحد لكل الشاشة */
export async function levelsForProducts(
  storeId: string,
  productIds: string[],
): Promise<BranchLevel[]> {
  if (productIds.length === 0) return []

  const branches = await listBranches(storeId)
  if (branches.length === 0) return []

  return db
    .select({
      locationId: inventoryLevels.locationId,
      productId: inventoryLevels.productId,
      variantId: inventoryLevels.variantId,
      available: inventoryLevels.available,
    })
    .from(inventoryLevels)
    .where(
      and(
        inArray(
          inventoryLevels.locationId,
          branches.map((b) => b.id),
        ),
        inArray(inventoryLevels.productId, productIds),
      ),
    )
}

/** مفتاح الصف: الفرع + المنتج + المتغيّر (أو صفر لو مفيش متغيّر) */
export function levelKey(locationId: string, productId: string, variantId?: string | null) {
  return `${locationId}:${productId}:${variantId ?? ''}`
}

async function ensureOwned(storeId: string, locationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: inventoryLocations.id })
    .from(inventoryLocations)
    .where(and(eq(inventoryLocations.id, locationId), eq(inventoryLocations.storeId, storeId)))
    .limit(1)

  return Boolean(row)
}

/**
 * ضبط رصيد فرع لمنتج.
 *
 * **ما بيغيّرش الإجمالي.** التاجر هنا بيقول «الكمية اللي عندي دي
 * موزّعة كده» — مش بيضيف كمية جديدة. الإضافة مكانها شاشة المخزون
 * نفسها، وخلط الاتنين كان هيخلّي رقمًا يتزوّد مرتين.
 */
export async function setBranchLevel(input: {
  storeId: string
  locationId: string
  productId: string
  variantId?: string | null
  available: number
}): Promise<{ ok?: boolean; error?: string }> {
  if (!(await ensureOwned(input.storeId, input.locationId))) {
    return { error: 'الفرع ده مش بتاع متجرك' }
  }

  const available = Math.max(0, Math.trunc(input.available))
  const variantId = input.variantId || null

  const [existing] = await db
    .select({ id: inventoryLevels.id })
    .from(inventoryLevels)
    .where(
      and(
        eq(inventoryLevels.locationId, input.locationId),
        eq(inventoryLevels.productId, input.productId),
        variantId
          ? eq(inventoryLevels.variantId, variantId)
          : sql`${inventoryLevels.variantId} is null`,
      ),
    )
    .limit(1)

  if (existing) {
    await db.update(inventoryLevels).set({ available }).where(eq(inventoryLevels.id, existing.id))
  } else {
    await db.insert(inventoryLevels).values({
      locationId: input.locationId,
      productId: input.productId,
      variantId,
      available,
    })
  }

  return { ok: true }
}

/**
 * نقل كمية بين فرعين.
 *
 * بيتسجّل حركتين في سجل المخزون — ناقص من المصدر وزايد في الوجهة —
 * عشان سؤال «المخزون راح فين؟» يفضل ليه إجابة. حركة واحدة كانت
 * هتخلّي النقل يبان كأنه فقد.
 *
 * الإجمالي ما بيتغيّرش: البضاعة اتنقلت، ما اتباعتش.
 */
export async function transferStock(input: {
  storeId: string
  fromId: string
  toId: string
  productId: string
  variantId?: string | null
  quantity: number
  note?: string
}): Promise<{ ok?: boolean; error?: string }> {
  const qty = Math.trunc(input.quantity)
  if (qty <= 0) return { error: 'اكتب كمية أكبر من صفر' }
  if (input.fromId === input.toId) return { error: 'اختار فرعين مختلفين' }

  const [okFrom, okTo] = await Promise.all([
    ensureOwned(input.storeId, input.fromId),
    ensureOwned(input.storeId, input.toId),
  ])
  if (!okFrom || !okTo) return { error: 'واحد من الفروع مش بتاع متجرك' }

  const variantId = input.variantId || null
  const variantCond = variantId
    ? eq(inventoryLevels.variantId, variantId)
    : sql`${inventoryLevels.variantId} is null`

  const [source] = await db
    .select({ id: inventoryLevels.id, available: inventoryLevels.available })
    .from(inventoryLevels)
    .where(
      and(
        eq(inventoryLevels.locationId, input.fromId),
        eq(inventoryLevels.productId, input.productId),
        variantCond,
      ),
    )
    .limit(1)

  if (!source || source.available < qty) {
    return { error: `الفرع المصدر فيه ${source?.available ?? 0} بس` }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(inventoryLevels)
      .set({ available: sql`${inventoryLevels.available} - ${qty}` })
      .where(eq(inventoryLevels.id, source.id))

    const [dest] = await tx
      .select({ id: inventoryLevels.id })
      .from(inventoryLevels)
      .where(
        and(
          eq(inventoryLevels.locationId, input.toId),
          eq(inventoryLevels.productId, input.productId),
          variantCond,
        ),
      )
      .limit(1)

    if (dest) {
      await tx
        .update(inventoryLevels)
        .set({ available: sql`${inventoryLevels.available} + ${qty}` })
        .where(eq(inventoryLevels.id, dest.id))
    } else {
      await tx.insert(inventoryLevels).values({
        locationId: input.toId,
        productId: input.productId,
        variantId,
        available: qty,
      })
    }

    await tx.insert(inventoryMovements).values([
      {
        storeId: input.storeId,
        productId: input.productId,
        variantId,
        locationId: input.fromId,
        delta: -qty,
        reason: 'transfer',
        note: input.note || 'نقل بين الفروع',
      },
      {
        storeId: input.storeId,
        productId: input.productId,
        variantId,
        locationId: input.toId,
        delta: qty,
        reason: 'transfer',
        note: input.note || 'نقل بين الفروع',
      },
    ])
  })

  return { ok: true }
}

/**
 * خصم البيع من الفرع الافتراضي.
 *
 * بيتنادى بعد ما الطلب يخصم من الإجمالي. **ما بيرميش أبدًا ولا
 * بيمنع الطلب**: توزيع الفروع بيانات إدارية، والطلب اللي بيقع عشان
 * صف مفقود في جدول توزيع خسارة حقيقية مقابل رقم تقريبي.
 *
 * ولو الفرع رصيده أقل من المطلوب، بينزل لصفر ولا يقل — الرصيد
 * السالب في شاشة الفروع بيخوّف التاجر من غير سبب.
 */
export async function consumeFromDefaultBranch(
  storeId: string,
  lines: Array<{ productId: string; variantId?: string | null; quantity: number }>,
): Promise<void> {
  if (lines.length === 0) return

  const branches = await listBranches(storeId)
  const target = branches.find((b) => b.isDefault && b.isActive) ?? branches.find((b) => b.isActive)
  if (!target) return

  for (const line of lines) {
    const variantId = line.variantId || null
    await db
      .update(inventoryLevels)
      .set({ available: sql`greatest(0, ${inventoryLevels.available} - ${line.quantity})` })
      .where(
        and(
          eq(inventoryLevels.locationId, target.id),
          eq(inventoryLevels.productId, line.productId),
          variantId
            ? eq(inventoryLevels.variantId, variantId)
            : sql`${inventoryLevels.variantId} is null`,
        ),
      )
      .catch(() => undefined)
  }
}
