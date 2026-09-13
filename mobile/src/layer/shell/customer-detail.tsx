/**
 * العميل — شاشة أصلية جديدة.
 *
 * اللوحة مالهاش صفحة عميل: التاجر كان بيشوف الاسم والإجمالي في القايمة
 * وبس. هنا كل اللي متسجّل عنه في مكان واحد — طلباته، إنفاقه، نقاطه،
 * مستواه، درجة ثقته، وملاحظته — عشان لما يكلّمه يبقى عارف بيكلّم مين.
 *
 * عرض بس: مفيش أي فعل جديد على بيانات العميل من هنا.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { customerDetails, customerPreviews, fetchCustomer, type CustomerDetail } from './customers-api'
import { TIER_TONES } from './customers'
import { formatDateTime, formatMoney, formatNumber, initials } from './format'
import { navigate } from './navigate'
import { previews, whatsappLink } from './orders-api'
import { statusColors } from './orders'
import { Screen } from './screen'
import { Icon } from './ui'

export function CustomerDetailScreen({
  visible,
  customerId,
  onUnavailable,
}: {
  visible: boolean
  customerId: string | null
  onUnavailable: () => void
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [failed, setFailed] = useState(false)
  const current = useRef(customerId)
  current.current = customerId

  useEffect(() => {
    if (!customerId) return
    setDetail(customerDetails.get(customerId) ?? null)
    setMissing(false)
    setFailed(false)
  }, [customerId])

  const load = useCallback(async () => {
    const id = current.current
    if (!id) return
    const res = await fetchCustomer(id)
    if (current.current !== id) return
    if (res.kind === 'ok') {
      customerDetails.set(id, res.data)
      setDetail(res.data)
      setFailed(false)
    } else if (res.kind === 'unavailable') onUnavailable()
    else if (res.kind === 'notFound') setMissing(true)
    else if (res.kind === 'error') setFailed(true)
  }, [onUnavailable])

  useEffect(() => {
    if (visible && customerId) void load()
  }, [visible, customerId])

  const goBack = () => {
    if (history.length > 1) history.back()
    else navigate('/dashboard/customers')
  }

  const go = (href: string) => {
    haptic('LIGHT')
    location.assign(href)
  }

  const preview = customerId ? customerPreviews.get(customerId) : undefined
  const c = detail?.customer
  const name = c?.name ?? preview?.name
  const known = Boolean(c || preview)
  const currency = detail?.currency ?? preview?.currency ?? 'EGP'
  const phone = c?.phone ?? preview?.phone ?? null
  const email = c?.email ?? preview?.email ?? null
  const tier = c?.tier ?? preview?.tier ?? 'bronze'
  const tone = TIER_TONES[tier] ?? 'muted'

  return (
    <Screen
      visible={visible}
      kind="detail"
      title={name || 'العميل'}
      onBack={goBack}
      resetKey={customerId}
      onRefresh={load}
    >
      <div class="home-body">
        {missing ? (
          <div class="empty">
            <span class="empty-icon">
              <Icon svg={icons.users()} />
            </span>
            <b>العميل ده مش موجود</b>
            <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/customers')}>
              كل العملاء
            </button>
          </div>
        ) : !known ? (
          <div class="stack" aria-busy="true">
            <span class="sk" style="height:180px;border-radius:24px" />
            <span class="sk" style="height:90px;border-radius:22px" />
            <span class="sk" style="height:260px;border-radius:22px" />
          </div>
        ) : (
          <>
            <header class="c-head rise">
              <span class={`c-avatar avatar--${tone}`}>{initials(name)}</span>
              <h1 class="c-name">{name || 'بدون اسم'}</h1>
              <div class="c-badges">
                {(c?.tierLabel ?? preview?.tierLabel) && (
                  <span class={`tier tier--${tone}`}>{c?.tierLabel ?? preview?.tierLabel}</span>
                )}
                {c?.isBlocked && <span class="tier tier--danger">محظور</span>}
                {c && !c.acceptsMarketing && <span class="tier tier--muted">مش مشترك في الرسايل</span>}
              </div>
              {(phone || email) && (
                <div class="c-actions">
                  {phone && (
                    <button type="button" class="c-act press" onClick={() => go(`tel:${phone}`)}>
                      <span>
                        <Icon svg={icons.phone()} />
                      </span>
                      اتصال
                    </button>
                  )}
                  {phone && (
                    <button
                      type="button"
                      class="c-act c-act--wa press"
                      onClick={() => go(whatsappLink(phone, detail?.whatsappText ?? preview?.whatsappText ?? ''))}
                    >
                      <span>
                        <Icon svg={icons.messageCircle()} />
                      </span>
                      واتساب
                    </button>
                  )}
                  {email && (
                    <button type="button" class="c-act press" onClick={() => go(`mailto:${email}`)}>
                      <span>
                        <Icon svg={icons.mail()} />
                      </span>
                      بريد
                    </button>
                  )}
                </div>
              )}
            </header>

            <section class="card sec facts rise">
              <div class="fact">
                <span class="fact-label">إجمالي الإنفاق</span>
                <b>{formatMoney(c?.totalSpent ?? preview?.totalSpent ?? 0, currency)}</b>
              </div>
              <div class="fact">
                <span class="fact-label">الطلبات</span>
                <b>{formatNumber(c?.ordersCount ?? preview?.ordersCount ?? 0)}</b>
              </div>
              <div class="fact">
                <span class="fact-label">{c && c.points > 0 ? 'النقاط' : 'متوسط الطلب'}</span>
                <b>{c ? (c.points > 0 ? formatNumber(c.points) : formatMoney(c.averageOrder, currency)) : '—'}</b>
              </div>
            </section>

            {detail?.trust && (
              <section class={`card trust trust--${detail.trust.level} rise`}>
                <div class="trust-head">
                  <Icon
                    svg={
                      detail.trust.level === 'good'
                        ? icons.shieldCheck()
                        : detail.trust.level === 'watch'
                          ? icons.shieldQuestion()
                          : detail.trust.level === 'risky'
                            ? icons.alertTriangle()
                            : icons.sparkles()
                    }
                  />
                  {detail.trust.label}
                  {detail.trust.score !== null && (
                    <span class="trust-score">{formatNumber(detail.trust.score)}٪ ثقة</span>
                  )}
                </div>
                {detail.trust.reasons.length > 0 && (
                  <ul>
                    {detail.trust.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {c && (c.note || c.tags.length > 0) && (
              <section class="card sec rise">
                <h2 class="card-title">ملاحظات</h2>
                {c.tags.length > 0 && (
                  <div class="opt-values" style="margin-bottom:10px">
                    {c.tags.map((t) => (
                      <span key={t} class="opt-val">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {c.note && <p class="p-desc">{c.note}</p>}
              </section>
            )}

            <section class="card sec rise">
              <h2 class="card-title">
                الطلبات {detail && <span class="count">{formatNumber(detail.orders.length)}</span>}
              </h2>
              {!detail ? (
                failed ? (
                  <p class="muted small">مش قادرين نجيب طلباته — اسحب لتحت عشان تحاول تاني.</p>
                ) : (
                  <div class="stack">
                    {[0, 1, 2].map((i) => (
                      <span key={i} class="sk" style="height:52px;border-radius:14px" />
                    ))}
                  </div>
                )
              ) : detail.orders.length === 0 ? (
                <p class="muted small">مالوش طلبات مكتملة لسه.</p>
              ) : (
                <div class="c-orders">
                  {detail.orders.map((o) => {
                    const [bg, fg] = statusColors(o.status)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        class="row"
                        onClick={() => {
                          previews.set(o.id, {
                            id: o.id,
                            number: o.number,
                            status: o.status,
                            statusLabel: o.statusLabel,
                            incomplete: false,
                            name: c?.name ?? null,
                            phone: c?.phone ?? null,
                            email: c?.email ?? null,
                            city: null,
                            total: o.total,
                            createdAt: o.createdAt,
                            trust: null,
                            whatsappText: '',
                            currency,
                          })
                          haptic('LIGHT')
                          navigate(`/dashboard/orders/${o.id}`)
                        }}
                      >
                        <span class="row-main">
                          <span class="row-title num">#{o.number}</span>
                          <span class="row-sub">{formatDateTime(o.createdAt)}</span>
                        </span>
                        <span class="pill" style={{ background: bg, color: fg }}>
                          {o.statusLabel}
                        </span>
                        <span class="row-end">{formatMoney(o.total, currency)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {c && (
              <p class="fine center">
                عميل من {formatDateTime(c.createdAt)}
                {c.lastOrderAt ? ` · آخر طلب ${formatDateTime(c.lastOrderAt)}` : ''}
              </p>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
