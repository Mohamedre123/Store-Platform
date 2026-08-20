import { z } from 'zod'

/**
 * مخطط الثيم اللي كلود مسموح يرجّعه.
 *
 * **ده الحاجز.** كلود بيرجّع إعدادات لا كودًا: ألوان وخطوط وتخطيطات
 * وترتيب أقسام. أي حاجة برّه المخطط ده بتترفض قبل ما تلمس المتجر.
 *
 * السبب مش شكلي: لو خلّيناه يكتب CSS أو جافاسكربت وإحنا بنشغّله في
 * متجر عليه فلوس عملاء، ثيم واحد وحش يقدر يوقّع المتجر أو يسرّب
 * بيانات. الإعدادات ما بتنفّذش حاجة — بتختار من مكوّنات إحنا كاتبينها.
 *
 * كل الحقول اختيارية: كلود بيرجّع اللي فهمه من كلام التاجر بس،
 * والباقي بيفضل زي ما هو. إجباره يملا كل حاجة بيخلّيه يخترع.
 */

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'اللون لازم يكون بصيغة #RRGGBB')

const radius = z.enum(['none', 'sm', 'md', 'lg', 'full'])
const font = z.enum(['plex', 'cairo', 'tajawal', 'almarai', 'system'])

export const themePlanSchema = z.object({
  /** اسم الثيم اللي كلود اقترحه — بيظهر للتاجر */
  name: z.string().trim().min(2).max(60),
  /** جملة بتشرح الاختيارات — التاجر يقرا ليه اللون ده */
  rationale: z.string().trim().max(400).optional(),

  identity: z
    .object({
      primary: hex.optional(),
      accent: hex.optional(),
      background: hex.optional(),
      surface: hex.optional(),
      text: hex.optional(),
      radius: radius.optional(),
      fontHeading: font.optional(),
      fontBody: font.optional(),
    })
    .optional(),

  announcement: z
    .object({
      enabled: z.boolean().optional(),
      text: z.string().trim().max(120).optional(),
      background: hex.optional(),
      color: hex.optional(),
      dismissible: z.boolean().optional(),
    })
    .optional(),

  header: z
    .object({
      layout: z.enum(['top', 'centered', 'split']).optional(),
      sticky: z.boolean().optional(),
      showSearch: z.boolean().optional(),
      showWishlist: z.boolean().optional(),
      showCategoriesBar: z.boolean().optional(),
      logoHeight: z.number().int().min(24).max(80).optional(),
    })
    .optional(),

  hero: z
    .object({
      style: z.enum(['fullbleed', 'boxed', 'split', 'stacked', 'none']).optional(),
      height: z.enum(['sm', 'md', 'lg', 'full']).optional(),
      autoplay: z.boolean().optional(),
    })
    .optional(),

  listing: z
    .object({
      columnsDesktop: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
      columnsMobile: z.union([z.literal(1), z.literal(2)]).optional(),
      cardStyle: z.enum(['clean', 'overlay', 'framed', 'editorial', 'compact']).optional(),
      imageRatio: z.enum(['square', 'portrait', 'wide']).optional(),
      showRating: z.boolean().optional(),
      showQuickAdd: z.boolean().optional(),
    })
    .optional(),

  productPage: z
    .object({
      galleryLayout: z.enum(['stacked', 'thumbs-side', 'thumbs-bottom']).optional(),
      showStockCounter: z.boolean().optional(),
      stickyBuyBarOnMobile: z.boolean().optional(),
    })
    .optional(),

  cart: z
    .object({
      mode: z.enum(['drawer', 'page']).optional(),
      showUpsell: z.boolean().optional(),
      freeShippingBar: z.boolean().optional(),
    })
    .optional(),

  preloader: z
    .object({
      enabled: z.boolean().optional(),
      style: z.enum(['logo', 'ring', 'dots']).optional(),
      background: hex.optional(),
      color: hex.optional(),
    })
    .optional(),
})

export type ThemePlan = z.infer<typeof themePlanSchema>

/** الحقول اللي كلود يقدر يلمسها — بتتحط في تعليماته */
export const THEME_FIELD_GUIDE = `
{
  "name": "اسم الثيم (٢-٦٠ حرف)",
  "rationale": "جملة قصيرة بتشرح اختياراتك للتاجر",

  "identity": {
    "primary": "#RRGGBB — اللون الأساسي: الأزرار والروابط",
    "accent": "#RRGGBB — لون مساعد للتمييز",
    "background": "#RRGGBB — خلفية الصفحة",
    "surface": "#RRGGBB — خلفية الكروت والهيدر",
    "text": "#RRGGBB — لون النص",
    "radius": "none | sm | md | lg | full",
    "fontHeading": "plex | cairo | tajawal | almarai | system",
    "fontBody": "نفس الاختيارات"
  },

  "announcement": {
    "enabled": true/false,
    "text": "نص شريط الإعلان",
    "background": "#RRGGBB",
    "color": "#RRGGBB",
    "dismissible": true/false
  },

  "header": {
    "layout": "top | centered | split",
    "sticky": true/false,
    "showSearch": true/false,
    "showWishlist": true/false,
    "showCategoriesBar": true/false,
    "logoHeight": 24-80
  },

  "hero": {
    "style": "fullbleed | boxed | split | stacked | none",
    "height": "sm | md | lg | full",
    "autoplay": true/false
  },

  "listing": {
    "columnsDesktop": 2 | 3 | 4 | 5,
    "columnsMobile": 1 | 2,
    "cardStyle": "clean | overlay | framed | editorial | compact",
    "imageRatio": "square | portrait | wide",
    "showRating": true/false,
    "showQuickAdd": true/false
  },

  "productPage": {
    "galleryLayout": "stacked | thumbs-side | thumbs-bottom",
    "showStockCounter": true/false,
    "stickyBuyBarOnMobile": true/false
  },

  "cart": {
    "mode": "drawer | page",
    "showUpsell": true/false,
    "freeShippingBar": true/false
  },

  "preloader": {
    "enabled": true/false,
    "style": "logo | ring | dots",
    "background": "#RRGGBB",
    "color": "#RRGGBB"
  }
}`.trim()

/**
 * فحص التباين.
 *
 * أكتر غلطة بتحصل في الثيمات المولّدة: لون نص قريب من الخلفية.
 * الشكل بيبان «أنيق» في الوصف والمتجر بيبقى غير مقروء — والتاجر
 * ما بيلاحظش غير لما عميل يشتكي.
 *
 * المعادلة تقريب مبسّط لنسبة التباين (WCAG). ٤.٥ هو الحد المقبول
 * للنص العادي.
 */
export function contrastRatio(a: string, b: string): number {
  const lum = (hexColor: string) => {
    const n = parseInt(hexColor.slice(1), 16)
    const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]
  }

  const la = lum(a)
  const lb = lum(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export type ContrastIssue = { pair: string; ratio: number }

/** بيرجّع المشاكل اللي لازم التاجر يعرفها قبل ما ينشر */
export function checkContrast(identity?: ThemePlan['identity']): ContrastIssue[] {
  if (!identity) return []
  const issues: ContrastIssue[] = []

  const pairs: Array<[string, string | undefined, string | undefined]> = [
    ['النص على الخلفية', identity.text, identity.background],
    ['النص على الكروت', identity.text, identity.surface],
  ]

  for (const [label, fg, bg] of pairs) {
    if (!fg || !bg) continue
    const ratio = contrastRatio(fg, bg)
    if (ratio < 4.5) issues.push({ pair: label, ratio: Math.round(ratio * 10) / 10 })
  }

  return issues
}
