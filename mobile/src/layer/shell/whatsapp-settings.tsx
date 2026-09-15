/**
 * واتساب المتجر — شاشة أصلية (`/dashboard/settings/whatsapp`).
 *
 * نفس `WhatsappForm` و`TemplatesEditor` في اللوحة:
 * - «اربط رقمك»: خطوة التوكن مرة واحدة (إنشاء الحساب برّه + بياناتك جاهزة للنسخ + التحذير + لزق التوكن)،
 *   رقم المتجر ← «اربط» ← كود المسح والتطبيق بيسأل كل ٣ ثواني لحد ما يتربط، «رقمك مربوط» و«افصل الرقم».
 * - «ربط يدوي»: المزوّد (مقفول / بوابة سريعة / الرسمي) بالتحذير والخطوات، المفتاح (الفاضي = سيب المحفوظ)، معرّف الرقم.
 * - «جرّب الربط» برسالة لرقم، و«اللي بيتبعت تلقائيًا».
 * - «نصوص الرسايل»: تبويب لكل رسالة، المتغيّرات بتتلزق مكان المؤشّر، «رجّع الافتراضي»، وتحذير `{{كود}}`.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { postAppJson, useResource } from './http'
import { openExternal } from './navigate'
import { COPY_ICON, copyText } from './ops-api'
import { Screen } from './screen'
import { Group, LoadState, Modes, useSyncedForm } from './settings-forms'
import { whatsappData, type WhatsappProvider } from './store-settings-api'
import { Icon } from './ui'

/** رابط صفحة إنشاء الحساب مباشرةً — نفس `SIGNUP_URL` في اللوحة */
const SIGNUP_URL = 'https://www.wasenderapi.com/register'

const QR_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>'

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div class="st-copy">
      <small>{label}</small>
      <bdi dir="ltr">{value}</bdi>
      <button type="button" class="ops-icon press" aria-label={`انسخ ${label}`} onClick={() => void copyText(value, 'اتنسخ')}>
        <Icon svg={COPY_ICON} />
      </button>
    </div>
  )
}

function Risk({ children }: { children: string }) {
  return (
    <p class="st-risk">
      <Icon svg={icons.alertTriangle()} />
      <span>{children}</span>
    </p>
  )
}

export function WhatsappSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(whatsappData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [linkPhone, setLinkPhone] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const manual = useSyncedForm(data, (d) => ({ provider: d.settings.provider, phoneId: d.settings.phoneId ?? '', apiKey: '' }))
  const texts = useSyncedForm(data, (d) => ({ ...d.templates }) as Record<string, string>)
  const [tab, setTab] = useState('otp')
  const box = useRef<HTMLTextAreaElement>(null)

  /* رقم المتجر بيتكتب لوحده أول مرة */
  useEffect(() => {
    if (data?.storePhone && !linkPhone) setLinkPhone(data.storePhone)
  }, [data])

  /* بعد ما الكود يظهر: بنسأل كل ٣ ثواني لحد ما التاجر يمسحه */
  useEffect(() => {
    if (!qr || !visible) return
    const id = setInterval(async () => {
      const res = await postAppJson<{ status: string }>('/api/app/whatsapp/status', {})
      if (res.ok && res.data.status === 'connected') {
        setQr(null)
        hapticNotify('SUCCESS')
        toast('اتربط ✅ رقمك دلوقتي بيبعت لعملاءك.', { tone: 'success', duration: 3000 })
        void load()
      }
    }, 3000)
    return () => clearInterval(id)
  }, [qr, visible])

  const call = async <T,>(key: string, url: string, body: object): Promise<T | null> => {
    if (busy) return null
    haptic('LIGHT')
    setBusy(key)
    setError(null)
    const res = await postAppJson<T>(url, body)
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      setError(res.error)
      toast(res.error, { tone: 'danger', duration: 4500 })
      return null
    }
    hapticNotify('SUCCESS')
    return res.data
  }

  const s = data?.settings
  const linked = Boolean(s && s.provider === 'wasender' && s.hasKey)
  const hasToken = Boolean(s && (s.hasAccessToken || data?.hasPlatformToken))
  const m = manual.form
  const t = texts.form
  const keyInfo = data?.templateKeys.find((k) => k.key === tab) ?? data?.templateKeys[0]
  const current = keyInfo && t ? (t[keyInfo.key] ?? keyInfo.fallback) : ''

  const insertVar = (name: string) => {
    if (!keyInfo || !t) return
    haptic('LIGHT')
    const token = `{{${name}}}`
    const el = box.current
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? start
    texts.patch({ [keyInfo.key]: current.slice(0, start) + token + current.slice(end) })
    setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    }, 30)
  }

  return (
    <Screen visible={visible} title="واتساب" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">واتساب</h1>
            <p class="page-sub">اربط رقم متجرك عشان رموز الدخول وتأكيد الطلبات توصل لعملاءك على واتساب.</p>
          </div>
        </header>

        {!data || !s || !m || !t ? (
          <LoadState failed={failed} what="إعدادات واتساب" />
        ) : (
          <>
            <Group title="اربط رقمك" lead="امسح كود بموبايلك زي واتساب ويب بالظبط — من غير ما تفتح حساب عند حد.">
              {!hasToken && !linked && (
                <div class="st-box">
                  <b>خطوة واحدة مرة واحدة</b>
                  <ol class="st-steps">
                    <li>١. دوس الزر تحت واعمل حساب — دقيقة.</li>
                    <li>٢. من الإعدادات عندهم، انسخ «Personal Access Token».</li>
                    <li>٣. الصقه تحت واحفظ — وبعدها كل حاجة هنا.</li>
                  </ol>
                  <button type="button" class="btn btn--primary press" onClick={() => (haptic('LIGHT'), openExternal(SIGNUP_URL))}>
                    اعمل حساب على wasenderapi
                    <Icon svg={icons.externalLink()} />
                  </button>
                  <small class="fine">بياناتك جاهزة — انسخها والزقها عندهم</small>
                  <CopyRow label="الاسم" value={data.account.name} />
                  <CopyRow label="البريد" value={data.account.email} />
                  <p class="np-note st-warn">
                    <b>مهم:</b> على موقع البوابة خُد التوكن <b>وبس</b> — ما تعملش جلسة وما تحطّش رقمك هناك. إحنا اللي بننشئ الجلسة ونطلّعلك كود المسح من
                    هنا. لو عملتها هناك، البوابة هترفض وتقول «الرقم متسجّل خلاص».
                  </p>
                  <div class="st-inline">
                    <input
                      class="np-input st-mono"
                      dir="ltr"
                      placeholder="Personal Access Token"
                      aria-label="توكن الحساب"
                      value={token}
                      onInput={(e) => setToken((e.currentTarget as HTMLInputElement).value)}
                    />
                    <button
                      type="button"
                      class="btn btn--primary press"
                      disabled={Boolean(busy) || token.trim().length < 10}
                      onClick={async () => {
                        const res = await call<{ note: string | null }>('token', '/api/app/whatsapp/token', { token })
                        if (!res) return
                        setToken('')
                        toast(res.note ?? 'اتحفظ', { tone: 'success', duration: 2600 })
                        await load()
                      }}
                    >
                      {busy === 'token' ? <span class="spinner" /> : null}
                      احفظ
                    </button>
                  </div>
                  <small class="fine">الحساب باسمك والاشتراك عليك — إحنا بنشيل خطوات الإعداد بس.</small>
                </div>
              )}

              {linked ? (
                confirmUnlink ? (
                  <div class="st-box">
                    <p class="sheet-text">الرقم هيتفصل وهيتشال من البوابة، ورسايل الطلبات ورموز الدخول مش هتتبعت على واتساب لحد ما تربطه تاني.</p>
                    <div class="btn-row">
                      <button type="button" class="btn btn--ghost press" onClick={() => setConfirmUnlink(false)}>
                        رجوع
                      </button>
                      <button
                        type="button"
                        class="btn btn--danger press"
                        disabled={Boolean(busy)}
                        onClick={async () => {
                          const res = await call<{ note: string | null }>('unlink', '/api/app/whatsapp/unlink', {})
                          if (!res) return
                          setConfirmUnlink(false)
                          setQr(null)
                          toast(res.note ?? 'الرقم اتفصل', { tone: 'success', duration: 2400 })
                          await load()
                        }}
                      >
                        {busy === 'unlink' ? <span class="spinner" /> : null}
                        أيوه، افصله
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="st-linked">
                    <span>
                      <Icon svg={icons.check()} />
                      رقمك مربوط وشغّال
                    </span>
                    <button type="button" class="act press" onClick={() => (haptic('LIGHT'), setConfirmUnlink(true))}>
                      افصل الرقم
                    </button>
                  </div>
                )
              ) : qr ? (
                <div class="st-qr">
                  <img src={qr} alt="كود ربط واتساب" width={240} height={240} />
                  <ol class="st-steps">
                    <li>١. افتح واتساب على الموبايل اللي فيه رقم المتجر.</li>
                    <li>٢. الإعدادات ← الأجهزة المرتبطة ← ربط جهاز.</li>
                    <li>٣. صوّر الكود ده.</li>
                  </ol>
                  <p class="np-note">لو رقم المتجر على نفس الموبايل ده: افتح الكود من الكمبيوتر أو موبايل تاني، أو صوّر الشاشة وافتحها على جهاز تاني.</p>
                  <span class="st-wait">
                    <span class="spinner" />
                    مستنيين المسح…
                  </span>
                  <button type="button" class="btn btn--ghost press" onClick={() => setQr(null)}>
                    إلغاء
                  </button>
                </div>
              ) : hasToken ? (
                <label class="np-label">
                  رقم واتساب المتجر
                  <div class="st-inline">
                    <input
                      class="np-input"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="01012345678"
                      value={linkPhone}
                      onInput={(e) => setLinkPhone((e.currentTarget as HTMLInputElement).value)}
                    />
                    <button
                      type="button"
                      class="btn btn--wa press"
                      disabled={Boolean(busy) || linkPhone.trim().length < 8}
                      onClick={async () => {
                        const res = await call<{ status: 'connected' | 'scan'; qrImage?: string }>('link', '/api/app/whatsapp/link', { phone: linkPhone })
                        if (!res) return
                        if (res.status === 'connected') {
                          toast('اتربط خلاص ✅', { tone: 'success', duration: 2600 })
                          await load()
                        } else if (res.qrImage) setQr(res.qrImage)
                      }}
                    >
                      {busy === 'link' ? <span class="spinner" /> : <Icon svg={QR_ICON} />}
                      اربط
                    </button>
                  </div>
                  <small class="pv-hint">الرسايل هتطلع من الرقم ده وباسم متجرك.</small>
                </label>
              ) : null}

              <Risk>الربط بيمرّ ببوابة مش معتمدة رسميًا من واتساب. استعمل رقمًا مخصّصًا للمتجر مش رقمك الشخصي، وابعت للعملاء اللي طلبوا منك بس.</Risk>
              {error && <p class="np-error">{error}</p>}
            </Group>

            <button type="button" class="st-toggle press rise" onClick={() => (haptic('LIGHT'), setAdvanced(!advanced))}>
              {advanced ? 'إخفاء الربط اليدوي' : 'عندي حساب بمفاتيحي — ربط يدوي'}
              <Icon svg={icons.chevronDown()} className={`ic st-chev${advanced ? ' st-chev--up' : ''}`} />
            </button>

            {advanced && (
              <Group title="طريقة الربط" lead="الرسايل بتطلع باسم متجرك ومن رقمك إنت — مش من رقمنا.">
                <Modes<WhatsappProvider>
                  label="المزوّد"
                  value={m.provider}
                  options={[
                    { value: 'off', label: 'مقفول' },
                    { value: 'wasender', label: 'بوابة سريعة' },
                    { value: 'cloud', label: 'واتساب بزنس الرسمي' },
                  ]}
                  onChange={(x) => manual.patch({ provider: x })}
                />

                {m.provider === 'wasender' && (
                  <>
                    <div class="np-note st-warn">
                      <b>اقرا ده قبل ما تربط</b>
                      <br />
                      الطريقة دي بتربط رقم واتساب عادي بمسح كود — سهلة وبتشتغل في دقايق، لكنها <b>مش معتمدة رسميًا من واتساب</b> والرقم ممكن يتقفل لو الإرسال
                      كتير أو العملاء بلّغوا عنه.
                      <br />
                      نصيحتنا: استعمل <b>رقمًا مخصّصًا للمتجر</b> مش رقمك الشخصي، وابعت للعملاء اللي طلبوا منك بس.
                    </div>
                    <ol class="st-steps st-box">
                      <li>
                        ١. افتح{' '}
                        <button type="button" class="st-link" onClick={() => openExternal('https://wasenderapi.com')}>
                          wasenderapi.com
                        </button>{' '}
                        واعمل حساب — فيه تجربة مجانية.
                      </li>
                      <li>٢. اعمل جلسة جديدة، وامسح الكود من واتساب على موبايل المتجر.</li>
                      <li>٣. انسخ مفتاح الـAPI من صفحة الجلسة، والصقه تحت.</li>
                      <li>٤. احفظ، وابعت رسالة تجربة لنفسك عشان تتأكد.</li>
                    </ol>
                  </>
                )}

                {m.provider === 'cloud' && (
                  <div class="np-note">
                    <b>الطريق الرسمي</b>
                    <br />
                    محتاج حساب Meta Business متحقَّق منه، ورقم بيتسجّل في واتساب بزنس — <b>والرقم ده بيتشال من تطبيق واتساب العادي</b>. أثبت وأأمن، بس بياخد
                    وقت في التسجيل والموافقة.
                    <br />
                    خُد <b>معرّف رقم الهاتف</b> و<b>توكن دائم</b> من لوحة Meta for Developers.
                  </div>
                )}

                {m.provider !== 'off' && (
                  <>
                    <label class="np-label">
                      {m.provider === 'cloud' ? 'التوكن الدائم' : 'مفتاح الـAPI'}
                      <input
                        class="np-input st-mono"
                        dir="ltr"
                        autocomplete="off"
                        placeholder={s.hasKey ? '••••••••  (محفوظ — سيبه فاضي لو مش هتغيّره)' : ''}
                        value={m.apiKey}
                        onInput={(e) => manual.patch({ apiKey: (e.currentTarget as HTMLInputElement).value })}
                      />
                      <small class="pv-hint">بيتخزّن مشفّرًا وما بيظهرش تاني — لو نسيته، هات واحدًا جديدًا من المزوّد.</small>
                    </label>
                    {m.provider === 'cloud' && (
                      <label class="np-label">
                        معرّف رقم الهاتف
                        <input
                          class="np-input"
                          dir="ltr"
                          inputMode="numeric"
                          placeholder="123456789012345"
                          value={m.phoneId}
                          onInput={(e) => manual.patch({ phoneId: (e.currentTarget as HTMLInputElement).value })}
                        />
                      </label>
                    )}
                  </>
                )}

                <button
                  type="button"
                  class="btn btn--primary press"
                  disabled={Boolean(busy)}
                  onClick={async () => {
                    const res = await call<{ note: string | null }>('save', '/api/app/whatsapp/save', { provider: m.provider, apiKey: m.apiKey, phoneId: m.phoneId })
                    if (!res) return
                    manual.saved()
                    toast('اتحفظ', { tone: 'success', duration: 2000 })
                    await load()
                  }}
                >
                  {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                  حفظ
                </button>
              </Group>
            )}

            {(s.hasKey || m.provider !== 'off') && (
              <Group title="جرّب الربط" lead="ابعت رسالة لنفسك دلوقتي — أحسن من إنك تكتشف إنها مش شغّالة لما عميل يستنّى رمز دخول ما وصلوش.">
                <label class="np-label">
                  رقم للتجربة
                  <div class="st-inline">
                    <input
                      class="np-input"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="01012345678"
                      value={testPhone}
                      onInput={(e) => setTestPhone((e.currentTarget as HTMLInputElement).value)}
                    />
                    <button
                      type="button"
                      class="btn btn--ghost press"
                      disabled={Boolean(busy) || testPhone.trim().length < 8}
                      onClick={async () => {
                        const res = await call<{ note: string | null }>('test', '/api/app/whatsapp/test', { phone: testPhone })
                        if (res) toast(res.note ?? 'اتبعتت', { tone: 'success', duration: 2600 })
                      }}
                    >
                      {busy === 'test' ? <span class="spinner" /> : <Icon svg={icons.send()} />}
                      ابعت تجربة
                    </button>
                  </div>
                </label>
              </Group>
            )}

            <Group title="اللي بيتبعت تلقائيًا">
              <ul class="st-steps">
                <li>• رمز دخول العميل لما يسجّل برقمه — من غير ما يحتاج بريد.</li>
                <li>• تأكيد الطلب أول ما العميل يأكّده.</li>
                <li>• تغيير حالة الطلب: اتشحن، اتسلّم، اتلغى.</li>
              </ul>
              <small class="fine">العميل اللي مساب بريده بيوصله كل ده على واتساب — ودي الحالة اللي كان بيضيع فيها.</small>
            </Group>

            {keyInfo && (
              <Group title="نصوص الرسايل" lead="اكتبها بصوتك إنت. سيب أي واحدة فاضية وهتتبعت بالنص الافتراضي.">
                <div class="st-tabs">
                  {data.templateKeys.map((k) => (
                    <button key={k.key} type="button" class={`fchip${keyInfo.key === k.key ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), setTab(k.key))}>
                      {k.label}
                      {t[k.key]?.trim() ? <span class="st-dotmark">•</span> : null}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={box}
                  class="np-input np-textarea st-text"
                  rows={7}
                  value={current}
                  onInput={(e) => texts.patch({ [keyInfo.key]: (e.currentTarget as HTMLTextAreaElement).value })}
                />

                <div class="np-label">
                  <small class="fine">دوس عشان تلزق المتغيّر مكان المؤشّر:</small>
                  <div class="st-vars">
                    {keyInfo.vars.map((name) => (
                      <button
                        key={name}
                        type="button"
                        class="st-var press"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => insertVar(name)}
                      >
                        {`{{${name}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {keyInfo.key === 'otp' && (
                  <p class="np-note st-warn">
                    قالب رمز الدخول لازم يكون فيه <bdi dir="ltr">{'{{كود}}'}</bdi> — من غيره العميل هياخد رسالة مالهاش لازمة ومش هيقدر يدخل.
                  </p>
                )}

                <div class="btn-row">
                  {t[keyInfo.key]?.trim() ? (
                    <button type="button" class="btn btn--ghost press" onClick={() => (haptic('LIGHT'), texts.patch({ [keyInfo.key]: '' }))}>
                      <Icon svg={icons.refresh()} />
                      رجّع الافتراضي
                    </button>
                  ) : null}
                  <button
                    type="button"
                    class="btn btn--primary press"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      const res = await call<{ note: string | null }>('templates', '/api/app/whatsapp/templates', { templates: t })
                      if (!res) return
                      texts.saved()
                      toast(res.note ?? 'النصوص اتحفظت', { tone: 'success', duration: 2200 })
                      await load()
                    }}
                  >
                    {busy === 'templates' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                    حفظ النصوص
                  </button>
                </div>
              </Group>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
