import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { livePayload } from '@/lib/app-reports'

export const dynamic = 'force-dynamic'

/** GET /api/app/live — العرض المباشر: مين على المتجر دلوقتي (نفس صفحة اللوحة — التطبيق بيسأل كل ١٥ ثانية وهو ظاهر) */
export async function GET() {
  const ctx = await appContext('reports.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await livePayload(ctx))
}
