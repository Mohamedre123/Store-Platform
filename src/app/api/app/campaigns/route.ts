import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadCampaigns } from '@/lib/campaigns-data'
import { audienceSize } from '@/lib/campaigns'
import { AUDIENCE_META } from '@/lib/campaigns-meta'
import type { CampaignAudience } from '@/db/schema'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/campaigns — حملات البريد والمشتركين (نفس صفحة اللوحة) + الجماهير بأسمائها وحجم كل واحد
 * (الصفحة بتسأل عن الحجم مع كل اختيار؛ التطبيق بياخدهم مرة واحدة).
 */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const keys = Object.keys(AUDIENCE_META) as CampaignAudience[]
  const [data, sizes] = await Promise.all([loadCampaigns(ctx.store.id), Promise.all(keys.map((k) => audienceSize(ctx.store.id, k)))])

  return json({
    ...data,
    audiences: keys.map((key, i) => ({ key, ...AUDIENCE_META[key], size: sizes[i] })),
  })
}
