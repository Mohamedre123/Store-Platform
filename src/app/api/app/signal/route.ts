import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { signalPayload } from '@/lib/app-reports'

export const dynamic = 'force-dynamic'

/** GET /api/app/signal — جودة إشارة التحويل لميتا وتيك توك (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('reports.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await signalPayload(ctx.store.id))
}
