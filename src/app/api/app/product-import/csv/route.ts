import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { importProductsAction } from '@/app/dashboard/products/import/actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/app/product-import/csv — `{ rows }` الصفوف الجاهزة من `/preview` (لحد ١٠٠٠ — الفعل بيتحقق من كل صف ويدخّلهم مسوّدات) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await importProductsAction(body)
    if (!res || 'error' in res) return json({ ok: false, error: res?.error ?? 'حصلت مشكلة' }, 400)
    return json({ ok: true, created: res.created, skipped: res.skipped, categories: res.categories })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
