'use client'

import { SLink as Link } from '@/components/storefront/store-link'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/storefront/cart'

/** يمنع عرض نموذج الشيك أوت لسلة فاضية */
export function EmptyCart({ children }: { children: React.ReactNode }) {
  const { items, ready } = useCart()

  if (!ready) return <div className="py-20" aria-hidden="true" />

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <ShoppingBag className="h-10 w-10 opacity-25" aria-hidden="true" />
        <p className="font-medium">سلتك فاضية</p>
        <Link
          href="/products"
          className="rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-5 py-3 font-semibold text-white"
        >
          تصفّح المنتجات
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
