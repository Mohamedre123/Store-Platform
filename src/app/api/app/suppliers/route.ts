import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { suppliersPayload } from '@/lib/app-suppliers'

export const dynamic = 'force-dynamic'

/** GET /api/app/suppliers — الموردون وقايمة «محتاج تطلبه» في تطبيق الموبايل */
export async function GET() {
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await suppliersPayload(ctx.store))
}
