import 'server-only'
import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { decryptJson } from '@/lib/crypto'

/**
 * إعدادات إضافات الذكاء الاصطناعي.
 *
 * **المفتاح في العمود المشفّر لا في config.** الـconfig بيتقرا في
 * المتصفح، ومفتاح API في المتصفح معناه إن أي زائر يقدر يستخدم رصيد
 * التاجر. الفرق ده مش تفصيلة — هو الفرق بين إضافة آمنة وثغرة.
 */

export const GEMINI_SLUG = 'gemini'
export const GEMINI_PRO_SLUG = 'gemini_pro'

export type AiConfig = {
  enabled: boolean
  apiKey: string | null
  model: string | null
  /** وصف التاجر لمتجره — بيتحط في تعليمات كل نداء */
  brief: string | null
  /** بوت المتجر مفعّل للعملاء؟ */
  botEnabled: boolean
  botGreeting: string | null
  /** حد الرسايل اليومي لكل المتجر — حماية لرصيد التاجر */
  botDailyLimit: number
  /** حد الرسايل لكل زائر في الجلسة */
  botVisitorLimit: number
}

const DEFAULTS: AiConfig = {
  enabled: false,
  apiKey: null,
  model: null,
  brief: null,
  botEnabled: false,
  botGreeting: null,
  botDailyLimit: 200,
  botVisitorLimit: 15,
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

    const secrets = decryptJson<{ apiKey?: string }>(row.secrets)
    const cfg = row.config as Record<string, unknown>

    const num = (v: unknown, fallback: number) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback
    }

    return {
      enabled: row.enabled,
      apiKey: secrets?.apiKey ?? null,
      model: typeof cfg.model === 'string' ? cfg.model : null,
      brief: typeof cfg.brief === 'string' ? cfg.brief : null,
      botEnabled: cfg.botEnabled === true,
      botGreeting: typeof cfg.botGreeting === 'string' ? cfg.botGreeting : null,
      botDailyLimit: num(cfg.botDailyLimit, DEFAULTS.botDailyLimit),
      botVisitorLimit: num(cfg.botVisitorLimit, DEFAULTS.botVisitorLimit),
    }
  },
)

/** جاهز للاستخدام؟ مفعّل + مفتاح + موديل */
export function isReady(cfg: AiConfig): cfg is AiConfig & { apiKey: string; model: string } {
  return cfg.enabled && Boolean(cfg.apiKey) && Boolean(cfg.model)
}

export const CLAUDE_SLUG = 'claude'

export type ClaudeConfig = {
  enabled: boolean
  apiKey: string | null
  model: string | null
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

  if (!row) return { enabled: false, apiKey: null, model: null }

  const secrets = decryptJson<{ apiKey?: string }>(row.secrets)
  const cfg = row.config as Record<string, unknown>

  return {
    enabled: row.enabled,
    apiKey: secrets?.apiKey ?? null,
    model: typeof cfg.model === 'string' ? cfg.model : null,
  }
})

export function isClaudeReady(
  cfg: ClaudeConfig,
): cfg is ClaudeConfig & { apiKey: string; model: string } {
  return cfg.enabled && Boolean(cfg.apiKey) && Boolean(cfg.model)
}
