'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, ilike, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { products, storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import {
  makeCarousel,
  makeImage,
  pollProductVideo,
  productBrief,
  startProductVideo,
  writeCopy,
} from '@/lib/studio'
import {
  createPost,
  deletePost,
  deleteSchedule,
  publishPost,
  saveSchedule,
  updatePost,
} from '@/lib/content-schedules'
import { disconnectAccount } from '@/lib/social'
import { resolveStyle, type ImageStyle, type PresetKey, type ToneKey } from '@/lib/studio-meta'

/**
 * أفعال الاستوديو.
 *
 * ## كل فعل بيفحص الإضافة والصلاحية
 * الشاشة بتخبّي الأزرار لما الإضافة مقفولة، والأفعال هي اللي بتمنع
 * النداء المباشر. والتوليد بيستهلك من مفتاح التاجر — يعني نداء
 * مباشر من غير فحص بيصرف فلوسه.
 */

async function studioContext() {
  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'marketing.manage')

  const [row] = await db
    .select({ enabled: storePlugins.enabled })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, 'studio')))
    .limit(1)

  if (!row?.enabled) throw new Error('فعّل «استوديو المحتوى» من الإضافات الأول')

  return { store, user }
}

/* ══════════════════════════════════════════════════════════════
   التوليد
   ══════════════════════════════════════════════════════════════ */

export type ImageState =
  | { ok: true; id: string; url: string; prompt: string }
  | { ok: false; error: string }

export async function generateImageAction(input: {
  prompt: string
  preset: PresetKey
  productId?: string | null
  parentId?: string | null
  useProductPhoto?: boolean
  /** شكل الصورة — الكلام المكتوب بيغلبه لو فيه شكل صريح */
  style?: ImageStyle | null
}): Promise<ImageState> {
  const { store, user } = await studioContext()

  const prompt = String(input.prompt ?? '').trim()
  if (prompt.length < 3) return { ok: false, error: 'اكتب وصفًا للصورة' }
  if (prompt.length > 1200) return { ok: false, error: 'الوصف طويل أوي' }

  /*
    صورة المنتج كأساس — للتوليد الأول بس.

    التاجر اللي عايز صورة إعلانية لمنتجه بيقصد منتجه هو لا منتجًا
    مخترعًا شبهه. والتعديل بياخد أبوه أصلًا، فتمرير صورة المنتج
    معاه كان هيرجّع الشكل للبداية في كل تعديل.
  */
  let seedUrl: string | null = null
  if (!input.parentId && input.useProductPhoto && input.productId) {
    const p = await productBrief(store.id, input.productId)
    seedUrl = p?.image ?? null
  }

  const res = await makeImage({
    storeId: store.id,
    userId: user.id,
    prompt,
    preset: input.preset,
    productId: input.productId ?? null,
    parentId: input.parentId ?? null,
    seedUrl,
    /*
      الشكل بيتحسم هنا: كلام التاجر، وبعده الاختيار.

      والتعديل مالوش شكل — «خلّي الخلفية أغمق» تعليمة على صورة موجودة.
      و`resolveStyle` بيرجّع المعروف بس، فأي نص جاي من الشبكة بيبقى «لوحده».
    */
    style: input.parentId ? null : resolveStyle(input.style, prompt),
  })

  if ('error' in res) return { ok: false, error: res.error }

  revalidatePath('/dashboard/studio')
  return { ok: true, id: res.id, url: res.url, prompt: res.prompt }
}

export type CarouselState =
  | { ok: true; images: Array<{ id: string; url: string; prompt: string }> }
  | { ok: false; error: string }

/**
 * كاروسيل — صور مترابطة في نداء واحد.
 *
 * ## بياخد وقت أطول من صورة واحدة بعدد الشرايح
 * خمس شرايح = خمس نداءات متتابعة، مش متوازية: كل واحدة محتاجة
 * اللي قبلها كمرجع عشان الشكل يفضل واحد. الشاشة بتقول ده قبل
 * الضغط عشان التاجر ما يفتكرش إنها وقفت.
 */
export async function generateCarouselAction(input: {
  prompt: string
  preset: PresetKey
  count: number
  productId?: string | null
  useProductPhoto?: boolean
  style?: ImageStyle | null
}): Promise<CarouselState> {
  const { store, user } = await studioContext()

  const prompt = String(input.prompt ?? '').trim()
  if (prompt.length < 3) return { ok: false, error: 'اكتب وصفًا للكاروسيل' }
  if (prompt.length > 1200) return { ok: false, error: 'الوصف طويل أوي' }

  let seedUrl: string | null = null
  if (input.useProductPhoto && input.productId) {
    const p = await productBrief(store.id, input.productId)
    seedUrl = p?.image ?? null
  }

  const res = await makeCarousel({
    storeId: store.id,
    userId: user.id,
    prompt,
    preset: input.preset,
    count: input.count,
    productId: input.productId ?? null,
    seedUrl,
    style: resolveStyle(input.style, prompt),
  })

  if ('error' in res) return { ok: false, error: res.error }

  revalidatePath('/dashboard/studio')
  return {
    ok: true,
    images: res.images.map((i) => ({ id: i.id, url: i.url, prompt: i.prompt })),
  }
}

export type CopyState =
  | { ok: true; hook: string; body: string; cta: string; link: string; hashtags: string[] }
  | { ok: false; error: string }

export async function generateCopyAction(input: {
  productId?: string | null
  tone: ToneKey
  extra?: string | null
}): Promise<CopyState> {
  const { store } = await studioContext()

  const res = await writeCopy({
    storeId: store.id,
    productId: input.productId ?? null,
    tone: input.tone,
    extra: input.extra ?? null,
  })

  if ('error' in res) return { ok: false, error: res.error }
  return {
    ok: true,
    hook: res.hook,
    body: res.body,
    cta: res.cta,
    link: res.link,
    hashtags: res.hashtags,
  }
}

export type VideoStartState =
  | { ok: true; operation: string }
  | { ok: false; error: string }

/**
 * بدء فيديو — بيرجّع اسم العملية والمتصفح بيسأل عليها.
 *
 * التوليد بياخد من دقيقة لتلاتة، ودالة الخادم عمرها ثواني.
 * الانتظار جوّاها كان بيموت قبل ما الفيديو يخلص — والتاجر بيدفع
 * تمن توليد ما شافوش.
 */
export async function startVideoAction(input: {
  prompt: string
  preset: PresetKey
  productId?: string | null
  useProductPhoto?: boolean
  /** صورة من الاستوديو تتحرّك — بتغلب صورة المنتج */
  seedAssetUrl?: string | null
  style?: ImageStyle | null
}): Promise<VideoStartState> {
  const { store } = await studioContext()

  const prompt = String(input.prompt ?? '').trim()
  if (prompt.length < 3) return { ok: false, error: 'اكتب وصفًا للفيديو' }
  if (prompt.length > 1200) return { ok: false, error: 'الوصف طويل أوي' }

  let seedUrl: string | null = input.seedAssetUrl?.trim() || null
  if (!seedUrl && input.useProductPhoto && input.productId) {
    const p = await productBrief(store.id, input.productId)
    seedUrl = p?.image ?? null
  }

  const res = await startProductVideo({
    storeId: store.id,
    prompt,
    preset: input.preset,
    seedUrl,
    style: resolveStyle(input.style, prompt),
  })

  if ('error' in res) return { ok: false, error: res.error }
  return { ok: true, operation: res.operation }
}

export type VideoPollState =
  | { state: 'running' }
  | { state: 'done'; id: string; url: string }
  | { state: 'failed'; error: string }

export async function checkVideoAction(input: {
  operation: string
  prompt: string
  preset: PresetKey
  productId?: string | null
}): Promise<VideoPollState> {
  const { store, user } = await studioContext()

  /*
    اسم العملية بييجي من المتصفح — والمفتاح مفتاح المتجر ده.

    أسوأ ما يحصل لو حد بعت اسم عملية مش بتاعته إن جوجل بترفضه
    (المفتاح مختلف)، فالتسريب مش وارد. والصف بيتكتب على متجره هو
    من الجلسة لا من الحمولة.
  */
  return pollProductVideo({
    storeId: store.id,
    userId: user.id,
    operation: String(input.operation ?? ''),
    prompt: String(input.prompt ?? '').slice(0, 1200),
    preset: input.preset,
    productId: input.productId ?? null,
  })
}

/* ══════════════════════════════════════════════════════════════
   البوستات
   ══════════════════════════════════════════════════════════════ */

export type SaveState = {
  ok?: true
  id?: string
  error?: string
  /** نتيجة كل حساب — الشاشة بتعلّم اللي نزل عليه واللي فشل وسببه */
  results?: Array<{ accountId: string; ok: boolean; error?: string }>
}

/** أول سبب حقيقي — «فشل» لوحدها ما بتقولش للتاجر يعمل إيه */
function firstFailure(res: { results: Array<{ ok: boolean; error?: string }>; error?: string }) {
  return res.results.find((r) => !r.ok)?.error ?? res.error ?? 'فشل النشر'
}

export async function savePostAction(input: {
  /**
   * البوست اللي اتحفظ قبل كده من نفس الشاشة.
   *
   * التاجر بيحفظ، ويعدّل الهوك، ويدوس نشر. من غير المعرّف كل ضغطة
   * كانت بتعمل بوست جديد — فيلاقي نفس البوست تلات مرات في «البوستات».
   */
  id?: string | null
  caption: string
  hashtags: string[]
  imageUrls: string[]
  videoUrl?: string | null
  productId?: string | null
  targets?: string[]
  publishNow?: boolean
}): Promise<SaveState> {
  const { store, user } = await studioContext()

  const caption = String(input.caption ?? '').trim()
  if (!caption) return { error: 'اكتب نص البوست' }
  if (input.imageUrls.length === 0 && !input.videoUrl) {
    return { error: 'محتاج صورة أو فيديو' }
  }

  const fields = {
    caption,
    hashtags: (input.hashtags ?? []).slice(0, 12),
    /* عشرة: حد الكاروسيل عند إنستجرام — الأربعة القديمة كانت بتقصّ الشرايح */
    imageUrls: input.imageUrls.slice(0, 10),
    videoUrl: input.videoUrl ?? null,
    productId: input.productId ?? null,
    targets: input.targets ?? [],
  }

  const id =
    (input.id && (await updatePost(store.id, input.id, fields))) ||
    (await createPost({ storeId: store.id, userId: user.id, ...fields, status: 'ready' }))

  if (input.publishNow) {
    if (fields.targets.length === 0) return { id, error: 'اختار الحساب اللي هتنشر عليه' }

    const res = await publishPost(store.id, id)
    revalidatePath('/dashboard/studio/posts')
    if (!res.ok) return { id, error: firstFailure(res), results: res.results }
    return { ok: true, id, results: res.results }
  }

  revalidatePath('/dashboard/studio/posts')
  return { ok: true, id }
}

/**
 * نشر بوست محفوظ.
 *
 * `targets` اختياري: البوست اللي اتحفظ من غير حسابات كان مالوش زرار
 * نشر خالص في «البوستات»، والتاجر يرجع للاستوديو يعمله من الأول.
 */
export async function publishPostAction(postId: string, targets?: string[]): Promise<SaveState> {
  const { store } = await studioContext()

  if (targets?.length) {
    const updated = await updatePost(store.id, postId, { targets: targets.slice(0, 20) })
    if (!updated) return { error: 'البوست ده اتنشر خلاص — اعمل نسخة جديدة من الاستوديو' }
  }

  const res = await publishPost(store.id, postId)
  revalidatePath('/dashboard/studio/posts')

  if (!res.ok) return { error: firstFailure(res), results: res.results }
  return { ok: true, results: res.results }
}

export async function deletePostAction(postId: string): Promise<void> {
  const { store } = await studioContext()
  await deletePost(store.id, postId)
  revalidatePath('/dashboard/studio/posts')
}

/* ══════════════════════════════════════════════════════════════
   الجدولة
   ══════════════════════════════════════════════════════════════ */

export async function saveScheduleAction(input: {
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
  autoPublish: boolean
  isActive: boolean
}): Promise<SaveState> {
  const { store, user } = await studioContext()

  /*
    النشر التلقائي محتاج وجهة.

    الجدول اللي بينشر لوحده على صفر حسابات بيولّد بوستًا كل يوم
    وبيحطّه في الطابور من غير ما ينشره — والتاجر مستنّي بوستات على
    صفحته ومش لاقي.
  */
  if (input.autoPublish && input.targets.length === 0) {
    return { error: 'اختار حسابًا واحدًا على الأقل عشان النشر التلقائي يشتغل' }
  }

  const res = await saveSchedule({
    storeId: store.id,
    userId: user.id,
    id: input.id,
    name: input.name,
    days: input.days,
    timeOfDay: input.timeOfDay,
    targets: input.targets,
    source: input.source,
    categoryId: input.categoryId,
    productIds: input.productIds,
    style: input.style,
    preset: input.preset,
    media: input.media,
    slides: input.slides,
    imageStyle: input.imageStyle,
    autoPublish: input.autoPublish,
    isActive: input.isActive,
  })

  revalidatePath('/dashboard/studio/schedules')
  return res.ok ? { ok: true, id: res.id } : { error: res.error }
}

export async function deleteScheduleAction(id: string): Promise<void> {
  const { store } = await studioContext()
  await deleteSchedule(store.id, id)
  revalidatePath('/dashboard/studio/schedules')
}

/**
 * تشغيل جدول دلوقتي — للتجربة.
 *
 * التاجر اللي ظبّط جدول لبكرة الصبح مش هيستنّى لبكرة عشان يعرف
 * الشكل. والتجربة بتكشف مشاكل المفتاح والوصف قبل ما يسيبه شغّالًا.
 */
export async function runScheduleNowAction(id: string): Promise<SaveState> {
  const { store } = await studioContext()

  const { runSchedule } = await import('@/lib/content-schedules')
  const { contentSchedules } = await import('@/db/schema')

  const [own] = await db
    .select({ id: contentSchedules.id })
    .from(contentSchedules)
    .where(and(eq(contentSchedules.id, id), eq(contentSchedules.storeId, store.id)))
    .limit(1)

  if (!own) return { error: 'الجدول مش موجود' }

  const res = await runSchedule(id)
  revalidatePath('/dashboard/studio/posts')
  revalidatePath('/dashboard/studio/schedules')
  return res.ok ? { ok: true } : { error: res.error }
}

/* ══════════════════════════════════════════════════════════════
   الحسابات والمنتجات
   ══════════════════════════════════════════════════════════════ */

export async function disconnectAccountAction(id: string): Promise<void> {
  const { store } = await studioContext()
  await disconnectAccount(store.id, id)
  revalidatePath('/dashboard/studio/accounts')
}

/** بحث المنتجات لمنتقي الاستوديو */
export async function searchProductsAction(
  q: string,
): Promise<Array<{ id: string; name: string; image: string | null }>> {
  const { store } = await studioContext()
  const term = String(q ?? '').trim()

  const rows = await db
    .select({ id: products.id, name: products.name, images: products.images })
    .from(products)
    .where(
      and(
        eq(products.storeId, store.id),
        eq(products.status, 'active'),
        isNull(products.deletedAt),
        term ? ilike(products.name, `%${term}%`) : undefined,
      ),
    )
    .orderBy(desc(products.createdAt))
    .limit(20)

  return rows.map((r) => ({ id: r.id, name: r.name, image: r.images?.[0] ?? null }))
}
