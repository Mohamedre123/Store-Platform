import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadManualOrderSetup } from '@/lib/manual-order-data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/manual-order — إعدادات شاشة «طلب جديد» (العملة، السعر المخصص، العربون، المحافظات، الاستلام،
 * حصّة الباقة). لو الطلبات اليدوية مقفولة من الإعدادات بيرجّع `{ enabled: false }`.
 */
export async function GET() {
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx
  if (!ctx.store.manualOrdersEnabled) return json({ enabled: false })
  return json({ enabled: true, ...(await loadManualOrderSetup(ctx.store)) })
}
