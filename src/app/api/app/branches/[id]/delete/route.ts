import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { deleteBranchAction } from '@/app/dashboard/inventory/branch-actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/branches/:id/delete — الفرع الافتراضي ما بيتمسحش (الفعل بيرفضه) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)
  try {
    const res = await deleteBranchAction(id)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
