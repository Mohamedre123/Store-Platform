import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { savePostAction } from '@/app/dashboard/blog/actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * POST /api/app/blog/save — مقال جديد أو تعديله.
 *
 * `{ id?, title, slug, excerpt, content, cover, author, isPublished }` — نفس `PostInput` في فورم اللوحة
 * (الرابط بيتولّد من العنوان لو فاضي).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const cover = str(body.cover, 1000)

  const res = await savePostAction({
    id: str(body.id, 64) || undefined,
    title: str(body.title, 200),
    slug: str(body.slug, 200),
    excerpt: str(body.excerpt, 1000),
    content: str(body.content, 100_000),
    cover: /^https?:\/\//.test(cover) ? cover : null,
    author: str(body.author, 100),
    isPublished: body.isPublished === true,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, slug: res?.slug ?? null })
}
