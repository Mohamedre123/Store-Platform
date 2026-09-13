/**
 * أقسام قايمة «المزيد» — نسخة من `NAV` في `src/components/dashboard/sidebar.tsx`.
 *
 * ## ليه نسخة مش قراءة من المنصة
 * القايمة في المنصة بتترسم بس لما تتفتح، وملفها «use client» فمسارات
 * الخادم ما تقدرش تستوردها. فالأقسام هنا بنفس الترتيب والأسماء والروابط
 * والصلاحيات. **أي قسم يتضاف أو يتغيّر في القايمة الجانبية لازم يتعدّل
 * هنا كمان** (مكتوب في CLAUDE.md).
 */
import { icons } from '../icons'

export type NavChild = { href: string; label: string; permission?: string }
export type NavSection = {
  href: string
  label: string
  icon: () => string
  permission?: string
  children?: NavChild[]
}

export const NAV: NavSection[] = [
  { href: '/dashboard', label: 'الرئيسية', icon: icons.house },
  {
    href: '/dashboard/orders',
    label: 'الطلبات',
    icon: icons.bag,
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
    icon: icons.package,
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
    icon: icons.users,
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
    href: '/dashboard/studio',
    label: 'المحتوى والنشر',
    icon: icons.sparkles,
    permission: 'marketing.manage',
    children: [
      { href: '/dashboard/studio', label: 'استوديو المحتوى' },
      { href: '/dashboard/studio/posts', label: 'البوستات' },
      { href: '/dashboard/studio/schedules', label: 'النشر التلقائي' },
      { href: '/dashboard/studio/accounts', label: 'حسابات السوشيال' },
    ],
  },
  {
    href: '/dashboard/marketing',
    label: 'التسويق',
    icon: icons.megaphone,
    permission: 'marketing.manage',
    children: [
      { href: '/dashboard/marketing', label: 'الكوبونات والعروض' },
      { href: '/dashboard/landing', label: 'صفحات الهبوط' },
      { href: '/dashboard/affiliates', label: 'المسوّقون' },
      { href: '/dashboard/marketing/campaigns', label: 'حملات البريد' },
      { href: '/dashboard/automations', label: 'الأتمتة' },
      { href: '/dashboard/analytics', label: 'التحليلات', permission: 'reports.view' },
      { href: '/dashboard/analytics/live', label: 'العرض المباشر', permission: 'reports.view' },
      { href: '/dashboard/analytics/signal', label: 'جودة إشارة التحويل', permission: 'reports.view' },
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
    icon: icons.store,
    permission: 'storefront.manage',
    children: [
      { href: '/dashboard/storefront', label: 'الثيم والتصميم' },
      { href: '/dashboard/storefront/banners', label: 'البانرات' },
      { href: '/dashboard/media', label: 'معرض الوسائط' },
      { href: '/dashboard/blog', label: 'المدوّنة', permission: 'storefront.manage' },
      { href: '/dashboard/settings/pages', label: 'صفحات المتجر', permission: 'storefront.manage' },
      { href: '/dashboard/landing', label: 'صفحات الهبوط' },
    ],
  },
  { href: '/dashboard/payments', label: 'الدفع', icon: icons.creditCard, permission: 'settings.manage' },
  { href: '/dashboard/shipping', label: 'الشحن', icon: icons.truck, permission: 'settings.manage' },
  { href: '/dashboard/plugins', label: 'الإضافات', icon: icons.plug, permission: 'settings.manage' },
  { href: '/dashboard/referrals', label: 'حِيل صاحبك', icon: icons.share },
  {
    href: '/dashboard/settings',
    label: 'الإعدادات',
    icon: icons.settings,
    permission: 'settings.manage',
    children: [
      { href: '/dashboard/settings', label: 'بيانات المتجر' },
      { href: '/dashboard/settings/checkout', label: 'الشيك أوت' },
      { href: '/dashboard/settings/orders', label: 'الطلبات والترقيم' },
      { href: '/dashboard/settings/domain', label: 'النطاق' },
      { href: '/dashboard/markets', label: 'الأسواق والعملات' },
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

/** نفس `allowed` في القايمة الجانبية بالحرف */
export function allowedBy(role: string | null, permissions: string[] | null) {
  return (permission?: string) => {
    if (!permission) return true
    if (role === null || permissions === null) return true
    if (role === 'owner' || role === 'admin') return true
    if (permissions.length === 0) return true
    return permissions.includes(permission)
  }
}
