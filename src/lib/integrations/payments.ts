import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { apiFetch, digits, toMajor } from './http'
import type { ProviderCreds } from '@/lib/provider-store'

/**
 * إنشاء جلسة دفع عند البوابة.
 *
 * **ده الجزء اللي بيحوّل «مربوطة» لـ«شغّالة».** التاجر بيحطّ مفاتيحه،
 * وهنا بنستخدمها فعلًا: بننشئ عملية عند البوابة بمبلغ الطلب، وبنرجّع
 * الرابط اللي العميل بيتحوّل عليه. الفلوس بتنزل حساب التاجر عند
 * البوابة مباشرة — إحنا ما بنمرّش بفلوس حد.
 *
 * **الطلب ما بيتعلّمش «مدفوع» هنا.** الرابط ده بيوصّل العميل لصفحة
 * الدفع بس. اللي بيأكّد الدفع هو الويب هوك الموقّع (`/api/webhooks/pay/…`)
 * — لأن العميل ممكن يقفل الصفحة، أو يفتح رابط النجاح من غير ما يدفع.
 *
 * كل بوابة وطريقتها: واحدة بتاخد تلات نداءات (باي موب)، وواحدة رابط
 * موقّع من غير أي نداء (كاشير). الشكل المشترك هنا هو `PaymentSession`
 * بس — التوحيد القسري كان هيخفي فروقًا بتفرق فعلًا.
 */

export type PaymentOrder = {
  id: string
  orderNumber: number
  /** بالقرش */
  total: number
  currency: string
  customerName: string | null
  customerPhone: string
  customerEmail: string | null
  city: string | null
  street: string | null
  building: string | null
  items: Array<{ name: string; quantity: number; price: number }>
}

export type PaymentSession =
  | { ok: true; redirectUrl: string; reference: string | null; raw: unknown }
  | { ok: false; error: string; raw?: unknown }

type Ctx = {
  creds: ProviderCreds
  order: PaymentOrder
  /** صفحة الطلب عندنا — البوابة بترجّع العميل عليها بعد ما يخلّص */
  returnUrl: string
  /** رابط الويب هوك المطلق — بعض البوابات بتاخده مع الطلب */
  webhookUrl: string
  storeName: string
}

/** رقم مرجعي فريد للمحاولة — لو العميل حاول مرتين، البوابة بترفض التكرار */
function merchantRef(order: PaymentOrder): string {
  return `${order.orderNumber}-${Date.now().toString(36)}`
}

/** رقم الطلب من المرجع — الويب هوك بيقراه بنفس الطريقة */
export function orderNumberFromRef(ref: string): number {
  const n = Number(String(ref).split('-')[0]?.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}

export async function createPaymentSession(slug: string, ctx: Ctx): Promise<PaymentSession> {
  switch (slug) {
    case 'paymob':
      return paymob(ctx)
    case 'fawry':
      return fawry(ctx)
    case 'kashier':
      return kashier(ctx)
    case 'myfatoorah':
      return myfatoorah(ctx)
    case 'stripe':
      return stripe(ctx)
    case 'tabby':
      return tabby(ctx)
    case 'tamara':
      return tamara(ctx)
    case 'paypal':
      return paypal(ctx)
    default:
      return { ok: false, error: 'البوابة دي مش مدعومة للدفع الأونلاين' }
  }
}

/* ═══════════════════════════ باي موب ═══════════════════════════ */

/**
 * تلات نداءات بالترتيب: توكن دخول ← تسجيل الطلب ← مفتاح الدفع.
 * الاتنين الأولانيين ما بيرجّعوش صفحة — لو وقفنا عند أي واحد فيهم،
 * العميل بيشوف زرار دفع ما بيفتحش حاجة.
 */
async function paymob(ctx: Ctx): Promise<PaymentSession> {
  const { secrets, values } = ctx.creds
  const { order } = ctx

  const auth = await apiFetch<{ token: string }>('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST',
    json: { api_key: secrets.apiKey },
  })
  if (!auth.ok) return { ok: false, error: `باي موب رفض المفتاح: ${auth.error}`, raw: auth.data }

  const token = auth.data.token
  const ref = merchantRef(order)

  const reg = await apiFetch<{ id: number }>(
    'https://accept.paymob.com/api/ecommerce/orders',
    {
      method: 'POST',
      json: {
        auth_token: token,
        delivery_needed: false,
        amount_cents: order.total,
        currency: order.currency,
        merchant_order_id: ref,
        items: order.items.map((i) => ({
          name: i.name.slice(0, 50),
          amount_cents: i.price,
          description: i.name.slice(0, 100),
          quantity: i.quantity,
        })),
      },
    },
  )
  if (!reg.ok) return { ok: false, error: `باي موب ما سجّلش الطلب: ${reg.error}`, raw: reg.data }

  const [first, ...rest] = (order.customerName ?? 'عميل').trim().split(/\s+/)

  /*
    باي موب بيرفض الحقول الفاضية في billing_data — «NA» هي القيمة
    اللي بيقبلها كـ«مش متوفر». الفاضي بيرجّع 400 من غير سبب واضح.
  */
  const na = (v: string | null | undefined) => (v && v.trim() ? v.trim().slice(0, 50) : 'NA')

  const key = await apiFetch<{ token: string }>(
    'https://accept.paymob.com/api/acceptance/payment_keys',
    {
      method: 'POST',
      json: {
        auth_token: token,
        amount_cents: order.total,
        expiration: 3600,
        order_id: reg.data.id,
        currency: order.currency,
        integration_id: Number(values.integrationIdCard),
        lock_order_when_paid: true,
        billing_data: {
          first_name: na(first),
          last_name: na(rest.join(' ')),
          email: na(order.customerEmail) === 'NA' ? 'NA@NA.com' : order.customerEmail,
          phone_number: digits(order.customerPhone),
          country: 'EG',
          city: na(order.city),
          street: na(order.street),
          building: na(order.building),
          apartment: 'NA',
          floor: 'NA',
          state: na(order.city),
          postal_code: 'NA',
          shipping_method: 'NA',
        },
      },
    },
  )
  if (!key.ok) return { ok: false, error: `باي موب ما أصدرش مفتاح الدفع: ${key.error}`, raw: key.data }

  if (!values.iframeId) {
    return { ok: false, error: 'iFrame ID ناقص في إعدادات باي موب' }
  }

  return {
    ok: true,
    redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${values.iframeId}?payment_token=${key.data.token}`,
    reference: String(reg.data.id),
    raw: { orderId: reg.data.id, merchantRef: ref },
  }
}

/* ═══════════════════════════ فوري ═══════════════════════════ */

/**
 * فوري بيوقّع الطلب بـSHA-256 على حقول مرصوصة بترتيب معيّن،
 * والسعر لازم يبقى برقمين عشريين بالظبط — «100» بترفض و«100.00» بتعدّي.
 */
async function fawry(ctx: Ctx): Promise<PaymentSession> {
  const { secrets, values, testMode } = ctx.creds
  const { order } = ctx

  const base = testMode ? 'https://atfawry.fawrystaging.com' : 'https://www.atfawry.com'
  const merchantCode = values.merchantCode ?? ''
  const ref = merchantRef(order)
  const profileId = digits(order.customerPhone) || String(order.orderNumber)

  const items = [
    {
      itemId: `order-${order.orderNumber}`,
      description: `طلب رقم ${order.orderNumber} — ${ctx.storeName}`.slice(0, 100),
      price: Number(toMajor(order.total)),
      quantity: 1,
    },
  ]

  const signSource =
    merchantCode +
    ref +
    profileId +
    ctx.returnUrl +
    items.map((i) => `${i.itemId}${i.quantity}${i.price.toFixed(2)}`).join('') +
    (secrets.securityKey ?? '')

  const signature = createHash('sha256').update(signSource).digest('hex')

  const res = await apiFetch<string | { statusDescription?: string }>(
    `${base}/ECommerceWeb/api/payments/init`,
    {
      method: 'POST',
      json: {
        merchantCode,
        merchantRefNum: ref,
        customerProfileId: profileId,
        customerName: order.customerName ?? 'عميل',
        customerMobile: digits(order.customerPhone),
        customerEmail: order.customerEmail || undefined,
        paymentExpiry: Date.now() + Number(values.expiryHours || 24) * 3600_000,
        language: 'ar-eg',
        chargeItems: items,
        returnUrl: ctx.returnUrl,
        authCaptureModePayment: false,
        signature,
      },
    },
  )

  if (!res.ok) return { ok: false, error: `فوري رفض الطلب: ${res.error}`, raw: res.data }

  // الرد رابط نصّي خام لا JSON
  const url = typeof res.data === 'string' ? res.data.trim() : ''
  if (!url.startsWith('http')) {
    return { ok: false, error: 'فوري ما رجّعش رابط دفع صالح', raw: res.data }
  }

  return { ok: true, redirectUrl: url, reference: ref, raw: { merchantRef: ref } }
}

/* ═══════════════════════════ كاشير ═══════════════════════════ */

/**
 * كاشير مالوش نداء إنشاء — الرابط نفسه موقّع.
 *
 * يعني مفيش رحلة للخادم بتاعهم، فالشيك أوت ما بيبطّأش خالص. التوقيع
 * على «معرّف التاجر ورقم الطلب والمبلغ والعملة» — أي تعديل في الرابط
 * بيبطّل التوقيع.
 */
function kashier(ctx: Ctx): PaymentSession {
  const { secrets, values, testMode } = ctx.creds
  const { order } = ctx

  const mid = values.merchantId ?? ''
  const ref = merchantRef(order)
  const amount = toMajor(order.total)

  if (!mid || !secrets.secretKey) {
    return { ok: false, error: 'إعدادات كاشير ناقصة (Merchant ID أو Secret Key)' }
  }

  const path = `/?payment=${mid}.${ref}.${amount}.${order.currency}`
  const hash = createHmac('sha256', secrets.secretKey).update(path).digest('hex')

  const params = new URLSearchParams({
    merchantId: mid,
    orderId: ref,
    amount,
    currency: order.currency,
    hash,
    mode: testMode ? 'test' : 'live',
    merchantRedirect: ctx.returnUrl,
    serverWebhook: ctx.webhookUrl,
    metaData: JSON.stringify({ orderNumber: order.orderNumber }),
    allowedMethods: 'card,wallet,bank_installments',
    display: 'ar',
    type: 'external',
    redirectMethod: 'get',
  })

  return {
    ok: true,
    redirectUrl: `https://payments.kashier.io/?${params.toString()}`,
    reference: ref,
    raw: { merchantRef: ref },
  }
}

/* ═════════════════════════ ماي فاتورة ═════════════════════════ */

async function myfatoorah(ctx: Ctx): Promise<PaymentSession> {
  const { secrets, testMode } = ctx.creds
  const { order } = ctx

  const base = testMode ? 'https://apitest.myfatoorah.com' : 'https://api.myfatoorah.com'
  const ref = merchantRef(order)

  const res = await apiFetch<{ Data?: { InvoiceURL?: string; InvoiceId?: number } }>(
    `${base}/v2/SendPayment`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.apiToken ?? ''}` },
      json: {
        CustomerName: order.customerName ?? 'عميل',
        NotificationOption: 'LNK',
        InvoiceValue: Number(toMajor(order.total)),
        DisplayCurrencyIso: order.currency,
        CustomerMobile: digits(order.customerPhone).slice(-11),
        CustomerEmail: order.customerEmail || undefined,
        CallBackUrl: ctx.returnUrl,
        ErrorUrl: ctx.returnUrl,
        Language: 'AR',
        CustomerReference: ref,
        InvoiceItems: order.items.map((i) => ({
          ItemName: i.name.slice(0, 100),
          Quantity: i.quantity,
          UnitPrice: Number(toMajor(i.price)),
        })),
      },
    },
  )

  if (!res.ok) return { ok: false, error: `ماي فاتورة رفضت الطلب: ${res.error}`, raw: res.data }

  const url = res.data.Data?.InvoiceURL
  if (!url) return { ok: false, error: 'ماي فاتورة ما رجّعتش رابط دفع', raw: res.data }

  return { ok: true, redirectUrl: url, reference: String(res.data.Data?.InvoiceId ?? ref), raw: res.data }
}

/* ═══════════════════════════ سترايب ═══════════════════════════ */

async function stripe(ctx: Ctx): Promise<PaymentSession> {
  const { secrets } = ctx.creds
  const { order } = ctx
  const ref = merchantRef(order)

  /*
    سترايب بياخد form-encoded لا JSON، والمصفوفات بتتكتب بأقواس
    مرقّمة. المبلغ بالوحدة الصغرى زي عندنا بالظبط، فمفيش تحويل.
  */
  const form: Record<string, string> = {
    mode: 'payment',
    success_url: ctx.returnUrl,
    cancel_url: ctx.returnUrl,
    client_reference_id: ref,
    'metadata[orderNumber]': String(order.orderNumber),
    'payment_intent_data[metadata][orderNumber]': String(order.orderNumber),
  }

  order.items.forEach((item, i) => {
    form[`line_items[${i}][quantity]`] = String(item.quantity)
    form[`line_items[${i}][price_data][currency]`] = order.currency.toLowerCase()
    form[`line_items[${i}][price_data][unit_amount]`] = String(item.price)
    form[`line_items[${i}][price_data][product_data][name]`] = item.name.slice(0, 100)
  })

  if (order.customerEmail) form.customer_email = order.customerEmail

  const res = await apiFetch<{ url?: string; id?: string }>(
    'https://api.stripe.com/v1/checkout/sessions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.secretKey ?? ''}` },
      form,
    },
  )

  if (!res.ok) return { ok: false, error: `سترايب رفض الطلب: ${res.error}`, raw: res.data }
  if (!res.data.url) return { ok: false, error: 'سترايب ما رجّعش رابط دفع', raw: res.data }

  return { ok: true, redirectUrl: res.data.url, reference: res.data.id ?? ref, raw: res.data }
}

/* ═══════════════════════════ تابي ═══════════════════════════ */

async function tabby(ctx: Ctx): Promise<PaymentSession> {
  const { secrets, values } = ctx.creds
  const { order } = ctx
  const ref = merchantRef(order)

  const res = await apiFetch<{
    id?: string
    status?: string
    configuration?: {
      available_products?: { installments?: Array<{ web_url?: string }> }
    }
  }>('https://api.tabby.ai/api/v2/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secrets.secretKey ?? ''}` },
    json: {
      payment: {
        amount: toMajor(order.total),
        currency: order.currency,
        description: `طلب رقم ${order.orderNumber}`,
        buyer: {
          phone: digits(order.customerPhone),
          email: order.customerEmail || 'na@example.com',
          name: order.customerName ?? 'عميل',
        },
        shipping_address: {
          city: order.city ?? '',
          address: [order.street, order.building].filter(Boolean).join(' ') || '-',
        },
        order: {
          reference_id: ref,
          items: order.items.map((i) => ({
            title: i.name.slice(0, 100),
            quantity: i.quantity,
            unit_price: toMajor(i.price),
            category: 'general',
          })),
        },
      },
      lang: 'ar',
      merchant_code: values.merchantCode ?? '',
      merchant_urls: { success: ctx.returnUrl, cancel: ctx.returnUrl, failure: ctx.returnUrl },
    },
  })

  if (!res.ok) return { ok: false, error: `تابي رفض الطلب: ${res.error}`, raw: res.data }

  const url = res.data.configuration?.available_products?.installments?.[0]?.web_url
  if (!url) {
    /*
      تابي بيرفض عملاء بعينهم حسب تقييمهم — الرفض ده مش خطأ في
      الإعداد. التاجر لازم يقرا السبب الصح بدل ما يفضل يدوّر في
      مفاتيحه.
    */
    return {
      ok: false,
      error: 'تابي مش متاح للعميل ده على الطلب ده. يقدر يكمّل بطريقة دفع تانية.',
      raw: res.data,
    }
  }

  return { ok: true, redirectUrl: url, reference: res.data.id ?? ref, raw: res.data }
}

/* ═══════════════════════════ تمارا ═══════════════════════════ */

async function tamara(ctx: Ctx): Promise<PaymentSession> {
  const { secrets, testMode } = ctx.creds
  const { order } = ctx
  const ref = merchantRef(order)

  const base = testMode ? 'https://api-sandbox.tamara.co' : 'https://api.tamara.co'

  const res = await apiFetch<{ checkout_url?: string; order_id?: string }>(`${base}/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secrets.apiToken ?? ''}` },
    json: {
      order_reference_id: ref,
      total_amount: { amount: Number(toMajor(order.total)), currency: order.currency },
      description: `طلب رقم ${order.orderNumber}`,
      country_code: 'EG',
      payment_type: 'PAY_BY_INSTALMENTS',
      locale: 'ar_EG',
      items: order.items.map((i) => ({
        reference_id: i.name.slice(0, 40),
        type: 'Physical',
        name: i.name.slice(0, 100),
        sku: i.name.slice(0, 40),
        quantity: i.quantity,
        unit_price: { amount: Number(toMajor(i.price)), currency: order.currency },
        total_amount: { amount: Number(toMajor(i.price * i.quantity)), currency: order.currency },
      })),
      consumer: {
        first_name: (order.customerName ?? 'عميل').split(/\s+/)[0],
        last_name: (order.customerName ?? '').split(/\s+/).slice(1).join(' ') || '-',
        phone_number: digits(order.customerPhone),
        email: order.customerEmail || 'na@example.com',
      },
      shipping_address: {
        first_name: (order.customerName ?? 'عميل').split(/\s+/)[0],
        last_name: (order.customerName ?? '').split(/\s+/).slice(1).join(' ') || '-',
        line1: [order.street, order.building].filter(Boolean).join(' ') || '-',
        city: order.city ?? '-',
        country_code: 'EG',
      },
      merchant_url: {
        success: ctx.returnUrl,
        failure: ctx.returnUrl,
        cancel: ctx.returnUrl,
        notification: ctx.webhookUrl,
      },
    },
  })

  if (!res.ok) return { ok: false, error: `تمارا رفضت الطلب: ${res.error}`, raw: res.data }
  if (!res.data.checkout_url) {
    return { ok: false, error: 'تمارا ما رجّعتش رابط دفع', raw: res.data }
  }

  return {
    ok: true,
    redirectUrl: res.data.checkout_url,
    reference: res.data.order_id ?? ref,
    raw: res.data,
  }
}

/* ═══════════════════════════ باي بال ═══════════════════════════ */

async function paypal(ctx: Ctx): Promise<PaymentSession> {
  const { secrets, values, testMode } = ctx.creds
  const { order } = ctx
  const ref = merchantRef(order)

  const base = testMode ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  const basic = Buffer.from(`${values.clientId ?? ''}:${secrets.clientSecret ?? ''}`).toString('base64')

  const auth = await apiFetch<{ access_token?: string }>(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
    form: { grant_type: 'client_credentials' },
  })
  if (!auth.ok || !auth.data.access_token) {
    return { ok: false, error: `باي بال رفض المفاتيح: ${auth.ok ? 'مفيش توكن' : auth.error}` }
  }

  const res = await apiFetch<{ id?: string; links?: Array<{ rel: string; href: string }> }>(
    `${base}/v2/checkout/orders`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.data.access_token}` },
      json: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: ref,
            custom_id: String(order.orderNumber),
            amount: { currency_code: order.currency, value: toMajor(order.total) },
          },
        ],
        application_context: {
          return_url: ctx.returnUrl,
          cancel_url: ctx.returnUrl,
          brand_name: ctx.storeName.slice(0, 60),
          user_action: 'PAY_NOW',
        },
      },
    },
  )

  if (!res.ok) return { ok: false, error: `باي بال رفض الطلب: ${res.error}`, raw: res.data }

  const approve = res.data.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')
  if (!approve) return { ok: false, error: 'باي بال ما رجّعش رابط موافقة', raw: res.data }

  return { ok: true, redirectUrl: approve.href, reference: res.data.id ?? ref, raw: res.data }
}
