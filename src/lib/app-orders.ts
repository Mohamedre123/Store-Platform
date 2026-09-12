import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadOrderDetail, loadOrdersList } from '@/lib/orders-data'
import { ORDER_STATUSES, nextStatus, statusMeta } from '@/lib/order-status'
import { formatOrderNumber } from '@/lib/order-number'
import { stageMeta } from '@/lib/checkout-stage'
import { TRUST_META } from '@/lib/trust-score'

/**
 * شكل الطلبات اللي تطبيق الموبايل بيستلمه.
 *
 * التواريخ ISO والمبالغ بالوحدة الصغرى — التطبيق بينسّقهم بنفس دوال
 * المنصة. النصوص اللي ليها معنى تجاري (اسم الحالة، رسالة الواتساب،
 * مرحلة السلة) بتتبني هنا مش في التطبيق، عشان تفضل بنفس صياغة اللوحة.
 */

function whatsappText(
  store: ActiveStore,
  order: { customerName: string | null; orderNumber: number; isIncomplete: boolean },
): string {
  const contactName = order.customerName ? ' ' + order.customerName : ''
  return order.isIncomplete
    ? `مرحبًا${contactName}، شفنا إنك كنت بتطلب من ${store.name} وما كمّلتش الطلب. تحب نساعدك؟`
    : `مرحبًا${contactName}، بخصوص طلبك رقم ${formatOrderNumber(store, order.orderNumber)} من ${store.name}`
}

export async function ordersListPayload(store: ActiveStore, filter: string | undefined) {
  const data = await loadOrdersList(store, filter)

  return {
    currency: store.currency,
    canCreate: store.manualOrdersEnabled,
    filter: data.isIncomplete ? 'incomplete' : filter && filter !== 'all' ? filter : 'all',
    totalCount: data.totalCount,
    incompleteCount: data.incompleteCount,
    tabs: data.tabs,
    orders: data.rows.map((o) => {
      const status = o.isIncomplete ? 'incomplete' : o.status
      const trust = o.customerPhone ? data.trust.get(o.customerPhone) : undefined
      return {
        id: o.id,
        number: formatOrderNumber(store, o.orderNumber),
        status,
        statusLabel: statusMeta(status).label,
        incomplete: o.isIncomplete,
        name: o.customerName,
        phone: o.customerPhone,
        email: o.customerEmail,
        city: (o.shippingAddress as { city?: string } | null)?.city ?? null,
        total: o.total,
        createdAt: o.createdAt.toISOString(),
        /* نفس الشارة المصغّرة في اللوحة: العميل الجديد مالوش شارة */
        trust:
          trust && trust.level !== 'new'
            ? { level: trust.level, label: trust.level === 'risky' ? 'خطر' : TRUST_META[trust.level].label }
            : null,
        whatsappText: whatsappText(store, {
          customerName: o.customerName,
          orderNumber: o.orderNumber,
          isIncomplete: o.isIncomplete,
        }),
      }
    }),
  }
}

export async function orderDetailPayload(store: ActiveStore, orderId: string) {
  const detail = await loadOrderDetail(store, orderId)
  if (!detail) return null

  const { order, items, events, trust, assigned } = detail
  const status = order.isIncomplete ? 'incomplete' : order.status
  const address = order.shippingAddress
  const next = order.isIncomplete ? null : nextStatus(order.status)
  const stage = order.isIncomplete ? stageMeta(order.checkoutStage) : null

  return {
    currency: order.currency,
    order: {
      id: order.id,
      number: formatOrderNumber(store, order.orderNumber),
      status,
      statusLabel: statusMeta(status).label,
      incomplete: order.isIncomplete,
      createdAt: order.createdAt.toISOString(),
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail,
      address: address
        ? [address.city, address.area, address.street, address.building].filter(Boolean).join(' — ') || null
        : null,
      notes: order.notes,
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal,
      codFee: order.codFee,
      total: order.total,
      costTotal: order.costTotal,
      profit: order.total - order.costTotal - order.shippingTotal,
      paymentStatus: order.paymentStatus,
      stage: stage ? { label: stage.label, detail: stage.detail } : null,
      confirm: {
        hasPhone: Boolean(order.customerPhone),
        reply: order.customerConfirm ?? null,
        sentAt: order.confirmSentAt ? order.confirmSentAt.toISOString() : null,
        repliedAt: order.customerConfirmAt ? order.customerConfirmAt.toISOString() : null,
      },
    },
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      image: i.image,
      options: i.options ?? [],
      price: i.price,
      quantity: i.quantity,
      total: i.total,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
    trust:
      order.customerPhone && !order.isIncomplete
        ? {
            level: trust.level,
            label: TRUST_META[trust.level].label,
            score: trust.score,
            reasons: trust.reasons,
            networkStores: trust.network.stores,
          }
        : null,
    courier: assigned,
    next: next ? { key: next, label: statusMeta(next).label } : null,
    statuses: ORDER_STATUSES.filter((s) => s.key !== 'incomplete').map((s) => ({ key: s.key, label: s.label })),
    whatsappText: whatsappText(store, order),
  }
}
