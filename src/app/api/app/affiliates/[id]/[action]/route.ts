import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteAffiliateAction, payAffiliateAction } from '@/app/dashboard/affiliates/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/affiliates/:id/{pay|delete}
 *
 * - pay: سجّل صرف الرصيد المستحق (العمولات المعتمَدة بتبقى مدفوعة)
 * - delete: حذف المسوّق
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  let res: { error?: string } | null
  if (action === 'pay') res = await payAffiliateAction(id)
  else if (action === 'delete') res = await deleteAffiliateAction(id)
  else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
