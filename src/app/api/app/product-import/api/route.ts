import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { importFromApiAction } from '@/app/dashboard/products/import/api-actions'

export const dynamic = 'force-dynamic'
/* جلب كتالوج كامل من منصة تانية بياخد وقت */
export const maxDuration = 300

/**
 * POST /api/app/product-import/api — `{ source, credentials }` استيراد من شوبيفاي/ووكومرس/إيزي أوردرز.
 * المفاتيح بتتستعمل مرة وبتتنسى (نفس `importFromApiAction`) — ما بتتخزّنش ولا بتتسجّل.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await importFromApiAction(body)
    if (!res || 'error' in res) return json({ ok: false, error: res?.error ?? 'حصلت مشكلة' }, 400)
    return json({ ok: true, created: res.created, skipped: res.skipped, categories: res.categories, fetched: res.fetched })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
