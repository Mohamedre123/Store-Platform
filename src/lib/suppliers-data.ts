import 'server-only'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, suppliers } from '@/db/schema'

/**
 * بيانات شاشة الموردين — صفحة اللوحة (`/dashboard/suppliers`) وتطبيق
 * الموبايل (`/api/app/suppliers`) الاتنين بيقروا من هنا.
 */
export async function loadSuppliers(storeId: string) {
  const [rows, reorder, allProducts, [unlinked]] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        phone: suppliers.phone,
        email: suppliers.email,
        defaultMarginBps: suppliers.defaultMarginBps,
        productCount: suppliers.productCount,
        isActive: suppliers.isActive,
      })
      .from(suppliers)
      .where(eq(suppliers.storeId, storeId))
      .orderBy(asc(suppliers.name)),

    /**
     * قائمة إعادة الطلب.
     *
     * المنتجات اللي وصلت حد التنبيه، مجمّعة على المورّد. ده اللي التاجر
     * محتاجه فعلًا من صفحة الموردين: مش دفتر تليفونات، لكن «كلّم مين
     * وأطلب إيه» — والمنتج اللي بيخلص هو اللي بيوقف البيع.
     */
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stock: products.stock,
        lowStockThreshold: products.lowStockThreshold,
        costPrice: products.costPrice,
        supplierId: products.supplierId,
      })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          isNull(products.deletedAt),
          eq(products.status, 'active'),
          eq(products.trackInventory, true),
          lte(products.stock, products.lowStockThreshold),
        ),
      )
      .orderBy(asc(products.stock))
      .limit(100),

    /** كل المنتجات — عشان التاجر يربطها بمورّد من نفس الصفحة */
    db
      .select({ id: products.id, name: products.name, supplierId: products.supplierId })
      .from(products)
      .where(and(eq(products.storeId, storeId), isNull(products.deletedAt)))
      .orderBy(asc(products.name))
      .limit(500),

    db
      .select({ n: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.storeId, storeId), isNull(products.deletedAt), isNull(products.supplierId))),
  ])

  return { rows, reorder, allProducts, unlinkedCount: Number(unlinked?.n ?? 0) }
}
