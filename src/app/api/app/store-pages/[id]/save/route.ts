import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { savePageAction } from '@/app/dashboard/settings/pages/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/store-pages/:id/save — `{ title, content, showInFooter }` (الفاضية بتتخفي من المتجر) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  try {
    const res = await savePageAction({
      id,
      title: typeof body.title === 'string' ? body.title.slice(0, 120) : '',
      content: typeof body.content === 'string' ? body.content.slice(0, 20000) : '',
      showInFooter: body.showInFooter === true,
    })
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
