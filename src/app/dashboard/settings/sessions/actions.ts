'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { sessions } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { hashToken } from '@/lib/crypto'

export type SessionState = { ok?: boolean; error?: string; closed?: number } | null

const SESSION_COOKIE = 'zawya_session'

/**
 * إنهاء جلسة.
 *
 * ## المستخدم بيقفل جلساته هو بس
 * التصفية بـ`userId` مش تفصيلة: من غيرها معرّف جلسة متبعوت من
 * المتصفح يقدر يخرّج أي حد من المنصة كلها.
 */
export async function revokeSessionAction(id: string): Promise<SessionState> {
  const { user } = await getDashboardContext()

  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id })

  if (!deleted.length) return { error: 'الجلسة مش موجودة' }

  revalidatePath('/dashboard/settings/sessions')
  return { ok: true }
}

/**
 * إنهاء كل الجلسات التانية.
 *
 * ## الجلسة الحالية بتفضل
 * لو قفلناها معاهم، التاجر اللي شاكّ إن حد داخل على حسابه بيتخرّج
 * هو كمان ويرجع يسجّل — وفي اللحظة دي بالذات هو عايز يقفل على
 * التاني، مش يعيد الدخول.
 *
 * الاستثناء بهاش الرمز اللي في كوكيه: الجدول شايل الهاش لا الرمز،
 * فده الطريق الوحيد لمعرفة أنهي صف بتاعه دلوقتي.
 */
export async function revokeOtherSessionsAction(): Promise<SessionState> {
  const { user } = await getDashboardContext()

  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  const currentHash = raw ? hashToken(raw) : null

  const deleted = await db
    .delete(sessions)
    .where(
      currentHash
        ? and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentHash))
        : eq(sessions.userId, user.id),
    )
    .returning({ id: sessions.id })

  revalidatePath('/dashboard/settings/sessions')
  return { ok: true, closed: deleted.length }
}
