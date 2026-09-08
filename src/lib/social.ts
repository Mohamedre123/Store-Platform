import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { socialAccounts } from '@/db/schema'
import {
  listConnected,
  profileFor,
  providerConfigured,
  publishViaProvider,
  type ProviderAccount,
} from './social-provider'
import type { SocialPlatform } from './studio-meta'

/**
 * النشر على السوشيال — عن طريق خدمة النشر.
 *
 * ## ليه خدمة واحدة بدل الربط المباشر
 * الربط المباشر بميتا وتيك توك كان مكتوبًا وشغّالًا، وانشال. مش
 * لأنه غلط — لأن **تشغيله** بيحتاج: تطبيق مطوّر لكل منصة، وتأكيد
 * ملكية دومين، وتوثيق نشاط تجاري بسجل ضريبي، ومراجعة بفيديو. ده
 * أسابيع من الشغل الإداري قبل أول بوست، وكل محطة فيهم بتوقف.
 *
 * وخدمة النشر عندها الموافقات دي كلها. بنبعتلها الصورة والكلام وهي
 * بتنشر — **ونفس النتيجة بالظبط عند عميل التاجر**.
 *
 * ## والأتمتة شغّالة قبل الربط
 * الجدول بيولّد الصور والكلام في ميعاده مهما كان، والبوست بيستنّى
 * في «البوستات». أول ما الخدمة تتفعّل، اللي مستنّي بينزل. يعني
 * التاجر بيبني رصيد محتوى من أول يوم بدل ما يبدأ من الصفر.
 *
 * ## واللي اتشال موجود في السجل
 * لو احتجناه تاني (لما العدد يكبر والاشتراك يبقى أغلى من
 * المراجعة)، الكود في تاريخ git — مش محتاج يتكتب من الأول.
 *
 * ## واللي مش بنعمله
 * مفيش أي أداة بتشتغل بباسورد التاجر. دي بتوقّع حسابه في الحظر،
 * ومعناها إننا بنخزّن باسووردات التجّار عندنا.
 */

export type SocialResult<T> = { ok: true; data: T } | { ok: false; error: string }

/* ══════════════════════════════════════════════════════════════
   المتاح
   ══════════════════════════════════════════════════════════════ */

/**
 * المنصات المتاحة.
 *
 * القايمة ثابتة لأن الخدمة بتغطّي التلاتة. اللي بيتغيّر هو إن
 * التاجر ربط حسابه ولا لأ — ودي بتتقرا من `listAccounts`.
 */
export function availablePlatforms(): SocialPlatform[] {
  return providerConfigured() ? ['facebook', 'instagram', 'tiktok'] : []
}

/** خدمة النشر مضبوطة على المنصة؟ */
export function publishingEnabled(): boolean {
  return providerConfigured()
}

/* ══════════════════════════════════════════════════════════════
   الحسابات
   ══════════════════════════════════════════════════════════════ */

/**
 * حفظ حساب — أو تحديثه لو مربوط قبل كده.
 *
 * إعادة الربط بتحصل كتير (التاجر بيغيّر صفحته، أو بيفصل ويربط
 * تاني). الصف الجديد في كل مرة كان بيسيب حسابات ميتة في القايمة،
 * والتاجر يجدول على واحد منهم ويستنّى بوست ما بينزلش.
 */
export async function saveAccount(input: {
  storeId: string
  userId: string
  account: ProviderAccount
}): Promise<void> {
  const values = {
    name: input.account.name,
    avatar: input.account.avatar,
    /*
      مفيش توكن بيوصلنا — الخدمة ماسكاه.

      والعمود `notNull`، فبنحط علامة واضحة بدل نص فاضي بيبان توكنًا
      مكسورًا لأي حد بيقرا الجدول بعدين.
    */
    accessToken: 'provider',
    canPublish: true,
    status: 'active' as const,
    lastError: null,
    provider: 'uploadpost' as const,
    providerProfile: profileFor(input.storeId),
    updatedAt: new Date(),
  }

  await db
    .insert(socialAccounts)
    .values({
      storeId: input.storeId,
      platform: input.account.platform,
      externalId: input.account.externalId,
      connectedBy: input.userId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.storeId, socialAccounts.platform, socialAccounts.externalId],
      set: values,
    })
}

export type ConnectedAccount = {
  id: string
  platform: SocialPlatform
  name: string
  avatar: string | null
  canPublish: boolean
  provider: 'direct' | 'uploadpost'
  status: 'active' | 'expired' | 'revoked'
  lastError: string | null
  expiresAt: Date | null
}

export async function listAccounts(storeId: string): Promise<ConnectedAccount[]> {
  return db
    .select({
      id: socialAccounts.id,
      platform: socialAccounts.platform,
      name: socialAccounts.name,
      avatar: socialAccounts.avatar,
      canPublish: socialAccounts.canPublish,
      provider: socialAccounts.provider,
      status: socialAccounts.status,
      lastError: socialAccounts.lastError,
      expiresAt: socialAccounts.expiresAt,
    })
    .from(socialAccounts)
    .where(eq(socialAccounts.storeId, storeId))
    .orderBy(socialAccounts.platform)
}

export async function disconnectAccount(storeId: string, id: string): Promise<void> {
  await db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.id, id), eq(socialAccounts.storeId, storeId)))
}

/**
 * مزامنة اللي اتربط عند الخدمة.
 *
 * صفحة الربط ما بتردّش التاجر لعندنا، فمفيش رابط رجوع نستقبله.
 * بنقرا الحالة الحقيقية بدل ما نصدّق أي إشارة — التاجر ممكن يكون
 * قفل الصفحة في نصّها.
 */
export async function syncAccounts(
  storeId: string,
  userId: string,
): Promise<SocialResult<number>> {
  const found = await listConnected(storeId)
  if (!found.ok) return found

  for (const account of found.data) {
    await saveAccount({ storeId, userId, account })
  }

  return { ok: true, data: found.data.length }
}

/* ══════════════════════════════════════════════════════════════
   النشر
   ══════════════════════════════════════════════════════════════ */

export type PublishOutcome = { accountId: string; ok: boolean; externalId?: string; error?: string }

/**
 * نشر بوست على حساب.
 *
 * ## الفيديو بيغلب الصورة
 * البوست اللي فيه فيديو هو فيديو، والصورة معاه بتبقى غلاف لا محتوى
 * تاني. ونشر الاتنين كان بيطلّع بوستين على نفس الصفحة.
 *
 * ## والفشل بيتسجّل على الحساب
 * التاجر بيفتح شاشة الحسابات لما بوست ما ينزلش، والسبب لازم يبقى
 * جنب الحساب — «الربط انتهى» بتقوله يعمل إيه، و«فشل النشر» بتخلّيه
 * يسأل.
 */
export async function publishToAccount(
  storeId: string,
  accountId: string,
  post: { caption: string; hashtags: string[]; imageUrls?: string[]; videoUrl?: string | null },
): Promise<PublishOutcome> {
  const [acc] = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.storeId, storeId)))
    .limit(1)

  if (!acc) return { accountId, ok: false, error: 'الحساب مش موجود' }
  if (acc.status !== 'active') return { accountId, ok: false, error: 'الربط انتهى — اربط تاني' }

  const video = post.videoUrl?.trim() || null
  const images = (post.imageUrls ?? []).map((u) => u.trim()).filter(Boolean)

  if (!video && images.length === 0) {
    return { accountId, ok: false, error: 'البوست من غير صورة ولا فيديو' }
  }

  /* الهاشتاجات آخر النص — كل المنصات بتقراها كده */
  const caption = [post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n')

  const res = await publishViaProvider({
    storeId,
    platform: acc.platform,
    caption,
    mediaUrls: video ? [video] : images,
    isVideo: Boolean(video),
  })

  if (!res.ok) {
    await markError(acc.id, res.error)
    return { accountId, ok: false, error: res.error }
  }

  return { accountId, ok: true, externalId: res.data }
}

async function markError(accountId: string, error: string): Promise<void> {
  /* الأخطاء اللي معناها «اربط تاني» بتقفل الحساب عشان الجدول يبطّل يحاول */
  const expired = /expired|reconnect|انتهى|اربطه|مش مربوط/i.test(error)

  await db
    .update(socialAccounts)
    .set({
      lastError: error.slice(0, 300),
      status: expired ? 'expired' : 'active',
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.id, accountId))
    .catch(() => {
      /* التسجيل نفسه ما يصحّش يوقّع النشر */
    })
}
