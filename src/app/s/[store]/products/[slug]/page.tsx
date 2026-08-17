import Image from 'next/image'
import { SLink as Link } from '@/components/storefront/store-link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ImageOff, Truck, Undo2 } from 'lucide-react'
import {
  discountPercent,
  getProductBySlug,
  getStore,
  getStoreTheme,
  listProducts,
} from '@/lib/storefront'
import { ProductCard } from '@/components/storefront/product-card'
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

  const theme = await getStoreTheme(store.id)
  const { layout } = theme.definition

  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.trackInventory && product.stock <= 0
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
        {/* الصور */}
        <div className="flex flex-col gap-3">
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

          {product.images.length > 1 && (
            <div className="scroll-x flex gap-2">
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

          {product.trackInventory && product.stock > 0 && product.stock <= 10 && (
            <p className="text-sm font-medium text-amber-600">
              باقي <span className="tabular">{product.stock}</span> بس في المخزن
            </p>
          )}

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

          <div className="flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 p-4 text-sm">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
              التوصيل لكل المحافظات · الدفع عند الاستلام متاح
            </span>
            <span className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
              إرجاع سهل لو المنتج مش زي ما توقّعت
            </span>
          </div>

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

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold tracking-tight">منتجات ممكن تعجبك</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={store.currency}
                style={layout.card === 'compact' ? 'clean' : layout.card}
                imageRatio={layout.imageRatio}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
