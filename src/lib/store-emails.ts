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

type StoreBrand = {
  name: string
  logo: string | null
  primary: string
}

type OrderLine = { name: string; quantity: number; total: number }

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
