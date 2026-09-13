import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { inventoryPayload } from '@/lib/app-inventory'

export const dynamic = 'force-dynamic'

/** GET /api/app/inventory — المخزون في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await inventoryPayload(ctx.store))
}
