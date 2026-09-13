/**
 * الشكاوى — شاشة أصلية.
 *
 * «مستنية ردّك» فوق، وكل شكوى بتفتح محادثة من تحت زي أي تطبيق رسايل:
 * كلام العميل وردودك، وخانة رد، وأزرار «اتحلّت / اقفلها / افتحها تاني».
 * الرسايل بتتحمّل لما الشكوى تتفتح بس — زي صفحة اللوحة.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { complaintsData, type ComplaintMessage, type ComplaintsPayload } from './business-api'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Ticket = ComplaintsPayload['tickets'][number]

export function ComplaintsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(complaintsData, visible, onUnavailable)
  const [onlyOpen, setOnlyOpen] = useState<boolean | null>(null)
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null)

  const waiting = onlyOpen ?? Boolean(data && data.open > 0)
  const list = useMemo(
    () => (waiting ? (data?.tickets ?? []).filter((t) => t.status === 'open') : (data?.tickets ?? [])),
    [data, waiting],
  )

  return (
    <Screen visible={visible} title="الشكاوى" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الشكاوى</h1>
            <p class="page-sub">
              {data && data.open > 0 ? `${formatNumber(data.open)} شكوى مستنية ردّك` : 'اللي عميلك مضايق منه، في مكان واحد'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الشكاوى</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:110px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.tickets.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.shieldCheck()} />
            </span>
            <b>مافيش شكاوى</b>
            <p>العميل بيقدر يفتح شكوى من حسابه في متجرك، وهتوصلك هنا.</p>
          </div>
        ) : (
          <>
            <div class="frail" role="tablist" aria-label="فلترة الشكاوى">
              <button
                type="button"
                role="tab"
                aria-selected={waiting}
                class={`fchip${waiting ? ' fchip--on' : ''}${data.open > 0 ? ' fchip--warn' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  setOnlyOpen(true)
                }}
              >
                مستنية ردّك
                {data.open > 0 && <span class="fchip-n">{formatNumber(data.open)}</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!waiting}
                class={`fchip${!waiting ? ' fchip--on' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  setOnlyOpen(false)
                }}
              >
                الكل
                <span class="fchip-n">{formatNumber(data.tickets.length)}</span>
              </button>
            </div>

            {list.length === 0 ? (
              <div class="empty empty--compact rise">
                <b>مفيش شكاوى مستنياك</b>
                <p>ردّيت على كله — شوف «الكل» للقديم.</p>
              </div>
            ) : (
              <div class="olist">
                {list.map((t, i) => (
                  <div
                    key={t.id}
                    class="ocard press rise"
                    style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      haptic('LIGHT')
                      setOpenTicket(t)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setOpenTicket(t)
                    }}
                  >
                    <div class="ocard-top">
                      <span class="ocard-no num">#{t.number}</span>
                      <span class="pill" style={{ background: t.bg, color: t.fg }}>
                        {t.statusLabel}
                      </span>
                      <span class="ocard-total cp-cat">{t.categoryLabel}</span>
                    </div>
                    <div class="ocard-name">{t.subject}</div>
                    <div class="ocard-meta">
                      {t.customerName || 'عميل'}
                      {t.orderLabel ? ` · طلب ${t.orderLabel}` : ''} · {formatNumber(t.messageCount)} رسالة ·{' '}
                      {formatDateTime(t.lastMessageAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {openTicket && data && (
        <Thread
          ticket={openTicket}
          canReply={data.canReply}
          onClose={() => setOpenTicket(null)}
          onChanged={async () => {
            await load()
          }}
        />
      )}
    </Screen>
  )
}

function Thread({
  ticket,
  canReply,
  onClose,
  onChanged,
}: {
  ticket: Ticket
  canReply: boolean
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ComplaintMessage[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(ticket.status)
  const end = useRef<HTMLDivElement>(null)

  const fetchThread = async () => {
    try {
      const res = await fetch(`/api/app/complaints/${encodeURIComponent(ticket.id)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      const body = (await res.json()) as { messages?: ComplaintMessage[] }
      if (!res.ok || !body.messages) throw new Error('bad')
      setMessages(body.messages)
      setFailed(false)
      window.setTimeout(() => end.current?.scrollIntoView({ block: 'end' }), 60)
    } catch {
      setFailed(true)
    }
  }

  useEffect(() => {
    /* بعد أول رسم عشان حركة الطلوع تبان — setTimeout مش rAF: الـrAF بيقف لو النافذة مش ظاهرة */
    const timer = window.setTimeout(() => setOpen(true), 30)
    void fetchThread()
    return () => clearTimeout(timer)
  }, [])

  const close = () => {
    setOpen(false)
    window.setTimeout(onClose, 380)
  }

  const send = async (e: Event) => {
    e.preventDefault()
    if (busy || !text.trim()) return
    haptic('LIGHT')
    setBusy(true)
    const res = await postAppJson(`/api/app/complaints/${encodeURIComponent(ticket.id)}/reply`, { body: text })
    setBusy(false)
    if (!res.ok) {
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    hapticNotify('SUCCESS')
    setText('')
    setStatus('answered')
    await fetchThread()
    void onChanged()
  }

  const changeStatus = async (next: string, done: string) => {
    if (busy) return
    haptic('LIGHT')
    setBusy(true)
    const res = await postAppJson(`/api/app/complaints/${encodeURIComponent(ticket.id)}/status`, { status: next })
    setBusy(false)
    if (!res.ok) {
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 1800 })
    setStatus(next)
    void onChanged()
  }

  const finished = status === 'resolved' || status === 'closed'

  return (
    <Sheet open={open} tall title={`#${ticket.number} · ${ticket.subject}`} onClose={close}>
      <div class="cp">
        <div class="cp-info">
          <span>
            {ticket.customerName || 'عميل'} · {ticket.categoryLabel}
          </span>
          <span class="cp-info-actions">
            {ticket.orderId && (
              <button
                type="button"
                class="act press"
                onClick={() => {
                  close()
                  window.setTimeout(() => navigate(`/dashboard/orders/${ticket.orderId}`), 400)
                }}
              >
                <Icon svg={icons.bag()} />
                الطلب
              </button>
            )}
            {ticket.customerPhone && (
              <button type="button" class="act press" onClick={() => location.assign(`tel:${ticket.customerPhone}`)}>
                <Icon svg={icons.phone()} />
                اتصال
              </button>
            )}
          </span>
        </div>

        <div class="cp-thread">
          {!messages ? (
            failed ? (
              <p class="fine center">ما قدرناش نجيب الرسايل — اقفل وافتح تاني.</p>
            ) : (
              <>
                <span class="sk" style="height:64px;width:78%;border-radius:18px" />
                <span class="sk" style="height:48px;width:62%;border-radius:18px;align-self:flex-end" />
              </>
            )
          ) : (
            messages.map((m) => (
              <div key={m.id} class={`cp-msg cp-msg--${m.author}`}>
                <small>
                  {m.author === 'merchant' ? (m.authorName ?? 'المتجر') : (m.authorName ?? ticket.customerName ?? 'العميل')} ·{' '}
                  {formatDateTime(m.createdAt)}
                </small>
                <p>{m.body}</p>
                {m.images.length > 0 && (
                  <div class="cp-imgs">
                    {m.images.map((src) => (
                      <img key={src} src={src} alt="" loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={end} />
        </div>

        {canReply ? (
          <>
            <form class="cp-reply" onSubmit={send}>
              <textarea
                class="np-input"
                placeholder={finished ? 'الشكوى مقفولة — ردّك هيفتحها تاني' : 'اكتب ردّك للعميل…'}
                value={text}
                onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
              />
              <button type="submit" class="btn btn--primary press" disabled={busy || !text.trim()}>
                {busy ? <span class="spinner" /> : <Icon svg={icons.send()} />}
                ابعت
              </button>
            </form>
            <div class="btn-row">
              {finished ? (
                <button type="button" class="btn btn--ghost press" disabled={busy} onClick={() => void changeStatus('open', 'الشكوى اتفتحت تاني')}>
                  <Icon svg={icons.refresh()} />
                  افتحها تاني
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    class="btn btn--wa press"
                    disabled={busy}
                    onClick={() => void changeStatus('resolved', 'الشكوى اتحلّت')}
                  >
                    <Icon svg={icons.check()} />
                    اتحلّت
                  </button>
                  <button type="button" class="btn btn--ghost press" disabled={busy} onClick={() => void changeStatus('closed', 'الشكوى اتقفلت')}>
                    <Icon svg={icons.x()} />
                    اقفلها
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <p class="fine center">الرد على الشكاوى محتاج صلاحية «يشتغل على الطلبات».</p>
        )}
      </div>
    </Sheet>
  )
}
