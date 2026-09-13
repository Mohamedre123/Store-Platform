import 'server-only'
import { and, asc, desc, eq, inArray, isNotNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { contentSchedules, socialAccounts, socialPosts, stores } from '@/db/schema'
import {
  joinCopy,
  makeCarousel,
  makeImage,
  nextProductInRotation,
  pollProductVideo,
  productBrief,
  startProductVideo,
  writeCopy,
} from './studio'
import { publishToAccount, type PublishOutcome } from './social'
import { nextRun, resolveStyle, styleOf, type ImageStyle, type PresetKey } from './studio-meta'
import { isProvider, type AiProvider } from './ai/providers-meta'

/**
 * النشر المجدوَل — «كل يوم الساعة كذا».
 *
 * ## ليه ده الجزء اللي بيفرق
 * التاجر اللي بيفتح الاستوديو ويعمل بوست بإيده بيعمله مرتين وينسى.
 * والصفحة اللي بتنزل مرة في الأسبوع ما بتبنيش متابعين. الجدولة هي
 * اللي بتحوّل الأداة من لعبة لقناة تسويق.
 *
 * ## وبيمشي على طابور المهام الموجود
 * مفيش عامل جديد ولا منبّه تاني. `pg_cron` بينده مسار المهام كل
 * دقيقة أصلًا، والجدول بيتحوّل لمهمة في نفس الطابور — يعني نفس
 * إعادة المحاولة ونفس السجل ونفس القفل اللي بيمنع التنفيذ المزدوج.
 */

/* ══════════════════════════════════════════════════════════════
   البوستات
   ══════════════════════════════════════════════════════════════ */

export type PostRow = {
  id: string
  caption: string
  hashtags: string[]
  imageUrls: string[]
  videoUrl: string | null
  productId: string | null
  targets: string[]
  status: 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduledFor: Date | null
  publishedAt: Date | null
  results: PublishOutcome[]
  createdAt: Date
}

export async function listPosts(storeId: string, limit = 40): Promise<PostRow[]> {
  const rows = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.storeId, storeId))
    .orderBy(desc(socialPosts.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    caption: r.caption,
    hashtags: r.hashtags,
    imageUrls: r.imageUrls,
    videoUrl: r.videoUrl,
    productId: r.productId,
    targets: r.targets,
    status: r.status,
    scheduledFor: r.scheduledFor,
    publishedAt: r.publishedAt,
    results: r.results,
    createdAt: r.createdAt,
  }))
}

export async function createPost(input: {
  storeId: string
  userId: string | null
  caption: string
  hashtags: string[]
  imageUrls: string[]
  videoUrl?: string | null
  productId?: string | null
  targets?: string[]
  scheduleId?: string | null
  status?: PostRow['status']
  scheduledFor?: Date | null
}): Promise<string> {
  const [row] = await db
    .insert(socialPosts)
    .values({
      storeId: input.storeId,
      caption: input.caption,
      hashtags: input.hashtags,
      imageUrls: input.imageUrls,
      videoUrl: input.videoUrl ?? null,
      productId: input.productId ?? null,
      targets: input.targets ?? [],
      scheduleId: input.scheduleId ?? null,
      status: input.status ?? 'ready',
      scheduledFor: input.scheduledFor ?? null,
      createdBy: input.userId,
    })
    .returning({ id: socialPosts.id })

  return row.id
}

/**
 * تعديل بوست لسه ما اتنشرش — بيرجّع المعرّف أو `null`.
 *
 * ## اللي اتنشر ما بيتعدّلش
 * البوست المنشور نزل على صفحة التاجر خلاص. تعديل صفّه كان هيخلّي
 * «البوستات» تعرض كلامًا غير اللي الناس شافته، وإعادة نشره تنزّل
 * نسخة تانية على نفس الصفحة. `null` بتقول للمنادي يعمل بوست جديد.
 */
export async function updatePost(
  storeId: string,
  postId: string,
  fields: Partial<{
    caption: string
    hashtags: string[]
    imageUrls: string[]
    videoUrl: string | null
    productId: string | null
    targets: string[]
  }>,
): Promise<string | null> {
  const rows = await db
    .update(socialPosts)
    .set({ ...fields, updatedAt: new Date() })
    .where(
      and(
        eq(socialPosts.id, postId),
        eq(socialPosts.storeId, storeId),
        inArray(socialPosts.status, ['draft', 'ready', 'failed']),
      ),
    )
    .returning({ id: socialPosts.id })

  return rows[0]?.id ?? null
}

/**
 * نشر بوست على وجهاته.
 *
 * ## الوجهات بتتفلتر على متجرها
 * معرّفات الحسابات بتيجي من المتصفح. من غير الفلترة، تاجر بيبعت
 * معرّف حساب تاجر تاني وينشر على صفحته — وده أخطر حاجة في الميزة
 * كلها.
 *
 * ## والنتيجة بتتخزّن لكل وجهة
 * اللي نزل على فيسبوك وفشل على إنستجرام بيفضل ناجحًا على فيسبوك.
 * إعادة المحاولة بتشتغل على اللي فشل بس.
 */
export async function publishPost(
  storeId: string,
  postId: string,
): Promise<{ ok: boolean; results: PublishOutcome[]; error?: string }> {
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.id, postId), eq(socialPosts.storeId, storeId)))
    .limit(1)

  if (!post) return { ok: false, results: [], error: 'البوست مش موجود' }
  if (post.imageUrls.length === 0 && !post.videoUrl) {
    return { ok: false, results: [], error: 'البوست من غير صورة ولا فيديو' }
  }
  if (post.targets.length === 0) {
    return { ok: false, results: [], error: 'ما اخترتش حساب تنشر عليه' }
  }

  /* الحسابات بتاعة المتجر ده بس */
  const owned = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(
      and(eq(socialAccounts.storeId, storeId), inArray(socialAccounts.id, post.targets)),
    )

  if (owned.length === 0) {
    return { ok: false, results: [], error: 'الحسابات المختارة مش موجودة' }
  }

  await db
    .update(socialPosts)
    .set({ status: 'publishing', updatedAt: new Date() })
    .where(eq(socialPosts.id, postId))

  const results: PublishOutcome[] = []
  for (const acc of owned) {
    results.push(
      await publishToAccount(storeId, acc.id, {
        caption: post.caption,
        hashtags: post.hashtags,
        imageUrls: post.imageUrls,
        videoUrl: post.videoUrl,
      }),
    )
  }

  const anyOk = results.some((r) => r.ok)

  /*
    الفشل اللي سببه «مش مربوط» بيرجّع البوست **جاهزًا** لا فاشلًا.

    «فشل» بتخلّي التاجر يفتكر إن فيه حاجة غلط في البوست نفسه
    ويحذفه — وهو سليم تمامًا ومستنّي الربط بس. و«جاهز» بتخلّيه
    يفضل في الطابور وينزل أول ما الحساب يتربط.
  */
  const notLinked =
    !anyOk && results.every((r) => /مش مربوط|مش موجود|مش مضبوطة|انتهى/.test(r.error ?? ''))

  await db
    .update(socialPosts)
    .set({
      status: anyOk ? 'published' : notLinked ? 'ready' : 'failed',
      publishedAt: anyOk ? new Date() : null,
      results,
      updatedAt: new Date(),
    })
    .where(eq(socialPosts.id, postId))

  return { ok: anyOk, results }
}

export async function deletePost(storeId: string, postId: string): Promise<void> {
  await db
    .delete(socialPosts)
    .where(and(eq(socialPosts.id, postId), eq(socialPosts.storeId, storeId)))
}

/* ══════════════════════════════════════════════════════════════
   الجداول
   ══════════════════════════════════════════════════════════════ */

export type ScheduleRow = {
  id: string
  name: string
  isActive: boolean
  days: number[]
  timeOfDay: string
  targets: string[]
  source: 'auto' | 'category' | 'products'
  categoryId: string | null
  productIds: string[]
  style: string | null
  preset: string
  media: 'image' | 'carousel' | 'video'
  slides: number
  imageStyle: ImageStyle
  aiProvider: AiProvider | null
  aiTextModel: string | null
  aiImageModel: string | null
  autoPublish: boolean
  lastRunAt: Date | null
  nextRunAt: Date | null
  lastError: string | null
}

export async function listSchedules(storeId: string): Promise<ScheduleRow[]> {
  const rows = await db
    .select()
    .from(contentSchedules)
    .where(eq(contentSchedules.storeId, storeId))
    .orderBy(asc(contentSchedules.createdAt))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.isActive,
    days: r.days,
    timeOfDay: r.timeOfDay,
    targets: r.targets,
    source: r.source,
    categoryId: r.categoryId,
    productIds: r.productIds,
    style: r.style,
    preset: r.preset,
    media: r.media,
    slides: r.slides,
    imageStyle: styleOf(r.imageStyle).key,
    aiProvider: isProvider(r.aiProvider) ? r.aiProvider : null,
    aiTextModel: r.aiTextModel,
    aiImageModel: r.aiImageModel,
    autoPublish: r.autoPublish,
    lastRunAt: r.lastRunAt,
    nextRunAt: r.nextRunAt,
    lastError: r.lastError,
  }))
}

/**
 * حفظ جدول — والميعاد الجاي بيتحسب هنا.
 *
 * الحساب وقت الحفظ لا وقت القراءة: النبضة بتقرا فهرسًا واحدًا
 * («هات اللي ميعاده فات») بدل ما تلفّ على كل جداول المنصة وتحسب
 * لكل واحد كل دقيقة.
 */
export async function saveSchedule(input: {
  storeId: string
  userId: string
  id?: string | null
  name: string
  days: number[]
  timeOfDay: string
  targets: string[]
  source: 'auto' | 'category' | 'products'
  categoryId?: string | null
  productIds?: string[]
  style?: string | null
  preset: PresetKey
  media: 'image' | 'carousel' | 'video'
  slides?: number
  imageStyle?: ImageStyle | null
  aiProvider?: string | null
  aiTextModel?: string | null
  aiImageModel?: string | null
  autoPublish: boolean
  isActive: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (input.days.length === 0) return { ok: false, error: 'اختار يوم واحد على الأقل' }
  if (!/^\d{2}:\d{2}$/.test(input.timeOfDay)) return { ok: false, error: 'الميعاد مش مظبوط' }

  const [store] = await db
    .select({ timezone: stores.timezone })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1)

  const next = input.isActive
    ? nextRun(input.days, input.timeOfDay, store?.timezone ?? 'Africa/Cairo')
    : null

  const values = {
    name: input.name.trim() || 'جدول نشر',
    days: input.days,
    timeOfDay: input.timeOfDay,
    targets: input.targets,
    source: input.source,
    categoryId: input.source === 'category' ? (input.categoryId ?? null) : null,
    productIds: input.source === 'products' ? (input.productIds ?? []) : [],
    style: input.style?.trim() || null,
    preset: input.preset,
    media: input.media,
    /*
      الحدود بتتقصّ هنا لا في الشاشة بس.

      الفعل بيتنادى من الشبكة مباشرةً كمان، و`slides: 500` كانت
      هتخلّي الجدول اليومي يولّد ٥٠٠ صورة على مفتاح التاجر.
    */
    slides: Math.max(2, Math.min(10, Math.round(input.slides ?? 5))),
    /* نفس الفكرة: أي نص غير معروف بيرجع «يختار لوحده» */
    imageStyle: styleOf(input.imageStyle).key,
    aiProvider: isProvider(input.aiProvider) ? input.aiProvider : null,
    aiTextModel: input.aiTextModel?.trim().slice(0, 120) || null,
    aiImageModel: input.aiImageModel?.trim().slice(0, 120) || null,
    autoPublish: input.autoPublish,
    isActive: input.isActive,
    nextRunAt: next,
    updatedAt: new Date(),
  }

  if (input.id) {
    const updated = await db
      .update(contentSchedules)
      .set(values)
      .where(and(eq(contentSchedules.id, input.id), eq(contentSchedules.storeId, input.storeId)))
      .returning({ id: contentSchedules.id })
    if (!updated.length) return { ok: false, error: 'الجدول مش موجود' }
    return { ok: true, id: updated[0].id }
  }

  const [row] = await db
    .insert(contentSchedules)
    .values({ storeId: input.storeId, createdBy: input.userId, ...values })
    .returning({ id: contentSchedules.id })

  return { ok: true, id: row.id }
}

export async function deleteSchedule(storeId: string, id: string): Promise<void> {
  await db
    .delete(contentSchedules)
    .where(and(eq(contentSchedules.id, id), eq(contentSchedules.storeId, storeId)))
}

/* ══════════════════════════════════════════════════════════════
   التشغيل
   ══════════════════════════════════════════════════════════════ */

/**
 * الجداول اللي ميعادها فات — بتتحوّل لمهام.
 *
 * ## الميعاد الجاي بيتكتب **قبل** التنفيذ
 * التوليد بياخد ثواني وممكن يفشل. لو حدّثنا الميعاد بعده، الجدول
 * اللي فشل بيفضل مستحقًّا وبيتنفّذ كل دقيقة لحد ما ينجح — يعني
 * ستين محاولة في الساعة على مفتاح التاجر.
 */
export async function queueDueSchedules(): Promise<number> {
  const now = new Date()

  const due = await db
    .select({
      id: contentSchedules.id,
      storeId: contentSchedules.storeId,
      days: contentSchedules.days,
      timeOfDay: contentSchedules.timeOfDay,
    })
    .from(contentSchedules)
    .where(
      and(
        eq(contentSchedules.isActive, true),
        isNotNull(contentSchedules.nextRunAt),
        lte(contentSchedules.nextRunAt, now),
      ),
    )
    .limit(20)

  if (due.length === 0) return 0

  const { enqueue } = await import('./jobs')

  for (const s of due) {
    const [store] = await db
      .select({ timezone: stores.timezone })
      .from(stores)
      .where(eq(stores.id, s.storeId))
      .limit(1)

    await db
      .update(contentSchedules)
      .set({
        lastRunAt: now,
        nextRunAt: nextRun(s.days, s.timeOfDay, store?.timezone ?? 'Africa/Cairo', now),
      })
      .where(eq(contentSchedules.id, s.id))

    await enqueue({
      storeId: s.storeId,
      type: 'content.schedule',
      payload: { scheduleId: s.id },
      /*
        محاولتين بس.

        التوليد بيستهلك من مفتاح التاجر. الخمسة الافتراضية على جدول
        بيفشل كل يوم بتبقى خمستاشر نداء في الأسبوع على الفاضي —
        والبوست الفايت أهون من فاتورة مش مفهومة.
      */
      maxAttempts: 2,
    })
  }

  return due.length
}

/**
 * تنفيذ جدول — بيولّد الصورة والكلام ويعمل بوست.
 *
 * بيرجّع خطأ نصًّا لا بيرمي: الطابور بيسجّله على المهمة، وبيتكتب
 * على الجدول كمان عشان التاجر يشوفه في شاشته من غير ما يفتح
 * السجل.
 */
export async function runSchedule(scheduleId: string): Promise<{ ok: boolean; error?: string }> {
  const [s] = await db
    .select()
    .from(contentSchedules)
    .where(eq(contentSchedules.id, scheduleId))
    .limit(1)

  if (!s) return { ok: false, error: 'الجدول مش موجود' }
  if (!s.isActive) return { ok: true }

  const fail = async (error: string) => {
    await db
      .update(contentSchedules)
      .set({ lastError: error.slice(0, 300), updatedAt: new Date() })
      .where(eq(contentSchedules.id, s.id))
    return { ok: false, error }
  }

  /* المنتج اللي الدور عليه */
  const productId = await nextProductInRotation(s.storeId, s.lastProductId, {
    categoryId: s.source === 'category' ? s.categoryId : null,
    ids: s.source === 'products' ? s.productIds : undefined,
  })

  if (!productId) return fail('مفيش منتجات نشطة يتعمل عنها بوست')

  const product = await productBrief(s.storeId, productId)
  if (!product) return fail('المنتج مش موجود')

  /*
    صورة مختلفة من المنتج كل مرة.

    المنتج اللي ليه خمس صور (ألوان أو زوايا) بيدّي خمس بوستات
    مختلفة الشكل. الاكتفاء بالأولى كان بيخلّي الجدول ينشر نفس
    الصورة كل ما الدور يرجع عليه — والمتابع بيتعلّم يعدّي البوست.

    والدوران بعدد المرات اللي الجدول اشتغلها: بيتحسب من عدد
    البوستات اللي طلعت من الجدول ده، فما بيحتاجش عمودًا جديدًا
    وبيفضل مظبوط لو التاجر مسح بوستًا.
  */
  const [{ n: runs = 0 } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(socialPosts)
    .where(eq(socialPosts.scheduleId, s.id))

  const photos = product.images.length ? product.images : [product.image].filter(Boolean)
  const seed = photos.length ? photos[runs % photos.length] : null

  /* الكلام الأول — أرخص، ولو فشل ما نضيّعش نداء صورة */
  /*
    والنبرة بتلفّ كمان.

    «بوست بيعي» كل يوم بيخلّي الصفحة قالبًا واحدًا متكرّرًا. التنويع
    بين البيع والحكاية والنصيحة بيخلّي المتابع يفضل بيقرا — ودي
    نفس النصيحة اللي أي مدير محتوى بيقولها.
  */
  const tones = ['sell', 'story', 'launch', 'tips'] as const
  const copy = await writeCopy({
    storeId: s.storeId,
    productId,
    tone: tones[runs % tones.length],
    extra: s.style,
    provider: s.aiProvider,
    textModel: s.aiTextModel,
  })
  if ('error' in copy) return fail(copy.error)

  const brief = [
    s.media === 'video'
      ? `فيديو إعلاني قصير لمنتج «${product.name}».`
      : s.media === 'carousel'
        ? `كاروسيل إعلاني من ${s.slides} شرايح لمنتج «${product.name}».`
      : `صورة إعلانية لمنتج «${product.name}».`,
    s.style?.trim() ? s.style.trim() : '',
  ]
    .filter(Boolean)
    .join(' ')

  /*
    شكل الصورة: كلام التاجر المكتوب، وبعده اختيار الجدول.

    الجدول اللي فيه «خلّي المنتج على خلفية سادة» كان بيطلع مكان حقيقي
    جوّه إطار أبيض. دلوقتي الجملة دي بتحسم الشكل حتى لو الجدول قديم
    وعموده `auto`.
  */
  const style = resolveStyle(s.imageStyle, s.style)

  /* قايمة لا صورة واحدة — الكاروسيل بيملاها بشرايحه بترتيبها */
  let imageUrls: string[] = []
  let videoUrl: string | null = null

  if (s.media === 'carousel') {
    /*
      نفس كاروسيل الاستوديو بالظبط — فكرة واحدة للسِت كله.

      الشرايح بتشترك في المشهد والإضاءة لأن `makeCarousel` بيصمّم
      الفكرة مرة وبيمرّرها لكل شريحة. واللي نجح من الشرايح بيتنشر
      لو في النص واحدة فشلت — أربعة من خمسة أحسن من يوم فاضي.
    */
    const set = await makeCarousel({
      storeId: s.storeId,
      userId: s.createdBy ?? '',
      prompt: brief,
      preset: s.preset as PresetKey,
      count: s.slides,
      productId,
      seedUrl: seed,
      style,
      provider: s.aiProvider,
      textModel: s.aiTextModel,
      imageModel: s.aiImageModel,
    })
    if ('error' in set) return fail(set.error)

    /* شريحة واحدة مش كاروسيل — والمنصات بترفضه كده أصلًا */
    if (set.images.length < 2) return fail('الكاروسيل طلع أقل من شريحتين. هيتعاد في الميعاد الجاي.')

    imageUrls = set.images.map((i) => i.url)
  } else if (s.media === 'video') {
    /*
      الفيديو بيتستنّى **هنا** لا على المتصفح.

      الجدول بيشتغل في مهمة خلفية مالهاش واجهة تسأل — فالانتظار
      لازم يحصل جوّاها. والحدّ تلات دقايق: أطول من كده يبقى فيه
      حاجة واقفة عند جوجل، والمهمة هتتعاد بكرة في ميعادها.
    */
    const job = await startProductVideo({
      storeId: s.storeId,
      prompt: brief,
      preset: s.preset as PresetKey,
      seedUrl: seed,
      style,
      provider: s.aiProvider,
    })
    if ('error' in job) return fail(job.error)

    for (let i = 0; i < 36; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const step = await pollProductVideo({
        storeId: s.storeId,
        userId: s.createdBy ?? '',
        operation: job.operation,
        prompt: brief,
        preset: s.preset as PresetKey,
        productId,
      })
      if (step.state === 'failed') return fail(step.error)
      if (step.state === 'done') {
        videoUrl = step.url
        break
      }
    }

    if (!videoUrl) return fail('الفيديو أخد وقت أطول من المتوقّع. هيتعاد في الميعاد الجاي.')
  } else {
    const image = await makeImage({
      storeId: s.storeId,
      userId: s.createdBy ?? '',
      prompt: brief,
      preset: s.preset as PresetKey,
      productId,
      seedUrl: seed,
      style,
      provider: s.aiProvider,
      textModel: s.aiTextModel,
      imageModel: s.aiImageModel,
    })
    if ('error' in image) return fail(image.error)
    imageUrls = [image.url]
  }

  const postId = await createPost({
    storeId: s.storeId,
    userId: s.createdBy,
    caption: joinCopy(copy),
    hashtags: copy.hashtags,
    imageUrls,
    videoUrl,
    productId,
    targets: s.targets,
    scheduleId: s.id,
    status: s.autoPublish ? 'scheduled' : 'ready',
  })

  /* الدور بيتقدّم بعد النجاح — الفشل ما يصحّش يتخطّى منتجًا */
  await db
    .update(contentSchedules)
    .set({ lastProductId: productId, lastError: null, updatedAt: new Date() })
    .where(eq(contentSchedules.id, s.id))

  /*
    التوليد بينجح حتى لو النشر مقفول.

    ## ليه الفشل هنا مش فشل
    خدمة النشر ممكن تكون لسه مش مضبوطة، أو التاجر لسه ما ربطش
    حسابه. والبوست **اتعمل فعلًا** — صورة وكلام وهاشتاجات جاهزين
    في «البوستات».

    لو رجّعنا فشل، المهمة بتتعاد وبتستهلك من مفتاح التاجر تاني على
    نفس البوست، والجدول بيتعلّم عليه «آخر خطأ» فالتاجر يفتكر إن
    الأداة بايظة وهي شغّالة.

    فالبوست بيستنّى، وأول ما الربط يتم بينزل. يعني التاجر بيبني
    رصيد محتوى من أول يوم بدل ما يبدأ من الصفر.
  */
  if (!s.autoPublish || s.targets.length === 0) return { ok: true }

  const res = await publishPost(s.storeId, postId)
  if (res.ok) return { ok: true }

  /*
    الفشل بيتسجّل على الجدول عشان التاجر يشوفه — بس المهمة بتنجح.
    البوست موجود، والنشر هو اللي اتأجّل.
  */
  await db
    .update(contentSchedules)
    .set({ lastError: (res.error ?? 'النشر اتأجّل').slice(0, 300), updatedAt: new Date() })
    .where(eq(contentSchedules.id, s.id))

  return { ok: true }
}
