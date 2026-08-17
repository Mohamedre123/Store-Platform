import 'server-only'
import { brand } from './brand'

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

/* ────────────────────────── القوالب ────────────────────────── */

/**
 * قالب بسيط متوافق مع عملاء البريد.
 * جداول وأنماط مضمّنة عمدًا — Outlook وجيميل بيتجاهلوا كتيرًا من CSS الحديث.
 */
function wrap(inner: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f6f6f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#222540;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e4ec;border-radius:14px;">
    <tr><td style="padding:32px 28px;">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.3px;margin-bottom:24px;">${brand.name}</div>
      ${inner}
    </td></tr>
  </table>
  <p style="max-width:480px;margin:16px auto 0;text-align:center;font-size:12px;color:#8a92ad;">
    ${brand.name} — ${brand.tagline}
  </p>
</body></html>`
}

export function verificationEmail(code: string, name?: string) {
  const greeting = name ? `أهلًا ${name}،` : 'أهلًا،'
  return {
    subject: `${code} — رمز تأكيد حسابك في ${brand.name}`,
    html: wrap(`
      <p style="margin:0 0 16px;font-size:15px;line-height:1.9;">${greeting}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.9;">
        ده رمز تأكيد بريدك. اكتبه في الصفحة عشان تكمّل تفعيل حسابك:
      </p>
      <div style="margin:0 0 20px;padding:18px;background:#f5f3fa;border:1px solid #d5cdea;border-radius:10px;text-align:center;">
        <span style="font-size:32px;font-weight:700;letter-spacing:10px;color:#634b9a;direction:ltr;display:inline-block;">${code}</span>
      </div>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.8;color:#5c6890;">
        الرمز صالح لمدة ١٠ دقايق.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.8;color:#8a92ad;">
        لو مش إنت اللي طلبت الرمز ده، تجاهل الرسالة ومحدش هيقدر يستخدم حسابك.
      </p>
    `),
    text: `${greeting}\n\nرمز تأكيد بريدك في ${brand.name}: ${code}\nصالح لمدة ١٠ دقائق.\n\nلو مش إنت اللي طلبته، تجاهل الرسالة.`,
  }
}
