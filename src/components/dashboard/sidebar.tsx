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
  ExternalLink,
  LogOut,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Package,
  Globe,
  Plug,
  Settings,
  ShieldCheck,
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
/**
 * الصلاحية اللي البند محتاجها عشان يبان.
 *
 * الإخفاء هنا **راحة مش حماية**: الصفحة نفسها بتنادي `guard()`
 * وبترجّع ٤٠٤، والفعل بينادي `assertCan()`. الفايدة إن الموظف
 * ما يقعدش يبص على أقسام هيلاقي بابها مقفول.
 */
export type NavChild = { href: string; label: string; permission?: string }
export type NavSection = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  permission?: string
  children?: NavChild[]
}

export const NAV: NavSection[] = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  {
    href: '/dashboard/orders',
    label: 'الطلبات',
    icon: ShoppingBag,
    permission: 'orders.view',
    children: [
      { href: '/dashboard/orders', label: 'كل الطلبات' },
      { href: '/dashboard/orders/new', label: 'طلب جديد', permission: 'orders.manage' },
      { href: '/dashboard/orders?filter=incomplete', label: 'السلات المتروكة' },
      { href: '/dashboard/shipments', label: 'الشحنات' },
      { href: '/dashboard/couriers', label: 'المندوبون', permission: 'orders.manage' },
      { href: '/dashboard/returns', label: 'المرتجعات' },
      { href: '/dashboard/bookings', label: 'الحجوزات' },
    ],
  },
  {
    href: '/dashboard/products',
    label: 'المنتجات',
    icon: Package,
    permission: 'products.view',
    children: [
      { href: '/dashboard/products', label: 'كل المنتجات' },
      { href: '/dashboard/products/import', label: 'استيراد منتجات', permission: 'products.manage' },
      { href: '/dashboard/products/categories', label: 'الأقسام' },
      { href: '/dashboard/inventory', label: 'المخزون', permission: 'inventory.manage' },
      { href: '/dashboard/inventory/branches', label: 'الفروع والمخازن', permission: 'inventory.manage' },
      { href: '/dashboard/suppliers', label: 'الموردون', permission: 'inventory.manage' },
      { href: '/dashboard/products/trash', label: 'سلة المهملات', permission: 'products.manage' },
    ],
  },
  {
    href: '/dashboard/customers',
    label: 'العملاء',
    icon: Users,
    permission: 'customers.view',
    children: [
      { href: '/dashboard/customers', label: 'كل العملاء' },
      { href: '/dashboard/customers?filter=subscribers', label: 'المشتركون' },
      { href: '/dashboard/loyalty', label: 'الولاء والنقاط' },
      { href: '/dashboard/reviews', label: 'المراجعات' },
      { href: '/dashboard/complaints', label: 'الشكاوى', permission: 'orders.view' },
      { href: '/dashboard/customers/blocked', label: 'الحظر', permission: 'orders.manage' },
    ],
  },
  {
    href: '/dashboard/marketing',
    label: 'التسويق',
    icon: Megaphone,
    permission: 'marketing.manage',
    children: [
      { href: '/dashboard/marketing', label: 'الكوبونات والعروض' },
      { href: '/dashboard/landing', label: 'صفحات الهبوط' },
      { href: '/dashboard/affiliates', label: 'المسوّقون' },
      { href: '/dashboard/marketing/campaigns', label: 'حملات البريد' },
      { href: '/dashboard/automations', label: 'الأتمتة' },
      { href: '/dashboard/analytics', label: 'التحليلات', permission: 'reports.view' },
      { href: '/dashboard/analytics/live', label: 'العرض المباشر', permission: 'reports.view' },
      { href: '/dashboard/analytics/reports', label: 'تقارير مفصّلة', permission: 'reports.view' },
      { href: '/dashboard/expenses', label: 'المصروفات والأرباح', permission: 'finance.view' },
      { href: '/dashboard/experiments', label: 'تجارب A/B' },
      { href: '/dashboard/marketing/channels', label: 'قنوات البيع', permission: 'marketing.manage' },
      { href: '/dashboard/marketplace', label: 'ربط الكتالوج' },
    ],
  },
  {
    href: '/dashboard/storefront',
    label: 'المتجر',
    icon: Store,
    permission: 'storefront.manage',
    children: [
      { href: '/dashboard/storefront', label: 'الثيم والتصميم' },
      { href: '/dashboard/storefront/banners', label: 'البانرات' },
      { href: '/dashboard/media', label: 'معرض الوسائط' },
      { href: '/dashboard/blog', label: 'المدوّنة', permission: 'storefront.manage' },
      { href: '/dashboard/settings/pages', label: 'صفحات المتجر', permission: 'storefront.manage' },
      /*
        صفحات الهبوط هنا كمان لا في التسويق بس.

        التاجر بيدوّر عليها جنب «صفحات المتجر» لأن الاتنين صفحات —
        ودفنها في التسويق كان بيخلّيه يفتكر إنها مش موجودة أصلًا.
      */
      { href: '/dashboard/landing', label: 'صفحات الهبوط' },
    ],
  },
  /*
    الدفع والشحن والإضافات أقسام مستقلة لا بنود جوّه الإعدادات.

    التلاتة دول التاجر بيدخلهم وهو بيجهّز متجره وكل ما يضيف مزوّد —
    مش «إعداد بيتظبّط مرة». ودفنهم جوّه قائمة منسدلة كان بيخلّي
    ربط بوابة الدفع يبان خطوة إدارية، وهي أهم خطوة في المتجر كله.
  */
  { href: '/dashboard/payments', label: 'الدفع', icon: CreditCard, permission: 'settings.manage' },
  { href: '/dashboard/shipping', label: 'الشحن', icon: Truck, permission: 'settings.manage' },
  { href: '/dashboard/plugins', label: 'الإضافات', icon: Plug, permission: 'settings.manage' },
  {
    href: '/dashboard/settings',
    label: 'الإعدادات',
    icon: Settings,
    permission: 'settings.manage',
    children: [
      { href: '/dashboard/settings', label: 'بيانات المتجر' },
      { href: '/dashboard/settings/checkout', label: 'الشيك أوت' },
      { href: '/dashboard/settings/orders', label: 'الطلبات والترقيم' },
      { href: '/dashboard/settings/domain', label: 'النطاق' },
      { href: '/dashboard/settings/seo', label: 'الظهور والسيو' },
      { href: '/dashboard/settings/email', label: 'بريد المتجر' },
      { href: '/dashboard/settings/receipt', label: 'صفحة الطلب' },
      { href: '/dashboard/messages', label: 'سجل الرسايل', permission: 'orders.view' },
      { href: '/dashboard/settings/activity', label: 'سجل النشاط' },
      { href: '/dashboard/settings/sessions', label: 'الأجهزة والجلسات', permission: 'orders.view' },
      { href: '/dashboard/settings/team', label: 'الفريق', permission: 'orders.view' },
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
  storeUrl,
  userName,
  userEmail,
  isPlatformAdmin,
  role,
  permissions,
  onLogout,
}: {
  storeName: string
  storeSlug: string
  storeLogo: string | null
  /**
   * كل حاجة كانت في الشريط العلوي بتاع الديسكتوب بتتمرّر هنا كمان.
   *
   * الشريط ده `hidden lg:flex`، يعني على الموبايل كان **مفيش تسجيل
   * خروج ولا رابط للمتجر خالص** — التاجر اللي بيشتغل من موبايله
   * ما كانش يقدر يخرج من حسابه. القايمة الجانبية هي المكان الطبيعي
   * ليهم على الشاشة الصغيرة.
   */
  storeUrl: string
  userName: string
  userEmail: string
  /**
   * لوحة إدارة المنصة — بتظهر لحساب الإدارة وحده.
   *
   * البند بيتخفي هنا، لكن الإخفاء ده راحة مش حماية: المسار نفسه
   * بيرجّع 404 وكل فعل جوّاه بيعيد فحص الصلاحية.
   */
  isPlatformAdmin: boolean
  /**
   * دور المستخدم وصلاحياته في المتجر ده.
   *
   * بتيجي من الخادم مع التخطيط: القايمة بتترسم بالصلاحيات من أول
   * رسمة، فالموظف ما بيشوفش بندًا وبعدين يختفي منه.
   */
  role: string
  permissions: string[]
  onLogout: () => void
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  const [open, setOpen] = useState(false)
  // الأقسام اللي التاجر فتحها أو طواها بإيده — بتغلب الفتح التلقائي
  const [manual, setManual] = useState<Record<string, boolean>>({})

  /**
   * البند ده مسموح؟
   *
   * نسخة خفيفة من `can()` بتاعة الخادم: المالك عنده كل حاجة،
   * والقايمة الفاضية معناها «افتراضيات دورك» — والافتراضيات دي
   * أوسع من الفاضي، فبنسيب البند ظاهر والصفحة هي اللي بتحسم.
   * الحسم النهائي على الخادم في كل الحالات.
   */
  const allowed = (permission?: string) => {
    if (!permission) return true
    if (role === 'owner' || role === 'admin') return true
    if (permissions.length === 0) return true
    return permissions.includes(permission)
  }

  const sections = NAV.filter((s) => allowed(s.permission)).map((s) => ({
    ...s,
    children: s.children?.filter((c) => allowed(c.permission)),
  }))

  /**
   * بنود الشريط السفلي — أول تلاتة مسموحين من القايمة.
   *
   * مش مكتوبين بأسمائهم عن قصد: الموظف اللي مالوش صلاحية المنتجات
   * كان هيلاقي زرارًا يرجّعله ٤٠٤ في أهم مكان في الشاشة. الاشتقاق
   * من نفس القايمة المفلترة بيخلّي الشريط بتاعه هو.
   */
  const primary = sections.slice(0, 3)

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => {
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
              {/*
                القسم اللي تحته بنود: **زرار فتح على الفون، رابط على
                الديسكتوب**.

                ## ليه الاتنين مختلفين
                على الديسكتوب الشريط الجانبي ثابت وشايل القايمة كلها.
                الدوسة الواحدة اللي بتروح للصفحة وبتفتح البنود معاها
                مكسب — القايمة فاضلة قدامك بعدها.

                على الفون القايمة **شاشة كاملة بتتقفل** لما تروح
                لصفحة. فالدوسة على «المنتجات» كانت بتودّي لقايمة
                المنتجات وتقفل اللوحة قبل ما التاجر يشوف إن جوّاها
                «الأقسام» و«المخزون» و«الفروع» — يعني الأقسام الفرعية
                كانت شبه مخفية عنه.

                هنا الدوسة بتفتح البنود وبس، والتاجر هو اللي بيختار.
              */}
              {section.children ? (
                <>
                  <button
                    type="button"
                    onClick={() => setManual((m) => ({ ...m, [section.href]: !expanded }))}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-start text-sm font-medium lg:hidden"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{section.label}</span>
                  </button>

                  <Link
                    href={section.href}
                    onClick={() => {
                      setManual((m) => ({ ...m, [section.href]: true }))
                      setOpen(false)
                    }}
                    aria-current={isActive(pathname, section.href) ? 'page' : undefined}
                    className="hidden min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium lg:flex"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{section.label}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setManual((m) => ({ ...m, [section.href]: !expanded }))}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'اطوِ' : 'افتح'} ${section.label}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg lg:h-9 lg:w-9"
                  >
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                </>
              ) : (
                <Link
                  href={section.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(pathname, section.href) ? 'page' : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-sm font-medium lg:py-2.5"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="truncate">{section.label}</span>
                </Link>
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
      {isPlatformAdmin && (
        <Link
          href="/dashboard/admin"
          onClick={() => setOpen(false)}
          aria-current={isActive(pathname, '/dashboard/admin') ? 'page' : undefined}
          className={cn(
            'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
            isActive(pathname, '/dashboard/admin')
              ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
              : 'text-[var(--primary)] hover:bg-[var(--primary-soft)]',
          )}
        >
          <ShieldCheck className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          إدارة المنصة
        </Link>
      )}

      <Link
        href="/dashboard/subscription"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
      >
        <Crown className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        الاشتراك
      </Link>

      {/*
        دول على الموبايل بس: على الديسكتوب مكانهم الشريط العلوي،
        وتكرارهم في الاتنين بيخلّي زرارين لنفس الإجراء في الشاشة
        الواحدة.
      */}
      <div className="mt-2 flex flex-col gap-1 border-t border-[var(--border)] pt-2 lg:hidden">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
        >
          <ExternalLink className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          عرض المتجر
        </a>

        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
            {userName.trim().slice(0, 2) || '؟'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{userName}</span>
            <span dir="ltr" className="block truncate text-start text-xs text-[var(--fg-subtle)]">
              {userEmail}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <>
{/*
        شريط الموبايل.

        **لونه صلب لا شفّاف.** الشفافية كانت بتخلّي الخلفية المتحركة
        تبان من وراه بلون مختلف شوية عن الصفحة، فيبان كأنه شريحة
        سايبة مش جزء من الصفحة. و`safe-top` بيدّيه مساحة النوتش
        عشان ما يتحشرش تحت ساعة التليفون.
      */}
      <div className="safe-top sticky top-0 z-40 flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
        <Image
          src={storeLogo || brand.logo}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-lg object-contain"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{storeName}</span>

        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="عرض المتجر"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <ExternalLink className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>

      {/*
        «المزيد» — لوحة كاملة لا درج جانبي.

        الدرج كان بياخد ٨٥٪ من العرض وبيسيب شريطًا من الصفحة القديمة
        على الجنب: التاجر شايف نُص حاجة ونُص حاجة، وبيدوس على الشريط
        بالغلط فتتقفل عليه. اللوحة الكاملة قرار واحد — إما أنت في
        القايمة أو في الصفحة.
      */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)] lg:hidden">
          <div className="safe-top flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
            <span className="text-base font-bold">المزيد</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {nav}
            {footer}
          </div>
        </div>
      )}

      {/*
        الشريط السفلي — التنقّل الأساسي على الفون.

        ## ليه تحت لا فوق
        الإبهام بيوصل لتحت الشاشة، ومش بيوصل لأعلى زاوية من غير ما
        اليد التانية تمسك. التاجر بيدير متجره وهو ماشي وواقف في
        المخزن — والقايمة اللي محتاجة إيدين مش قايمة.

        ## وتلات بنود بس + «المزيد»
        دول اللي بيتفتحوا كل يوم. أي حاجة أكتر بتخلّي كل زرار أصغر
        من مساحة اللمس المريحة، والتاجر يدوس على اللي جنبه.
      */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--surface)] lg:hidden"
        aria-label="التنقّل السريع"
      >
        {primary.map((item) => {
          const Icon = item.icon
          const on = isActive(pathname, item.href)

          /*
            البند اللي تحته بنود بيفتح القايمة عليه مفتوحًا — ما
            بيروحش لصفحة.

            نفس السبب اللي في اللوحة: «المنتجات» جوّاها الأقسام
            والمخزون والفروع والموردين وسلة المهملات. الدوسة اللي
            بتودّي لقايمة المنتجات على طول بتخبّي الخمسة دول، والتاجر
            على الفون مالوش شريط جانبي يفكّره بيهم.
          */
          if (item.children?.length) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  setManual((m) => ({ ...m, [item.href]: true }))
                  setOpen(true)
                }}
                aria-expanded={open}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  on ? 'text-[var(--primary)]' : 'text-[var(--fg-muted)]',
                )}
              >
                <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                {item.label}
              </button>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                on ? 'text-[var(--primary)]' : 'text-[var(--fg-muted)]',
              )}
            >
              <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
            open ? 'text-[var(--primary)]' : 'text-[var(--fg-muted)]',
          )}
        >
          <MoreHorizontal className="h-[22px] w-[22px]" aria-hidden="true" />
          المزيد
        </button>
      </nav>

      {/* الشريط الثابت على الشاشات الكبيرة */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col border-e border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md lg:flex">
        {header}
        {nav}
        {footer}
      </aside>
    </>
  )
}
