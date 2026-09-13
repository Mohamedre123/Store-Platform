import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveExpenseAction } from '@/app/dashboard/expenses/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/expenses/save — تسجيل مصروف أو تعديله.
 *
 * `{ id?, title, category, amount, spentAt, note, isRecurring }` — المبلغ بالجنيه
 * زي خانة اللوحة، والتاريخ `YYYY-MM-DD`.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('finance.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const amountText = String(body.amount ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
  const amount = Math.round(Number(amountText || 0) * 100)

  const res = await saveExpenseAction({
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    title: body.title,
    category: body.category,
    amount: Number.isFinite(amount) ? amount : 0,
    spentAt: body.spentAt,
    note: typeof body.note === 'string' ? body.note : null,
    isRecurring: body.isRecurring === true,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, id: res?.id ?? null })
}
