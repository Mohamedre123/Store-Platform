import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { productDetailPayload } from '@/lib/app-products'
import { loadProductVariants } from '@/lib/variants'
import { fromMinorUnits } from '@/lib/utils'
import { saveProductAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

const isRedirect = (e: unknown) =>
  typeof (e as { digest?: unknown } | null)?.digest === 'string' &&
  (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')

const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const digits = (v: unknown) =>
  str(v, 30)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
const amount = (minor: number | null) => (minor === null || minor === undefined ? '' : String(fromMinorUnits(minor)))

async function findProduct(storeId: string, id: string) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt)))
    .limit(1)
  return row ?? null
}

/**
 * GET /api/app/products/:id/edit — بيانات فورم «تعديل المنتج» في التطبيق.
 *
 * المبالغ نصوص بالجنيه (زي خانات فورم اللوحة)، والوصف نص زي ما اتكتب.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ error: 'not_found' }, 404)
  const p = await findProduct(ctx.store.id, id)
  if (!p) return json({ error: 'not_found' }, 404)

  const variants = await loadProductVariants(p.id)

  return json({
    currency: ctx.store.currency,
    hasVariants: variants.options.length > 0,
    product: {
      id: p.id,
      name: p.name,
      price: amount(p.price),
      compareAtPrice: amount(p.compareAtPrice),
      stock: String(p.stock),
      trackInventory: p.trackInventory,
      categoryId: p.categoryId ?? '',
      description: p.description ?? '',
      status: p.status === 'active' ? 'active' : 'draft',
      images: p.images,
    },
  })
}

/**
 * POST /api/app/products/:id/edit — حفظ التعديل من التطبيق.
 *
 * ## كل اللي التطبيق ما بيعدّلوش بيتبعت زي ما هو
 * `saveProductAction` بيكتب المنتج كله من الفورم: أي خانة ناقصة بتتمسح
 * (التكلفة، الكود، الماركة، السيو، المقترحات — والمقاسات والألوان كلها
 * لو خانة `variants` فاضية). فبنقرا المنتج ومتغيّراته من القاعدة ونعبّي
 * الفورم بيهم، وبعدين نغيّر بس الخانات اللي التاجر عدّلها من موبايله.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const p = await findProduct(ctx.store.id, id)
  if (!p) return json({ ok: false, error: 'المنتج مش موجود' }, 404)

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ ok: false, error: 'بيانات ناقصة' }, 400)

  const saved = await loadProductVariants(p.id)
  const hasVariants = saved.options.length > 0

  const images = Array.isArray(body.images)
    ? body.images.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10)
    : p.images

  const form = new FormData()
  form.set('id', p.id)
  form.set('name', str(body.name, 200))
  form.set('price', digits(body.price))
  if (digits(body.compareAtPrice)) form.set('compareAtPrice', digits(body.compareAtPrice))
  const track = body.trackInventory === false ? false : true
  form.set('trackInventory', String(track))
  /* المنتج اللي ليه مقاسات مخزونه في التركيبات — الكمية العامة بتفضل زي ما هي */
  const stock = hasVariants ? String(p.stock) : digits(body.stock)
  if (stock) form.set('stock', stock)
  if (str(body.categoryId, 64)) form.set('categoryId', str(body.categoryId, 64))
  if (str(body.description)) form.set('description', str(body.description))
  form.set('status', body.status === 'active' ? 'active' : 'draft')
  form.set('images', JSON.stringify(images))

  /* اللي مالوش خانة في التطبيق */
  if (p.costPrice !== null) form.set('costPrice', amount(p.costPrice))
  if (p.sku) form.set('sku', p.sku)
  if (p.brand) form.set('brand', p.brand)
  if (p.seoTitle) form.set('seoTitle', p.seoTitle)
  if (p.seoDescription) form.set('seoDescription', p.seoDescription)
  form.set('relatedProductIds', (p.relatedProductIds ?? []).join(','))
  form.set('upsellProductIds', (p.upsellProductIds ?? []).join(','))
  form.set(
    'variants',
    JSON.stringify({
      options: saved.options.map((o) => ({
        name: o.name,
        displayAs: o.displayAs,
        values: o.values.map((v) => ({ value: v.value, hex: v.hex })),
      })),
      variants: saved.variants.map((v) => ({
        values: v.values,
        price: v.price,
        stock: v.stock,
        sku: v.sku,
        isActive: v.isActive,
      })),
    }),
  )

  try {
    const res = (await saveProductAction(null, form)) as { error?: string; fieldErrors?: Record<string, string> } | null
    const first = res?.fieldErrors ? Object.values(res.fieldErrors)[0] : null
    if (first || res?.error) return json({ ok: false, error: first ?? res?.error }, 400)
  } catch (e) {
    if (!isRedirect(e)) throw e
  }

  return json({ ok: true, detail: await productDetailPayload(ctx.store, p.id) })
}
