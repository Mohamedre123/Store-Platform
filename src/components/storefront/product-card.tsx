import Image from 'next/image'
import { SLink as Link } from './store-link'
import { ImageOff, Star } from 'lucide-react'
import type { StorefrontProduct } from '@/lib/storefront'
import { discountPercent } from '@/lib/storefront'
import { formatMoney } from '@/lib/utils'
import type { CardStyle } from '@/lib/themes'
import { QuickAdd } from './quick-add'

/**
 * بطاقة المنتج.
 *
 * شكلها بيتبع الثيم: «overlay» يحط النص فوق الصورة، و«framed» يحيطها
 * بإطار، و«editorial» يوسّع المسافات ويكبّر الصورة، و«compact» صف
 * أفقي. ده اللي بيخلي الثيمات مختلفة فعلًا مش بالألوان بس.
 */
export function ProductCard({
  product,
  currency,
  style = 'clean',
  imageRatio = 'square',
  showRating = true,
  showQuickAdd = false,
}: {
  product: StorefrontProduct
  currency: string
  style?: CardStyle
  imageRatio?: 'square' | 'portrait' | 'wide'
  showRating?: boolean
  showQuickAdd?: boolean
}) {
  const soldOutForAdd = product.trackInventory && product.stock <= 0

  // الزرار جنب الرابط مش جوّاه: <button> داخل <a> ترميز غير صالح
  if (showQuickAdd) {
    return (
      <div className="flex flex-col">
        <ProductCardBody
          product={product}
          currency={currency}
          style={style}
          imageRatio={imageRatio}
          showRating={showRating}
        />
        <QuickAdd
          product={{
            productId: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images[0],
            price: product.price,
            maxStock: product.trackInventory ? product.stock : undefined,
          }}
          soldOut={soldOutForAdd}
        />
      </div>
    )
  }

  return (
    <ProductCardBody
      product={product}
      currency={currency}
      style={style}
      imageRatio={imageRatio}
      showRating={showRating}
    />
  )
}

function ProductCardBody({
  product,
  currency,
  style = 'clean',
  imageRatio = 'square',
  showRating = true,
}: {
  product: StorefrontProduct
  currency: string
  style?: CardStyle
  imageRatio?: 'square' | 'portrait' | 'wide'
  showRating?: boolean
}) {
  const off = discountPercent(product.price, product.compareAtPrice)
  const soldOut = product.trackInventory && product.stock <= 0
  const rating = showRating && product.ratingCount ? product.ratingSum / product.ratingCount : null
  const href = `/products/${product.slug}`

  const aspect =
    imageRatio === 'portrait' ? 'aspect-[3/4]' : imageRatio === 'wide' ? 'aspect-[4/3]' : 'aspect-square'

  const picture = (
    <span className={`relative block w-full overflow-hidden bg-[var(--sf-text)]/6 ${aspect} rounded-[var(--sf-radius)]`}>
      {product.images[0] ? (
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <span className="flex h-full items-center justify-center opacity-25">
          <ImageOff className="h-7 w-7" aria-hidden="true" />
        </span>
      )}

      {off && !soldOut && (
        <span className="absolute start-2 top-2 rounded-md bg-[var(--sf-primary)] px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
          −{off}%
        </span>
      )}

      {soldOut && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold text-white">
          نفدت الكمية
        </span>
      )}
    </span>
  )

  const price = (
    <span className="flex flex-wrap items-baseline gap-2">
      <span className="tabular font-bold text-[var(--sf-primary)]">
        {formatMoney(product.price, currency)}
      </span>
      {product.compareAtPrice && (
        <span className="tabular text-xs line-through opacity-45">
          {formatMoney(product.compareAtPrice, currency)}
        </span>
      )}
    </span>
  )

  /* صف أفقي */
  if (style === 'compact') {
    return (
      <Link
        href={href}
        className="group flex gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 bg-[var(--sf-surface)] p-3 transition-colors hover:border-[var(--sf-primary)]/40"
      >
        <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
          {product.images[0] ? (
            <Image src={product.images[0]} alt={product.name} fill sizes="96px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center opacity-25">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-medium">{product.name}</span>
          {product.shortDescription && (
            <span className="line-clamp-2 text-sm opacity-60">{product.shortDescription}</span>
          )}
          <span className="mt-auto">{price}</span>
        </span>
      </Link>
    )
  }

  /* النص فوق الصورة */
  if (style === 'overlay') {
    return (
      <Link href={href} className="group relative block overflow-hidden rounded-[var(--sf-radius)]">
        {picture}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
          <span className="line-clamp-2 text-sm font-semibold">{product.name}</span>
          <span className="tabular text-sm font-bold">{formatMoney(product.price, currency)}</span>
        </span>
      </Link>
    )
  }

  /* بإطار ومواصفات */
  if (style === 'framed') {
    return (
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] p-3 transition-shadow hover:shadow-lg"
      >
        {picture}
        <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
        {rating !== null && (
          <span className="flex items-center gap-1 text-xs opacity-70">
            <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden="true" />
            <span className="tabular">{rating.toFixed(1)}</span>
            <span className="tabular opacity-60">({product.ratingCount})</span>
          </span>
        )}
        <span className="mt-auto">{price}</span>
      </Link>
    )
  }

  /* clean و editorial */
  const editorial = style === 'editorial'
  return (
    <Link href={href} className={`group flex flex-col ${editorial ? 'gap-3' : 'gap-2'}`}>
      {picture}
      <span className={`line-clamp-2 ${editorial ? 'text-base' : 'text-sm'} font-medium`}>
        {product.name}
      </span>
      {price}
      {product.showStockCounter && product.trackInventory && product.stock > 0 && product.stock <= 10 && (
        <span className="text-xs text-amber-600">باقي {product.stock} بس</span>
      )}
    </Link>
  )
}
