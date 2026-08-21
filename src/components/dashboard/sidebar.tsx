'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
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
  ChevronDown,
  Code2,
  Gift,
  Zap,
  LayoutTemplate,
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

/**
 * قائمة التنقّل.
 *
 * ٢٢ عنصرًا مسطّحين كانوا بيخبّوا المحتوى: التاجر ما يعرفش إن جوّه
 * «الطلبات» فيه السلات المتروكة إلا لما يدخل ويستكشف. الأقسام هنا
 * بتكشف اللي جوّاها من برّه، والقسم بيفضل مفتوح لو التاجر جوّاه.
 *
 * نفس القائمة بتتحوّل لتبويبات جوّه الصفحات — فلو دخل من رابط مباشر
 * يشوف إخوان الصفحة قدامه برضه.
 */
export type NavChild = { href: string; label: string }
export type NavSection = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  children?: NavChild[]
}

export const NAV: NavSection[] = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  {
    href: '/dashboard/orders',
    label: 'الطلبات',
    icon: ShoppingBag,
    children: [
      { href: '/dashboard/orders', label: 'كل الطلبات' },
      { href: '/dashboard/orders?filter=incomplete', label: 'السلات المتروكة' },
      { href: '/dashboard/shipments', label: 'الشحنات' },
      { href: '/dashboard/returns', label: 'المرتجعات' },
    ],
  },
  {
    href: '/dashboard/products',
    label: 'المنتجات',
    icon: Package,
    children: [
      { href: '/dashboard/products', label: 'كل المنتجات' },
      { href: '/dashboard/products/categories', label: 'الأقسام' },
      { href: '/dashboard/inventory', label: 'المخزون' },
      { href: '/dashboard/suppliers', label: 'الموردون' },
    ],
  },
  {
    href: '/dashboard/customers',
    label: 'العملاء',
    icon: Users,
    children: [
      { href: '/dashboard/customers', label: 'كل العملاء' },
      { href: '/dashboard/loyalty', label: 'الولاء والنقاط' },
      { href: '/dashboard/reviews', label: 'المراجعات' },
    ],
  },
  {
    href: '/dashboard/marketing',
    label: 'التسويق',
    icon: Megaphone,
    children: [
      { href: '/dashboard/marketing', label: 'الكوبونات والعروض' },
      { href: '/dashboard/landing', label: 'صفحات الهبوط' },
      { href: '/dashboard/affiliates', label: 'المسوّقون' },
      { href: '/dashboard/automations', label: 'الأتمتة' },
      { href: '/dashboard/analytics', label: 'التحليلات' },
      { href: '/dashboard/experiments', label: 'تجارب A/B' },
    ],
  },
  {
    href: '/dashboard/storefront',
    label: 'المتجر',
    icon: Store,
    children: [
      { href: '/dashboard/storefront', label: 'الثيم والتصميم' },
      { href: '/dashboard/storefront/banners', label: 'البانرات' },
      { href: '/dashboard/blog', label: 'المدوّنة' },
      { href: '/dashboard/settings/pages', label: 'صفحات المتجر' },
    ],
  },
  /*
    الدفع والشحن والإضافات أقسام مستقلة لا بنود جوّه الإعدادات.

    التلاتة دول التاجر بيدخلهم وهو بيجهّز متجره وكل ما يضيف مزوّد —
    مش «إعداد بيتظبّط مرة». ودفنهم جوّه قائمة منسدلة كان بيخلّي
    ربط بوابة الدفع يبان خطوة إدارية، وهي أهم خطوة في المتجر كله.
  */
  { href: '/dashboard/payments', label: 'الدفع', icon: CreditCard },
  { href: '/dashboard/shipping', label: 'الشحن', icon: Truck },
  { href: '/dashboard/plugins', label: 'الإضافات', icon: Plug },
  {
    href: '/dashboard/settings',
    label: 'الإعدادات',
    icon: Settings,
    children: [
      { href: '/dashboard/settings', label: 'بيانات المتجر' },
      { href: '/dashboard/settings/domain', label: 'النطاق' },
      { href: '/dashboard/messages', label: 'سجل الرسايل' },
      { href: '/dashboard/settings/activity', label: 'سجل النشاط' },
      { href: '/dashboard/developers', label: 'المطوّرون' },
    ],
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * القسم نشط لو المسار الحالي جوّاه أو جوّه أي عنصر تابع له.
 *
 * لازم نفحص الأتباع كمان: «المرتجعات» تحت «الطلبات» بس مسارها
 * ‎/dashboard/returns‎ اللي مش بيبدأ بـ‎/dashboard/orders‎.
 */
function sectionActive(pathname: string, section: NavSection) {
  if (isActive(pathname, section.href)) return true
  return (section.children ?? []).some((c) => isActive(pathname, c.href.split('?')[0]))
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
  const search = useSearchParams()
  const [open, setOpen] = useState(false)
  // الأقسام اللي التاجر فتحها أو طواها بإيده — بتغلب الفتح التلقائي
  const [manual, setManual] = useState<Record<string, boolean>>({})

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map((section) => {
        const Icon = section.icon
        const inSection = sectionActive(pathname, section)
        // القسم مفتوح لو إحنا جوّاه، أو لو التاجر فتحه بنفسه
        const expanded = section.children ? (manual[section.href] ?? inSection) : false

        return (
          <div key={section.href} className="flex flex-col">
            <div
              className={cn(
                'flex items-center rounded-lg transition-colors',
                inSection
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
              )}
            >
              <Link
                href={section.href}
                onClick={() => {
                  // الدوس على القسم بيفتحه ويروح لصفحته الرئيسية معًا
                  if (section.children) setManual((m) => ({ ...m, [section.href]: true }))
                  setOpen(false)
                }}
                aria-current={isActive(pathname, section.href) ? 'page' : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium"
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="truncate">{section.label}</span>
              </Link>

              {section.children && (
                <button
                  type="button"
                  onClick={() => setManual((m) => ({ ...m, [section.href]: !expanded }))}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'اطوِ' : 'افتح'} ${section.label}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {section.children && expanded && (
              <div className="mt-0.5 flex flex-col gap-0.5 border-s border-[var(--border)] ms-5 ps-2">
                {section.children.map((child) => {
                  /**
                   * المقارنة بتشمل الاستعلام: «كل الطلبات» و«السلات
                   * المتروكة» نفس المسار وبيفرّقهم ‎?filter=‎ بس.
                   * بنقراه من useSearchParams لا من window عشان الخادم
                   * والمتصفح يرسموا نفس الحاجة.
                   */
                  const [childPath, childQuery] = child.href.split('?')
                  const childActive =
                    pathname === childPath && (childQuery ?? '') === (search.toString() || '')
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'truncate rounded-lg px-3 py-2 text-sm transition-colors',
                        childActive
                          ? 'font-medium text-[var(--primary)]'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
                      )}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
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
