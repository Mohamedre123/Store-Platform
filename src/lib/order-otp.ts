import 'server-only'
import { storeSenderAddress } from '@/lib/store-email-domain'
import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { otpCodes } from '@/db/schema'
import { generateOtp, hashToken, safeEqual } from './crypto'
import { isEmailConfigured, sendEmail } from './email'

/**
 * رمز التحقق قبل تأكيد الطلب.
 *
 * بيقلّل الطلبات الوهمية — مشكلة حقيقية في الدفع عند الاستلام: حد
 * يطلب برقم مش بتاعه، التاجر يشحن، والشحنة ترجع على حسابه.
 *
 * الرمز مربوط بالتليفون (هوية الطلب) لكن بيتسلّم بالبريد دلوقتي.
 * أول ما SMS أو واتساب يتعاقد عليهم، بيتضاف فرع تسليم هنا من غير ما
 * يتغيّر أي كود بيستدعي الدوال دي.
 */

const CODE_LENGTH = 6
const TTL_MINUTES = 10
const MAX_ATTEMPTS = 5

export type IssueOtpResult =
  | { ok: true; channel: 'email'; maskedTarget: string }
  | { ok: false; error: string }

export async function issueOrderOtp(input: {
  storeId: string
  storeName: string
  /** سلَج المتجر — عنوان المرسِل بيتبنى منه */
  storeSlug?: string | null
  phone: string
  email?: string | null
}): Promise<IssueOtpResult> {
  if (!input.email) {
    return { ok: false, error: 'محتاجين بريدك الإلكتروني عشان نبعتلك رمز التحقق' }
  }
  if (!isEmailConfigured()) {
    return { ok: false, error: 'التحقق مش متاح دلوقتي' }
  }

  const code = generateOtp(CODE_LENGTH)
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000)

  // الرموز القديمة لنفس الرقم تتشال: كود واحد صالح في أي لحظة
  await db
    .delete(otpCodes)
    .where(and(eq(otpCodes.storeId, input.storeId), eq(otpCodes.phone, input.phone), eq(otpCodes.purpose, 'order')))

  await db.insert(otpCodes).values({
    storeId: input.storeId,
    phone: input.phone,
    codeHash: hashToken(code),
    purpose: 'order',
    expiresAt,
  })

  const spaced = code.split('').join(' ')
  await sendEmail({
    senderAddress: await storeSenderAddress(input.storeId),
    log: { storeId: input.storeId, event: 'order_otp' },
    to: input.email,
    subject: `رمز تأكيد طلبك: ${code}`,
    html: `<div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;max-width:420px;margin:0 auto;padding:24px;">
      <p style="font-size:15px;color:#222540;">رمز تأكيد طلبك من <strong>${input.storeName}</strong>:</p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:6px;text-align:center;color:#222540;margin:24px 0;">${spaced}</p>
      <p style="font-size:13px;color:#5c6890;">الرمز صالح لمدة ${TTL_MINUTES} دقايق. لو مش إنت اللي طلبت، تجاهل الرسالة.</p>
    </div>`,
    text: `رمز تأكيد طلبك من ${input.storeName}: ${code}\nصالح ${TTL_MINUTES} دقايق.`,
  })

  return { ok: true, channel: 'email', maskedTarget: maskEmail(input.email) }
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string }

export async function verifyOrderOtp(storeId: string, phone: string, code: string): Promise<VerifyOtpResult> {
  const clean = code.replace(/\D/g, '')
  if (clean.length !== CODE_LENGTH) return { ok: false, error: 'الرمز لازم يكون ٦ أرقام' }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.storeId, storeId),
        eq(otpCodes.phone, phone),
        eq(otpCodes.purpose, 'order'),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (!row) return { ok: false, error: 'الرمز انتهت صلاحيته. اطلب رمزًا جديدًا.' }

  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'حاولت كتير. اطلب رمزًا جديدًا.' }
  }

  // مقارنة ثابتة الزمن — لا تكشف عن الرمز بفروق التوقيت
  if (!safeEqual(hashToken(clean), row.codeHash)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id))
    return { ok: false, error: 'الرمز غلط' }
  }

  await db.update(otpCodes).set({ verifiedAt: new Date() }).where(eq(otpCodes.id, row.id))
  return { ok: true }
}

/** يتأكد إن الرقم اتحقّق منه خلال آخر ٣٠ دقيقة */
export async function isPhoneVerifiedForOrder(storeId: string, phone: string): Promise<boolean> {
  const [row] = await db
    .select({ verifiedAt: otpCodes.verifiedAt })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.storeId, storeId),
        eq(otpCodes.phone, phone),
        eq(otpCodes.purpose, 'order'),
        gt(otpCodes.verifiedAt, new Date(Date.now() - 30 * 60_000)),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  return Boolean(row?.verifiedAt)
}

function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const shown = user.slice(0, 2)
  return `${shown}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`
}
