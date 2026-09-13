import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { expensesPayload } from '@/lib/app-expenses'

export const dynamic = 'force-dynamic'

/** GET /api/app/expenses — المصروفات والربح في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('finance.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await expensesPayload(ctx.store))
}
