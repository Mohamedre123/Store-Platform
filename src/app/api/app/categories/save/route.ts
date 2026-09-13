import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveCategoryAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

/* فعل اللوحة بيخلص بـ`redirect()` — الاستثناء ده معناه «اتحفظ» */
const isRedirect = (e: unknown) =>
  typeof (e as { digest?: unknown } | null)?.digest === 'string' &&
  (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * POST /api/app/categories/save — `{ id?, name, description, image, parentId, isActive }`
 *
 * بينادي `saveCategoryAction` بنفس خانات فورم اللوحة (كلها بتتبعت — الفعل بيكتب القسم كله).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const image = str(body.image, 1000)

  const form = new FormData()
  if (str(body.id, 64)) form.set('id', str(body.id, 64))
  form.set('name', str(body.name, 120))
  form.set('description', str(body.description, 2000))
  form.set('image', /^https?:\/\//.test(image) ? image : '')
  form.set('parentId', str(body.parentId, 64))
  form.set('isActive', body.isActive === false ? 'false' : 'true')

  try {
    const res = (await saveCategoryAction(null, form)) as { error?: string; fieldErrors?: Record<string, string> } | null
    const first = res?.fieldErrors ? Object.values(res.fieldErrors)[0] : null
    if (first || res?.error) return json({ ok: false, error: first ?? res?.error }, 400)
  } catch (e) {
    if (!isRedirect(e)) throw e
  }
  return json({ ok: true })
}
