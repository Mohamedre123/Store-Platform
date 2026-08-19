'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { products, suppliers } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type SupplierState = { ok?: boolean; error?: string; id?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'اكتب اسم المورّد').max(80),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(120).optional(),
  /** هامش الربح المقترح بالنسبة المئوية — بنخزّنه بنقاط الأساس */
  defaultMarginPercent: z.coerce.number().min(0).max(500).optional(),
  isActive: z.boolean().optional(),
})

export async function saveSupplierAction(raw: unknown): Promise<SupplierState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store } = await getDashboardContext()

  const values = {
    name: input.name,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    // النسبة بتتخزّن بنقاط الأساس زي كل نسب المشروع: ٣٠٪ = 3000
    defaultMarginBps: Math.round((input.defaultMarginPercent ?? 30) * 100),
    isActive: input.isActive ?? true,
  }

  if (input.id) {
    const updated = await db
      .update(suppliers)
      .set(values)
      .where(and(eq(suppliers.id, input.id), eq(suppliers.storeId, store.id)))
      .returning({ id: suppliers.id })

    if (!updated.length) return { error: 'المورّد مش موجود' }
    revalidatePath('/dashboard/suppliers')
    return { ok: true, id: updated[0].id }
  }

  const [created] = await db
    .insert(suppliers)
    .values({ storeId: store.id, ...values })
    .returning({ id: suppliers.id })

  revalidatePath('/dashboard/suppliers')
  return { ok: true, id: created.id }
}

/**
 * حذف مورّد.
 *
 * المنتجات المربوطة بيه بتتفكّ مش بتتحذف — التاجر بيغيّر مورّد
 * وبيفضل بايع نفس المنتج. ولأن العمود من غير مفتاح أجنبي (الجدولين
 * في ملفين وكان هيعمل دورة استيراد)، التفريغ لازم يحصل هنا صراحةً
 * وإلا فضلت معرّفات ميّتة على المنتجات.
 */
export async function deleteSupplierAction(id: string): Promise<SupplierState> {
  const { store } = await getDashboardContext()

  const deleted = await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ supplierId: null })
      .where(and(eq(products.supplierId, id), eq(products.storeId, store.id)))

    return tx
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.storeId, store.id)))
      .returning({ id: suppliers.id })
  })

  if (!deleted.length) return { error: 'المورّد مش موجود' }

  revalidatePath('/dashboard/suppliers')
  revalidatePath('/dashboard/products')
  return { ok: true }
}

/** ربط منتج بمورّد — أو فكّه لو المعرّف فاضي */
export async function setProductSupplierAction(
  productId: string,
  supplierId: string | null,
): Promise<SupplierState> {
  const { store } = await getDashboardContext()

  if (supplierId) {
    const [exists] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, store.id)))
      .limit(1)

    if (!exists) return { error: 'المورّد مش موجود' }
  }

  const updated = await db
    .update(products)
    .set({ supplierId })
    .where(and(eq(products.id, productId), eq(products.storeId, store.id)))
    .returning({ id: products.id })

  if (!updated.length) return { error: 'المنتج مش موجود' }

  await refreshCounts(store.id)
  revalidatePath('/dashboard/suppliers')
  revalidatePath('/dashboard/products')
  return { ok: true }
}

/** إعادة حساب عدد منتجات كل مورّد — استعلام واحد لكل الموردين */
async function refreshCounts(storeId: string) {
  await db.execute(sql`
    update suppliers s
    set product_count = coalesce((
      select count(*) from products p
      where p.supplier_id = s.id and p.deleted_at is null
    ), 0)
    where s.store_id = ${storeId}
  `)
}
