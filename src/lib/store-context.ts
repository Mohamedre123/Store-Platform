import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getCurrentUser, getMemberStoresFull, type SessionUser } from './auth'
import { stores } from '@/db/schema'
import type { Actor } from './permissions'

const ACTIVE_STORE_COOKIE = 'zawya_store'

export type ActiveStore = typeof stores.$inferSelect & { role: string; permissions: string[] }

export type DashboardContext = {
  user: SessionUser
  store: ActiveStore
  /**
   * صلاحيات المستخدم في المتجر ده.
   *
   * مطلعة من السياق لا محسوبة في كل شاشة: الصفحة بتنادي `guard()`
   * والفعل بينادي `assertCan()` وكلاهما بياخد نفس الكائن — فمفيش
   * شاشة بتقول «مفتوح» وفعل بيقول «مقفول».
   */
  actor: Actor
}

/**
 * سياق لوحة التحكم: المستخدم + المتجر النشط، بعد التأكد من العضوية.
 *
 * هذه هي البوابة الوحيدة لبيانات المتجر في اللوحة. أي صفحة تقرأ
 * بيانات لازم تمر من هنا وتستخدم `store.id` في الفلترة — مفيش
 * استثناءات، لأن ده الحاجز الوحيد ضد تسريب بيانات متجر لمتجر تاني.
 */
export const getDashboardContext = cache(async (): Promise<DashboardContext> => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // لا دخول للوحة قبل تأكيد البريد — الحساب بيمسك متجرًا وفلوس عملاء
  if (!user.emailVerifiedAt) redirect('/verify')

  // استعلام واحد بيرجّع كل متاجر المستخدم كاملة + دوره، فبنختار النشط من
  // الكوكي في الذاكرة — من غير رحلة تانية للخادم زي ما كان قبل كده.
  const memberships = await getMemberStoresFull(user.id)
  if (memberships.length === 0) redirect('/signup')

  const jar = await cookies()
  const requested = jar.get(ACTIVE_STORE_COOKIE)?.value
  const chosen = memberships.find((m) => m.id === requested) ?? memberships[0]

  return {
    user,
    store: chosen,
    actor: { role: chosen.role, permissions: chosen.permissions },
  }
})

/** المتجر النشط فقط — اختصار للصفحات اللي مش محتاجة بيانات المستخدم */
export async function getActiveStore(): Promise<ActiveStore> {
  const { store } = await getDashboardContext()
  return store
}

/**
 * بوابة لوحة إدارة المنصة.
 *
 * **بترجّع 404 لا 403.** الرد بـ«ممنوع» بيأكّد إن المسار موجود، فأي
 * حد بيجرّب يعرف إن في لوحة إدارة ويفضل يحاول. «مش موجود» بيخلّي
 * المسار غير مميّز عن أي مسار غلط.
 */
export const requirePlatformAdmin = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.isPlatformAdmin) notFound()
  return user
})

/** يتأكد أن الدور يسمح بإجراء حسّاس (حذف، فوترة، صلاحيات) */
export function assertRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new Error('ماعندكش صلاحية للإجراء ده')
  }
}
