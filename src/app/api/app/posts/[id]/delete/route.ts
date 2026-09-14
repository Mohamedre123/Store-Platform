import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deletePostAction } from '@/app/dashboard/studio/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/posts/:id/delete — حذف بوست من القايمة (اللي اتنشر على الصفحات بيفضل هناك) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  try {
    await deletePostAction(id)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'مقدرناش نحذف' }, 400)
  }
}
