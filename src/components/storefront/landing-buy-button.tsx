'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from './cart'
import { useStoreHref } from './store-link'

/**
 * زرار الشراء في صفحة الهبوط.
 *
 * بيضيف المنتج للسلة ويودّي الشيك أوت على طول — صفحة الهبوط هدفها
 * بيعة واحدة، فمفيش داعي يفتح درج السلة ويستنى العميل يقرّر تاني.
 */
export function LandingBuyButton({
  product,
  label,
}: {
  product: { id: string; name: string; slug: string; price: number; images: string[]; stock: number; trackInventory: boolean }
  storeIdentifier: string
  label: string
}) {
  const { add } = useCart()
  const router = useRouter()
  const href = useStoreHref()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(() => {
          add(
            {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              image: product.images[0],
              price: product.price,
              maxStock: product.trackInventory ? product.stock : undefined,
            },
            1,
          )
          router.push(href('/checkout'))
        })
      }
      className="inline-flex min-h-13 items-center justify-center px-8 text-lg font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
      style={{ background: 'var(--lp-primary)', borderRadius: 'var(--lp-radius)' }}
    >
      {pending ? 'لحظة…' : label}
    </button>
  )
}
