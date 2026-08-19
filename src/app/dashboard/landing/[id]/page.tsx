import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { funnels, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { storeUrl } from '@/lib/domain'
import type { Block } from '@/lib/landing'
import { LandingEditor } from './editor'

export const metadata = { title: 'تحرير صفحة الهبوط' }

export default async function LandingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { store } = await getDashboardContext()

  const [funnel] = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.id, id), eq(funnels.storeId, store.id)))
    .limit(1)

  if (!funnel) notFound()

  const productRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.status, 'active')))
    .orderBy(products.name)
    .limit(300)

  return (
    <LandingEditor
      funnel={{
        id: funnel.id,
        name: funnel.name,
        slug: funnel.slug,
        productId: funnel.productId,
        blocks: (funnel.blocks ?? []) as Block[],
        tokens: funnel.tokens ?? {},
        seoTitle: funnel.seoTitle,
        seoDescription: funnel.seoDescription,
        status: funnel.status,
      }}
      previewUrl={`/s/${store.slug}/lp/${funnel.slug}?preview=1`}
      publicUrl={`${storeUrl(store.slug)}/lp/${funnel.slug}`}
      products={productRows}
    />
  )
}
