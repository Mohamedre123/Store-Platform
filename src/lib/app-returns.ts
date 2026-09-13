import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadReturns } from '@/lib/returns-data'
import { RETURN_STATUSES, returnStatusMeta } from '@/lib/returns-meta'
import { formatOrderNumber } from '@/lib/order-number'
import { formatMoney } from '@/lib/utils'

/** شكل المرتجعات اللي تطبيق الموبايل بيستلمه */
export async function returnsPayload(store: ActiveStore) {
  const { rows, open } = await loadReturns(store)
  return {
    open,
    statuses: RETURN_STATUSES.map((s) => ({ key: s.key, label: s.label, bg: s.bg, fg: s.fg })),
    returns: rows.map((r) => {
      const meta = returnStatusMeta(r.status)
      return {
        id: r.id,
        number: String(r.returnNumber),
        typeLabel: r.type === 'exchange' ? 'استبدال' : 'استرداد فلوس',
        status: r.status,
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
        reason: r.reason,
        customerNote: r.customerNote,
        merchantNote: r.merchantNote,
        refundLabel: r.refundAmount > 0 ? formatMoney(r.refundAmount, store.currency) : null,
        orderLabel: formatOrderNumber(store, r.orderNumber),
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        createdAt: new Date(r.createdAt).toISOString(),
      }
    }),
  }
}
