import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { inventoryMovements, products, productVariants } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'

/**
 * بيانات صفحة المخزون — صفحة اللوحة و`/api/app/inventory` بيقروا من هنا.
 * نفس الاستعلامات والحسابات اللي كانت في الصفحة.
 */

export const MOVEMENT_REASONS: Record<string, string> = {
  order: 'طلب',
  return: 'مرتجع',
  cancel: 'إلغاء طلب',
  manual: 'تعديل يدوي',
  restock: 'توريد',
  import: 'استيراد',
  transfer: 'نقل بين الفروع',
}

export async function loadInventory(store: ActiveStore) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      images: products.images,
      stock: products.stock,
      threshold: products.lowStockThreshold,
      trackInventory: products.trackInventory,
      costPrice: products.costPrice,
    })
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.trackInventory, true)))
    .orderBy(products.stock, products.name)
    .limit(300)

  const variants = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      title: productVariants.title,
      sku: productVariants.sku,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .where(and(eq(productVariants.storeId, store.id), eq(productVariants.isActive, true)))
    .orderBy(productVariants.position)

  const byProduct = new Map<string, typeof variants>()
  for (const v of variants) {
    const list = byProduct.get(v.productId) ?? []
    list.push(v)
    byProduct.set(v.productId, list)
  }

  /**
   * المنتج اللي ليه متغيّرات، مخزونه الحقيقي هو مجموع مخزونها — خانة
   * المنتج نفسها بتبقى غير مستعملة. بنحسب الاتنين ونعرض الصح.
   */
  const items = rows.map((p) => {
    const vs = byProduct.get(p.id) ?? []
    const effective = vs.length ? vs.reduce((sum, v) => sum + v.stock, 0) : p.stock
    return { ...p, variants: vs, effective }
  })

  const outCount = items.filter((p) => p.effective <= 0).length
  const lowCount = items.filter((p) => p.effective > 0 && p.effective <= p.threshold).length
  const units = items.reduce((sum, p) => sum + Math.max(0, p.effective), 0)
  // قيمة المخزون بالتكلفة لا بسعر البيع — ده الفلوس المدفوعة فعلًا واللي واقفة في المخزن
  const value = items.reduce((sum, p) => sum + Math.max(0, p.effective) * (p.costPrice ?? 0), 0)

  const movements = await db
    .select({
      id: inventoryMovements.id,
      delta: inventoryMovements.delta,
      reason: inventoryMovements.reason,
      note: inventoryMovements.note,
      createdAt: inventoryMovements.createdAt,
      productName: products.name,
    })
    .from(inventoryMovements)
    .leftJoin(products, eq(products.id, inventoryMovements.productId))
    .where(eq(inventoryMovements.storeId, store.id))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(40)

  return { items, outCount, lowCount, units, value, movements }
}
