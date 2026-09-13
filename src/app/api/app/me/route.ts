import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { publicStoreUrl } from '@/lib/domain'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/me — مين فاتح التطبيق وصلاحياته.
 *
 * قايمة «المزيد» الأصلية في التطبيق بتخفي الأقسام اللي الموظف مالوش
 * صلاحية فيها — نفس اللي القايمة الجانبية في اللوحة بتعمله بالظبط.
 * الإخفاء راحة مش حماية: كل صفحة وكل مسار بيتحقق من الصلاحية بنفسه.
 */
export async function GET() {
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const { user, store } = ctx
  return json({
    user: { name: user.name, email: user.email, isPlatformAdmin: user.isPlatformAdmin },
    store: { name: store.name, slug: store.slug, logo: store.logoLight, url: publicStoreUrl(store) },
    role: store.role,
    permissions: store.permissions,
  })
}
