import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { aiAllowed, getAiConfig, getClaudeConfig, GEMINI_PRO_SLUG, GEMINI_SLUG } from '@/lib/ai/settings'
import { readTemplates, readWhatsapp } from '@/lib/whatsapp'
import { platformToken } from '@/lib/whatsapp-onboard'
import { PluginsManager, type PluginRow } from './plugins-manager'

export const metadata = { title: 'الإضافات' }

export default async function PluginsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      slug: storePlugins.pluginSlug,
      enabled: storePlugins.enabled,
      config: storePlugins.config,
    })
    .from(storePlugins)
    .where(eq(storePlugins.storeId, store.id))

  /*
    إعدادات Gemini بتتقرا لوحدها عشان المفتاح يفضل على الخادم.
    بنمرّر hasKey بس — المفتاح نفسه ما بيرجعش للمتصفح أبدًا حتى
    مقنّعًا، لأن أي حاجة توصل للمتصفح ممكن تتقرا.
  */
  const gemini = await getAiConfig(store.id, GEMINI_SLUG)
  const pro = await getAiConfig(store.id, GEMINI_PRO_SLUG)
  const claude = await getClaudeConfig(store.id)
  const aiOk = await aiAllowed(store.id)

  const whatsapp = {
    settings: await readWhatsapp(store.id),
    templates: await readTemplates(store.id),
    storePhone: store.whatsapp ?? store.phone ?? null,
    hasPlatformToken: Boolean(platformToken()),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الإضافات"
        description="اربط أدوات القياس والذكاء الاصطناعي بمتجرك — من غير أي كود."
      />

      <Reveal>
        <PluginsManager
          aiLocked={!aiOk}
          installed={rows as PluginRow[]}
          whatsapp={whatsapp}
          gemini={{
            enabled: gemini.enabled,
            hasKey: Boolean(gemini.apiKey),
            model: gemini.model,
            brief: gemini.brief,
            botEnabled: gemini.botEnabled,
            botGreeting: gemini.botGreeting,
            botDailyLimit: gemini.botDailyLimit,
            botVisitorLimit: gemini.botVisitorLimit,
          }}
          pro={{
            enabled: pro.enabled,
            hasOwnKey: Boolean(pro.apiKey),
            model: pro.model,
            brief: pro.brief,
            baseReady: Boolean(gemini.apiKey && gemini.model),
          }}
          claude={{
            enabled: claude.enabled,
            hasKey: Boolean(claude.apiKey),
            hasGeminiKey: Boolean(claude.geminiKey),
            provider: claude.provider,
            model: claude.model,
          }}
        />
      </Reveal>
    </div>
  )
}
