import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { TrashManager, type TrashRow } from './trash-manager'

export const metadata = { title: 'سلة المهملات' }

export default async function TrashPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'products.manage')

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      images: products.images,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .where(and(eq(products.storeId, store.id), isNotNull(products.deletedAt)))
    .orderBy(desc(products.deletedAt))
    .limit(200)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سلة المهملات"
        description="المنتجات اللي حذفتها — رجّعها بضغطة، أو امسحها نهائيًا وإنت عارف."
      />

      <Reveal>
        <TrashManager
          currency={store.currency}
          rows={rows.map(
            (r): TrashRow => ({
              id: r.id,
              name: r.name,
              price: r.price,
              image: r.images?.[0] ?? null,
              deletedAt: r.deletedAt!.toISOString(),
            }),
          )}
        />
      </Reveal>
    </div>
  )
}
