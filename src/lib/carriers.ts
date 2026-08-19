/**
 * شركات الشحن وحالات الشحنة.
 *
 * من غير `server-only`: نفس القوائم بتستخدمها لوحة التاجر (متصفح)
 * وصفحة تتبّع الطلب في المتجر — المصدر واحد والاتنين بيقروا منه.
 *
 * الربط بالـAPI بتاع كل شركة محتاج تعاقد وحساب تجاري. لحد ما ده
 * يحصل، التاجر بيسجّل الشحنة يدويًا (بيعمل البوليصة على لوحة الشركة
 * وينسخ رقم التتبّع هنا) — وده اللي ٩٠٪ من التجّار الصغيرين بيعملوه
 * أصلًا. رابط التتبّع بيخلّي الرقم قابل للضغط، للتاجر وللعميل.
 */

export type CarrierKey = 'bosta' | 'mylerz' | 'jt' | 'wavex' | 'sprint' | 'r2s' | 'aramex' | 'other'

export type Carrier = {
  key: CarrierKey
  label: string
  /** رابط صفحة التتبّع — {n} بيتبدّل برقم البوليصة */
  trackUrl: string | null
}

export const CARRIERS: Carrier[] = [
  { key: 'bosta', label: 'بوسطة', trackUrl: 'https://bosta.co/tracking-shipments?tracking-number={n}' },
  { key: 'mylerz', label: 'مايلرز', trackUrl: 'https://mylerz.net/tracking?awb={n}' },
  { key: 'jt', label: 'J&T Express', trackUrl: 'https://www.jtexpress-eg.com/trajectoryQuery?waybillNo={n}' },
  { key: 'wavex', label: 'ويف إكس', trackUrl: null },
  { key: 'sprint', label: 'سبرينت', trackUrl: null },
  { key: 'r2s', label: 'R2S', trackUrl: null },
  { key: 'aramex', label: 'أرامكس', trackUrl: 'https://www.aramex.com/eg/en/track/shipments?ShipmentNumber={n}' },
  { key: 'other', label: 'شركة تانية', trackUrl: null },
]

export function carrierMeta(key: string): Carrier {
  return CARRIERS.find((c) => c.key === key) ?? CARRIERS[CARRIERS.length - 1]
}

/** رابط تتبّع جاهز، أو null لو الشركة مالهاش صفحة تتبّع عامة */
export function trackingUrl(carrier: string, trackingNumber: string | null): string | null {
  const meta = carrierMeta(carrier)
  if (!meta.trackUrl || !trackingNumber) return null
  return meta.trackUrl.replace('{n}', encodeURIComponent(trackingNumber))
}

export type ShipmentStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned'

export const SHIPMENT_STATUSES: Array<{
  key: ShipmentStatus
  label: string
  bg: string
  fg: string
  /** ترتيب المسار الطبيعي — للخطوة المقترحة. null يعني نهاية غير ناجحة */
  step: number | null
}> = [
  { key: 'created', label: 'اتسجّلت', bg: 'var(--color-info-soft)', fg: 'var(--color-info)', step: 0 },
  { key: 'picked_up', label: 'المندوب استلمها', bg: 'var(--primary-soft)', fg: 'var(--primary)', step: 1 },
  { key: 'in_transit', label: 'في الطريق', bg: 'var(--primary-soft)', fg: 'var(--primary)', step: 2 },
  { key: 'out_for_delivery', label: 'خرجت للتسليم', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)', step: 3 },
  { key: 'delivered', label: 'اتسلّمت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)', step: 4 },
  { key: 'failed', label: 'فشل التسليم', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', step: null },
  { key: 'returned', label: 'رجعت للمتجر', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', step: null },
]

export function shipmentStatusMeta(status: string) {
  return SHIPMENT_STATUSES.find((s) => s.key === status) ?? SHIPMENT_STATUSES[0]
}

/** الخطوة اللي المنطقي التاجر يسجّلها بعد الحالة الحالية */
export function nextShipmentStatus(status: string): ShipmentStatus | null {
  const path: ShipmentStatus[] = ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered']
  const i = path.indexOf(status as ShipmentStatus)
  if (i === -1 || i === path.length - 1) return null
  return path[i + 1]
}
