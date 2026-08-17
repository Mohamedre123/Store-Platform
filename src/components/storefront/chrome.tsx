'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, ShoppingBag, X } from 'lucide-react'
import { useState } from 'react'
import { useCart } from './cart'
import { CartDrawer } from './cart-drawer'

type NavItem = { label: string; href: string }

/**
 * هيدر المتجر.
 *
 * شكله بيتبع تخطيط الثيم: «centered» يحط الشعار في النص، و«split»
 * يفصل التنقّل عن الأدوات، و«top» الشكل الكلاسيكي. البحث بيظهر
 * فقط لو الثيم بيطلبه.
 */
export function StoreHeader({
  storeName,
  logo,
  hideName,
  nav,
  navStyle,
  showSearch,
  currency,
  storeSlug,
}: {
  storeName: string
  logo: string | null
  hideName: boolean
  nav: NavItem[]
  navStyle: 'top' | 'centered' | 'split'
  showSearch: boolean
  currency: string
  storeSlug: string
}) {
  const { count, setOpen, ready } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  const brand = (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      {logo && (
        <Image
          src={logo}
          alt={storeName}
          width={44}
          height={44}
          priority
          className="h-10 w-10 rounded-lg object-contain"
        />
      )}
      {!hideName && <span className="truncate text-lg font-bold tracking-tight">{storeName}</span>}
    </Link>
  )

  const links = (
    <nav className="flex items-center gap-6 text-sm">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setMenuOpen(false)}
          className="whitespace-nowrap opacity-75 transition-opacity hover:opacity-100"
        >
          {n.label}
        </Link>
      ))}
    </nav>
  )

  const cartButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`السلة${ready && count ? ` — ${count} منتج` : ''}`}
      className="relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-text)]/6"
    >
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {ready && count > 0 && (
        <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white tabular-nums">
          {count}
        </span>
      )}
    </button>
  )

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--sf-text)]/10 bg-[var(--sf-surface)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div
            className={`flex h-16 items-center gap-4 ${
              navStyle === 'centered' ? 'justify-between md:grid md:grid-cols-3' : 'justify-between'
            }`}
          >
            {navStyle === 'centered' ? (
              <>
                <div className="hidden md:flex">{links}</div>
                <div className="flex justify-start md:justify-center">{brand}</div>
                <div className="flex items-center justify-end gap-1">
                  {cartButton}
                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label="القائمة"
                    className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden"
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {brand}
                <div className="hidden md:flex">{links}</div>
                <div className="flex items-center gap-1">
                  {showSearch && (
                    <Link
                      href="/products"
                      className="hidden rounded-lg border border-[var(--sf-text)]/15 px-4 py-2 text-sm opacity-70 transition-opacity hover:opacity-100 lg:block"
                    >
                      ابحث في المنتجات…
                    </Link>
                  )}
                  {cartButton}
                  <button
                    type="button"
                    onClick={() => setMenuOpen(true)}
                    aria-label="القائمة"
                    className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden"
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* قائمة الموبايل */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 start-0 flex w-[min(18rem,85vw)] flex-col bg-[var(--sf-surface)] p-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              {brand}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="إغلاق"
                className="flex h-10 w-10 items-center justify-center rounded-lg"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-[var(--sf-text)]/6"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <CartDrawer currency={currency} storeSlug={storeSlug} />
    </>
  )
}
