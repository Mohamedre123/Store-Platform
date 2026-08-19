import { NextResponse, type NextRequest } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders } from '@/db/schema'
import { authenticateApiKey } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/** GET /api/v1/orders — الطلبات مع أصنافها */
export async function GET(req: NextRequest) {
  const ctx = await authenticateApiKey(req.headers.get('authorization'), 'orders:read')
  if (!ctx) {
    return NextResponse.json({ error: 'مفتاح غير صالح أو صلاحية ناقصة' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const status = url.searchParams.get('status')

  const conditions = [eq(orders.storeId, ctx.storeId), eq(orders.isIncomplete, false)]
  if (status) conditions.push(eq(orders.status, status as never))

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      subtotal: orders.subtotal,
      shippingTotal: orders.shippingTotal,
      discountTotal: orders.discountTotal,
      total: orders.total,
      currency: orders.currency,
      shippingAddress: orders.shippingAddress,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit)

  /**
   * الأصناف بتتجاب في استعلام واحد لكل الطلبات وبتتجمّع في الذاكرة —
   * استعلام لكل طلب كان هيبقى N+1 ويقتل الأداء مع ١٠٠ طلب.
   */
  const ids = rows.map((r) => r.id)
  const items = ids.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          name: orderItems.name,
          quantity: orderItems.quantity,
          price: orderItems.price,
          total: orderItems.total,
        })
        .from(orderItems)
        .where(eq(orderItems.storeId, ctx.storeId))
    : []

  const byOrder = new Map<string, typeof items>()
  for (const it of items) {
    if (!ids.includes(it.orderId)) continue
    const list = byOrder.get(it.orderId) ?? []
    list.push(it)
    byOrder.set(it.orderId, list)
  }

  return NextResponse.json({
    data: rows.map((r) => ({ ...r, items: byOrder.get(r.id) ?? [] })),
    meta: { limit, count: rows.length, currencyMinorUnits: true },
  })
}

/** PATCH /api/v1/orders — تحديث حالة الطلب أو رقم الشحنة */
export async function PATCH(req: NextRequest) {
  const ctx = await authenticateApiKey(req.headers.get('authorization'), 'orders:write')
  if (!ctx) {
    return NextResponse.json({ error: 'مفتاح غير صالح أو صلاحية ناقصة' }, { status: 401 })
  }

  let body: { id?: string; status?: string; trackingNumber?: string; carrier?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON غير صالح' }, { status: 400 })
  }

  if (!body.id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
  const patch: Record<string, unknown> = {}

  if (body.status) {
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: `الحالة لازم تكون واحدة من: ${allowed.join(', ')}` }, { status: 400 })
    }
    patch.status = body.status
    if (body.status === 'delivered') patch.deliveredAt = new Date()
  }
  if (typeof body.trackingNumber === 'string') patch.trackingNumber = body.trackingNumber.slice(0, 64)
  if (typeof body.carrier === 'string') patch.shippingCarrier = body.carrier.slice(0, 64)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'مفيش حقول صالحة للتحديث' }, { status: 400 })
  }

  const updated = await db
    .update(orders)
    .set(patch)
    .where(and(eq(orders.id, body.id), eq(orders.storeId, ctx.storeId)))
    .returning({ id: orders.id, status: orders.status, trackingNumber: orders.trackingNumber })

  if (!updated.length) return NextResponse.json({ error: 'الطلب مش موجود' }, { status: 404 })

  return NextResponse.json({ data: updated[0] })
}
