import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { campaigns, customers } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CampaignsManager, type CampaignRow } from './campaigns-manager'

export const metadata = { title: 'حملات البريد' }

export default async function CampaignsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const [rows, [subs]] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(eq(campaigns.storeId, store.id))
      .orderBy(desc(campaigns.createdAt))
      .limit(50),

    /*
      المشتركون = اللي موافق ومعاه بريد ومش محظور.

      نفس شرط الجمهور في `campaigns.ts` بالحرف — لو اختلفوا، التاجر
      بيشوف «١٢٠ مشترك» فوق و«هتوصل لـ٩٤» تحت في نفس الشاشة ومش
      فاهم مين الصح.
    */
    db
      .select({
        n: sql<number>`count(*) filter (
          where ${customers.acceptsMarketing} = true
            and ${customers.isBlocked} = false
            and ${customers.email} is not null
            and ${customers.email} <> ''
        )::int`,
        /**
         * عملاء بلا بريد.
         *
         * الرقم ده هو الفرق بين «مفيش مشتركين» و«عندك عملاء بس
         * مفيش وسيلة توصلهم». التاجر اللي بيشوف صفرًا من غير سبب
         * بيفتكر إن فيه عطل ويسيب الميزة — واللي بيشوف «١٢ عميل
         * من غير بريد» بيعرف إنه لازم يفتح خانة البريد في الشيك
         * أوت.
         */
        noEmail: sql<number>`count(*) filter (
          where ${customers.email} is null or ${customers.email} = ''
        )::int`,
      })
      .from(customers)
      .where(eq(customers.storeId, store.id)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حملات البريد"
        description="العملاء اللي سجّلوا بريدهم عندك أرخص قناة بيع — مش محتاجة إعلان ولا وسيط."
      />

      <Reveal>
        <CampaignsManager
          subscribers={subs?.n ?? 0}
          withoutEmail={subs?.noEmail ?? 0}
          rows={rows.map(
            (r): CampaignRow => ({
              id: r.id,
              name: r.name,
              subject: r.subject,
              body: r.body,
              ctaLabel: r.ctaLabel,
              ctaUrl: r.ctaUrl,
              audience: r.audience,
              status: r.status,
              audienceCount: r.audienceCount,
              sentCount: r.sentCount,
              failedCount: r.failedCount,
              createdAt: r.createdAt.toISOString(),
            }),
          )}
        />
      </Reveal>
    </div>
  )
}
