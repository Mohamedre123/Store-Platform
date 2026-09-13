import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveProductAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

/*
  فعل اللوحة بيخلص بـ`redirect()` لقايمة المنتجات — وده بيترمي كاستثناء
  خاص من Next. هنا الاستثناء ده معناه «اتحفظ».
*/
const isRedirect = (e: unknown) =>
  typeof (e as { digest?: unknown } | null)?.digest === 'string' &&
  (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')

const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const digits = (v: unknown) =>
  str(v, 30)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')

/**
 * POST /api/app/products/new — إضافة منتج من التطبيق (بالصور من الكاميرا).
 *
 * بينادي `saveProductAction` نفسه اللي فورم اللوحة بيناديه — نفس التحقق،
 * ونفس الرابط، ونفس قيد المخزون الأول. التطبيق بيبعت الحقول الأساسية بس؛
 * المقاسات والألوان والسيو من صفحة المنتج الكاملة.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ ok: false, error: 'بيانات ناقصة' }, 400)

  const images = Array.isArray(body.images)
    ? body.images.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10)
    : []

  const form = new FormData()
  form.set('name', str(body.name, 200))
  form.set('price', digits(body.price))
  if (digits(body.compareAtPrice)) form.set('compareAtPrice', digits(body.compareAtPrice))
  if (digits(body.stock)) form.set('stock', digits(body.stock))
  form.set('trackInventory', body.trackInventory === false ? 'false' : 'true')
  if (str(body.categoryId, 64)) form.set('categoryId', str(body.categoryId, 64))
  if (str(body.description)) form.set('description', str(body.description))
  form.set('status', body.status === 'active' ? 'active' : 'draft')
  form.set('images', JSON.stringify(images))

  try {
    const res = (await saveProductAction(null, form)) as { error?: string; fieldErrors?: Record<string, string> } | null
    const first = res?.fieldErrors ? Object.values(res.fieldErrors)[0] : null
    if (first || res?.error) return json({ ok: false, error: first ?? res?.error }, 400)
  } catch (e) {
    if (isRedirect(e)) return json({ ok: true })
    throw e
  }
  return json({ ok: true })
}
