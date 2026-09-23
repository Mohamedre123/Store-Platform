import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadAccount } from '@/lib/account-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/account — حساب التاجر نفسه ومتاجره (من غير صلاحية — زي صفحة «حسابي»، الموظف كمان بيغيّر بياناته) */
export async function GET() {
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx
  return json(await loadAccount(ctx.user))
}
