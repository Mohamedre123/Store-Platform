import type { NextRequest } from 'next/server'
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { storeMembers, stores, users, verificationTokens } from '@/db/schema'
import { isAdminEmail } from '@/lib/admin'
import { json, sameOrigin } from '@/lib/app-api'
import { getCurrentUser } from '@/lib/auth'
import { issueEmailOtp } from '@/lib/otp'

export const dynamic = 'force-dynamic'

/** رموز كتير على بريد جديد كل مرة = إغراق بريد ناس تانية باسمنا */
const MAX_CODES_PER_HOUR = 6

/**
 * POST /api/app/account/change-email — تغيير البريد من صفحة التأكيد في التطبيق.
 *
 * التاجر اللي كتب بريده غلط كان محبوس: الرمز رايح لبريد مش بتاعه،
 * ومفيش رجوع ولا تغيير. هنا بيكتب بريد تاني والرمز بيروح عليه.
 *
 * **للحساب اللي لسه ما اتأكدش بس.** البريد المتأكّد هو هوية الحساب —
 * تغييره محتاج إثبات على البريد القديم، وده مش مكانه.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)

  const user = await getCurrentUser()
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401)
  if (user.emailVerifiedAt) {
    return json({ ok: false, error: 'already_verified', message: 'بريدك متأكّد خلاص.' }, 409)
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(body?.email)
  if (!parsed.success) {
    return json({ ok: false, error: 'invalid', message: 'البريد ده مش مكتوب صح — راجعه.' }, 400)
  }
  const email = parsed.data

  if (email === user.email.toLowerCase()) {
    return json({ ok: false, error: 'same', message: 'ده نفس البريد اللي بعتنا عليه الرمز.' }, 400)
  }

  /* بريد الإدارة ما يتاخدش من حساب تاني — حتى لو صاحبه مش هيقدر يأكّده */
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (taken || isAdminEmail(email)) {
    return json(
      { ok: false, error: 'taken', message: 'البريد ده مسجّل بحساب تاني — سجّل دخول بيه بدل التسجيل الجديد.' },
      409,
    )
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.purpose, 'email_verify'),
        sql`${verificationTokens.meta}->>'userId' = ${user.id}`,
        gt(verificationTokens.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    )
  if (n >= MAX_CODES_PER_HOUR) {
    return json({ ok: false, error: 'rate_limited', message: 'غيّرت البريد كتير — استنى شوية وجرّب تاني.' }, 429)
  }

  const oldEmail = user.email
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ email })
        .where(and(eq(users.id, user.id), isNull(users.emailVerifiedAt)))

      /* بريد المتجر اتكتب من بريد التسجيل — لو لسه زي ما هو، بيتغيّر معاه */
      const owned = await tx
        .select({ storeId: storeMembers.storeId })
        .from(storeMembers)
        .where(and(eq(storeMembers.userId, user.id), eq(storeMembers.role, 'owner')))
      for (const { storeId } of owned) {
        await tx
          .update(stores)
          .set({ email })
          .where(and(eq(stores.id, storeId), eq(stores.email, oldEmail)))
      }
    })
  } catch {
    return json(
      { ok: false, error: 'taken', message: 'البريد ده مسجّل بحساب تاني — سجّل دخول بيه بدل التسجيل الجديد.' },
      409,
    )
  }

  const otp = await issueEmailOtp(user.id, email, user.name)
  if (otp.ok && otp.autoVerified) return json({ ok: true, verified: true })
  if (!otp.ok) {
    return json({
      ok: true,
      sent: false,
      message:
        otp.reason === 'cooldown'
          ? `البريد اتغيّر. استنى ${otp.secondsLeft} ثانية واطلب الرمز من «ابعت الرمز تاني».`
          : 'البريد اتغيّر، بس ما قدرناش نبعت الرمز دلوقتي — اطلبه تاني من «ابعت الرمز تاني».',
    })
  }
  return json({ ok: true, sent: true })
}
