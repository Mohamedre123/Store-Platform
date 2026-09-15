import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadDomain } from '@/lib/domain-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/domain — النطاق المخصص وسجلات الـDNS وحالته (نفس صفحة اللوحة — من غير تفاصيل إعداد المنصة) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  const d = await loadDomain(ctx.store)
  return json({
    currentHost: d.currentHost,
    domain: d.domain,
    verified: d.verified,
    records: d.records,
    locked: d.locked,
    linkReady: d.link.ok,
  })
}
