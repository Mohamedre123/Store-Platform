import { z } from 'zod'

/**
 * مخطط صفحة الهبوط اللي كلود مسموح يرجّعها.
 *
 * نفس حاجز الثيمات: **إعدادات لا كود.** كلود بيختار بلوكات من
 * مكتبتنا ويملا نصوصها — مش بيكتب HTML ولا CSS. أي نوع بلوك مش
 * عندنا بيترفض، وأي حقل زيادة بيتشال.
 *
 * الصور مش من كلود: بيسيب مكانها فاضي والتاجر بيرفعها، أو بتتاخد
 * من المنتج المربوط. لو خلّيناه يحط روابط، هيخترع روابط مش شغّالة
 * والصفحة تطلع بصور مكسورة.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'اللون لازم يكون #RRGGBB')

/** البلوكات وحقولها النصّية اللي كلود بيملاها */
const heroBlock = z.object({
  type: z.literal('hero'),
  title: z.string().trim().min(2).max(90),
  subtitle: z.string().trim().max(160).optional(),
  ctaLabel: z.string().trim().max(30).optional(),
  align: z.enum(['start', 'center']).optional(),
})

const featuresBlock = z.object({
  type: z.literal('features'),
  title: z.string().trim().max(80).optional(),
  items: z
    .array(
      z.object({
        icon: z.enum(['check', 'truck', 'shield', 'star', 'heart', 'zap', 'gift', 'clock']),
        title: z.string().trim().min(2).max(50),
        text: z.string().trim().max(120),
      }),
    )
    .min(2)
    .max(6),
})

const productBlock = z.object({
  type: z.literal('product'),
  ctaLabel: z.string().trim().max(30).optional(),
  showCompareAt: z.boolean().optional(),
  showStock: z.boolean().optional(),
})

const testimonialsBlock = z.object({
  type: z.literal('testimonials'),
  title: z.string().trim().max(80).optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(40),
        text: z.string().trim().min(5).max(200),
        rating: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(6),
})

const faqBlock = z.object({
  type: z.literal('faq'),
  title: z.string().trim().max(80).optional(),
  items: z
    .array(
      z.object({
        q: z.string().trim().min(3).max(120),
        a: z.string().trim().min(3).max(400),
      }),
    )
    .min(1)
    .max(8),
})

const countdownBlock = z.object({
  type: z.literal('countdown'),
  title: z.string().trim().max(80).optional(),
  minutes: z.number().int().min(5).max(10080).optional(),
})

const ctaBlock = z.object({
  type: z.literal('cta'),
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(160).optional(),
  ctaLabel: z.string().trim().max(30).optional(),
})

const textBlock = z.object({
  type: z.literal('text'),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().min(10).max(1500),
})

const galleryBlock = z.object({
  type: z.literal('gallery'),
  title: z.string().trim().max(80).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

export const landingBlockSchema = z.discriminatedUnion('type', [
  heroBlock,
  featuresBlock,
  productBlock,
  testimonialsBlock,
  faqBlock,
  countdownBlock,
  ctaBlock,
  textBlock,
  galleryBlock,
])

export const landingPlanSchema = z.object({
  name: z.string().trim().min(2).max(60),
  rationale: z.string().trim().max(400).optional(),

  tokens: z
    .object({
      primary: hex.optional(),
      background: hex.optional(),
      surface: hex.optional(),
      text: hex.optional(),
      radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
      font: z.enum(['plex', 'cairo', 'tajawal', 'almarai', 'system']).optional(),
      width: z.enum(['narrow', 'normal', 'wide']).optional(),
    })
    .optional(),

  blocks: z.array(landingBlockSchema).min(2).max(12),
})

export type LandingPlan = z.infer<typeof landingPlanSchema>
export type LandingBlockPlan = z.infer<typeof landingBlockSchema>

/** دليل الحقول اللي بيتحط في تعليمات كلود */
export const LANDING_FIELD_GUIDE = `
{
  "name": "اسم الصفحة (٢-٦٠ حرف)",
  "rationale": "جملة قصيرة بتشرح اختياراتك",

  "tokens": {
    "primary": "#RRGGBB — لون الأزرار",
    "background": "#RRGGBB — خلفية الصفحة",
    "surface": "#RRGGBB — خلفية الأقسام",
    "text": "#RRGGBB — لون النص",
    "radius": "none | sm | md | lg | full",
    "font": "plex | cairo | tajawal | almarai | system",
    "width": "narrow | normal | wide"
  },

  "blocks": [
    { "type": "hero", "title": "…", "subtitle": "…", "ctaLabel": "…", "align": "start|center" },
    { "type": "features", "title": "…", "items": [
        { "icon": "check|truck|shield|star|heart|zap|gift|clock", "title": "…", "text": "…" }
    ]},
    { "type": "product", "ctaLabel": "…", "showCompareAt": true, "showStock": true },
    { "type": "gallery", "title": "…", "columns": 2|3|4 },
    { "type": "testimonials", "title": "…", "items": [
        { "name": "…", "text": "…", "rating": 1-5 }
    ]},
    { "type": "faq", "title": "…", "items": [ { "q": "…", "a": "…" } ] },
    { "type": "countdown", "title": "…", "minutes": 5-10080 },
    { "type": "text", "title": "…", "body": "…" },
    { "type": "cta", "title": "…", "subtitle": "…", "ctaLabel": "…" }
  ]
}`.trim()
