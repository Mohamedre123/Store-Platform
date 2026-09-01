'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { encryptJson } from '@/lib/crypto'
import { recordAudit } from '@/lib/audit'
import { verifyKey, type GeminiModel } from '@/lib/ai/gemini'
import { verifyKey as verifyClaude } from '@/lib/ai/claude'
import {
  aiAllowed,
  getAiConfig,
  getClaudeConfig,
  CLAUDE_SLUG,
  GEMINI_PRO_SLUG,
  GEMINI_SLUG,
} from '@/lib/ai/settings'
import { LOCKED_MESSAGE } from '@/lib/entitlements'

/**
 * بوابة إضافات الذكاء.
 *
 * الحفظ **والتحقّق** الاتنين مقفولين. التحقّق وحده بينادي جوجل
 * وأنثروبيك من خادمنا — فسيبه مفتوح معناه إن غير المشترك يستخدم
 * مسارنا كوسيط لفحص مفاتيح، وده استهلاك على حسابنا مالوش مقابل.
 */
async function aiGate(storeId: string): Promise<{ error: string } | null> {
  return (await aiAllowed(storeId)) ? null : { error: LOCKED_MESSAGE.ai }
}
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

  const gate = await aiGate(store.id)
  if (gate) return { ok: false, error: gate.error }

  const key = apiKey.trim()
  if (!key) return { ok: false, error: 'الصق المفتاح الأول' }

  /*
    **مفيش فحص على شكل المفتاح.**

    حطّينا فحصًا بيرفض أي مفتاح مش بادئ بـ`AIza`، على أساس إن ده شكل
    مفاتيح Google AI Studio. وده كان غلط: جرّبنا مفتاحًا بادئًا بـ`AQ.`
    على نفس الواجهة وردّ ٢٠٠ في ٤٥٧ مللي.

    جوجل بتصدر أكتر من شكل، والأشكال بتتغيّر. وأي فحص بنكتبه على الشكل
    بيتحوّل مع الوقت لباب مقفول في وش مفتاح سليم — والتاجر بيقف مش
    فاهم، والسبب حاجة إحنا اخترعناها.

    **جوجل هي اللي بتحكم على مفتاحها**: بنبعته وناخد ردّها.
  */
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

  const gate = await aiGate(store.id)
  if (gate) return gate

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

const proSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().trim().max(300).optional(),
  model: z.string().trim().max(120).optional(),
  brief: z.string().trim().max(1500).optional(),
})

/**
 * حفظ إعداد المساعد المنفّذ.
 *
 * ممكن يشتغل من غير مفتاح خاص بيه: بيستعير مفتاح Gemini العادي.
 * التاجر اللي حط مفتاحه مرة ما يصحّش نطلبه منه تاني عشان يفعّل
 * إضافة تانية على نفس الحساب.
 */
export async function saveGeminiProAction(raw: unknown): Promise<SaveState> {
  const parsed = proSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return gate

  const current = await getAiConfig(store.id, GEMINI_PRO_SLUG)
  const base = await getAiConfig(store.id, GEMINI_SLUG)

  const apiKey = input.apiKey || current.apiKey
  const canBorrow = Boolean(base.apiKey && (input.model || current.model || base.model))

  if (input.enabled && !apiKey && !canBorrow) {
    return { error: 'محتاج مفتاح Gemini — هنا أو في الإضافة العادية.' }
  }

  const values = {
    enabled: input.enabled,
    config: {
      model: input.model || current.model,
      brief: input.brief ?? current.brief,
    },
    secrets: apiKey ? encryptJson({ apiKey }) : null,
  }

  const [existing] = await db
    .select({ id: storePlugins.id })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, GEMINI_PRO_SLUG)))
    .limit(1)

  if (existing) {
    await db.update(storePlugins).set(values).where(eq(storePlugins.id, existing.id))
  } else {
    await db
      .insert(storePlugins)
      .values({ storeId: store.id, pluginSlug: GEMINI_PRO_SLUG, ...values })
  }

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'plugin',
    resourceId: GEMINI_PRO_SLUG,
    after: { enabled: input.enabled, model: values.config.model, keyChanged: Boolean(input.apiKey) },
  })

  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}

/* ══════════════════ Claude ══════════════════ */

export type ClaudeVerifyState =
  | { ok: true; models: Array<{ id: string; label: string }>; suggested: string }
  | { ok: false; error: string }

/**
 * التحقق من مفتاح Anthropic.
 *
 * بنداء حقيقي زي Gemini. مفاتيحهم بتبدأ بـ`sk-ant-` غالبًا، لكن
 * الاعتماد على الشكل بيرفض أي صيغة جديدة والتاجر يفضل يحاول ومش فاهم.
 */
/**
 * التحقّق من مفتاح المصمّم — كلود أو جيميني.
 *
 * الموديلات بتتجاب من المزوّد نفسه لا من قايمة مكتوبة عندنا: أي
 * قايمة بتبقى قديمة بعد إصدار، والتاجر يلاقي موديل مذكور ومش شغّال.
 */
export async function verifyDesignerKeyAction(input: {
  provider: 'claude' | 'gemini'
  apiKey: string
}): Promise<ClaudeVerifyState> {
  const { store } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return { ok: false, error: gate.error }

  const key = input.apiKey.trim()
  if (!key) return { ok: false, error: 'الصق المفتاح الأول' }

  if (input.provider === 'gemini') {
    const res = await verifyKey(key)
    if (!res.ok) return { ok: false, error: res.error.message }
    return { ok: true, models: res.data.models, suggested: res.data.suggested }
  }

  const res = await verifyClaude(key)
  if (!res.ok) return { ok: false, error: res.error.message }
  return { ok: true, models: res.data.models, suggested: res.data.suggested }
}

export async function verifyClaudeKeyAction(apiKey: string): Promise<ClaudeVerifyState> {
  const { store } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return { ok: false, error: gate.error }

  const key = apiKey.trim()
  if (!key) return { ok: false, error: 'الصق المفتاح الأول' }

  const res = await verifyClaude(key)
  if (!res.ok) return { ok: false, error: res.error.message }

  return { ok: true, models: res.data.models, suggested: res.data.suggested }
}

const claudeSchema = z.object({
  enabled: z.boolean(),
  /** مفتاح أنثروبيك */
  apiKey: z.string().trim().max(300).optional(),
  /** مفتاح جوجل — نفس الإضافة بتقبل الاتنين */
  geminiKey: z.string().trim().max(300).optional(),
  provider: z.enum(['claude', 'gemini']).optional(),
  model: z.string().trim().max(120).optional(),
})

export async function saveClaudeAction(raw: unknown): Promise<SaveState> {
  const parsed = claudeSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return gate

  const current = await getClaudeConfig(store.id)

  /*
    الفاضي معناه «سيب المحفوظ» لا «امسحه».
    الواجهة بتعرض نجوم بدل المفتاح، فلو الفاضي كان بيمسح، أي حفظ
    لتغيير الموديل كان هيفقد المفاتيح.
  */
  const apiKey = input.apiKey || current.apiKey
  const geminiKey = input.geminiKey || current.geminiKey
  const provider = input.provider ?? current.provider
  const model = input.model || current.model

  const activeKey = provider === 'gemini' ? geminiKey : apiKey

  if (input.enabled && !activeKey) {
    return {
      error:
        provider === 'gemini'
          ? 'محتاج مفتاح Gemini عشان تفعّلها.'
          : 'محتاج مفتاح Anthropic عشان تفعّلها.',
    }
  }
  if (input.enabled && !model) return { error: 'اختار الموديل الأول.' }

  const secrets: Record<string, string> = {}
  if (apiKey) secrets.apiKey = apiKey
  if (geminiKey) secrets.geminiKey = geminiKey

  const values = {
    enabled: input.enabled,
    config: { model, provider },
    secrets: Object.keys(secrets).length ? encryptJson(secrets) : null,
  }

  const [existing] = await db
    .select({ id: storePlugins.id })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, CLAUDE_SLUG)))
    .limit(1)

  if (existing) {
    await db.update(storePlugins).set(values).where(eq(storePlugins.id, existing.id))
  } else {
    await db.insert(storePlugins).values({ storeId: store.id, pluginSlug: CLAUDE_SLUG, ...values })
  }

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'plugin',
    resourceId: CLAUDE_SLUG,
    after: {
      enabled: input.enabled,
      provider,
      model,
      keyChanged: Boolean(input.apiKey || input.geminiKey),
    },
  })

  revalidatePath('/dashboard/plugins')
  revalidatePath('/dashboard/storefront')
  return { ok: true }
}

/* ────────────────────── تحديث معلومات المساعد ────────────────────── */

export type RefreshBriefState =
  | { ok: true; brief: string }
  | { ok: false; error: string }

/**
 * بيعيد بناء «نبذة المتجر» من بيانات المتجر الحالية.
 *
 * ## المشكلة اللي بيحلّها
 * النبذة كانت بتتولّد **مرة واحدة** — لحظة ما التاجر يتحقّق من مفتاحه —
 * وبتتخزّن في إعدادات الإضافة. وبعدها بتفضل زي ما هي مهما اتغيّر
 * المتجر: التاجر يشيل الشحن المجاني، ويضيف أقسام، ويغيّر أسعاره —
 * والمساعد لسه بيقول كلام الشهر اللي فات.
 *
 * والعميل بيسمع الكلام ده على إنه من المتجر، فبيبني عليه قرار شرا.
 * نبذة قديمة مش تفصيلة شكلية — دي معلومة غلط بتتقال باسم التاجر.
 *
 * ## ليه زرار لا تحديث تلقائي
 * النبذة نص التاجر بيقدر يعدّله بإيده ويزوّد عليه («بنشحن للإسكندرية
 * في يوم»). التحديث التلقائي كان هيمسح كلامه كل ما يضيف منتج.
 * الزرار بيخلّي القرار قراره: يدوس لما يبقى غيّر حاجة مهمة.
 *
 * ## وبيخدم المساعدين الاتنين
 * مساعد المتجر (اللي بيكلّم العميل) ومساعد اللوحة (اللي بيكلّم التاجر)
 * بيقروا من نفس النبذة — فضغطة واحدة بتظبّط الاتنين.
 */
export async function refreshAiBriefAction(): Promise<RefreshBriefState> {
  try {
    const { store } = await getDashboardContext()

    /*
      البيانات الحيّة لا المخزَّنة: `getStoreBrief` بتقرا المنتجات
      والأقسام والأسعار والشحن من القاعدة في اللحظة دي.
    */
    const fresh = suggestBrief(await getStoreBrief(store.id))

    /*
      كل مساعدين المتجر مع بعض.

      مساعد المتجر (اللي بيكلّم العميل) ومساعد اللوحة (اللي بيكلّم
      التاجر) بيقروا من نبذتين مخزَّنتين في إضافتين مختلفتين. تحديث
      واحدة وسيبان التانية معناه إن نُصّ المساعدين لسه بيقول كلامًا
      قديمًا — والتاجر مش هيعرف أنهي واحد فيهم.
    */
    const rows = await db
      .select({ slug: storePlugins.pluginSlug, config: storePlugins.config })
      .from(storePlugins)
      .where(
        and(
          eq(storePlugins.storeId, store.id),
          inArray(storePlugins.pluginSlug, ['gemini', 'gemini_pro', 'claude']),
        ),
      )

    if (rows.length === 0) return { ok: false, error: 'فعّل مساعد الذكاء الأول.' }

    for (const row of rows) {
      await db
        .update(storePlugins)
        .set({ config: { ...((row.config ?? {}) as Record<string, unknown>), brief: fresh } })
        .where(
          and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, row.slug)),
        )
    }

    revalidatePath('/dashboard/plugins')
    return { ok: true, brief: fresh }
  } catch (e) {
    console.error('فشل تحديث نبذة المساعد:', e)
    return { ok: false, error: 'حصلت مشكلة وإحنا بنحدّث. جرّب تاني.' }
  }
}
