'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { experiments, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type ExperimentState = { ok?: boolean; error?: string } | null

const schema = z.object({
  name: z.string().trim().min(2, 'اكتب اسم التجربة').max(60),
  productId: z.string().uuid('اختار المنتج'),
  field: z.enum(['price', 'title']),
  /** السعر بالجنيه من الواجهة، أو نص للعنوان */
  valueA: z.string().trim().min(1, 'اكتب قيمة النسخة أ'),
  valueB: z.string().trim().min(1, 'اكتب قيمة النسخة ب'),
  splitPercent: z.coerce.number().int().min(10).max(90).optional(),
})

/**
 * إنشاء تجربة.
 *
 * تجربة واحدة شغّالة لكل منتج: لو اتنين اشتغلوا على نفس المنتج، مفيش
 * طريقة تعرف بيها أي تغيير سبب النتيجة — وده يخلّي التجربتين بلا قيمة.
 */
export async function createExperimentAction(raw: unknown): Promise<ExperimentState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store } = await getDashboardContext()

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.storeId, store.id)))
    .limit(1)

  if (!product) return { error: 'المنتج مش موجود' }

  const [running] = await db
    .select({ id: experiments.id })
    .from(experiments)
    .where(
      and(
        eq(experiments.storeId, store.id),
        eq(experiments.targetId, input.productId),
        eq(experiments.status, 'running'),
      ),
    )
    .limit(1)

  if (running) return { error: 'فيه تجربة شغّالة على المنتج ده — أوقفها الأول' }

  // السعر بالقرش زي كل فلوس المشروع؛ العنوان نص زي ما هو
  const toValue = (v: string) =>
    input.field === 'price' ? { value: Math.round(Number(v) * 100) } : { value: v }

  if (input.field === 'price') {
    const a = Number(input.valueA)
    const b = Number(input.valueB)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      return { error: 'السعرين لازم يكونوا أرقامًا أكبر من صفر' }
    }
    if (Math.round(a * 100) === Math.round(b * 100)) {
      return { error: 'السعرين واحد — مفيش حاجة تتقارن' }
    }
  }

  await db.insert(experiments).values({
    storeId: store.id,
    name: input.name,
    target: 'product',
    targetId: input.productId,
    field: input.field,
    variantA: toValue(input.valueA),
    variantB: toValue(input.valueB),
    splitBps: Math.round((input.splitPercent ?? 50) * 100),
    status: 'running',
    startedAt: new Date(),
  })

  revalidatePath('/dashboard/experiments')
  return { ok: true }
}

/**
 * إيقاف التجربة وتثبيت الفايز.
 *
 * `apply` بيكتب النسخة الفايزة على المنتج فعلًا. من غيره التاجر
 * بيشوف النتيجة ويفضل ينساها — التجربة اللي مش بتغيّر حاجة مضيعة وقت.
 */
export async function finishExperimentAction(
  id: string,
  winner: 'a' | 'b' | null,
  apply: boolean,
): Promise<ExperimentState> {
  const { store } = await getDashboardContext()

  const [exp] = await db
    .select({
      id: experiments.id,
      targetId: experiments.targetId,
      field: experiments.field,
      variantA: experiments.variantA,
      variantB: experiments.variantB,
    })
    .from(experiments)
    .where(and(eq(experiments.id, id), eq(experiments.storeId, store.id)))
    .limit(1)

  if (!exp) return { error: 'التجربة مش موجودة' }

  await db
    .update(experiments)
    .set({ status: 'finished', winner, endedAt: new Date() })
    .where(eq(experiments.id, id))

  if (apply && winner) {
    const value = (winner === 'a' ? exp.variantA : exp.variantB)?.value

    if (exp.field === 'price' && typeof value === 'number' && value > 0) {
      await db
        .update(products)
        .set({ price: value })
        .where(and(eq(products.id, exp.targetId), eq(products.storeId, store.id)))
    } else if (exp.field === 'title' && typeof value === 'string' && value.trim()) {
      await db
        .update(products)
        .set({ name: value.trim() })
        .where(and(eq(products.id, exp.targetId), eq(products.storeId, store.id)))
    }
  }

  revalidatePath('/dashboard/experiments')
  revalidatePath('/dashboard/products')
  return { ok: true }
}

export async function deleteExperimentAction(id: string): Promise<ExperimentState> {
  const { store } = await getDashboardContext()

  const deleted = await db
    .delete(experiments)
    .where(
      and(
        eq(experiments.id, id),
        eq(experiments.storeId, store.id),
        // التجربة الشغّالة ما تتحذفش وهي بتغيّر أسعار على عملاء دلوقتي
        ne(experiments.status, 'running'),
      ),
    )
    .returning({ id: experiments.id })

  if (!deleted.length) return { error: 'أوقف التجربة الأول قبل ما تحذفها' }

  revalidatePath('/dashboard/experiments')
  return { ok: true }
}
