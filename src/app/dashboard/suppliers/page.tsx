import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, suppliers } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { SuppliersManager, type ReorderRow, type SupplierRow } from './suppliers-manager'

export const metadata = { title: 'الموردون' }

export default async function SuppliersPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'inventory.manage')

  const rows = (await db
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
    .where(eq(suppliers.storeId, store.id))
    .orderBy(asc(suppliers.name))) as SupplierRow[]

  /**
   * قائمة إعادة الطلب.
   *
   * المنتجات اللي وصلت حد التنبيه، مجمّعة على المورّد. ده اللي التاجر
   * محتاجه فعلًا من صفحة الموردين: مش دفتر تليفونات، لكن «كلّم مين
   * وأطلب إيه» — والمنتج اللي بيخلص هو اللي بيوقف البيع.
   */
  const reorder = (await db
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
        eq(products.storeId, store.id),
        isNull(products.deletedAt),
        eq(products.status, 'active'),
        eq(products.trackInventory, true),
        lte(products.stock, products.lowStockThreshold),
      ),
    )
    .orderBy(asc(products.stock))
    .limit(100)) as ReorderRow[]

  /** كل المنتجات — عشان التاجر يربطها بمورّد من نفس الصفحة */
  const allProducts = await db
    .select({
      id: products.id,
      name: products.name,
      supplierId: products.supplierId,
    })
    .from(products)
    .where(and(eq(products.storeId, store.id), isNull(products.deletedAt)))
    .orderBy(asc(products.name))
    .limit(500)

  const [unlinked] = await db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(
      and(eq(products.storeId, store.id), isNull(products.deletedAt), isNull(products.supplierId)),
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الموردون"
        description="مين بيوردّلك إيه، وإيه اللي قرّب يخلص ومحتاج تطلبه."
      />

      <Reveal>
        <SuppliersManager
          suppliers={rows}
          reorder={reorder}
          products={allProducts}
          unlinkedCount={Number(unlinked?.n ?? 0)}
          currency={store.currency}
        />
      </Reveal>
    </div>
  )
}
