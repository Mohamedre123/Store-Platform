import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { isValidSlug } from '@/lib/domain'

export const dynamic = 'force-dynamic'

/** فحص توفّر النطاق الفرعي قبل الإرسال — أفضل من رسالة خطأ بعد التسجيل */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug')?.trim().toLowerCase() ?? ''

  if (!slug) {
    return NextResponse.json({ available: false, reason: 'empty' })
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }

  const [taken] = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, slug)).limit(1)

  return NextResponse.json(
    { available: !taken, reason: taken ? 'taken' : null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
