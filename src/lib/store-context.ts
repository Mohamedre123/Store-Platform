import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores, storeMembers } from '@/db/schema'
import { getCurrentUser, getUserStores, type SessionUser } from './auth'

const ACTIVE_STORE_COOKIE = 'zawya_store'

export type ActiveStore = typeof stores.$inferSelect & { role: string }

export type DashboardContext = {
  user: SessionUser
  store: ActiveStore
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

  const memberships = await getUserStores(user.id)
  if (memberships.length === 0) redirect('/signup')

  const jar = await cookies()
  const requested = jar.get(ACTIVE_STORE_COOKIE)?.value
  const chosen = memberships.find((m) => m.id === requested) ?? memberships[0]

  const rows = await db
    .select({ store: stores, role: storeMembers.role })
    .from(stores)
    .innerJoin(
      storeMembers,
      and(eq(storeMembers.storeId, stores.id), eq(storeMembers.userId, user.id)),
    )
    .where(eq(stores.id, chosen.id))
    .limit(1)

  const row = rows[0]
  if (!row) redirect('/login')

  return { user, store: { ...row.store, role: row.role } }
})

/** المتجر النشط فقط — اختصار للصفحات اللي مش محتاجة بيانات المستخدم */
export async function getActiveStore(): Promise<ActiveStore> {
  const { store } = await getDashboardContext()
  return store
}

/** يتأكد أن الدور يسمح بإجراء حسّاس (حذف، فوترة، صلاحيات) */
export function assertRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new Error('ماعندكش صلاحية للإجراء ده')
  }
}
