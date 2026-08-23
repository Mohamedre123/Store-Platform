/**
 * تنظيف قيمة النطاق الجذري.
 *
 * التاجر (أو أنا) ممكن يحطها في Vercel بأشكال مختلفة: «https://zawyaeg.site»
 * أو «www.zawyaeg.site» أو «zawyaeg.site/». أي شكل غير المتوقّع كان بيخلّي
 * حساب المضيف يفشل ويعرض 404 على الصفحة الرئيسية. بننظّفها هنا مرة واحدة
 * فيبقى الشكل اللي نكتبه مش مهم.
 */
function normalizeRootDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '') // بروتوكول
    .replace(/\/.*$/, '') // أي مسار بعد الدومين
    .replace(/^www\./, '') // بادئة www
    .replace(/\.$/, '') // نقطة زايدة في الآخر
}

export const ROOT_DOMAIN = normalizeRootDomain(process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000')

/** النطاقات الفرعية المحجوزة للمنصة — لا يجوز لتاجر أن يأخذها */
export const RESERVED_SLUGS = new Set([
  'www', 'app', 'dashboard', 'admin', 'api', 'cdn', 'assets', 'static', 'mail',
  'blog', 'help', 'docs', 'status', 'support', 'billing', 'pay', 'checkout',
  'mcp', 'vip', 'go', 'link', 'ftp', 'smtp', 'ns1', 'ns2', 'zawya', 'store',
  'shop', 'my', 'me', 'test', 'staging', 'dev', 'preview',
])

export type HostKind =
  | { kind: 'marketing' }
  | { kind: 'dashboard' }
  | { kind: 'store'; identifier: string; isCustomDomain: boolean }

/**
 * يحدّد أي واجهة يطلبها المضيف.
 * ثلاث واجهات تتقدّم من نفس التطبيق:
 *   zawya.app            → الموقع التعريفي
 *   dashboard.zawya.app  → لوحة التاجر
 *   <slug>.zawya.app     → متجر التاجر
 *   any-domain.com       → متجر بنطاق مخصّص
 */
export function resolveHost(rawHost: string | null | undefined): HostKind {
  if (!rawHost) return { kind: 'marketing' }

  // إزالة المنفذ وتوحيد الحالة
  const host = rawHost.toLowerCase().split(':')[0].replace(/\.$/, '')
  const root = ROOT_DOMAIN.toLowerCase().split(':')[0]

  if (host === root || host === `www.${root}`) return { kind: 'marketing' }
  if (host === `dashboard.${root}`) return { kind: 'dashboard' }

  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1))
    // نطاقات فرعية متعدّدة المستويات لا تُعتبر متاجر
    if (sub.includes('.')) return { kind: 'marketing' }
    if (RESERVED_SLUGS.has(sub)) return { kind: 'marketing' }
    return { kind: 'store', identifier: sub, isCustomDomain: false }
  }

  /**
   * نطاقات Vercel ليست متاجر أبدًا — هي روابط النشر والمعاينة.
   *
   * من غير الاستثناء ده، لو NEXT_PUBLIC_ROOT_DOMAIN ما اتظبطش صح،
   * أي زيارة لرابط النشر بتتحوّل لبحث عن متجر بنطاق مخصّص، وتفشل.
   * النتيجة: الموقع كله واقع بدل ما يشتغل على رابط Vercel عادي.
   */
  if (host.endsWith('.vercel.app') || host === 'localhost' || host.endsWith('.localhost')) {
    return { kind: 'marketing' }
  }

  // أي مضيف آخر = نطاق مخصّص لمتجر
  return { kind: 'store', identifier: host, isCustomDomain: true }
}

/**
 * النطاقات الفرعية تحتاج دومينًا مملوكًا مع سجل wildcard.
 * قبل شراء الدومين — وعلى نطاقات vercel.app — نرجع للروابط بالمسار
 * (`/s/<slug>`) عشان كل حاجة تفضل قابلة للتجربة من غير ما نستنى.
 */
export const SUBDOMAINS_ENABLED = (() => {
  const explicit = process.env.NEXT_PUBLIC_SUBDOMAINS
  if (explicit === 'on') return true
  if (explicit === 'off') return false
  const host = ROOT_DOMAIN.toLowerCase()
  return !host.endsWith('.vercel.app') && !host.startsWith('localhost') && host.includes('.')
})()

const protocol = () => (ROOT_DOMAIN.startsWith('localhost') ? 'http' : 'https')

export function storeUrl(slug: string, path = '') {
  if (!SUBDOMAINS_ENABLED) return `${protocol()}://${ROOT_DOMAIN}/s/${slug}${path}`
  return `${protocol()}://${slug}.${ROOT_DOMAIN}${path}`
}

export function dashboardUrl(path = '') {
  if (!SUBDOMAINS_ENABLED) return `${protocol()}://${ROOT_DOMAIN}/dashboard${path}`
  return `${protocol()}://dashboard.${ROOT_DOMAIN}${path}`
}

/** يتحقق أن النطاق الفرعي صالح: حروف لاتينية صغيرة وأرقام وشرطات فقط */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 40) return false
  if (RESERVED_SLUGS.has(slug)) return false
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
}

/**
 * أصل المنصة — للروابط اللي بتتلزق عند طرف تالت.
 *
 * الويب هوك بيتلزق في لوحة بوابة الدفع أو شركة الشحن، فلازم يكون
 * رابطًا كاملًا مطلقًا. الرابط النسبي بيشتغل عندنا وبيفشل عندهم،
 * والتاجر ما يكتشفش غير لما أول طلب مايتحدّثش.
 *
 * **ولازم يكون المضيف اللي بيرد فعلًا لا اللي بيحوّل.** `ROOT_DOMAIN`
 * بتتشال منه بادئة `www` عشان حساب النطاقات الفرعية للمتاجر يظبط،
 * فلو الموقع بيرد على `www` والجذر بيعمل تحويل، الويب هوك بيوصل
 * لتحويل — و**التحويل بيضيّع حمولة الـPOST**، يعني تأكيد دفع بيتبعت
 * وما بيوصلش. `NEXT_PUBLIC_SITE_URL` هي اللي بتحسم المضيف الصح.
 */
export function platformOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  if (explicit) return explicit.startsWith('http') ? explicit : `https://${explicit}`
  return `${protocol()}://${ROOT_DOMAIN}`
}
