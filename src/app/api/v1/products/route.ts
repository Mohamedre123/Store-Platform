import { NextResponse, type NextRequest } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import { authenticateApiKey } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/products
 *
 * المنتجات بصيغة JSON للأنظمة الخارجية. الاستجابة بتلتزم بحدود المتجر
 * اللي المفتاح بتاعه — مفيش طريقة يقرأ بيها متجرًا تاني حتى لو غيّر
 * المعرّفات في الرابط، لأن معرّف المتجر جاي من المفتاح مش من الطلب.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticateApiKey(req.headers.get('authorization'), 'products:read')
  if (!ctx) {
    return NextResponse.json({ error: 'مفتاح غير صالح أو صلاحية ناقصة' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      stock: products.stock,
      status: products.status,
      images: products.images,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(eq(products.storeId, ctx.storeId))
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({
    data: rows,
    // المبالغ بالوحدة الصغرى — التوثيق لازم يقولها صراحة عشان المستهلك
    // ما يقسمش على ١٠٠ مرتين أو ما يقسمش خالص
    meta: { limit, offset, count: rows.length, currencyMinorUnits: true },
  })
}

/** PATCH /api/v1/products — تحديث المخزون أو السعر */
export async function PATCH(req: NextRequest) {
  const ctx = await authenticateApiKey(req.headers.get('authorization'), 'products:write')
  if (!ctx) {
    return NextResponse.json({ error: 'مفتاح غير صالح أو صلاحية ناقصة' }, { status: 401 })
  }

  let body: { id?: string; stock?: number; price?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON غير صالح' }, { status: 400 })
  }

  if (!body.id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

  const patch: Record<string, number> = {}
  if (Number.isInteger(body.stock) && body.stock! >= 0) patch.stock = body.stock!
  if (Number.isInteger(body.price) && body.price! >= 0) patch.price = body.price!

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'مفيش حقول صالحة للتحديث' }, { status: 400 })
  }

  const updated = await db
    .update(products)
    .set(patch)
    .where(and(eq(products.id, body.id), eq(products.storeId, ctx.storeId)))
    .returning({ id: products.id, stock: products.stock, price: products.price })

  if (!updated.length) return NextResponse.json({ error: 'المنتج مش موجود' }, { status: 404 })

  return NextResponse.json({ data: updated[0] })
}
