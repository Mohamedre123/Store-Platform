'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { Banknote, ChevronDown, ExternalLink, Package, Phone, Plus, Trash2, Zap } from 'lucide-react'
import {
  CARRIERS,
  SHIPMENT_STATUSES,
  carrierMeta,
  shipmentStatusMeta,
  trackingUrl,
  type ShipmentStatus,
} from '@/lib/carriers'
import { Card } from '@/components/ui'
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils'
import {
  createShipmentAction,
  dispatchShipmentAction,
  deleteShipmentAction,
  settleCodAction,
  updateShipmentStatusAction,
} from './actions'

export type ShipmentRow = {
  id: string
  carrier: string
  trackingNumber: string | null
  status: ShipmentStatus
  codAmount: number
  shippingCost: number
  isCodCollected: boolean
  settledAt: Date | null
  events: Array<{ at: string; status: string; note?: string }>
  createdAt: Date
  orderId: string
  orderNumber: number
  customerName: string | null
  customerPhone: string | null
  city: string | null
}

export type PendingOrder = {
  id: string
  orderNumber: number
  customerName: string | null
  city: string | null
  total: number
  paymentMethod: string | null
  paymentStatus: string
}

type Filter = 'all' | 'active' | 'unsettled' | 'problem'

export function ShipmentsManager({
  autoCarrier,
  shipments,
  pending,
  currency,
}: {
  shipments: ShipmentRow[]
  pending: PendingOrder[]
  currency: string
  /** الشركة المربوطة بربط تلقائي — null لو التاجر بيسجّل بإيده */
  autoCarrier: string | null
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    if (filter === 'active') {
      return shipments.filter((s) => !['delivered', 'failed', 'returned'].includes(s.status))
    }
    if (filter === 'unsettled') {
      return shipments.filter((s) => s.status === 'delivered' && !s.isCodCollected && s.codAmount > 0)
    }
    if (filter === 'problem') {
      return shipments.filter((s) => ['failed', 'returned'].includes(s.status))
    }
    return shipments
  }, [shipments, filter])

  const tabs: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'الكل', count: shipments.length },
    {
      key: 'active',
      label: 'في الطريق',
      count: shipments.filter((s) => !['delivered', 'failed', 'returned'].includes(s.status)).length,
    },
    {
      key: 'unsettled',
      label: 'محصّل عند الشركة',
      count: shipments.filter((s) => s.status === 'delivered' && !s.isCodCollected && s.codAmount > 0)
        .length,
    },
    {
      key: 'problem',
      label: 'فشل أو رجع',
      count: shipments.filter((s) => ['failed', 'returned'].includes(s.status)).length,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold">
            مستنية شحن{' '}
            <span className="tabular font-normal text-[var(--fg-muted)]">({pending.length})</span>
          </h2>
          {pending.map((o) => (
            <PendingCard key={o.id} order={o} currency={currency} autoCarrier={autoCarrier} />
          ))}
        </section>
      )}

      {shipments.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${
                  filter === t.key
                    ? 'bg-[var(--primary)] font-medium text-[var(--primary-fg)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {t.label} <span className="tabular opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <Card className="px-6 py-10 text-center text-sm text-[var(--fg-muted)]">
              مافيش شحنات في التصنيف ده.
            </Card>
          ) : (
            visible.map((s) => <ShipmentCard key={s.id} row={s} currency={currency} />)
          )}
        </section>
      )}
    </div>
  )
}

/** طلب مؤكّد لسه مالوش بوليصة — بينشحن من هنا على طول */
function PendingCard({
  order,
  currency,
  autoCarrier,
}: {
  order: PendingOrder
  currency: string
  /**
   * اسم الشركة المربوطة بربط تلقائي، أو null.
   *
   * لما تكون موجودة، التاجر بيبعت الشحنة بضغطة بدل ما يفتح لوحتهم
   * وينسخ رقم البوليصة. الخانات بتفضل موجودة برضه: التسجيل التلقائي
   * ممكن يفشل، والتاجر لازم يلاقي طريقًا تانيًا في نفس الشاشة.
   */
  autoCarrier: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [carrier, setCarrier] = useState<string>(CARRIERS[0].key)
  const [tracking, setTracking] = useState('')
  const [cost, setCost] = useState('')

  // الدفع عند الاستلام: المندوب هيحصّل قيمة الطلب. المدفوع أونلاين لأ
  const isCod = order.paymentMethod !== 'online' && order.paymentStatus !== 'paid'
  const [cod, setCod] = useState(isCod ? String(Math.round(order.total / 100)) : '0')

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/orders/${order.id}`}
            className="font-bold transition-colors hover:text-[var(--primary)]"
          >
            طلب #{order.orderNumber}
          </Link>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            {order.customerName ?? 'بدون اسم'}
            {order.city && ` · ${order.city}`} ·{' '}
            <span className="tabular">{formatMoney(order.total, currency)}</span>
            {isCod && ' · دفع عند الاستلام'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {autoCarrier && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const res = await dispatchShipmentAction(order.id)
                  if (res?.error) {
                    setError(res.error)
                    setOpen(true)
                  }
                })
              }
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              {pending ? 'بيتبعت…' : `سجّل عند ${autoCarrier}`}
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium ${
              autoCarrier
                ? 'border border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
                : 'bg-[var(--primary)] text-[var(--primary-fg)]'
            }`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {autoCarrier ? 'سجّل بإيدك' : 'سجّل شحنة'}
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="شركة الشحن">
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              >
                {CARRIERS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="رقم البوليصة">
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="من لوحة شركة الشحن"
                className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </FormField>

            <FormField label="تكلفة الشحن (ج)">
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                placeholder="0"
                className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </FormField>

            <FormField label="المندوب هيحصّل (ج)">
              <input
                value={cod}
                onChange={(e) => setCod(e.target.value.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                placeholder="0"
                className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </FormField>
          </div>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const res = await createShipmentAction({
                    orderId: order.id,
                    carrier,
                    trackingNumber: tracking,
                    shippingCost: cost ? Number(cost) : 0,
                    codAmount: cod ? Number(cod) : 0,
                  })
                  if (res?.error) setError(res.error)
                })
              }
              className="min-h-10 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
            >
              {pending ? 'بيتسجّل…' : 'سجّل وحوّل الطلب لـ«اتشحن»'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 rounded-lg px-3 text-sm text-[var(--fg-muted)]"
            >
              إلغاء
            </button>
            <span className="text-xs text-[var(--fg-subtle)]">
              العميل هيوصله إيميل بالبوليصة.
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

function ShipmentCard({ row: s, currency }: { row: ShipmentRow; currency: string }) {
  const [pending, start] = useTransition()
  const [showLog, setShowLog] = useState(false)
  const meta = shipmentStatusMeta(s.status)
  const carrier = carrierMeta(s.carrier)
  const track = trackingUrl(s.carrier, s.trackingNumber)
  const owesMoney = s.status === 'delivered' && s.codAmount > 0 && !s.isCodCollected

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/orders/${s.orderId}`}
              className="font-bold transition-colors hover:text-[var(--primary)]"
            >
              طلب #{s.orderNumber}
            </Link>
            <span
              className="rounded-md px-2 py-0.5 text-xs font-medium"
              style={{ background: meta.bg, color: meta.fg }}
            >
              {meta.label}
            </span>
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
              {carrier.label}
            </span>
          </div>

          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {s.customerName ?? 'بدون اسم'}
            {s.city && ` · ${s.city}`} · {formatDate(s.createdAt)}
          </p>

          {s.trackingNumber && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm">
              <Package className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden="true" />
              <span className="tabular">{s.trackingNumber}</span>
              {track && (
                <a
                  href={track}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                >
                  تتبّع
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </p>
          )}
        </div>

        <div className="text-end">
          {s.codAmount > 0 && (
            <span
              className="tabular block font-bold"
              style={owesMoney ? { color: 'var(--color-warning)' } : undefined}
            >
              {formatMoney(s.codAmount, currency)}
            </span>
          )}
          {s.shippingCost > 0 && (
            <span className="tabular block text-xs text-[var(--fg-subtle)]">
              شحن {formatMoney(s.shippingCost, currency)}
            </span>
          )}
          {s.customerPhone && (
            <a
              href={`tel:${s.customerPhone}`}
              className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              اتصال
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">حالة الشحنة</span>
          <select
            value={s.status}
            disabled={pending}
            onChange={(e) =>
              start(() =>
                updateShipmentStatusAction(s.id, e.target.value as ShipmentStatus).then(() => {}),
              )
            }
            className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          >
            {SHIPMENT_STATUSES.map((st) => (
              <option key={st.key} value={st.key}>
                {st.label}
              </option>
            ))}
          </select>
        </label>

        {s.codAmount > 0 && s.status === 'delivered' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => settleCodAction(s.id, !s.isCodCollected).then(() => {}))}
            className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors disabled:opacity-60 ${
              s.isCodCollected
                ? 'text-[var(--color-success)]'
                : 'border border-[var(--border-strong)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            {s.isCodCollected ? 'اتحصّلت' : 'استلمت الفلوس'}
          </button>
        )}

        {s.events.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            السجل
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showLog ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => deleteShipmentAction(s.id).then(() => {}))}
          aria-label="حذف الشحنة"
          className="ms-auto flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--color-danger)] disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {showLog && (
        <ol className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          {[...s.events].reverse().map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-start gap-2 text-sm">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: shipmentStatusMeta(e.status).fg }}
                aria-hidden="true"
              />
              <span className="flex-1">
                {shipmentStatusMeta(e.status).label}
                {e.note && <span className="text-[var(--fg-muted)]"> — {e.note}</span>}
              </span>
              <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
                {formatDateTime(e.at)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {s.settledAt && (
        <p className="text-xs text-[var(--color-success)]">
          الفلوس اتحصّلت في {formatDate(s.settledAt)}
        </p>
      )}
    </Card>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
      {children}
    </label>
  )
}
