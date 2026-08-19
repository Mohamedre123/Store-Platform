/**
 * صفحات الهبوط.
 *
 * الفكرة الحاكمة: **الصفحة دي مستقلة عن ثيم المتجر تمامًا.** التاجر
 * بيعمل صفحة لمنتج واحد بألوانها وخطوطها اللي مالهاش أي علاقة بشكل
 * متجره — لأن صفحة الهبوط بتتبنى حوالين حملة إعلانية، والحملة ليها
 * هويتها.
 *
 * الصفحة = قايمة بلوكات مرتّبة. كل بلوك نوع وإعدادات، والتاجر بيرتّبهم
 * ويشيل ويضيف براحته. نفس مبدأ محرّر الثيم، بس على بلوكات بدل لوحات.
 *
 * الملف ده مشترك بين الخادم والمتصفح (المحرّر) — من غير `server-only`.
 */

export type BlockType =
  | 'hero'
  | 'features'
  | 'product'
  | 'gallery'
  | 'testimonials'
  | 'faq'
  | 'countdown'
  | 'cta'
  | 'text'
  | 'video'

export type Block = {
  id: string
  type: BlockType
  settings: Record<string, unknown>
}

export type BlockDef = {
  type: BlockType
  label: string
  hint: string
  /** إعدادات البلوك لما يتضاف لأول مرة */
  defaults: Record<string, unknown>
}

export const BLOCK_LIBRARY: BlockDef[] = [
  {
    type: 'hero',
    label: 'الواجهة',
    hint: 'عنوان كبير وصورة وزرار — أول حاجة العميل بيشوفها.',
    defaults: {
      title: 'المنتج اللي كنت بتدوّر عليه',
      subtitle: 'اطلبه دلوقتي والتوصيل لحد باب بيتك',
      ctaLabel: 'اطلب الآن',
      image: null,
      align: 'center',
      overlay: 40,
    },
  },
  {
    type: 'features',
    label: 'المميزات',
    hint: 'ليه العميل يشتري؟ ٣ لـ٦ نقاط قصيرة.',
    defaults: {
      title: 'ليه تختاره؟',
      items: [
        { icon: 'check', title: 'خامة ممتازة', text: 'مصنوع بعناية عشان يفضل معاك' },
        { icon: 'truck', title: 'توصيل سريع', text: 'لكل المحافظات خلال أيام' },
        { icon: 'shield', title: 'ضمان الاسترجاع', text: 'مش عاجبك؟ رجّعه' },
      ],
    },
  },
  {
    type: 'product',
    label: 'المنتج والسعر',
    hint: 'صورة المنتج وسعره وزرار الشراء — قلب الصفحة.',
    defaults: { showCompareAt: true, ctaLabel: 'اطلب الآن', showStock: true },
  },
  {
    type: 'gallery',
    label: 'معرض صور',
    hint: 'صور إضافية للمنتج من زوايا مختلفة.',
    defaults: { title: '', images: [], columns: 3 },
  },
  {
    type: 'testimonials',
    label: 'آراء العملاء',
    hint: 'الدليل الاجتماعي — أقوى سبب للشراء.',
    defaults: {
      title: 'عملاؤنا بيقولوا',
      items: [
        { name: 'أحمد', text: 'المنتج وصلني بسرعة والجودة ممتازة', rating: 5 },
        { name: 'منى', text: 'تعامل محترم وسعر كويس جدًا', rating: 5 },
      ],
    },
  },
  {
    type: 'faq',
    label: 'أسئلة شائعة',
    hint: 'بترد على اعتراضات العميل قبل ما يسألها.',
    defaults: {
      title: 'أسئلة شائعة',
      items: [
        { q: 'التوصيل بياخد قد إيه؟', a: 'من يومين لأربعة حسب المحافظة.' },
        { q: 'أقدر أرجّع المنتج؟', a: 'أكيد، خلال ١٤ يوم من الاستلام.' },
      ],
    },
  },
  {
    type: 'countdown',
    label: 'عدّاد تنازلي',
    hint: 'بيخلق إلحاحًا — استخدمه لعرض حقيقي بس.',
    defaults: { title: 'العرض ينتهي خلال', minutes: 30 },
  },
  {
    type: 'cta',
    label: 'زرار دعوة',
    hint: 'دعوة أخيرة للشراء في آخر الصفحة.',
    defaults: { title: 'جاهز تطلب؟', subtitle: '', ctaLabel: 'اطلب الآن' },
  },
  {
    type: 'text',
    label: 'نص حر',
    hint: 'فقرة شرح أو تفاصيل إضافية.',
    defaults: { title: '', body: '' },
  },
  {
    type: 'video',
    label: 'فيديو',
    hint: 'رابط يوتيوب — الفيديو بيرفع التحويل كتير.',
    defaults: { title: '', url: '' },
  },
]

export function blockDef(type: string) {
  return BLOCK_LIBRARY.find((b) => b.type === type)
}

/* ────────────────────────── هوية الصفحة ────────────────────────── */

export type LandingTokens = {
  primary: string
  background: string
  surface: string
  text: string
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full'
  font: 'plex' | 'cairo' | 'tajawal' | 'almarai' | 'system'
  /** عرض المحتوى — الصفحة الضيّقة بتركّز الانتباه */
  width: 'narrow' | 'normal' | 'wide'
}

export const DEFAULT_TOKENS: LandingTokens = {
  primary: '#634b9a',
  background: '#ffffff',
  surface: '#f6f6f9',
  text: '#222540',
  radius: 'md',
  font: 'plex',
  width: 'normal',
}

export function mergeTokens(saved: Record<string, unknown> | null | undefined): LandingTokens {
  if (!saved || typeof saved !== 'object') return DEFAULT_TOKENS
  return { ...DEFAULT_TOKENS, ...(saved as Partial<LandingTokens>) }
}

export const WIDTH_PX: Record<LandingTokens['width'], string> = {
  narrow: '42rem',
  normal: '56rem',
  wide: '72rem',
}

/** قوالب جاهزة — التاجر يبدأ من واحد بدل صفحة بيضا */
export const TEMPLATES: Array<{ key: string; name: string; hint: string; blocks: BlockType[] }> = [
  {
    key: 'classic',
    name: 'الكلاسيكي',
    hint: 'واجهة، مميزات، منتج، آراء، أسئلة، دعوة',
    blocks: ['hero', 'features', 'product', 'testimonials', 'faq', 'cta'],
  },
  {
    key: 'direct',
    name: 'المباشر',
    hint: 'منتج وسعر فورًا — للحملات السريعة',
    blocks: ['hero', 'product', 'features', 'cta'],
  },
  {
    key: 'story',
    name: 'القصة',
    hint: 'شرح مطوّل قبل العرض — للمنتجات اللي محتاجة إقناع',
    blocks: ['hero', 'text', 'gallery', 'features', 'testimonials', 'product', 'faq', 'cta'],
  },
  {
    key: 'urgent',
    name: 'العرض المحدود',
    hint: 'عدّاد وإلحاح — لعروض بمدة',
    blocks: ['hero', 'countdown', 'product', 'features', 'testimonials', 'cta'],
  },
]
