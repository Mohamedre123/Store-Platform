import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadSessions } from '@/lib/sessions-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/sessions — الأجهزة الداخلة على حساب المستخدم (نفس «الأجهزة والجلسات») */
export async function GET() {
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx
  return json({ sessions: await loadSessions(ctx.user.id) })
}
