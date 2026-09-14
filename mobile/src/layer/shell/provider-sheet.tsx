/**
 * بوابات الدفع وشركات الشحن — صف في القايمة ولوحة الربط.
 *
 * نفس `ProviderCard` في اللوحة: «لسه مش مشترك؟»، الخانات (السرّية بتظهر «محفوظ» من غير قيمة —
 * سيبها فاضية عشان المحفوظ يفضل)، رابط الإشعارات بنسخة، سعر الشحن مع الشركة، الوضع التجريبي،
 * ودليل المطوّرين. «احفظ وفعّل» بيبعت لـ`/api/app/payments/gateway` أو `/api/app/shipping/carrier`.
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import type { Provider } from './commerce-api'
import { postAppJson } from './http'
import { openExternal } from './navigate'
import { COPY_ICON, copyText, toLatin } from './ops-api'
import { Sheet } from './screen'
import { Icon } from './ui'

export type ProviderKind = 'payment' | 'shipping'

export const providerUrl = (kind: ProviderKind) => (kind === 'payment' ? '/api/app/payments/gateway' : '/api/app/shipping/carrier')

/**
 * بيانات الحفظ من حالة المزوّد المحفوظة — للمفتاح السريع في القايمة.
 * الخانات العادية لازم تتبعت بقيمها، وإلا الحفظ بيمسحها.
 */
export function providerBody(p: Provider, enabled: boolean) {
  return {
    slug: p.slug,
    enabled,
    values: Object.fromEntries(p.fields.filter((f) => !f.secret).map((f) => [f.key, f.value])),
    testMode: p.testMode,
    flatRate: p.flatRate,
    freeOver: p.freeOver,
  }
}

function providerStatus(p: Provider): { text: string; tone: '' | 'ok' | 'err' } {
  if (p.lastError) return { text: p.lastError, tone: 'err' }
  if (p.enabled) return { text: p.hasTestMode && p.testMode ? 'مربوطة — وضع تجريبي' : 'مربوطة وشغّالة', tone: 'ok' }
  if (p.hasCreds) return { text: 'موقوفة — مفاتيحها محفوظة', tone: '' }
  return { text: 'دوس عشان تربطها', tone: '' }
}

export function ProviderRow({ p, busy, onOpen, onToggle }: { p: Provider; busy: boolean; onOpen: () => void; onToggle: () => void }) {
  const status = providerStatus(p)
  return (
    <div class="bl-row">
      <button type="button" class="bg-open press" onClick={onOpen}>
        <span class="pv-badge" style={{ background: p.color }} aria-hidden="true">
          {p.brand.slice(0, 2).toUpperCase()}
        </span>
        <span class="bl-main">
          <b>
            {p.name}
            <span class={`pv-mode${p.mode === 'api' ? ' pv-mode--api' : ''}`}>{p.mode === 'api' ? 'تلقائي' : 'يدوي'}</span>
          </b>
          <small class={status.tone ? `pv-${status.tone}` : undefined}>{status.text}</small>
        </span>
      </button>
      {p.hasCreds && (
        <button
          type="button"
          class="switch-btn"
          role="switch"
          aria-checked={p.enabled}
          aria-label={p.enabled ? `إيقاف ${p.name}` : `تفعيل ${p.name}`}
          onClick={onToggle}
        >
          <span class={`switch${p.enabled ? ' switch--on' : ''}${busy ? ' switch--busy' : ''}`}>
            <span />
          </span>
        </button>
      )}
    </div>
  )
}

export function ProviderSheet({
  provider,
  kind,
  currency,
  onClose,
  onSaved,
}: {
  provider: Provider | null
  kind: ProviderKind
  currency: string
  onClose: () => void
  onSaved: () => Promise<unknown>
}) {
  /* آخر مزوّد بيفضل مرسوم واللوحة بتنزل */
  const [last, setLast] = useState<Provider | null>(provider)
  const [values, setValues] = useState<Record<string, string>>({})
  const [testMode, setTestMode] = useState(true)
  const [flatRate, setFlatRate] = useState('')
  const [freeOver, setFreeOver] = useState('')
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!provider) return
    setLast(provider)
    setValues(Object.fromEntries(provider.fields.map((f) => [f.key, f.value])))
    setTestMode(provider.testMode)
    setFlatRate(provider.flatRate)
    setFreeOver(provider.freeOver)
    setShow({})
    setError(null)
    setBusy(false)
  }, [provider?.slug])

  const p = provider ?? last

  const save = async () => {
    if (!provider || busy) return
    haptic('LIGHT')
    setBusy(true)
    setError(null)
    const res = await postAppJson(providerUrl(kind), {
      slug: provider.slug,
      enabled: true,
      values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])),
      testMode,
      flatRate: toLatin(flatRate),
      freeOver: toLatin(freeOver),
    })
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await onSaved()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast(`${provider.name} اتربطت واتفعّلت`, { tone: 'success', duration: 2200 })
    onClose()
  }

  return (
    <Sheet open={Boolean(provider)} tall title={p ? `ربط ${p.name}` : ''} onClose={onClose}>
      {p && (
        <form
          class="np-form ops-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <p class="np-note">{p.desc}</p>
          {p.lastError && <p class="np-error">{p.lastError}</p>}
          {p.mode === 'manual' && (
            <p class="np-note">
              الشركة دي مالهاش API عام موثّق لحد دلوقتي، فالربط <b>يدوي</b>: بتعمل البوليصة على لوحتهم وتنسخ رقمها في
              صفحة الشحنات. حطّ مفاتيحك هنا لو معاك، وأول ما يبقى عندهم API هيشتغل تلقائي.
            </p>
          )}

          <button type="button" class="act press pv-signup" onClick={() => openExternal(p.signupUrl)}>
            <Icon svg={icons.externalLink()} />
            لسه مش مشترك في {p.name}؟ افتح حساب عندهم
          </button>
          {p.where && <small class="pv-hint">{p.where}</small>}

          {p.fields.map((f) => (
            <label key={f.key} class="np-label">
              <span>
                {f.label}
                {!f.required && <span class="pv-opt"> (اختياري)</span>}
              </span>
              {f.secret ? (
                <span class="pv-secret">
                  <input
                    class="np-input"
                    dir="ltr"
                    type={show[f.key] ? 'text' : 'password'}
                    autoComplete="off"
                    placeholder={f.saved ? '•••••••••• (محفوظ)' : f.placeholder}
                    value={values[f.key] ?? ''}
                    maxLength={500}
                    onInput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value
                      setValues((s) => ({ ...s, [f.key]: v }))
                    }}
                  />
                  <button type="button" class="pv-eye" onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                    {show[f.key] ? 'اخفي' : 'اظهر'}
                  </button>
                </span>
              ) : (
                <input
                  class="np-input"
                  dir="ltr"
                  autoComplete="off"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  maxLength={500}
                  onInput={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value
                    setValues((s) => ({ ...s, [f.key]: v }))
                  }}
                />
              )}
              {f.hint && <small class="pv-hint">{f.hint}</small>}
            </label>
          ))}

          {p.webhookUrl && (
            <div class="np-note">
              <b>رابط الإشعارات (Webhook)</b>
              <br />
              الزق الرابط ده في لوحة {p.name}. من غيره حالة الطلب مش هتتحدّث لوحدها — هتفضل تغيّرها بإيدك.
              <div class="pv-code">
                <code>{p.webhookUrl}</code>
                <button type="button" class="ops-icon press" aria-label="انسخ الرابط" onClick={() => void copyText(p.webhookUrl ?? '', 'الرابط اتنسخ')}>
                  <Icon svg={COPY_ICON} />
                </button>
              </div>
            </div>
          )}

          {kind === 'shipping' && (
            <>
              <p class="np-note">
                <b>سعر الشحن معاهم</b>
                <br />
                السعر اللي اتفقت عليه مع {p.name}. أول ما تفعّلها، ده اللي بيظهر للعميل بدل تسعيرك اليدوي. سيبه فاضي عشان
                يفضل تسعيرك اليدوي شغّال.
              </p>
              <div class="np-two">
                <label class="np-label">
                  السعر ({currency})
                  <input class="np-input num" inputMode="decimal" dir="ltr" placeholder="60" value={flatRate} onInput={(e) => setFlatRate((e.currentTarget as HTMLInputElement).value)} />
                </label>
                <label class="np-label">
                  مجاني فوق ({currency})
                  <input class="np-input num" inputMode="decimal" dir="ltr" placeholder="1000" value={freeOver} onInput={(e) => setFreeOver((e.currentTarget as HTMLInputElement).value)} />
                </label>
              </div>
            </>
          )}

          {p.hasTestMode && (
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setTestMode(!testMode)
              }}
            >
              <span class="switch-text">
                <b>وضع تجريبي</b>
                <small>بيستخدم بيئة الاختبار بتاعتهم. اقفله قبل ما تستقبل طلبات حقيقية — الطلبات في الوضع ده فلوسها مش بتتحوّل.</small>
              </span>
              <span class={`switch${testMode ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
          )}

          {p.docsUrl && (
            <button type="button" class="btn btn--ghost press" onClick={() => openExternal(p.docsUrl ?? '')}>
              <Icon svg={icons.externalLink()} />
              دليل {p.name} للمطوّرين
            </button>
          )}

          {error && <p class="np-error">{error}</p>}
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={onClose}>
              رجوع
            </button>
            <button type="submit" class="btn btn--primary press" disabled={busy}>
              {busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
              احفظ وفعّل
            </button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
