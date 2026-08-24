import 'server-only'
import { db } from '@/db'
import { messageLog } from '@/db/schema'
import { toPlainText } from './email-plain'

/**
 * إرسال البريد.
 *
 * المزوّد الحالي Resend عبر واجهته المباشرة — بدون أي حزمة إضافية.
 * الدالة مكتوبة بحيث يُضاف مزوّد تاني (SMTP مثلًا) بإضافة فرع واحد
 * هنا، من غير ما يتغيّر أي كود بيستدعيها.
 *
 * لو مافيش مزوّد مضبوط، بنطبع الرسالة في السجل بدل ما نفشل — عشان
 * التطوير المحلي يمشي، ويفضل صاحب المنصة قادر يدخل حتى لو الإيميل
 * لسه ما اتظبطش.
 */

export type SendResult = { ok: true; id?: string } | { ok: false; error: string }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

/** بريد إلغاء الاشتراك — بيتقرا من عنوان المرسل نفسه */
function unsubscribeAddress(): string {
  const from = process.env.EMAIL_FROM ?? ''
  return from.match(/<([^>]+)>/)?.[1] ?? (from.trim() || 'no-reply@localhost')
}

export type MessageContext = {
  storeId: string
  /** نوع الرسالة: order_confirmation | abandoned_cart | otp … */
  event: string
  orderId?: string
  customerId?: string
}

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text?: string
  log?: MessageContext
  /** الرد يروح لمين — بريد التاجر عشان العميل يقدر يرد فعلًا */
  replyTo?: string
}): Promise<SendResult> {
  const { to, subject, html, text, log, replyTo } = options

  if (!isEmailConfigured()) {
    console.warn(
      `[البريد غير مضبوط] كان المفروض تُرسل رسالة إلى ${to} بعنوان: ${subject}\n` +
        (text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    )
    await record(log, to, subject, 'failed', { error: 'المزوّد مش مضبوط' })
    return { ok: false, error: 'not_configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      /**
       * الترويسات اللي بتفرق بين «وارد» و«سبام».
       *
       * فلاتر البريد بتقيّم الرسالة على حاجات محدّدة، وإحنا كنا
       * ناقصين تلاتة منها:
       *
       * ١. **نسخة نصّية.** الرسالة HTML بس علامة كلاسيكية على
       *    الإرسال الآلي المجهول. بنولّدها من الـHTML لو مش متوفّرة
       *    بدل ما نبعت من غيرها.
       * ٢. **`Reply-To` حقيقي.** الرسالة اللي مالهاش رد ممكن بتبان
       *    كإشعار من روبوت. بنحطّ بريد التاجر عشان العميل يرد عليه.
       * ٣. **`List-Unsubscribe`.** جيميل بيرفعها لصالح المرسل حتى
       *    في الرسايل المعاملاتية — وجودها بيقول «ده مرسل بيحترم
       *    المستقبل».
       *
       * **الباقي عند صاحب النطاق لا عندنا:** SPF وDKIM وDMARC لازم
       * تتظبط في سجلات DNS، ومن غيرها أي رسالة هتفضل مشكوك فيها
       * مهما عملنا في الكود.
       */
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        html,
        text: text ?? toPlainText(html),
        ...(replyTo ? { reply_to: replyTo } : {}),
        headers: {
          'List-Unsubscribe': `<mailto:${unsubscribeAddress()}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('فشل إرسال البريد:', res.status, body)
      await record(log, to, subject, 'failed', {
        // نص المزوّد بيتحفظ زي ما هو: هو ده اللي بيقول للتاجر إيه
        // الغلط بالظبط (نطاق مش متحقَّق، مفتاح باطل، حد الإرسال)
        error: `${res.status}: ${body.slice(0, 300)}`,
      })
      return { ok: false, error: `provider_${res.status}` }
    }

    const data = (await res.json()) as { id?: string }
    await record(log, to, subject, 'sent', { providerRef: data.id })
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('خطأ في إرسال البريد:', err)
    await record(log, to, subject, 'failed', { error: String(err).slice(0, 300) })
    return { ok: false, error: 'network' }
  }
}

/**
 * قيد الرسالة في السجل.
 *
 * مالوش أي تأثير على نتيجة الإرسال: لو الكتابة نفسها فشلت، الرسالة
 * تكون اتبعتت فعلًا والتاجر ما يصحّش يشوف فشلًا مش حقيقي.
 */
async function record(
  ctx: MessageContext | undefined,
  recipient: string,
  subject: string,
  status: 'sent' | 'failed',
  extra: { providerRef?: string; error?: string },
) {
  if (!ctx) return
  try {
    await db.insert(messageLog).values({
      storeId: ctx.storeId,
      channel: 'email',
      event: ctx.event,
      recipient,
      body: subject,
      status,
      provider: 'resend',
      providerRef: extra.providerRef ?? null,
      errorMessage: extra.error ?? null,
      orderId: ctx.orderId ?? null,
      customerId: ctx.customerId ?? null,
      sentAt: status === 'sent' ? new Date() : null,
    })
  } catch (e) {
    console.error('فشل تسجيل الرسالة:', e)
  }
}

export { verificationEmail, welcomeEmail } from './email-templates'
