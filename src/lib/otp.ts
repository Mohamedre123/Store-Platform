import 'server-only'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { verificationTokens, users } from '@/db/schema'
import { generateOtp, hashToken } from './crypto'
import { isEmailConfigured, sendEmail, verificationEmail } from './email'

/** الرمز صالح عشر دقايق — كفاية للوصول وقصيرة كفاية للأمان */
const CODE_TTL_MINUTES = 10
/** بعد خمس محاولات خاطئة يُبطَل الرمز ولازم يطلب واحدًا جديدًا */
const MAX_ATTEMPTS = 5
/** لا يُسمح بطلب رمز جديد قبل مرور دقيقة */
const RESEND_COOLDOWN_SECONDS = 60

export type IssueResult =
  | { ok: true; autoVerified: boolean; devCode?: string }
  | { ok: false; reason: 'cooldown'; secondsLeft: number }
  | { ok: false; reason: 'send_failed' }

/**
 * يُصدر رمز تحقق ويبعته على البريد.
 *
 * لو مافيش مزوّد بريد مضبوط، بنأكّد الحساب تلقائيًا بدل ما نقفل
 * الباب على صاحبه. المنصة ما ينفعش تمنع الدخول بسبب إعداد ناقص —
 * أول ما المزوّد يتضبط، التحقق يبقى إلزاميًا من نفسه.
 */
export async function issueEmailOtp(userId: string, email: string, name?: string): Promise<IssueResult> {
  if (!isEmailConfigured()) {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId))
    return { ok: true, autoVerified: true }
  }

  // منع الإغراق بطلبات متتالية
  const [recent] = await db
    .select({ createdAt: verificationTokens.createdAt })
    .from(verificationTokens)
    .where(
      and(eq(verificationTokens.identifier, email), eq(verificationTokens.purpose, 'email_verify')),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return { ok: false, reason: 'cooldown', secondsLeft: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) }
    }
  }

  // أي رمز قديم لنفس البريد يُلغى — رمز واحد صالح في كل وقت
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.purpose, 'email_verify'),
        isNull(verificationTokens.usedAt),
      ),
    )

  const code = generateOtp(6)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

  await db.insert(verificationTokens).values({
    identifier: email,
    // نخزّن الهاش فقط — لو تسرّبت قاعدة البيانات ما حدش يقرأ الرموز
    tokenHash: hashToken(`${email}:${code}`),
    purpose: 'email_verify',
    meta: { userId, attempts: 0 },
    expiresAt,
  })

  const message = verificationEmail(code, name)
  const sent = await sendEmail({ to: email, ...message })

  if (!sent.ok) return { ok: false, reason: 'send_failed' }

  return {
    ok: true,
    autoVerified: false,
    // في التطوير بنرجّع الرمز عشان نقدر نجرّب من غير بريد حقيقي
    devCode: process.env.NODE_ENV === 'development' ? code : undefined,
  }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' }

export async function verifyEmailOtp(email: string, code: string): Promise<VerifyResult> {
  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.purpose, 'email_verify'),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (!token) return { ok: false, reason: 'expired' }

  const attempts = Number((token.meta as { attempts?: number } | null)?.attempts ?? 0)
  if (attempts >= MAX_ATTEMPTS) {
    await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, token.id))
    return { ok: false, reason: 'too_many_attempts' }
  }

  const clean = code.replace(/[^\d]/g, '')
  if (token.tokenHash !== hashToken(`${email}:${clean}`)) {
    await db
      .update(verificationTokens)
      .set({ meta: sql`jsonb_set(coalesce(${verificationTokens.meta}, '{}'::jsonb), '{attempts}', to_jsonb(${attempts + 1}))` })
      .where(eq(verificationTokens.id, token.id))
    return { ok: false, reason: 'invalid' }
  }

  const userId = (token.meta as { userId?: string } | null)?.userId

  await db.transaction(async (tx) => {
    await tx
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, token.id))

    if (userId) {
      await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId))
    } else {
      await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email))
    }
  })

  return { ok: true }
}
