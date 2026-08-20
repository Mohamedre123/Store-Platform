import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { experiments, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ExperimentsManager, type ExperimentRow } from './experiments-manager'

export const metadata = { title: 'تجارب A/B' }
export const dynamic = 'force-dynamic'

export default async function ExperimentsPage() {
  const { store } = await getDashboardContext()

  const [rows, productList] = await Promise.all([
    db
      .select({
        id: experiments.id,
        name: experiments.name,
        field: experiments.field,
        targetId: experiments.targetId,
        variantA: experiments.variantA,
        variantB: experiments.variantB,
        splitBps: experiments.splitBps,
        viewsA: experiments.viewsA,
        viewsB: experiments.viewsB,
        ordersA: experiments.ordersA,
        ordersB: experiments.ordersB,
        revenueA: experiments.revenueA,
        revenueB: experiments.revenueB,
        status: experiments.status,
        winner: experiments.winner,
        startedAt: experiments.startedAt,
        productName: products.name,
      })
      .from(experiments)
      .leftJoin(products, eq(products.id, experiments.targetId))
      .where(eq(experiments.storeId, store.id))
      .orderBy(desc(experiments.createdAt))
      .limit(100),

    db
      .select({ id: products.id, name: products.name, price: products.price })
      .from(products)
      .where(
        and(
          eq(products.storeId, store.id),
          eq(products.status, 'active'),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(products.name))
      .limit(300),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تجارب A/B"
        description="بدل ما تخمّن السعر — خلّي نص الزوّار يشوفوا سعر والنص التاني سعر تاني، والأرقام تقول."
      />

      <Reveal>
        <ExperimentsManager
          experiments={rows as ExperimentRow[]}
          products={productList}
          currency={store.currency}
        />
      </Reveal>
    </div>
  )
}
