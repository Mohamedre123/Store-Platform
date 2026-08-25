import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders, stores } from '@/db/schema'
import { getStoreTheme } from './storefront'
import { formatDateTime } from './utils'
import { paymentProvider } from './providers'
import type { InvoiceData } from './invoice-pdf'

/**
 * بيانات الفاتورة من الطلب.
 *
 * مكان واحد بيقراها: مرفق البريد، ومسار تحميل الـPDF، وصفحة الفاتورة
 * لو احتاجت. لو كل واحد قراها بنفسه، أول تعديل (سطر ضريبة، خصم) بيتعمل
 * في مكان وينسى التاني — والعميل يشوف رقمين مختلفين لنفس الطلب.
 */
export async function loadInvoice(
  storeId: string,
  orderId: string,
): Promise<InvoiceData | null> {
  const [row] = await db
    .select({
      order: orders,
      storeName: stores.name,
      storeEmail: stores.email,
    })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .limit(1)

  if (!row || row.order.isIncomplete) return null

  const [items, theme] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    getStoreTheme(storeId),
  ])

  const o = row.order
  const address = o.shippingAddress

  return {
    storeName: row.storeName,
    storeEmail: row.storeEmail,
    primary: theme.custom.identity.primary,
    orderNumber: o.orderNumber,
    placedAt: formatDateTime(o.createdAt),
    currency: o.currency,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    address:
      [address?.street, address?.building, address?.area, address?.city]
        .filter(Boolean)
        .join('، ') || null,
    paymentLabel: paymentLabel(o.paymentGateway, o.paymentMethod),
    paid: o.paymentStatus === 'paid',
    lines: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      total: i.total,
      options: i.options,
    })),
    subtotal: o.subtotal,
    discount: o.discountTotal,
    shipping: o.shippingTotal,
    codFee: o.codFee,
    tax: o.taxTotal,
    total: o.total,
  }
}

/**
 * اسم طريقة الدفع زي ما العميل بيعرفها.
 *
 * الفاتورة اللي مكتوب فيها `cod` أو `paymob` مش فاتورة — دي شفرة
 * داخلية. العميل لازم يقرا «الدفع عند الاستلام».
 */
function paymentLabel(gateway: string | null, method: string | null): string {
  if (gateway === 'cod' || method === 'cod') return 'الدفع عند الاستلام'
  if (gateway === 'manual') return 'تحويل بنكي أو محفظة'
  if (gateway) return paymentProvider(gateway)?.name ?? gateway
  return 'غير محدّد'
}
