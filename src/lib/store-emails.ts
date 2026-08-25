import 'server-only'
import { formatMoney } from './utils'

/**
 * رسائل بريد متجر التاجر.
 *
 * منفصلة عن قوالب المنصة عمدًا: دي بتروح لعميل التاجر، فلازم تبقى
 * بهوية *المتجر* — اسمه وشعاره ولونه. مفيش أي ذكر لزاوية جوّه رسالة
 * بيستقبلها عميل مش عارفنا أصلًا.
 *
 * نفس قيود بريد العملاء سارية: تخطيط بجداول، أنماط مضمّنة، والرسالة
 * لازم تُقرأ كاملة والصور محجوبة.
 */

export type StoreBrand = {
  name: string
  logo: string | null
  primary: string
  /**
   * بريد التاجر — بيتكتب في تذييل الرسالة.
   *
   * **لأن `Reply-To` مش دايمًا بيتحط.** لما بريد التاجر يكون على
   * خدمة مجانية (جيميل مثلًا)، الترويسة بتبقى «مرسِل على نطاق وردّ
   * على نطاق تاني» — وهي بصمة تصيّد بتودّي الرسالة السبام. بنشيلها
   * ساعتها، والعميل بيلاقي البريد مكتوبًا هنا فيقدر يكلّم التاجر.
   */
  email?: string | null
}

type OrderLine = {
  name: string
  quantity: number
  total: number
  /**
   * المقاس واللون مفكوكين.
   *
   * الفاتورة اللي مكتوب فيها «تيشيرت» بس مش فاتورة: العميل ما يقدرش
   * يراجع إنه طلب المقاس الصح، والتاجر ما يقدرش يثبت إنه بعت اللي
   * اتطلب. والاسم المدموج «تيشيرت — أحمر / XL» بيتقرا صعب في جدول.
   */
  options?: Array<{ name: string; value: string }>
}

/** «المقاس: XL · اللون: أحمر» — سطر واحد تحت اسم الصنف */
function optionsLine(l: OrderLine): string {
  if (!l.options || l.options.length === 0) return ''
  return l.options.map((o) => `${o.name}: ${o.value}`).join(' · ')
}

type OrderInfo = {
  orderNumber: number
  customerName: string | null
  lines: OrderLine[]
  subtotal: number
  shipping: number
  discount: number
  total: number
  currency: string
  address?: string | null
  phone?: string | null
  trackUrl: string
  /** رسوم الدفع عند الاستلام لو موجودة */
  codFee?: number
  tax?: number
  /** «الدفع عند الاستلام» أو اسم البوابة */
  paymentLabel?: string | null
  shippingLabel?: string | null
  placedAt?: Date | string | null
}

const INK = '#222540'
const MUTED = '#5c6890'
const BORDER = '#e2e4ec'
const PAGE = '#f4f3f9'

function layout(store: StoreBrand, inner: string, preheader: string) {
  const header = store.logo
    ? `<img src="${store.logo}" height="44" alt="${escapeHtml(store.name)}"
           style="display:block;height:44px;width:auto;border:0;outline:none;margin:0 auto;">`
    : `<div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:20px;font-weight:bold;color:${INK};">${escapeHtml(store.name)}</div>`

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(store.name)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;">${header}</td></tr>
      <tr><td style="background-color:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:32px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:${INK};">
        ${inner}
      </td></tr>
      <tr><td align="center" style="padding-top:20px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:12px;line-height:1.8;color:${MUTED};">
        ${escapeHtml(store.name)}
        ${
          store.email
            ? `<br>للتواصل: <a href="mailto:${escapeHtml(store.email)}" style="color:${MUTED};">${escapeHtml(store.email)}</a>`
            : ''
        }
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

function linesTable(lines: OrderLine[], currency: string) {
  return lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${BORDER};font-size:14px;">
          ${escapeHtml(l.name)} <span style="color:${MUTED};">× ${l.quantity}</span>
          ${optionsLine(l) ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;">${escapeHtml(optionsLine(l))}</div>` : ''}
        </td>
        <td align="left" style="padding:8px 0;border-bottom:1px solid ${BORDER};font-size:14px;white-space:nowrap;">
          ${formatMoney(l.total, currency)}
        </td>
      </tr>`,
    )
    .join('')
}

function totalsTable(o: OrderInfo) {
  const row = (label: string, value: string, bold = false) =>
    `<tr>
      <td style="padding:4px 0;font-size:${bold ? '16px' : '14px'};${bold ? 'font-weight:bold;' : `color:${MUTED};`}">${label}</td>
      <td align="left" style="padding:4px 0;font-size:${bold ? '16px' : '14px'};white-space:nowrap;${bold ? 'font-weight:bold;' : ''}">${value}</td>
    </tr>`

  return `
    ${row('المنتجات', formatMoney(o.subtotal, o.currency))}
    ${o.discount > 0 ? row('الخصم', `− ${formatMoney(o.discount, o.currency)}`) : ''}
    ${row('الشحن', o.shipping === 0 ? 'مجاني' : formatMoney(o.shipping, o.currency))}
    ${row('الإجمالي', formatMoney(o.total, o.currency), true)}
  `
}

/**
 * رمز دخول عميل المتجر.
 *
 * بهوية *المتجر* لا هوية المنصة. العميل ده مشترك عند التاجر ومش
 * عارفنا؛ رسالة بشعار حد تاني بتبان تصيّدًا، والعميل ما بيكتبش رمز
 * جاي من جهة ما يعرفهاش — فالرسالة بتتجاهل والدخول ما بيتمّش.
 */
export function customerCodeEmail(store: StoreBrand, code: string, ttlMinutes: number) {
  const spaced = code.split('').join(String.fromCharCode(32))

  const inner = `
    <p style="margin:0 0 8px;font-size:16px;">رمز دخولك على ${escapeHtml(store.name)}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:${MUTED};">
      اكتب الرمز ده في صفحة الدخول عشان تكمّل.
    </p>

    <div style="background-color:#f8f8fc;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
      <span style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:32px;font-weight:bold;letter-spacing:8px;color:${store.primary};">${escapeHtml(spaced)}</span>
    </div>

    <p style="margin:0;font-size:13px;line-height:1.8;color:${MUTED};">
      الرمز صالح ${ttlMinutes} دقايق. لو مش إنت اللي طلبته، تجاهل الرسالة ومحدّش هيقدر يدخل بحسابك.
    </p>`

  return {
    subject: `${code} هو رمز دخولك على ${store.name}`,
    html: layout(store, inner, `رمز دخولك: ${code}`),
    text: `رمز دخولك على ${store.name}: ${code}
صالح ${ttlMinutes} دقايق. لو مش إنت اللي طلبته، تجاهل الرسالة.`,
  }
}
/** تأكيد الطلب — بيروح لعميل التاجر */
export function orderConfirmationEmail(store: StoreBrand, o: OrderInfo) {
  const greeting = o.customerName ? `أهلًا ${escapeHtml(o.customerName)}،` : 'أهلًا،'

  const inner = `
    <p style="margin:0 0 8px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:${MUTED};">
      استلمنا طلبك وهنبدأ نجهّزه. ده ملخّصه:
    </p>

    <div style="background-color:#f8f8fc;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
      <span style="font-size:13px;color:${MUTED};">رقم الطلب</span><br>
      <span style="font-size:20px;font-weight:bold;letter-spacing:1px;">#${o.orderNumber}</span>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      ${linesTable(o.lines, o.currency)}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      ${totalsTable(o)}
    </table>

    ${
      o.address
        ? `<div style="border-top:1px solid ${BORDER};padding-top:16px;margin-bottom:20px;">
             <span style="font-size:13px;color:${MUTED};">عنوان التوصيل</span><br>
             <span style="font-size:14px;line-height:1.7;">${escapeHtml(o.address)}</span>
           </div>`
        : ''
    }

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td align="center" style="border-radius:10px;background-color:${store.primary};">
        <a href="${o.trackUrl}" style="display:inline-block;padding:13px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
          تابع طلبك
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:13px;line-height:1.8;color:${MUTED};text-align:center;">
      لو عندك أي استفسار، رد على الرسالة دي.
    </p>
  `

  const text = [
    `${o.customerName ? `أهلًا ${o.customerName}،` : 'أهلًا،'}`,
    `استلمنا طلبك رقم #${o.orderNumber}.`,
    '',
    ...o.lines.map((l) => `- ${l.name} × ${l.quantity} — ${formatMoney(l.total, o.currency)}`),
    '',
    `الإجمالي: ${formatMoney(o.total, o.currency)}`,
    `تابع طلبك: ${o.trackUrl}`,
  ].join('\n')

  return {
    subject: `تأكيد طلبك #${o.orderNumber} من ${store.name}`,
    html: layout(store, inner, `طلبك #${o.orderNumber} — إجماليه ${formatMoney(o.total, o.currency)}`),
    text,
  }
}

/** إشعار التاجر بطلب جديد */
/**
 * فاتورة الطلب.
 *
 * **بتيجي بعد تأكيد الطلب مباشرةً، وبهوية التاجر.** العميل المصري
 * بيطلب الفاتورة عشان يتطمّن إن اللي دفعه صح، وعشان يكون معاه ورقة
 * لو حصل خلاف على المبلغ. اللي مالوش فاتورة بيتصل يسأل — والتاجر
 * بيقعد يشرح على التليفون.
 *
 * **الكوبون بيظهر كـ«خصم» بس من غير كوده.** الفاتورة بتتصوّر
 * وبتتشيّر، وكود الخصم فيها معناه إن العرض الخاص بيوصل لناس ما
 * كانش المفروض توصلهم.
 */
export function orderInvoiceEmail(store: StoreBrand, o: OrderInfo) {
  const greeting = o.customerName ? `أهلًا ${escapeHtml(o.customerName)}،` : 'أهلًا،'

  const when = o.placedAt
    ? new Date(o.placedAt).toLocaleDateString('ar-EG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const rows = o.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:14px;">
          ${escapeHtml(l.name)}
          <span style="color:${MUTED};"> × ${l.quantity}</span>
          ${optionsLine(l) ? `<div style="font-size:12px;color:${MUTED};margin-top:3px;">${escapeHtml(optionsLine(l))}</div>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:14px;text-align:left;white-space:nowrap;">
          ${formatMoney(l.total, o.currency)}
        </td>
      </tr>`,
    )
    .join('')

  const line = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:6px 0;font-size:${strong ? '16px' : '14px'};${strong ? 'font-weight:bold;' : `color:${MUTED};`}">${label}</td>
      <td style="padding:6px 0;font-size:${strong ? '16px' : '14px'};text-align:left;white-space:nowrap;${strong ? 'font-weight:bold;' : ''}">${value}</td>
    </tr>`

  const inner = `
    <p style="margin:0 0 8px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:${MUTED};">
      دي فاتورة طلبك من ${escapeHtml(store.name)}.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#f8f8fc;border-radius:10px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 16px;">
          <span style="font-size:13px;color:${MUTED};">فاتورة رقم</span><br>
          <span style="font-size:20px;font-weight:bold;letter-spacing:1px;">#${o.orderNumber}</span>
          ${when ? `<div style="font-size:13px;color:${MUTED};margin-top:4px;">${when}</div>` : ''}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
      <tr>
        <td style="padding:0 0 8px;font-size:13px;color:${MUTED};border-bottom:2px solid ${BORDER};">الصنف</td>
        <td style="padding:0 0 8px;font-size:13px;color:${MUTED};text-align:left;border-bottom:2px solid ${BORDER};">الإجمالي</td>
      </tr>
      ${rows}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
      ${line('المنتجات', formatMoney(o.subtotal, o.currency))}
      ${o.discount > 0 ? line('خصم', `− ${formatMoney(o.discount, o.currency)}`) : ''}
      ${line(o.shippingLabel ? `الشحن · ${escapeHtml(o.shippingLabel)}` : 'الشحن', o.shipping > 0 ? formatMoney(o.shipping, o.currency) : 'مجاني')}
      ${o.codFee && o.codFee > 0 ? line('رسوم الدفع عند الاستلام', formatMoney(o.codFee, o.currency)) : ''}
      ${o.tax && o.tax > 0 ? line('ضريبة القيمة المضافة', formatMoney(o.tax, o.currency)) : ''}
      <tr><td colspan="2" style="padding:6px 0;"><div style="border-top:2px solid ${BORDER};"></div></td></tr>
      ${line('الإجمالي', formatMoney(o.total, o.currency), true)}
    </table>

    ${
      o.paymentLabel
        ? `<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">طريقة الدفع: <strong style="color:${INK};">${escapeHtml(o.paymentLabel)}</strong></p>`
        : ''
    }
    ${
      o.address
        ? `<p style="margin:6px 0 0;font-size:14px;color:${MUTED};">التوصيل إلى: <strong style="color:${INK};">${escapeHtml(o.address)}</strong></p>`
        : ''
    }

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr>
        <td align="center">
          <a href="${o.trackUrl}"
             style="display:inline-block;background-color:${store.primary};color:#ffffff;text-decoration:none;
                    padding:13px 30px;border-radius:10px;font-size:15px;font-weight:bold;">
            تابع طلبك
          </a>
        </td>
      </tr>
    </table>
  `

  return {
    subject: `فاتورة طلبك #${o.orderNumber} من ${store.name}`,
    html: layout(store, inner, `فاتورة طلب #${o.orderNumber} — ${formatMoney(o.total, o.currency)}`),
    text: [
      greeting,
      '',
      `فاتورة طلب رقم #${o.orderNumber} من ${store.name}`,
      when,
      '',
      ...o.lines.map(
        (l) =>
          `${l.name} × ${l.quantity} — ${formatMoney(l.total, o.currency)}` +
          (optionsLine(l) ? `\n  (${optionsLine(l)})` : ''),
      ),
      '',
      `المنتجات: ${formatMoney(o.subtotal, o.currency)}`,
      o.discount > 0 ? `خصم: −${formatMoney(o.discount, o.currency)}` : '',
      `الشحن: ${o.shipping > 0 ? formatMoney(o.shipping, o.currency) : 'مجاني'}`,
      o.codFee && o.codFee > 0 ? `رسوم الدفع عند الاستلام: ${formatMoney(o.codFee, o.currency)}` : '',
      o.tax && o.tax > 0 ? `ضريبة: ${formatMoney(o.tax, o.currency)}` : '',
      `الإجمالي: ${formatMoney(o.total, o.currency)}`,
      o.paymentLabel ? `طريقة الدفع: ${o.paymentLabel}` : '',
      '',
      `تابع طلبك: ${o.trackUrl}`,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

export function newOrderNotificationEmail(store: StoreBrand, o: OrderInfo, dashboardUrl: string) {
  const inner = `
    <p style="margin:0 0 20px;font-size:17px;font-weight:bold;">وصلك طلب جديد 🎉</p>

    <div style="background-color:#f8f8fc;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
      <span style="font-size:13px;color:${MUTED};">رقم الطلب</span><br>
      <span style="font-size:20px;font-weight:bold;">#${o.orderNumber}</span>
      <span style="font-size:15px;color:${MUTED};"> — ${formatMoney(o.total, o.currency)}</span>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      ${linesTable(o.lines, o.currency)}
    </table>

    <div style="border-top:1px solid ${BORDER};padding-top:16px;margin-bottom:20px;font-size:14px;line-height:1.8;">
      ${o.customerName ? `<strong>${escapeHtml(o.customerName)}</strong><br>` : ''}
      ${o.phone ? `<span dir="ltr">${escapeHtml(o.phone)}</span><br>` : ''}
      ${o.address ? `<span style="color:${MUTED};">${escapeHtml(o.address)}</span>` : ''}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td align="center" style="border-radius:10px;background-color:${store.primary};">
        <a href="${dashboardUrl}" style="display:inline-block;padding:13px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
          افتح الطلب
        </a>
      </td></tr>
    </table>
  `

  return {
    subject: `طلب جديد #${o.orderNumber} — ${formatMoney(o.total, o.currency)}`,
    html: layout(store, inner, `${o.customerName ?? 'عميل'} طلب بـ${formatMoney(o.total, o.currency)}`),
    text: `طلب جديد #${o.orderNumber} بإجمالي ${formatMoney(o.total, o.currency)}.\nافتح الطلب: ${dashboardUrl}`,
  }
}

/* ────────────────────────── تحديث حالة الطلب ────────────────────────── */

type StatusKey = 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'

/**
 * نص كل حالة.
 *
 * مكتوبة من زاوية العميل: هو عايز يعرف «طلبي فين ودلوقتي إيه» مش
 * المصطلح التقني. والعنوان بيبان في قائمة الرسائل فبيقول الخبر نفسه.
 */
const STATUS_COPY: Record<StatusKey, { subject: (n: number) => string; title: string; body: string }> = {
  confirmed: {
    subject: (n) => `تأكيد طلبك #${n}`,
    title: 'طلبك اتأكّد ✅',
    body: 'راجعنا طلبك وأكّدناه، وهنبدأ نجهّزه حالًا.',
  },
  processing: {
    subject: (n) => `طلبك #${n} بيتجهّز`,
    title: 'طلبك بيتجهّز 📦',
    body: 'بنحضّر منتجاتك ونغلّفها. هنبعتلك أول ما يخرج للشحن.',
  },
  shipped: {
    subject: (n) => `طلبك #${n} في الطريق`,
    title: 'طلبك اتشحن 🚚',
    body: 'طلبك خرج مع المندوب وفي طريقه ليك. هيتواصل معاك قبل التسليم.',
  },
  delivered: {
    subject: (n) => `اتسلّم طلبك #${n}`,
    title: 'طلبك وصلك 🎉',
    body: 'اتسلّم طلبك بنجاح. نتمنى المنتجات تعجبك، ومستنيينك تاني.',
  },
  cancelled: {
    subject: (n) => `اتلغى طلبك #${n}`,
    title: 'طلبك اتلغى',
    body: 'طلبك اتلغى. لو ده حصل بالغلط أو عندك استفسار، رد على الرسالة دي.',
  },
  returned: {
    subject: (n) => `مرتجع طلبك #${n}`,
    title: 'اتسجّل مرتجع طلبك',
    body: 'استلمنا مرتجع طلبك وبنراجعه. هنتواصل معاك بخصوص الاسترداد.',
  },
}

export function isEmailableStatus(status: string): status is StatusKey {
  return status in STATUS_COPY
}

/** مراحل الطلب المعروضة كخط زمني في الرسالة */
const TIMELINE: Array<{ key: StatusKey; label: string }> = [
  { key: 'confirmed', label: 'اتأكّد' },
  { key: 'processing', label: 'بيتجهّز' },
  { key: 'shipped', label: 'اتشحن' },
  { key: 'delivered', label: 'اتسلّم' },
]

function timelineHtml(current: StatusKey, primary: string) {
  const index = TIMELINE.findIndex((s) => s.key === current)
  if (index < 0) return '' // ملغي/مرتجع — الخط الزمني مالوش معنى

  const cells = TIMELINE.map((step, i) => {
    const done = i <= index
    return `<td align="center" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11px;padding:0 2px;color:${done ? primary : '#b6bccd'};">
      <div style="width:22px;height:22px;line-height:22px;border-radius:11px;margin:0 auto 6px;background-color:${done ? primary : '#e9ebf2'};color:#ffffff;font-weight:bold;">${done ? '✓' : i + 1}</div>
      ${step.label}
    </td>`
  }).join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>${cells}</tr></table>`
}

/** رسالة تغيير حالة الطلب — بهوية المتجر */
export function orderStatusEmail(
  store: StoreBrand,
  status: StatusKey,
  o: { orderNumber: number; customerName: string | null; total: number; currency: string; trackUrl: string; trackingNumber?: string | null; carrier?: string | null },
) {
  const copy = STATUS_COPY[status]
  const greeting = o.customerName ? `أهلًا ${escapeHtml(o.customerName)}،` : 'أهلًا،'

  const tracking =
    status === 'shipped' && o.trackingNumber
      ? `<div style="background-color:#f8f8fc;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
           <span style="font-size:13px;color:${MUTED};">${o.carrier ? escapeHtml(o.carrier) + ' — ' : ''}رقم الشحنة</span><br>
           <span style="font-size:17px;font-weight:bold;letter-spacing:1px;" dir="ltr">${escapeHtml(o.trackingNumber)}</span>
         </div>`
      : ''

  const inner = `
    <p style="margin:0 0 6px;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 18px;font-size:19px;font-weight:bold;">${copy.title}</p>

    ${timelineHtml(status, store.primary)}

    <p style="margin:0 0 20px;font-size:15px;line-height:1.9;color:${MUTED};">${copy.body}</p>

    ${tracking}

    <div style="background-color:#f8f8fc;border-radius:10px;padding:12px 16px;margin-bottom:22px;">
      <span style="font-size:13px;color:${MUTED};">رقم الطلب</span>
      <span style="font-size:17px;font-weight:bold;"> #${o.orderNumber}</span>
      <span style="font-size:14px;color:${MUTED};"> — ${formatMoney(o.total, o.currency)}</span>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td align="center" style="border-radius:10px;background-color:${store.primary};">
        <a href="${o.trackUrl}" style="display:inline-block;padding:13px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
          تفاصيل الطلب
        </a>
      </td></tr>
    </table>
  `

  return {
    subject: `${copy.subject(o.orderNumber)} — ${store.name}`,
    html: layout(store, inner, copy.body),
    text: `${greeting}\n${copy.title}\n${copy.body}\n\nرقم الطلب: #${o.orderNumber}\n${o.trackUrl}`,
  }
}

/**
 * رسالة التاجر بإيده للعميل.
 *
 * **نصّها هو اللي التاجر كتبه، بلا تجميل ولا إضافات.** الرسالة اللي
 * التاجر صاغها بنفسه بتقرا كأنها من بني آدم — ولو لفّيناها في قالب
 * تسويقي بعناوين وأزرار، بترجع تبان آليّة زي أي رسالة مؤتمتة، ودي
 * بالظبط اللي العميل بيتجاهلها.
 *
 * فالقالب هنا حدّه الأدنى: هوية المتجر فوق، النص زي ما هو، وزرار
 * واحد للرابط.
 */
export function merchantMessageEmail(
  store: StoreBrand,
  o: { subject: string; body: string; actionUrl?: string | null; actionLabel?: string },
) {
  /* أسطر النص بتتحوّل لفقرات — الرسالة بسطر واحد طويل بتبقى كتلة */
  const paragraphs = o.body
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block).replace(/\n/g, '<br>'))
    .map(
      (block) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.9;">${block}</p>`,
    )
    .join('')

  const button = o.actionUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0;">
         <tr><td align="center" style="border-radius:10px;background-color:${store.primary};">
           <a href="${o.actionUrl}" style="display:inline-block;padding:13px 30px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
             ${escapeHtml(o.actionLabel ?? 'كمّل طلبك')}
           </a>
         </td></tr>
       </table>`
    : ''

  return {
    subject: o.subject,
    html: layout(store, paragraphs + button, o.body.slice(0, 120)),
    text: o.actionUrl ? `${o.body}\n\n${o.actionUrl}` : o.body,
  }
}

/** تذكير السلة المتروكة */
export function abandonedCartEmail(
  store: StoreBrand,
  o: {
    customerName: string | null
    lines: OrderLine[]
    total: number
    currency: string
    resumeUrl: string
    couponCode?: string | null
    /**
     * الجملة اللي بتقول له وقف فين.
     *
     * «سيبت المنتجات دي في سلتك» بتتقال لواحد ملا عنوانه ووصل
     * للدفع، فتبان إن المتجر مش شايف اللي هو عمله. الجملة المبنية
     * على مرحلته بتقول له الخطوة اللي فاضلة بالظبط.
     */
    stageLine?: string | null
  },
) {
  const greeting = o.customerName ? `أهلًا ${escapeHtml(o.customerName)}،` : 'أهلًا،'

  const coupon = o.couponCode
    ? `<div style="border:1px dashed ${store.primary};border-radius:10px;padding:14px;text-align:center;margin-bottom:22px;">
         <span style="font-size:13px;color:${MUTED};">كود خصم ليك</span><br>
         <span style="font-size:20px;font-weight:bold;letter-spacing:2px;color:${store.primary};">${escapeHtml(o.couponCode)}</span>
       </div>`
    : ''

  const inner = `
    <p style="margin:0 0 6px;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 18px;font-size:19px;font-weight:bold;">سلتك لسه مستنياك 🛒</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.9;color:${MUTED};">
      ${o.stageLine ? escapeHtml(o.stageLine) : 'سيبت المنتجات دي في سلتك ومكمّلتش الطلب. لسه موجودة — كمّل في ثانية.'}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      ${linesTable(o.lines, o.currency)}
    </table>

    ${coupon}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td align="center" style="border-radius:10px;background-color:${store.primary};">
        <a href="${o.resumeUrl}" style="display:inline-block;padding:13px 30px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
          كمّل طلبك
        </a>
      </td></tr>
    </table>
  `

  return {
    subject: `سلتك في ${store.name} لسه مستنياك`,
    html: layout(store, inner, `${o.lines.length} منتج في سلتك بإجمالي ${formatMoney(o.total, o.currency)}`),
    text: `${greeting}\nسلتك لسه مستنياك.\n\n${o.lines.map((l) => `- ${l.name} × ${l.quantity}`).join('\n')}\n\nكمّل طلبك: ${o.resumeUrl}`,
  }
}
