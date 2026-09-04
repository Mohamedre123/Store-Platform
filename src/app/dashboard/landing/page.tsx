import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { funnels, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { publicStoreUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { LandingList, type FunnelRow } from './landing-list'
import { LandingAi } from './landing-ai'
import { aiAllowed, getClaudeConfig, isClaudeReady } from '@/lib/ai/settings'
import { getEntitlements } from '@/lib/entitlements'
import { Locked } from '@/components/dashboard/locked'

export const metadata = { title: 'صفحات الهبوط' }

export default async function LandingPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const claude = await getClaudeConfig(store.id)
  const ent = await getEntitlements(store)
  const aiOk = await aiAllowed(store.id)

  const [rows, productRows] = await Promise.all([
    db
      .select({
        id: funnels.id,
        name: funnels.name,
        slug: funnels.slug,
        status: funnels.status,
        views: funnels.views,
        conversions: funnels.conversions,
        createdAt: funnels.createdAt,
      })
      .from(funnels)
      .where(eq(funnels.storeId, store.id))
      .orderBy(desc(funnels.createdAt))
      .limit(100),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, 'active')))
      .orderBy(products.name)
      .limit(300),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="صفحات الهبوط"
        description="صفحة لكل حملة — بهويتها الخاصة المستقلة عن شكل متجرك."
      />

      {/*
        القسم كله ورا زجاج على غير المشترك.

        التاجر بيشوف شكل صفحاته والمولّد من ورا البلور — يعني بيعرف
        إن الميزة موجودة وشكلها إيه، بدل ما يلاقي القسم فاضي ويفتكر
        إن المنصة مش بتعملها أصلًا.
      */}
      {!ent.features.landing ? (
        <Locked description="اعمل صفحة هبوط لكل حملة، بهوية مستقلة عن متجرك — ومولّد بالذكاء الاصطناعي يكتبها من وصف واحد.">
          <div className="flex flex-col gap-6">
            <LandingAi
              enabled={false}
              pages={rows.map((r) => ({
                id: r.id,
                name: r.name,
                published: r.status === 'published',
              }))}
            />
            <LandingList
              funnels={rows as FunnelRow[]}
              products={productRows}
              storeUrl={publicStoreUrl(store)}
            />
          </div>
        </Locked>
      ) : (
        <>
          {/*
            المولّد فوق القايمة: التاجر اللي داخل يعمل صفحة جديدة ده أول
            اللي بيشوفه، واللي جاي يعدّل القديم بيعدّي عليه لتحت.
          */}
          <Reveal>
            <LandingAi
              enabled={aiOk && isClaudeReady(claude)}
              pages={rows.map((r) => ({
                id: r.id,
                name: r.name,
                published: r.status === 'published',
              }))}
            />
          </Reveal>

          <Reveal delay={60}>
            <LandingList
              funnels={rows as FunnelRow[]}
              products={productRows}
              storeUrl={publicStoreUrl(store)}
            />
          </Reveal>
        </>
      )}
    </div>
  )
}
