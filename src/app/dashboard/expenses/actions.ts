'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { expenses } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type ExpenseState = { ok?: boolean; error?: string; id?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, 'اكتب المصروف على إيه').max(120),
  category: z.enum(['ads', 'goods', 'shipping', 'salaries', 'packaging', 'rent', 'fees', 'other']),
  /** بالقرش زي كل مبالغ المنصة */
  amount: z.coerce.number().int().min(1, 'اكتب المبلغ').max(1_000_000_000),
  /**
   * تاريخ الصرف — `YYYY-MM-DD` من خانة التاريخ في المتصفح.
   *
   * بيتحوّل لمنتصف اليوم لا لأوّله: التاريخ الجاي بلا وقت بيتقرا
   * كـUTC، فمتجر في القاهرة (UTC+2 أو +3) كان بيلاقي مصروف يوم
   * ١ سبتمبر محسوب في ٣١ أغسطس في تقريره — والفرق بيظهر في تقرير
   * آخر الشهر بالذات، وهو أهم تقرير عنده.
   */
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ مش مظبوط'),
  note: z.string().trim().max(500).nullish(),
  isRecurring: z.boolean().default(false),
})

function dayToDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`)
}

export async function saveExpenseAction(raw: unknown): Promise<ExpenseState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  const values = {
    title: input.title,
    category: input.category,
    amount: input.amount,
    spentAt: dayToDate(input.spentAt),
    note: input.note?.trim() || null,
    isRecurring: input.isRecurring,
  }

  if (input.id) {
    const updated = await db
      .update(expenses)
      .set(values)
      .where(and(eq(expenses.id, input.id), eq(expenses.storeId, store.id)))
      .returning({ id: expenses.id })

    if (!updated.length) return { error: 'المصروف مش موجود' }
    revalidatePath('/dashboard/expenses')
    revalidatePath('/dashboard/analytics')
    return { ok: true, id: updated[0].id }
  }

  const [created] = await db
    .insert(expenses)
    .values({ storeId: store.id, createdBy: user.id, ...values })
    .returning({ id: expenses.id })

  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/analytics')
  return { ok: true, id: created.id }
}

/**
 * حذف مصروف — حذف فعلي لا ناعم.
 *
 * المصروف مدخل بشري بلا مراجع تانية: مفيش طلب ولا شحنة معلّقة بيه.
 * الحذف الناعم هنا كان هيسيب صفوفًا لازم تتفلتر في كل استعلام ربح،
 * وأول استعلام ينسى الفلتر بيدّي رقمًا غلط في أهم شاشة.
 */
export async function deleteExpenseAction(id: string): Promise<ExpenseState> {
  const { store } = await getDashboardContext()

  const deleted = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.storeId, store.id)))
    .returning({ id: expenses.id })

  if (!deleted.length) return { error: 'المصروف مش موجود' }

  revalidatePath('/dashboard/expenses')
  revalidatePath('/dashboard/analytics')
  return { ok: true }
}
