import 'server-only'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, messagingSettings, verificationTokens } from '@/db/schema'
import { decrypt, generateOtp, hashToken } from './crypto'
import { isEmailConfigured, sendEmail } from './email'
import { customerCodeEmail, type StoreBrand } from './store-emails'
import { config } from './config'
import { normalizePhone } from './utils'

/**
 * دخول عميل المتجر — برقمه أو ببريده.
 *
 * **العميل بيختار وسيلته، مش إحنا.** اللي بيشتري من الموبايل عنده
 * رقمه حاضر وبريده لأ، واللي بيشتري من الكمبيوتر العكس. إجبار
 * واحدة منهم بيخسّر نص العملاء عند أول خطوة.
 *
 * والرمز بيروح على **نفس الوسيلة اللي كتبها**: اللي كتب رقمه
 * بيستنّاه على واتساب أو رسالة نصية، واللي كتب بريده بيستنّاه في
 * بريده. إرسال رمز على بريد لواحد كتب رقمه بيخلّيه يقعد يستنّى
 * حاجة عمرها ما هتيجي.
 */

const { length: CODE_LENGTH, ttlMinutes: TTL, maxAttempts: MAX_ATTEMPTS, resendCooldownSeconds: COOLDOWN } =
  config.otp

export type Channel = 'whatsapp' | 'sms' | 'email'

export type Identity =
  | { kind: 'phone'; value: string }
  | { kind: 'email'; value: string }

/** يقرأ اللي كتبه العميل ويقرّر: ده رقم ولا بريد؟ */
export function readIdentity(raw: string, country: string): Identity | null {
  const value = raw.trim()
  if (!value) return null

  if (value.includes('@')) {
    const email = value.toLowerCase()
    return /^\S+@\S+\.\S+$/.test(email) ? { kind: 'email', value: email } : null
  }

  const phone = normalizePhone(value, country === 'EG' ? '20' : '966')
  return phone.replace(/\D/g, '').length >= 10 ? { kind: 'phone', value: phone } : null
}

/** مفتاح التخزين — بيفرّق بين متجر ومتجر عشان الرمز ما يتنقلش بينهم */
function tokenKey(storeId: string, identity: Identity) {
  return `cust:${storeId}:${identity.kind}:${identity.value}`
}

export type IssueResult =
  | { ok: true; channel: Channel; masked: string; devCode?: string }
  | { ok: false; error: string }

/** يخفي وسط الرقم أو البريد — بيأكّد للعميل إنه الصح من غير ما نكشفه */
function mask(identity: Identity): string {
  if (identity.kind === 'email') {
    const [name, domain] = identity.value.split('@')
    const head = name.slice(0, 2)
    return `${head}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`
  }
  const d = identity.value.replace(/\D/g, '')
  return `${d.slice(0, 4)}${'*'.repeat(Math.max(0, d.length - 7))}${d.slice(-3)}`
}

/**
 * إرسال واتساب.
 *
 * بيشتغل بحساب واتساب بزنس بتاع التاجر نفسه — إحنا مش وسيط ومش
 * شايلين تكلفة رسايله. لو مش مربوط بنرجّع false والطبقة اللي فوق
 * بتنزل للبديل بدل ما تدّعي إنها بعتت.
 */
async function sendWhatsapp(storeId: string, phone: string, code: string): Promise<boolean> {
  const [settings] = await db
    .select({
      provider: messagingSettings.whatsappProvider,
      creds: messagingSettings.whatsappCredentials,
      phoneId: messagingSettings.whatsappPhoneId,
    })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  if (settings?.provider !== 'custom' || !settings.creds || !settings.phoneId) return false

  let token: string
  try {
    token = decrypt(settings.creds)
  } catch {
    return false
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${settings.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: `رمز الدخول: ${code}\nصالح ${TTL} دقايق. لو مش إنت اللي طلبته، تجاهل الرسالة.` },
      }),
      signal: AbortSignal.timeout(12_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * يبعت رمز دخول على الوسيلة المناسبة.
 *
 * الترتيب للرقم: واتساب (مجاني للتاجر ومقروء فورًا) ← بريد الحساب
 * المسجّل لو موجود. الرسايل النصية محتاجة مزوّدًا مدفوعًا لسه ما
 * اتربطش، فما بندّعيش إننا بعتنا عليها.
 */
export async function issueCustomerOtp(input: {
  storeId: string
  /**
   * هوية *المتجر* لا هوية المنصة.
   *
   * العميل ده مشترك عند التاجر ومش عارفنا. رسالة بشعار جهة تانية
   * بتبان تصيّدًا، والعميل ما بيكتبش رمزًا جاي من حد ما يعرفهوش.
   */
  brand: StoreBrand
  identity: Identity
  country: string
}): Promise<IssueResult> {
  const key = tokenKey(input.storeId, input.identity)

  const [recent] = await db
    .select({ createdAt: verificationTokens.createdAt })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, key), eq(verificationTokens.purpose, 'email_verify')))
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000
    if (elapsed < COOLDOWN) {
      return { ok: false, error: `استنّى ${Math.ceil(COOLDOWN - elapsed)} ثانية وجرّب تاني` }
    }
  }

  /* البريد اللي هنبعت عليه لو الوسيلة رقم: بريد الحساب المسجّل */
  let emailTarget: string | null =
    input.identity.kind === 'email' ? input.identity.value : null

  if (input.identity.kind === 'phone') {
    const [existing] = await db
      .select({ email: customers.email })
      .from(customers)
      .where(and(eq(customers.storeId, input.storeId), eq(customers.phone, input.identity.value)))
      .limit(1)
    emailTarget = existing?.email ?? null
  }

  const code = generateOtp(CODE_LENGTH)
  const dev = process.env.NODE_ENV === 'development'

  /* رمز واحد صالح في كل وقت لنفس الوسيلة */
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.identifier, key),
        eq(verificationTokens.purpose, 'email_verify'),
        isNull(verificationTokens.usedAt),
      ),
    )

  await db.insert(verificationTokens).values({
    identifier: key,
    tokenHash: hashToken(`${key}:${code}`),
    purpose: 'email_verify',
    meta: { attempts: 0 },
    expiresAt: new Date(Date.now() + TTL * 60_000),
  })

  let channel: Channel | null = null

  if (input.identity.kind === 'phone') {
    if (await sendWhatsapp(input.storeId, input.identity.value, code)) channel = 'whatsapp'
  }

  if (!channel && emailTarget && isEmailConfigured()) {
    const mail = customerCodeEmail(input.brand, code, TTL)
    const sent = await sendEmail({
      to: emailTarget,
      ...mail,
      senderName: input.brand.name,
      log: { storeId: input.storeId, event: 'customer_login_otp' },
    })
    if (sent.ok) channel = 'email'
  }

  if (!channel && !dev) {
    return {
      ok: false,
      error:
        input.identity.kind === 'phone'
          ? 'مقدرناش نبعت رمزًا على الرقم ده. جرّب تدخل ببريدك بدل الرقم.'
          : 'مقدرناش نبعت الرمز دلوقتي. جرّب تاني بعد شوية.',
    }
  }

  return {
    ok: true,
    channel: channel ?? 'email',
    masked: mask(
      channel === 'email' && emailTarget ? { kind: 'email', value: emailTarget } : input.identity,
    ),
    devCode: dev ? code : undefined,
  }
}

export type VerifyResult = { ok: true } | { ok: false; error: string }

export async function verifyCustomerOtp(
  storeId: string,
  identity: Identity,
  code: string,
): Promise<VerifyResult> {
  const key = tokenKey(storeId, identity)

  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, key),
        eq(verificationTokens.purpose, 'email_verify'),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationTokens.createdAt))
    .limit(1)

  if (!token) return { ok: false, error: 'الرمز انتهت صلاحيته. اطلب واحدًا جديد.' }

  const attempts = Number((token.meta as { attempts?: number } | null)?.attempts ?? 0)
  if (attempts >= MAX_ATTEMPTS) {
    await db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, token.id))
    return { ok: false, error: 'جرّبت كتير. اطلب رمزًا جديد.' }
  }

  const clean = code.replace(/\D/g, '')
  if (token.tokenHash !== hashToken(`${key}:${clean}`)) {
    await db
      .update(verificationTokens)
      .set({
        meta: sql`jsonb_set(coalesce(${verificationTokens.meta}, '{}'::jsonb), '{attempts}', to_jsonb(${attempts + 1}))`,
      })
      .where(eq(verificationTokens.id, token.id))
    return { ok: false, error: 'الرمز غلط. راجعه وجرّب تاني.' }
  }

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, token.id))

  return { ok: true }
}
