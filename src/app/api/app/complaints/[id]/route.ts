import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json } from '@/lib/app-api'
import { complaintThreadPayload } from '@/lib/app-complaints'

export const dynamic = 'force-dynamic'

/** GET /api/app/complaints/:id — رسايل شكوى واحدة (بتتحمّل عند الفتح بس، زي اللوحة) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!isRecordId(id)) return json({ error: 'not_found' }, 404)
  return json(await complaintThreadPayload(ctx, id))
}
