'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { encryptJson } from '@/lib/crypto'
import { recordAudit } from '@/lib/audit'
import { verifyKey, type GeminiModel } from '@/lib/ai/gemini'
import { getAiConfig, GEMINI_SLUG } from '@/lib/ai/settings'
import { getStoreBrief, suggestBrief } from '@/lib/ai/store-context'

export type VerifyState =
  | { ok: true; models: GeminiModel[]; suggested: string; brief: string }
  | { ok: false; error: string }

/**
 * التحقق من المفتاح.
 *
 * **بنداء حقيقي على جوجل لا بفحص شكل المفتاح.** مفاتيح جوجل مش كلها
 * بنفس البادئة — فيه اللي بيبدأ بـAI وفيه AQ وغيرهم، والقايمة
 * بتتغيّر. أي فحص بالشكل هيرفض مفاتيح سليمة والتاجر يفضل يحاول
 * ومش فاهم هو غلطان فين.
 *
 * وبنرجّع الموديلات المتاحة **للمفتاح ده** — مش قايمة مكتوبة عندنا
 * بتبقى قديمة بعد شهرين.
 */
export async function verifyGeminiKeyAction(apiKey: string): Promise<VerifyState> {
  const { store } = await getDashboardContext()

  const key = apiKey.trim()
  if (!key) return { ok: false, error: 'الصق المفتاح الأول' }

  const res = await verifyKey(key)
  if (!res.ok) return { ok: false, error: res.error.message }

  // اقتراح وصف المتجر — التاجر يعدّله، وموجود من الأول عشان ما يتخنقش
  const brief = await getStoreBrief(store.id)

  return {
    ok: true,
    models: res.data.models,
    suggested: res.data.suggested,
    brief: suggestBrief(brief),
  }
}

export type SaveState = { ok?: boolean; error?: string } | null

const saveSchema = z.object({
  enabled: z.boolean(),
  /** فاضي = سيب المفتاح المحفوظ زي ما هو */
  apiKey: z.string().trim().max(300).optional(),
  model: z.string().trim().max(120).optional(),
  brief: z.string().trim().max(1500).optional(),
  botEnabled: z.boolean().optional(),
  botGreeting: z.string().trim().max(300).optional(),
  botDailyLimit: z.coerce.number().int().min(10).max(5000).optional(),
  botVisitorLimit: z.coerce.number().int().min(3).max(200).optional(),
})

export async function saveGeminiAction(raw: unknown): Promise<SaveState> {
  const parsed = saveSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()
  const current = await getAiConfig(store.id, GEMINI_SLUG)

  /*
    المفتاح الفاضي معناه «سيب اللي محفوظ» لا «امسحه».
    الواجهة بتعرض نجوم بدل المفتاح (ما بنرجّعوش للمتصفح أبدًا)، فلو
    الفاضي كان بيمسح، أي حفظ لإعداد تاني كان هيفقد المفتاح.
  */
  const apiKey = input.apiKey || current.apiKey

  if (input.enabled && !apiKey) {
    return { error: 'محتاج مفتاح Gemini عشان تفعّلها.' }
  }
  if (input.enabled && !input.model && !current.model) {
    return { error: 'اختار الموديل الأول.' }
  }

  const config = {
    model: input.model || current.model,
    brief: input.brief ?? current.brief,
    botEnabled: input.botEnabled ?? current.botEnabled,
    botGreeting: input.botGreeting ?? current.botGreeting,
    botDailyLimit: input.botDailyLimit ?? current.botDailyLimit,
    botVisitorLimit: input.botVisitorLimit ?? current.botVisitorLimit,
  }

  const values = {
    enabled: input.enabled,
    config,
    secrets: apiKey ? encryptJson({ apiKey }) : null,
  }

  const [existing] = await db
    .select({ id: storePlugins.id })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, GEMINI_SLUG)))
    .limit(1)

  if (existing) {
    await db.update(storePlugins).set(values).where(eq(storePlugins.id, existing.id))
  } else {
    await db
      .insert(storePlugins)
      .values({ storeId: store.id, pluginSlug: GEMINI_SLUG, ...values })
  }

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'plugin',
    resourceId: GEMINI_SLUG,
    after: {
      enabled: input.enabled,
      botEnabled: config.botEnabled,
      model: config.model,
      // المفتاح نفسه ما بيتسجّلش — سجل التدقيق بيتقرا من اللوحة
      keyChanged: Boolean(input.apiKey),
    },
  })

  revalidatePath('/dashboard/plugins')
  return { ok: true }
}
