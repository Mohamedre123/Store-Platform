import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { appContext, json } from '@/lib/app-api'

export const dynamic = 'force-dynamic'

/** GET /api/app/products/form — اللي شاشة «منتج جديد» في التطبيق محتاجاه: الأقسام والعملة */
export async function GET() {
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.storeId, ctx.store.id))
    .orderBy(categories.sortOrder)

  return json({ currency: ctx.store.currency, categories: rows })
}
