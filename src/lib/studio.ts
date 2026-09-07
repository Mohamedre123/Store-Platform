import 'server-only'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, studioAssets } from '@/db/schema'
import { editImage, generate, isImageModel, listImageModels } from './ai/gemini'
import { getAiConfig, GEMINI_PRO_SLUG, GEMINI_SLUG } from './ai/settings'
import { catalogBlock, briefLine, getStoreBrief, operationsBlock } from './ai/store-context'
import { uploadImage, uploadVideo } from './storage'
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
  name: string
  price: string
  description: string | null
  category: string | null
  options: string[]
  image: string | null
}

/** منتج بتفاصيله — الأساس اللي البوست بيتكتب منه */
export async function productBrief(
  storeId: string,
  productId: string,
): Promise<ProductBrief | null> {
  const [row] = await db
    .select({
      id: products.id,
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
    name: row.name,
    price: formatMoney(row.price, brief.currency),
    description: row.description?.trim() || row.shortDescription?.trim() || null,
    category: inCatalog?.category ?? null,
    options: inCatalog?.options ?? [],
    image: row.images?.[0] ?? null,
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

/* ══════════════════════════════════════════════════════════════
   الكلام
   ══════════════════════════════════════════════════════════════ */

export type CopyResult = { caption: string; hashtags: string[] }

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
    '- الطول من ٤٠ لـ٩٠ كلمة.',
    '',
    'رُدّ بـJSON بالشكل ده بالظبط ومن غير أي كلام حواليه:',
    '{"caption":"نص البوست","hashtags":["#هاشتاج","#تاني"]}',
    'الهاشتاجات من ٤ لـ٨، عربي ومناسبة للمنتج والسوق المصري.',
  ]
    .filter(Boolean)
    .join('\n')

  const res = await generate({
    apiKey: key.apiKey,
    model: key.model,
    /* تعليمات النظام منفصلة عن كلام التاجر — أصعب إن وصفه يلغيها */
    system: 'إنت كاتب محتوى تسويقي مصري بيكتب لمتاجر أونلاين. بترد بـJSON بس.',
    messages: [{ role: 'user', text: prompt }],
    temperature: 0.9,
  })
  if (!res.ok) return { error: res.error.message }

  return parseCopy(res.data)
}

/**
 * فكّ رد الموديل.
 *
 * ## الرجوع للنص الخام لو الـJSON اتكسر
 * الموديل بيلفّ الرد أحيانًا في ```json أو بيزوّد جملة قبله.
 * الرمي في الحالة دي كان بيخلّي التاجر يخسر بوستًا مكتوبًا كويس
 * عشان قوس — والنص الخام أحسن من لا حاجة.
 */
function parseCopy(raw: string): CopyResult {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        caption?: unknown
        hashtags?: unknown
      }
      const caption = typeof parsed.caption === 'string' ? parsed.caption.trim() : ''
      const tags = Array.isArray(parsed.hashtags)
        ? parsed.hashtags
            .filter((t): t is string => typeof t === 'string')
            .map((t) => (t.startsWith('#') ? t : '#' + t))
            .map((t) => t.replace(/\s+/g, '_'))
            .slice(0, 10)
        : []
      if (caption) return { caption, hashtags: tags }
    } catch {
      /* بيقع للنص الخام تحت */
    }
  }

  /* النص زي ما جه — والهاشتاجات بتتلقّط منه لو فيه */
  const tags = [...cleaned.matchAll(/#[^\s#]+/g)].map((m) => m[0]).slice(0, 10)
  return { caption: cleaned.replace(/#[^\s#]+/g, '').trim(), hashtags: tags }
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
  const prompt = input.parentId
    ? input.prompt
    : [
        await storeContext(input.storeId, input.merchantBrief),
        '',
        `صمّم صورة إعلانية احترافية بنسبة ${preset.aspect} (${preset.label}).`,
        input.prompt,
        '',
        'قواعد:',
        '- الصورة لازم تبان احترافية زي إعلانات العلامات الكبيرة: إضاءة نضيفة وتكوين مريح.',
        `- أي كلام مكتوب في الصورة يبقى **عربي صحيح** ومقروء.`,
        '- ما تكتبش أسعارًا ولا أرقامًا مش مذكورة فوق.',
        '- سيب مساحة فاضية حوالين المنتج — النص اللي ملزوق في الحافة بيتقصّ على المنصات.',
      ].join('\n')

  const res = await editImage({ apiKey: key.apiKey, model, prompt, image: base })
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
