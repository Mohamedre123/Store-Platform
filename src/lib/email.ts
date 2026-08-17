import 'server-only'

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

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<SendResult> {
  const { to, subject, html, text } = options

  if (!isEmailConfigured()) {
    console.warn(
      `[البريد غير مضبوط] كان المفروض تُرسل رسالة إلى ${to} بعنوان: ${subject}\n` +
        (text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    )
    return { ok: false, error: 'not_configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('فشل إرسال البريد:', res.status, body)
      return { ok: false, error: `provider_${res.status}` }
    }

    const data = (await res.json()) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('خطأ في إرسال البريد:', err)
    return { ok: false, error: 'network' }
  }
}

export { verificationEmail, welcomeEmail } from './email-templates'
