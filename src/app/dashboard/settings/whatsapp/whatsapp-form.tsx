'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, ExternalLink, Loader2, QrCode, Save, Send, ShieldAlert } from 'lucide-react'
import {
  linkWhatsappAction,
  saveAccessTokenAction,
  saveWhatsappAction,
  testWhatsappAction,
  unlinkWhatsappAction,
  whatsappStatusAction,
  type WaState,
} from './actions'
import { Alert, Card } from '@/components/ui'
import { Choice, Row, TextField } from '@/components/dashboard/controls'
import type { WhatsappProvider, WhatsappSettings } from '@/lib/whatsapp'

/**
 * ربط واتساب المتجر.
 *
 * التاجر بيختار طريقه: بوابة سهلة بتربط رقمه العادي في دقايق، أو
 * الطريق الرسمي من ميتا. الفرق بينهم مش تقني بس — فيه مخاطرة
 * حقيقية في الأول، ومكتوبة له بالنص هنا عشان يقرّر وهو عارف.
 */
export function WhatsappForm({
  initial,
  easyLink,
  storePhone,
  hasPlatformToken,
}: {
  initial: WhatsappSettings
  easyLink: boolean
  storePhone: string | null
  /** المنصة حاطّة توكنًا عامًا؟ ساعتها التاجر مش محتاج حساب أصلًا */
  hasPlatformToken: boolean
}) {
  const [provider, setProvider] = useState<WhatsappProvider>(initial.provider)
  const [apiKey, setApiKey] = useState('')
  const [phoneId, setPhoneId] = useState(initial.phoneId ?? '')
  const [testPhone, setTestPhone] = useState('')
  const [msg, setMsg] = useState<WaState>(null)
  const [linkPhone, setLinkPhone] = useState(storePhone ?? '')
  const [qr, setQr] = useState<string | null>(null)
  const [linked, setLinked] = useState(initial.provider === 'wasender' && initial.hasKey)
  const [linking, startLink] = useTransition()
  const [advanced, setAdvanced] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [hasToken, setHasToken] = useState(initial.hasAccessToken || hasPlatformToken)
  const [saving, startSave] = useTransition()
  const [testing, startTest] = useTransition()

  /*
    بنسأل كل تلات ثواني بعد ما الكود يظهر.

    التاجر بيمسح بموبايله، ومفيش حاجة بتقول للصفحة إنه خلص غير
    السؤال. وبيقف أول ما يتوصّل عشان ما نفضلش نسأل على الفاضي.
  */
  useEffect(() => {
    if (!qr || linked) return

    const id = setInterval(async () => {
      const status = await whatsappStatusAction()
      if (status === 'connected') {
        setLinked(true)
        setQr(null)
        setMsg({ ok: true, note: 'اتربط ✅ رقمك دلوقتي بيبعت لعملاءك.' })
      }
    }, 3000)

    return () => clearInterval(id)
  }, [qr, linked])

  const saveToken = () =>
    startLink(async () => {
      const res = await saveAccessTokenAction(accessToken)
      setMsg(res)
      if (res?.ok) {
        setHasToken(true)
        setAccessToken('')
      }
    })

  const link = () =>
    startLink(async () => {
      setMsg(null)
      const res = await linkWhatsappAction(linkPhone)
      if (!res.ok) {
        setMsg({ error: res.error })
        return
      }
      if (res.status === 'connected') {
        setLinked(true)
        setQr(null)
        setMsg({ ok: true, note: 'اتربط خلاص ✅' })
      } else {
        setQr(res.qrImage)
      }
    })

  const unlink = () =>
    startLink(async () => {
      setMsg(await unlinkWhatsappAction())
      setLinked(false)
      setQr(null)
    })

  const save = () =>
    startSave(async () => {
      setMsg(await saveWhatsappAction({ provider, apiKey, phoneId }))
      if (apiKey) setApiKey('')
    })

  const test = () =>
    startTest(async () => {
      setMsg(await testWhatsappAction(testPhone))
    })

  return (
    <div className="flex flex-col gap-6">
      {msg?.ok && <Alert tone="success">{msg.note ?? 'اتحفظ'}</Alert>}
      {msg?.error && <Alert tone="danger">{msg.error}</Alert>}

      {easyLink && (
        <Card className="flex flex-col gap-5 p-5">
          <div>
            <h2 className="font-semibold">اربط رقمك</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              امسح كود بموبايلك زي واتساب ويب بالظبط — من غير ما تفتح حساب عند حد.
            </p>
          </div>

          {/*
            التوكن أول خطوة — ومرة واحدة.

            الحساب باسم التاجر والفاتورة عليه، فلازم يجيب توكنه هو.
            بعد كده كل حاجة بتحصل هنا: الجلسة والكود والحالة والإرسال.
          */}
          {!hasToken && !linked && (
            <div className="flex flex-col gap-3 rounded-lg bg-[var(--surface-2)] p-4">
              <p className="text-sm font-semibold">خطوة واحدة مرة واحدة</p>
              <ol className="flex flex-col gap-1.5 text-sm text-[var(--fg-muted)]">
                <li>
                  ١. اعمل حساب على{' '}
                  <a
                    href="https://wasenderapi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
                  >
                    wasenderapi.com
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
                <li>٢. من الإعدادات، انسخ «Personal Access Token».</li>
                <li>٣. الصقه تحت واحفظ — وبعدها كل حاجة هنا.</li>
              </ol>

              <div className="flex flex-wrap gap-2">
                <input
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  dir="ltr"
                  placeholder="Personal Access Token"
                  aria-label="توكن الحساب"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-xs focus:border-[var(--primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveToken}
                  disabled={linking || accessToken.trim().length < 10}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
                >
                  {linking ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  احفظ التوكن
                </button>
              </div>

              <p className="text-xs text-[var(--fg-subtle)]">
                الحساب باسمك والاشتراك عليك — إحنا بنشيل خطوات الإعداد بس.
              </p>
            </div>
          )}

          {linked ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#25D366]/10 p-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#128C4A]">
                <Check className="h-4 w-4" aria-hidden="true" />
                رقمك مربوط وشغّال
              </span>
              <button
                type="button"
                onClick={unlink}
                disabled={linking}
                className="min-h-10 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                افصل الرقم
              </button>
            </div>
          ) : qr ? (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-[var(--surface-2)] p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="كود ربط واتساب"
                width={260}
                height={260}
                className="rounded-lg bg-white p-2"
              />
              <ol className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
                <li>١. افتح واتساب على الموبايل اللي فيه رقم المتجر.</li>
                <li>٢. الإعدادات ← الأجهزة المرتبطة ← ربط جهاز.</li>
                <li>٣. صوّر الكود ده.</li>
              </ol>
              <span className="flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                مستنيين المسح…
              </span>
            </div>
          ) : hasToken ? (
            <Row label="رقم واتساب المتجر" hint="الرسايل هتطلع من الرقم ده وباسم متجرك.">
              <div className="flex flex-wrap gap-2">
                <input
                  value={linkPhone}
                  onChange={(e) => setLinkPhone(e.target.value)}
                  dir="ltr"
                  placeholder="01012345678"
                  aria-label="رقم واتساب المتجر"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={link}
                  disabled={linking || linkPhone.trim().length < 8}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#25D366' }}
                >
                  {linking ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                  )}
                  اربط
                </button>
              </div>
            </Row>
          ) : null}

          {/*
            المخاطرة مكتوبة هنا كمان.
            الربط السهل بيمرّ على نفس البوابة غير الرسمية — سهولته
            ما بتغيّرش إن الرقم ممكن يتقفل، والتاجر لازم يعرف.
          */}
          <div className="flex items-start gap-2 text-xs leading-relaxed text-[var(--fg-subtle)]">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              الربط بيمرّ ببوابة مش معتمدة رسميًا من واتساب. استعمل رقمًا مخصّصًا للمتجر مش رقمك
              الشخصي، وابعت للعملاء اللي طلبوا منك بس.
            </span>
          </div>
        </Card>
      )}

      {easyLink && (
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="w-fit text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          {advanced ? 'إخفاء الربط اليدوي' : 'عندي حساب بمفاتيحي — ربط يدوي'}
        </button>
      )}

      <Card className={`flex flex-col gap-5 p-5 ${easyLink && !advanced ? 'hidden' : ''}`}>
        <div>
          <h2 className="font-semibold">طريقة الربط</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            الرسايل بتطلع باسم متجرك ومن رقمك إنت — مش من رقمنا.
          </p>
        </div>

        <Choice
          label="المزوّد"
          value={provider}
          onChange={(v) => setProvider(v)}
          options={[
            { value: 'off', label: 'مقفول' },
            { value: 'wasender', label: 'بوابة سريعة' },
            { value: 'cloud', label: 'واتساب بزنس الرسمي' },
          ]}
        />

        {provider === 'wasender' && (
          <>
            {/*
              المخاطرة مكتوبة قبل الخانات لا بعدها.

              الطريقة دي مش معتمدة من واتساب: بتربط رقمًا عاديًا زي ما
              تكون فاتحه على كمبيوتر. سهلة وسريعة، لكن الرقم ممكن
              يتقفل. التاجر لازم يقرا ده وهو بيختار، مش بعد ما يحصل.
            */}
            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8 p-3">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]"
                aria-hidden="true"
              />
              <div className="min-w-0 text-xs leading-relaxed">
                <p className="font-semibold">اقرا ده قبل ما تربط</p>
                <p className="mt-1 text-[var(--fg-muted)]">
                  الطريقة دي بتربط رقم واتساب عادي بمسح كود — سهلة وبتشتغل في دقايق، لكنها
                  <strong> مش معتمدة رسميًا من واتساب</strong> والرقم ممكن يتقفل لو الإرسال كتير أو
                  العملاء بلّغوا عنه.
                </p>
                <p className="mt-1 text-[var(--fg-muted)]">
                  نصيحتنا: استعمل <strong>رقمًا مخصّصًا للمتجر</strong> مش رقمك الشخصي، وابعت
                  للعملاء اللي طلبوا منك بس.
                </p>
              </div>
            </div>

            <ol className="flex flex-col gap-2 rounded-lg bg-[var(--surface-2)] p-4 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-[var(--primary)]">١.</span>
                <span>
                  افتح{' '}
                  <a
                    href="https://wasenderapi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
                  >
                    wasenderapi.com
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>{' '}
                  واعمل حساب — فيه تجربة مجانية.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[var(--primary)]">٢.</span>
                <span>اعمل جلسة جديدة، وامسح الكود من واتساب على موبايل المتجر.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[var(--primary)]">٣.</span>
                <span>انسخ مفتاح الـAPI من صفحة الجلسة، والصقه تحت.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[var(--primary)]">٤.</span>
                <span>احفظ، وابعت رسالة تجربة لنفسك عشان تتأكد.</span>
              </li>
            </ol>
          </>
        )}

        {provider === 'cloud' && (
          <div className="rounded-lg bg-[var(--surface-2)] p-4 text-sm leading-relaxed text-[var(--fg-muted)]">
            <p className="font-semibold text-[var(--fg)]">الطريق الرسمي</p>
            <p className="mt-1">
              محتاج حساب Meta Business متحقَّق منه، ورقم بيتسجّل في واتساب بزنس —{' '}
              <strong>والرقم ده بيتشال من تطبيق واتساب العادي</strong>. أثبت وأأمن، بس بياخد وقت
              في التسجيل والموافقة.
            </p>
            <p className="mt-1">
              خُد <span className="font-medium">معرّف رقم الهاتف</span> و
              <span className="font-medium">توكن دائم</span> من لوحة Meta for Developers.
            </p>
          </div>
        )}

        {provider !== 'off' && (
          <>
            <TextField
              label={provider === 'cloud' ? 'التوكن الدائم' : 'مفتاح الـAPI'}
              value={apiKey}
              onChange={setApiKey}
              ltr
              placeholder={initial.hasKey ? '••••••••  (محفوظ — سيبه فاضي لو مش هتغيّره)' : ''}
              hint="بيتخزّن مشفّرًا وما بيظهرش تاني — لو نسيته، هات واحدًا جديدًا من المزوّد."
            />

            {provider === 'cloud' && (
              <TextField
                label="معرّف رقم الهاتف"
                value={phoneId}
                onChange={setPhoneId}
                ltr
                placeholder="123456789012345"
              />
            )}
          </>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : msg?.ok ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          حفظ
        </button>
      </Card>

      {(initial.hasKey || provider !== 'off') && (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-semibold">جرّب الربط</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              ابعت رسالة لنفسك دلوقتي — أحسن من إنك تكتشف إنها مش شغّالة لما عميل يستنّى رمز
              دخول ما وصلوش.
            </p>
          </div>

          <Row label="رقم للتجربة">
            <div className="flex flex-wrap gap-2">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                dir="ltr"
                placeholder="01012345678"
                aria-label="رقم للتجربة"
                className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={test}
                disabled={testing || testPhone.trim().length < 8}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                ابعت تجربة
              </button>
            </div>
          </Row>
        </Card>
      )}

      <Card className="flex flex-col gap-2 p-5">
        <h2 className="font-semibold">اللي بيتبعت تلقائيًا</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-[var(--fg-muted)]">
          <li>• رمز دخول العميل لما يسجّل برقمه — من غير ما يحتاج بريد.</li>
          <li>• تأكيد الطلب أول ما العميل يأكّده.</li>
          <li>• تغيير حالة الطلب: اتشحن، اتسلّم، اتلغى.</li>
        </ul>
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">
          العميل اللي مساب بريده بيوصله كل ده على واتساب — ودي الحالة اللي كان بيضيع فيها.
        </p>
      </Card>
    </div>
  )
}
