/**
 * سجل مزوّدي الدفع والشحن.
 *
 * **إحنا مش متعاقدين مع حد.** التاجر بيفتح حسابه عند الشركة بنفسه،
 * بيجيب مفاتيحه، وبيحطّها هنا. إحنا بنوفّر التوصيلة بس.
 *
 * كل مزوّد وحقوله: مفيش «API موحّد» للدفع ولا للشحن — واحد بيطلب
 * مفتاح، وواحد بيطلب اسم مستخدم وكلمة سر ورقم حساب وكود فرع. الحقول
 * هنا مكتوبة **زي ما الشركة بتسمّيها بالظبط**، عشان التاجر يلاقي
 * نفس الاسم في لوحتهم من غير ما يخمّن.
 *
 * الملف مشترك بين الخادم والمتصفح: الواجهة بتعرض الحقول والخادم
 * بيتحقّق منها — والمصدر لازم يبقى واحد وإلا حقل يتعرض ومايتحفظش.
 */

export type ProviderKind = 'payment' | 'shipping'

export type ProviderField = {
  key: string
  label: string
  /** `secret` بيتخزّن مشفّرًا وما بيرجعش للمتصفح أبدًا */
  kind: 'text' | 'secret'
  placeholder?: string
  hint?: string
  required: boolean
}

export type ProviderDef = {
  slug: string
  kind: ProviderKind
  name: string
  /** اسم الشركة زي ما هو في لوحتهم — بيساعد التاجر يتأكد إنه في المكان الصح */
  brand: string
  desc: string
  color: string
  /** رابط التسجيل عندهم — «لسه مش مشترك؟» */
  signupUrl: string
  /** فين يلاقي المفاتيح في لوحتهم */
  where: string
  fields: ProviderField[]
  /**
   * `api` = ربط حقيقي · `manual` = التاجر بيسجّل عندهم وينسخ الرقم.
   *
   * بنقولها صراحةً بدل ما ندّعي ربطًا مش موجود — التاجر اللي بيفتكر
   * الطلبات بتروح لوحدها وبيلاقيها ما راحتش، بيخسر يوم شغل.
   */
  mode: 'api' | 'manual'
  /** بيبعت تحديثات على ويب هوك؟ */
  webhook: boolean
  /**
   * عنده بيئة اختبار منفصلة؟
   *
   * اللي مالوش، خانة «وضع تجريبي» بتتخفي — خانة بتتحطّ وما بتعملش
   * حاجة بتخلّي التاجر يفتكر إنه بيجرّب وهو بيستقبل فلوس حقيقية.
   */
  hasTestMode: boolean
  /** دليل المطوّرين عندهم — للتاجر اللي معاه مبرمج */
  docsUrl?: string
}

/* ══════════════════════ بوابات الدفع ══════════════════════ */

export const PAYMENT_PROVIDERS: ProviderDef[] = [
  {
    slug: 'paymob',
    kind: 'payment',
    name: 'باي موب',
    brand: 'Paymob',
    desc: 'فيزا وماستر كارد ومحافظ إلكترونية وميزة. الأشهر في مصر.',
    color: '#f0592a',
    signupUrl: 'https://paymob.com/en/register',
    where:
      'المفتاح من Settings ← Account Info، وأرقام التكامل من Developers ← Payment Integrations، والـiFrame من Developers ← iframes.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://developers.paymob.com/egypt/',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        kind: 'secret',
        required: true,
        hint: 'مفتاح طويل بيبدأ بـZXlK — من Settings ← Account Info.',
      },
      { key: 'publicKey', label: 'Public Key', kind: 'text', required: false, placeholder: 'egy_pk_live_…' },
      {
        key: 'integrationIdCard',
        label: 'Integration ID — البطاقات',
        kind: 'text',
        required: true,
        placeholder: '1234567',
      },
      {
        key: 'integrationIdWallet',
        label: 'Integration ID — المحافظ',
        kind: 'text',
        required: false,
        placeholder: '1234568',
        hint: 'لو مفعّل عندك فودافون كاش وأورنج وإتصالات.',
      },
      { key: 'iframeId', label: 'iFrame ID', kind: 'text', required: true, placeholder: '123456' },
      {
        key: 'hmacSecret',
        label: 'HMAC Secret',
        kind: 'secret',
        required: true,
        hint: 'بنتحقّق بيه إن التأكيد جاي من باي موب فعلًا. من غيره أي حد يقدر يعلّم طلباتك «مدفوعة».',
      },
    ],
  },

  {
    slug: 'fawry',
    kind: 'payment',
    name: 'فوري',
    brand: 'Fawry',
    desc: 'العميل بياخد كود ويدفع في أي فرع فوري أو من التطبيق.',
    color: '#ffb81c',
    signupUrl: 'https://fawry.com/merchant-registration/',
    where: 'من بوابة تجّار فوري ← Profile ← Merchant Code وSecurity Key.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://developer.fawrystaging.com/docs/',
    fields: [
      { key: 'merchantCode', label: 'Merchant Code', kind: 'text', required: true },
      {
        key: 'securityKey',
        label: 'Security Key',
        kind: 'secret',
        required: true,
        hint: 'بيتستخدم في توقيع الطلب والتحقق من الرد.',
      },
      {
        key: 'expiryHours',
        label: 'مدة صلاحية الكود (ساعات)',
        kind: 'text',
        required: false,
        placeholder: '24',
        hint: 'بعدها الكود يبطل والطلب يتلغي.',
      },
    ],
  },

  {
    slug: 'kashier',
    kind: 'payment',
    name: 'كاشير',
    brand: 'Kashier',
    desc: 'بطاقات ومحافظ وتقسيط — تفعيل أسرع من غيره.',
    color: '#6c5ce7',
    signupUrl: 'https://kashier.io/',
    where: 'من لوحة Kashier ← Settings ← API Keys.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://developers.kashier.io/',
    fields: [
      { key: 'merchantId', label: 'Merchant ID (MID)', kind: 'text', required: true, placeholder: 'MID-xxxx-xxx' },
      { key: 'apiKey', label: 'API Key', kind: 'secret', required: true },
      {
        key: 'secretKey',
        label: 'Secret Key (Payment Hash)',
        kind: 'secret',
        required: true,
        hint: 'بيتستخدم في توقيع الطلب والتحقق من الإشعار.',
      },
    ],
  },

  {
    slug: 'myfatoorah',
    kind: 'payment',
    name: 'ماي فاتورة',
    brand: 'MyFatoorah',
    desc: 'بوابة خليجية بتدعم مصر — بطاقات ومحافظ وأبل باي.',
    color: '#0e7c66',
    signupUrl: 'https://myfatoorah.com/',
    where: 'من لوحة MyFatoorah ← API Key، والويب هوك من Settings ← Webhook Settings.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://docs.myfatoorah.com/',
    fields: [
      { key: 'apiToken', label: 'API Token', kind: 'secret', required: true },
      { key: 'webhookSecret', label: 'Webhook Secret Key', kind: 'secret', required: false },
    ],
  },

  {
    slug: 'tabby',
    kind: 'payment',
    name: 'تابي',
    brand: 'Tabby',
    desc: 'قسّط على ٤ دفعات من غير فوايد — بيرفع متوسط الطلب.',
    color: '#20c997',
    signupUrl: 'https://tabby.ai/en-EG/merchants',
    where: 'من لوحة Tabby ← Integration ← API Keys.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://docs.tabby.ai/',
    fields: [
      { key: 'publicKey', label: 'Public Key', kind: 'text', required: true, placeholder: 'pk_test_…' },
      { key: 'secretKey', label: 'Secret Key', kind: 'secret', required: true, placeholder: 'sk_test_…' },
      { key: 'merchantCode', label: 'Merchant Code', kind: 'text', required: true, placeholder: 'store_EGP' },
    ],
  },

  {
    slug: 'tamara',
    kind: 'payment',
    name: 'تمارا',
    brand: 'Tamara',
    desc: 'اشتري دلوقتي وادفع بعدين.',
    color: '#3ac4a0',
    signupUrl: 'https://tamara.co/merchants',
    where: 'من لوحة Tamara ← Settings ← API.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://docs.tamara.co/',
    fields: [
      { key: 'apiToken', label: 'API Token', kind: 'secret', required: true },
      { key: 'notificationToken', label: 'Notification Token', kind: 'secret', required: true },
      { key: 'publicKey', label: 'Public Key', kind: 'text', required: false },
    ],
  },

  {
    slug: 'stripe',
    kind: 'payment',
    name: 'سترايب',
    brand: 'Stripe',
    desc: 'للمبيعات الدولية بالدولار واليورو.',
    color: '#635bff',
    signupUrl: 'https://dashboard.stripe.com/register',
    where: 'من Developers ← API keys، وسرّ الويب هوك من Developers ← Webhooks بعد ما تضيف المسار.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://docs.stripe.com/api',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', kind: 'text', required: true, placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Secret Key', kind: 'secret', required: true, placeholder: 'sk_live_…' },
      {
        key: 'webhookSecret',
        label: 'Webhook Signing Secret',
        kind: 'secret',
        required: true,
        placeholder: 'whsec_…',
      },
    ],
  },

  {
    slug: 'paypal',
    kind: 'payment',
    name: 'باي بال',
    brand: 'PayPal',
    desc: 'للعملاء برّه مصر.',
    color: '#0070ba',
    signupUrl: 'https://www.paypal.com/eg/business',
    where: 'من PayPal Developer ← Apps & Credentials.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://developer.paypal.com/api/rest/',
    fields: [
      { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', kind: 'secret', required: true },
      { key: 'webhookId', label: 'Webhook ID', kind: 'text', required: false },
    ],
  },
]

/* ══════════════════════ شركات الشحن ══════════════════════ */

export const CARRIER_PROVIDERS: ProviderDef[] = [
  {
    slug: 'bosta',
    kind: 'shipping',
    name: 'بوسطة',
    brand: 'Bosta',
    desc: 'أشهر شركة شحن في مصر — تغطية كل المحافظات وتحصيل عند الاستلام.',
    color: '#e30613',
    signupUrl: 'https://bosta.co/business/',
    where: 'من لوحة بوسطة ← Settings ← Integrations ← API Key.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://docs.bosta.co/',
    fields: [
      { key: 'apiKey', label: 'API Key', kind: 'secret', required: true },
      {
        key: 'pickupAddressId',
        label: 'Pickup Address ID',
        kind: 'text',
        required: false,
        hint: 'عنوان استلام الشحنات من عندك. سيبه فاضي عشان يستخدم الافتراضي في حسابك.',
      },
      { key: 'businessReference', label: 'Business Reference', kind: 'text', required: false },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        kind: 'secret',
        required: false,
        hint: 'بنتحقّق بيه إن تحديث الحالة جاي من بوسطة فعلًا.',
      },
    ],
  },

  {
    slug: 'mylerz',
    kind: 'shipping',
    name: 'مايلرز',
    brand: 'Mylerz',
    desc: 'تغطية واسعة وتحصيل نقدي، وتسليم في نفس اليوم داخل القاهرة.',
    color: '#00a19a',
    signupUrl: 'https://mylerz.net/',
    where: 'من فريق مبيعات مايلرز — بيدّوك اسم مستخدم وكلمة سر وكود العميل.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    fields: [
      { key: 'username', label: 'اسم المستخدم', kind: 'text', required: true },
      { key: 'password', label: 'كلمة السر', kind: 'secret', required: true },
      { key: 'customerCode', label: 'Customer Code', kind: 'text', required: true },
      { key: 'warehouseName', label: 'اسم المخزن', kind: 'text', required: false },
      { key: 'webhookSecret', label: 'Webhook Secret', kind: 'secret', required: false },
    ],
  },

  {
    slug: 'jt',
    kind: 'shipping',
    name: 'J&T Express',
    brand: 'J&T Express Egypt',
    desc: 'أسعار تنافسية وتغطية ريفية كويسة.',
    color: '#e2231a',
    signupUrl: 'https://www.jtexpress-eg.com/',
    where: 'من فريق J&T — بيدّوك حساب API ومفتاح خاص وكود العميل.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    fields: [
      { key: 'apiAccount', label: 'API Account', kind: 'text', required: true },
      { key: 'privateKey', label: 'Private Key', kind: 'secret', required: true },
      { key: 'customerCode', label: 'Customer Code', kind: 'text', required: true },
      { key: 'password', label: 'كلمة السر', kind: 'secret', required: false },
      { key: 'webhookSecret', label: 'Webhook Secret', kind: 'secret', required: false },
    ],
  },

  {
    slug: 'aramex',
    kind: 'shipping',
    name: 'أرامكس',
    brand: 'Aramex',
    desc: 'شحن محلي ودولي — الأنسب لو بتبعت برّه مصر.',
    color: '#e4002b',
    signupUrl: 'https://www.aramex.com/eg/en/create-account',
    where: 'بيانات الـAPI بتوصلك بالإيميل بعد ما تفتح حساب تجاري.',
    mode: 'api',
    webhook: false,
    hasTestMode: true,
    docsUrl: 'https://www.aramex.com/us/en/developers-solution-center',
    fields: [
      { key: 'username', label: 'Username', kind: 'text', required: true },
      { key: 'password', label: 'Password', kind: 'secret', required: true },
      { key: 'accountNumber', label: 'Account Number', kind: 'text', required: true },
      { key: 'accountPin', label: 'Account PIN', kind: 'secret', required: true },
      { key: 'accountEntity', label: 'Account Entity', kind: 'text', required: true, placeholder: 'CAI' },
      {
        key: 'accountCountryCode',
        label: 'Account Country Code',
        kind: 'text',
        required: true,
        placeholder: 'EG',
      },
    ],
  },

  {
    slug: 'shipblu',
    kind: 'shipping',
    name: 'شيب بلو',
    brand: 'ShipBlu',
    desc: 'شحن سريع داخل القاهرة والجيزة والإسكندرية.',
    color: '#2f6fed',
    signupUrl: 'https://shipblu.com/',
    where: 'من لوحة ShipBlu ← Settings ← API.',
    mode: 'api',
    webhook: true,
    hasTestMode: true,
    docsUrl: 'https://docs.shipblu.com/',
    fields: [
      { key: 'apiKey', label: 'API Key', kind: 'secret', required: true },
      { key: 'webhookSecret', label: 'Webhook Secret', kind: 'secret', required: false },
    ],
  },

  /*
    الشركات اللي مالهاش API عام موثّق.

    بنعرضها **صراحةً كـ«يدوي»** بدل ما نشيلها: التاجر بيتعامل معاهم
    فعلًا ومحتاج يسجّل شحناتهم. واللي بيفتكر إن الطلبات بتروح لوحدها
    وبيلاقيها ما راحتش بيخسر يوم — فالوضوح هنا أهم من قايمة طويلة.
  */
  {
    slug: 'r2s',
    kind: 'shipping',
    name: 'R2S',
    brand: 'Road to Success',
    desc: 'تسجيل يدوي — تعمل البوليصة عندهم وتنسخ رقمها هنا.',
    color: '#1b3b6f',
    signupUrl: 'https://r2s.com.eg/',
    where: 'كلّم فريق R2S. لو طلعلك API لحسابك، ابعتلنا وهنوصّله.',
    mode: 'manual',
    webhook: false,
    hasTestMode: false,
    fields: [
      { key: 'accountNumber', label: 'رقم حسابك عندهم', kind: 'text', required: false },
      { key: 'apiKey', label: 'API Key (لو عندك)', kind: 'secret', required: false },
    ],
  },
  {
    slug: 'sprint',
    kind: 'shipping',
    name: 'سبرينت',
    brand: 'Sprint Express',
    desc: 'تسجيل يدوي — تعمل البوليصة عندهم وتنسخ رقمها هنا.',
    color: '#f47b20',
    signupUrl: 'https://sprintexpress.co/',
    where: 'كلّم فريق سبرينت. لو طلعلك API لحسابك، ابعتلنا وهنوصّله.',
    mode: 'manual',
    webhook: false,
    hasTestMode: false,
    fields: [
      { key: 'accountNumber', label: 'رقم حسابك عندهم', kind: 'text', required: false },
      { key: 'apiKey', label: 'API Key (لو عندك)', kind: 'secret', required: false },
    ],
  },
  {
    slug: 'voo',
    kind: 'shipping',
    name: 'VOO',
    brand: 'VOO Egypt',
    desc: 'تسجيل يدوي — تعمل البوليصة عندهم وتنسخ رقمها هنا.',
    color: '#7b2ff7',
    signupUrl: 'https://voo.eg/',
    where: 'كلّم فريق VOO. لو طلعلك API لحسابك، ابعتلنا وهنوصّله.',
    mode: 'manual',
    webhook: false,
    hasTestMode: false,
    fields: [
      { key: 'accountNumber', label: 'رقم حسابك عندهم', kind: 'text', required: false },
      { key: 'apiKey', label: 'API Key (لو عندك)', kind: 'secret', required: false },
    ],
  },
]

export const ALL_PROVIDERS = [...PAYMENT_PROVIDERS, ...CARRIER_PROVIDERS]

export function paymentProvider(slug: string): ProviderDef | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.slug === slug)
}

export function carrierProvider(slug: string): ProviderDef | undefined {
  return CARRIER_PROVIDERS.find((p) => p.slug === slug)
}

export function getProvider(slug: string): ProviderDef | undefined {
  return ALL_PROVIDERS.find((p) => p.slug === slug)
}

/**
 * مسار الويب هوك للمتجر ده عند المزوّد ده.
 *
 * المتجر في المسار مش في الحمولة: المزوّد بينده على رابط ثابت،
 * ولو المتجر جه من الحمولة كان أي حد يقدر يبعت إشعارًا باسم متجر
 * تاني.
 */
export function webhookPath(base: 'pay' | 'ship', slug: string, storeId: string): string {
  return `/api/webhooks/${base}/${slug}/${storeId}`
}
