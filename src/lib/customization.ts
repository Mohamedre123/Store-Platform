/**
 * إعدادات تخصيص المتجر.
 *
 * كل ما يقدر التاجر يغيّره في شكل متجره موصوف هنا بأنواع كاملة،
 * ومخزَّن في store_themes. الثيم بيحدّد نقطة البداية، والتاجر
 * بيعدّل فوقها — فتغيير الثيم ما بيمسحش تعديلاته.
 *
 * القاعدة: أي خيار هنا لازم يكون له أثر مرئي حقيقي في المتجر.
 * الخيار اللي ما بيغيّرش حاجة بيضيّع وقت التاجر ويوهمه بالتحكّم.
 */

export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'full'
export type IconSet = 'lucide' | 'tabler' | 'phosphor' | 'heroicons' | 'remix'
export type FontChoice = 'plex' | 'cairo' | 'tajawal' | 'almarai' | 'system'

/* ────────────────────────── الهوية ────────────────────────── */

export type IdentitySettings = {
  primary: string
  accent: string
  background: string
  surface: string
  text: string
  radius: Radius
  fontHeading: FontChoice
  fontBody: FontChoice
  iconSet: IconSet
  logoLight: string | null
  logoDark: string | null
  favicon: string | null
  hideNameInHeader: boolean
}

/* ────────────────────────── شريط الإعلان ────────────────────────── */

export type AnnouncementSettings = {
  enabled: boolean
  text: string
  link: string
  background: string
  color: string
  dismissible: boolean
  sticky: boolean
}

/* ────────────────────────── الهيدر ────────────────────────── */

export type HeaderSettings = {
  layout: 'top' | 'centered' | 'split'
  sticky: boolean
  showSearch: boolean
  showCart: boolean
  showAccount: boolean
  showWishlist: boolean
  showCategoriesBar: boolean
  logoHeight: number
}

/* ────────────────────────── البانر الرئيسي ────────────────────────── */

export type HeroSlide = {
  id: string
  imageDesktop: string | null
  imageMobile: string | null
  title: string
  subtitle: string
  ctaLabel: string
  ctaUrl: string
  textPosition: 'start' | 'center' | 'end'
  overlay: number
  /** ضبابية خلف النص والزر — بتفصلهم عن الصورة من غير ما تغطّيها */
  blur?: number
  /** مفتاح الضبابية — منفصل عن الشدّة عشان التاجر يقفلها ويرجّعها */
  blurEnabled?: boolean
  /** لون العنوان والوصف فوق الصورة */
  textColor?: string
  /**
   * لون الزر ونصّه.
   *
   * الافتراضي أبيض بلون المتجر جوّاه، وده بيشتغل فوق أغلب الصور —
   * لكن مش كلها. البانر الفاتح بيبلع الزر الأبيض تمامًا، والتاجر
   * بيقعد يبصّ ومش فاهم الزر راح فين.
   */
  ctaBg?: string
  ctaColor?: string
  /**
   * شكل الزر: مصمت ولا زجاجي.
   *
   * الزجاجي زر شفاف بضبابية وحدّ فاتح — بيبان فوق الصورة من غير ما
   * يغطّيها بلون مصمت. بيشتغل على الفون والكمبيوتر بنفس الشكل.
   *
   * اختياري لا افتراضي: الزر المصمت أوضح على الصور المزحومة، والزجاجي
   * أجمل على الصور الهادية — والتاجر هو اللي شايف صورته.
   */
  ctaStyle?: 'solid' | 'glass'

  /**
   * اللوح الزجاجي ورا الكلام — لونه وشفافيته.
   *
   * كان أسود ثابت على ٢٨٪. والأسود بيشتغل فوق صورة فاتحة، وبيختفي فوق
   * صورة غامقة أصلًا — والتاجر مش قادر يعمل حاجة غير إنه يقفل اللوح
   * كله. اللون والشفافية بيخلّوه يتظبّط على الصورة بدل ما يتحمّلها.
   */
  panelTint?: string
  panelOpacity?: number

  /**
   * حجم العنوان والوصف.
   *
   * **المنصة مش لمجال واحد.** عنوان محل ملابس («تشكيلة الصيف») قصير
   * وبيستحمل خط كبير، وعنوان مكتب خدمات («استشارات قانونية للشركات»)
   * أطول وبيتكسر سطرين ووحش بنفس الحجم. الحجم الواحد الثابت بيخدم
   * نوعًا ويضرّ التاني.
   */
  titleSize?: 'sm' | 'md' | 'lg' | 'xl'
  subtitleSize?: 'sm' | 'md' | 'lg'
  /** خط العنوان: خط العناوين بتاع المتجر ولا خط النص */
  titleFont?: 'heading' | 'body'
  /** لون الوصف — منفصل عن العنوان عشان يتهدّى تحته */
  subtitleColor?: string

  /**
   * سطر صغير فوق العنوان — اسم المتجر، تصنيف، موسم، أي حاجة.
   *
   * صغير ومتباعد الحروف وبلون مختلف. بيدّي الكلام تسلسلًا: سطر يعرّف،
   * وعنوان يقول، ووصف يشرح — بدل عنوان معلّق لوحده في نص الصورة.
   *
   * اختياري تمامًا: التاجر اللي مش عايزه يسيبه فاضي وما بيتعرضش.
   */
  eyebrow?: string
  eyebrowColor?: string

  /** شكل الزر: زوايا الثيم ولا كبسولة كاملة */
  ctaShape?: 'default' | 'pill'

  /**
   * اللوح الزجاجي بيشتغل على أنهي جهاز.
   *
   * **الفصل ده مش رفاهية.** اللوح اللي شكله مظبوط على شاشة عريضة بيبقى
   * مربّعًا تقيلًا على الفون بيغطّي نص الصورة، والعكس. والتاجر كان
   * قدامه اختيار واحد بيسري على الاتنين — فيظبّطه لواحدة ويكسر التانية.
   */
  panelScope?: 'both' | 'mobile' | 'desktop'
}

export type HeroSettings = {
  style: 'fullbleed' | 'boxed' | 'split' | 'stacked' | 'none'
  /**
   * ارتفاع البانر.
   *
   * `auto` معناها **البانر بياخد مقاس الصورة نفسها**. الارتفاعات
   * الثابتة بتقص الصورة عشان تملا مساحة محدّدة سلفًا — وده مظبوط لما
   * التاجر يصمّم صورته على المقاس، ومصيبة لما يرفع صورة جاهزة بمقاس
   * تاني وما يعرفش ليه اتقصّت.
   *
   * ومع `auto` الصورة بتتعرض كاملة زي ما هي، والبانر بيطول أو يقصر
   * وراها — على الفون والكمبيوتر كل واحد بصورته.
   */
  height: 'sm' | 'md' | 'lg' | 'full' | 'auto'
  autoplay: boolean
  intervalSeconds: number
  slides: HeroSlide[]
}

/* ────────────────────────── صفحة المنتجات ────────────────────────── */

export type ListingSettings = {
  columnsDesktop: 2 | 3 | 4 | 5
  columnsMobile: 1 | 2
  cardStyle: 'clean' | 'overlay' | 'framed' | 'editorial' | 'compact'
  imageRatio: 'square' | 'portrait' | 'wide'
  showCategoryFilter: boolean
  showSort: boolean
  showRating: boolean
  showQuickAdd: boolean
  perPage: number
}

/* ────────────────────────── صفحة المنتج ────────────────────────── */

export type ProductPageSettings = {
  galleryLayout: 'stacked' | 'thumbs-side' | 'thumbs-bottom'
  showSku: boolean
  showStockCounter: boolean
  showShippingNote: boolean
  showReturnNote: boolean
  showWhatsappAsk: boolean
  showRelated: boolean
  relatedTitle: string
  stickyBuyBarOnMobile: boolean
  trustLines: string[]
}

/* ────────────────────────── السلة ────────────────────────── */

export type CartSettings = {
  mode: 'drawer' | 'page'
  showUpsell: boolean
  upsellTitle: string
  showNotes: boolean
  showCouponField: boolean
  freeShippingBar: boolean
  freeShippingThreshold: number
  emptyMessage: string
}

/* ────────────────────────── الفوتر ────────────────────────── */

export type FooterLink = { id: string; label: string; url: string }

export type FooterSettings = {
  about: string
  showPaymentIcons: boolean
  showSocial: boolean
  social: { facebook: string; instagram: string; tiktok: string; whatsapp: string; youtube: string }
  links: FooterLink[]
  copyright: string
  showPoweredBy: boolean
}

/* ────────────────────────── شريط الأدوات العائم ────────────────────────── */

export type ToolbarSettings = {
  whatsappEnabled: boolean
  whatsappNumber: string
  whatsappMessage: string
  /**
   * تيليجرام كقناة تواصل للعملاء — زي الواتساب بالظبط.
   *
   * مالوش أي علاقة ببوت الإشعارات في صفحة الأتمتة: ده رابط
   * لمحادثة التاجر نفسه عشان العميل يسأله، وده بوت بيبلّغ
   * التاجر بطلباته. الاتنين على تيليجرام والباقي مختلف.
   */
  telegramEnabled: boolean
  /** اسم المستخدم من غير @ — تيليجرام مالوش روابط بالرقم */
  telegramUsername: string
  position: 'start' | 'end'
  showOnMobile: boolean
  showOnDesktop: boolean
  mobileNavEnabled: boolean
  backToTop: boolean
}

/* ────────────────────────── شاشة التحميل ────────────────────────── */

export type PreloaderSettings = {
  enabled: boolean
  /** logo = شعار المتجر ينبض · ring = حلقة تدور · dots = ثلاث نقاط */
  style: 'logo' | 'ring' | 'dots'
  background: string
  color: string
}

/* ────────────────────────── الحركة ────────────────────────── */

/**
 * حركة الظهور عند التمرير.
 *
 * الحركة مش زينة: هي اللي بتقول للعين «فيه حاجة جديدة هنا» وبتخلّي
 * الصفحة الطويلة تتقرا على مراحل بدل ما تنزل كتلة واحدة.
 *
 * **وبتتقفل لوحدها لمن طالب بتقليل الحركة** في إعدادات نظامه — دي
 * مش تفضيل شكلي، ناس بتتعبها الحركة فعلًا (دوخة وصداع).
 */
export type ScrollAnimation = 'none' | 'fade' | 'rise' | 'zoom' | 'blur' | 'slide'

export type EffectsSettings = {
  scroll: ScrollAnimation
  speed: 'slow' | 'normal' | 'fast'
  /** العناصر جوّه البلوك تظهر ورا بعض بدل مرة واحدة */
  stagger: boolean
  /** البطاقة بتطلع لفوق شوية تحت الماوس */
  hoverLift: boolean
  /** الصورة بتكبر جوّه إطارها عند المرور */
  imageZoom: boolean
  /** التمرير الناعم لروابط نفس الصفحة */
  smoothScroll: boolean
}

/* ────────────────────────── المجموع ────────────────────────── */

export type Customization = {
  identity: IdentitySettings
  announcement: AnnouncementSettings
  header: HeaderSettings
  hero: HeroSettings
  listing: ListingSettings
  productPage: ProductPageSettings
  cart: CartSettings
  footer: FooterSettings
  toolbar: ToolbarSettings
  preloader: PreloaderSettings
  effects: EffectsSettings
}

export type PanelKey = keyof Customization

export const PANELS: Array<{ key: PanelKey; label: string; hint: string }> = [
  { key: 'identity', label: 'الهوية', hint: 'الألوان والشعار والخطوط' },
  { key: 'announcement', label: 'شريط الإعلان', hint: 'رسالة أعلى الصفحة' },
  { key: 'header', label: 'الهيدر', hint: 'القائمة العلوية وأدواتها' },
  { key: 'hero', label: 'البانر الرئيسي', hint: 'شرائح أول الصفحة' },
  { key: 'listing', label: 'صفحة المنتجات', hint: 'شبكة العرض والفلاتر' },
  { key: 'productPage', label: 'صفحة المنتج', hint: 'المعرض والتفاصيل' },
  { key: 'cart', label: 'السلة', hint: 'الدرج والعروض الإضافية' },
  { key: 'footer', label: 'الفوتر', hint: 'الروابط والتواصل' },
  { key: 'toolbar', label: 'شريط الأدوات', hint: 'زر واتساب والتنقّل السفلي' },
  { key: 'preloader', label: 'شاشة التحميل', hint: 'اللي بيظهر لحظة فتح المتجر' },
  { key: 'effects', label: 'الحركة', hint: 'ظهور الأقسام مع التمرير' },
]

/** إعدادات افتراضية معقولة — متجر جديد يبان محترم من غير أي تعديل */
export function defaultCustomization(theme: {
  palette: { primary: string; accent: string; background: string; surface: string; text: string }
  radius: Radius
  layout: {
    hero: HeroSettings['style']
    columns: 2 | 3 | 4
    card: ListingSettings['cardStyle']
    imageRatio: ListingSettings['imageRatio']
    nav: HeaderSettings['layout']
    showSearchInHeader: boolean
    showCategoryStrip: boolean
  }
}): Customization {
  return {
    identity: {
      primary: theme.palette.primary,
      accent: theme.palette.accent,
      background: theme.palette.background,
      surface: theme.palette.surface,
      text: theme.palette.text,
      radius: theme.radius,
      fontHeading: 'plex',
      fontBody: 'plex',
      iconSet: 'lucide',
      logoLight: null,
      logoDark: null,
      favicon: null,
      hideNameInHeader: false,
    },
    announcement: {
      enabled: false,
      text: 'شحن مجاني للطلبات فوق ١٠٠٠ جنيه',
      link: '',
      background: theme.palette.primary,
      color: '#ffffff',
      dismissible: true,
      sticky: false,
    },
    header: {
      layout: theme.layout.nav,
      sticky: true,
      showSearch: theme.layout.showSearchInHeader,
      showCart: true,
      showAccount: true,
      showWishlist: false,
      showCategoriesBar: theme.layout.showCategoryStrip,
      logoHeight: 40,
    },
    hero: {
      style: theme.layout.hero,
      height: 'md',
      autoplay: true,
      intervalSeconds: 6,
      slides: [],
    },
    listing: {
      columnsDesktop: theme.layout.columns,
      columnsMobile: 2,
      cardStyle: theme.layout.card,
      imageRatio: theme.layout.imageRatio,
      showCategoryFilter: true,
      showSort: true,
      showRating: true,
      showQuickAdd: false,
      perPage: 24,
    },
    productPage: {
      galleryLayout: 'thumbs-bottom',
      showSku: false,
      showStockCounter: true,
      showShippingNote: true,
      showReturnNote: true,
      showWhatsappAsk: true,
      showRelated: true,
      relatedTitle: 'منتجات ممكن تعجبك',
      stickyBuyBarOnMobile: true,
      trustLines: ['التوصيل لكل المحافظات · الدفع عند الاستلام متاح', 'إرجاع سهل لو المنتج مش زي ما توقّعت'],
    },
    cart: {
      mode: 'drawer',
      showUpsell: true,
      upsellTitle: 'أكمل طلبك',
      showNotes: true,
      showCouponField: true,
      freeShippingBar: false,
      freeShippingThreshold: 100000,
      emptyMessage: 'سلتك فاضية',
    },
    footer: {
      about: '',
      showPaymentIcons: true,
      showSocial: true,
      social: { facebook: '', instagram: '', tiktok: '', whatsapp: '', youtube: '' },
      links: [],
      copyright: '',
      showPoweredBy: true,
    },
    toolbar: {
      whatsappEnabled: false,
      whatsappNumber: '',
      whatsappMessage: 'مرحبًا، عايز أستفسر عن منتج',
      telegramEnabled: false,
      telegramUsername: '',
      position: 'end',
      showOnMobile: true,
      showOnDesktop: true,
      mobileNavEnabled: true,
      backToTop: true,
    },
    preloader: {
      enabled: false,
      style: 'logo',
      background: theme.palette.background,
      color: theme.palette.primary,
    },
    effects: {
      scroll: 'rise',
      speed: 'normal',
      stagger: true,
      hoverLift: true,
      imageZoom: true,
      smoothScroll: true,
    },
  }
}

/**
 * دمج المحفوظ فوق الافتراضي.
 *
 * عميق على مستوى اللوحة الواحدة: لو ضفنا خيارًا جديدًا بعد ما التاجر
 * حفظ إعداداته، بياخد قيمته الافتراضية بدل ما يبقى undefined ويكسر
 * الواجهة.
 */
export function mergeCustomization(
  base: Customization,
  saved: Partial<Record<PanelKey, unknown>> | null | undefined,
): Customization {
  if (!saved) return base

  // النسخ لوحة بلوحة بأنواع صريحة: الحلقة العامة بتخلي TypeScript
  // يوحّد أنواع اللوحات كلها في نوع واحد مستحيل يتحقق
  const pick = <K extends PanelKey>(key: K): Customization[K] => {
    const savedPanel = saved[key]
    if (!savedPanel || typeof savedPanel !== 'object') return base[key]
    return { ...base[key], ...(savedPanel as object) } as Customization[K]
  }

  return {
    identity: pick('identity'),
    announcement: pick('announcement'),
    header: pick('header'),
    hero: pick('hero'),
    listing: pick('listing'),
    productPage: pick('productPage'),
    cart: pick('cart'),
    footer: pick('footer'),
    toolbar: pick('toolbar'),
    preloader: pick('preloader'),
    effects: pick('effects'),
  }
}

export const RADIUS_PX: Record<Radius, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '14px',
  full: '999px',
}

export const FONT_STACKS: Record<FontChoice, string> = {
  plex: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
  cairo: "'Cairo', 'Segoe UI', Tahoma, sans-serif",
  tajawal: "'Tajawal', 'Segoe UI', Tahoma, sans-serif",
  almarai: "'Almarai', 'Segoe UI', Tahoma, sans-serif",
  system: "'Segoe UI', Tahoma, system-ui, sans-serif",
}

export const FONT_LABELS: Record<FontChoice, string> = {
  plex: 'IBM Plex Arabic',
  cairo: 'Cairo',
  tajawal: 'Tajawal',
  almarai: 'Almarai',
  system: 'خط النظام',
}
