import 'server-only'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, studioAssets } from '@/db/schema'
import { editImage, generate, isImageModel, listImageModels } from './ai/gemini'
import { getAiConfig, GEMINI_PRO_SLUG, GEMINI_SLUG } from './ai/settings'
import { catalogBlock, briefLine, getStoreBrief, operationsBlock } from './ai/store-context'
import { uploadImage, uploadVideo } from './storage'
import { getStoreTheme } from './storefront'
import { stores } from '@/db/schema'
import { publicStoreUrl } from './domain'
import { checkVideo, downloadVideo, listVideoModels, startVideo, type VeoAspect } from './ai/veo'
import { recordUpload } from './media'
import { formatMoney } from './utils'
import { presetOf, toneOf, type PresetKey, type ToneKey } from './studio-meta'

/**
 * استوديو المحتوى — بيولّد صور وكلام من بيانات المتجر نفسه.
 *
 * ## ليه «من بيانات المتجر» مش مجرد وصف
 * أي حد يقدر يفتح Gemini ويقول «اعملي بوست عن تيشيرت». اللي إحنا
 * عندنا وهو مش عنده: اسم المنتج بالظبط، وسعره بعملة المتجر،
 * ووصفه اللي التاجر كتبه، والمقاسات المتاحة، وسياسة الشحن
 * والإرجاع. البوست اللي فيه السعر والمقاسات الصح بيبيع؛ واللي
 * بيقول «اسأل في الخاص» بيضيّع العميل.
 *
 * ## والمفتاح مفتاح التاجر
 * بنقرا إعداد `gemini_pro` وبعده `gemini`. التكلفة على التاجر
 * لأنها بتزيد باستخدامه هو — ومفتاح واحد للمنصة كان هيقف في أول
 * يوم عليه.
 */

export type StudioError = { error: string }

/* ══════════════════════════════════════════════════════════════
   المفتاح والموديل
   ══════════════════════════════════════════════════════════════ */

/**
 * مفتاح الاستوديو.
 *
 * `gemini_pro` الأول لأن التاجر اللي فعّل المساعد المتقدّم حطّ فيه
 * مفتاحًا عليه فوترة. والرجوع لمفتاح البوت مقصود: أغلب التجّار
 * مفعّلين واحد بس، ومطالبتهم بتالت مفتاح لميزة جديدة بتخلّيهم
 * يسيبوها.
 */
async function studioKey(storeId: string): Promise<{ apiKey: string; model: string } | StudioError> {
  const pro = await getAiConfig(storeId, GEMINI_PRO_SLUG)
  const basic = await getAiConfig(storeId, GEMINI_SLUG)

  const apiKey = pro.apiKey?.trim() || basic.apiKey?.trim()
  if (!apiKey) {
    return { error: 'محتاج تحطّ مفتاح Gemini في الإضافات الأول عشان الاستوديو يشتغل.' }
  }

  const model = pro.model?.trim() || basic.model?.trim() || 'gemini-2.5-flash'
  return { apiKey, model }
}

/**
 * موديل صور — بيتلقّط من حساب التاجر لا مكتوب عندنا.
 *
 * أسماء موديلات الصور عند جوجل بتتغيّر وبتتشال. الاسم المكتوب في
 * الكود بيقف يومها، والتاجر بيشوف «الموديل مش موجود» ومش عارف ليه
 * — والقايمة الحيّة بتاخد اللي متاح فعلًا في حسابه هو.
 */
async function imageModel(apiKey: string): Promise<string | StudioError> {
  const res = await listImageModels(apiKey)
  if (!res.ok) return { error: res.error.message }

  const usable = res.data.filter((m) => m.usable && isImageModel(m.id))
  if (usable.length === 0) {
    return { error: 'مفتاحك مافيهوش موديل بيولّد صور. جرّب مفتاحًا عليه فوترة.' }
  }

  /* الأحدث الأول — جوجل بترتّب القايمة كده وبتحطّ المستقرّ فوق */
  return usable[0].id
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
async function brandBlock(storeId: string): Promise<string> {
  const theme = await getStoreTheme(storeId)
  const id = theme.custom.identity

  return [
    'هوية المتجر البصرية — التزم بيها:',
    `- اللون الأساسي: ${id.primary}`,
    `- اللون المساعد: ${id.accent}`,
    `- خلفية المتجر: ${id.background}`,
    `- لون النص: ${id.text}`,
    `- الحواف: ${id.radius === 'none' ? 'حادّة' : id.radius === 'full' ? 'دايرية جدًا' : 'مستديرة'}`,
    '',
    'استخدم اللونين دول في الخلفية والعناصر والنص المكتوب على الصورة.',
    'الصورة لازم تبان إنها من نفس المتجر لو اتحطّت جنب صورة تانية منه.',
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
  storeId: string
  productId?: string | null
  tone: ToneKey
  /** كلام التاجر الزيادة — بيغلب النبرة الجاهزة */
  extra?: string | null
  merchantBrief?: string | null
}): Promise<CopyResult | StudioError> {
  const key = await studioKey(input.storeId)
  if ('error' in key) return key

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

  const res = await generate({
    apiKey: key.apiKey,
    model: key.model,
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
   الإخراج الفني
   ══════════════════════════════════════════════════════════════ */

export type ArtConcept = {
  /** المكان والمشهد — ده اللي بيفرّق بين إعلان وبطاقة بيانات */
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
 * ## والنص على الصورة أقل ما يمكن
 * الإعلان الاحترافي مش بيكتب المواصفات على الصورة — بيحطّ جملة
 * واحدة، والباقي في البوست. وموديلات الصور بتغلط في العربي لما
 * يكتر، فالقايمة اللي فيها «المقاسات: XL، L، XL» بتطلع مكرّرة
 * وغلط زي ما حصل فعلًا.
 *
 * ## وكلام التاجر قيد لا اقتراح
 * لو كتب «عايزه في مكان حقيقي»، الفكرة **لازم** تبقى مكان حقيقي.
 * التوجيه اللي بيتقرا كاقتراح بيرجّع نفس الخلفية السادة كل مرة —
 * وده اللي كان بيحصل.
 */
async function artDirection(input: {
  storeId: string
  apiKey: string
  model: string
  product: ProductBrief | null
  /** كلام التاجر — نبرة الجدول أو وصفه في الاستوديو */
  direction: string
  preset: PresetKey
  merchantBrief?: string | null
}): Promise<ArtConcept> {
  const brief = await getStoreBrief(input.storeId, input.merchantBrief)
  const p = input.product

  const prompt = [
    'إنت مدير فني بتشتغل لعلامات تجارية، وبتصمّم إعلان واحد.',
    '',
    briefLine(brief),
    '',
    p
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
      : 'الإعلان عن المتجر كله لا عن منتج بعينه.',
    '',
    'توجيه صاحب المتجر — **التزم بيه حرفيًا**:',
    input.direction.trim() || '(ما حدّدش حاجة — إنت اللي تختار اللي يليق بالمنتج)',
    '',
    'فكّر الأول: المنتج ده بيتباع لمين؟ بيتستخدم فين وإمتى؟ إيه',
    'المشهد اللي بيخلّي اللي شايفه يتخيّل نفسه فيه؟',
    '',
    'وبعدين صمّم لقطة **واحدة** واقعية سينمائية:',
    '',
    '[مشهد]',
    'المكان والسياق بالتفصيل — مكان حقيقي بتفاصيله، لا خلفية لون واحد.',
    'اذكر العناصر اللي حوالين المنتج وليه هي موجودة.',
    '',
    '[إضاءة]',
    'نوع الإضاءة واتجاهها ووقت اليوم، ونوع العدسة والعمق.',
    '',
    '[تكوين]',
    'المنتج فين في الكادر، والفراغ فين، وإيه اللي بيوجّه العين له.',
    '',
    '[نص]',
    'من كلمتين لأربعة بالعربي بس — جملة بتشدّ، مش اسم المنتج ولا وصفه.',
    'أو اكتب «مفيش» لو الصورة أقوى من غير كلام.',
    '',
    'ممنوع تمامًا: خلفية لون واحد أو تدرّج، منتج مقصوص طاير في الفراغ،',
    'قوايم مواصفات أو مقاسات أو أسعار مكتوبة على الصورة، أيقونات ومستطيلات',
    'حوالين المنتج. دي بتخلّي الإعلان يبان كتالوج.',
  ]
    .filter(Boolean)
    .join('\n')

  const res = await generate({
    apiKey: input.apiKey,
    model: input.model,
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
  if (!res.ok) return fallbackConcept(input.product, input.direction)

  return parseConcept(res.data, input.product, input.direction)
}

/** فكرة محترمة لما التفكير يقع — أحسن من الخلفية السادة */
function fallbackConcept(product: ProductBrief | null, direction: string): ArtConcept {
  return {
    scene:
      direction.trim() ||
      'مشهد واقعي في مكان طبيعي بيستخدم فيه المنتج، بتفاصيل حقيقية حواليه' +
        (product ? ' تناسب ' + product.name : ''),
    look: 'إضاءة طبيعية ناعمة جنبية، عدسة ٥٠ملم، عمق ميدان ضحل والخلفية مموّهة بهدوء',
    composition: 'المنتج في التلت السفلي، ومساحة فاضية فوقه، والضوء بيوجّه العين له',
    overlay: '',
  }
}

function parseConcept(
  raw: string,
  product: ProductBrief | null,
  direction: string,
): ArtConcept {
  const text = raw.replace(/```+/g, '').trim()

  const grab = (label: string): string => {
    const re = new RegExp('\\[' + label + '\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)')
    return text.match(re)?.[1]?.trim() ?? ''
  }

  const base = fallbackConcept(product, direction)
  const overlay = grab('نص')

  return {
    scene: grab('مشهد') || base.scene,
    look: grab('إضاءة') || base.look,
    composition: grab('تكوين') || base.composition,
    /* «مفيش» يعني من غير نص — والصورة النضيفة أحسن من نص مكسور */
    overlay: /^مفيش/.test(overlay) ? '' : overlay,
  }
}

/** الفكرة كوصف لموديل الصور */
function conceptToPrompt(c: ArtConcept, preset: { aspect: string; label: string }): string {
  return [
    'صوّر لقطة إعلانية واحدة، واقعية وسينمائية، بنسبة ' + preset.aspect + '.',
    '',
    'المشهد: ' + c.scene,
    'الإضاءة والكاميرا: ' + c.look,
    'التكوين: ' + c.composition,
    c.overlay
      ? 'اكتب على الصورة النص ده بالظبط وبخط عربي نضيف ومقروء: «' + c.overlay + '» — ' +
        'وما تكتبش أي كلام تاني خالص.'
      : 'من غير أي كلام مكتوب على الصورة.',
  ].join('\n')
}

/* ══════════════════════════════════════════════════════════════
   الصور
   ══════════════════════════════════════════════════════════════ */

export type StudioImage = { id: string; url: string; prompt: string; preset: PresetKey }

/**
 * توليد صورة أو تعديل واحدة موجودة.
 *
 * ## التعديل بياخد الصورة الأصلية معاه
 * «خلّي الخلفية أغمق» من غير الصورة معناه توليد صورة جديدة تمامًا
 * — والتاجر بيلاقي منتجًا تاني خالص. الصورة بتتجاب من التخزين
 * وبتتبعت للموديل جنب التعديل.
 *
 * ## والصورة بتترفع بعد النجاح بس
 * التاجر ممكن يجرّب خمس تعديلات ويختار واحدًا. رفع الخمسة كان
 * هيملا تخزينه بأربع صور محدش هيشوفها — بس السلسلة محتاجة الأب
 * يفضل موجود، فبنرفع كل ناتج ونسيب الحذف له.
 */
export async function makeImage(input: {
  storeId: string
  userId: string
  prompt: string
  preset: PresetKey
  productId?: string | null
  /** الصورة اللي بيتعدّل عليها — فاضي يعني توليد جديد */
  parentId?: string | null
  /** صورة المنتج نفسها كأساس — أول توليد بيبدأ منها */
  seedUrl?: string | null
  merchantBrief?: string | null
  /**
   * فكرة جاهزة — للكاروسيل.
   *
   * الشرايح كلها لازم تشترك في نفس المشهد والإضاءة، فالفكرة
   * بتتصمّم مرة واحدة للسِت كله وبتتمرّر لكل شريحة. من غير كده
   * كل شريحة بتفكّر لوحدها والخمسة يبانوا خمس إعلانات.
   */
  concept?: ArtConcept
}): Promise<StudioImage | StudioError> {
  const key = await studioKey(input.storeId)
  if ('error' in key) return key

  const model = await imageModel(key.apiKey)
  if (typeof model !== 'string') return model

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
    وصف المتجر بيدخل التوليد الأول بس.

    التعديل «كبّر الخط» ما يحتاجش يعرف سياسة الشحن — وحشو السياق في
    كل تعديل بيخلّي الموديل يعيد رسم الصورة من الأول بدل ما يعدّلها.
  */
  /*
    التعديل بيمشي بكلام التاجر زي ما هو.

    «خلّي الخلفية أغمق» مش محتاجة إخراج فني ولا سياق متجر — دي
    تعليمة على صورة موجودة، وحشو السياق معاها بيخلّي الموديل يعيد
    رسمها من الأول بدل ما يعدّلها.
  */
  let prompt = input.prompt

  if (!input.parentId) {
    /*
      الفكرة الأول، والرسم بعدها.

      الوصف اللي بيروح لموديل الصور على طول بيطلّع بطاقة بيانات:
      منتج مقصوص على لون واحد واسمه ومقاساته مكتوبين جنبه. خطوة
      التفكير دي هي الفرق بين إعلان وكتالوج.
    */
    const product = input.productId
      ? await productBrief(input.storeId, input.productId)
      : null

    const concept =
      input.concept ??
      (await artDirection({
        storeId: input.storeId,
        apiKey: key.apiKey,
        model: key.model,
        product,
        direction: input.prompt,
        preset: input.preset,
        merchantBrief: input.merchantBrief,
      }))

    prompt = [
      await brandBlock(input.storeId),
      '',
      conceptToPrompt(concept, preset),
      '',
      'قواعد:',
      '- **ممنوع** خلفية بلون واحد أو تدرّج، وممنوع منتج مقصوص طاير في الفراغ.',
      '- **ممنوع** أي قايمة مواصفات أو مقاسات أو أسعار أو أيقونات في مستطيلات.',
      '- المنتج لازم يبان زي ما هو في الصورة المرفقة — نفس الشكل واللون والتفاصيل.',
      '- سيب مساحة فاضية حوالين الحواف — المنصات بتقصّها.',
    ].join('\n')
  }

  const res = await editImage({
    apiKey: key.apiKey,
    model,
    prompt,
    image: base,
    aspectRatio: preset.aspect,
  })
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
    /* حدّ الحجم — جوجل بترفض المضمَّن الكبير برد مالوش معنى */
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

/**
 * أدوار الشرايح.
 *
 * ## الكاروسيل مش خمس صور — دي حكاية بخمس صفحات
 * خمس صور للمنتج من زوايا مختلفة بيتعدّوا زي أي بوست. اللي بيخلّي
 * العميل يسحب لآخر شريحة إن كل واحدة بتضيف حاجة: الأولى بتوقّفه،
 * واللي في النص بتقنعه، والأخيرة بتقوله يعمل إيه.
 *
 * والأدوار بتتوزّع على العدد اللي التاجر طلبه: الأولى والأخيرة
 * ثابتين، واللي بينهم بالدور.
 */
const SLIDE_ROLES = {
  first: 'شريحة الغلاف: المنتج واضح وكبير، وجملة قصيرة جدًا بتشدّ العين.',
  last: 'الشريحة الأخيرة: دعوة للطلب واضحة، ومساحة فاضية حواليها.',
  middle: [
    'شريحة فايدة: ركّز على فايدة واحدة للمنتج بصورة بتوضّحها.',
    'شريحة تفصيلة: قرّب على خامة المنتج أو تفصيلة فيه.',
    'شريحة استخدام: المنتج وهو مستخدَم في موقف حقيقي.',
    'شريحة مقارنة: المنتج جنب حاجة بتوضّح حجمه أو جودته.',
  ],
}

function slideBrief(index: number, total: number): string {
  if (index === 0) return SLIDE_ROLES.first
  if (index === total - 1) return SLIDE_ROLES.last
  return SLIDE_ROLES.middle[(index - 1) % SLIDE_ROLES.middle.length]
}

export type CarouselResult = { images: StudioImage[] } | StudioError

/**
 * كاروسيل — صور مترابطة شكلًا.
 *
 * ## كل شريحة بتتبني على اللي قبلها
 * الشريحة رقم ٣ بتتولّد **والشريحة ٢ معاها كمرجع**. من غير كده كل
 * صورة بتطلع بأسلوب وإضاءة وخلفية مختلفة، والخمسة يبانوا خمس
 * إعلانات لخمس متاجر — مش كاروسيل واحد.
 *
 * ## والفشل في النص بيرجّع اللي نجح
 * أربع شرايح من خمسة أحسن من لا حاجة، والتاجر ينشرهم أو يعيد.
 * الرمي كان بيضيّع أربع نداءات دفع تمنهم.
 */
export async function makeCarousel(input: {
  storeId: string
  userId: string
  prompt: string
  preset: PresetKey
  count: number
  productId?: string | null
  seedUrl?: string | null
  merchantBrief?: string | null
}): Promise<CarouselResult> {
  const count = Math.max(2, Math.min(10, input.count))
  const images: StudioImage[] = []

  /*
    فكرة واحدة للسِت كله.

    الشرايح لازم تشترك في المشهد والإضاءة والمزاج — وده اللي
    بيخلّيهم كاروسيل واحد. لو كل شريحة فكّرت لوحدها، الخمسة يطلعوا
    خمس إعلانات لخمس متاجر.
  */
  const key = await studioKey(input.storeId)
  if ('error' in key) return key

  const product = input.productId ? await productBrief(input.storeId, input.productId) : null

  const concept = await artDirection({
    storeId: input.storeId,
    apiKey: key.apiKey,
    model: key.model,
    product,
    direction: input.prompt,
    preset: input.preset,
    merchantBrief: input.merchantBrief,
  })

  for (let i = 0; i < count; i++) {
    /*
      المرجع: الشريحة اللي قبلها، وأول واحدة بتاخد صورة المنتج.

      كده السلسلة كلها بتفضل شبه بعضها، وأولها بيفضل شبه المنتج
      الحقيقي.
    */
    const previous = images.at(-1)

    const res = await makeImage({
      storeId: input.storeId,
      userId: input.userId,
      prompt: [
        input.prompt,
        '',
        'دي شريحة ' + (i + 1) + ' من ' + count + ' في كاروسيل واحد.',
        slideBrief(i, count),
        previous
          ? 'خلّي الأسلوب والإضاءة والخلفية والألوان **نفسها بالظبط** زي الصورة المرفقة — دي الشريحة اللي قبلها في نفس الكاروسيل.'
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      preset: input.preset,
      productId: input.productId,
      concept,
      /*
        `parentId` فاضي عن قصد.

        هو للتعديل («خلّي الخلفية أغمق») واللي بيشيل سياق المتجر من
        الوصف. والشريحة الجديدة محتاجة السياق كامل — فبنمرّر
        السابقة كـ`seedUrl` بدل كده.
      */
      seedUrl: previous?.url ?? input.seedUrl ?? null,
      merchantBrief: input.merchantBrief,
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
 * Veo بياخد `16:9` و`9:16` بس. المربّع والطولي بيتحوّلوا للطولي
 * لأن ده اللي بيشتغل في ريلز وتيك توك — والعرضي بيفضل عرضي.
 * الرفض كان بيخلّي التاجر يختار مقاسًا شرعيًّا وياخد رسالة خطأ.
 */
function videoAspect(preset: PresetKey): VeoAspect {
  return preset === 'landscape' ? '16:9' : '9:16'
}

export type VideoJob = { operation: string; model: string }

/**
 * بدء توليد فيديو — بيرجّع اسم العملية.
 *
 * ## الانتظار على المتصفح لا على الخادم
 * Veo بياخد من دقيقة لتلاتة. دالة الخادم عندنا عمرها ثواني —
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
}): Promise<VideoJob | StudioError> {
  const key = await studioKey(input.storeId)
  if ('error' in key) return key

  const models = await listVideoModels(key.apiKey)
  if (!models.ok) return { error: models.error.message }

  const seed = input.seedUrl ? await fetchAsInline(input.seedUrl) : null

  /*
    وصف المتجر بيدخل هنا كمان.

    الفيديو من غير سياق بيطلع لقطة عامة تنفع لأي منتج. واللي بيفرق
    إنه يعرف المنتج ده بيتباع لمين وبأي أسلوب.
  */
  const prompt = [
    await storeContext(input.storeId, input.merchantBrief),
    '',
    await brandBlock(input.storeId),
    '',
    'اعمل فيديو إعلاني قصير:',
    input.prompt,
    '',
    'قواعد:',
    '- حركة كاميرا هادية وبسيطة — الزوم السريع والدوران بيبانوا رخاص.',
    '- المنتج في وسط الكادر وواضح طول الفيديو.',
    '- من غير أي كلام مكتوب على الفيديو، والنص بيتحط في البوست نفسه.',
  ].join('\n')

  const started = await startVideo({
    apiKey: key.apiKey,
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
 * ## الرفع عندنا لا الاحتفاظ برابط جوجل
 * الرابط اللي بترجّعه جوجل محتاج المفتاح عشان يتحمّل، ومدته
 * محدودة. حفظه زي ما هو كان بيخلّي البوست يبان شغّالًا وبيقع أول
 * ما حد تاني يفتحه — أو لما ينزل على فيسبوك.
 */
export async function pollProductVideo(input: {
  storeId: string
  userId: string
  operation: string
  prompt: string
  preset: PresetKey
  productId?: string | null
}): Promise<VideoProgress> {
  const key = await studioKey(input.storeId)
  if ('error' in key) return { state: 'failed', error: key.error }

  const status = await checkVideo(key.apiKey, input.operation)
  if (!status.ok) return { state: 'failed', error: status.error.message }
  if (status.data.state === 'running') return { state: 'running' }
  if (status.data.state === 'failed') return { state: 'failed', error: status.data.message }

  const file = await downloadVideo(key.apiKey, status.data.uri)
  if (!file.ok) return { state: 'failed', error: file.error.message }

  const video = new File([new Uint8Array(file.data)], 'studio.mp4', { type: 'video/mp4' })
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
