/* بيانات وهمية لشاشات إعدادات الطلبات والشيك أوت وواتساب والبريد — بتتغيّر مع الأفعال عشان التجربة تبان */

const swatch = (color) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${color}"/></svg>`)}`

export function orderSettings() {
  return {
    values: {
      manualOrdersEnabled: true,
      manualOversell: false,
      manualCustomPricing: true,
      manualDepositEnabled: false,
      orderPrefix: 'ZW-',
      orderSuffix: '',
      nextOrderNumber: 1043,
    },
  }
}

const PRODUCTS = [
  { id: 'cp1', name: 'شاحن سريع', image: swatch('#60a5fa'), price: 15000, status: 'active' },
  { id: 'cp2', name: 'تغليف هدية', image: null, price: 3000, status: 'active' },
  { id: 'cp3', name: 'جراب موبايل', image: swatch('#f472b6'), price: 12000, status: 'draft' },
  { id: 'cp4', name: 'سماعة بلوتوث', image: swatch('#34d399'), price: 55000, status: 'active' },
]

export function checkoutSettings() {
  return {
    values: {
      fieldName: 'required',
      fieldPhone: 'required',
      fieldEmail: 'optional',
      fieldCity: 'required',
      fieldArea: 'optional',
      fieldStreet: 'required',
      fieldBuilding: 'optional',
      fieldPostalCode: 'hidden',
      fieldCountry: 'hidden',
      fieldNotes: 'optional',
      addressMode: 'structured',
      deliveryMode: 'delivery',
      showCountryCodePicker: true,
      smartMode: true,
      showPaymentSelector: true,
      showCouponField: true,
      quickCheckoutEnabled: true,
      quickCheckoutStyle: 'drawer',
      quickCheckoutShowItems: true,
      whatsappOrderEnabled: true,
      cartUpsellEnabled: true,
      cartUpsellProductIds: ['cp2'],
      minOrderEnabled: true,
      minOrderAmount: 20000,
      otpEnabled: true,
      captureIncompleteOrders: true,
      autoConfirmEnabled: true,
      autoConfirmDelay: 5,
    },
    currency: 'EGP',
    whatsappReady: false,
    storeWhatsapp: null,
    picked: [PRODUCTS[1]],
  }
}

export function checkoutProducts(q) {
  return { products: PRODUCTS.filter((p) => !q || p.name.includes(q)) }
}

const QR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" shape-rendering="crispEdges"><rect width="21" height="21" fill="#fff"/><path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" fill="#000"/><path d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" fill="#fff"/><path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2zM9 2h2v2H9zM8 8h5v2H8zM14 9h2v3h-2zM9 12h2v4H9zM12 14h3v2h-3zM17 14h2v5h-2zM13 18h3v2h-3z" fill="#000"/></svg>',
)}`

const wa = { provider: 'off', hasKey: false, hasAccessToken: false, phoneId: null, polls: 0, templates: { shipped: 'طلبك يا {{اسم_العميل}} خرج 🚚 #{{رقم_الطلب}}' } }

export function whatsapp() {
  const keys = [
    ['otp', 'رمز الدخول', ['اسم_المتجر', 'كود', 'دقايق'], 'رمز دخولك على {{اسم_المتجر}}: {{كود}}\nصالح {{دقايق}} دقايق. لو مش إنت اللي طلبته، تجاهل الرسالة.'],
    ['order_placed', 'استلمنا طلبك', ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الإجمالي', 'طريقة_الدفع', 'الرابط', 'رابط_الفاتورة'], 'أهلًا {{اسم_العميل}} 👋 استلمنا طلبك من {{اسم_المتجر}}\n\nرقم الطلب: #{{رقم_الطلب}}'],
    ['confirmed', 'الطلب اتأكد', ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'], 'طلبك #{{رقم_الطلب}} اتأكد وبنجهّزه دلوقتي ✅\n\n{{الرابط}}'],
    ['shipped', 'اتشحن', ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'], 'طلبك #{{رقم_الطلب}} خرج مع المندوب 🚚 — استنّى مكالمته\n\n{{الرابط}}'],
  ]
  return {
    settings: { provider: wa.provider, hasKey: wa.hasKey, hasAccessToken: wa.hasAccessToken, phoneId: wa.phoneId },
    storePhone: '01012345678',
    hasPlatformToken: false,
    account: { name: 'محمد أحمد', email: 'owner@mail.com' },
    templates: { ...wa.templates },
    templateKeys: keys.map(([key, label, vars, fallback]) => ({ key, label, vars, fallback })),
  }
}

/** أفعال واتساب — بترجع `[status, body]` */
export function whatsappAction(action, body) {
  if (action === 'token') {
    if (String(body.token ?? '').trim().length < 10) return [400, { ok: false, error: 'التوكن قصير أوي — راجعه' }]
    wa.hasAccessToken = true
    return [200, { ok: true, note: 'اتحفظ. اكتب رقمك ودوس اربط.' }]
  }
  if (action === 'link') {
    wa.polls = 0
    return [200, { ok: true, status: 'scan', qrImage: QR }]
  }
  if (action === 'status') {
    wa.polls += 1
    if (wa.polls >= 2) Object.assign(wa, { provider: 'wasender', hasKey: true, phoneId: 'session-1' })
    return [200, { ok: true, status: wa.polls >= 2 ? 'connected' : 'waiting' }]
  }
  if (action === 'unlink') {
    Object.assign(wa, { provider: 'off', hasKey: false, phoneId: null })
    return [200, { ok: true, note: 'الرقم اتفصل' }]
  }
  if (action === 'save') {
    if (body.provider === 'cloud' && !String(body.phoneId ?? '').trim()) return [400, { ok: false, error: 'معرّف رقم واتساب مطلوب مع الطريق الرسمي' }]
    Object.assign(wa, { provider: body.provider, hasKey: body.provider !== 'off' && (wa.hasKey || Boolean(body.apiKey)), phoneId: body.phoneId || null })
    return [200, { ok: true, note: null }]
  }
  if (action === 'templates') {
    const otp = body.templates?.otp
    if (typeof otp === 'string' && otp.trim() && !otp.includes('{{كود}}')) return [400, { ok: false, error: 'قالب رمز الدخول لازم يكون فيه {{كود}}' }]
    wa.templates = { ...body.templates }
    return [200, { ok: true, note: 'النصوص اتحفظت' }]
  }
  if (action === 'test') return [200, { ok: true, note: 'اتبعتت. شوف واتسابك.' }]
  return [404, { ok: false, error: 'not_found' }]
}

export function email() {
  return {
    configured: true,
    from: 'متجر زاوية <zawya@send.zawyaeg.site>',
    replyTo: null,
    replyToDropped: true,
    dns: [
      { label: 'SPF على نطاق الإرسال', name: 'zawyaeg.site', found: 'v=spf1 include:amazonses.com ~all' },
      { label: 'SPF على نطاق البصمة', name: 'send.zawyaeg.site', found: 'v=spf1 include:amazonses.com ~all' },
      { label: 'MX للملاحظات (ارتداد وشكاوى)', name: 'send.zawyaeg.site', found: '10 feedback-smtp.us-east-1.amazonses.com' },
      { label: 'DKIM (توقيع الرسالة)', name: 'resend._domainkey.zawyaeg.site', found: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ…' },
      { label: 'DMARC (سياسة الحماية)', name: '_dmarc.zawyaeg.site', found: null },
    ],
  }
}
