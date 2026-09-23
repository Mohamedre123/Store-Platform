import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveCampaignAction } from '@/app/dashboard/marketing/campaigns/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/campaigns/save — `{ id?, name, subject, body, ctaLabel, ctaUrl, audience }` (مسوّدة بس — الفعل بيرفض تعديل حملة بدأت) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await saveCampaignAction(body)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true, id: res?.id ?? null })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
