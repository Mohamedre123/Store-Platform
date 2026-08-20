import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { experiments } from '@/db/schema'
import { assignBucket } from './experiments-meta'
import type { ExperimentField } from './experiments-meta'

/**
 * تجارب A/B على صفحة المنتج.
 *
 * التاجر بيسأل «أنزّل السعر ولا أرفعه؟» وبيجاوب بالإحساس. التجربة
 * بتخلّي السوق يجاوب: نص الزوّار يشوفوا سعرًا والنص التاني سعرًا
 * تاني، وبعد أسبوع الأرقام تقول.
 *
 * ثلاث قواعد بتحكم التنفيذ:
 *
 * 1. **التوزيع ثابت لكل زائر.** لو العميل شاف ٤٩٠ وبعدين رجع لقى
 *    ٥٥٠، هيحس إن المتجر بيغيّر أسعاره وراه ويسيبه. عشان كده
 *    المجموعة بتتحدد من جلسته بدالة ثابتة لا بعشوائية كل مرة.
 * 2. **السعر المعروض هو السعر اللي بيتحاسب.** التجربة بتغيّر مصدر
 *    السعر في التسعير نفسه — مش بس الشكل. عرض سعر ومحاسبة تانية
 *    نصب، مش تجربة.
 * 3. **العدّادات بتتزوّد في SQL** لا بقراءة وكتابة: زائرين في نفس
 *    اللحظة كانوا هيدوسوا على بعض ونفقد نص المشاهدات.
 */

// الثوابت والحسابات في experiments-meta عشان المتصفح يقدر يستوردها
export { assignBucket, FIELD_LABELS, MIN_VIEWS, readResult } from './experiments-meta'
export type { ExperimentField } from './experiments-meta'

export type ActiveExperiment = {
  id: string
  field: ExperimentField
  variantA: Record<string, unknown>
  variantB: Record<string, unknown>
  splitBps: number
}

/** التجربة الشغّالة على منتج — واحدة بحد أقصى */
export async function getRunningExperiment(
  storeId: string,
  productId: string,
): Promise<ActiveExperiment | null> {
  const [row] = await db
    .select({
      id: experiments.id,
      field: experiments.field,
      variantA: experiments.variantA,
      variantB: experiments.variantB,
      splitBps: experiments.splitBps,
    })
    .from(experiments)
    .where(
      and(
        eq(experiments.storeId, storeId),
        eq(experiments.targetId, productId),
        eq(experiments.status, 'running'),
      ),
    )
    .limit(1)

  return row ?? null
}

/** قيمة الحقل حسب المجموعة — أو null لو التجربة مش على الحقل ده */
export function variantValue(
  exp: ActiveExperiment | null,
  bucket: 'a' | 'b',
  field: ExperimentField,
): unknown {
  if (!exp || exp.field !== field) return null
  const source = bucket === 'a' ? exp.variantA : exp.variantB
  return source?.value ?? null
}

export async function trackExperimentView(id: string, bucket: 'a' | 'b'): Promise<void> {
  try {
    await db
      .update(experiments)
      .set(
        bucket === 'a'
          ? { viewsA: sql`${experiments.viewsA} + 1` }
          : { viewsB: sql`${experiments.viewsB} + 1` },
      )
      .where(eq(experiments.id, id))
  } catch (e) {
    console.error('فشل تسجيل مشاهدة التجربة:', e)
  }
}

export async function trackExperimentOrder(
  id: string,
  bucket: 'a' | 'b',
  revenue: number,
): Promise<void> {
  try {
    await db
      .update(experiments)
      .set(
        bucket === 'a'
          ? {
              ordersA: sql`${experiments.ordersA} + 1`,
              revenueA: sql`${experiments.revenueA} + ${revenue}`,
            }
          : {
              ordersB: sql`${experiments.ordersB} + 1`,
              revenueB: sql`${experiments.revenueB} + ${revenue}`,
            },
      )
      .where(eq(experiments.id, id))
  } catch (e) {
    console.error('فشل تسجيل تحويل التجربة:', e)
  }
}

/**
 * تجارب السعر الشغّالة على مجموعة منتجات — استعلام واحد.
 * بيتنادى من التسعير، فلازم يفضل رخيص مهما كبرت السلة.
 */
export async function getRunningPriceExperiments(
  storeId: string,
  productIds: string[],
): Promise<Map<string, ActiveExperiment>> {
  if (productIds.length === 0) return new Map()

  const rows = await db
    .select({
      id: experiments.id,
      targetId: experiments.targetId,
      field: experiments.field,
      variantA: experiments.variantA,
      variantB: experiments.variantB,
      splitBps: experiments.splitBps,
    })
    .from(experiments)
    .where(
      and(
        eq(experiments.storeId, storeId),
        eq(experiments.status, 'running'),
        eq(experiments.field, 'price'),
        inArray(experiments.targetId, productIds),
      ),
    )

  return new Map(rows.map((r) => [r.targetId, r]))
}

/**
 * تقييد التحويلات بعد نجاح الطلب.
 *
 * المجموعة بتتحسب من نفس معرّف الزائر تاني بدل ما نمرّرها من صفحة
 * لصفحة: الدالة ثابتة، فالنتيجة واحدة — ولو مرّرناها كان أي تلاعب
 * في المتصفح يقيّد التحويل على المجموعة الغلط.
 */
export async function trackExperimentConversions(
  storeId: string,
  visitorId: string | null | undefined,
  lines: Array<{ productId: string; total: number }>,
): Promise<void> {
  if (!visitorId || lines.length === 0) return

  const map = await getRunningPriceExperiments(
    storeId,
    [...new Set(lines.map((l) => l.productId))],
  )
  if (map.size === 0) return

  /*
    الطلب الواحد بيتحسب تحويلة واحدة لكل تجربة حتى لو فيه أكتر من
    سطر لنفس المنتج — وإلا سلة فيها ٣ قطع تبان ٣ تحويلات ومعدّل
    التحويل يطلع أعلى من الحقيقة.
  */
  const byExperiment = new Map<string, { bucket: 'a' | 'b'; revenue: number }>()

  for (const line of lines) {
    const exp = map.get(line.productId)
    if (!exp) continue
    const bucket = assignBucket(visitorId, exp.splitBps)
    const current = byExperiment.get(exp.id)
    byExperiment.set(exp.id, {
      bucket,
      revenue: (current?.revenue ?? 0) + line.total,
    })
  }

  for (const [id, { bucket, revenue }] of byExperiment) {
    await trackExperimentOrder(id, bucket, revenue)
  }
}
