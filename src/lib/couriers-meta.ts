/**
 * أسماء وأنواع المندوبين — للجهتين.
 *
 * ملف مستقل عن `couriers.ts` لأن ده `server-only`: الاستعلامات
 * والحساب بيقروا من قاعدة البيانات، والشاشة محتاجة الأسماء والأنواع
 * بس. نفس النمط اللي في `blocklist-meta` و`returns-meta` —
 * المعاني في مكان تقدر تستورده من الجهتين.
 */

export type VehicleKey = 'motorcycle' | 'car' | 'van' | 'foot'

export const VEHICLES: Array<{ key: VehicleKey; label: string }> = [
  { key: 'motorcycle', label: 'موتوسيكل' },
  { key: 'car', label: 'عربية' },
  { key: 'van', label: 'ونش / فان' },
  { key: 'foot', label: 'مشي' },
]

export function vehicleLabel(key: string): string {
  return VEHICLES.find((v) => v.key === key)?.label ?? 'موتوسيكل'
}

/** صف المندوب زي ما الشاشة بتستقبله — بحساباته */
export type CourierRow = {
  id: string
  name: string
  phone: string
  vehicle: VehicleKey
  zones: string[]
  feePerOrder: number
  accessToken: string
  isActive: boolean
  note: string | null
  /** شحنات معاه دلوقتي — لسه ما اتسلّمتش ولا رجعت */
  openCount: number
  /** اتسلّمت خلاص */
  deliveredCount: number
  /** فشلت أو رجعت */
  failedCount: number
  /** فلوس محصّلة معاه لسه ما اتسلّمتش للتاجر */
  dueAmount: number
  /** أجرته على اللي وصّله ولسه ما اتحاسبش عليه */
  feesDue: number
}

/** طلب في إيد المندوب — زي ما صفحته بتستقبله */
export type CourierTask = {
  shipmentId: string
  status: string
  orderId: string
  orderNumber: number
  customerName: string | null
  customerPhone: string | null
  address: string | null
  city: string | null
  /** المبلغ اللي المندوب هيحصّله — صفر لو الطلب مدفوع أونلاين */
  codAmount: number
  isCodCollected: boolean
  notes: string | null
  itemsSummary: string
  createdAt: string
}
