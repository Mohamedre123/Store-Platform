import 'server-only'
import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { otpCodes } from '@/db/schema'
import { generateOtp, hashToken, safeEqual } from './crypto'
import { isEmailConfigured, sendEmail } from './email'
import { sendWhatsapp, whatsappReady } from './whatsapp'

/**
 * رمز التحقق قبل تأكيد الطلب.
 *
 * بيقلّل الطلبات الوهمية — مشكلة حقيقية في الدفع عند الاستلام: حد
 * يطلب برقم مش بتاعه، التاجر يشحن، والشحنة ترجع على حسابه.
 *
 * ## بيروح على رقمه الأول، والبريد احتياطي
 * الرمز مربوط بالتليفون لأنه هوية الطلب — فالمنطقي إنه يوصل عليه.
 * وكان بيتسلّم بالبريد وبس، وده كان بيخلّي الخطوة تفشل عند ناس كتير:
 * البريد من نطاق جديد بيروح السبام حتى وهو مصادَق عليه بالكامل، والعميل
 * بيقعد يستنّى رمزًا هو مش هيشوفه — وياخد الشاشة دي كأنها عطل.
 *
 * فلو المتجر رابط واتساب، الرمز بيروح على رقم الطلب نفسه: بيوصل في
 * ثانية ومفيهوش سبام. والبريد بيفضل موجود لما الواتساب مش مربوط أو
 * يفشل — نفس القاعدة اللي رمز دخول العميل ماشي عليها.
 */

const CODE_LENGTH = 6
const TTL_MINUTES = 10
const MAX_ATTEMPTS = 5

export type IssueOtpResult =
  | { ok: true; channel: 'whatsapp' | 'email'; maskedTarget: string }
  | { ok: false; error: string }

/**
 * فيه أصلًا طريق يوصّل الرمز للعميل؟
 *
 * ## ليه دي موجودة
 * التحقق بقى مفتوحًا افتراضيًا لكل تاجر. ومن غير الفحص ده، المتجر
 * اللي مالوش واتساب مربوط والبريد عنده مش مضبوط كان **مش هيقدر يبيع
 * خالص**: الرمز ما بيتبعتش، والطلب بيترفض بـ«لازم تتحقق من رقمك»،
 * والعميل واقف قدام حيطة والتاجر مش عارف ليه.
 *
 * فالتحقق بيتخطّى لما ما يكونش ممكن — تاجر بيبيع من غير تحقّق أحسن
 * من تاجر مش بيبيع.
 *
 * ## وده مش ثغرة
 * القيمتين اللي بتتحكم فيهم إعداد التاجر وإعداد المنصة — ولا واحدة
 * منهم المهاجم بيقدر يلمسها. اللي بيحاول يطلب برقم مش بتاعه ما عندوش
 * أي طريقة يخلّي الفحص ده يرجع «مش ممكن».
 *
 * ## والواجهة والخادم بينادوا نفس الدالة
 * لو الواجهة قرّرت حاجة والخادم قرّر غيرها، العميل بيتحاسب على فرق
 * مش شايفه: يفتح نافذة رمز والطلب مرفوض، أو يعدّي من غيرها والخادم
 * يرفضه. المصدر الواحد بيمنع الاختلاف ده من الأساس.
 */
export async function otpDeliverable(storeId: string): Promise<boolean> {
  return isEmailConfigured() || (await whatsappReady(storeId))
}

export async function issueOrderOtp(input: {
  storeId: string
  storeName: string
  /** سلَج المتجر — عنوان المرسِل بيتبنى منه */
  storeSlug?: string | null
  phone: string
  email?: string | null
}): Promise<IssueOtpResult> {
  /*
    الوسايل المتاحة بتتحدّد **قبل** ما نعمل الرمز.

    لو عملناه الأول وما لقيناش طريق يوصله، بنكون مسحنا رمزًا سليم كان
    العميل لسه شايفه في بريده — وخلّيناه غلط من غير سبب.
  */
  const canWhatsapp = Boolean(input.phone) && (await whatsappReady(input.storeId))
  const canEmail = Boolean(input.email) && isEmailConfigured()

  if (!canWhatsapp && !canEmail) {
    return {
      ok: false,
      error: input.email
        ? 'التحقق مش متاح دلوقتي'
        : 'محتاجين بريدك الإلكتروني عشان نبعتلك رمز التحقق',
    }
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

  /*
    نص مكتوب هنا لا قالب التاجر: قالب `otp` بتاع الواتساب مكتوب لرمز
    **الدخول** («رمز دخولك على…»)، والعميل هنا بيأكّد طلبًا مش بيسجّل
    دخول. إعادة استخدامه كانت هتوصّله جملة مالهاش علاقة باللي هو فيه.
  */
  if (canWhatsapp) {
    const wa = await sendWhatsapp(
      input.storeId,
      input.phone,
      `رمز تأكيد طلبك من ${input.storeName}: ${code}\nصالح ${TTL_MINUTES} دقايق. لو مش إنت اللي طلبت، تجاهل الرسالة.`,
      { event: 'order_otp' },
    )
    if (wa.ok) return { ok: true, channel: 'whatsapp', maskedTarget: maskPhone(input.phone) }
  }

  if (canEmail && input.email) {
    const sent = await sendEmail({
      sender: { name: input.storeName, slug: input.storeSlug },
      log: { storeId: input.storeId, event: 'order_otp' },
      to: input.email,
      subject: `رمز تأكيد طلبك من ${input.storeName}`,
      html: `<div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;max-width:420px;margin:0 auto;padding:24px;">
      <p style="font-size:15px;color:#222540;">رمز تأكيد طلبك من <strong>${input.storeName}</strong>:</p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:6px;text-align:center;color:#222540;margin:24px 0;">${code}</p>
      <p style="font-size:13px;color:#5c6890;">الرمز صالح لمدة ${TTL_MINUTES} دقايق. لو مش إنت اللي طلبت، تجاهل الرسالة.</p>
    </div>`,
      text: `رمز تأكيد طلبك من ${input.storeName}: ${code}\nصالح ${TTL_MINUTES} دقايق.`,
    })
    if (sent.ok) return { ok: true, channel: 'email', maskedTarget: maskEmail(input.email) }
  }

  /*
    الوسيلة كانت متاحة والإرسال نفسه وقع (جلسة واتساب اتفصلت، مزوّد
    بريد رفض). الفشل بيرجع للعميل بدل ما يفضل قدام خانة رمز عمره ما
    هييجي — والسبب متسجّل في سجل الرسايل للتاجر.
  */
  return { ok: false, error: 'ما قدرناش نبعت الرمز دلوقتي. جرّب تاني بعد شوية.' }
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

/** يخفي وسط الرقم — بيأكّد للعميل إنه الصح من غير ما نكشفه كامل */
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `${digits.slice(0, 4)}${'*'.repeat(Math.max(0, digits.length - 7))}${digits.slice(-3)}`
}

function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const shown = user.slice(0, 2)
  return `${shown}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`
}
