import 'server-only'
import { cache } from 'react'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { decryptJson } from '@/lib/crypto'
import { getEntitlements, getStoreBilling, LOCKED_MESSAGE } from '@/lib/entitlements'
import { AI_PROVIDERS, isProvider, type AiIssue, type AiProvider } from './providers-meta'

/**
 * إعدادات إضافات الذكاء الاصطناعي.
 *
 * **المفتاح في العمود المشفّر لا في config.** الـconfig بيتقرا في
 * المتصفح، ومفتاح API في المتصفح معناه إن أي زائر يقدر يستخدم رصيد
 * التاجر. الفرق ده مش تفصيلة — هو الفرق بين إضافة آمنة وثغرة.
 *
 * ## مفتاحين في كل إضافة
 * الإضافتين (الرد على العملاء، والمساعد) بيقبلوا Gemini وChatGPT مع
 * بعض أو واحد منهم. أسماء الـslug فضلت `gemini` و`gemini_pro` عن قصد:
 * هي مفاتيح صفوف موجودة عند كل التجّار، وتغييرها كان هيفصل إعداداتهم.
 */

export const GEMINI_SLUG = 'gemini'
export const GEMINI_PRO_SLUG = 'gemini_pro'

/**
 * موديل لو التاجر ما اختارش.
 *
 * بيتقال في التحقّق من المفتاح أصلًا، فده للحالة النادرة اللي المفتاح
 * اتحفظ فيها من غير موديل. والرجوع لبديل على المفتاح نفسه موجود في
 * العميلين لو الاسم ده اتشال.
 */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
}

export type AiConfig = {
  enabled: boolean
  /** مفتاح Gemini — الاسم القديم فضل عشان الصفوف المحفوظة */
  apiKey: string | null
  /** موديل Gemini */
  model: string | null
  openaiKey: string | null
  openaiModel: string | null
  /** المزوّد الافتراضي للمساعد والأدوات — التاجر بيبدّله من الشات */
  provider: AiProvider | null
  /** المزوّد اللي بيرد على عملاء المتجر — قرار التاجر لوحده */
  botProvider: AiProvider | null
  /** وصف التاجر لمتجره — بيتحط في تعليمات كل نداء */
  brief: string | null
  /** بوت المتجر مفعّل للعملاء؟ */
  botEnabled: boolean
  botGreeting: string | null
  /** حد الرسايل اليومي لكل المتجر — حماية لرصيد التاجر */
  botDailyLimit: number
  /** حد الرسايل لكل زائر في الجلسة */
  botVisitorLimit: number
  /** آخر رفض بسبب المفتاح أو الرصيد — بيتعرض في كارت الإضافة */
  lastIssue: AiIssue | null
}

const DEFAULTS: AiConfig = {
  enabled: false,
  apiKey: null,
  model: null,
  openaiKey: null,
  openaiModel: null,
  provider: null,
  botProvider: null,
  brief: null,
  botEnabled: false,
  botGreeting: null,
  botDailyLimit: 200,
  botVisitorLimit: 15,
  lastIssue: null,
}

export const getAiConfig = cache(
  async (storeId: string, slug: string = GEMINI_SLUG): Promise<AiConfig> => {
    const [row] = await db
      .select({
        enabled: storePlugins.enabled,
        config: storePlugins.config,
        secrets: storePlugins.secrets,
      })
      .from(storePlugins)
      .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, slug)))
      .limit(1)

    if (!row) return DEFAULTS

    const secrets = decryptJson<{ apiKey?: string; openaiKey?: string }>(row.secrets)
    const cfg = (row.config ?? {}) as Record<string, unknown>

    const num = (v: unknown, fallback: number) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback
    }
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
    const issue = cfg.lastIssue as Partial<AiIssue> | undefined

    return {
      enabled: row.enabled,
      apiKey: secrets?.apiKey ?? null,
      model: str(cfg.model),
      openaiKey: secrets?.openaiKey ?? null,
      openaiModel: str(cfg.openaiModel),
      provider: isProvider(cfg.provider) ? cfg.provider : null,
      botProvider: isProvider(cfg.botProvider) ? cfg.botProvider : null,
      brief: str(cfg.brief),
      botEnabled: cfg.botEnabled === true,
      botGreeting: str(cfg.botGreeting),
      botDailyLimit: num(cfg.botDailyLimit, DEFAULTS.botDailyLimit),
      botVisitorLimit: num(cfg.botVisitorLimit, DEFAULTS.botVisitorLimit),
      lastIssue:
        issue && typeof issue.message === 'string'
          ? { provider: String(issue.provider ?? ''), message: issue.message, at: String(issue.at ?? '') }
          : null,
    }
  },
)

function keyOf(cfg: AiConfig, provider: AiProvider): string | null {
  return provider === 'openai' ? cfg.openaiKey : cfg.apiKey
}

function modelOf(cfg: AiConfig, provider: AiProvider): string | null {
  return provider === 'openai' ? cfg.openaiModel : cfg.model
}

/**
 * جاهز للاستخدام؟ مفعّل + مفتاح لأي مزوّد.
 *
 * موديل Gemini كان شرطًا لوحده. دلوقتي فيه موديل افتراضي لكل مزوّد،
 * والتاجر اللي حطّ مفتاح ChatGPT بس ما ينفعش نقوله «مش جاهز».
 */
export function isReady(cfg: AiConfig): boolean {
  return cfg.enabled && Boolean(cfg.apiKey || cfg.openaiKey)
}

/**
 * المساعد المنفّذ جاهز للاستخدام؟
 *
 * «مفعّل» لوحدها مش كفاية: التاجر ممكن يدوس المفتاح قبل ما يحط
 * مفتاح. لو عرضنا أيقونة الشات ساعتها، بيفتحها ويكتب سؤالًا ويستنّى —
 * والرد الوحيد اللي بييجي رسالة خطأ. الأيقونة لازم تظهر لما تبقى
 * **شغّالة**.
 *
 * ولو المساعد مالوش مفتاح خاص، بيستعير مفتاح إضافة الرد على العملاء —
 * نفس المنطق اللي في `resolveEngines` بالظبط، عشان اللي بيظهر يبقى
 * هو اللي بيشتغل.
 */
export async function isAssistantReady(storeId: string): Promise<boolean> {
  /*
    ترتيب الفحوص مقصود: الأرخص الأول.

    `aiAllowed` بيسأل قاعدة البيانات مرتين، والدالة دي بتتنادى في
    تخطيط اللوحة مع **كل** صفحة. و`getAiConfig` مغلّفة بـcache.
  */
  const pro = await getAiConfig(storeId, GEMINI_PRO_SLUG)
  if (!pro.enabled) return false

  if (!(await aiAllowed(storeId))) return false

  if (pro.apiKey || pro.openaiKey) return true

  const base = await getAiConfig(storeId, GEMINI_SLUG)
  return Boolean(base.apiKey || base.openaiKey)
}

/* ══════════════════ اختيار المحرّك ══════════════════ */

/**
 * محرّك جاهز للنداء: مزوّد + مفتاح + موديل.
 *
 * `slug` و`issue` عشان نتيجة النداء تتسجّل على الإضافة اللي المفتاح
 * جاي منها — «مالوش رصيد» لازم تبان في الكارت الصح.
 */
export type Engine = {
  provider: AiProvider
  apiKey: string
  model: string
  storeId: string
  slug: string
  /** رسالة آخر مشكلة محفوظة — عشان ما نكتبش نفس المشكلة مع كل رسالة */
  issue: string | null
}

export type EngineResolution =
  | {
      ok: true
      engine: Engine
      /** بدايل لما الرصيد يخلص — البوت بيستخدمها عشان ما يقفش قدام عميل */
      fallbacks: Engine[]
      /** المزوّدين اللي ليهم مفتاح — الواجهة بتعرض التبديل لما يبقوا اتنين */
      available: AiProvider[]
    }
  | { ok: false; error: string; needsSetup: boolean }

function engineFrom(
  storeId: string,
  provider: AiProvider,
  sources: Array<{ slug: string; cfg: AiConfig }>,
): Engine | null {
  const owner = sources.find((s) => keyOf(s.cfg, provider))
  if (!owner) return null

  /* موديل صاحب المفتاح الأول، وبعده أي موديل محفوظ لنفس المزوّد */
  const model =
    modelOf(owner.cfg, provider) ??
    sources.map((s) => modelOf(s.cfg, provider)).find(Boolean) ??
    DEFAULT_MODELS[provider]

  return {
    provider,
    apiKey: keyOf(owner.cfg, provider)!,
    model,
    storeId,
    slug: owner.slug,
    issue: owner.cfg.lastIssue?.message ?? null,
  }
}

/**
 * المحرّك اللي هيتنفّذ بيه.
 *
 * - **`bot`**: بوت المتجر. المفتاح من إضافة الرد على العملاء، والمزوّد
 *   اللي التاجر اختاره للعملاء. والبدايل: مفتاح المساعد لنفس المزوّد،
 *   وبعدين المزوّد التاني — المتجر ما يصحّش يقف قدام عميل عشان رصيد.
 * - **`tools`**: المساعد وتحسين النصوص و«حدّد واسأل» والاستوديو.
 *   مفتاح المساعد الأول وبعده مفتاح البوت، والمزوّد اللي التاجر اختاره
 *   آخر مرة في الشات.
 *
 * `prefer` اختيار لحظي (من الشات أو الاستوديو) بيغلب المحفوظ لو ليه مفتاح.
 */
export async function resolveEngines(
  storeId: string,
  purpose: 'bot' | 'tools',
  prefer?: string | null,
): Promise<EngineResolution> {
  if (!(await aiAllowed(storeId))) {
    return { ok: false, error: LOCKED_MESSAGE.ai, needsSetup: false }
  }

  const [base, pro] = await Promise.all([
    getAiConfig(storeId, GEMINI_SLUG),
    getAiConfig(storeId, GEMINI_PRO_SLUG),
  ])

  const baseSrc = { slug: GEMINI_SLUG, cfg: base }
  const proSrc = { slug: GEMINI_PRO_SLUG, cfg: pro }
  const primarySources = purpose === 'bot' ? [baseSrc] : [proSrc, baseSrc]

  const available = AI_PROVIDERS.map((p) => p.key).filter((p) =>
    primarySources.some((s) => keyOf(s.cfg, p)),
  )

  if (available.length === 0) {
    return {
      ok: false,
      error:
        purpose === 'bot'
          ? 'البوت محتاج مفتاح Gemini أو ChatGPT في إضافة الرد على العملاء.'
          : 'محتاج مفتاح Gemini أو ChatGPT من صفحة الإضافات الأول.',
      needsSetup: true,
    }
  }

  const saved = purpose === 'bot' ? base.botProvider : (pro.provider ?? base.provider)
  const wanted = [prefer, saved].find((p): p is AiProvider => isProvider(p) && available.includes(p))
  const chosen = wanted ?? available[0]
  const other: AiProvider = chosen === 'gemini' ? 'openai' : 'gemini'

  const engine = engineFrom(storeId, chosen, primarySources)!

  const candidates =
    purpose === 'bot'
      ? [
          engineFrom(storeId, chosen, [proSrc]),
          engineFrom(storeId, other, [baseSrc]),
          engineFrom(storeId, other, [proSrc]),
        ]
      : [engineFrom(storeId, other, primarySources)]

  const seen = new Set([engine.provider + engine.apiKey])
  const fallbacks = candidates.filter((e): e is Engine => {
    if (!e || seen.has(e.provider + e.apiKey)) return false
    seen.add(e.provider + e.apiKey)
    return true
  })

  return { ok: true, engine, fallbacks, available }
}

/* ══════════════════ مشاكل الحساب ══════════════════ */

const ACCOUNT_PROBLEMS = new Set(['invalid_key', 'quota', 'no_credit', 'credit'])

/**
 * تسجيل مشكلة الحساب على الإضافة.
 *
 * ## ليه بتتسجّل
 * البوت بيرد على العميل «كلّمنا على واتساب» لما الرصيد يخلص — والتاجر
 * ما بيعرفش إن بوته واقف لحد ما يلاحظ إن محدش بيسأله. المشكلة بتتكتب
 * على الإضافة وبتظهر في كارتها بالجملة الحقيقية ومكان الشحن.
 *
 * بدمج JSON على العمود لا بإعادة كتابته: الحفظ من الكارت في نفس
 * اللحظة ما يصحّش يتمسح.
 */
export async function recordAiIssue(
  storeId: string,
  slug: string,
  provider: string,
  message: string,
): Promise<void> {
  const patch = JSON.stringify({ lastIssue: { provider, message, at: new Date().toISOString() } })
  await db
    .update(storePlugins)
    .set({ config: sql`coalesce(${storePlugins.config}, '{}'::jsonb) || ${patch}::jsonb` })
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, slug)))
    .catch(() => {
      /* التسجيل ما يصحّش يوقّع الرد نفسه */
    })
}

async function clearAiIssue(storeId: string, slug: string): Promise<void> {
  await db
    .update(storePlugins)
    .set({ config: sql`${storePlugins.config} - 'lastIssue'` })
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, slug)))
    .catch(() => {})
}

/**
 * نتيجة نداء على حساب الإضافة.
 *
 * بيكتب بس لما الحالة تتغيّر: نفس المشكلة المسجّلة ما بتتكتبش تاني مع
 * كل رسالة عميل، والنجاح بيمسح المشكلة بس لو فيه واحدة محفوظة.
 */
export async function noteAiOutcome(
  /* `provider` نص لا `AiProvider`: المصمّم بيسجّل Claude كمان */
  engine: { storeId: string; slug: string; provider: string; issue: string | null },
  res: { ok: true } | { ok: false; error: { kind: string; message: string } },
): Promise<void> {
  if (!engine.storeId || !engine.slug) return

  if (!res.ok) {
    if (!ACCOUNT_PROBLEMS.has(res.error.kind) || engine.issue === res.error.message) return
    await recordAiIssue(engine.storeId, engine.slug, engine.provider, res.error.message)
    return
  }

  if (engine.issue) await clearAiIssue(engine.storeId, engine.slug)
}

/* ══════════════════ المصمّم ══════════════════ */

export const CLAUDE_SLUG = 'claude'

export type DesignerProviderKey = 'claude' | 'gemini' | 'openai'

export type ClaudeConfig = {
  enabled: boolean
  /** مفتاح أنثروبيك */
  apiKey: string | null
  /** مفتاح جوجل — نفس الإضافة بتقبل التلاتة */
  geminiKey: string | null
  /** مفتاح OpenAI */
  openaiKey: string | null
  /** مين هيولّد */
  provider: DesignerProviderKey
  model: string | null
  lastIssue: AiIssue | null
}

export const getClaudeConfig = cache(async (storeId: string): Promise<ClaudeConfig> => {
  const [row] = await db
    .select({
      enabled: storePlugins.enabled,
      config: storePlugins.config,
      secrets: storePlugins.secrets,
    })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, CLAUDE_SLUG)))
    .limit(1)

  if (!row) {
    return {
      enabled: false,
      apiKey: null,
      geminiKey: null,
      openaiKey: null,
      provider: 'claude',
      model: null,
      lastIssue: null,
    }
  }

  const secrets = decryptJson<{ apiKey?: string; geminiKey?: string; openaiKey?: string }>(row.secrets)
  const cfg = (row.config ?? {}) as Record<string, unknown>
  const issue = cfg.lastIssue as Partial<AiIssue> | undefined

  const provider: DesignerProviderKey =
    cfg.provider === 'gemini' ? 'gemini' : cfg.provider === 'openai' ? 'openai' : 'claude'

  return {
    enabled: row.enabled,
    apiKey: secrets?.apiKey ?? null,
    geminiKey: secrets?.geminiKey ?? null,
    openaiKey: secrets?.openaiKey ?? null,
    provider,
    model: typeof cfg.model === 'string' ? cfg.model : null,
    lastIssue:
      issue && typeof issue.message === 'string'
        ? { provider: String(issue.provider ?? ''), message: issue.message, at: String(issue.at ?? '') }
        : null,
  }
})

/** المفتاح اللي هيتنفّذ بيه فعلًا — حسب المزوّد المختار */
export function designerKey(cfg: ClaudeConfig): string | null {
  return cfg.provider === 'gemini' ? cfg.geminiKey : cfg.provider === 'openai' ? cfg.openaiKey : cfg.apiKey
}

/**
 * المصمّم جاهز؟
 *
 * مفعّل + مفتاح للمزوّد المختار + موديل. التاجر اللي حطّ مفتاح
 * كلود واختار موديل جيميني (أو العكس) مش جاهز — والزرار اللي
 * بيظهر وبيرد بخطأ أسوأ من زرار مش موجود.
 */
export function isClaudeReady(cfg: ClaudeConfig): boolean {
  return cfg.enabled && Boolean(designerKey(cfg)) && Boolean(cfg.model)
}

/**
 * الذكاء الاصطناعي مسموح للمتجر ده؟
 *
 * ## ليه الفحص هنا لا في كل شاشة
 * أدوات الذكاء ليها ٧ مداخل: الإضافات، زرار التحسين، فقاعة «حدّد
 * واسأل»، مساعد اللوحة، مصمّم الثيمات، مولّد صفحات الهبوط، وبوت
 * المتجر للزوار. لو كل مدخل حسب الشرط بنفسه، أول واحد يتنسي بيفضل
 * مفتوحًا — وميزة مقفولة من ٦ أبواب ومفتوحة من السابع مش مقفولة.
 *
 * والشرط الاشتراك لا الحساب: أي تاجر مشترك أو في تجربته بيشوف نفس
 * اللي حساب الإدارة شايفه.
 *
 * مغلّفة بـcache زي باقي قرّاء الإعدادات، فما بتزوّدش رحلة على الطلب.
 */
export const aiAllowed = cache(async (storeId: string): Promise<boolean> => {
  const billing = await getStoreBilling(storeId)
  if (!billing) return false
  const ent = await getEntitlements(billing)
  return ent.features.ai
})
