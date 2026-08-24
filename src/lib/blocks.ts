/**
 * بلوكات الصفحة الرئيسية.
 *
 * الصفحة الرئيسية كانت قايمة ثابتة: عشرة أقسام، كل واحد إمّا مفتوح
 * أو مقفول، ومحصلتش. التاجر اللي عايز قسمين منتجات — واحد للجديد
 * وواحد لقسم معيّن — مكانش قدامه غير إنه يختار واحد.
 *
 * هنا البلوك **نسخة** لا نوع: التاجر بيضيف قد ما يحب من نفس النوع،
 * وكل نسخة ليها إعداداتها. `Section.id` هو اللي بيفرّق بينهم.
 *
 * ## القاعدة
 * أي إعداد هنا لازم يبان في المتجر فعلًا. الخيار اللي مش بيغيّر حاجة
 * بيضيّع وقت التاجر ويوهمه بتحكّم مش موجود.
 *
 * ## التوافق مع القديم
 * الأنواع القديمة (`featured_products` و`new_arrivals` و`sale_products`
 * و`all_products`) لسه موجودة وبترسم صح — بتتحوّل لبلوك `products`
 * بمصدر جاهز عند العرض. متجر متحفوظ من قبل ما يتكسرش، والتاجر
 * الجديد بيلاقي بلوكًا واحدًا مرن بدل أربعة متشابهين.
 */

/* ────────────────────────── الأنواع ────────────────────────── */

export type BlockType =
  | 'hero'
  | 'products'
  | 'categories'
  | 'banner'
  | 'slides'
  | 'countdown'
  | 'rich_text'
  | 'features'
  | 'testimonials'
  | 'faq'
  | 'video'
  | 'logos'
  | 'gallery'
  | 'newsletter'
  /* القديم — بيتحوّل عند العرض */
  | 'featured_products'
  | 'new_arrivals'
  | 'sale_products'
  | 'all_products'
  | 'promo_banners'
  | 'trust_badges'
  | 'announcement'

/** عرض الشريحة الواحدة — مشترك بين البانر والشرائح */
export type SlideItem = {
  id: string
  imageDesktop: string | null
  imageMobile: string | null
  heading: string
  text: string
  ctaLabel: string
  ctaUrl: string
  /** تعتيم فوق الصورة — النص ما بيتقراش على صورة فاتحة من غيره */
  overlay: number
  /** ضبابية خلف النص — بتفصله عن الصورة من غير ما تغطّيها */
  blur: number
  textPosition: 'start' | 'center' | 'end'
  textColor: string
}

export type ProductSource = 'featured' | 'new' | 'sale' | 'best' | 'category' | 'manual'

export type ProductsBlock = {
  title: string
  subtitle: string
  source: ProductSource
  categoryId: string | null
  /** القسم الأب بيعرض منتجات أولاده كمان */
  includeChildren: boolean
  /** ترتيب التاجر اليدوي — بيتحفظ زي ما رتّبه بالظبط */
  productIds: string[]
  limit: number
  layout: 'grid' | 'carousel' | 'tiles'
  /** «inherit» = زي إعداد صفحة المنتجات */
  cardStyle: 'inherit' | 'clean' | 'overlay' | 'framed' | 'editorial' | 'compact'
  imageRatio: 'inherit' | 'square' | 'portrait' | 'wide'
  columns: 0 | 2 | 3 | 4 | 5
  /**
   * زر البطاقة.
   *
   * `add` = إضافة بضغطة، و`options` = يودّيه لصفحة المنتج يختار.
   * المنتج اللي ليه مقاسات وألوان، الإضافة بضغطة معناها إننا نختار
   * نيابةً عن العميل — وده بيرجّع مرتجعًا مش بيعة.
   */
  action: 'inherit' | 'add' | 'choose' | 'options' | 'none'
  moreEnabled: boolean
  moreLabel: string
  /** فاضي = يروح للقسم المختار، أو لكل المنتجات */
  moreUrl: string
  background: BgKey
}

export type CategoriesBlock = {
  title: string
  subtitle: string
  layout: 'circle' | 'card' | 'tile'
  /** فاضية = كل الأقسام */
  categoryIds: string[]
  limit: number
  columns: 3 | 4 | 5 | 6
  showCount: boolean
  background: BgKey
}

export type BannerBlock = {
  items: SlideItem[]
  height: 'sm' | 'md' | 'lg'
  /** الحواف الدايرة بتتبع الثيم لما تتقفل */
  rounded: boolean
  full: boolean
}

export type SlidesBlock = {
  items: SlideItem[]
  height: 'sm' | 'md' | 'lg' | 'full'
  autoplay: boolean
  intervalSeconds: number
  showDots: boolean
  showArrows: boolean
}

export type CountdownBlock = {
  heading: string
  text: string
  /** ISO — لما يعدّي، البلوك بيتصرّف حسب `whenDone` */
  endsAt: string
  /** hide = يختفي · repeat = يعيد نفس المدة كل يوم · keep = يفضل بصفر */
  whenDone: 'hide' | 'repeat' | 'keep'
  image: string | null
  background: string
  textColor: string
  ctaLabel: string
  ctaUrl: string
  overlay: number
  blur: number
}

export type RichTextBlock = {
  heading: string
  body: string
  ctaLabel: string
  ctaUrl: string
  align: 'start' | 'center'
  background: BgKey
  width: 'narrow' | 'wide'
}

export type FeatureItem = { id: string; icon: string; title: string; text: string }

export type FeaturesBlock = {
  title: string
  items: FeatureItem[]
  columns: 2 | 3 | 4
  style: 'plain' | 'card' | 'bordered'
  background: BgKey
}

export type TestimonialItem = { id: string; name: string; text: string; rating: number; avatar: string | null }

export type TestimonialsBlock = {
  title: string
  items: TestimonialItem[]
  layout: 'grid' | 'carousel'
  background: BgKey
}

export type FaqItem = { id: string; q: string; a: string }

export type FaqBlock = {
  title: string
  items: FaqItem[]
  background: BgKey
}

export type VideoBlock = {
  title: string
  text: string
  /** يوتيوب أو فيميو أو رابط mp4 مباشر */
  url: string
  poster: string | null
  ratio: '16:9' | '4:3' | '1:1' | '9:16'
  width: 'narrow' | 'wide' | 'full'
  background: BgKey
}

export type LogoItem = { id: string; image: string; alt: string; url: string }

export type LogosBlock = {
  title: string
  items: LogoItem[]
  /** الشريط المتحرّك بيوفّر مساحة لما الماركات كتير */
  marquee: boolean
  grayscale: boolean
  background: BgKey
}

export type GalleryItem = { id: string; image: string; caption: string; url: string }

export type GalleryBlock = {
  title: string
  items: GalleryItem[]
  layout: 'grid' | 'masonry' | 'strip'
  columns: 2 | 3 | 4
  showCaption: boolean
  background: BgKey
}

export type NewsletterBlock = {
  heading: string
  text: string
  buttonLabel: string
  placeholder: string
  background: BgKey
}

/* ────────────────────────── الافتراضيات ────────────────────────── */

export const PRODUCT_SOURCES: Array<{ value: ProductSource; label: string; hint: string }> = [
  { value: 'featured', label: 'منتجات مميّزة', hint: 'اللي علّمت عليها «مميّز» في صفحة المنتج' },
  { value: 'new', label: 'وصل حديثًا', hint: 'أحدث اللي ضفته' },
  { value: 'sale', label: 'عليها خصم', hint: 'اللي سعرها أقل من سعر المقارنة' },
  { value: 'best', label: 'الأكثر مبيعًا', hint: 'حسب عدد الطلبات الفعلية' },
  { value: 'category', label: 'من قسم', hint: 'كل منتجات قسم تختاره' },
  { value: 'manual', label: 'منتجات أختارها', hint: 'تحدّدها بنفسك وترتّبها زي ما تحب' },
]

/** شريحة جديدة فاضية */
export function newSlide(id: string): SlideItem {
  return {
    id,
    imageDesktop: null,
    imageMobile: null,
    heading: '',
    text: '',
    ctaLabel: '',
    ctaUrl: '',
    overlay: 25,
    blur: 0,
    textPosition: 'center',
    textColor: '#ffffff',
  }
}

type DefaultsMap = {
  products: ProductsBlock
  categories: CategoriesBlock
  banner: BannerBlock
  slides: SlidesBlock
  countdown: CountdownBlock
  rich_text: RichTextBlock
  features: FeaturesBlock
  testimonials: TestimonialsBlock
  faq: FaqBlock
  video: VideoBlock
  logos: LogosBlock
  gallery: GalleryBlock
  newsletter: NewsletterBlock
}

const DEFAULTS: DefaultsMap = {
  products: {
    title: 'منتجاتنا',
    subtitle: '',
    source: 'new',
    categoryId: null,
    includeChildren: true,
    productIds: [],
    limit: 8,
    layout: 'grid',
    cardStyle: 'inherit',
    imageRatio: 'inherit',
    columns: 0,
    action: 'inherit',
    moreEnabled: true,
    moreLabel: 'عرض الكل',
    moreUrl: '',
    background: 'none',
  },
  categories: {
    title: 'تسوّق حسب القسم',
    subtitle: '',
    layout: 'circle',
    categoryIds: [],
    limit: 12,
    columns: 6,
    showCount: false,
    background: 'none',
  },
  banner: {
    items: [newSlide('b1')],
    height: 'md',
    rounded: true,
    full: false,
  },
  slides: {
    items: [newSlide('s1')],
    height: 'md',
    autoplay: true,
    intervalSeconds: 6,
    showDots: true,
    showArrows: true,
  },
  countdown: {
    heading: 'عرض محدود',
    text: 'الخصم بينتهي قريب — اطلب قبل ما يخلص',
    endsAt: '',
    whenDone: 'hide',
    image: null,
    background: '#1b1b1f',
    textColor: '#ffffff',
    ctaLabel: 'اطلب دلوقتي',
    ctaUrl: '/products',
    overlay: 40,
    blur: 0,
  },
  rich_text: {
    heading: '',
    body: '',
    ctaLabel: '',
    ctaUrl: '',
    align: 'center',
    background: 'soft',
    width: 'narrow',
  },
  features: {
    title: '',
    items: [
      { id: 'f1', icon: 'truck', title: 'شحن سريع', text: 'لكل المحافظات' },
      { id: 'f2', icon: 'credit-card', title: 'دفع عند الاستلام', text: 'ادفع لما يوصلك' },
      { id: 'f3', icon: 'rotate-ccw', title: 'إرجاع سهل', text: 'لو المنتج مش زي ما توقّعت' },
      { id: 'f4', icon: 'package', title: 'تغليف آمن', text: 'يوصلك بحالته' },
    ],
    columns: 4,
    style: 'plain',
    background: 'none',
  },
  testimonials: {
    title: 'آراء عملائنا',
    items: [],
    layout: 'grid',
    background: 'soft',
  },
  faq: {
    title: 'أسئلة شائعة',
    items: [],
    background: 'none',
  },
  video: {
    title: '',
    text: '',
    url: '',
    poster: null,
    ratio: '16:9',
    width: 'wide',
    background: 'none',
  },
  logos: {
    title: '',
    items: [],
    marquee: true,
    grayscale: true,
    background: 'soft',
  },
  gallery: {
    title: '',
    items: [],
    layout: 'grid',
    columns: 3,
    showCaption: false,
    background: 'none',
  },
  newsletter: {
    heading: 'خليك أول مين يعرف',
    text: 'اشترك عشان يوصلك كل جديد وكل عرض.',
    buttonLabel: 'اشترك',
    placeholder: 'بريدك الإلكتروني',
    background: 'soft',
  },
}

/**
 * إعدادات البلوك مدموجة فوق الافتراضي.
 *
 * الدمج مش رفاهية: لما نضيف خيارًا جديدًا، المتاجر المحفوظة من قبله
 * بتلاقيه `undefined` — والواجهة بتقع أو بترسم فاضي. هنا بياخد قيمته
 * الافتراضية وكأنه كان موجود من الأول.
 */
export function readBlock<K extends keyof DefaultsMap>(
  type: K,
  settings: Record<string, unknown> | null | undefined,
): DefaultsMap[K] {
  return { ...DEFAULTS[type], ...(settings ?? {}) } as DefaultsMap[K]
}

export function defaultSettings(type: BlockType): Record<string, unknown> {
  /* الأنواع القديمة بتتحوّل لبلوك منتجات بمصدرها الجاهز */
  const legacy: Partial<Record<BlockType, Partial<ProductsBlock>>> = {
    featured_products: { source: 'featured', title: 'منتجات مختارة' },
    new_arrivals: { source: 'new', title: 'وصل حديثًا' },
    sale_products: { source: 'sale', title: 'التخفيضات' },
    all_products: { source: 'new', title: 'كل المنتجات', limit: 24 },
  }
  const preset = legacy[type]
  if (preset) return { ...DEFAULTS.products, ...preset }

  const known = DEFAULTS[type as keyof DefaultsMap]
  return known ? { ...known } : {}
}

/** النوع اللي هيرسم فعلًا — القديم بيتحوّل للجديد */
export function renderType(type: string): BlockType {
  if (
    type === 'featured_products' ||
    type === 'new_arrivals' ||
    type === 'sale_products' ||
    type === 'all_products'
  ) {
    return 'products'
  }
  if (type === 'trust_badges') return 'features'
  return type as BlockType
}

/** المصدر المضمون للأنواع القديمة — عشان ترسم زي ما التاجر متعوّد */
export function legacySource(type: string): ProductSource | null {
  if (type === 'featured_products') return 'featured'
  if (type === 'sale_products') return 'sale'
  if (type === 'new_arrivals' || type === 'all_products') return 'new'
  return null
}

/* ────────────────────────── مكتبة البلوكات ────────────────────────── */

export type BlockMeta = {
  type: BlockType
  name: string
  description: string
  /** مفتاح أيقونة — الواجهة بتحوّله لمكوّن */
  icon: string
  group: 'منتجات' | 'ترويج' | 'محتوى' | 'ثقة'
  /** بلوك مينفعش يتكرّر ولا يتنقل من مكانه */
  locked?: boolean
  /** ما يظهرش في قايمة الإضافة — موجود للتوافق بس */
  hidden?: boolean
}

export const BLOCK_LIBRARY: BlockMeta[] = [
  { type: 'hero', name: 'البانر الرئيسي', description: 'الشرائح الكبيرة أول الصفحة', icon: 'image', group: 'ترويج', locked: true },

  { type: 'products', name: 'منتجات', description: 'من قسم، أو منتجات تختارها بنفسك', icon: 'shopping-bag', group: 'منتجات' },
  { type: 'categories', name: 'الأقسام', description: 'تصفّح حسب القسم', icon: 'layout-grid', group: 'منتجات' },

  { type: 'banner', name: 'بانر', description: 'صورة بنص وزر — واحد أو جنب بعض', icon: 'panels-top-left', group: 'ترويج' },
  { type: 'slides', name: 'شرائح', description: 'أكتر من صورة بتتبدّل لوحدها', icon: 'gallery-horizontal', group: 'ترويج' },
  { type: 'countdown', name: 'عرض بعدّاد', description: 'عرض بوقت بينتهي — بيولّد إلحاحًا حقيقيًا', icon: 'timer', group: 'ترويج' },

  { type: 'rich_text', name: 'نص وزر', description: 'عنوان وكلام وزر — لقصة المتجر أو إعلان', icon: 'type', group: 'محتوى' },
  { type: 'video', name: 'فيديو', description: 'يوتيوب أو فيميو أو ملف', icon: 'play', group: 'محتوى' },
  { type: 'gallery', name: 'معرض صور', description: 'شبكة صور بروابط', icon: 'images', group: 'محتوى' },
  { type: 'faq', name: 'أسئلة شائعة', description: 'بيقلّل رسايل «بكام؟» و«بيوصل امتى؟»', icon: 'circle-help', group: 'محتوى' },
  { type: 'newsletter', name: 'النشرة البريدية', description: 'جمع بريد العملاء', icon: 'mail', group: 'محتوى' },

  { type: 'features', name: 'مميّزات', description: 'شحن سريع، دفع آمن، إرجاع سهل', icon: 'badge-check', group: 'ثقة' },
  { type: 'testimonials', name: 'آراء العملاء', description: 'كلام عملاء اشتروا فعلًا', icon: 'quote', group: 'ثقة' },
  { type: 'logos', name: 'شعارات', description: 'ماركات أو جهات بتتعامل معاها', icon: 'store', group: 'ثقة' },

  /* موجودة للمتاجر القديمة — مش في قايمة الإضافة */
  { type: 'featured_products', name: 'منتجات مختارة', description: 'المميّزة', icon: 'star', group: 'منتجات', hidden: true },
  { type: 'new_arrivals', name: 'وصل حديثًا', description: 'الأحدث', icon: 'sparkles', group: 'منتجات', hidden: true },
  { type: 'sale_products', name: 'التخفيضات', description: 'اللي عليها خصم', icon: 'percent', group: 'منتجات', hidden: true },
  { type: 'all_products', name: 'كل المنتجات', description: 'شبكة بكل المنتجات', icon: 'grid-3x3', group: 'منتجات', hidden: true },
  { type: 'promo_banners', name: 'بانرات ترويجية', description: 'من صفحة البانرات', icon: 'megaphone', group: 'ترويج', hidden: true },
  { type: 'trust_badges', name: 'شارات الثقة', description: 'المميّزات', icon: 'shield-check', group: 'ثقة', hidden: true },
  { type: 'announcement', name: 'شريط الإعلان', description: 'رسالة أعلى الصفحة', icon: 'megaphone', group: 'ترويج', hidden: true },
]

export function blockMeta(type: string): BlockMeta {
  return (
    BLOCK_LIBRARY.find((b) => b.type === type) ?? {
      type: type as BlockType,
      name: type,
      description: '',
      icon: 'square',
      group: 'محتوى',
    }
  )
}

/* ────────────────────────── خلفيات موحّدة ────────────────────────── */

export type BgKey = 'none' | 'soft' | 'contrast'

/**
 * خلفية البلوك.
 *
 * نفس المفاتيح في كل البلوكات: التاجر اللي بيركّب صفحة من عشر بلوكات
 * محتاج يفرّق بينهم بصريًا من غير ما يختار عشر ألوان تطلع متنافرة.
 */
export const BG_CLASS: Record<BgKey, string> = {
  none: '',
  soft: 'bg-[var(--sf-text)]/[0.035]',
  contrast: 'bg-[var(--sf-primary)]/[0.07]',
}

export const BG_LABELS: Record<BgKey, string> = {
  none: 'بدون',
  soft: 'خفيفة',
  contrast: 'ملوّنة',
}
