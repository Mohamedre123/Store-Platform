/**
 * سجلّ الثيمات.
 *
 * الثيم مش لون — الثيم تخطيط. كل ثيم هنا بيختلف عن اللي جنبه في
 * شكل البانر وعدد الأعمدة ونسبة الصورة وشكل البطاقة ومكان البحث،
 * مش في الألوان بس. لو اتنين اختلفوا في اللون فقط، يبقى واحد منهم
 * زيادة ومالوش لزوم.
 *
 * التعريف في الكود لا في قاعدة البيانات: أنواع TypeScript كاملة،
 * وإضافة ثيم = صف واحد هنا بلا هجرة قاعدة بيانات.
 */

export type ThemeCategory = 'أزياء' | 'تجميل' | 'إلكترونيات' | 'منزل' | 'أطعمة' | 'عام'

/** شكل البانر الرئيسي */
export type HeroStyle =
  | 'fullbleed' // صورة بملء العرض والنص فوقها
  | 'boxed' // بانر داخل حاوية بحواف
  | 'split' // نص في نص وصورة في نص
  | 'stacked' // بانر صغير فوقه شريط تصنيفات
  | 'none' // بلا بانر — القائمة أو المنتجات فورًا

/** شكل بطاقة المنتج */
export type CardStyle =
  | 'clean' // صورة ثم اسم ثم سعر
  | 'overlay' // النص فوق الصورة
  | 'framed' // إطار وحدود ومواصفات
  | 'editorial' // صورة طويلة ونص تحتها بمسافة واسعة
  | 'compact' // صف أفقي: صورة صغيرة وتفاصيل جنبها

export type ThemeLayout = {
  hero: HeroStyle
  /** أعمدة شبكة المنتجات على الكمبيوتر */
  columns: 2 | 3 | 4
  card: CardStyle
  imageRatio: 'square' | 'portrait' | 'wide'
  nav: 'top' | 'centered' | 'split'
  showSearchInHeader: boolean
  showCategoryStrip: boolean
  showPriceBadge: boolean
}

export type ThemeDefinition = {
  slug: string
  name: string
  nameEn: string
  description: string
  categories: ThemeCategory[]
  palette: {
    primary: string
    accent: string
    background: string
    surface: string
    text: string
  }
  layout: ThemeLayout
  /** ما الذي يميّز هذا الثيم فعلًا — يُعرض للتاجر ليختار بوعي */
  traits: string[]
  /** لمن لا يناسب — الصدق هنا يوفّر على التاجر تجربة فاشلة */
  bestFor: string
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full'
  isPro?: boolean
}

export const THEMES: ThemeDefinition[] = [
  {
    slug: 'zawya',
    name: 'زاوية',
    nameEn: 'Zawya',
    description:
      'شبكة أربع أعمدة وبحث بارز في الهيدر. يعرض أكبر عدد منتجات في أقل تمرير — أنسب لو كتالوجك كبير.',
    categories: ['عام'],
    palette: { primary: '#634b9a', accent: '#927dc5', background: '#f6f6f9', surface: '#ffffff', text: '#222540' },
    layout: {
      hero: 'boxed',
      columns: 4,
      card: 'clean',
      imageRatio: 'square',
      nav: 'top',
      showSearchInHeader: true,
      showCategoryStrip: true,
      showPriceBadge: false,
    },
    traits: ['٤ أعمدة', 'بحث في الهيدر', 'شريط أقسام'],
    bestFor: 'متجر فيه منتجات كتير ومتنوّعة',
    radius: 'lg',
  },
  {
    slug: 'atlas',
    name: 'أطلس',
    nameEn: 'Atlas',
    description:
      'بانر بملء الشاشة وصور طولية بعمودين. الصورة كبيرة والتفاصيل قليلة — للأزياء اللي بتتباع بالمنظر.',
    categories: ['أزياء'],
    palette: { primary: '#1b1b1f', accent: '#c8a15a', background: '#ffffff', surface: '#faf9f7', text: '#1b1b1f' },
    layout: {
      hero: 'fullbleed',
      columns: 2,
      card: 'editorial',
      imageRatio: 'portrait',
      nav: 'centered',
      showSearchInHeader: false,
      showCategoryStrip: false,
      showPriceBadge: false,
    },
    traits: ['بانر بملء الشاشة', 'عمودين بصور طولية', 'تنقّل في النص'],
    bestFor: 'أزياء بصور احترافية',
    radius: 'none',
  },
  {
    slug: 'noor',
    name: 'نور',
    nameEn: 'Noor',
    description:
      'أقسام دائرية فوق وثلاثة أعمدة تحت. مساحات واسعة وإحساس ناعم — للتجميل والعناية.',
    categories: ['تجميل'],
    palette: { primary: '#a8577a', accent: '#e6c9d4', background: '#fdf9fa', surface: '#ffffff', text: '#3a2530' },
    layout: {
      hero: 'stacked',
      columns: 3,
      card: 'clean',
      imageRatio: 'square',
      nav: 'centered',
      showSearchInHeader: false,
      showCategoryStrip: true,
      showPriceBadge: false,
    },
    traits: ['أقسام دائرية', '٣ أعمدة', 'مساحات واسعة'],
    bestFor: 'تجميل وعناية بأقسام واضحة',
    radius: 'full',
  },
  {
    slug: 'tayyar',
    name: 'تيّار',
    nameEn: 'Tayyar',
    description:
      'بانر مقسوم نصين وبطاقات بإطار ومواصفات وشارة سعر. كثافة عالية للمقارنة السريعة.',
    categories: ['إلكترونيات'],
    palette: { primary: '#0f4c81', accent: '#00b3a4', background: '#f5f7fa', surface: '#ffffff', text: '#0d1b2a' },
    layout: {
      hero: 'split',
      columns: 4,
      card: 'framed',
      imageRatio: 'square',
      nav: 'split',
      showSearchInHeader: true,
      showCategoryStrip: false,
      showPriceBadge: true,
    },
    traits: ['بانر نصين', 'بطاقات بإطار', 'شارة سعر'],
    bestFor: 'أجهزة ومنتجات بمواصفات',
    radius: 'md',
  },
  {
    slug: 'dar',
    name: 'دار',
    nameEn: 'Dar',
    description:
      'صور عريضة بعمودين والنص فوق الصورة. بيعرض المنتج في بيئته مش على خلفية بيضا.',
    categories: ['منزل'],
    palette: { primary: '#6b5644', accent: '#c9a227', background: '#faf7f2', surface: '#ffffff', text: '#2e2419' },
    layout: {
      hero: 'fullbleed',
      columns: 2,
      card: 'overlay',
      imageRatio: 'wide',
      nav: 'top',
      showSearchInHeader: false,
      showCategoryStrip: true,
      showPriceBadge: false,
    },
    traits: ['صور عريضة', 'نص فوق الصورة', 'عمودين'],
    bestFor: 'أثاث ومفروشات بصور بيئية',
    radius: 'sm',
  },
  {
    slug: 'sufra',
    name: 'سفرة',
    nameEn: 'Sufra',
    description:
      'من غير بانر — قائمة بصفوف أفقية وشريط أقسام ثابت. العميل بيوصل للأكلة في ثانية.',
    categories: ['أطعمة'],
    palette: { primary: '#b3341f', accent: '#e8a33d', background: '#fffaf5', surface: '#ffffff', text: '#2b1a12' },
    layout: {
      hero: 'none',
      columns: 2,
      card: 'compact',
      imageRatio: 'square',
      nav: 'top',
      showSearchInHeader: true,
      showCategoryStrip: true,
      showPriceBadge: true,
    },
    traits: ['بلا بانر', 'صفوف أفقية', 'شريط أقسام ثابت'],
    bestFor: 'مطاعم وقوايم أكل',
    radius: 'lg',
  },
  {
    slug: 'sadaf',
    name: 'صدف',
    nameEn: 'Sadaf',
    description:
      'خلفية داكنة وثلاثة أعمدة بصور مربّعة. الإضاءة على المنتج نفسه — للمجوهرات والقطع اللامعة.',
    categories: ['أزياء', 'تجميل'],
    palette: { primary: '#c9a227', accent: '#e8d9a0', background: '#14131a', surface: '#1e1c26', text: '#f0ece2' },
    layout: {
      hero: 'boxed',
      columns: 3,
      card: 'overlay',
      imageRatio: 'square',
      nav: 'centered',
      showSearchInHeader: false,
      showCategoryStrip: false,
      showPriceBadge: false,
    },
    traits: ['وضع داكن أصلي', '٣ أعمدة', 'نص فوق الصورة'],
    bestFor: 'مجوهرات وإكسسوارات',
    radius: 'sm',
    isPro: true,
  },
  {
    slug: 'sarie',
    name: 'سريع',
    nameEn: 'Sarie',
    description:
      'صفحة منتج واحد: بانر نصين وزر شراء ثابت. مفيش شبكة منتجات أصلًا — كل حاجة بتقود للشراء.',
    categories: ['عام'],
    palette: { primary: '#16a34a', accent: '#fbbf24', background: '#ffffff', surface: '#f8fafc', text: '#111827' },
    layout: {
      hero: 'split',
      columns: 2,
      card: 'compact',
      imageRatio: 'wide',
      nav: 'top',
      showSearchInHeader: false,
      showCategoryStrip: false,
      showPriceBadge: true,
    },
    traits: ['منتج واحد', 'زر شراء ثابت', 'بلا تشتيت'],
    bestFor: 'حملات إعلانية لمنتج واحد',
    radius: 'md',
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
 * تُعرض جنب كل حقل رفع. السبب إن التاجر بيرفع صورة بمقاس عشوائي
 * فتطلع مقصوصة أو مبهتة وميعرفش ليه — فنقوله المقاس قبل ما يرفع
 * لا بعد ما يشتكي.
 */
export type ImageSpec = {
  key: string
  label: string
  width: number
  height: number
  note: string
}

/**
 * مواصفات الصور.
 *
 * من غير `Record<string, ...>` عن قصد: الأنواع المعمّمة بتخلّي
 * `keyof typeof IMAGE_SPECS` مجرد `string`، فأي خطأ مطبعي في اسم
 * المفتاح بيعدّي من الفحص ويقع في المتصفح. وده اللي حصل فعلًا —
 * صفحة البانرات كانت بتطلب «promo» بدل «promoBanner» وبتقع كلها.
 *
 * `satisfies` بيتحقّق من الشكل ويحتفظ بالمفاتيح الحرفية.
 */
export const IMAGE_SPECS = {
  heroDesktop: {
    key: 'heroDesktop',
    label: 'بانر الكمبيوتر',
    width: 1920,
    height: 720,
    note: 'الشاشات العريضة. سيب أطراف الصورة فاضية شوية — مش هتظهر كلها على كل المقاسات.',
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
} satisfies Record<string, ImageSpec>
