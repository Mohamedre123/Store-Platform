import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { postsPayload } from '@/lib/app-posts'

export const dynamic = 'force-dynamic'

/** GET /api/app/posts — بوستات استوديو المحتوى والحسابات المربوطة (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await postsPayload(ctx.store.id))
}
