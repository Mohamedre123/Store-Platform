import type { NextRequest } from 'next/server'
import { and, count, eq, isNull, ne } from 'drizzle-orm'
import { db } from '@/db'
import { orders, storeMembers, stores, users } from '@/db/schema'
import { isAdminEmail } from '@/lib/admin'
import { json, sameOrigin } from '@/lib/app-api'
import { destroySession, getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/account/abandon — «الغِ التسجيل» من صفحة التأكيد في التطبيق.
 *
 * التاجر اللي سجّل ووقف عند الرمز (بريد غلط، أو عايز يدخل بحساب تاني)
 * كان محبوس في الصفحة. والخروج العادي كان هيسيب حساب نص مكتمل ماسك
 * البريد ورابط المتجر — فلما يرجع يسجّل بنفس البريد يلاقي «مسجّل قبل كده».
 *
 * هنا الحساب اللي **لسه ما اتأكدش** بيتمسح هو والمتجر اللي اتعمل معاه،
 * كأنه ما سجّلش أصلًا. والحساب المتأكّد بيخرج بس — عمره ما بيتمسح من هنا.
 *
 * المتجر ما بيتمسحش لو فيه عضو تاني أو أي طلب — ده مش متجر «لسه متعمل».
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)

  const user = await getCurrentUser()
  if (!user) {
    await destroySession()
    return json({ ok: true, deleted: false })
  }

  const deletable = !user.emailVerifiedAt && !user.isPlatformAdmin && !isAdminEmail(user.email)
  await destroySession()
  if (!deletable) return json({ ok: true, deleted: false })

  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ storeId: storeMembers.storeId })
      .from(storeMembers)
      .where(and(eq(storeMembers.userId, user.id), eq(storeMembers.role, 'owner')))

    for (const { storeId } of owned) {
      const [others] = await tx
        .select({ n: count() })
        .from(storeMembers)
        .where(and(eq(storeMembers.storeId, storeId), ne(storeMembers.userId, user.id)))
      const [sold] = await tx.select({ n: count() }).from(orders).where(eq(orders.storeId, storeId))
      if (others.n === 0 && sold.n === 0) await tx.delete(stores).where(eq(stores.id, storeId))
    }

    await tx.delete(users).where(and(eq(users.id, user.id), isNull(users.emailVerifiedAt)))
  })

  return json({ ok: true, deleted: true })
}
