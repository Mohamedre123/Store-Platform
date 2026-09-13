/**
 * المسارات اللي ليها شاشة أصلية في التطبيق.
 *
 * الشاشة الأصلية بتظهر فورًا من الكاش لحظة الضغطة، فمش محتاجة الهيكل
 * المؤقت (`page-placeholder.ts`). أي مسار تاني صفحة من المنصة بتستنى
 * الخادم — وهي اللي بياخد الهيكل.
 *
 * أي شاشة أصلية جديدة تتضاف في `shell/index.tsx` لازم تتضاف هنا كمان.
 */
const NATIVE: RegExp[] = [
  /^\/dashboard$/,
  /^\/dashboard\/orders$/,
  /^\/dashboard\/orders\/(?!new$)[^/]+$/,
  /^\/dashboard\/products$/,
  /^\/dashboard\/products\/[0-9a-f-]{36}$/i,
  /^\/dashboard\/customers$/,
  /^\/dashboard\/customers\/[0-9a-f-]{36}$/i,
  /^\/dashboard\/analytics$/,
  /^\/dashboard\/shipments$/,
  /^\/dashboard\/marketing$/,
  /^\/dashboard\/inventory$/,
  /^\/dashboard\/messages$/,
  /^\/dashboard\/subscription$/,
  /^\/dashboard\/settings$/,
  /^\/dashboard\/products\/new$/,
  /^\/dashboard\/reviews$/,
  /^\/dashboard\/returns$/,
  /^\/dashboard\/complaints$/,
  /^\/dashboard\/customers\/blocked$/,
  /^\/dashboard\/couriers$/,
  /^\/dashboard\/bookings$/,
  /^\/dashboard\/expenses$/,
  /^\/dashboard\/suppliers$/,
  /^\/dashboard\/products\/categories$/,
  /^\/dashboard\/products\/trash$/,
  /^\/dashboard\/loyalty$/,
  /^\/dashboard\/affiliates$/,
  /^\/dashboard\/referrals$/,
  /^\/dashboard\/media$/,
  /^\/dashboard\/blog$/,
]

export function isNativePath(url: URL): boolean {
  if (url.searchParams.get('web') === '1') return false
  const path = url.pathname.replace(/\/+$/, '') || '/'
  return NATIVE.some((re) => re.test(path))
}
