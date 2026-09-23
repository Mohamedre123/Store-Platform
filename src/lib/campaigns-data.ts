import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { campaigns, customers } from '@/db/schema'
import type { CampaignRow } from '@/app/dashboard/marketing/campaigns/campaigns-manager'

/**
 * حملات البريد وعدد المشتركين — صفحة اللوحة ومسار التطبيق (`/api/app/campaigns`) بيقروا من هنا.
 */
export async function loadCampaigns(storeId: string) {
  const [rows, [subs]] = await Promise.all([
    db.select().from(campaigns).where(eq(campaigns.storeId, storeId)).orderBy(desc(campaigns.createdAt)).limit(50),

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
         * عملاء بلا بريد — الفرق بين «مفيش مشتركين» و«عندك عملاء بس مفيش وسيلة توصلهم».
         */
        noEmail: sql<number>`count(*) filter (
          where ${customers.email} is null or ${customers.email} = ''
        )::int`,
      })
      .from(customers)
      .where(eq(customers.storeId, storeId)),
  ])

  return {
    subscribers: subs?.n ?? 0,
    withoutEmail: subs?.noEmail ?? 0,
    rows: rows.map(
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
    ),
  }
}
