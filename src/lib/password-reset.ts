import 'server-only'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users, verificationTokens } from '@/db/schema'
import { generateOtp, hashToken } from './crypto'
import { hashPassword } from './auth'
import { isEmailConfigured, sendEmail } from './email'
import { passwordResetEmail } from './email-templates'
import { config } from './config'

/**
 * استعادة كلمة السر برمز على البريد.
 *
 * ثلاث قواعد بتحكم الملف ده كله:
 *
 * ١. **ما بنقولش إن البريد موجود ولا لأ.** الرد واحد في الحالتين.
 *    لو فرّقنا، أي حد يقدر يجرّب قايمة إيميلات ويعرف مين عنده حساب
 *    عندنا — ودي بداية أي هجمة تصيّد.
 * ٢. **الرمز بيتخزّن مهشّرًا زي أي سرّ.** نسخة مسرّبة من قاعدة
 *    البيانات ما تدّيش حد رموز شغّالة.
 * ٣. **كل الجلسات بتتقفل بعد التغيير.** اللي بيغيّر كلمة سرّه غالبًا
 *    بيغيّرها عشان حد تاني داخل على حسابه — ولو سبنا جلساته شغّالة،
 *    التغيير ما عملش حاجة.
 */

const {
  length: CODE_LENGTH,
  ttlMinutes: CODE_TTL_MINUTES,
  maxAttempts: MAX_ATTEMPTS,
  resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
} = config.otp

const PURPOSE = 'password_reset' as const

export type RequestResult =
  | { ok: true; devCode?: string }
  | { ok: false; reason: 'cooldown'; secondsLeft: number }
  | { ok: false; reason: 'unavailable' }

/**
 * يبعت رمز الاستعادة.
 *
 * البريد اللي مالوش حساب بيرجّع `ok` برضه من غير ما يتبعت حاجة —
 * الواجهة بتعرض نفس الرسالة في الحالتين.
 */
export async function requestPasswordReset(rawEmail: string): Promise<RequestResult> {
  const email = rawEmail.trim().toLowerCase()

  /*
    من غير مزوّد بريد مفيش استعادة في الإنتاج.

    وهنا **بنقولها صراحةً** بدل ما نسكت: التاجر اللي بيستنّى رمزًا
    عمره ما هييجي بيفتكر إن حسابه اتقفل. وما ينفعش نعمل زي تأكيد
    البريد ونعدّي من غير رمز — تأكيد البريد بيفتح حسابًا لصاحبه،
    والاستعادة بتدّي كلمة سر جديدة لأي حد يكتب البريد.

    في التطوير بنكمّل عادي ونرجّع الرمز في الرد عشان المسار يبقى
    قابل للفحص من غير حساب بريد.
  */
  const dev = process.env.NODE_ENV === 'development'
  if (!isEmailConfigured() && !dev) return { ok: false, reason: 'unavailable' }

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  // منع الإغراق — بيتحسب على البريد سواء له حساب أو لأ
  const [recent] = await db
    .select({ createdAt: verificationTokens.createdAt })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.purpose, PURPOSE)))
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        reason: 'cooldown',
        secondsLeft: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      }
    }
  }

  // البريد مالوش حساب: بنخرج بنجاح صامت من غير ما نلمّح لحاجة
  if (!user) return { ok: true }

  // رمز واحد صالح في كل وقت
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.purpose, PURPOSE),
        isNull(verificationTokens.usedAt),
      ),
    )

  const code = generateOtp(CODE_LENGTH)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

  await db.insert(verificationTokens).values({
    identifier: email,
    tokenHash: hashToken(`${email}:${PURPOSE}:${code}`),
    purpose: PURPOSE,
    meta: { userId: user.id, attempts: 0 },
    expiresAt,
  })

  if (isEmailConfigured()) {
    const message = passwordResetEmail(code, user.name ?? undefined)
    await sendEmail({ to: email, ...message })
  }

  return {
    ok: true,
    // في التطوير بنرجّع الرمز عشان نقدر نجرّب من غير بريد حقيقي
    devCode: dev ? code : undefined,
  }
}

export type ResetResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }

/**
 * يتحقّق من الرمز من غير ما يستهلكه.
 *
 * الواجهة على تلات خطوات: بريد ← رمز ← كلمة سر جديدة. لو الرمز
 * اتستهلك في الخطوة التانية، التاجر اللي كتب كلمة سر ضعيفة ورفضناها
 * كان لازم يستنّى رمزًا جديدًا عشان يجرّب تاني.
 */
export async function checkResetCode(rawEmail: string, code: string): Promise<ResetResult> {
  const email = rawEmail.trim().toLowerCase()

  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.purpose, PURPOSE),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (!token) return { ok: false, reason: 'expired' }

  const attempts = Number((token.meta as { attempts?: number } | null)?.attempts ?? 0)
  if (attempts >= MAX_ATTEMPTS) {
    await db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, token.id))
    return { ok: false, reason: 'too_many_attempts' }
  }

  const clean = code.replace(/[^\d]/g, '')
  if (token.tokenHash !== hashToken(`${email}:${PURPOSE}:${clean}`)) {
    await db
      .update(verificationTokens)
      .set({
        meta: sql`jsonb_set(coalesce(${verificationTokens.meta}, '{}'::jsonb), '{attempts}', to_jsonb(${attempts + 1}))`,
      })
      .where(eq(verificationTokens.id, token.id))
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true }
}

/** يتحقّق من الرمز ويغيّر كلمة السر ويقفل كل الجلسات القديمة */
export async function completePasswordReset(
  rawEmail: string,
  code: string,
  newPassword: string,
): Promise<ResetResult> {
  const email = rawEmail.trim().toLowerCase()

  const check = await checkResetCode(email, code)
  if (!check.ok) return check

  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.purpose, PURPOSE),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (!token) return { ok: false, reason: 'expired' }

  const userId = (token.meta as { userId?: string } | null)?.userId
  const passwordHash = await hashPassword(newPassword)

  await db.transaction(async (tx) => {
    await tx
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, token.id))

    /*
      البريد بيتأكّد مع الاستعادة.

      اللي وصله رمز على بريده وكتبه، أثبت إنه بيوصله فعلًا — وهو
      نفس اللي بيثبته رمز التأكيد. حساب بكلمة سر جديدة وبريد «مش
      مؤكّد» كان هيتوجّه على صفحة تأكيد بعد ما أكّد بالفعل.
    */
    const set = { passwordHash, emailVerifiedAt: new Date() }
    if (userId) await tx.update(users).set(set).where(eq(users.id, userId))
    else await tx.update(users).set(set).where(eq(users.email, email))

    /*
      كل الجلسات بتتقفل.

      اللي بيغيّر كلمة سرّه غالبًا بيغيّرها عشان حد تاني داخل على
      حسابه. لو سبنا جلسات الجهاز التاني شغّالة، التغيير ما طردش حد.
    */
    if (userId) await tx.delete(sessions).where(eq(sessions.userId, userId))
  })

  return { ok: true }
}
