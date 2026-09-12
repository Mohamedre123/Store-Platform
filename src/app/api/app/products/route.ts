import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { productsListPayload } from '@/lib/app-products'

export const dynamic = 'force-dynamic'

/** GET /api/app/products — قايمة المنتجات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('products.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await productsListPayload(ctx.store))
}
