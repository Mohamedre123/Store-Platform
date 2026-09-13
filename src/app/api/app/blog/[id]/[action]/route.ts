import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deletePostAction, togglePostAction } from '@/app/dashboard/blog/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/blog/:id/{toggle|delete}
 *
 * - toggle: `{ isPublished }` نشر المقال أو إخفاؤه
 * - delete: حذف المقال
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  if (action === 'toggle') {
    const body = (await req.json().catch(() => ({}))) as { isPublished?: unknown }
    await togglePostAction(id, body.isPublished === true)
  } else if (action === 'delete') {
    await deletePostAction(id)
  } else return json({ ok: false, error: 'not_found' }, 404)

  return json({ ok: true })
}
