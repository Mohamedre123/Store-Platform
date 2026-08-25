import 'server-only'
import { storeSenderAddress } from '@/lib/store-email-domain'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, verificationTokens } from '@/db/schema'
import { generateOtp, hashToken } from './crypto'
import { readTemplates, sendWhatsapp } from './whatsapp'
import { fillTemplate, templateFor } from './whatsapp-templates'
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
 * يبعت رمز دخول **على الوسيلة اللي العميل كتبها — وبس**.
 *
 * كان فيه رجوع للبريد لما الواتساب مش مربوط: العميل يكتب رقمه،
 * والرمز يروح على بريد مسجّل من زمان هو ممكن ما يفتحوش أصلًا —
 * ويفضل يبصّ في واتسابه ومفيش حاجة جاية. الرجوع الصامت ده بيبان
 * عطلًا مش مساعدة.
 *
 * دلوقتي: كتب رقمه ← واتساب. كتب بريده ← بريد. ولو الوسيلة اللي
 * اختارها مش شغّالة، بنقوله بصراحة ونعرض عليه التانية.
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

  /**
   * الوسيلة التانية من حساب العميل.
   *
   * ## ليه الاتنين مش واحدة
   * العميل بيدخل برقمه أو ببريده، بس حسابه غالبًا فيه الاتنين
   * (الطلب بيسجّلهم). فلو دخل ببريده وعنده رقم، **الواتساب أسرع
   * وأضمن** — بيتفتح في ثانية، وما بيدخلش سبام.
   *
   * ودي مش رفاهية: البريد من نطاق جديد بيروح السبام حتى وهو
   * مصادَق عليه بالكامل (SPF وDKIM وDMARC كلهم PASS). والعميل اللي
   * ما وصلهوش الرمز ما بيدخلش، واللي ما بيدخلش ما بيشتريش.
   */
  const other = await db
    .select({ phone: customers.phone, email: customers.email })
    .from(customers)
    .where(
      and(
        eq(customers.storeId, input.storeId),
        input.identity.kind === 'phone'
          ? eq(customers.phone, input.identity.value)
          : eq(customers.email, input.identity.value),
      ),
    )
    .limit(1)

  const account = other[0]

  const emailTarget: string | null =
    input.identity.kind === 'email' ? input.identity.value : (account?.email ?? null)

  /* الرقم اللي هنبعت عليه واتساب — المكتوب أو اللي على حسابه */
  const phoneTarget: string | null =
    input.identity.kind === 'phone' ? input.identity.value : (account?.phone ?? null)

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

  /**
   * الواتساب الأول دايمًا — حتى لو العميل دخل ببريده.
   *
   * **البريد بيروح السبام حتى وهو مصادَق عليه بالكامل.** اتأكدنا من
   * ترويسة رسالة حقيقية: SPF نجح، وDKIM نجح، وDMARC نجح — وراحت
   * السبام برضو. السبب سمعة النطاق الجديد، ودي بتتبني بالوقت لا
   * بالكود.
   *
   * والواتساب بيوصل في ثانية ومفيهوش سبام أصلًا. فطالما معانا رقم
   * العميل والمتجر مربوط، الرمز بيروح عليه — والبريد بيبقى الاحتياطي.
   *
   * ده مش تحايل على المشكلة: ده الطريق اللي فعلًا بيوصل في السوق
   * اللي بنشتغل فيه.
   */
  if (phoneTarget) {
    /*
      الرسالة باسم المتجر لا باسمنا: العميل بيشتري من التاجر ومش
      عارفنا، ورمز جاي من اسم غريب ما بيتكتبش.
    */
    const templates = await readTemplates(input.storeId)
    const wa = await sendWhatsapp(
      input.storeId,
      phoneTarget,
      fillTemplate(templateFor(templates, 'otp'), {
        اسم_المتجر: input.brand.name,
        كود: code,
        دقايق: String(TTL),
      }),
      { event: 'customer_login_otp' },
    )
    if (wa.ok) channel = 'whatsapp'
  }

  /*
    البريد احتياطي: لما الواتساب مش مربوط، أو مفيش رقم على الحساب.
  */
  if (!channel && emailTarget && isEmailConfigured()) {
    const mail = customerCodeEmail(input.brand, code, TTL)
    const sent = await sendEmail({
      to: emailTarget,
      ...mail,
      senderName: input.brand.name,
      senderSlug: input.brand.slug,
      senderAddress: await storeSenderAddress(input.storeId),
      log: { storeId: input.storeId, event: 'customer_login_otp' },
    })
    if (sent.ok) channel = 'email'
  }

  if (!channel && !dev) {
    return {
      ok: false,
      error:
        input.identity.kind === 'phone'
          ? 'المتجر ده لسه ما ربطش واتساب، فمقدرناش نبعت رمزًا على الرقم. ادخل ببريدك بدل الرقم.'
          : 'مقدرناش نبعت الرمز دلوقتي. جرّب تاني بعد شوية.',
    }
  }

  return {
    ok: true,
    channel: channel ?? 'email',
    /* اللي اتبعت عليه فعلًا — مش اللي العميل كتبه */
    masked: mask(
      channel === 'email' && emailTarget
        ? { kind: 'email', value: emailTarget }
        : channel === 'whatsapp' && phoneTarget
          ? { kind: 'phone', value: phoneTarget }
          : input.identity,
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
