/**
 * بيانات شاشة الشحنات — نفس شكل `/api/app/shipments` (src/lib/app-shipments.ts).
 */
import { getAppJson } from './analytics-api'

export type ShipmentItem = {
  id: string
  orderId: string
  orderNumber: string
  customerName: string | null
  customerPhone: string | null
  city: string | null
  carrierLabel: string
  trackingNumber: string | null
  trackingUrl: string | null
  status: string
  statusLabel: string
  bg: string
  fg: string
  codAmount: number
  collected: boolean
  createdAt: string
  nextStatus?: string | null
  nextLabel?: string | null
}

export type PendingShipment = {
  orderId: string
  orderNumber: string
  customerName: string | null
  city: string | null
  total: number
  cod: boolean
  paid: boolean
  codDefault?: number
}

export type ShipmentsPayload = {
  currency: string
  autoCarrier: string | null
  /* من 2.4 — لو الموقع أقدم، التسجيل وتغيير الحالة بيفتحوا صفحة المنصة */
  carriers?: Array<{ key: string; label: string }>
  statuses?: Array<{ key: string; label: string; bg: string; fg: string }>
  stats: { inTransit: number; failed: number; outstandingAmount: number; outstandingCount: number }
  pending: PendingShipment[]
  shipments: ShipmentItem[]
}

const KEY = 'zw-shipments:v1'

export function readShipmentsCache(): { at: number; data: ShipmentsPayload } | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearShipmentsCache(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* تجاهل */
  }
}

export async function fetchShipments() {
  const res = await getAppJson<ShipmentsPayload>('/api/app/shipments')
  if (res.kind === 'ok') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: res.at, data: res.data }))
    } catch {
      /* الشاشة شغّالة من غير كاش */
    }
  }
  return res
}
