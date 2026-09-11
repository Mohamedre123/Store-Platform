import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { Sparkles } from 'lucide-react'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { getAiConfig, GEMINI_PRO_SLUG, GEMINI_SLUG, resolveEngines } from '@/lib/ai/settings'
import { recentAssets } from '@/lib/studio'
import { listAccounts, publishingEnabled } from '@/lib/social'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { StudioClient } from './studio-client'
import { searchProductsAction } from './actions'

export const metadata = { title: 'استوديو المحتوى' }

/*
  الأفعال بتاخد مهلة الصفحة اللي بتناديها.

  كاروسيل من عشر شرايح = فكرة + عشر صور متتابعة، والنشر بعده بيحمّل
  الشرايح ويرفعها للخدمة. المهلة الافتراضية كانت بتقطع ده في النص،
  والتاجر بيدفع تمن توليد ما وصلوش. نفس مهلة عامل المهام.
*/
export const maxDuration = 300

/**
 * استوديو المحتوى.
 *
 * ## الشاشة بتقول «ينقصك إيه» قبل ما تفتح الأداة
 * الأداة محتاجة تلات حاجات: الإضافة مفعّلة، ومفتاح Gemini، وحساب
 * سوشيال (للنشر بس). كل واحدة ناقصة بتبان كسطر بزرار يودّي
 * لمكانها — بدل شاشة بتشتغل نُصّها والتاجر يكتشف الباقي بالغلط.
 */
export default async function StudioPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const [plugin] = await db
    .select({ enabled: storePlugins.enabled })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, 'studio')))
    .limit(1)

  const enabled = plugin?.enabled ?? false

  if (!enabled) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="استوديو المحتوى" description="صور وبوستات لمنتجاتك — ونشر تلقائي." />
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Sparkles className="h-8 w-8 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="text-lg font-bold">الاستوديو لسه مقفول</h2>
            <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
              فعّله من الإضافات وهيبدأ يعمل لك صور إعلانية وبوستات لمنتجاتك — وهو عارف بضاعتك
              بأسمائها وأسعارها.
            </p>
            <Link
              href="/dashboard/plugins"
              className="mt-1 flex h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
            >
              روح للإضافات
            </Link>
          </Card>
        </Reveal>
      </div>
    )
  }

  const [pro, basic, assets, accounts, products] = await Promise.all([
    getAiConfig(store.id, GEMINI_PRO_SLUG),
    getAiConfig(store.id, GEMINI_SLUG),
    recentAssets(store.id, 18),
    listAccounts(store.id),
    searchProductsAction(''),
  ])

  const hasKey = Boolean(
    pro.apiKey?.trim() || basic.apiKey?.trim() || pro.openaiKey?.trim() || basic.openaiKey?.trim(),
  )

  /* المزوّدين اللي ليهم مفتاح — الاختيار بيظهر لما يبقوا اتنين */
  const engines = await resolveEngines(store.id, 'tools')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="استوديو المحتوى"
        description="اختار منتجك، وقوله عايز إيه — وعدّل عليه بالكلام لحد ما يعجبك."
      />

      <Reveal>
        <StudioClient
          hasKey={hasKey}
          providers={engines.ok ? engines.available : []}
          defaultProvider={engines.ok ? engines.engine.provider : null}
          publishing={publishingEnabled()}
          products={products}
          accounts={accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            name: a.name,
            avatar: a.avatar,
            status: a.status,
          }))}
          assets={assets.map((a) => ({
            id: a.id,
            url: a.url,
            prompt: a.prompt,
            preset: a.preset,
            kind: a.kind,
          }))}
        />
      </Reveal>
    </div>
  )
}
