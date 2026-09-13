/**
 * لوحات شاشة الشحنات:
 * - `CreateShipmentSheet`: تسجيل شحنة على طلب مستني (عند الشركة المربوطة بضغطة، أو يدوي
 *   بالشركة ورقم البوليصة والتكلفة والتحصيل).
 * - `ShipmentActionsSheet`: الخطوة الجاية بدوسة، أي حالة تانية، التحصيل، التتبّع، وفتح الطلب.
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatMoney } from './format'
import { postAppJson } from './http'
import { openExternal } from './navigate'
import { toLatin } from './ops-api'
import { Sheet } from './screen'
import type { PendingShipment, ShipmentItem, ShipmentsPayload } from './shipments-api'
import { Icon } from './ui'

export function CreateShipmentSheet({
  order,
  data,
  onClose,
  onDone,
  onOpenOrder,
}: {
  order: PendingShipment | null
  data: ShipmentsPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
  onOpenOrder: (orderId: string) => void
}) {
  const carriers = data.carriers ?? []
  const [carrier, setCarrier] = useState(carriers[0]?.key ?? 'other')
  const [tracking, setTracking] = useState('')
  const [cost, setCost] = useState('')
  const [cod, setCod] = useState('0')
  const [busy, setBusy] = useState<'manual' | 'auto' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!order) return
    setCarrier(carriers[0]?.key ?? 'other')
    setTracking('')
    setCost('')
    setCod(String(Math.round((order.codDefault ?? 0) / 100)))
    setError(null)
  }, [order?.orderId])

  const run = async (kind: 'manual' | 'auto') => {
    if (!order || busy) return
    haptic('MEDIUM')
    setError(null)
    setBusy(kind)
    const res =
      kind === 'auto'
        ? await postAppJson('/api/app/shipments/dispatch', { orderId: order.orderId })
        : await postAppJson('/api/app/shipments/create', {
            orderId: order.orderId,
            carrier,
            trackingNumber: tracking,
            shippingCost: toLatin(cost),
            codAmount: toLatin(cod),
          })
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await onDone(kind === 'auto' ? `الطلب ${order.orderNumber} اتبعت لـ${data.autoCarrier}` : `الشحنة اتسجّلت والطلب ${order.orderNumber} بقى «اتشحن»`)
    setBusy(null)
  }

  return (
    <Sheet open={Boolean(order)} tall title={order ? `شحنة للطلب ${order.orderNumber}` : ''} onClose={onClose}>
      {order && (
        <div class="np-form ops-form">
          <div class="sh-order">
            <span class="bl-main">
              <b>{order.customerName || 'بدون اسم'}</b>
              <small>
                {order.city ?? 'من غير محافظة'} · {formatMoney(order.total, data.currency)}
                {order.codDefault ? ' · دفع عند الاستلام' : order.paid ? ' · مدفوع' : ''}
              </small>
            </span>
            <button type="button" class="act press bl-act" onClick={() => onOpenOrder(order.orderId)}>
              الطلب
            </button>
          </div>

          {data.autoCarrier && (
            <>
              <button type="button" class="btn btn--primary btn--lg press" disabled={Boolean(busy)} onClick={() => void run('auto')}>
                {busy === 'auto' ? <span class="spinner" /> : <Icon svg={icons.truck()} />}
                سجّل عند {data.autoCarrier}
              </button>
              <p class="fine center">أو سجّلها بإيدك من تحت لو الشركة مش شغّالة دلوقتي.</p>
            </>
          )}

          <div class="np-label">
            شركة الشحن
            <div class="chips chips--scroll">
              {carriers.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  class={`fchip${carrier === c.key ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setCarrier(c.key)
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <label class="np-label">
            رقم البوليصة
            <input
              class="np-input"
              dir="ltr"
              placeholder="من لوحة شركة الشحن"
              value={tracking}
              onInput={(e) => setTracking((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <div class="np-two">
            <label class="np-label">
              تكلفة الشحن (ج)
              <input class="np-input num" type="text" inputMode="decimal" placeholder="0" value={cost} onInput={(e) => setCost((e.currentTarget as HTMLInputElement).value)} />
            </label>
            <label class="np-label">
              المندوب هيحصّل (ج)
              <input class="np-input num" type="text" inputMode="decimal" placeholder="0" value={cod} onInput={(e) => setCod((e.currentTarget as HTMLInputElement).value)} />
            </label>
          </div>
          {error && <p class="np-error">{error}</p>}
          <button type="button" class={`btn ${data.autoCarrier ? 'btn--ghost' : 'btn--primary'} btn--lg press`} disabled={Boolean(busy)} onClick={() => void run('manual')}>
            {busy === 'manual' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
            سجّل وحوّل الطلب لـ«اتشحن»
          </button>
          <p class="fine center">العميل هيوصله رسالة برقم البوليصة.</p>
        </div>
      )}
    </Sheet>
  )
}

export function ShipmentActionsSheet({
  item,
  data,
  onClose,
  onDone,
  onOpenOrder,
}: {
  item: ShipmentItem | null
  data: ShipmentsPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
  onOpenOrder: (orderId: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)

  const post = async (key: string, url: string, body: object, done: string) => {
    if (!item || busy) return
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    await onDone(done)
    setBusy(null)
  }

  const setStatus = (key: string, label: string) =>
    item && post(key, `/api/app/shipments/${encodeURIComponent(item.id)}/status`, { status: key }, `الشحنة بقت «${label}»`)

  const settle = (collected: boolean) =>
    item &&
    post(
      'settle',
      `/api/app/shipments/${encodeURIComponent(item.id)}/settle`,
      { collected },
      collected ? 'اتسجّل إن الفلوس اتحصّلت' : 'رجعت «لسه ما اتحصّلتش»',
    )

  return (
    <Sheet open={Boolean(item)} tall title={item ? `شحنة ${item.orderNumber}` : ''} onClose={onClose}>
      {item && (
        <div class="sheet-list">
          {item.nextStatus && item.nextLabel && (
            <button type="button" class="btn btn--primary btn--lg press sh-next" disabled={Boolean(busy)} onClick={() => void setStatus(item.nextStatus!, item.nextLabel!)}>
              {busy === item.nextStatus ? <span class="spinner" /> : <Icon svg={icons.arrowNext()} />}
              {item.nextLabel}
            </button>
          )}

          {item.status === 'delivered' && item.codAmount > 0 && (
            <button type="button" class="sheet-row" disabled={Boolean(busy)} onClick={() => void settle(!item.collected)}>
              {busy === 'settle' ? <span class="spinner" /> : <Icon svg={item.collected ? icons.refresh() : icons.check()} />}
              <span class="sheet-row-label">
                {item.collected ? 'لسه ما اتحصّلتش' : `استلمت ${formatMoney(item.codAmount, data.currency)} من الشركة`}
                <small class="set-hint">{item.collected ? 'رجّعها لقايمة الفلوس اللي عند الشركة' : 'الفلوس وصلتك من شركة الشحن'}</small>
              </span>
            </button>
          )}

          <div class="mk-sec">
            <b>غيّر الحالة</b>
            <small>التسليم والرجوع بيتنقلوا للطلب نفسه</small>
          </div>
          {(data.statuses ?? []).map((s) => (
            <button
              key={s.key}
              type="button"
              class={`sheet-row${s.key === item.status ? ' sheet-row--on' : ''}`}
              disabled={Boolean(busy) || s.key === item.status}
              onClick={() => void setStatus(s.key, s.label)}
            >
              {busy === s.key ? <span class="spinner" /> : <span class="dot" style={{ background: s.fg }} />}
              <span class="sheet-row-label">{s.label}</span>
              {s.key === item.status && <Icon svg={icons.check()} className="ic sheet-check" />}
            </button>
          ))}

          <div class="mk-sec">
            <b>الطلب</b>
          </div>
          <button type="button" class="sheet-row" onClick={() => onOpenOrder(item.orderId)}>
            <Icon svg={icons.bag()} />
            <span class="sheet-row-label">افتح الطلب</span>
          </button>
          {item.trackingUrl && (
            <button type="button" class="sheet-row" onClick={() => openExternal(item.trackingUrl!)}>
              <Icon svg={icons.truck()} />
              <span class="sheet-row-label">تتبّع عند {item.carrierLabel}</span>
            </button>
          )}
          {item.customerPhone && (
            <button type="button" class="sheet-row" onClick={() => location.assign(`tel:${item.customerPhone}`)}>
              <Icon svg={icons.phone()} />
              <span class="sheet-row-label">اتصل بالعميل</span>
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
