import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadTrash } from '@/lib/trash-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/trash — سلة مهملات المنتجات في تطبيق الموبايل */
export async function GET() {
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx
  return json({ currency: ctx.store.currency, products: await loadTrash(ctx.store.id) })
}
