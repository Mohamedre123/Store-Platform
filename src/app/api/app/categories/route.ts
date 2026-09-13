import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { categoriesPayload } from '@/lib/app-categories'

export const dynamic = 'force-dynamic'

/** GET /api/app/categories — أقسام المتجر في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('products.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await categoriesPayload(ctx.store))
}
