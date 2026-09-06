import 'server-only'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders, products } from '@/db/schema'
import { parseOrderNumber } from '@/lib/order-number'

/**
 * البحث السريع — طلب أو منتج أو عميل من أي شاشة.
 *
 * ## المشكلة اللي بيحلّها
 * العميل بيكلّم التاجر ويقول «طلبي رقم ٤٢٠ فين؟». التاجر كان لازم
 * يفتح قايمة الطلبات، يستنّاها تحمّل، يكتب في فلترها. تلات خطوات
 * لسؤال بيتسأل عشرات المرات في اليوم — وهو واقف في المخزن ماسك
 * التليفون بإيد.
 *
 * ## بيدوّر في التلاتة مع بعض
 * الطلبات بالرقم وبالاسم وبالتليفون، والمنتجات بالاسم وبالـSKU،
 * والعملاء بالاسم وبالتليفون وبالبريد. التاجر ما بيفكّرش «ده رقم
 * طلب ولا رقم عميل» — بيلزق اللي معاه.
 *
 * ## والصلاحيات بتحكم
 * الموظف اللي مالوش `customers.view` ما بيشوفش عملاء في النتايج.
 * البحث ما يصحّش يبقى الباب الخلفي اللي بيتخطّى فلترة القايمة.
 */

export type SearchHit = {
  kind: 'order' | 'product' | 'customer'
  id: string
  title: string
  subtitle: string | null
  href: string
}

export type SearchScope = {
  orders: boolean
  products: boolean
  customers: boolean
}

/** أقصى نتايج لكل نوع — الشاشة قايمة سريعة لا صفحة نتايج */
const PER_KIND = 5

export async function quickSearch(
  storeId: string,
  query: string,
  scope: SearchScope,
): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const pattern = `%${q}%`
  /* الأرقام العربية بتتحوّل — اللي بيكتب من كيبورد عربي بيكتب «٤٢٠» */
  const asNumber = parseOrderNumber(q)

  const tasks: Array<Promise<SearchHit[]>> = []

  if (scope.orders) {
    tasks.push(
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          customerName: orders.customerName,
          customerPhone: orders.customerPhone,
          status: orders.status,
          isIncomplete: orders.isIncomplete,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            or(
              asNumber !== null ? eq(orders.orderNumber, asNumber) : undefined,
              ilike(orders.customerName, pattern),
              ilike(orders.customerPhone, pattern),
            ),
          ),
        )
        /* المطابقة بالرقم بتطلع الأول — هي أدقّ حاجة ممكن يكتبها */
        .orderBy(
          sql`case when ${orders.orderNumber} = ${asNumber ?? -1} then 0 else 1 end`,
          desc(orders.createdAt),
        )
        .limit(PER_KIND)
        .then((rows) =>
          rows.map(
            (r): SearchHit => ({
              kind: 'order',
              id: r.id,
              title: `طلب #${r.orderNumber}`,
              subtitle: [r.customerName, r.customerPhone].filter(Boolean).join(' · ') || null,
              href: `/dashboard/orders/${r.id}`,
            }),
          ),
        ),
    )
  }

  if (scope.products) {
    tasks.push(
      db
        .select({ id: products.id, name: products.name, sku: products.sku, stock: products.stock })
        .from(products)
        .where(
          and(
            eq(products.storeId, storeId),
            sql`${products.deletedAt} is null`,
            or(ilike(products.name, pattern), ilike(products.sku, pattern)),
          ),
        )
        .orderBy(desc(products.soldCount))
        .limit(PER_KIND)
        .then((rows) =>
          rows.map(
            (r): SearchHit => ({
              kind: 'product',
              id: r.id,
              title: r.name,
              subtitle: r.sku ? `${r.sku} · ${r.stock} في المخزن` : `${r.stock} في المخزن`,
              href: `/dashboard/products/${r.id}`,
            }),
          ),
        ),
    )
  }

  if (scope.customers) {
    tasks.push(
      db
        .select({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          ordersCount: customers.ordersCount,
        })
        .from(customers)
        .where(
          and(
            eq(customers.storeId, storeId),
            or(
              ilike(customers.name, pattern),
              ilike(customers.phone, pattern),
              ilike(customers.email, pattern),
            ),
          ),
        )
        .orderBy(desc(customers.ordersCount))
        .limit(PER_KIND)
        .then((rows) =>
          rows.map(
            (r): SearchHit => ({
              kind: 'customer',
              id: r.id,
              title: r.name || r.phone || 'عميل بلا اسم',
              subtitle: [r.phone, `${r.ordersCount} طلب`].filter(Boolean).join(' · '),
              href: `/dashboard/customers?q=${encodeURIComponent(r.phone ?? r.name ?? '')}`,
            }),
          ),
        ),
    )
  }

  const results = await Promise.all(tasks)
  return results.flat()
}
