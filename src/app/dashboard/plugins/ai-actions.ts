'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { encryptJson } from '@/lib/crypto'
import { recordAudit } from '@/lib/audit'
import { verifyKey as verifyClaude } from '@/lib/ai/claude'
import { verifyProviderKey } from '@/lib/ai/llm'
import {
  aiAllowed,
  getAiConfig,
  getClaudeConfig,
  CLAUDE_SLUG,
  GEMINI_PRO_SLUG,
  GEMINI_SLUG,
} from '@/lib/ai/settings'
import { LOCKED_MESSAGE } from '@/lib/entitlements'
import { getStoreBrief, suggestBrief } from '@/lib/ai/store-context'

/**
 * بوابة إضافات الذكاء.
 *
 * الحفظ **والتحقّق** الاتنين مقفولين. التحقّق وحده بينادي جوجل
 * وOpenAI وأنثروبيك من خادمنا — فسيبه مفتوح معناه إن غير المشترك
 * يستخدم مسارنا كوسيط لفحص مفاتيح، وده استهلاك مالوش مقابل.
 */
async function aiGate(storeId: string): Promise<{ error: string } | null> {
  return (await aiAllowed(storeId)) ? null : { error: LOCKED_MESSAGE.ai }
}

type Model = { id: string; label: string }

export type VerifyState =
  | {
      ok: true
      models: Model[]
      suggested: string
      brief: string
      /** المفتاح اتقبل بس فيه مشكلة (غالبًا الرصيد) — بيتحفظ عادي */
      warning?: string
    }
  | { ok: false; error: string }

/**
 * التحقق من مفتاح — Gemini أو ChatGPT.
 *
 * **بنداء حقيقي لا بفحص شكل المفتاح.** مفاتيح جوجل مش كلها بنفس
 * البادئة (جرّبنا مفتاحًا بادئًا بـ`AQ.` وردّ ٢٠٠)، ومفاتيح OpenAI
 * غيّرت شكلها أكتر من مرة. أي فحص بالشكل بيتحوّل مع الوقت لباب مقفول
 * في وش مفتاح سليم. **المزوّد هو اللي بيحكم على مفتاحه.**
 *
 * وبنرجّع الموديلات المتاحة **للمفتاح ده** — مش قايمة مكتوبة عندنا.
 */
export async function verifyAiKeyAction(input: {
  provider: 'gemini' | 'openai'
  apiKey: string
}): Promise<VerifyState> {
  const { store } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return { ok: false, error: gate.error }

  const key = String(input.apiKey ?? '').trim()
  if (!key) return { ok: false, error: 'الصق المفتاح الأول' }
  if (input.provider !== 'gemini' && input.provider !== 'openai') {
    return { ok: false, error: 'المزوّد مش معروف' }
  }

  const res = await verifyProviderKey(input.provider, key)
  if (!res.ok) return { ok: false, error: res.error.message }

  // اقتراح وصف المتجر — التاجر يعدّله، وموجود من الأول عشان ما يتخنقش
  const brief = await getStoreBrief(store.id)

  return {
    ok: true,
    models: res.data.models,
    suggested: res.data.suggested,
    brief: suggestBrief(brief),
    warning: res.data.warning,
  }
}

export type SaveState = { ok?: boolean; error?: string } | null

const providerEnum = z.enum(['gemini', 'openai'])

const saveSchema = z.object({
  enabled: z.boolean(),
  /** فاضي = سيب المفتاح المحفوظ زي ما هو */
  apiKey: z.string().trim().max(300).optional(),
  model: z.string().trim().max(120).optional(),
  openaiKey: z.string().trim().max(400).optional(),
  openaiModel: z.string().trim().max(120).optional(),
  /** مسح مفتاح بعينه — «فاضي» معناه سيبه، فالمسح لازم يتطلب صراحةً */
  removeKeys: z.array(providerEnum).optional(),
  botProvider: providerEnum.optional(),
  brief: z.string().trim().max(1500).optional(),
  botEnabled: z.boolean().optional(),
  botGreeting: z.string().trim().max(300).optional(),
  botDailyLimit: z.coerce.number().int().min(10).max(5000).optional(),
  botVisitorLimit: z.coerce.number().int().min(3).max(200).optional(),
})

/** المفاتيح المشفّرة — بتتكتب لو فيه واحد على الأقل */
function secretsOf(keys: { apiKey: string | null; openaiKey: string | null }) {
  const out: Record<string, string> = {}
  if (keys.apiKey) out.apiKey = keys.apiKey
  if (keys.openaiKey) out.openaiKey = keys.openaiKey
  return Object.keys(out).length ? encryptJson(out) : null
}

async function upsertPlugin(
  storeId: string,
  slug: string,
  values: { enabled: boolean; config: Record<string, unknown>; secrets: string | null },
) {
  const [existing] = await db
    .select({ id: storePlugins.id })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, slug)))
    .limit(1)

  if (existing) {
    await db.update(storePlugins).set(values).where(eq(storePlugins.id, existing.id))
  } else {
    await db.insert(storePlugins).values({ storeId, pluginSlug: slug, ...values })
  }
}

/**
 * حفظ إضافة الرد على العملاء.
 *
 * ## المفتاح الفاضي معناه «سيب اللي محفوظ» لا «امسحه»
 * الواجهة بتعرض نجوم بدل المفتاح (ما بنرجّعوش للمتصفح أبدًا)، فلو
 * الفاضي كان بيمسح، أي حفظ لإعداد تاني كان هيفقد المفاتيح. المسح
 * بزرار صريح (`removeKeys`).
 *
 * ## ومزوّد العملاء قرار التاجر
 * لو اختار ChatGPT والمفتاح ده مش موجود، الحفظ بيرفض بدل ما البوت
 * يشتغل بحاجة غير اللي اختارها.
 */
export async function saveGeminiAction(raw: unknown): Promise<SaveState> {
  const parsed = saveSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return gate

  const current = await getAiConfig(store.id, GEMINI_SLUG)
  const remove = new Set(input.removeKeys ?? [])

  const apiKey = remove.has('gemini') ? null : input.apiKey || current.apiKey
  const openaiKey = remove.has('openai') ? null : input.openaiKey || current.openaiKey

  if (input.enabled && !apiKey && !openaiKey) {
    return { error: 'محتاج مفتاح Gemini أو ChatGPT عشان تفعّلها.' }
  }

  const botProvider =
    input.botProvider ?? current.botProvider ?? (apiKey ? 'gemini' : openaiKey ? 'openai' : null)

  if (input.enabled && botProvider === 'gemini' && !apiKey) {
    return { error: 'اخترت Gemini يرد على عملائك — حط مفتاح Gemini الأول أو اختار ChatGPT.' }
  }
  if (input.enabled && botProvider === 'openai' && !openaiKey) {
    return { error: 'اخترت ChatGPT يرد على عملائك — حط مفتاح ChatGPT الأول أو اختار Gemini.' }
  }

  const config = {
    model: apiKey ? input.model || current.model : null,
    openaiModel: openaiKey ? input.openaiModel || current.openaiModel : null,
    botProvider,
    provider: current.provider,
    brief: input.brief ?? current.brief,
    botEnabled: input.botEnabled ?? current.botEnabled,
    botGreeting: input.botGreeting ?? current.botGreeting,
    botDailyLimit: input.botDailyLimit ?? current.botDailyLimit,
    botVisitorLimit: input.botVisitorLimit ?? current.botVisitorLimit,
    /* `lastIssue` بيتشال مع الحفظ: التاجر غيّر حاجة، والمشكلة القديمة ممكن تكون اتحلّت */
  }

  await upsertPlugin(store.id, GEMINI_SLUG, {
    enabled: input.enabled,
    config,
    secrets: secretsOf({ apiKey, openaiKey }),
  })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'plugin',
    resourceId: GEMINI_SLUG,
    after: {
      enabled: input.enabled,
      botEnabled: config.botEnabled,
      botProvider,
      model: config.model,
      openaiModel: config.openaiModel,
      // المفاتيح نفسها ما بتتسجّلش — سجل التدقيق بيتقرا من اللوحة
      keyChanged: Boolean(input.apiKey || input.openaiKey || remove.size),
    },
  })

  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}

const proSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().trim().max(300).optional(),
  model: z.string().trim().max(120).optional(),
  openaiKey: z.string().trim().max(400).optional(),
  openaiModel: z.string().trim().max(120).optional(),
  removeKeys: z.array(providerEnum).optional(),
  provider: providerEnum.optional(),
  brief: z.string().trim().max(1500).optional(),
})

/**
 * حفظ إعداد المساعد المنفّذ.
 *
 * ممكن يشتغل من غير مفتاح خاص بيه: بيستعير مفاتيح إضافة الرد على
 * العملاء. التاجر اللي حط مفتاحه مرة ما يصحّش نطلبه منه تاني عشان
 * يفعّل إضافة تانية على نفس الحساب.
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
  const remove = new Set(input.removeKeys ?? [])

  const apiKey = remove.has('gemini') ? null : input.apiKey || current.apiKey
  const openaiKey = remove.has('openai') ? null : input.openaiKey || current.openaiKey
  const canBorrow = Boolean(base.apiKey || base.openaiKey)

  if (input.enabled && !apiKey && !openaiKey && !canBorrow) {
    return { error: 'محتاج مفتاح Gemini أو ChatGPT — هنا أو في إضافة الرد على العملاء.' }
  }

  const config = {
    model: input.model || current.model,
    openaiModel: input.openaiModel || current.openaiModel,
    provider: input.provider ?? current.provider,
    brief: input.brief ?? current.brief,
  }

  await upsertPlugin(store.id, GEMINI_PRO_SLUG, {
    enabled: input.enabled,
    config,
    secrets: secretsOf({ apiKey, openaiKey }),
  })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'plugin',
    resourceId: GEMINI_PRO_SLUG,
    after: {
      enabled: input.enabled,
      provider: config.provider,
      model: config.model,
      openaiModel: config.openaiModel,
      keyChanged: Boolean(input.apiKey || input.openaiKey || remove.size),
    },
  })

  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}

/* ══════════════════ المصمّم ══════════════════ */

export type DesignerVerifyState =
  | { ok: true; models: Model[]; suggested: string; warning?: string }
  | { ok: false; error: string }

/**
 * التحقّق من مفتاح المصمّم — Claude أو Gemini أو ChatGPT.
 *
 * الموديلات بتتجاب من المزوّد نفسه لا من قايمة مكتوبة عندنا: أي
 * قايمة بتبقى قديمة بعد إصدار، والتاجر يلاقي موديل مذكور ومش شغّال.
 */
export async function verifyDesignerKeyAction(input: {
  provider: 'claude' | 'gemini' | 'openai'
  apiKey: string
}): Promise<DesignerVerifyState> {
  const { store } = await getDashboardContext()

  const gate = await aiGate(store.id)
  if (gate) return { ok: false, error: gate.error }

  const key = String(input.apiKey ?? '').trim()
  if (!key) return { ok: false, error: 'الصق المفتاح الأول' }

  if (input.provider === 'gemini' || input.provider === 'openai') {
    const res = await verifyProviderKey(input.provider, key)
    if (!res.ok) return { ok: false, error: res.error.message }
    return { ok: true, models: res.data.models, suggested: res.data.suggested, warning: res.data.warning }
  }

  const res = await verifyClaude(key)
  if (!res.ok) return { ok: false, error: res.error.message }
  return { ok: true, models: res.data.models, suggested: res.data.suggested }
}

const claudeSchema = z.object({
  enabled: z.boolean(),
  /** مفتاح أنثروبيك */
  apiKey: z.string().trim().max(300).optional(),
  /** مفتاح جوجل — نفس الإضافة بتقبل التلاتة */
  geminiKey: z.string().trim().max(300).optional(),
  openaiKey: z.string().trim().max(400).optional(),
  provider: z.enum(['claude', 'gemini', 'openai']).optional(),
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
  const openaiKey = input.openaiKey || current.openaiKey
  const provider = input.provider ?? current.provider
  const model = input.model || current.model

  const activeKey = provider === 'gemini' ? geminiKey : provider === 'openai' ? openaiKey : apiKey

  if (input.enabled && !activeKey) {
    return {
      error:
        provider === 'gemini'
          ? 'محتاج مفتاح Gemini عشان تفعّلها.'
          : provider === 'openai'
            ? 'محتاج مفتاح ChatGPT عشان تفعّلها.'
            : 'محتاج مفتاح Anthropic عشان تفعّلها.',
    }
  }
  if (input.enabled && !model) return { error: 'اختار الموديل الأول.' }

  const secrets: Record<string, string> = {}
  if (apiKey) secrets.apiKey = apiKey
  if (geminiKey) secrets.geminiKey = geminiKey
  if (openaiKey) secrets.openaiKey = openaiKey

  await upsertPlugin(store.id, CLAUDE_SLUG, {
    enabled: input.enabled,
    config: { model, provider },
    secrets: Object.keys(secrets).length ? encryptJson(secrets) : null,
  })

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
      keyChanged: Boolean(input.apiKey || input.geminiKey || input.openaiKey),
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
