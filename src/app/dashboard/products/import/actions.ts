'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { importProducts } from '@/lib/product-import'
import type { ImportRow } from '@/lib/product-csv'
import { recordAudit } from '@/lib/audit'

export type ImportState =
  | { ok: true; created: number; skipped: number; categories: number }
  | { error: string }
  | null

/**
 * الصفوف بتتحوّل في المتصفح وبتتبعت جاهزة.
 *
 * ## ليه القراءة في المتصفح والكتابة على الخادم
 * الملف ممكن يكون ٥ ميجا. رفعه للخادم عشان نقراه معناه رفعة كاملة
 * قبل ما التاجر يشوف حاجة، وتاني رفعة لو غيّر ربط الأعمدة. القراءة
 * في المتصفح بتخلّي المعاينة فورية، والخادم بياخد الصفوف النهائية بس.
 *
 * ## والتحقّق بيتكرر هنا
 * اللي جاي من المتصفح مُدخل غير موثوق مهما كانت الشاشة عملت إيه.
 * السعر بيتفحص إنه رقم موجب، والحدود بتتقصّ، والصور لازم تكون
 * روابط — نفس الفحوص اللي في المتصفح، بس دي اللي بتحمي.
 */
const rowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullish(),
  price: z.coerce.number().int().min(1).max(1_000_000_000),
  compareAtPrice: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
  costPrice: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
  sku: z.string().trim().max(80).nullish(),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  category: z.string().trim().max(80).nullish(),
  brand: z.string().trim().max(60).nullish(),
  image: z.string().trim().url().max(600).nullish().catch(null),
})

const schema = z.object({
  /*
    ألف صف في المرة الواحدة.

    الحد ده مش تعسّف: الاستيراد بيمشي في طلب واحد، والملف الأكبر
    بيضرب مهلة الدالة ويسيب نص المنتجات داخلين — والتاجر مش عارف
    وقف فين. الملف الأكبر بيتقسّم، والرسالة بتقول له كده.
  */
  rows: z.array(rowSchema).min(1, 'مفيش صفوف صالحة في الملف').max(1000),
})

export async function importProductsAction(raw: unknown): Promise<ImportState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    if (issue?.code === 'too_big') {
      return { error: 'الملف أكبر من ١٠٠٠ منتج. قسّمه لملفات أصغر واستورد واحدًا واحدًا.' }
    }
    return { error: issue?.message ?? 'فيه صف بيانات مش مظبوطة' }
  }

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'products.manage')

  const items = parsed.data.rows.map(
    (r): ImportRow => ({
      name: r.name,
      description: r.description ?? null,
      price: r.price,
      compareAtPrice: r.compareAtPrice ?? null,
      costPrice: r.costPrice ?? null,
      sku: r.sku ?? null,
      stock: r.stock,
      category: r.category ?? null,
      brand: r.brand ?? null,
      image: r.image ?? null,
    }),
  )

  const result = await importProducts(store.id, items)

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'product_import',
    after: { created: result.created, skipped: result.skipped, categories: result.categories },
  })

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard/products/categories')
  return { ok: true, ...result }
}
