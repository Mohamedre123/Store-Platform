'use client'

import { useState, useTransition } from 'react'
import { Check, ExternalLink, Loader2, Save, Send, ShieldAlert } from 'lucide-react'
import { saveWhatsappAction, testWhatsappAction, type WaState } from './actions'
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
export function WhatsappForm({ initial }: { initial: WhatsappSettings }) {
  const [provider, setProvider] = useState<WhatsappProvider>(initial.provider)
  const [apiKey, setApiKey] = useState('')
  const [phoneId, setPhoneId] = useState(initial.phoneId ?? '')
  const [testPhone, setTestPhone] = useState('')
  const [msg, setMsg] = useState<WaState>(null)
  const [saving, startSave] = useTransition()
  const [testing, startTest] = useTransition()

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

      <Card className="flex flex-col gap-5 p-5">
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
