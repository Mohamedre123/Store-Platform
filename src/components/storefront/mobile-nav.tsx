'use client'

import { usePathname } from 'next/navigation'
import { SLink as Link } from './store-link'
import { Home, LayoutGrid, ShoppingBag, User } from 'lucide-react'
import { useCart } from './cart'
import { useStoreHref } from './store-link'

/**
 * شريط التنقّل السفلي على الموبايل.
 *
 * أغلب عملاء المتاجر المصرية بيتصفّحوا من الموبايل، والوصول للسلة أو
 * الحساب من قائمة الهامبرجر بياخد ضغطتين. الشريط ده بيخلّيهم ضغطة
 * واحدة — زي التطبيقات اللي العميل متعوّد عليها.
 *
 * بيظهر على الموبايل بس، والصفحة بتاخد مساحة سفلية عشان الشريط ما
 * يغطّيش آخر عنصر فيها.
 */
export function MobileNav({
  showAccount,
  showCart,
}: {
  showAccount: boolean
  showCart: boolean
}) {
  const pathname = usePathname()
  const href = useStoreHref()
  const { count, setOpen, ready, mode } = useCart()

  const items = [
    { key: 'home', label: 'الرئيسية', icon: Home, path: '/' },
    { key: 'products', label: 'المنتجات', icon: LayoutGrid, path: '/products' },
  ]

  const isActive = (path: string) => {
    const full = href(path)
    return path === '/' ? pathname === full : pathname.startsWith(full)
  }

  return (
    <>
      {/* مساحة تعويضية — من غيرها الشريط بيغطّي آخر المحتوى */}
      <div className="h-16 md:hidden" aria-hidden="true" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--sf-text)]/10 bg-[var(--sf-surface)]/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="تنقّل سريع"
      >
        <div className="flex items-stretch">
          {items.map(({ key, label, icon: Icon, path }) => {
            const active = isActive(path)
            return (
              <Link
                key={key}
                href={path}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-opacity ${
                  active ? 'text-[var(--sf-primary)]' : 'opacity-60'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            )
          })}

          {showCart &&
            (mode === 'page' ? (
              <Link
                href="/cart"
                aria-current={isActive('/cart') ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-opacity ${
                  isActive('/cart') ? 'text-[var(--sf-primary)]' : 'opacity-60'
                }`}
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                السلة
                {ready && count > 0 && (
                  <span className="absolute end-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white tabular-nums">
                    {count}
                  </span>
                )}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] opacity-60"
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                السلة
                {ready && count > 0 && (
                  <span className="absolute end-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            ))}

          {showAccount && (
            <Link
              href="/account"
              aria-current={isActive('/account') ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-opacity ${
                isActive('/account') ? 'text-[var(--sf-primary)]' : 'opacity-60'
              }`}
            >
              <User className="h-5 w-5" aria-hidden="true" />
              حسابي
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
