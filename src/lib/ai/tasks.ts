import 'server-only'
import { briefLine, type StoreBrief } from './store-context'

/**
 * مهام التحسين.
 *
 * كل مهمة عارفة **حدودها**: العنوان مش بيطلع فقرة، والوصف المختصر مش
 * بيطلع مقال. من غير الحدود دي الموديل بيرجّع أطول حاجة يقدر عليها،
 * والتاجر يلزق نص بيتقص في جوجل أو بيكسر تصميم الكارت.
 *
 * وكل مهمة بترجّع **٣ اقتراحات** لا واحد. الاستبدال المباشر بيخلّي
 * التاجر يقبل أول حاجة تيجي؛ الاختيار من تلاتة بيخلّيه يقرا ويقارن.
 */

export type TaskKey =
  | 'product_name'
  | 'product_description'
  | 'seo_title'
  | 'seo_description'
  | 'category_description'
  | 'short_description'
  | 'banner_text'
  | 'landing_headline'
  | 'email_text'
  | 'blog_title'
  | 'blog_excerpt'
  | 'blog_content'
  | 'page_content'
  | 'store_tagline'
  | 'free'

type TaskDef = {
  label: string
  /** وصف المطلوب — بيتحط في تعليمات النظام */
  instruction: string
  /** الحد الأقصى بالحروف — بيتقال للموديل وبيتفرض بعد الرد كمان */
  maxChars: number
  variants: number
}

export const TASKS: Record<TaskKey, TaskDef> = {
  product_name: {
    label: 'اسم المنتج',
    instruction:
      'اكتب اسم منتج للبيع أونلاين. لازم يبدأ بنوع المنتج نفسه (اللي الناس بتكتبه في البحث)، وبعدها الصفة المميّزة أو الخامة أو الموديل. من غير كلمات دعائية فاضية زي «مميز» و«رائع» و«أفضل». من غير علامات تعجّب ولا إيموجي.',
    maxChars: 70,
    variants: 3,
  },
  product_description: {
    label: 'وصف المنتج',
    instruction:
      'اكتب وصف منتج يخلّي العميل يشتري. ابدأ بالفايدة اللي هيحسّها، وبعدين التفاصيل العملية: الخامة، المقاسات، الاستخدام، العناية. جُمل قصيرة وسطور منفصلة. من غير مبالغة ولا وعود ما نقدرش نلتزم بيها.',
    maxChars: 600,
    variants: 2,
  },
  short_description: {
    label: 'الوصف المختصر',
    instruction:
      'اكتب سطر واحد بيلخّص المنتج — بيظهر تحت الاسم في قايمة المنتجات. أهم ميزة واحدة بس.',
    maxChars: 110,
    variants: 3,
  },
  seo_title: {
    label: 'عنوان صفحة المنتج',
    instruction:
      'اكتب عنوان صفحة لجوجل. لازم يبدأ بالكلمة اللي الناس بتدوّر بيها فعلًا، وفيه اسم المنتج وأهم صفة. من غير حشو كلمات مفتاحية مكرّرة — جوجل بيعاقب عليها.',
    maxChars: 60,
    variants: 3,
  },
  seo_description: {
    label: 'وصف صفحة المنتج',
    instruction:
      'اكتب الوصف اللي بيظهر في نتيجة جوجل تحت العنوان. لازم يقنع بالضغط: إيه المنتج، ليه من عندنا، وحاجة عملية (شحن، ضمان، سعر). جملة أو اتنين.',
    maxChars: 155,
    variants: 3,
  },
  category_description: {
    label: 'وصف القسم',
    instruction: 'اكتب وصفًا قصيرًا لقسم منتجات — إيه اللي فيه ولمين.',
    maxChars: 200,
    variants: 2,
  },
  banner_text: {
    label: 'نص البانر',
    instruction:
      'اكتب نص بانر إعلاني في المتجر. قصير جدًا وواضح، وفيه سبب للضغط دلوقتي.',
    maxChars: 70,
    variants: 3,
  },
  landing_headline: {
    label: 'عنوان صفحة الهبوط',
    instruction:
      'اكتب عنوانًا رئيسيًا لصفحة هبوط منتج. لازم يقول الفايدة الأساسية في جملة واحدة، مش يوصف المنتج.',
    maxChars: 80,
    variants: 3,
  },
  blog_title: {
    label: 'عنوان المقال',
    instruction:
      'اكتب عنوان مقال لمدوّنة متجر. لازم يوعد بفايدة محدّدة يقراها العميل، ويكون فيه الكلمة اللي بيدوّر بيها. من غير كلام رنّان مالوش مضمون.',
    maxChars: 70,
    variants: 3,
  },
  blog_excerpt: {
    label: 'مقدّمة المقال',
    instruction:
      'اكتب سطرين بيلخّصوا المقال ويخلّوا القارئ يكمّل. بيظهروا في قايمة المقالات وفي نتيجة البحث.',
    maxChars: 160,
    variants: 3,
  },
  blog_content: {
    label: 'محتوى المقال',
    instruction:
      'اكتب مقال مدوّنة لمتجر. ابدأ بالمشكلة اللي القارئ فيها، وبعدين الحل بخطوات عملية. عناوين فرعية وفقرات قصيرة. من غير حشو ولا مقدمات طويلة.',
    maxChars: 2500,
    variants: 1,
  },
  page_content: {
    label: 'محتوى الصفحة',
    instruction:
      'اكتب محتوى صفحة سياسات لمتجر (شحن، استبدال، خصوصية…). واضح ومباشر وبالعربي البسيط. ما تخترعش مدد ولا شروط — سيب أماكن للتاجر يملاها لو مش معروفة.',
    maxChars: 1500,
    variants: 1,
  },
  store_tagline: {
    label: 'جملة المتجر التعريفية',
    instruction:
      'اكتب جملة واحدة بتوصف المتجر — بتظهر تحت اسمه. تقول بيبيع إيه ولمين في أقل كلام ممكن.',
    maxChars: 70,
    variants: 3,
  },
  email_text: {
    label: 'نص الرسالة',
    instruction: 'اكتب نص رسالة قصيرة للعميل. ودود ومباشر ومن غير مبالغة.',
    maxChars: 400,
    variants: 2,
  },
  free: {
    label: 'تحسين',
    instruction: 'حسّن النص المكتوب وخلّيه أوضح وأقوى، من غير ما تغيّر معناه.',
    maxChars: 600,
    variants: 2,
  },
}

/**
 * تعليمات النظام.
 *
 * التعليمات بتتبعت منفصلة عن كلام التاجر (systemInstruction) لا
 * كأول رسالة — كده الموديل بيفرّق بين الاتنين، وأصعب إن نص جاي من
 * برّه يقنعه يتجاهلها.
 */
export function buildSystem(task: TaskKey, brief: StoreBrief): string {
  const def = TASKS[task]

  return [
    'إنت كاتب محتوى تجاري مصري بتشتغل لمتجر إلكتروني.',
    '',
    `المتجر: ${brief.name}`,
    `عن المتجر: ${briefLine(brief)}`,
    brief.categories.length ? `أقسامه: ${brief.categories.slice(0, 10).join('، ')}` : '',
    '',
    `المطلوب: ${def.instruction}`,
    '',
    'قواعد ملزمة:',
    '- اكتب بالعربي المصري اللي التاجر وعميله بيتكلموه، مش فصحى تقريرية.',
    `- أقصى طول ${def.maxChars} حرف لكل اقتراح.`,
    '- من غير إيموجي، ومن غير هاشتاجات، ومن غير علامات تنصيص حوالين الاقتراح.',
    '- ما تخترعش مواصفات مش موجودة في اللي التاجر كتبه (مقاسات، خامات، ضمان).',
    '',
    `رجّع ${def.variants} اقتراحات بالظبط، كل واحد في سطر لوحده، مسبوق بـ«- » ومن غير أي كلام تاني قبلهم أو بعدهم.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** الرسالة اللي بتتبعت للموديل */
export function buildPrompt(input: {
  task: TaskKey
  current: string
  /** بيانات المنتج اللي بيتحسّن — بتفرق جدًا في جودة الناتج */
  fields?: Record<string, string | null | undefined>
  /** توجيه إضافي من التاجر: «خلّيه أقصر» أو «ركّز على الجودة» */
  hint?: string
}): string {
  const lines: string[] = []

  if (input.current.trim()) {
    lines.push(`النص الحالي:\n${input.current.trim()}`)
  } else {
    lines.push('مافيش نص حالي — اكتب من الأول.')
  }

  const context = Object.entries(input.fields ?? {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)

  if (context.length) lines.push(`\nبيانات المنتج:\n${context.join('\n')}`)
  if (input.hint?.trim()) lines.push(`\nملاحظة من التاجر: ${input.hint.trim()}`)

  return lines.join('\n')
}

/**
 * تفكيك رد الموديل لاقتراحات.
 *
 * الموديل بيخالف الشكل المطلوب أحيانًا — بيحط ترقيم أو علامات تنصيص
 * أو مقدمة. التنظيف هنا لأن الاعتماد على الالتزام بيكسر الواجهة أول
 * مرة يخالف فيها.
 */
export function parseSuggestions(raw: string, task: TaskKey): string[] {
  const def = TASKS[task]

  /*
    النصوص الطويلة (مقال، صفحة سياسات) بترجع **كنص واحد** لا كسطور.
    التفكيك بالسطر كان بيقطّع المقال لعشرين «اقتراح» كل واحد سطر —
    والتاجر يلاقي فقرات مبعترة مكان مقاله.

    العلامة: اقتراح واحد مطلوب + مساحة طويلة.
  */
  if (def.variants === 1 && def.maxChars > 500) {
    const body = raw
      .split('\n')
      .filter((l, i) => !(i === 0 && /^(?:إليك|اليك|إليكم|دي|دول|هي|هذه|هنا)\s.*[:：]\s*$/.test(l.trim())))
      .join('\n')
      .trim()

    if (!body) return []
    return [body.length <= def.maxChars ? body : body.slice(0, def.maxChars).trim()]
  }

  const out = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // الترقيم أو الشرطة في أول السطر
    .map((l) => l.replace(/^[-*•]\s*/, '').replace(/^\d+[.)-]\s*/, ''))
    // علامات التنصيص اللي بيلفّ بيها الاقتراح
    .map((l) => l.replace(/^["'«»“”]+|["'«»“”]+$/g, '').trim())
    .filter((l) => l.length > 1)
    /*
      سطور المقدمة زي «إليك ٣ اقتراحات:».

      من غير \b: حدود الكلمات في الريجيكس مبنية على [A-Za-z0-9_]،
      فكل الحروف العربية «مش كلمة» عندها و\b ما بيطابقش بعدها أبدًا.
      الفلتر اللي كان معتمد عليه كان بيعدّي المقدمة كأنها اقتراح —
      فالتاجر يلاقي «إليك ٣ اقتراحات:» ضمن اختياراته.
    */
    .filter((l) => !/^(?:إليك|اليك|إليكم|دي|دول|هي|هذه|هنا)\s.*[:：]\s*$/.test(l))

  const unique = [...new Set(out)]

  /*
    القص عند الحد بدل الرفض: اقتراح أطول بـ٥ حروف أحسن من لا شيء.
    بنقص عند آخر مسافة عشان ما نقطعش كلمة في نصها.
  */
  return unique.slice(0, def.variants).map((s) => {
    if (s.length <= def.maxChars) return s
    const cut = s.slice(0, def.maxChars)
    const lastSpace = cut.lastIndexOf(' ')
    return (lastSpace > def.maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
  })
}
