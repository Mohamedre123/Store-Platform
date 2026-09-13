/**
 * سجل الرسايل — شاشة أصلية.
 *
 * كل رسالة اتبعتت من المتجر (بريد أو واتساب): نوعها، لمين، وصلت ولا
 * فشلت — ودوسة على الرسالة الفاشلة بتفرد سبب الفشل زي ما المزوّد قاله.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { messagesData } from './business-api'
import { formatDateTime, formatNumber } from './format'
import { useResource } from './http'
import { navigate } from './navigate'
import { Screen } from './screen'
import { Icon } from './ui'

export function MessagesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(messagesData, visible, onUnavailable)
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const shown = useMemo(
    () => (onlyFailed ? (data?.messages ?? []).filter((m) => m.status === 'failed') : (data?.messages ?? [])),
    [data, onlyFailed],
  )

  return (
    <Screen visible={visible} title="سجل الرسايل" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">سجل الرسايل</h1>
            <p class="page-sub">كل رسالة اتبعتت من متجرك — وصلت ولا فشلت وليه</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الرسايل</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} class="sk" style="height:76px;border-radius:18px" />
              ))}
            </div>
          )
        ) : (
          <>
            {!data.emailConfigured && (
              <div class="alert alert--warning rise">
                <span class="alert-icon">
                  <Icon svg={icons.alertTriangle()} />
                </span>
                <span class="alert-text">
                  <span class="alert-title">البريد مش مضبوط على المنصة</span>
                  <span class="alert-hint">كل رسالة بريد هتتسجّل هنا كفاشلة لحد ما يتظبط.</span>
                </span>
              </div>
            )}

            {data.counts.total > 0 && (
              <section class="card sec facts rise">
                <div class="fact">
                  <span class="fact-label">كل الرسايل</span>
                  <b>{formatNumber(data.counts.total)}</b>
                </div>
                <div class="fact">
                  <span class="fact-label">آخر ٧ أيام</span>
                  <b>{formatNumber(data.counts.last7)}</b>
                </div>
                <div class="fact">
                  <span class="fact-label">فشلت</span>
                  <b class={data.counts.failed > 0 ? 'bad' : ''}>{formatNumber(data.counts.failed)}</b>
                </div>
              </section>
            )}

            {data.counts.failed > 0 && (
              <div class="frail" role="tablist" aria-label="فلترة الرسايل">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!onlyFailed}
                  class={`fchip${!onlyFailed ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setOnlyFailed(false)
                  }}
                >
                  الكل
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={onlyFailed}
                  class={`fchip fchip--warn${onlyFailed ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setOnlyFailed(true)
                  }}
                >
                  اللي فشلت
                  <span class="fchip-n">{formatNumber(data.counts.failed)}</span>
                </button>
              </div>
            )}

            {shown.length === 0 ? (
              <div class="empty rise">
                <span class="empty-icon">
                  <Icon svg={icons.mail()} />
                </span>
                <b>مافيش رسايل لسه</b>
                <p>أول ما يجيلك طلب، رسالة التأكيد هتتسجّل هنا بحالتها.</p>
              </div>
            ) : (
              <div class="card list rise">
                {shown.map((m) => {
                  const isOpen = open === m.id
                  const wa = m.channel === 'whatsapp'
                  return (
                    <div key={m.id} class="msg">
                      <button
                        type="button"
                        class="msg-head"
                        aria-expanded={isOpen}
                        onClick={() => {
                          haptic('LIGHT')
                          setOpen(isOpen ? null : m.id)
                        }}
                      >
                        <span class={`msg-ch${wa ? ' msg-ch--wa' : ''}`}>
                          <Icon svg={wa ? icons.messageCircle() : icons.mail()} />
                        </span>
                        <span class="msg-main">
                          <b>
                            {m.eventLabel}
                            <span class="pill" style={{ background: m.bg, color: m.fg }}>
                              {m.statusLabel}
                            </span>
                          </b>
                          <bdi>{m.recipient}</bdi>
                        </span>
                        <span class="msg-time">{formatDateTime(m.createdAt)}</span>
                      </button>
                      {m.body && <p class={`msg-body${isOpen ? ' msg-body--open' : ''}`}>{m.body}</p>}
                      {isOpen && m.error && <div class="msg-error">{m.error}</div>}
                      {!isOpen && m.error && <span class="msg-hint">دوس عشان تشوف سبب الفشل</span>}
                      {isOpen && m.orderId && (
                        <div class="msg-actions">
                          <button
                            type="button"
                            class="act press"
                            onClick={() => {
                              haptic('LIGHT')
                              navigate(`/dashboard/orders/${m.orderId}`)
                            }}
                          >
                            <Icon svg={icons.bag()} />
                            افتح الطلب
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
