import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { deleteCampaignAction, startCampaignAction } from '@/app/dashboard/marketing/campaigns/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/campaigns/:id/start — ابدأ الإرسال (بيتحجز في الطابور) · POST /api/app/campaigns/:id/delete — المسوّدة بس */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)

  try {
    const res = action === 'start' ? await startCampaignAction(id) : action === 'delete' ? await deleteCampaignAction(id) : undefined
    if (res === undefined) return json({ ok: false, error: 'not_found' }, 404)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
