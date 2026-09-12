import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { orderDetailPayload } from '@/lib/app-orders'
import { addOrderNoteAction } from '@/app/dashboard/orders/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/orders/:id/note — ملاحظة داخلية على الطلب (فعل اللوحة نفسه) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  const body = (await req.json().catch(() => null)) as { note?: unknown } | null
  const note = typeof body?.note === 'string' ? body.note.slice(0, 2000) : ''
  if (!note.trim()) return json({ ok: false, error: 'اكتب الملاحظة الأول' }, 400)

  /* الفعل بيكتب بـ`store.id` من الجلسة — طلب متجر تاني ما بيتلمسش */
  const detail = await orderDetailPayload(ctx.store, id)
  if (!detail) return json({ ok: false, error: 'not_found' }, 404)

  await addOrderNoteAction(id, note)
  return json({ ok: true, detail: await orderDetailPayload(ctx.store, id) })
}
