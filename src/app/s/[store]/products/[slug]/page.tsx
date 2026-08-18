import Image from 'next/image'
import { headers } from 'next/headers'
import { SLink as Link } from '@/components/storefront/store-link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ImageOff, Truck, Undo2 } from 'lucide-react'
import {
  discountPercent,
  getProductBySlug,
  getStore,
  getStoreTheme,
  listProductReviews,
  listProducts,
} from '@/lib/storefront'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { wishlists } from '@/db/schema'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { ProductCard } from '@/components/storefront/product-card'
import { ProductReviews } from '@/components/storefront/reviews'
import { WishlistButton } from '@/components/storefront/wishlist-button'
import { AddToCart } from '@/components/storefront/add-to-cart'
import { formatMoney } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug } = await params
  const store = await getStore(identifier)
  if (!store) return { title: 'المنتج' }

  const product = await getProductBySlug(store.id, slug)
  if (!product) return { title: 'المنتج مش موجود' }

  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    openGraph: {
      title: product.name,
      images: product.images.length ? [{ url: product.images[0] }] : undefined,
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const product = await getProductBySlug(store.id, slug)
  if (!product) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing, productPage } = theme.custom

  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.trackInventory && product.stock <= 0
  const productReviews = await listProductReviews(product.id)

  // حالة المفضّلة للعميل المسجّل — العميل الزائر بيشوف القلب فاضي
  const customer = await getCurrentCustomer(store.id)
  let isSaved = false
  if (customer) {
    const [row] = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(and(eq(wishlists.customerId, customer.id), eq(wishlists.productId, product.id)))
      .limit(1)
    isSaved = Boolean(row)
  }

  const related = (await listProducts(store.id, { categoryId: product.categoryId ?? undefined, limit: 5 }))
    .filter((p) => p.id !== product.id)
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {/* مسار التنقّل */}
      <nav className="mb-6 flex items-center gap-1 text-sm opacity-65">
        <Link href="/" className="hover:opacity-100">
          الرئيسية
        </Link>
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/products" className="hover:opacity-100">
          المنتجات
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/*
          الصور — تخطيط المعرض من إعداد التاجر:
          stacked = كل الصور تحت بعض · thumbs-side = مصغّرات جنب الصورة
          thumbs-bottom = مصغّرات تحتها
        */}
        <div
          className={
            productPage.galleryLayout === 'thumbs-side' && product.images.length > 1
              ? 'flex flex-row-reverse gap-3'
              : 'flex flex-col gap-3'
          }
        >
          <div className="flex flex-1 flex-col gap-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center opacity-25">
                  <ImageOff className="h-10 w-10" aria-hidden="true" />
                </span>
              )}
              {off && !soldOut && (
                <span className="absolute start-3 top-3 rounded-md bg-[var(--sf-primary)] px-2 py-1 text-sm font-bold text-white tabular-nums">
                  خصم {off}%
                </span>
              )}
            </div>

            {/* المكدّس: باقي الصور بحجمها الكامل تحت بعض */}
            {productPage.galleryLayout === 'stacked' &&
              product.images.slice(1).map((src) => (
                <div
                  key={src}
                  className="relative aspect-square w-full overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6"
                >
                  <Image src={src} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                </div>
              ))}
          </div>

          {productPage.galleryLayout !== 'stacked' && product.images.length > 1 && (
            <div
              className={
                productPage.galleryLayout === 'thumbs-side'
                  ? 'flex w-20 shrink-0 flex-col gap-2 overflow-y-auto'
                  : 'scroll-x flex gap-2'
              }
            >
              {product.images.slice(1).map((src) => (
                <span
                  key={src}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6"
                >
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col gap-5">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>

          {productPage.showSku && product.sku && (
            <span className="-mt-2 text-xs text-[var(--sf-text)]/50">
              كود المنتج: <bdi dir="ltr">{product.sku}</bdi>
            </span>
          )}

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="tabular text-3xl font-bold text-[var(--sf-primary)]">
              {formatMoney(product.price, store.currency)}
            </span>
            {product.compareAtPrice && (
              <span className="tabular text-lg line-through opacity-45">
                {formatMoney(product.compareAtPrice, store.currency)}
              </span>
            )}
          </div>

          {productPage.showStockCounter && product.trackInventory && product.stock > 0 && product.stock <= 10 && (
            <p className="text-sm font-medium text-amber-600">
              باقي <span className="tabular">{product.stock}</span> بس في المخزن
            </p>
          )}

          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <AddToCart
                item={{
                  productId: product.id,
                  name: product.name,
                  slug: product.slug,
                  image: product.images[0],
                  price: product.price,
                  maxStock: product.trackInventory ? product.stock : undefined,
                }}
                soldOut={soldOut}
                whatsapp={store.whatsapp}
                productName={product.name}
              />
            </div>
            <WishlistButton
              storeIdentifier={identifier}
              productId={product.id}
              initialSaved={isSaved}
            />
          </div>

          {(productPage.showShippingNote || productPage.showReturnNote || productPage.trustLines.length > 0) && (
            <div className="flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 p-4 text-sm">
              {productPage.showShippingNote && (
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
                  {productPage.trustLines[0] || 'التوصيل لكل المحافظات · الدفع عند الاستلام متاح'}
                </span>
              )}
              {productPage.showReturnNote && (
                <span className="flex items-center gap-2">
                  <Undo2 className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
                  {productPage.trustLines[1] || 'إرجاع سهل لو المنتج مش زي ما توقّعت'}
                </span>
              )}
            </div>
          )}

          {product.description && (
            <div className="border-t border-[var(--sf-text)]/10 pt-5">
              <h2 className="mb-2 font-bold">تفاصيل المنتج</h2>
              <p className="whitespace-pre-line leading-relaxed opacity-80">{product.description}</p>
            </div>
          )}

          {product.specs.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--sf-text)]/10 pt-5 text-sm">
              {product.specs.map((s) => (
                <div key={s.key} className="flex flex-col">
                  <dt className="opacity-60">{s.key}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <ProductReviews
        storeIdentifier={identifier}
        productId={product.id}
        reviews={productReviews}
        ratingAverage={product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null}
        ratingCount={product.ratingCount}
      />

      {productPage.showRelated && related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold tracking-tight">{productPage.relatedTitle || 'منتجات ممكن تعجبك'}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={store.currency}
                style={listing.cardStyle === 'compact' ? 'clean' : listing.cardStyle}
                imageRatio={listing.imageRatio}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
