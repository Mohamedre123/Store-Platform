/**
 * الدفع — شاشة أصلية.
 *
 * نفس صفحة اللوحة: الطرق من غير وسيط (الدفع عند الاستلام بمفتاحه ورسومه، والتحويل بتعليماته)،
 * بوابات الدفع الإلكتروني (ربط بالمفاتيح في `provider-sheet.tsx` ومفتاح تشغيل)، وسجل محاولات الدفع
 * بسبب الفشل وفتح الطلب.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { paymentsData, type PaymentMethod, type Provider } from './commerce-api'
import { formatDateTime, formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { toLatin, WALLET_ICON } from './ops-api'
import { ProviderRow, ProviderSheet, providerBody, providerUrl } from './provider-sheet'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type MethodForm = { gateway: 'cod' | 'manual'; enabled: boolean; displayName: string; instructions: string; fee: string }

export function PaymentsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(paymentsData, visible, onUnavailable)
  const [form, setForm] = useState<MethodForm | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currency = data?.currency ?? 'EGP'
  const money = (amount: string) => formatMoney(Math.round((Number(toLatin(amount)) || 0) * 100), currency)

  const post = async (key: string, url: string, body: object, done: string) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(key)
    setError(null)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      if (form) setError(res.error)
      else toast(res.error, { tone: 'danger' })
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 2200 })
    return true
  }

  const toggleCod = (next: boolean) =>
    post('cod', '/api/app/shipping/cod', { enabled: next }, next ? 'الدفع عند الاستلام اتفتح — هيظهر للعميل' : 'الدفع عند الاستلام اتقفل — مش هيظهر للعميل')

  const toggleMethod = (m: PaymentMethod) =>
    m.gateway === 'cod'
      ? toggleCod(!m.enabled)
      : post(
          `m-${m.gateway}`,
          '/api/app/payments/method',
          { gateway: m.gateway, enabled: !m.enabled, displayName: m.displayName || m.defaultName, instructions: m.instructions, fixedFee: '' },
          m.enabled ? `${m.title} اتقفل` : `${m.title} اتفعّل`,
        )

  const openMethod = (m: PaymentMethod) => {
    haptic('LIGHT')
    setError(null)
    setForm({ gateway: m.gateway, enabled: m.enabled, displayName: m.displayName, instructions: m.instructions, fee: m.fee })
  }

  const methods = data?.methods ?? []
  const method = form ? methods.find((m) => m.gateway === form.gateway) ?? null : null
  const attempts = data?.attempts ?? []
  const failedCount = attempts.filter((a) => a.status === 'failed').length

  return (
    <Screen visible={visible} title="الدفع" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الدفع</h1>
            <p class="page-sub">فعّل طرق الدفع اللي تناسبك — اللي تفعّله بيظهر للعميل في الشيك أوت فورًا.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب إعدادات الدفع</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:84px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            <div class="pv-sec rise">
              <h2>طرق من غير وسيط</h2>
              <p>شغّالة على طول — من غير حساب ولا مفاتيح ولا عمولة لحد.</p>
            </div>
            <div class="card ops-list rise">
              {methods.map((m) => (
                <div key={m.gateway} class="bl-row">
                  <button type="button" class="bg-open press" onClick={() => openMethod(m)}>
                    <span class="pv-icon">
                      <Icon svg={m.gateway === 'cod' ? WALLET_ICON : icons.creditCard()} />
                    </span>
                    <span class="bl-main">
                      <b>{m.title}</b>
                      <small class={m.enabled ? 'pv-ok' : undefined}>
                        {m.enabled ? `${m.displayName}${m.hasFee && m.fee ? ` · رسوم ${money(m.fee)}` : ''}` : 'مقفول — مش ظاهر للعميل'}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="switch-btn"
                    role="switch"
                    aria-checked={m.enabled}
                    aria-label={m.enabled ? `إيقاف ${m.title}` : `تفعيل ${m.title}`}
                    onClick={() => void toggleMethod(m)}
                  >
                    <span class={`switch${m.enabled ? ' switch--on' : ''}${busy === (m.gateway === 'cod' ? 'cod' : `m-${m.gateway}`) ? ' switch--busy' : ''}`}>
                      <span />
                    </span>
                  </button>
                </div>
              ))}
            </div>

            <div class="pv-sec rise">
              <h2>بوابات الدفع الإلكتروني</h2>
              <p>افتح حسابك عند البوابة، هات مفاتيحك، والزقها هنا — وفلوس طلباتك بتنزل حسابك إنت مباشرة. إحنا مش وسيط ومش بناخد عمولة.</p>
            </div>
            <div class="card ops-list rise">
              {data.gateways.map((p) => (
                <ProviderRow
                  key={p.slug}
                  p={p}
                  busy={busy === `p-${p.slug}`}
                  onOpen={() => {
                    haptic('LIGHT')
                    setProvider(p)
                  }}
                  onToggle={() => void post(`p-${p.slug}`, providerUrl('payment'), providerBody(p, !p.enabled), p.enabled ? `${p.name} اتوقفت` : `${p.name} اتفعّلت`)}
                />
              ))}
            </div>

            {attempts.length > 0 && (
              <>
                <div class="pv-sec rise">
                  <h2>محاولات الدفع</h2>
                  <p>
                    آخر {formatNumber(attempts.length)} محاولة على متجرك.
                    {failedCount > 0 && <b class="pv-err"> {formatNumber(failedCount)} منها فشلت — السبب مكتوب تحت كل واحدة.</b>}
                  </p>
                </div>
                <div class="card ops-list rise">
                  {attempts.map((a) => (
                    <div key={a.id} class="bl-row">
                      <button
                        type="button"
                        class="bg-open press"
                        disabled={!a.orderId}
                        onClick={() => {
                          if (!a.orderId) return
                          haptic('LIGHT')
                          navigate(`/dashboard/orders/${encodeURIComponent(a.orderId)}`)
                        }}
                      >
                        <span class="bl-main">
                          <b>
                            {a.gateway}
                            {a.orderNumber !== null && (
                              <>
                                {' · '}
                                <bdi dir="ltr">#{a.orderNumber}</bdi>
                              </>
                            )}
                            <span class={`pv-mode pv-tone--${a.tone}`}>{a.statusLabel}</span>
                          </b>
                          <small>{formatDateTime(a.createdAt)}</small>
                          {a.error && <small class="pv-err">{a.error}</small>}
                        </span>
                        <span class="pv-amount">{a.amount > 0 ? formatMoney(a.amount, a.currency) : '—'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(form)} tall title={method?.title ?? ''} onClose={() => setForm(null)}>
        {form && method && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (form.enabled && !form.displayName.trim()) return setError('اكتب اسمًا للطريقة يشوفه العميل')
              const ok = await post(
                'method',
                '/api/app/payments/method',
                { gateway: form.gateway, enabled: form.enabled, displayName: form.displayName, instructions: form.instructions, fixedFee: toLatin(form.fee) },
                'اتحفظ',
              )
              if (ok) setForm(null)
            }}
          >
            <p class="np-note">{method.desc}</p>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                if (form.gateway === 'cod') {
                  /* الدفع عند الاستلام بيتحفظ لحظة ما المفتاح يتحرّك — زي صفحة الشحن */
                  void toggleCod(!method.enabled)
                  return
                }
                haptic('LIGHT')
                setForm({ ...form, enabled: !form.enabled })
              }}
            >
              <span class="switch-text">
                <b>{form.gateway === 'cod' ? 'مفتوح للعملاء' : 'مفعّل'}</b>
                <small>
                  {form.gateway === 'cod'
                    ? 'بيتفتح ويتقفل على طول (نفس مفتاح صفحة الشحن)'
                    : form.enabled
                      ? 'هيظهر للعميل في الشيك أوت'
                      : 'مش ظاهر للعميل'}
                </small>
              </span>
              <span class={`switch${(form.gateway === 'cod' ? method.enabled : form.enabled) ? ' switch--on' : ''}${busy === 'cod' ? ' switch--busy' : ''}`}>
                <span />
              </span>
            </button>
            <label class="np-label">
              الاسم اللي يشوفه العميل
              <input class="np-input" value={form.displayName} maxLength={80} onInput={(e) => setForm({ ...form, displayName: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            {method.hasFee && (
              <label class="np-label">
                رسوم إضافية (اختياري)
                <input class="np-input num" inputMode="decimal" dir="ltr" placeholder="0" value={form.fee} onInput={(e) => setForm({ ...form, fee: (e.currentTarget as HTMLInputElement).value })} />
                <small class="pv-hint">بتتضاف على إجمالي الطلب. سيبها فاضية لو مفيش رسوم.</small>
              </label>
            )}
            {method.hasInstructions && (
              <label class="np-label">
                {method.instructionsLabel}
                <textarea class="np-input np-textarea" rows={4} maxLength={1000} value={form.instructions} onInput={(e) => setForm({ ...form, instructions: (e.currentTarget as HTMLTextAreaElement).value })} />
                {method.instructionsHint && <small class="pv-hint">{method.instructionsHint}</small>}
              </label>
            )}
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setForm(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                {busy === 'method' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </div>
          </form>
        )}
      </Sheet>

      <ProviderSheet provider={provider} kind="payment" currency={currency} onClose={() => setProvider(null)} onSaved={load} />
    </Screen>
  )
}
