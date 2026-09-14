import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteBannerAction, toggleBannerAction } from '@/app/dashboard/storefront/banners/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/banners/:id/{toggle|delete}
 *
 * - toggle: `{ isActive }`
 * - delete: حذف البانر
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  if (action === 'toggle') {
    const body = (await req.json().catch(() => ({}))) as { isActive?: unknown }
    await toggleBannerAction(id, body.isActive === true)
  } else if (action === 'delete') {
    await deleteBannerAction(id)
  } else return json({ ok: false, error: 'not_found' }, 404)

  return json({ ok: true })
}
