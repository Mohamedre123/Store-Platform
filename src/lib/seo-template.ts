/**
 * قوالب السيو.
 *
 * التاجر بيكتب القالب مرة — «{Name} من {Brand}» — وكل منتج بياخد
 * عنوانه منه. ولو غيّر اسم المنتج بعد شهر، العنوان بيتغيّر معاه.
 * لو كنا حفظنا النص المحلول ساعة الكتابة، كان هيفضل على الاسم القديم
 * والتاجر ما يلاحظش غير لما يشوف نتيجته في جوجل غلط.
 *
 * من غير `server-only`: المحرّر بيعرض معاينة حيّة وهو بيكتب، والمتجر
 * بيحلّ نفس القالب على الخادم. المصدر لازم يبقى واحد وإلا المعاينة
 * تكدب على التاجر.
 */

export type SeoVariable = {
  token: string
  label: string
  /** الحقول اللي المتغيّر ده منطقي فيها */
  fields: Array<'title' | 'url' | 'description'>
}

export const SEO_VARIABLES: SeoVariable[] = [
  { token: '{Name}', label: 'اسم المنتج', fields: ['title', 'url', 'description'] },
  { token: '{Category}', label: 'التصنيف', fields: ['title', 'url', 'description'] },
  { token: '{Brand}', label: 'الماركة', fields: ['title', 'url', 'description'] },
  { token: '{SKU}', label: 'رمز التخزين', fields: ['url'] },
  { token: '{Price}', label: 'السعر', fields: ['title', 'description'] },
  { token: '{Store}', label: 'اسم المتجر', fields: ['title', 'description'] },
]

export type SeoContext = {
  name: string
  category?: string | null
  brand?: string | null
  sku?: string | null
  price?: string | null
  store?: string | null
}

/**
 * يحلّ القالب.
 *
 * المتغيّر اللي مالوش قيمة بيتشال مع أي فاصل ملزوق بيه: «{Name} من
 * {Brand}» على منتج من غير ماركة لازم تطلع «تيشيرت» مش «تيشيرت من».
 * الشرطة المعلّقة في آخر عنوان بتبان إهمالًا في نتيجة البحث.
 */
export function renderSeo(template: string | null | undefined, ctx: SeoContext): string {
  if (!template?.trim()) return ''

  const values: Record<string, string> = {
    '{Name}': ctx.name ?? '',
    '{Category}': ctx.category ?? '',
    '{Brand}': ctx.brand ?? '',
    '{SKU}': ctx.sku ?? '',
    '{Price}': ctx.price ?? '',
    '{Store}': ctx.store ?? '',
  }

  let out = template

  for (const [token, value] of Object.entries(values)) {
    if (value) {
      out = out.split(token).join(value)
      continue
    }
    /*
      المتغيّر الفاضي بياخد معاه اللي ملزوق بيه — علامة كانت أو كلمة ربط.

      «{Name} من {Brand}» على منتج من غير ماركة لازم تطلع «تيشيرت»
      مش «تيشيرت من». الكلمة المعلّقة بتبان في نتيجة البحث أوحش من
      الشرطة، لأن القارئ بيحس إن الجملة اتقطعت في نصها.

      الترتيب مقصود: كلمة الربط الأول (أطول تطابق)، بعدين العلامة،
      وآخر حاجة المتغيّر لوحده.
    */
    const escaped = token.replace(/[{}]/g, '\\$&')
    const joiners = 'من|في|على|عند|مع|لدى|from|by|at|in|for|with|of'

    out = out.replace(new RegExp(`\\s+(?:${joiners})\\s+${escaped}`, 'gi'), '')
    out = out.replace(new RegExp(`${escaped}\\s+(?:${joiners})\\s+`, 'gi'), '')
    out = out.replace(new RegExp(`\\s*[-—–|،,:؛]\\s*${escaped}`, 'g'), '')
    out = out.replace(new RegExp(`${escaped}\\s*[-—–|،,:؛]\\s*`, 'g'), '')
    out = out.split(token).join('')
  }

  // مسافات مضاعفة ناتجة عن الحذف، وأي فاصل معلّق في الطرفين
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-—–|،,:؛]+|[\s\-—–|،,:؛]+$/g, '')
    .trim()
}

/**
 * الرابط: بيتحلّ **مرة واحدة وقت الحفظ** لا مع كل عرض.
 *
 * ده الفرق المهم عن العنوان والوصف. الرابط لازم يفضل ثابت: لو
 * التاجر عدّل اسم المنتج والرابط اتغيّر معاه، كل لينك اتبعت على
 * واتساب أو اتفهرس في جوجل بيبقى ٤٠٤.
 */
export function renderSeoSlug(template: string | null | undefined, ctx: SeoContext): string {
  const raw = renderSeo(template, ctx)
  if (!raw) return ''
  return slugifySeo(raw)
}

/** حروف عربية ولاتينية وأرقام وشرطات — والباقي بيتشال */
export function slugifySeo(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** الحدود اللي جوجل بيقص عندها — التاجر لازم يشوفها وهو بيكتب */
export const SEO_LIMITS = { title: 60, description: 160 } as const
