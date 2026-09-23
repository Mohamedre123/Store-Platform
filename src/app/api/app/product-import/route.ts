import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { IMPORT_SOURCES } from '@/lib/import-sources'

export const dynamic = 'force-dynamic'

/** GET /api/app/product-import — المنصات اللي نقدر نستورد منها بخطوات جلب المفاتيح (نفس صفحة الاستيراد) */
export async function GET() {
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx
  return json({ currency: ctx.store.currency, sources: IMPORT_SOURCES })
}
