/**
 * منصات بيتستورد منها الكتالوج — التعريف بس، من غير أي نداء.
 *
 * ملف مستقل عن `integrations/catalog-import` لأن ده `server-only`:
 * الشاشة محتاجة أسماء المزوّدين وحقولهم عشان ترسم الفورم، والنداء
 * الفعلي بيفضل على الخادم وحده. نفس نمط `providers.ts`.
 *
 * ## الحقول بأسماء المنصة نفسها
 * التاجر بيفتح لوحة شوبيفاي جنب لوحتنا وبينقل. لو سمّينا الحقل
 * «المفتاح السري» وهما مسمّينه `Consumer Secret`، بيقعد يدوّر —
 * والاستيراد بيفشل من أول خطوة قبل ما يشوف منتج واحد.
 */

export type ImportSourceKey = 'shopify' | 'woocommerce'

export type ImportSourceField = {
  key: string
  /** الاسم زي ما المنصة بتسمّيه بالظبط */
  label: string
  hint?: string
  placeholder?: string
  secret?: boolean
}

export type ImportSource = {
  key: ImportSourceKey
  name: string
  /** اللي التاجر بيقراه قبل ما يبدأ */
  intro: string
  /** خطوات جلب المفاتيح — من لوحة المنصة نفسها */
  steps: string[]
  fields: ImportSourceField[]
}

export const IMPORT_SOURCES: ImportSource[] = [
  {
    key: 'shopify',
    name: 'Shopify',
    intro:
      'بنقرا منتجاتك المنشورة من Storefront API. المفتاح ده للقراءة بس — مش بيقدر يعدّل ولا يشوف طلباتك ولا عملاءك.',
    steps: [
      'من لوحة شوبيفاي: Settings ← Apps and sales channels ← Develop apps',
      'اعمل تطبيق جديد (Create an app) وسمّيه أي اسم',
      'في Configuration ← Storefront API، فعّل الصلاحية `unauthenticated_read_product_listings`',
      'اعمل Install، وبعدها من API credentials انسخ الـStorefront API access token',
    ],
    fields: [
      {
        key: 'shop',
        label: 'Shop domain',
        hint: 'اللي بينتهي بـ‎.myshopify.com‎ — من شريط عنوان لوحتك',
        placeholder: 'my-store.myshopify.com',
      },
      {
        key: 'token',
        label: 'Storefront API access token',
        placeholder: 'شغّال بالقراءة بس',
        secret: true,
      },
    ],
  },
  {
    key: 'woocommerce',
    name: 'WooCommerce',
    intro:
      'بنقرا منتجاتك من REST API. اختار صلاحية Read بس — الاستيراد ما بيكتبش أي حاجة عندك.',
    steps: [
      'من لوحة ووردبريس: WooCommerce ← Settings ← Advanced ← REST API',
      'اضغط Add key، واختار Permissions = Read',
      'انسخ الـConsumer key والـConsumer secret (بيبانوا مرة واحدة بس)',
    ],
    fields: [
      {
        key: 'siteUrl',
        label: 'Website URL',
        hint: 'عنوان متجرك بالكامل',
        placeholder: 'https://my-store.com',
      },
      { key: 'consumerKey', label: 'Consumer key', placeholder: 'ck_…', secret: true },
      { key: 'consumerSecret', label: 'Consumer secret', placeholder: 'cs_…', secret: true },
    ],
  },
]

export function importSource(key: string): ImportSource | undefined {
  return IMPORT_SOURCES.find((s) => s.key === key)
}
