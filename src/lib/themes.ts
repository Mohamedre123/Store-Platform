/**
 * سجلّ الثيمات.
 *
 * الثيم معرَّف في الكود لا في قاعدة البيانات: كل ثيم له تخطيطه
 * وأقسامه وإعداداته الافتراضية بأنواع TypeScript كاملة. اللي يتخزّن
 * لكل متجر هو اختياره وتعديلاته فقط (جدول store_themes).
 *
 * إضافة ثيم جديد = صف واحد هنا + مكوّنات تخطيطه. مفيش هجرة قاعدة بيانات.
 */

export type ThemeCategory = 'أزياء' | 'تجميل' | 'إلكترونيات' | 'منزل' | 'أطعمة' | 'عام'

export type ThemeDefinition = {
  slug: string
  name: string
  nameEn: string
  description: string
  categories: ThemeCategory[]
  /** لوحة ألوان مقترحة — التاجر يقدر يغيّرها بالكامل */
  palette: {
    primary: string
    accent: string
    background: string
    surface: string
    text: string
  }
  /** ملامح التخطيط التي تميّز هذا الثيم */
  traits: string[]
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full'
  headerStyle: 'classic' | 'centered' | 'minimal' | 'split'
  productCard: 'clean' | 'overlay' | 'framed' | 'editorial'
  isPro?: boolean
}

export const THEMES: ThemeDefinition[] = [
  {
    slug: 'zawya',
    name: 'زاوية',
    nameEn: 'Zawya',
    description: 'الثيم الافتراضي — متوازن وسريع ويصلح لأي نشاط. أنسب بداية لو لسه مش عارف تختار.',
    categories: ['عام'],
    palette: { primary: '#634b9a', accent: '#927dc5', background: '#f6f6f9', surface: '#ffffff', text: '#222540' },
    traits: ['شبكة منتجات ٤ أعمدة', 'هيدر بحث بارز', 'بطاقات نظيفة'],
    radius: 'lg',
    headerStyle: 'classic',
    productCard: 'clean',
  },
  {
    slug: 'atlas',
    name: 'أطلس',
    nameEn: 'Atlas',
    description: 'واجهة أزياء عريضة بصور كبيرة وتفاصيل قليلة. الصورة هي البطل.',
    categories: ['أزياء'],
    palette: { primary: '#1b1b1f', accent: '#c8a15a', background: '#ffffff', surface: '#faf9f7', text: '#1b1b1f' },
    traits: ['بانر بملء الشاشة', 'صور بنسبة طولية', 'تنقّل بسيط'],
    radius: 'none',
    headerStyle: 'centered',
    productCard: 'editorial',
  },
  {
    slug: 'noor',
    name: 'نور',
    nameEn: 'Noor',
    description: 'ثيم تجميل وعناية بألوان فاتحة ومساحات واسعة وإحساس فاخر.',
    categories: ['تجميل'],
    palette: { primary: '#a8577a', accent: '#e6c9d4', background: '#fdf9fa', surface: '#ffffff', text: '#3a2530' },
    traits: ['بطاقات دائرية', 'أقسام بأيقونات', 'تقييمات بارزة'],
    radius: 'full',
    headerStyle: 'centered',
    productCard: 'clean',
  },
  {
    slug: 'tayyar',
    name: 'تيّار',
    nameEn: 'Tayyar',
    description: 'إلكترونيات وأجهزة — مواصفات ظاهرة ومقارنة سريعة وشبكة كثيفة.',
    categories: ['إلكترونيات'],
    palette: { primary: '#0f4c81', accent: '#00b3a4', background: '#f5f7fa', surface: '#ffffff', text: '#0d1b2a' },
    traits: ['مواصفات على البطاقة', 'شارات الضمان', 'فلاتر جانبية'],
    radius: 'md',
    headerStyle: 'split',
    productCard: 'framed',
  },
  {
    slug: 'dar',
    name: 'دار',
    nameEn: 'Dar',
    description: 'أثاث ومفروشات — صور بيئية واسعة وتصنيفات بالغرفة.',
    categories: ['منزل'],
    palette: { primary: '#6b5644', accent: '#c9a227', background: '#faf7f2', surface: '#ffffff', text: '#2e2419' },
    traits: ['أقسام بصور كبيرة', 'عرض بالغرفة', 'مساحات مريحة'],
    radius: 'sm',
    headerStyle: 'classic',
    productCard: 'overlay',
  },
  {
    slug: 'sufra',
    name: 'سفرة',
    nameEn: 'Sufra',
    description: 'مطاعم وأطعمة — قائمة بأقسام وصور شهيّة وطلب سريع.',
    categories: ['أطعمة'],
    palette: { primary: '#b3341f', accent: '#e8a33d', background: '#fffaf5', surface: '#ffffff', text: '#2b1a12' },
    traits: ['قائمة بتبويبات', 'إضافات على المنتج', 'زر طلب سريع'],
    radius: 'lg',
    headerStyle: 'minimal',
    productCard: 'clean',
  },
  {
    slug: 'sadaf',
    name: 'صدف',
    nameEn: 'Sadaf',
    description: 'مجوهرات وإكسسوارات — خلفية داكنة تُبرز لمعان المنتج.',
    categories: ['أزياء', 'تجميل'],
    palette: { primary: '#c9a227', accent: '#e8d9a0', background: '#14131a', surface: '#1e1c26', text: '#f0ece2' },
    traits: ['وضع داكن أصلي', 'إضاءة على الصور', 'تفاصيل ذهبية'],
    radius: 'sm',
    headerStyle: 'centered',
    productCard: 'overlay',
    isPro: true,
  },
  {
    slug: 'sarie',
    name: 'سريع',
    nameEn: 'Sarie',
    description: 'صفحة منتج واحد للحملات الإعلانية — كل شيء يقود لزر الشراء.',
    categories: ['عام'],
    palette: { primary: '#16a34a', accent: '#fbbf24', background: '#ffffff', surface: '#f8fafc', text: '#111827' },
    traits: ['دفع سريع بارز', 'مؤقّت عرض', 'إثبات اجتماعي'],
    radius: 'md',
    headerStyle: 'minimal',
    productCard: 'clean',
  },
]

export function getTheme(slug: string): ThemeDefinition {
  return THEMES.find((t) => t.slug === slug) ?? THEMES[0]
}

export const THEME_CATEGORIES: ThemeCategory[] = ['عام', 'أزياء', 'تجميل', 'إلكترونيات', 'منزل', 'أطعمة']

/* ────────────────────────── أقسام الصفحة الرئيسية ────────────────────────── */

export type SectionType =
  | 'announcement'
  | 'hero'
  | 'categories'
  | 'featured_products'
  | 'new_arrivals'
  | 'sale_products'
  | 'promo_banners'
  | 'all_products'
  | 'testimonials'
  | 'trust_badges'
  | 'newsletter'

export type SectionMeta = {
  type: SectionType
  name: string
  description: string
  /** لا يمكن حذفه أو تحريكه من مكانه */
  locked?: boolean
}

export const SECTION_LIBRARY: SectionMeta[] = [
  { type: 'announcement', name: 'شريط الإعلان', description: 'رسالة ترويجية في أعلى الصفحة' },
  { type: 'hero', name: 'البانر الرئيسي', description: 'الشرائح الكبيرة أول الصفحة', locked: true },
  { type: 'categories', name: 'الأقسام', description: 'تصفّح حسب القسم' },
  { type: 'featured_products', name: 'منتجات مختارة', description: 'المنتجات المميّزة اللي بتختارها' },
  { type: 'new_arrivals', name: 'وصل حديثًا', description: 'أحدث المنتجات المضافة' },
  { type: 'sale_products', name: 'التخفيضات', description: 'المنتجات اللي عليها خصم' },
  { type: 'promo_banners', name: 'بانرات ترويجية', description: 'بانرات وسط الصفحة' },
  { type: 'all_products', name: 'كل المنتجات', description: 'شبكة بكل منتجات المتجر' },
  { type: 'testimonials', name: 'آراء العملاء', description: 'تقييمات ومراجعات' },
  { type: 'trust_badges', name: 'شارات الثقة', description: 'شحن سريع، دفع آمن، إرجاع سهل' },
  { type: 'newsletter', name: 'النشرة البريدية', description: 'جمع بريد العملاء' },
]

export function getSectionMeta(type: string): SectionMeta {
  return (
    SECTION_LIBRARY.find((s) => s.type === type) ?? {
      type: type as SectionType,
      name: type,
      description: '',
    }
  )
}

/* ────────────────────────── مقاسات الصور ────────────────────────── */

/**
 * المقاسات المطلوبة لكل صورة يرفعها التاجر.
 *
 * تُعرض في الواجهة جنب كل حقل رفع. السبب إن التاجر بيرفع صورة
 * بمقاس عشوائي فتطلع مقصوصة أو مبهتة، وميعرفش ليه — فنقوله المقاس
 * الصحيح قبل ما يرفع.
 */
export type ImageSpec = {
  key: string
  label: string
  width: number
  height: number
  note: string
}

export const IMAGE_SPECS: Record<string, ImageSpec> = {
  heroDesktop: {
    key: 'heroDesktop',
    label: 'بانر الكمبيوتر',
    width: 1920,
    height: 720,
    note: 'الشاشات العريضة. سيب أطراف الصورة فاضية شوية عشان مش هتظهر كلها على كل المقاسات.',
  },
  heroMobile: {
    key: 'heroMobile',
    label: 'بانر الموبايل',
    width: 900,
    height: 1200,
    note: 'صورة طولية منفصلة. لو ما رفعتهاش هنستخدم بانر الكمبيوتر مقصوصًا، والنتيجة أقل جودة.',
  },
  promoBanner: {
    key: 'promoBanner',
    label: 'بانر ترويجي',
    width: 1200,
    height: 500,
    note: 'يظهر بين الأقسام. النص المهم يبقى في نص الصورة.',
  },
  categoryImage: {
    key: 'categoryImage',
    label: 'صورة القسم',
    width: 800,
    height: 800,
    note: 'مربّعة. صورة واضحة تمثّل القسم كله.',
  },
  productImage: {
    key: 'productImage',
    label: 'صورة المنتج',
    width: 1200,
    height: 1200,
    note: 'مربّعة وخلفية موحّدة لكل منتجاتك — ده اللي بيخلي المتجر شكله مرتّب.',
  },
  logo: {
    key: 'logo',
    label: 'الشعار',
    width: 512,
    height: 512,
    note: 'PNG بخلفية شفافة. ارفع نسخة للوضع الفاتح وأخرى للداكن لو ألوان شعارك غامقة.',
  },
  favicon: {
    key: 'favicon',
    label: 'أيقونة المتصفح',
    width: 64,
    height: 64,
    note: 'تظهر في تبويب المتصفح. خلّيها العلامة وحدها من غير كلام.',
  },
}
