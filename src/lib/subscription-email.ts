import { brand } from './brand'
import { COLORS, SITE, layout } from './email-templates'

/**
 * رسايل الاشتراك للتاجر — بهوية المنصة وموجّهة لمتجره.
 *
 * نفس قواعد `email-templates.ts`: جداول وأنماط مضمّنة، نسخة نصية كاملة،
 * ومن غير أي نص مخفي. العنوان من غير رموز تعبيرية ولا «عاجل» ولا
 * علامات تعجّب — الحاجات دي بالذات اللي فلاتر السبام بتعدّها على رسايل
 * التجديد والتذكير.
 */

export type SubscriptionNoticeKind =
  | 'trial_started'
  | 'activated'
  | 'renewed'
  | 'reminder'
  | 'expired'
  | 'trial_ended'
  | 'cancelled'

/** اسم المتجر واسم التاجر كتبهم هو — ما يدخلوش الـHTML خام */
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const arNum = (n: number) => n.toLocaleString('ar-EG')

export function daysWord(n: number): string {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return 'يومين'
  if (n <= 10) return `${arNum(n)} أيام`
  return `${arNum(n)} يوم`
}

/** التاريخ بالعربي بتوقيت مصر — «١٥ سبتمبر ٢٠٢٦» */
export function formatArDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Cairo',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function button(href: string, label: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 0;">
      <tr>
        <td align="center" style="background-color:${COLORS.primary};border-radius:10px;">
          <a href="${href}" style="display:inline-block;padding:13px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`
}

function details(rows: Array<[string, string]>) {
  const cells = rows
    .map(([k, v], i) => {
      const line = i ? 'border-top:1px solid #e3dcf0;' : ''
      return `
      <tr>
        <td style="padding:12px 16px;${line}font-size:13px;color:${COLORS.muted};">${k}</td>
        <td align="left" style="padding:12px 16px;${line}font-size:14px;font-weight:700;color:${COLORS.ink};">${v}</td>
      </tr>`
    })
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;background-color:${COLORS.primarySoft};border:1px solid #d8cfec;border-radius:12px;">
      ${cells}
    </table>`
}

export function subscriptionEmail(input: {
  kind: SubscriptionNoticeKind
  ownerName: string
  storeName: string
  planName: string
  until: Date
  daysLeft: number
  /** للتذكير والانتهاء: التجربة ولا باقة مدفوعة */
  trial: boolean
  dashboardLink: string
  subscriptionLink: string
}) {
  const store = esc(input.storeName)
  const name = esc(input.ownerName || '')
  const plan = esc(input.planName)
  const date = formatArDate(input.until)
  const greeting = name ? `أهلًا ${name}،` : 'أهلًا،'
  const strong = (s: string) => `<strong style="color:${COLORS.ink};">${s}</strong>`
  const p = (s: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.9;color:${COLORS.muted};">${s}</p>`

  let subject = ''
  let lead = ''
  let body = ''
  let rows: Array<[string, string]> = []
  let cta = { href: input.dashboardLink, label: 'افتح لوحة متجرك' }
  let summary = ''

  switch (input.kind) {
    case 'trial_started':
      subject = `تجربتك المجانية في ${brand.name} بدأت — ${daysWord(input.daysLeft)} بكل المميزات`
      lead = 'هديتك وصلت: تجربة مجانية بكل المميزات'
      body =
        p(
          `فعّلنا لمتجر ${strong(store)} تجربة مجانية لمدة ${strong(daysWord(input.daysLeft))} بكل مميزات ${brand.name}، من غير ما تدفع أي حاجة.`,
        ) + p('جرّب أدوات الذكاء الاصطناعي وصفحات الهبوط وربط نطاقك الخاص، وابدأ استقبل طلباتك.')
      rows = [
        ['الباقة', 'تجربة مجانية'],
        ['تنتهي يوم', date],
      ]
      summary = `تجربتك المجانية لمتجر ${input.storeName} بدأت لمدة ${daysWord(input.daysLeft)} وتنتهي يوم ${date}.`
      break

    case 'activated':
      subject = `اشتراك متجرك ${input.storeName} في ${brand.name} اتفعّل`
      lead = 'اشتراكك اتفعّل بنجاح'
      body =
        p(`شكرًا لثقتك. فعّلنا ${strong(plan)} لمتجر ${strong(store)}، وكل المميزات بقت مفتوحة دلوقتي.`) +
        p('لو احتجت أي مساعدة وإنت بتجهّز متجرك، رُد على الرسالة دي.')
      rows = [
        ['الباقة', plan],
        ['المدة', daysWord(input.daysLeft)],
        ['صالح لحد', date],
      ]
      summary = `فعّلنا ${input.planName} لمتجر ${input.storeName}. الاشتراك صالح لحد ${date}.`
      break

    case 'renewed':
      subject = `اشتراك متجرك ${input.storeName} اتجدّد لحد ${date}`
      lead = 'اشتراكك اتجدّد بنجاح'
      body =
        p(`جدّدنا ${strong(plan)} لمتجر ${strong(store)}، ومتجرك هيفضل شغّال بكل مميزاته من غير أي انقطاع.`) +
        p('ولو كان فاضل أيام من اشتراكك القديم، اتضافت على المدة الجديدة.')
      rows = [
        ['الباقة', plan],
        ['صالح لحد', date],
      ]
      summary = `جدّدنا ${input.planName} لمتجر ${input.storeName}. الاشتراك صالح لحد ${date}.`
      break

    case 'reminder': {
      const left = input.daysLeft <= 1 ? 'بكرة' : `بعد ${daysWord(input.daysLeft)}`
      subject = input.trial
        ? `تجربتك المجانية لمتجر ${input.storeName} بتنتهي ${left}`
        : `اشتراك متجرك ${input.storeName} بينتهي ${left}`
      lead = input.daysLeft <= 1 ? 'تنبيه: فاضل يوم واحد' : `تنبيه: فاضل ${daysWord(input.daysLeft)}`
      body = input.trial
        ? p(`تجربتك المجانية لمتجر ${strong(store)} بتنتهي ${strong(left)}، يوم ${date}.`) +
          p('اشترك قبلها عشان أدوات الذكاء الاصطناعي وصفحات الهبوط والطلبات من غير حدود تفضل شغّالة عندك.')
        : p(`اشتراك متجر ${strong(store)} (${plan}) بينتهي ${strong(left)}، يوم ${date}.`) +
          p(
            'جدّد قبل ما الاشتراك يخلص عشان متجرك يفضل شغّال من غير انقطاع. لو الاشتراك انتهى، المميزات المدفوعة بتتوقف لحد ما تجدّد — وبياناتك كلها بتفضل محفوظة.',
          )
      rows = [
        ['الباقة', input.trial ? 'تجربة مجانية' : plan],
        ['ينتهي يوم', date],
      ]
      cta = { href: input.subscriptionLink, label: input.trial ? 'اشترك دلوقتي' : 'جدّد اشتراكك' }
      summary = input.trial
        ? `تجربتك المجانية لمتجر ${input.storeName} بتنتهي ${left} (${date}).`
        : `اشتراك متجر ${input.storeName} بينتهي ${left} (${date}). جدّد قبلها عشان المميزات ما تتوقفش.`
      break
    }

    case 'expired':
      subject = `اشتراك متجرك ${input.storeName} في ${brand.name} انتهى`
      lead = 'اشتراكك انتهى'
      body =
        p(`اشتراك متجر ${strong(store)} انتهى يوم ${date}، والمميزات المدفوعة اتوقفت.`) +
        p(`${strong('بياناتك ومنتجاتك وطلباتك كلها محفوظة')} — جدّد وكل حاجة بترجع زي ما كانت فورًا.`)
      rows = [
        ['الباقة', plan],
        ['انتهى يوم', date],
      ]
      cta = { href: input.subscriptionLink, label: 'جدّد اشتراكك' }
      summary = `اشتراك متجر ${input.storeName} انتهى يوم ${date}. بياناتك محفوظة — جدّد وترجع كل المميزات فورًا.`
      break

    case 'trial_ended':
      subject = `تجربتك المجانية لمتجر ${input.storeName} انتهت`
      lead = 'التجربة المجانية انتهت'
      body =
        p(`تجربة متجر ${strong(store)} المجانية انتهت يوم ${date}. نتمنى تكون عجبتك.`) +
        p(`اشترك دلوقتي وكمّل بكل المميزات — ${strong('كل اللي عملته في متجرك محفوظ')}.`)
      rows = [['انتهت يوم', date]]
      cta = { href: input.subscriptionLink, label: 'اختار باقتك' }
      summary = `تجربة متجر ${input.storeName} المجانية انتهت يوم ${date}. اشترك وكمّل — كل حاجة محفوظة.`
      break

    case 'cancelled':
      subject = `اشتراك متجرك ${input.storeName} في ${brand.name} اتوقف`
      lead = 'اشتراكك اتوقف'
      body =
        p(`وقفنا اشتراك متجر ${strong(store)}، والمميزات المدفوعة اتقفلت من النهاردة.`) +
        p('لو شايف إن ده حصل بالغلط أو دفعت ومحتاج نراجع، رُد على الرسالة دي وهنتابع معاك على طول.')
      rows = [['تاريخ الإيقاف', date]]
      cta = { href: input.subscriptionLink, label: 'صفحة الاشتراك' }
      summary = `وقفنا اشتراك متجر ${input.storeName}. لو ده حصل بالغلط رُد على الرسالة.`
      break
  }

  const inner = `
    <p style="margin:0 0 6px;font-size:16px;line-height:1.9;font-weight:600;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:19px;line-height:1.7;font-weight:700;color:${COLORS.primary};">${lead}</p>
    ${body}
    ${details(rows)}
    ${button(cta.href, cta.label)}
    <hr style="border:0;border-top:1px solid ${COLORS.border};margin:26px 0 18px;">
    <p style="margin:0;font-size:13px;line-height:1.9;color:${COLORS.subtle};">
      الرسالة دي بخصوص اشتراك متجرك في ${brand.name}، ووصلتك لأنك صاحب الحساب.
    </p>
  `

  return {
    subject,
    html: layout(inner, subject),
    text: [
      input.ownerName ? `أهلًا ${input.ownerName}،` : 'أهلًا،',
      '',
      summary,
      '',
      `${cta.label}: ${cta.href}`,
      '',
      `${brand.name} — ${brand.tagline}`,
      SITE,
    ].join('\n'),
  }
}
