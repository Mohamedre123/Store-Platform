'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { importProducts } from '@/lib/product-import'
import { fetchCatalog } from '@/lib/integrations/catalog-import'
import { recordAudit } from '@/lib/audit'

export type ApiImportState =
  | { ok: true; created: number; skipped: number; categories: number; fetched: number }
  | { error: string }
  | null

/**
 * استيراد الكتالوج من منصة تانية بمفاتيح التاجر.
 *
 * ## المفاتيح ما بتتخزّنش
 * بتوصل مع الطلب، بتتستعمل مرة، وبتتنسى. الاستيراد بيحصل مرة —
 * وتخزين مفتاح شوبيفاي بعد ما نستعمله معناه إننا ماسكين وصولًا
 * لكتالوج التاجر على منصة تانية للأبد بلا أي سبب.
 *
 * ولنفس السبب مفيش أي أثر ليها في `audit`: السجل بيتكتب فيه عدد
 * اللي اتستورد، لا المفتاح اللي جابه.
 *
 * ## والجلب والكتابة في فعل واحد
 * الفصل كان معناه إن الصفوف تروح للمتصفح وترجع — يعني ألف منتج
 * بيعدّوا رحلتين زيادة، وكل واحدة فرصة إن المتصفح يعدّل فيهم قبل
 * ما نكتب. الملف بيمرّ بالمتصفح لأن التاجر بيراجع ربط الأعمدة؛
 * هنا مفيش حاجة يراجعها.
 */

const schema = z.object({
  source: z.enum(['shopify', 'woocommerce']),
  /*
    المفاتيح كأزواج نص — كل منصة وحقولها، والفحص الفعلي بيحصل في
    المستورد نفسه اللي عارف كل منصة بتطلب إيه.
  */
  credentials: z.record(z.string(), z.string().trim().max(500)),
})

export async function importFromApiAction(raw: unknown): Promise<ApiImportState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'products.manage')

  const fetched = await fetchCatalog(parsed.data.source, parsed.data.credentials)
  if (!fetched.ok) return { error: fetched.error }

  if (fetched.items.length === 0) {
    return {
      error:
        'الاتصال نجح بس ما لقيتش منتجات منشورة. اتأكد إن عندك منتجات منشورة على المنصة التانية.',
    }
  }

  const result = await importProducts(store.id, fetched.items)

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'product_import',
    /* المصدر والعدد بس — المفاتيح ما بتتسجّلش */
    after: {
      source: parsed.data.source,
      fetched: fetched.total,
      created: result.created,
      skipped: result.skipped,
    },
  })

  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard/products/categories')
  return { ok: true, ...result, fetched: fetched.total }
}
