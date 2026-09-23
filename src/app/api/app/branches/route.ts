import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadBranchesPage } from '@/lib/branches-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/branches — الفروع وتوزيع المخزون عليها (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await loadBranchesPage(ctx.store.id))
}
