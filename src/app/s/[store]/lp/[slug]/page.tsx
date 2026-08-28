import { notFound } from 'next/navigation'
import { decodeSlug } from '@/lib/utils'
import { headers } from 'next/headers'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { funnels, productVariants, products } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { mergeTokens, SHADOWS, SPACING_PX, SPEED_MS, WIDTH_PX, type Block } from '@/lib/landing'
import { FONT_STACKS, RADIUS_PX } from '@/lib/customization'
import { CartProvider } from '@/components/storefront/cart'
import { StoreLinkProvider } from '@/components/storefront/store-link'
import { LandingBlock, type LandingProduct } from '@/components/storefront/landing-blocks'
import { LandingReveal, RevealFallback } from '@/components/storefront/landing-reveal'

export const dynamic = 'force-dynamic'

async function loadFunnel(storeId: string, slug: string, preview: boolean) {
  const [row] = await db
    .select()
    .from(funnels)
    .where(
      and(
        eq(funnels.storeId, storeId),
        eq(funnels.slug, slug),
        // المسوّدة تتفتح في المعاينة بس — الزائر يشوف المنشور فقط
        preview ? undefined : eq(funnels.status, 'published'),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) return { title: 'الصفحة' }
  const funnel = await loadFunnel(store.id, slug, false)
  return {
    title: funnel?.seoTitle ?? funnel?.name ?? 'عرض خاص',
    description: funnel?.seoDescription ?? undefined,
  }
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) notFound()

  const h = await headers()
  const isPreview = h.get('x-zawya-preview') === '1'
  const funnel = await loadFunnel(store.id, slug, isPreview)
  if (!funnel) notFound()

  /* صاحب السلة — صفحة الهبوط ليها سلة زي أي صفحة في المتجر */
  const customer = await getCurrentCustomer(store.id)

  // عدّاد المشاهدات — مش في المعاينة عشان ما نلوّثش أرقام التاجر
  if (!isPreview) {
    void db
      .update(funnels)
      .set({ views: sql`${funnels.views} + 1` })
      .where(eq(funnels.id, funnel.id))
      .catch(() => {})
  }

  let product: LandingProduct = null
  if (funnel.productId) {
    const [row] = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        images: products.images,
        stock: products.stock,
        trackInventory: products.trackInventory,
      })
      .from(products)
      .where(and(eq(products.id, funnel.productId), eq(products.storeId, store.id)))
      .limit(1)

    if (row) {
      /*
        وجود متغيّر واحد شغّال بيغيّر سلوك الزرار كله: الإضافة
        المباشرة بترفض في الشيك أوت، فبنودّي العميل يختار الأول.
      */
      const [variant] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, row.id),
            eq(productVariants.storeId, store.id),
            eq(productVariants.isActive, true),
          ),
        )
        .limit(1)

      product = { ...row, hasVariants: Boolean(variant) }
    }
  }

  const tokens = mergeTokens(funnel.tokens)
  const blocks = (funnel.blocks ?? []) as Block[]

  /**
   * هوية الصفحة تُحقن كمتغيّرات ‎--lp-*‎ مستقلة عن ‎--sf-*‎ بتاعة المتجر.
   * ده اللي بيخلّي صفحة الهبوط تبقى بشكل مختلف تمامًا عن المتجر.
   */
  const vars = {
    '--lp-primary': tokens.primary,
    '--lp-bg': tokens.background,
    '--lp-surface': tokens.surface,
    '--lp-text': tokens.text,
    '--lp-radius': RADIUS_PX[tokens.radius],
    '--lp-gap': SPACING_PX[tokens.spacing],
    '--lp-shadow': SHADOWS[tokens.shadow],
    fontFamily: FONT_STACKS[tokens.font],
    background: tokens.background,
    color: tokens.text,
  } as React.CSSProperties

  const fromStoreHost = h.get('x-zawya-store')
  const base = fromStoreHost ? '' : '/s/' + identifier

  return (
    <StoreLinkProvider base={base}>
      <CartProvider
        storeSlug={store.slug}
        storeIdentifier={identifier}
        customerId={customer?.id ?? null}
      >
        <div style={vars} className="min-h-screen-safe">
          <div className="mx-auto px-4 sm:px-6" style={{ maxWidth: WIDTH_PX[tokens.width] }}>
            <RevealFallback />
            {blocks.length === 0 ? (
              <p className="py-24 text-center opacity-60">الصفحة دي لسه فاضية.</p>
            ) : (
              blocks.map((b, i) => (
                <LandingReveal
                  key={b.id}
                  animation={b.animation ?? tokens.animation}
                  durationMs={SPEED_MS[tokens.animationSpeed]}
                  index={i}
                >
                  <LandingBlock
                    block={b}
                    product={product}
                    currency={store.currency}
                    storeIdentifier={identifier}
                  />
                </LandingReveal>
              ))
            )}
          </div>
        </div>
      </CartProvider>
    </StoreLinkProvider>
  )
}
