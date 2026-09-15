import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { emailDiagnosticsAction } from '@/app/dashboard/settings/email/actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET /api/app/email — المرسِل والرد وسجلات DNS (نفس `emailDiagnosticsAction` اللي صفحة اللوحة بتعرضه) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await emailDiagnosticsAction())
}
