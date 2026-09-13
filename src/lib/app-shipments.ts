import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadShipments } from '@/lib/shipments-data'
import { carrierMeta, shipmentStatusMeta, trackingUrl } from '@/lib/carriers'
import { formatOrderNumber } from '@/lib/order-number'

/** شكل الشحنات اللي تطبيق الموبايل بيستلمه — المبالغ بالوحدة الصغرى والتواريخ ISO */
export async function shipmentsPayload(store: ActiveStore) {
  const data = await loadShipments(store)

  return {
    currency: store.currency,
    autoCarrier: data.autoCarrierName,
    stats: {
      inTransit: data.inTransit,
      failed: data.failed,
      outstandingAmount: data.outstandingAmount,
      outstandingCount: data.outstandingCount,
    },
    pending: data.pending.map((p) => ({
      orderId: p.id,
      orderNumber: formatOrderNumber(store, p.orderNumber),
      customerName: p.customerName,
      city: p.city,
      total: p.total,
      cod: p.paymentMethod === 'cod',
      paid: p.paymentStatus === 'paid',
    })),
    shipments: data.rows.map((s) => {
      const meta = shipmentStatusMeta(s.status)
      return {
        id: s.id,
        orderId: s.orderId,
        orderNumber: formatOrderNumber(store, s.orderNumber),
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        city: s.city,
        carrierLabel: carrierMeta(s.carrier).label,
        trackingNumber: s.trackingNumber,
        trackingUrl: trackingUrl(s.carrier, s.trackingNumber),
        status: s.status,
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
        codAmount: s.codAmount,
        collected: s.isCodCollected || Boolean(s.settledAt),
        createdAt: new Date(s.createdAt).toISOString(),
      }
    }),
  }
}
