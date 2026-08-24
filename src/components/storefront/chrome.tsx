'use client'

import { SLink as Link } from './store-link'
import Image from 'next/image'
import { Heart, Menu, Search, ShoppingBag, User, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useCart } from './cart'
import { CartDrawer } from './cart-drawer'
import { SearchBox } from './search-box'
import type { UpsellProduct } from '@/lib/storefront'

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
  showCart = true,
  showAccount = true,
  showCategoriesBar = false,
  sticky = true,
  categories = [],
  cartEmptyMessage,
  cartFreeShippingBar = false,
  cartFreeOver = 0,
  cartShowNotes = false,
  cartUpsell = [],
  cartUpsellTitle = 'أكمل طلبك',
  showWishlist = false,
  logoHeight = 40,
  currency,
  storeSlug,
}: {
  storeName: string
  logo: string | null
  hideName: boolean
  nav: NavItem[]
  navStyle: 'top' | 'centered' | 'split'
  showSearch: boolean
  showCart?: boolean
  showAccount?: boolean
  showCategoriesBar?: boolean
  sticky?: boolean
  categories?: Array<{ name: string; slug: string; parentId?: string | null; id?: string }>
  cartEmptyMessage?: string
  cartFreeShippingBar?: boolean
  cartFreeOver?: number
  cartShowNotes?: boolean
  cartUpsell?: UpsellProduct[]
  cartUpsellTitle?: string
  showWishlist?: boolean
  logoHeight?: number
  currency: string
  storeSlug: string
}) {
  const { count, setOpen, ready, mode: cartMode } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)

  const brand = (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      {logo && (
        <Image
          src={logo}
          alt={storeName}
          width={logoHeight * 2}
          height={logoHeight * 2}
          priority
          // الارتفاع من إعداد التاجر والعرض تلقائي — الشعار العريض
          // ما يتقصّش والمربّع ما يتمطّش
          style={{ height: logoHeight, width: 'auto' }}
          className="rounded-lg object-contain"
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

  const wishlistButton = showWishlist ? (
    <Link
      href="/account"
      aria-label="المفضّلة"
      className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-text)]/6"
    >
      <Heart className="h-5 w-5" aria-hidden="true" />
    </Link>
  ) : null

  const accountButton = showAccount ? (
    <Link
      href="/account"
      aria-label="حسابي"
      className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-text)]/6"
    >
      <User className="h-5 w-5" aria-hidden="true" />
    </Link>
  ) : null

  /*
    في وضع الصفحة الزرار رابط حقيقي: العميل يقدر يفتحه في تبويب جديد
    ويحفظه، ومحرّكات البحث تشوفه. الزرار العادي بيمنع الاتنين.
  */
  const cartInner = (
    <>
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {ready && count > 0 && (
        <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white tabular-nums">
          {count}
        </span>
      )}
    </>
  )
  const cartClass =
    'relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-text)]/6'
  const cartLabel = `السلة${ready && count ? ` — ${count} منتج` : ''}`

  const cartButton = !showCart ? null : cartMode === 'page' ? (
    <Link href="/cart" aria-label={cartLabel} className={cartClass}>
      {cartInner}
    </Link>
  ) : (
    <button type="button" onClick={() => setOpen(true)} aria-label={cartLabel} className={cartClass}>
      {cartInner}
    </button>
  )

  return (
    <>
      <header className={`${sticky ? 'sticky top-0' : ''} z-40 border-b border-[var(--sf-text)]/10 bg-[var(--sf-surface)]/90 backdrop-blur-md`}>
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
                  {wishlistButton}
                  {accountButton}
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
                    <>
                      {/* على الشاشات الواسعة خانة بحث فعلية، وعلى الضيّقة أيقونة */}
                      <div className="hidden w-64 lg:block">
                        <SearchBox compact />
                      </div>
                      <Link
                        href="/search"
                        aria-label="بحث"
                        className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-text)]/6 lg:hidden"
                      >
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </Link>
                    </>
                  )}
                  {wishlistButton}
                  {accountButton}
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

      {/* شريط الأقسام — بيظهر لو التاجر فعّله */}
{/*
        شريط الأقسام — والأقسام الفرعية بتظهر جوّه أبوها.

        القسم اللي ليه أولاد بياخد قايمة منسدلة بتفتح بالمرور على
        الكمبيوتر وبالضغط على الموبايل (`focus-within` بيغطّي
        الاتنين من غير أي جافاسكربت). عرض الكل في صف واحد كان
        بيخلّي الشريط عشرين قسمًا والعميل يتوه.
      */}
      {showCategoriesBar && categories.length > 0 && (
        <div className="border-b border-[var(--sf-text)]/10 bg-[var(--sf-surface)]/60">
          <div className="scroll-x mx-auto flex max-w-6xl items-center gap-1 px-4 py-2 sm:px-6">
            {categories
              .filter((c) => !c.parentId)
              .map((parent) => {
                const children = categories.filter((c) => c.parentId && c.parentId === parent.id)

                if (children.length === 0) {
                  return (
                    <Link
                      key={parent.slug}
                      href={`/category/${parent.slug}`}
                      className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm opacity-75 transition-all hover:bg-[var(--sf-text)]/6 hover:opacity-100"
                    >
                      {parent.name}
                    </Link>
                  )
                }

                return (
                  <div key={parent.slug} className="group relative shrink-0">
                    <Link
                      href={`/category/${parent.slug}`}
                      className="flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm opacity-75 transition-all hover:bg-[var(--sf-text)]/6 hover:opacity-100"
                    >
                      {parent.name}
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                    </Link>

                    <div className="invisible absolute start-0 top-full z-40 min-w-[11rem] rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] py-1 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      {children.map((child) => (
                        <Link
                          key={child.slug}
                          href={`/category/${child.slug}`}
                          className="block whitespace-nowrap px-3 py-2 text-sm opacity-75 transition-colors hover:bg-[var(--sf-text)]/6 hover:opacity-100"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

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

      {cartMode === 'drawer' && (
        <CartDrawer
          currency={currency}
          storeSlug={storeSlug}
          emptyMessage={cartEmptyMessage}
          freeShippingBar={cartFreeShippingBar}
          freeOver={cartFreeOver}
          showNotes={cartShowNotes}
          upsell={cartUpsell}
          upsellTitle={cartUpsellTitle}
        />
      )}
    </>
  )
}
