'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3,
  Boxes,
  CreditCard,
  Crown,
  LayoutDashboard,
  Megaphone,
  Menu,
  Package,
  Globe,
  Plug,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Code2,
  Gift,
  Image as ImageIcon,
  Newspaper,
  Share2,
  RotateCcw,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { brand } from '@/lib/brand'

const groups: Array<{
  label?: string
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>
}> = [
  {
    items: [
      { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
      { href: '/dashboard/orders', label: 'الطلبات', icon: ShoppingBag },
      { href: '/dashboard/returns', label: 'المرتجعات', icon: RotateCcw },
      { href: '/dashboard/products', label: 'المنتجات', icon: Package },
      { href: '/dashboard/customers', label: 'العملاء', icon: Users },
      { href: '/dashboard/loyalty', label: 'الولاء والنقاط', icon: Gift },
      { href: '/dashboard/affiliates', label: 'المسوّقون', icon: Share2 },
      { href: '/dashboard/reviews', label: 'المراجعات', icon: Star },
      { href: '/dashboard/marketing', label: 'التسويق', icon: Megaphone },
      { href: '/dashboard/analytics', label: 'التحليلات', icon: BarChart3 },
    ],
  },
  {
    label: 'قنوات البيع',
    items: [
      { href: '/dashboard/storefront', label: 'المتجر', icon: Store },
      { href: '/dashboard/storefront/banners', label: 'البانرات', icon: ImageIcon },
      { href: '/dashboard/blog', label: 'المدوّنة', icon: Newspaper },
      { href: '/dashboard/inventory', label: 'المخزون', icon: Boxes },
    ],
  },
  {
    label: 'الإعداد',
    items: [
      { href: '/dashboard/shipping', label: 'الشحن', icon: Truck },
      { href: '/dashboard/payments', label: 'الدفع', icon: CreditCard },
      { href: '/dashboard/plugins', label: 'الإضافات', icon: Plug },
      { href: '/dashboard/developers', label: 'المطوّرون', icon: Code2 },
      { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings },
      { href: '/dashboard/settings/domain', label: 'النطاق', icon: Globe },
    ],
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({
  storeName,
  storeSlug,
  storeLogo,
}: {
  storeName: string
  storeSlug: string
  storeLogo: string | null
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {groups.map((group, i) => (
        <div key={i} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-xs font-medium text-[var(--fg-subtle)]">{group.label}</p>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )

  const header = (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4">
      <Image
        src={storeLogo || brand.logo}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg object-contain"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{storeName}</p>
        <p dir="ltr" className="truncate text-start text-xs text-[var(--fg-subtle)]">
          {storeSlug}
        </p>
      </div>
    </div>
  )

  const footer = (
    <div className="border-t border-[var(--border)] p-3">
      <Link
        href="/dashboard/subscription"
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
      >
        <Crown className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        الاشتراك
      </Link>
    </div>
  )

  return (
    <>
      {/* شريط الموبايل */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          className="-ms-2 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="truncate text-sm font-semibold">{storeName}</span>
      </div>

      {/* الدرج على الموبايل */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--color-ink-950)]/50"
          />
          <aside className="absolute inset-y-0 start-0 flex w-[min(18rem,85vw)] flex-col bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pe-2">
              <div className="min-w-0 flex-1">{header}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* الشريط الثابت على الشاشات الكبيرة */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col border-e border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md lg:flex">
        {header}
        {nav}
        {footer}
      </aside>
    </>
  )
}
