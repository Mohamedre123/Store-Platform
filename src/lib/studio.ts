import 'server-only'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, studioAssets } from '@/db/schema'
import { generateImage } from './ai/gemini'
import {
  checkVideo as checkSora,
  downloadVideo as downloadSora,
  generateImage as openaiImage,
  startVideo as startSora,
} from './ai/openai'
import { generateText } from './ai/llm'
import { noteAiOutcome, resolveEngines, type Engine, modelFitsProvider } from './ai/settings'
import { catalogBlock, briefLine, getStoreBrief, operationsBlock } from './ai/store-context'
import { uploadImage, uploadVideo } from './storage'
import { getStoreTheme } from './storefront'
import { stores } from '@/db/schema'
import { publicStoreUrl } from './domain'
import { checkVideo, downloadVideo, listVideoModels, startVideo, type VeoAspect } from './ai/veo'
import { recordUpload } from './media'
import { formatMoney } from './utils'
import {
  craftOf,
  presetOf,
  STYLES,
  styleOf,
  toneOf,
  type Craft,
  type ImageStyle,
  type PresetKey,
  type ToneKey,
} from './studio-meta'

/** شكل محدَّد — «يختار لوحده» بيتحسم قبل الرسم */
type FixedStyle = Exclude<ImageStyle, 'auto'>

/**
 * استوديو المحتوى — بيولّد صور وكلام من بيانات المتجر نفسه.
 *
 * ## ليه «من بيانات المتجر» مش مجرد وصف
 * أي حد يقدر يفتح Gemini أو ChatGPT ويقول «اعملي بوست عن تيشيرت». اللي
 * إحنا عندنا وهو مش عنده: اسم المنتج بالظبط، وسعره بعملة المتجر،
 * ووصفه اللي التاجر كتبه، والمقاسات المتاحة، وسياسة الشحن والإرجاع.
 * البوست اللي فيه السعر والمقاسات الصح بيبيع؛ واللي بيقول «اسأل في
 * الخاص» بيضيّع العميل.
 *
 * ## والمفتاح مفتاح التاجر — Gemini أو ChatGPT
 * بنقرا مفاتيح المساعد وبعدها مفاتيح الرد على العملاء، والمزوّد اللي
 * التاجر اختاره آخر مرة. التكلفة على التاجر لأنها بتزيد باستخدامه هو.
 */

export type StudioError = { error: string }

/* ══════════════════════════════════════════════════════════════
   المفتاح والموديل
   ══════════════════════════════════════════════════════════════ */

/**
 * محرّك الاستوديو.
 *
 * `prefer` اختيار التاجر من الاستوديو أو الجدول. والرجوع لمفاتيح إضافة
 * الرد على العملاء مقصود: أغلب التجّار مفعّلين إضافة واحدة بس،
 * ومطالبتهم بمفتاح تالت لميزة جديدة بتخلّيهم يسيبوها.
 */
async function studioEngine(
  storeId: string,
  prefer?: string | null,
  /** اختيار يدوي من الاستوديو أو الجدول — بيغلب افتراضي الإضافات للطلب ده بس */
  models?: { text?: string | null; image?: string | null },
): Promise<Engine | StudioError> {
  const res = await resolveEngines(storeId, 'tools', prefer)
  if (!res.ok) return { error: res.error }
  const engine = { ...res.engine }
  if (models?.text && modelFitsProvider(engine.provider, models.text)) engine.model = models.text
  if (models?.image && modelFitsProvider(engine.provider, models.image)) engine.imageModel = models.image
  return engine
}

/* ══════════════════════════════════════════════════════════════
   سياق المتجر
   ══════════════════════════════════════════════════════════════ */

export type ProductBrief = {
  id: string
  /** لبناء رابط الصفحة في البوست */
  slug: string
  name: string
  price: string
  description: string | null
  category: string | null
  options: string[]
  /** أول صورة — للاستعمال المباشر */
  image: string | null
  /**
   * صور المنتج كلها.
   *
   * المنتج اللي ليه خمس صور (ألوان أو زوايا) بيدّي خمس بوستات
   * مختلفة. الاكتفاء بالأولى كان بيخلّي الجدول ينشر نفس الشكل كل
   * مرة — والمتابع بيتعلّم يعدّيه.
   */
  images: string[]
}

/** منتج بتفاصيله — الأساس اللي البوست بيتكتب منه */
export async function productBrief(
  storeId: string,
  productId: string,
): Promise<ProductBrief | null> {
  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      price: products.price,
      description: products.description,
      shortDescription: products.shortDescription,
      images: products.images,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .limit(1)

  if (!row) return null

  const brief = await getStoreBrief(storeId)
  const inCatalog = brief.sample.find((p) => p.name === row.name)

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: formatMoney(row.price, brief.currency),
    description: row.description?.trim() || row.shortDescription?.trim() || null,
    category: inCatalog?.category ?? null,
    options: inCatalog?.options ?? [],
    image: row.images?.[0] ?? null,
    images: row.images ?? [],
  }
}

/**
 * وصف المتجر للموديل.
 *
 * بيتبني مرة ويتلزق في كل نداء — التوليد من غيره بيطلع كلامًا عامًّا
 * ينفع لأي متجر، يعني ما ينفعش لحد.
 */
async function storeContext(storeId: string, merchantBrief?: string | null): Promise<string> {
  const brief = await getStoreBrief(storeId, merchantBrief)
  return [
    briefLine(brief),
    '',
    'المنتجات:',
    catalogBlock(brief, 25),
    '',
    operationsBlock(brief),
  ].join('\n')
}

/**
 * هوية المتجر البصرية — للصورة.
 *
 * ## من غيرها الصورة بتطلع «حلوة» لكن مش بتاعته
 * التاجر اللي ظبّط ألوانه وخطوطه في محرّر التخصيص وشاف صورة
 * إعلانية بألوان تانية خالص بيحسّها إعلان لمتجر غيره — والهوية
 * هي اللي بتخلّي متابعه يعرف البوست من غير ما يقرا الاسم.
 */
async function brandBlock(storeId: string, style: FixedStyle): Promise<string> {
  /*
    «زي ما أنا كاتب» مالوش هوية مفروضة.

    التاجر اختار إن كلامه يتنفّذ بالحرف. ألوان المتجر لو اتفرضت هناك
    بتبقى إضافة من عندنا على وصف قال فيه لون تاني.
  */
  if (style === 'literal') return ''

  const theme = await getStoreTheme(storeId)
  const id = theme.custom.identity

  /*
    الألوان بتتستخدم على حسب شكل الصورة.

    «استخدم اللونين في الخلفية» على مشهد في مطبخ حقيقي بتطلّع مطبخ
    بنفسجي. والشكل هو اللي بيقول اللون يروح فين.
  */
  const usage: Record<Exclude<FixedStyle, 'literal'>, string> = {
    scene: 'استخدم الألوان دي كلمسات في العناصر والنص المكتوب — مش لازم المكان كله يتلوّن بيها.',
    plain:
      'لون الخلفية: اللي صاحب المتجر قاله، وإلا درجة هادية من اللون الأساسي أو لون محايد نضيف يبرز المنتج.',
    model: 'استخدم الألوان دي كلمسات هادية في اللبس أو المكان — مش لازم تبان في كل حاجة.',
    poster: 'الألوان دي هي لوحة التصميم: الخلفية والأشكال والعنوان.',
    '3d': 'استخدم اللونين دول في الأشكال والإضاءة والخامات.',
    flatlay: 'استخدم الألوان دي بهدوء في السطح أو العناصر اللي حوالين المنتج.',
    macro: 'الألوان دي كلمسة في الخلفية المموّهة بس — التفصيلة نفسها بلونها الحقيقي.',
    outdoor: 'الألوان دي كلمسات في العناصر — المكان الخارجي بيفضل بألوانه الطبيعية.',
    occasion: 'استخدم الألوان دي في التغليف والزينة بتاعة المناسبة.',
    dark: 'اللون الأساسي كلمسة إضاءة أو انعكاس على الخلفية الغامقة.',
    ugc: 'من غير ألوان مفروضة — الصورة لازم تبان عفوية حقيقية.',
  }

  /*
    لون خلفية الموقع والحواف مش هنا عن قصد.

    «خلفية المتجر: #ffffff» و«الحواف: مستديرة» كانوا بيتقروا تعليمات
    على الصورة نفسها — فبتطلع الصورة جوّه كارت أبيض بحواف مدوّرة.
    وده الإطار الأبيض اللي كان بيظهر.
  */
  return [
    'هوية المتجر البصرية:',
    `- اللون الأساسي: ${id.primary}`,
    `- اللون المساعد: ${id.accent}`,
    usage[style],
    'ولو صاحب المتجر حدّد ألوانًا في كلامه، كلامه بيغلب الهوية.',
  ].join('\n')
}

/**
 * الرابط اللي البوست بيوديه عليه.
 *
 * ## بينتهي بصفحة المنتج لو فيه منتج
 * البوست عن تيشيرت بيودّي على المتجر كله، والعميل بيدوّر على
 * التيشيرت وسط خمسين حاجة ويسيب. الرابط المباشر بيفرق في التحويل
 * أكتر من أي كلمة في البوست.
 */
async function storeLink(storeId: string, productSlug?: string | null): Promise<string> {
  const [row] = await db
    .select({
      slug: stores.slug,
      customDomain: stores.customDomain,
      customDomainVerifiedAt: stores.customDomainVerifiedAt,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (!row) return ''
  return publicStoreUrl(row, productSlug ? `/products/${productSlug}` : '')
}

/* ══════════════════════════════════════════════════════════════
   الكلام
   ══════════════════════════════════════════════════════════════ */

/**
 * البوست بأجزائه.
 *
 * ## ليه مقسّم مش نص واحد
 * البوست البيعي له تركيب: **هوك** بيوقّف التمرير، **متن** بيقنع،
 * و**دعوة** بتقول اعمل إيه. النص الواحد كان بيطلع فقرة متوسّطة
 * مالهاش أول ولا آخر — والتاجر مش عارف يعدّل الهوك لوحده لو مش
 * عاجبه.
 *
 * و`caption` بيتركّب منهم للنسخ والنشر — المنصات بتاخد نصًّا
 * واحدًا في الآخر.
 */
export type CopyResult = {
  /** أول سطر — اللي بيوقّف الإصبع */
  hook: string
  /** المتن — الفوايد والتفاصيل */
  body: string
  /** الدعوة للفعل — من غير الرابط */
  cta: string
  /**
   * رابط المتجر أو المنتج.
   *
   * ## بيتحط عندنا لا عند الموديل
   * النماذج بتغلط في الروابط: بتزوّد شرطة، أو تخترع مسارًا، أو
   * تكتب النطاق ناقص. والرابط الغلط في بوست إعلاني بيوصل العميل
   * لصفحة ٤٠٤ — يعني البوست كله يروح.
   */
  link: string
  hashtags: string[]
}

/** الأجزاء متجمّعة كنص واحد — للنسخ وللنشر */
export function joinCopy(c: { hook: string; body: string; cta: string; link?: string }): string {
  const cta = [c.cta.trim(), c.link?.trim()].filter(Boolean).join('\n')
  return [c.hook, c.body, cta].map((x) => x.trim()).filter(Boolean).join('\n\n')
}

/**
 * كتابة بوست.
 *
 * ## الهاشتاجات منفصلة عن النص
 * التاجر بيعدّل النص وبيسيب الهاشتاجات، أو العكس. ودمجهم في حقل
 * واحد كان بيخلّي أي تعديل يمسح التانية. والمنصات كمان بتتعامل
 * معاهم مختلف: تيك توك بيحطّهم في النص، وإنستجرام أول تعليق أحسن.
 */
export async function writeCopy(input: {
  textModel?: string | null
  storeId: string
  productId?: string | null
  tone: ToneKey
  /** كلام التاجر الزيادة — بيغلب النبرة الجاهزة */
  extra?: string | null
  merchantBrief?: string | null
  /** Gemini أو ChatGPT — فاضي يعني اختيار التاجر المحفوظ */
  provider?: string | null
}): Promise<CopyResult | StudioError> {
  const engine = await studioEngine(input.storeId, input.provider, { text: input.textModel })
  if ('error' in engine) return engine

  const brief = await getStoreBrief(input.storeId, input.merchantBrief)
  const ctx = await storeContext(input.storeId, input.merchantBrief)
  const tone = toneOf(input.tone)

  const product = input.productId ? await productBrief(input.storeId, input.productId) : null

  const productBlock = product
    ? [
        'المنتج اللي البوست عنه:',
        `- الاسم: ${product.name}`,
        `- السعر: ${product.price}`,
        product.category ? `- القسم: ${product.category}` : null,
        product.options.length ? `- المتاح: ${product.options.join(' | ')}` : null,
        product.description ? `- وصف التاجر: ${product.description}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : 'البوست عن المتجر كله لا عن منتج بعينه.'

  const prompt = [
    'إنت كاتب محتوى تسويقي مصري بيكتب لمتاجر أونلاين.',
    '',
    ctx,
    '',
    productBlock,
    '',
    `المطلوب: ${tone.brief}`,
    input.extra?.trim() ? `وكمان: ${input.extra.trim()}` : '',
    '',
    'قواعد إلزامية:',
    '- اكتب بالمصري العادي اللي بيتكلمه الناس، مش فصحى إعلانات.',
    '- **ما تخترعش أي معلومة**: لا سعر ولا خصم ولا مقاس ولا ميعاد شحن مش مكتوب فوق.',
    '  المعلومة الغلط في بوست بتوصل لعميل بيطلب على أساسها، وبتتحوّل لمرتجع وشكوى.',
    '- من غير إيموجي أكتر من تلاتة في البوست كله.',
    '',
    /*
      أقسام معلَّمة لا JSON.

      الرد المقطوع في نص JSON بيبقى غير صالح، والتحليل بيفشل
      والتاجر بيشوف أقواس وعلامات تنصيص في وش البوست — وده اللي
      كان بيحصل فعلًا. الأقسام المعلَّمة بتتقرا حتى لو الرد اتقطع:
      اللي وصل بيتاخد واللي ما وصلش بيفضل فاضي.
    */
    'اكتب بالشكل ده بالظبط، كل قسم في سطر بعد علامته، ومن غير أي كلام تاني:',
    '',
    '[هوك]',
    'سطر واحد بيوقّف التمرير — سؤال أو موقف أو مفاجأة. من ٥ لـ١٢ كلمة.',
    '',
    '[نص]',
    'من سطرين لأربعة: أهم فايدتين أو تلاتة بلغة العميل مش لغة الكتالوج.',
    '',
    '[دعوة]',
    /*
      الرابط ممنوع في كلام الموديل.

      النماذج بتغلط فيه: بتزوّد شرطة، أو تخترع مسارًا، أو تكتب
      النطاق ناقص. والرابط الغلط في بوست إعلاني بيوصل العميل لصفحة
      ٤٠٤ — يعني البوست كله يروح. بنلزقه إحنا بعدين.
    */
    'سطر واحد قصير ومباشر بيقول للعميل يعمل إيه دلوقتي — زي «اطلب دلوقتي»',
    'أو «اطلبه من المتجر» أو «كلّمنا ونجهّزهولك». **ما تكتبش أي رابط**',
    'ولا تقول «اضغط على اللينك» — إحنا بنحطّ الرابط تحته على طول.',
    '',
    '[هاشتاجات]',
    'من ٤ لـ٨ هاشتاجات، **إلزامي** — القسم ده ما يفضلش فاضي أبدًا.',
    'كل واحد بيبدأ بـ# ومن غير مسافات جوّاه، وكلهم في سطر واحد مفصولين بمسافة.',
    'يبقوا عربي ومناسبين للمنتج والسوق المصري.',
    'مثال للشكل: #تيشيرت_رجالي #ملابس_مصرية #اونلاين_شوبينج #توصيل_لكل_المحافظات',
  ]
    .filter(Boolean)
    .join('\n')

  /*
    رابط المتجر لا رابط المنتج.

    البوست بيعرّف بالمتجر، والعميل اللي بيدخل بيشوف الباقي —
    ورابط المنتج بيوصّله لصفحة واحدة ويخرج. وده اللي التاجر طلبه.
  */
  const link = await storeLink(input.storeId)

  const res = await generateText(engine, {
    /* تعليمات النظام منفصلة عن كلام التاجر — أصعب إن وصفه يلغيها */
    system:
      'إنت كاتب محتوى تسويقي مصري بيكتب لمتاجر أونلاين. بترد بالأقسام المعلَّمة ' +
      'المطلوبة منك بالظبط ومن غير أي مقدّمات ولا شرح.',
    messages: [{ role: 'user', text: prompt }],
    temperature: 0.9,
    /*
      الحد الافتراضي (٨٠٠) كان بيقطع الرد في النص.

      العربي بياخد توكنات أكتر من الإنجليزي لنفس عدد الكلمات،
      والموديل بيصرف توكنات على التفكير قبل ما يكتب. والقطع كان
      بيخلّي التاجر يشوف نص بوست.
    */
    maxTokens: 2000,
  })
  if (!res.ok) return { error: res.error.message }

  const parsed = parseCopy(res.data)

  return {
    ...parsed,
    link,
    /*
      هاشتاجات احتياطية لو الموديل نساها.

      القسم بيتنسى أحيانًا مهما كانت التعليمات، والبوست من غير
      هاشتاجات بيوصل لمتابعي الصفحة بس — يعني نص فايدة النشر راحت.
      والبديل مبني من بيانات حقيقية: اسم المنتج وقسمه واسم المتجر.
    */
    hashtags: parsed.hashtags.length > 0 ? parsed.hashtags : fallbackTags(product, brief),
  }
}

/**
 * هاشتاجات من بيانات المتجر.
 *
 * ## مبنية لا مخترعة
 * اسم المنتج وقسمه واسم المتجر — دي كلمات العميل بيدوّر بيها فعلًا.
 * والهاشتاج المخترع بيوصل لصفر ناس.
 */
function fallbackTags(product: ProductBrief | null, brief: { name: string }): string[] {
  const words = [
    product?.name,
    product?.category,
    brief.name,
    'اونلاين شوبينج',
    'توصيل لكل المحافظات',
  ]

  return words
    .filter((w): w is string => Boolean(w?.trim()))
    /* المسافات بتبقى شرطة سفلية — الهاشتاج بيقف عند أول مسافة */
    .map((w) => '#' + w.trim().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, '_'))
    .filter((t) => t.length > 2)
    .slice(0, 6)
}

/**
 * فكّ الرد لأقسامه.
 *
 * ## بيشتغل حتى لو الرد اتقطع
 * الأقسام بتتقرا بعلاماتها. القسم اللي ما وصلش بيفضل فاضي، واللي
 * وصل بيتاخد — والتاجر بياخد نص بوست يعدّله بدل أقواس JSON مكسورة
 * في وشّه.
 *
 * ## ولو مفيش علامات خالص
 * بنرجّع النص كله كمتن. الرمي كان بيضيّع بوستًا مكتوبًا كويس عشان
 * الموديل نسي علامة.
 */
function parseCopy(raw: string): CopyResult {
  const text = raw.replace(/```+/g, '').trim()

  const grab = (label: string): string => {
    /*
      لحد أول علامة تانية أو آخر النص.

      الوقوف عند سطر فاضي كان بيقصّ المتن اللي فيه أكتر من فقرة.
    */
    const re = new RegExp('\\[' + label + '\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)')
    return text.match(re)?.[1]?.trim() ?? ''
  }

  const hook = grab('هوك')
  const body = grab('نص')
  const cta = grab('دعوة')
  const tagLine = grab('هاشتاجات')

  const hashtags = [...(tagLine || text).matchAll(/#[^\s#]+/g)]
    .map((m) => m[0])
    .slice(0, 10)

  /* مفيش علامات خالص — النص كله متن، والهاشتاجات بتتشال منه */
  if (!hook && !body && !cta) {
    return {
      hook: '',
      body: text.replace(/#[^\s#]+/g, '').trim(),
      cta: '',
      link: '',
      hashtags,
    }
  }

  return { hook, body, cta: cta.replace(/#[^\s#]+/g, '').trim(), link: '', hashtags }
}

/* ══════════════════════════════════════════════════════════════
   معايير الجودة
   ══════════════════════════════════════════════════════════════ */

/**
 * معايير الجودة — بتتلزق في كل صورة.
 *
 * ## ليه
 * التاجر بيكتب فكرة مختصرة («الشنطة على ترابيزة خشب»)، والموديل كان
 * بيطلّع صورة مقبولة بس عادية: ألوان باهتة، وخامة شبه البلاستيك،
 * وإضاءة مسطّحة. المعايير دي بتاخد نفس الفكرة لمستوى صور البراندات
 * العالمية — **من غير ما تغيّر الفكرة نفسها**.
 *
 * ## ومش مفروض فيها زاوية ولا عزل
 * عمق المجال الضحل وإضاءة الحواف وعزل الخلفية بيحلّوا صورة ويبوّظوا
 * تانية: فلات لاي من فوق مالوش عمق مجال، وصورة بخلفية سادة مالهاش
 * خلفية تتعزل. فالمعايير بتقول «الجودة»، والاختيارات الفنية بتتحدد
 * من الفكرة وكلام التاجر.
 *
 * ## ولكل نوع صورة لغته
 * «تصوير فوتوغرافي» على رندر 3D بيطلّع صورة، وعلى بوستر بيشيل التصميم.
 */
const CRAFT: Record<Craft, { ar: string[]; en: string }> = {
  photo: {
    ar: [
      'جودة تصوير إعلاني تجاري حقيقي فائقة الوضوح — حادة تمامًا على العنصر الأساسي، من غير أي بكسلة أو تشويش أو عيوب رقمية.',
      'الخامات والتفاصيل حقيقية بأدق تفاصيلها (قماش، جلد، معدن، زجاج، خشب، بشرة) — مش شكل بلاستيك ولا رسم.',
      'إضاءة احترافية مدروسة ومناسبة للمشهد نفسه، بتبرز شكل العنصر ومن غير ظلال قاسية مالهاش لازمة.',
      'ألوان غنية ونضيفة ودقيقة، بإحساس بوسترات البراندات العالمية الفاخرة.',
      'جودة كاميرا فل فريم احترافية.',
      'لو فيه أشخاص: ملامح وبشرة وأيدي طبيعية وتشريح صحيح.',
    ],
    en:
      'Ultra-high-resolution photorealistic commercial advertising photography. Razor-sharp focus on the main subject, ' +
      'zero artifacts, no noise or pixelation. True-to-life textures and materials. Professional lighting designed for ' +
      'this specific scene. Rich, clean, accurate colors with a premium global-brand aesthetic. Full-frame professional ' +
      'camera quality. If people appear: natural skin texture, realistic hands and faces, correct anatomy.',
  },
  render: {
    ar: [
      'رندر ثلاثي الأبعاد عالي الجودة جدًا — حواف حادة وتفاصيل دقيقة ومن غير أي عيوب.',
      'خامات واقعية فيزيائيًا (لمعة، شفافية، معدن) وإضاءة استوديو مدروسة.',
      'ألوان غنية ونضيفة بمستوى حملات البراندات العالمية.',
    ],
    en:
      'Premium high-end 3D render, ultra-detailed, physically based materials, clean studio-grade lighting, ' +
      'crisp edges, zero artifacts, rich clean colors, global-brand campaign quality.',
  },
  design: {
    ar: [
      'تصميم إعلاني احترافي بتسلسل بصري واضح وتوزيع مدروس للمساحة.',
      'المنتج نفسه متصوّر بجودة فوتوغرافية حادة وحقيقية جوّه التصميم.',
      'خط عربي نضيف ومقروء، وألوان غنية ونضيفة بمستوى حملات البراندات العالمية.',
    ],
    en:
      'Professional advertising poster design with a clear visual hierarchy and premium layout. The product is ' +
      'rendered photorealistically and razor-sharp. Clean legible typography, rich clean colors, global-brand ' +
      'campaign quality, zero artifacts.',
  },
  phone: {
    ar: [
      'شكل صورة موبايل حقيقية وعفوية — بس حادة ونضيفة ومضاءة كويس.',
      'ألوان حقيقية طبيعية، ومن غير تشويش أو اهتزاز أو عيوب.',
    ],
    en:
      'Authentic high-quality smartphone photo with natural casual framing and real-life lighting, yet sharp, clean, ' +
      'well-exposed, true-to-life colors, no blur, no artifacts.',
  },
}

/** الاختيارات الفنية مش مفروضة — بتتحدد من الفكرة */
const CRAFT_FREEDOM =
  'زاوية الكاميرا، وعزل الخلفية، وعمق المجال، وإضاءة الحواف — دي بتتحدد على حسب الفكرة وكلام صاحب المتجر، مش مفروضة على كل صورة.'

/* ══════════════════════════════════════════════════════════════
   الإخراج الفني
   ══════════════════════════════════════════════════════════════ */

export type ArtConcept = {
  /**
   * شكل الصورة المحسوم — مش `auto` أبدًا.
   *
   * بيتحسم في الفكرة لا في الرسم: قواعد موديل الصور (ممنوع مكان /
   * ممنوع خلفية سادة) لازم تطابق الفكرة، والكاروسيل بيشاركها بين
   * الشرايح كلها.
   */
  style: FixedStyle
  /** المكان والمشهد أو الخلفية — ده اللي بيفرّق بين إعلان وبطاقة بيانات */
  scene: string
  /** الإضاءة والكاميرا */
  look: string
  /** التكوين: المنتج فين، والفراغ فين */
  composition: string
  /**
   * الكلام المكتوب على الصورة — كلمتين لأربعة، أو فاضي.
   *
   * مش اسم المنتج ولا وصفه. جملة بتخلّي الواحد يقف.
   */
  overlay: string
}

function productLines(p: ProductBrief | null): string {
  return p
    ? [
        'المنتج:',
        '- الاسم: ' + p.name,
        '- السعر: ' + p.price,
        p.category ? '- القسم: ' + p.category : '',
        p.options.length ? '- المتاح: ' + p.options.join(' | ') : '',
        p.description ? '- وصف التاجر: ' + p.description : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'الإعلان عن المتجر كله لا عن منتج بعينه.'
}

/** الأشكال اللي المدير الفني يختار منها لما التاجر يقول «لوحده» */
const CHOOSABLE = STYLES.filter((s) => s.key !== 'auto' && s.key !== 'literal')

function styleBlock(style: ImageStyle): string {
  if (style === 'literal') {
    return [
      'شكل الصورة: **زي ما صاحب المتجر كاتب بالظبط.**',
      'ما تضيفش أفكار ولا عناصر ولا أماكن ولا أشخاص ولا كلام ما اتذكرش في كلامه.',
      'دورك تحوّل كلامه لوصف تصوير دقيق بس — مش إنك تحسّنه بفكرة من عندك.',
    ].join('\n')
  }
  if (style !== 'auto') {
    const s = styleOf(style)
    return 'شكل الصورة — **إلزامي**: ' + s.label + '\n' + s.director
  }
  return [
    'اختار شكل الصورة اللي يليق بالمنتج ده وبكلام صاحب المتجر — واحد من دول بس:',
    ...CHOOSABLE.map((s) => '- ' + s.key + ': ' + s.label + ' — ' + s.director),
  ].join('\n')
}

function qualityBlock(style: ImageStyle, direction: string): string {
  return [
    'معايير الجودة — الفكرة لازم تسمح بيها:',
    ...CRAFT[craftOf(style, direction)].ar.map((l) => '- ' + l),
    '- ' + CRAFT_FREEDOM,
  ].join('\n')
}

/**
 * إخراج فني للصورة — خطوة تفكير قبل الرسم.
 *
 * ## ليه خطوة زيادة
 * الوصف اللي بيروح لموديل الصور على طول بيطلّع **بطاقة بيانات**:
 * المنتج مقصوص على خلفية لون واحد، واسمه ووصفه ومقاساته مكتوبين
 * جنبه في مستطيلات. ده مش إعلان — ده كتالوج.
 *
 * الإعلان بيبدأ بفكرة: المنتج ده بيتباع لمين، وبيتستخدم فين،
 * وإيه المشهد اللي بيخلّي الواحد يتخيّل نفسه فيه. والخطوة دي
 * بتخلّي موديل **نصّي** يفكّر في الفكرة دي الأول، وبعدين موديل
 * الصور ينفّذها.
 *
 * ## و«زي ما أنا كاتب» بتعدّي الخطوة دي
 * كلام التاجر بيروح للرسم زي ما هو. أي «تفكير» قبله هو بالظبط اللي
 * التاجر طلب إنه ما يحصلش.
 *
 * ## وكلام التاجر قيد لا اقتراح
 * لو كتب «عايزه في مكان حقيقي»، الفكرة **لازم** تبقى مكان حقيقي.
 */
async function artDirection(input: {
  storeId: string
  engine: Engine
  product: ProductBrief | null
  /** كلام التاجر — نبرة الجدول أو وصفه في الاستوديو */
  direction: string
  /** محسوم من `resolveStyle` — `auto` يعني المدير الفني بيختار */
  style: ImageStyle
  merchantBrief?: string | null
}): Promise<ArtConcept> {
  if (input.style === 'literal') return literalConcept(input.direction)

  const brief = await getStoreBrief(input.storeId, input.merchantBrief)
  const poster = input.style === 'poster'

  const prompt = [
    'إنت مدير فني بتشتغل لعلامات تجارية عالمية، وبتصمّم إعلان واحد.',
    '',
    briefLine(brief),
    '',
    productLines(input.product),
    '',
    'توجيه صاحب المتجر — **ده أمر، التزم بيه حرفيًا**:',
    input.direction.trim() || '(ما حدّدش حاجة — إنت اللي تختار اللي يليق بالمنتج)',
    '',
    styleBlock(input.style),
    '',
    qualityBlock(input.style, input.direction),
    '',
    'فكّر الأول: المنتج ده بيتباع لمين؟ بيتستخدم فين وإمتى؟ وإيه اللي',
    'يخلّي اللي شايفه يوقف عنده؟',
    '',
    'وبعدين صمّم لقطة **واحدة** احترافية:',
    '',
    input.style === 'auto' ? '[نمط]\nمفتاح الشكل اللي اخترته بس (زي scene أو plain) — كلمة واحدة.\n' : '',
    '[مشهد]',
    'الخلفية والمكان والعناصر بالتفصيل — ملتزم بشكل الصورة بالحرف.',
    'لو الشكل خلفية سادة: اذكر لون الخلفية بس، ومفيش أي عناصر ولا مكان.',
    '',
    '[إضاءة]',
    'نوع الإضاءة واتجاهها، ونوع العدسة والعمق — اللي يخدم الفكرة دي بالذات.',
    '',
    '[تكوين]',
    'المنتج فين في الكادر وحجمه، والفراغ فين، وإيه اللي بيوجّه العين له.',
    '',
    '[نص]',
    poster
      ? 'عنوان البوستر بالعربي من ٢ لـ٦ كلمات — جملة بتشدّ، مش اسم المنتج ولا مواصفاته.'
      : 'من كلمتين لأربعة بالعربي بس — جملة بتشدّ، مش اسم المنتج ولا وصفه.',
    'أو اكتب «مفيش» لو الصورة أقوى من غير كلام.',
    '',
    'ممنوع في كل الأشكال: قوايم مواصفات أو مقاسات أو أسعار مكتوبة على الصورة،',
    'وأيقونات ومستطيلات حوالين المنتج، وأي إطار أو حدود حوالين الصورة.',
    'ولو صاحب المتجر طلب حاجة، هي اللي تمشي حتى لو إنت شايف غيرها أحلى.',
  ]
    .filter(Boolean)
    .join('\n')

  const res = await generateText(input.engine, {
    system:
      'إنت مدير فني لإعلانات تجارية. بترد بالأقسام المعلَّمة المطلوبة ' +
      'منك بالظبط ومن غير أي مقدّمات ولا شرح.',
    messages: [{ role: 'user', text: prompt }],
    temperature: 1,
    maxTokens: 1200,
  })

  /*
    الفشل بيرجّع فكرة افتراضية لا بيوقّف التوليد.

    التاجر مستنّي صورة. لو خطوة التفكير وقعت (شبكة، حصّة)، أحسن
    حاجة نرسم بفكرة عامة محترمة من إننا نرجّع خطأ ونضيّع الطلب.
  */
  if (!res.ok) {
    return fallbackConcept(input.product, input.direction, input.style === 'auto' ? 'scene' : input.style)
  }

  return parseConcept(res.data, input.product, input.direction, input.style)
}

/** كلام التاجر زي ما هو — من غير مدير فني */
function literalConcept(direction: string): ArtConcept {
  return { style: 'literal', scene: direction.trim(), look: '', composition: '', overlay: '' }
}

/**
 * فكرة محترمة لما التفكير يقع — بنفس الشكل المطلوب.
 *
 * البديل القديم كان «مشهد واقعي» دايمًا، فالتاجر اللي طالب خلفية
 * سادة كان بياخد مكان لما خطوة التفكير تقع.
 */
function fallbackConcept(
  product: ProductBrief | null,
  direction: string,
  style: FixedStyle,
): ArtConcept {
  if (style === 'literal') return literalConcept(direction)

  const name = product ? ' — ' + product.name : ''

  const byStyle: Record<Exclude<FixedStyle, 'literal'>, Omit<ArtConcept, 'style' | 'overlay'>> = {
    scene: {
      scene: 'مشهد واقعي في مكان طبيعي بيتستخدم فيه المنتج، بتفاصيل حقيقية حواليه' + name,
      look: 'إضاءة طبيعية ناعمة جنبية، عدسة ٥٠ملم',
      composition: 'المنتج في التلت السفلي، ومساحة فاضية فوقه، والضوء بيوجّه العين له',
    },
    plain: {
      scene: 'خلفية سادة بلون واحد ناعم ممتد، من غير أي عناصر ولا مكان' + name,
      look: 'إضاءة استوديو ناعمة من الجنبين، عدسة ٨٥ملم، وظل ناعم تحت المنتج',
      composition: 'المنتج في نص الكادر وواخد حوالي تلتين المساحة',
    },
    model: {
      scene: 'شخص حقيقي بيستخدم المنتج في موقف طبيعي من يومه' + name,
      look: 'إضاءة طبيعية ناعمة، عدسة ٨٥ملم',
      composition: 'المنتج واضح في إيد الشخص أو عليه، والوش مش مغطّي المنتج',
    },
    poster: {
      scene: 'تصميم إعلاني بخلفية متدرّجة وأشكال جرافيك بسيطة حوالين المنتج' + name,
      look: 'إضاءة استوديو ناعمة بتبرز المنتج',
      composition: 'المنتج بطل التصميم في النص، والعنوان فوقه بمساحة مريحة',
    },
    '3d': {
      scene: 'مشهد 3D مصمَّم بأشكال هندسية وبوديوم وخامات لامعة' + name,
      look: 'إضاءة استوديو ملوّنة ناعمة، رندر عالي الجودة',
      composition: 'المنتج على البوديوم في نص الكادر',
    },
    flatlay: {
      scene: 'سطح خشب أو قماش، والمنتج وحواليه حاجات بتكمّله مترتّبة' + name,
      look: 'إضاءة طبيعية ناعمة من فوق، ظلال خفيفة',
      composition: 'لقطة من فوق عمودي، والمنتج في النص',
    },
    macro: {
      scene: 'تفصيلة قريبة جدًا من خامة المنتج وملمسه' + name,
      look: 'إضاءة جنبية ناعمة بتبرز الملمس، عدسة ماكرو',
      composition: 'التفصيلة مالية الكادر، والباقي مموّه بهدوء',
    },
    outdoor: {
      scene: 'مكان خارجي حقيقي بإضاءة طبيعية جميلة يناسب المنتج' + name,
      look: 'ضوء الساعة الذهبية الناعم، عدسة ٥٠ملم',
      composition: 'المنتج في مقدمة الكادر والمكان وراه',
    },
    occasion: {
      scene: 'جو مناسبة دافي وهادي بعناصر احتفالية بسيطة حوالين المنتج' + name,
      look: 'إضاءة دافية ناعمة',
      composition: 'المنتج في النص وعناصر المناسبة حواليه من غير ما تغطّيه',
    },
    dark: {
      scene: 'خلفية غامقة ناعمة، ولمعة هادية تحت المنتج' + name,
      look: 'إضاءة درامية جنبية مركّزة على المنتج، ظلال عميقة',
      composition: 'المنتج في النص، والضوء بيحدّد حوافه',
    },
    ugc: {
      scene: 'المنتج في موقف يومي عادي كأن عميل صوّره بموبايله' + name,
      look: 'إضاءة طبيعية من الشباك، كاميرا موبايل',
      composition: 'كادر عفوي والمنتج واضح',
    },
  }

  return {
    style,
    ...byStyle[style],
    /* كلام التاجر هو المشهد لو كتبه — أدق من أي وصف عام */
    scene: direction.trim() ? direction.trim() + '\n' + byStyle[style].scene : byStyle[style].scene,
    overlay: '',
  }
}

function grabSection(text: string, label: string): string {
  const re = new RegExp('\\[' + label + '\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)')
  return text.match(re)?.[1]?.trim() ?? ''
}

/** الشكل اللي المدير الفني اختاره — المفاتيح ما فيهاش واحد جوّه التاني */
function pickedStyle(text: string): FixedStyle {
  const picked = grabSection(text, 'نمط').toLowerCase()
  return (CHOOSABLE.find((s) => picked.includes(s.key))?.key as FixedStyle) ?? 'scene'
}

function parseConcept(
  raw: string,
  product: ProductBrief | null,
  direction: string,
  requested: ImageStyle,
): ArtConcept {
  const text = raw.replace(/```+/g, '').trim()

  /* الشكل المحدَّد ما بيتغيّرش مهما الموديل كتب */
  const style: FixedStyle = requested !== 'auto' ? requested : pickedStyle(text)

  const base = fallbackConcept(product, direction, style)
  const overlay = grabSection(text, 'نص')

  return {
    style,
    scene: grabSection(text, 'مشهد') || base.scene,
    look: grabSection(text, 'إضاءة') || base.look,
    composition: grabSection(text, 'تكوين') || base.composition,
    /* «مفيش» يعني من غير نص — والصورة النضيفة أحسن من نص مكسور */
    overlay: /^مفيش/.test(overlay) ? '' : overlay,
  }
}

/** الفكرة كوصف لموديل الصور */
function conceptToPrompt(c: ArtConcept, preset: { aspect: string; label: string }): string {
  if (c.style === 'literal') {
    return [
      'نفّذ وصف صاحب المتجر ده بالظبط، بنسبة ' + preset.aspect + ' — من غير ما تضيف عناصر أو أشخاص أو',
      'أماكن أو كلام ما اتذكرش فيه:',
      '«' + c.scene + '»',
      c.composition ? 'التكوين: ' + c.composition : '',
      c.overlay ? 'الكلام المكتوب على الصورة بالظبط: «' + c.overlay + '»' : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  /* «واقعية وسينمائية» على رندر 3D بتطلّع صورة فوتوغرافية — الوصف بيتبع الشكل */
  const kind: Record<Exclude<FixedStyle, 'literal'>, string> = {
    scene: 'صوّر لقطة إعلانية واحدة، واقعية وسينمائية',
    plain: 'صوّر صورة منتج احترافية واحدة على خلفية سادة',
    model: 'صوّر لقطة إعلانية واحدة لموديل حقيقي بيستخدم المنتج',
    poster: 'صمّم بوستر إعلاني واحد',
    '3d': 'اعمل رندر ثلاثي الأبعاد إعلاني واحد',
    flatlay: 'صوّر لقطة فلات لاي واحدة من فوق',
    macro: 'صوّر لقطة ماكرو قريبة جدًا',
    outdoor: 'صوّر لقطة إعلانية واحدة في مكان خارجي حقيقي',
    occasion: 'صوّر لقطة إعلانية واحدة بجو المناسبة',
    dark: 'صوّر لقطة إعلانية فخمة واحدة على خلفية غامقة',
    ugc: 'صوّر صورة عفوية واحدة كأنها من موبايل عميل',
  }

  return [
    kind[c.style] + '، بنسبة ' + preset.aspect + '.',
    '',
    (c.style === 'scene' || c.style === 'outdoor' ? 'المشهد: ' : 'الخلفية والعناصر: ') + c.scene,
    c.look ? 'الإضاءة والكاميرا: ' + c.look : '',
    c.composition ? 'التكوين: ' + c.composition : '',
    c.overlay
      ? 'اكتب على الصورة النص ده بالظبط وبخط عربي نضيف ومقروء: «' + c.overlay + '» — ' +
        'وما تكتبش أي كلام تاني خالص.'
      : 'من غير أي كلام مكتوب على الصورة.',
  ]
    .filter(Boolean)
    .join('\n')
}

/* ══════════════════════════════════════════════════════════════
   الصور
   ══════════════════════════════════════════════════════════════ */

export type StudioImage = { id: string; url: string; prompt: string; preset: PresetKey }

/**
 * توليد صورة أو تعديل واحدة موجودة — Gemini أو ChatGPT.
 *
 * ## التعديل بياخد الصورة الأصلية معاه
 * «خلّي الخلفية أغمق» من غير الصورة معناه توليد صورة جديدة تمامًا
 * — والتاجر بيلاقي منتجًا تاني خالص. الصورة بتتجاب من التخزين
 * وبتتبعت للموديل جنب التعديل.
 *
 * ## والصورة بتترفع بعد النجاح بس
 * التاجر ممكن يجرّب خمس تعديلات ويختار واحدًا. والسلسلة محتاجة الأب
 * يفضل موجود، فبنرفع كل ناتج ونسيب الحذف له.
 */
export async function makeImage(input: {
  textModel?: string | null
  imageModel?: string | null
  storeId: string
  userId: string
  prompt: string
  preset: PresetKey
  productId?: string | null
  /** الصورة اللي بيتعدّل عليها — فاضي يعني توليد جديد */
  parentId?: string | null
  /** صورة المنتج نفسها كمرجع — المنتج بيتاخد منها وخلفيتها بتتشال */
  seedUrl?: string | null
  merchantBrief?: string | null
  /**
   * فكرة جاهزة — للكاروسيل.
   *
   * خطة الكاروسيل بتتعمل مرة واحدة للسِت كله، وكل شريحة بتاخد فكرتها
   * هي من الخطة. من غير كده كل شريحة بتفكّر لوحدها.
   */
  concept?: ArtConcept
  /** شكل الصورة — محسوم من المنادي بـ`resolveStyle`، والمكتبة ما بتفهمش من `prompt` */
  style?: ImageStyle | null
  /** مكان الشريحة في الكاروسيل وإيه اللي في الشرايح التانية */
  slide?: string
  /** Gemini أو ChatGPT — فاضي يعني اختيار التاجر المحفوظ */
  provider?: string | null
}): Promise<StudioImage | StudioError> {
  const engine = await studioEngine(input.storeId, input.provider, { text: input.textModel, image: input.imageModel })
  if ('error' in engine) return engine

  const preset = presetOf(input.preset)

  /* الصورة اللي هنبني عليها: أبوها في السلسلة، وإلا صورة المنتج */
  let base: { mimeType: string; dataBase64: string } | undefined
  let baseUrl: string | null = null

  if (input.parentId) {
    const [parent] = await db
      .select({ url: studioAssets.url })
      .from(studioAssets)
      .where(and(eq(studioAssets.id, input.parentId), eq(studioAssets.storeId, input.storeId)))
      .limit(1)
    baseUrl = parent?.url ?? null
  } else if (input.seedUrl) {
    baseUrl = input.seedUrl
  }

  if (baseUrl) {
    const fetched = await fetchAsInline(baseUrl)
    if (fetched) base = fetched
  }

  /*
    التعديل بيمشي بكلام التاجر زي ما هو.

    «خلّي الخلفية أغمق» مش محتاجة إخراج فني ولا سياق متجر — دي
    تعليمة على صورة موجودة، وحشو السياق معاها بيخلّي الموديل يعيد
    رسمها من الأول بدل ما يعدّلها.
  */
  let prompt = input.prompt

  if (!input.parentId) {
    const product = input.productId ? await productBrief(input.storeId, input.productId) : null

    const concept =
      input.concept ??
      (await artDirection({
        storeId: input.storeId,
        engine,
        product,
        direction: input.prompt,
        style: styleOf(input.style).key,
        merchantBrief: input.merchantBrief,
      }))

    const look = styleOf(concept.style)
    const craft = CRAFT[craftOf(concept.style, input.prompt)]
    const brand = await brandBlock(input.storeId, concept.style)

    prompt = [
      brand,
      brand ? '' : null,
      conceptToPrompt(concept, preset),
      input.slide ? '\n' + input.slide : null,
      '',
      'قواعد:',
      /* قواعد الشكل نفسه — «ممنوع خلفية سادة» بقت للمكان الحقيقي بس */
      ...look.rules.map((r) => '- ' + r),
      '- **ممنوع** أي قايمة مواصفات أو مقاسات أو أسعار أو أيقونات في مستطيلات.',
      base
        ? /*
            صورة المنتج مرجع مش كادر.

            من غير الجملة دي الموديل كان بياخد صورة المنتج بخلفيتها
            ويحطّها جوّه الكادر الجديد — ولما نسبتها تختلف، بيملا
            الباقي أبيض. ده الإطار اللي كان بيظهر.
          */
          '- الصورة المرفقة **مرجع للمنتج بس**: خد المنتج منها بنفس شكله ولونه وتفاصيله، ' +
          'وحطّه في الصورة الجديدة. ما تحتفظش بخلفيتها ولا بزاويتها، وما تحطّهاش جوّه الكادر زي ما هي.'
        : null,
      /*
        الكادر مليان من الحافة للحافة.

        السطر القديم «سيب مساحة فاضية حوالين الحواف» كان بيتنفّذ حرفيًا:
        هامش أبيض حوالين الصورة كلها.
      */
      '- الصورة تملا الكادر كله من الحافة للحافة. ممنوع أي إطار أو حدود أو هامش أبيض ' +
        'أو صورة جوّه صورة. خلّي المنتج بعيد شوية عن الحواف بس.',
      '',
      'معايير الجودة:',
      ...craft.ar.map((l) => '- ' + l),
      '',
      look.en || null,
      craft.en,
      concept.style === 'literal'
        ? 'Follow the description literally. Do not add props, people, scenery, text or concepts that were not described.'
        : null,
      'Full-bleed ' +
        preset.aspect +
        ' image that fills the entire canvas edge to edge. No border, no frame, no white margins, ' +
        'no letterboxing, no picture-in-picture, no collage, no mockup card. Keep the product safely away from the edges.',
    ]
      .filter((l): l is string => l !== null)
      .filter((l, i, all) => l !== '' || all[i - 1] !== '')
      .join('\n')
  }

  let res:
    | { ok: true; data: { mimeType: string; dataBase64: string } }
    | { ok: false; error: { kind: string; message: string } }

  if (engine.provider === 'openai') {
    res = await openaiImage({
      apiKey: engine.apiKey,
      model: engine.imageModel,
      prompt,
      images: base ? [base] : [],
      aspect: preset.aspect,
    })
  } else {
    /* موديل الصور بيتختار من المفتاح، ولو واحد مالوش حصّة بيتجرّب اللي بعده */
    res = await generateImage({
      apiKey: engine.apiKey,
      preferred: engine.imageModel,
      prompt,
      image: base,
      aspectRatio: preset.aspect,
    })
  }

  await noteAiOutcome(engine, res)
  if (!res.ok) return { error: res.error.message }

  /* رفع الناتج */
  const bytes = Buffer.from(res.data.dataBase64, 'base64')
  const ext = res.data.mimeType.includes('png') ? 'png' : 'jpg'
  const file = new File([new Uint8Array(bytes)], `studio.${ext}`, { type: res.data.mimeType })

  const up = await uploadImage(input.storeId, 'banners', file)
  if (!up.ok) return { error: up.error }

  await recordUpload({
    storeId: input.storeId,
    path: up.path,
    url: up.url,
    name: `استوديو — ${input.prompt.slice(0, 40)}`,
    folder: 'banners',
    sizeBytes: file.size,
    mimeType: res.data.mimeType,
    uploadedBy: input.userId,
  }).catch(() => {
    /* الصورة موجودة على التخزين خلاص — صف المكتبة مش سبب لفشل */
  })

  const [row] = await db
    .insert(studioAssets)
    .values({
      storeId: input.storeId,
      prompt: input.prompt,
      url: up.url,
      path: up.path,
      preset: input.preset,
      kind: 'image',
      mimeType: res.data.mimeType,
      productId: input.productId ?? null,
      parentId: input.parentId ?? null,
      createdBy: input.userId,
    })
    .returning({ id: studioAssets.id })

  return { id: row.id, url: up.url, prompt: input.prompt, preset: input.preset }
}

/**
 * جلب صورة كبيانات مضمَّنة.
 *
 * بترجّع `null` بدل ما ترمي: الصورة ممكن تكون اتمسحت من التخزين،
 * والتعديل ساعتها بيتحوّل لتوليد جديد — أحسن من رسالة خطأ للتاجر
 * وهو مستنّي صورة.
 */
async function fetchAsInline(
  url: string,
): Promise<{ mimeType: string; dataBase64: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null

    const buf = Buffer.from(await res.arrayBuffer())
    /* حدّ الحجم — المزوّدين بيرفضوا المضمَّن الكبير برد مالوش معنى */
    if (buf.byteLength > 6_000_000) return null

    return {
      mimeType: res.headers.get('content-type') ?? 'image/png',
      dataBase64: buf.toString('base64'),
    }
  } catch {
    return null
  }
}

/* ══════════════════════════════════════════════════════════════
   الكاروسيل
   ══════════════════════════════════════════════════════════════ */

type SlidePlan = { scene: string; composition: string; overlay: string }

/**
 * شرايح احتياطية لما التخطيط يقع — كل واحدة لقطة مختلفة فعلًا.
 *
 * الغلاف، وبعده تفصيلة، واستخدام، وحجم، والأخيرة دعوة. ومسافة
 * الكاميرا بتتغيّر مع كل دور عشان حتى البديل ما يطلعش نفس الصورة.
 */
const FALLBACK_SLIDES: Array<{ role: string; shot: string }> = [
  { role: 'غلاف: المنتج واضح وكبير، وجملة قصيرة جدًا بتشدّ العين', shot: 'لقطة متوسطة والمنتج بطل الكادر' },
  { role: 'تفصيلة: خامة المنتج أو تفصيلة مميزة فيه', shot: 'لقطة قريبة جدًا على التفصيلة' },
  { role: 'استخدام: المنتج وهو مستخدَم في موقف حقيقي', shot: 'لقطة واسعة شوية فيها سياق الاستخدام' },
  { role: 'فايدة: فايدة واحدة للمنتج بصورة بتوضّحها', shot: 'لقطة من زاوية مختلفة عن اللي قبلها' },
  { role: 'حجم: المنتج جنب حاجة بتوضّح حجمه', shot: 'لقطة متوسطة من الجنب' },
]

function fallbackPlan(direction: string, count: number): SlidePlan[] {
  return Array.from({ length: count }, (_, i) => {
    const last = i === count - 1 && count > 1
    const pick = last
      ? { role: 'دعوة للطلب: المنتج نضيف ومساحة فاضية واضحة للدعوة', shot: 'لقطة نضيفة والمنتج في النص' }
      : FALLBACK_SLIDES[i % FALLBACK_SLIDES.length]
    return {
      scene: (direction.trim() ? direction.trim() + '\n' : '') + pick.role,
      composition: pick.shot,
      overlay: '',
    }
  })
}

/** «٣» و«3» واحد */
function toLatinDigits(s: string): number {
  return Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
}

function parsePlan(raw: string, count: number, direction: string): SlidePlan[] {
  const text = raw.replace(/```+/g, '').trim()
  const fallback = fallbackPlan(direction, count)
  const slides: SlidePlan[] = [...fallback]

  const re = /\[شريحة\s*([0-9٠-٩]+)\]\s*([\s\S]*?)(?=\n\s*\[|$)/g
  for (const m of text.matchAll(re)) {
    const index = toLatinDigits(m[1]) - 1
    if (!(index >= 0 && index < count)) continue

    const body = m[2]
    const field = (label: string) =>
      body.match(new RegExp(label + '\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(مشهد|تكوين|نص)\\s*[:：]|$)'))?.[1]?.trim() ?? ''

    const overlay = field('نص')
    slides[index] = {
      scene: field('مشهد') || fallback[index].scene,
      composition: field('تكوين') || fallback[index].composition,
      overlay: /^مفيش/.test(overlay) ? '' : overlay,
    }
  }

  return slides
}

/**
 * خطة الكاروسيل — كل شريحة بمحتواها قبل ما أي صورة تترسم.
 *
 * ## اللي كان بيحصل
 * فكرة واحدة للسِت كله، وكل شريحة **بتترسم فوق صورة اللي قبلها** مع
 * أمر «نفس الشكل بالظبط». فالموديل كان بيرجّع نفس الصورة بزاوية تانية
 * خمس مرات — والأخيرة نسخة من اللي قبلها. واللي التاجر كتبه لكل شريحة
 * («الأولى كذا، والأخيرة كذا») ما كانش بيوصل للرسم أصلًا.
 *
 * ## اللي بقى
 * مدير فني بيخطط الشرايح كلها مرة واحدة: كل شريحة ليها مشهد وتكوين
 * ونص **مختلفين**، وكلام التاجر عن شريحة بعينها بيتنفّذ فيها هي. واللي
 * بيجمعهم «هوية» مكتوبة (إضاءة وألوان وجو) — مش صورة بتتنسخ.
 */
async function planCarousel(input: {
  storeId: string
  engine: Engine
  product: ProductBrief | null
  direction: string
  style: ImageStyle
  count: number
  merchantBrief?: string | null
}): Promise<{ style: FixedStyle; look: string; slides: SlidePlan[] }> {
  const brief = await getStoreBrief(input.storeId, input.merchantBrief)

  const prompt = [
    'إنت مدير فني بتخطط كاروسيل إعلاني من ' + input.count + ' شرايح — حكاية واحدة بتتسحب شريحة ورا شريحة.',
    '',
    briefLine(brief),
    '',
    productLines(input.product),
    '',
    'كلام صاحب المتجر — **أمر، التزم بيه حرفيًا**:',
    input.direction.trim() || '(ما حدّدش حاجة — إنت اللي تخطط اللي يليق بالمنتج)',
    '',
    'لو حدّد محتوى شريحة بعينها (الأولى، التانية، الأخيرة، اللي في النص، الشريحة رقم كذا)،',
    'نفّذه في الشريحة دي بالظبط. واللي ما حدّدوش كمّله إنت بما يخدم كلامه.',
    '',
    styleBlock(input.style),
    '',
    qualityBlock(input.style, input.direction),
    '',
    '**أهم قاعدة: كل شريحة صورة مختلفة فعلًا** — محتوى مختلف، وتكوين مختلف، ومسافة كاميرا',
    'مختلفة. ممنوع شريحتين يبقوا نفس الصورة بزاوية تانية، وممنوع الأخيرة تبقى تكرار لأي شريحة.',
    'اللي بيجمعهم: نفس الإضاءة ولوحة الألوان والجو — عشان يبانوا كاروسيل واحد.',
    'الأولى غلاف بيوقّف التمرير، والأخيرة دعوة للطلب — إلا لو صاحب المتجر قال غير كده.',
    '',
    'اكتب بالشكل ده بالظبط ومن غير أي كلام تاني:',
    '',
    input.style === 'auto' ? '[نمط]\nمفتاح الشكل اللي اخترته بس (زي scene أو plain).\n' : '',
    '[هوية]',
    'الإضاءة ولوحة الألوان والجو المشترك بين كل الشرايح — في سطرين.',
    '',
    ...Array.from({ length: input.count }, (_, i) =>
      [
        '[شريحة ' + (i + 1) + ']',
        'مشهد: المحتوى والخلفية والعناصر في الشريحة دي بالتفصيل',
        'تكوين: مسافة الكاميرا وزاويتها ومكان المنتج',
        'نص: من كلمتين لأربعة بالعربي، أو «مفيش»',
        '',
      ].join('\n'),
    ),
    'ممنوع في كل الشرايح: قوايم مواصفات أو أسعار مكتوبة، وأيقونات ومستطيلات، وأي إطار حوالين الصورة.',
  ]
    .filter(Boolean)
    .join('\n')

  const res = await generateText(input.engine, {
    system:
      'إنت مدير فني لإعلانات تجارية. بترد بالأقسام المعلَّمة المطلوبة ' +
      'منك بالظبط ومن غير أي مقدّمات ولا شرح.',
    messages: [{ role: 'user', text: prompt }],
    temperature: 0.9,
    maxTokens: 600 + input.count * 320,
  })

  if (!res.ok) {
    return {
      style: input.style === 'auto' ? 'scene' : input.style,
      look: '',
      slides: fallbackPlan(input.direction, input.count),
    }
  }

  const text = res.data.replace(/```+/g, '')
  return {
    style: input.style === 'auto' ? pickedStyle(text) : input.style,
    look: grabSection(text, 'هوية'),
    slides: parsePlan(text, input.count, input.direction),
  }
}

export type CarouselResult = { images: StudioImage[] } | StudioError

/**
 * كاروسيل — شرايح مختلفة بهوية واحدة.
 *
 * ## كل الشرايح بتتبني على صورة المنتج نفسها
 * مش على الشريحة اللي قبلها. البناء على اللي قبلها هو اللي كان بيطلّع
 * نفس الصورة بزاوية تانية — والخطة المكتوبة هي اللي بتوحّد الشكل.
 *
 * ## والفشل في النص بيرجّع اللي نجح
 * أربع شرايح من خمسة أحسن من لا حاجة، والتاجر ينشرهم أو يعيد.
 * الرمي كان بيضيّع أربع نداءات دفع تمنهم.
 */
export async function makeCarousel(input: {
  textModel?: string | null
  imageModel?: string | null
  storeId: string
  userId: string
  prompt: string
  preset: PresetKey
  count: number
  productId?: string | null
  seedUrl?: string | null
  merchantBrief?: string | null
  style?: ImageStyle | null
  provider?: string | null
}): Promise<CarouselResult> {
  const count = Math.max(2, Math.min(10, input.count))
  const images: StudioImage[] = []

  const engine = await studioEngine(input.storeId, input.provider, { text: input.textModel, image: input.imageModel })
  if ('error' in engine) return engine

  const product = input.productId ? await productBrief(input.storeId, input.productId) : null

  const plan = await planCarousel({
    storeId: input.storeId,
    engine,
    product,
    direction: input.prompt,
    style: styleOf(input.style).key,
    count,
    merchantBrief: input.merchantBrief,
  })

  for (let i = 0; i < count; i++) {
    const slide = plan.slides[i]

    /*
      الشريحة بتعرف إيه اللي في أخواتها.

      «ما تكررش» من غير ما تعرف إيه اللي اتعمل ما بتمنعش التكرار —
      الموديل بيرسم كل شريحة لوحدها ومش شايف التانيين.
    */
    const others = plan.slides
      .map((s, j) => (j === i ? null : '- شريحة ' + (j + 1) + ': ' + s.scene.replace(/\s+/g, ' ').slice(0, 110)))
      .filter(Boolean)

    const res = await makeImage({
      storeId: input.storeId,
      userId: input.userId,
      prompt: input.prompt,
      preset: input.preset,
      productId: input.productId,
      concept: {
        style: plan.style,
        scene: slide.scene,
        look: plan.look,
        composition: slide.composition,
        overlay: slide.overlay,
      },
      slide: [
        'دي شريحة ' + (i + 1) + ' من ' + count + ' في كاروسيل واحد.',
        others.length ? 'الشرايح التانية فيها:' : '',
        ...others,
        'الشريحة دي لازم تبان مختلفة عنهم في المحتوى والتكوين ومسافة الكاميرا — والمشترك بينهم الإضاءة والألوان والجو بس.',
      ]
        .filter(Boolean)
        .join('\n'),
      seedUrl: input.seedUrl ?? null,
      merchantBrief: input.merchantBrief,
      provider: engine.provider,
      textModel: engine.model,
      imageModel: engine.imageModel,
    })

    if ('error' in res) {
      /* اللي نجح بيترجّع؛ والفشل من أول شريحة بيرجّع الخطأ */
      if (images.length === 0) return res
      break
    }

    images.push(res)
  }

  return { images }
}

/* ══════════════════════════════════════════════════════════════
   الفيديو
   ══════════════════════════════════════════════════════════════ */

/**
 * نسبة الفيديو من المقاس.
 *
 * Veo وSora بياخدوا عرضي وطولي بس. المربّع والطولي بيتحوّلوا للطولي
 * لأن ده اللي بيشتغل في ريلز وتيك توك — والعرضي بيفضل عرضي.
 */
function videoAspect(preset: PresetKey): VeoAspect {
  return preset === 'landscape' ? '16:9' : '9:16'
}

export type VideoJob = { operation: string; model: string }

/** بادئة عملية Sora — عشان السؤال عليها يروح لـOpenAI مش لجوجل */
const SORA_PREFIX = 'openai:'

/**
 * بدء توليد فيديو — Veo أو Sora — بيرجّع اسم العملية.
 *
 * ## الانتظار على المتصفح لا على الخادم
 * التوليد بياخد من دقيقة لتلاتة. دالة الخادم عندنا عمرها ثواني —
 * والانتظار جوّاها كان بيموت قبل ما الفيديو يخلص، والتاجر بيدفع
 * تمن توليد ما شافوش.
 */
export async function startProductVideo(input: {
  storeId: string
  prompt: string
  preset: PresetKey
  /** صورة يتحرّك منها — صورة المنتج أو ناتج الاستوديو */
  seedUrl?: string | null
  merchantBrief?: string | null
  style?: ImageStyle | null
  provider?: string | null
}): Promise<VideoJob | StudioError> {
  const engine = await studioEngine(input.storeId, input.provider)
  if ('error' in engine) return engine

  /* «يختار لوحده» في الفيديو مكان حقيقي — مفيش خطوة تفكير قبله */
  const picked = styleOf(input.style).key
  const style: FixedStyle = picked === 'auto' ? 'scene' : picked
  const look = styleOf(style)

  const seed = input.seedUrl ? await fetchAsInline(input.seedUrl) : null

  /*
    وصف المتجر بيدخل هنا كمان.

    الفيديو من غير سياق بيطلع لقطة عامة تنفع لأي منتج. واللي بيفرق
    إنه يعرف المنتج ده بيتباع لمين وبأي أسلوب.
  */
  const brand = await brandBlock(input.storeId, style)
  const prompt = [
    await storeContext(input.storeId, input.merchantBrief),
    '',
    brand,
    '',
    style === 'literal'
      ? 'اعمل فيديو إعلاني قصير زي الوصف ده بالظبط — من غير ما تضيف حاجة ما اتذكرتش:'
      : 'اعمل فيديو إعلاني قصير — ' + look.label + ':',
    input.prompt,
    look.director,
    '',
    'قواعد:',
    ...look.rules.map((r) => '- ' + r),
    '- حركة كاميرا هادية وبسيطة — الزوم السريع والدوران بيبانوا رخاص.',
    '- المنتج واضح طول الفيديو.',
    '- من غير أي كلام مكتوب على الفيديو، والنص بيتحط في البوست نفسه.',
    '',
    'Cinematic, ultra-sharp, high-end commercial advertising video quality, true-to-life textures, clean rich colors.',
  ]
    .filter((l, i, all) => l !== '' || all[i - 1] !== '')
    .join('\n')

  if (engine.provider === 'openai') {
    const started = await startSora({
      apiKey: engine.apiKey,
      prompt,
      aspect: videoAspect(input.preset),
      image: seed ?? undefined,
    })
    await noteAiOutcome(engine, started)
    if (!started.ok) return { error: started.error.message }
    return { operation: SORA_PREFIX + started.data, model: 'sora' }
  }

  const models = await listVideoModels(engine.apiKey)
  if (!models.ok) return { error: models.error.message }

  const started = await startVideo({
    apiKey: engine.apiKey,
    model: models.data[0],
    prompt,
    aspect: videoAspect(input.preset),
    image: seed ?? undefined,
  })

  if (!started.ok) return { error: started.error.message }
  return { operation: started.data, model: models.data[0] }
}

export type VideoProgress =
  | { state: 'running' }
  | { state: 'done'; id: string; url: string }
  | { state: 'failed'; error: string }

/**
 * السؤال على الفيديو — وحفظه أول ما يجهز.
 *
 * ## الرفع عندنا لا الاحتفاظ برابط المزوّد
 * الرابط اللي بيرجع محتاج المفتاح عشان يتحمّل، ومدته محدودة. حفظه زي
 * ما هو كان بيخلّي البوست يبان شغّالًا وبيقع أول ما حد تاني يفتحه —
 * أو لما ينزل على فيسبوك.
 */
export async function pollProductVideo(input: {
  storeId: string
  userId: string
  operation: string
  prompt: string
  preset: PresetKey
  productId?: string | null
}): Promise<VideoProgress> {
  const sora = input.operation.startsWith(SORA_PREFIX)
  const engine = await studioEngine(input.storeId, sora ? 'openai' : 'gemini')
  if ('error' in engine) return { state: 'failed', error: engine.error }

  let bytes: Buffer

  if (sora) {
    if (engine.provider !== 'openai') return { state: 'failed', error: 'مفتاح ChatGPT اتشال قبل ما الفيديو يخلص.' }
    const id = input.operation.slice(SORA_PREFIX.length)

    const status = await checkSora(engine.apiKey, id)
    if (!status.ok) return { state: 'failed', error: status.error.message }
    if (status.data.state === 'running') return { state: 'running' }
    if (status.data.state === 'failed') return { state: 'failed', error: status.data.message }

    const file = await downloadSora(engine.apiKey, id)
    if (!file.ok) return { state: 'failed', error: file.error.message }
    bytes = file.data
  } else {
    if (engine.provider !== 'gemini') return { state: 'failed', error: 'مفتاح Gemini اتشال قبل ما الفيديو يخلص.' }

    const status = await checkVideo(engine.apiKey, input.operation)
    if (!status.ok) return { state: 'failed', error: status.error.message }
    if (status.data.state === 'running') return { state: 'running' }
    if (status.data.state === 'failed') return { state: 'failed', error: status.data.message }

    const file = await downloadVideo(engine.apiKey, status.data.uri)
    if (!file.ok) return { state: 'failed', error: file.error.message }
    bytes = file.data
  }

  const video = new File([new Uint8Array(bytes)], 'studio.mp4', { type: 'video/mp4' })
  const up = await uploadVideo(input.storeId, video)
  if (!up.ok) return { state: 'failed', error: up.error }

  await recordUpload({
    storeId: input.storeId,
    path: up.path,
    url: up.url,
    name: `فيديو — ${input.prompt.slice(0, 40)}`,
    folder: 'misc',
    sizeBytes: video.size,
    mimeType: 'video/mp4',
    uploadedBy: input.userId,
  }).catch(() => {
    /* الملف موجود على التخزين خلاص — صف المكتبة مش سبب لفشل */
  })

  const [row] = await db
    .insert(studioAssets)
    .values({
      storeId: input.storeId,
      prompt: input.prompt,
      url: up.url,
      path: up.path,
      preset: input.preset,
      kind: 'video',
      mimeType: 'video/mp4',
      productId: input.productId ?? null,
      createdBy: input.userId,
    })
    .returning({ id: studioAssets.id })

  return { state: 'done', id: row.id, url: up.url }
}

/** آخر صور الاستوديو — للمعرض */
export async function recentAssets(storeId: string, limit = 24) {
  return db
    .select({
      id: studioAssets.id,
      url: studioAssets.url,
      prompt: studioAssets.prompt,
      preset: studioAssets.preset,
      kind: studioAssets.kind,
      productId: studioAssets.productId,
      createdAt: studioAssets.createdAt,
    })
    .from(studioAssets)
    .where(eq(studioAssets.storeId, storeId))
    .orderBy(desc(studioAssets.createdAt))
    .limit(limit)
}

/**
 * المنتج اللي الدور عليه.
 *
 * بيدور على المنتجات النشطة بالترتيب، وبيلفّ من الأول لما يخلص.
 * من غير الدور، الجدول بينشر نفس المنتج كل يوم — والمتابع بيتعلّم
 * يعدّي البوست.
 */
export async function nextProductInRotation(
  storeId: string,
  lastProductId: string | null,
  filter?: { categoryId?: string | null; ids?: string[] },
): Promise<string | null> {
  const conds = [
    eq(products.storeId, storeId),
    eq(products.status, 'active'),
    isNull(products.deletedAt),
  ]
  if (filter?.categoryId) conds.push(eq(products.categoryId, filter.categoryId))

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(...conds))
    .orderBy(products.createdAt)
    .limit(500)

  const pool = filter?.ids?.length ? rows.filter((r) => filter.ids!.includes(r.id)) : rows
  if (pool.length === 0) return null

  if (!lastProductId) return pool[0].id

  const at = pool.findIndex((p) => p.id === lastProductId)
  /* المنتج اللي اتمسح بيرجّع الدور لأوله بدل ما يقف */
  return pool[(at + 1) % pool.length].id
}
