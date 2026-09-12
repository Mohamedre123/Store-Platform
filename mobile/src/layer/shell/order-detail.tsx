/**
 * تفاصيل الطلب — شاشة أصلية.
 *
 * الأفعال اليومية كلها هنا بشكل تطبيق: الحالة التالية بزرار واحد كبير،
 * باقي الحالات في لوحة من تحت، قناة الإشعار، طلب تأكيد من العميل،
 * ملاحظة داخلية، واتصال وواتساب. كل فعل بينادي فعل اللوحة نفسه على
 * الخادم، والشاشة بتتحدّث بالرد في نفس اللحظة.
 *
 * الأفعال اللي لسه مالهاش شاشة أصلية (إسناد مندوب، رسايل الاسترداد،
 * تحويل السلة لطلب، المسح) بتفتح نسخة المنصة من نفس الطلب.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import {
  NOTIFY_CHANNELS,
  details,
  fetchOrder,
  postOrderAction,
  previews,
  readChannel,
  saveChannel,
  whatsappLink,
  type NotifyChannel,
  type OrderDetail,
} from './orders-api'
import { statusColors } from './orders'
import { formatDateTime, formatMoney, formatNumber } from './format'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

/* الحالات دي بترجّع مخزون — تأكيد قبلها */
const DESTRUCTIVE = new Set(['cancelled', 'returned'])

const CHANNEL_ICONS: Record<NotifyChannel, () => string> = {
  auto: icons.wand,
  both: icons.messageCircle,
  whatsapp: icons.messageCircle,
  email: icons.mail,
  none: icons.bellOff,
}

type SheetState = null | { kind: 'status' } | { kind: 'channel' } | { kind: 'confirm'; key: string; label: string }

export function OrderDetailScreen({
  visible,
  orderId,
  onUnavailable,
}: {
  visible: boolean
  orderId: string | null
  onUnavailable: () => void
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [channel, setChannel] = useState<NotifyChannel>(readChannel)
  const [note, setNote] = useState('')
  const currentId = useRef<string | null>(orderId)
  currentId.current = orderId

  useEffect(() => {
    if (!orderId) return
    setDetail(details.get(orderId) ?? null)
    setMissing(false)
    setFailed(false)
    setNote('')
    setSheet(null)
  }, [orderId])

  const load = useCallback(async () => {
    const id = currentId.current
    if (!id) return
    const res = await fetchOrder(id)
    /* التاجر ممكن يكون فتح طلب تاني قبل ما الرد يوصل */
    if (currentId.current !== id) return
    if (res.kind === 'ok') {
      details.set(id, res.data)
      setDetail(res.data)
      setFailed(false)
    } else if (res.kind === 'unavailable') {
      onUnavailable()
    } else if (res.kind === 'notFound') {
      setMissing(true)
    } else if (res.kind === 'error') {
      setFailed(true)
    }
  }, [onUnavailable])

  useEffect(() => {
    if (!visible || !orderId) return
    /* القناة ممكن تكون اتغيّرت من صفحة تانية في اللوحة */
    setChannel(readChannel())
    void load()
  }, [visible, orderId])

  const run = async (key: string, action: 'status' | 'note' | 'confirm', body: object, success: string) => {
    const id = currentId.current
    if (!id || busy) return false
    setBusy(key)
    const res = await postOrderAction(id, action, body)
    setBusy(null)
    if (!res.ok) {
      toast(res.error, { tone: 'danger' })
      return false
    }
    if (currentId.current === id) setDetail(res.detail)
    toast(success, { tone: 'success' })
    return true
  }

  const changeStatus = (key: string, label: string) => {
    setSheet(null)
    void run(`status:${key}`, 'status', { status: key, channel }, `الطلب بقى «${label}»`)
  }

  const pickStatus = (key: string, label: string) => {
    haptic('LIGHT')
    if (DESTRUCTIVE.has(key)) setSheet({ kind: 'confirm', key, label })
    else changeStatus(key, label)
  }

  const goBack = () => {
    if (history.length > 1) history.back()
    else navigate('/dashboard/orders')
  }

  const openWeb = () => {
    if (orderId) navigate(`/dashboard/orders/${orderId}?web=1`)
  }

  const call = (href: string) => {
    haptic('LIGHT')
    location.assign(href)
  }

  const preview = orderId ? previews.get(orderId) : undefined
  const o = detail?.order
  const number = o?.number ?? preview?.number
  const status = o?.status ?? preview?.status ?? 'pending'
  const currency = detail?.currency ?? preview?.currency ?? 'EGP'
  const [statusBg, statusFg] = statusColors(status)
  const channelMeta = NOTIFY_CHANNELS.find((c) => c.key === channel) ?? NOTIFY_CHANNELS[0]
  const busyStatus = busy?.startsWith('status:') ? busy.slice(7) : null

  return (
    <>
      <Screen
        visible={visible}
        kind="detail"
        title={number ? `طلب #${number}` : 'الطلب'}
        onBack={goBack}
        resetKey={orderId}
        onRefresh={load}
        actions={
          <button type="button" class="appbar-btn press" aria-label="كل خيارات الطلب" onClick={openWeb}>
            <Icon svg={icons.moreHorizontal()} />
          </button>
        }
      >
        <div class="home-body">
          {missing ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.package()} />
              </span>
              <b>الطلب ده مش موجود</b>
              <p>ممكن يكون اتمسح. ارجع لقايمة الطلبات.</p>
              <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/orders')}>
                كل الطلبات
              </button>
            </div>
          ) : !number ? (
            <DetailSkeleton />
          ) : (
            <>
              <header class="d-head rise">
                <div class="d-head-row">
                  <span class="d-no num">#{number}</span>
                  <span class="pill pill--lg" style={{ background: statusBg, color: statusFg }}>
                    {o?.statusLabel ?? preview?.statusLabel}
                  </span>
                </div>
                <strong class="d-total">{formatMoney(o?.total ?? preview?.total ?? 0, currency)}</strong>
                <span class="d-date">
                  {formatDateTime(o?.createdAt ?? preview?.createdAt ?? new Date().toISOString())}
                  {(o?.name ?? preview?.name) ? ` · ${o?.name ?? preview?.name}` : ''}
                </span>
              </header>

              {!detail ? (
                failed ? (
                  <div class="empty empty--compact">
                    <b>مش قادرين نجيب تفاصيل الطلب</b>
                    <p>اسحب لتحت عشان تحاول تاني.</p>
                  </div>
                ) : (
                  <DetailSkeleton partial />
                )
              ) : (
                <DetailBody
                  detail={detail}
                  currency={currency}
                  busy={busy}
                  busyStatus={busyStatus}
                  channelLabel={channelMeta.label}
                  channelIcon={CHANNEL_ICONS[channel]()}
                  note={note}
                  onNote={setNote}
                  onSaveNote={async () => {
                    if (await run('note', 'note', { note }, 'اتضافت الملاحظة')) setNote('')
                  }}
                  onConfirm={() => void run('confirm', 'confirm', {}, 'بعتنا طلب التأكيد للعميل')}
                  onNext={(key, label) => pickStatus(key, label)}
                  onOpenStatuses={() => setSheet({ kind: 'status' })}
                  onOpenChannel={() => setSheet({ kind: 'channel' })}
                  onWeb={openWeb}
                  onCall={call}
                />
              )}
            </>
          )}
        </div>
      </Screen>

      <Sheet open={sheet?.kind === 'status'} title="غيّر حالة الطلب" onClose={() => setSheet(null)}>
        <div class="sheet-list">
          {detail?.statuses.map((s) => {
            const [, fg] = statusColors(s.key)
            const on = s.key === detail.order.status
            return (
              <button
                key={s.key}
                type="button"
                class={`sheet-row press${on ? ' sheet-row--on' : ''}`}
                disabled={on}
                onClick={() => pickStatus(s.key, s.label)}
              >
                <span class="dot" style={{ background: fg }} />
                <span class="sheet-row-label">{s.label}</span>
                {on && <Icon svg={icons.check()} className="sheet-check" />}
              </button>
            )
          })}
        </div>
        <p class="fine">الإشعار هيروح: {channelMeta.label}</p>
      </Sheet>

      <Sheet open={sheet?.kind === 'channel'} title="الإشعار يروح فين؟" onClose={() => setSheet(null)}>
        <div class="sheet-list">
          {NOTIFY_CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              class={`sheet-row press${c.key === channel ? ' sheet-row--on' : ''}`}
              onClick={() => {
                haptic('LIGHT')
                setChannel(c.key)
                saveChannel(c.key)
                setSheet(null)
              }}
            >
              <span class="sheet-row-icon">
                <Icon svg={CHANNEL_ICONS[c.key]()} />
              </span>
              <span class="sheet-row-label">
                {c.label}
                <small>{c.hint}</small>
              </span>
              {c.key === channel && <Icon svg={icons.check()} className="sheet-check" />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet?.kind === 'confirm'}
        title={sheet?.kind === 'confirm' ? `تغيّر الطلب لـ«${sheet.label}»؟` : undefined}
        onClose={() => setSheet(null)}
      >
        <p class="sheet-text">
          الكمية هترجع للمخزون تلقائيًا
          {channel === 'none' ? '، ومن غير ما يوصل العميل إشعار.' : '، والعميل هيوصله إشعار.'}
        </p>
        <div class="btn-row">
          <button type="button" class="btn btn--ghost press" onClick={() => setSheet(null)}>
            رجوع
          </button>
          <button
            type="button"
            class="btn btn--danger press"
            onClick={() => {
              if (sheet?.kind === 'confirm') changeStatus(sheet.key, sheet.label)
            }}
          >
            أيوه، غيّرها
          </button>
        </div>
      </Sheet>
    </>
  )
}

function DetailBody({
  detail: d,
  currency,
  busy,
  busyStatus,
  channelLabel,
  channelIcon,
  note,
  onNote,
  onSaveNote,
  onConfirm,
  onNext,
  onOpenStatuses,
  onOpenChannel,
  onWeb,
  onCall,
}: {
  detail: OrderDetail
  currency: string
  busy: string | null
  busyStatus: string | null
  channelLabel: string
  channelIcon: string
  note: string
  onNote: (v: string) => void
  onSaveNote: () => void
  onConfirm: () => void
  onNext: (key: string, label: string) => void
  onOpenStatuses: () => void
  onOpenChannel: () => void
  onWeb: () => void
  onCall: (href: string) => void
}) {
  const o = d.order
  const c = o.confirm
  const confirmTone = c.reply === 'yes' ? 'success' : c.reply === 'no' ? 'danger' : c.sentAt ? 'warning' : 'muted'

  return (
    <>
      {o.incomplete && o.stage && (
        <section class="card callout rise">
          <span class="callout-icon">
            <Icon svg={icons.bag()} />
          </span>
          <div class="callout-text">
            <b>وقف عند: {o.stage.label}</b>
            <p>{o.stage.detail} كلّمه دلوقتي — دي فلوس على وشك تضيع.</p>
            <button type="button" class="btn btn--primary press" onClick={onWeb}>
              رسايل الاسترداد وتحويله لطلب
            </button>
          </div>
        </section>
      )}

      {d.trust && (
        <section class={`card trust trust--${d.trust.level} rise`}>
          <div class="trust-head">
            <Icon
              svg={
                d.trust.level === 'good'
                  ? icons.shieldCheck()
                  : d.trust.level === 'watch'
                    ? icons.shieldQuestion()
                    : d.trust.level === 'risky'
                      ? icons.alertTriangle()
                      : icons.sparkles()
              }
            />
            {d.trust.label}
            {d.trust.score !== null && <span class="trust-score">{formatNumber(d.trust.score)}٪ ثقة</span>}
          </div>
          {d.trust.reasons.length > 0 ? (
            <ul>
              {d.trust.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p class="trust-net">أول طلب من الرقم ده — مفيش سجل نحكم بيه.</p>
          )}
          {d.trust.networkStores > 0 && <p class="trust-net">أرقام المنصة مجمّعة — من غير أي بيانات عن المتاجر التانية.</p>}
        </section>
      )}

      {!o.incomplete && (
        <section class="card sec rise">
          <div class="sec-row">
            <h2 class="card-title">حالة الطلب</h2>
            <button type="button" class="channel-btn press" onClick={onOpenChannel}>
              <Icon svg={channelIcon} />
              {channelLabel}
              <Icon svg={icons.chevronDown()} className="chev" />
            </button>
          </div>
          {d.next && (
            <button
              type="button"
              class="btn btn--primary btn--lg press"
              disabled={Boolean(busy)}
              onClick={() => onNext(d.next!.key, d.next!.label)}
            >
              {busyStatus === d.next.key ? <span class="spinner" /> : <Icon svg={icons.arrowNext()} />}
              {d.next.label}
            </button>
          )}
          <button type="button" class="btn btn--ghost press" disabled={Boolean(busy)} onClick={onOpenStatuses}>
            {busyStatus && busyStatus !== d.next?.key ? <span class="spinner" /> : null}
            غيّر لحالة تانية
          </button>
          <p class="fine">الإلغاء والإرجاع بيرجّعوا الكمية للمخزون تلقائيًا.</p>
        </section>
      )}

      {!o.incomplete && c.hasPhone && (
        <section class="card sec rise">
          <div class="confirm">
            <span class={`confirm-icon confirm-icon--${confirmTone}`}>
              <Icon svg={c.reply === 'yes' ? icons.check() : c.reply === 'no' ? icons.x() : c.sentAt ? icons.clock() : icons.messageCircle()} />
            </span>
            <div class="confirm-text">
              <b>تأكيد العميل</b>
              <p>
                {c.reply === 'yes'
                  ? `العميل أكّد${c.repliedAt ? ' — ' + formatDateTime(c.repliedAt) : ''} — والطلب اتنقل لـ«بيتجهّز» ووصله بريد وواتساب.`
                  : c.reply === 'no'
                    ? `العميل ألغى الطلب${c.repliedAt ? ' — ' + formatDateTime(c.repliedAt) : ''}`
                    : c.sentAt
                      ? `بعتنا الطلب — ${formatDateTime(c.sentAt)} ولسه ما ردّش. الصمت مخاطرة زي الرفض.`
                      : 'ابعتله رسالة واتساب يرد عليها بـ١ أو ٢. لو أكّد، الطلب بينتقل لـ«بيتجهّز» لوحده.'}
              </p>
            </div>
          </div>
          {!c.reply && (
            <button type="button" class="btn btn--ghost press" disabled={Boolean(busy)} onClick={onConfirm}>
              {busy === 'confirm' ? <span class="spinner" /> : <Icon svg={icons.messageCircle()} />}
              {c.sentAt ? 'ابعت التأكيد تاني' : 'ابعت طلب تأكيد على واتساب'}
            </button>
          )}
        </section>
      )}

      <section class="card sec rise">
        <h2 class="card-title">
          المنتجات <span class="count">{formatNumber(d.items.length)}</span>
        </h2>
        <div class="items">
          {d.items.map((i) => (
            <div key={i.id} class="item">
              <span class="thumb">
                {i.image ? <img src={assetUrl(i.image) ?? ''} alt="" loading="lazy" /> : <Icon svg={icons.package()} />}
              </span>
              <div class="item-main">
                <b>{i.name}</b>
                {i.options.length > 0 && (
                  <div class="opts">
                    {i.options.map((op) => (
                      <span key={`${op.name}-${op.value}`} class="opt">
                        {op.name}: <b>{op.value}</b>
                      </span>
                    ))}
                  </div>
                )}
                <span class="item-sub">
                  {formatMoney(i.price, currency)} × {formatNumber(i.quantity)}
                </span>
              </div>
              <span class="item-total">{formatMoney(i.total, currency)}</span>
            </div>
          ))}
        </div>
        <dl class="totals">
          <div>
            <dt>المنتجات</dt>
            <dd>{formatMoney(o.subtotal, currency)}</dd>
          </div>
          <div>
            <dt>الشحن</dt>
            <dd>{formatMoney(o.shippingTotal, currency)}</dd>
          </div>
          {o.codFee > 0 && (
            <div>
              <dt>رسوم الدفع عند الاستلام</dt>
              <dd>{formatMoney(o.codFee, currency)}</dd>
            </div>
          )}
          <div class="totals-grand">
            <dt>الإجمالي</dt>
            <dd>{formatMoney(o.total, currency)}</dd>
          </div>
        </dl>
        {o.costTotal > 0 && (
          <div class={`profit ${o.profit > 0 ? 'profit--up' : 'profit--down'}`}>
            <span>ربحك من الطلب ده</span>
            <b>{formatMoney(o.profit, currency)}</b>
          </div>
        )}
      </section>

      <section class="card sec rise">
        <h2 class="card-title">العميل</h2>
        <div class="kv">
          <Icon svg={icons.user()} />
          <span>{o.name || 'بدون اسم'}</span>
        </div>
        {o.phone && (
          <div class="kv">
            <Icon svg={icons.phone()} />
            <bdi class="num">{o.phone}</bdi>
          </div>
        )}
        {o.email && (
          <div class="kv">
            <Icon svg={icons.mail()} />
            <bdi class="num ellip">{o.email}</bdi>
          </div>
        )}
        {o.address && (
          <div class="kv">
            <Icon svg={icons.mapPin()} />
            <span class="muted">{o.address}</span>
          </div>
        )}
        {o.notes && (
          <div class="kv">
            <Icon svg={icons.stickyNote()} />
            <span class="muted">{o.notes}</span>
          </div>
        )}
        {o.phone && (
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={() => onCall(`tel:${o.phone}`)}>
              <Icon svg={icons.phone()} />
              اتصال
            </button>
            <button type="button" class="btn btn--wa press" onClick={() => onCall(whatsappLink(o.phone!, d.whatsappText))}>
              <Icon svg={icons.messageCircle()} />
              واتساب
            </button>
          </div>
        )}
      </section>

      {!o.incomplete && (
        <section class="card sec rise">
          <h2 class="card-title">التوصيل</h2>
          {d.courier ? (
            <div class="kv">
              <Icon svg={icons.truck()} />
              <span>
                المندوب: <b>{d.courier.name}</b>
                {d.courier.phone && (
                  <>
                    {' · '}
                    <bdi class="num">{d.courier.phone}</bdi>
                  </>
                )}
              </span>
            </div>
          ) : (
            <p class="muted small">لسه ما اتسندش لمندوب.</p>
          )}
          <button type="button" class="btn btn--ghost press" onClick={onWeb}>
            <Icon svg={icons.truck()} />
            {d.courier ? 'تغيير المندوب أو الشحنة' : 'إسناد لمندوب أو شركة شحن'}
          </button>
        </section>
      )}

      <section class="card sec rise">
        <h2 class="card-title">المسار الزمني</h2>
        {d.events.length === 0 ? (
          <p class="muted small">مفيش خطوات متسجّلة على الطلب ده.</p>
        ) : (
          <ol class="timeline">
            {d.events.map((e) => (
              <li key={e.id} class={`tl tl--${e.type}`}>
                <span class="tl-dot" />
                <div>
                  <span class="tl-msg">{e.message}</span>
                  <span class="tl-time">{formatDateTime(e.createdAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div class="note-box">
          <textarea
            rows={2}
            placeholder="ملاحظة داخلية — العميل مش بيشوفها"
            value={note}
            onInput={(e) => onNote((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <button
            type="button"
            class="btn btn--primary press"
            aria-label="إضافة ملاحظة"
            disabled={!note.trim() || Boolean(busy)}
            onClick={onSaveNote}
          >
            {busy === 'note' ? <span class="spinner" /> : <Icon svg={icons.send()} />}
          </button>
        </div>
      </section>

      <button type="button" class="btn btn--ghost btn--block press rise" onClick={onWeb}>
        <Icon svg={icons.moreHorizontal()} />
        كل خيارات الطلب — مسح، مندوب، روابط دفع
      </button>
    </>
  )
}

function DetailSkeleton({ partial }: { partial?: boolean }) {
  return (
    <div class="stack" aria-busy="true">
      {!partial && <span class="sk" style="height:110px;border-radius:20px" />}
      <span class="sk" style="height:170px;border-radius:22px" />
      <span class="sk" style="height:240px;border-radius:22px" />
      <span class="sk" style="height:160px;border-radius:22px" />
    </div>
  )
}
