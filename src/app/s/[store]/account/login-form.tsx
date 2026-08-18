'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestLoginCodeAction, verifyLoginCodeAction } from './actions'

/**
 * دخول العميل برقمه ورمز تحقق — من غير كلمة مرور.
 *
 * خطوتين: الرقم ثم الرمز. البريد بيتطلب بس لو مش مسجّل قبل كده،
 * فالعميل العائد بيدخل برقمه وخلاص.
 */
export function CustomerLoginForm({ storeIdentifier }: { storeIdentifier: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [needsEmail, setNeedsEmail] = useState(false)
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const input =
    'h-12 w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-base outline-none focus:border-[var(--sf-primary)]'

  function requestCode() {
    setError(null)
    start(async () => {
      const res = await requestLoginCodeAction({
        storeIdentifier,
        phone,
        email: email || undefined,
      })
      if (res?.error) {
        setError(res.error)
        // الرسالة دي معناها إننا محتاجين البريد عشان نبعت
        if (res.error.includes('بريد')) setNeedsEmail(true)
        return
      }
      setTarget(res?.target ?? '')
      setStep('code')
    })
  }

  function verify() {
    setError(null)
    start(async () => {
      const res = await verifyLoginCodeAction({
        storeIdentifier,
        phone,
        code,
        name: name || undefined,
        email: email || undefined,
      })
      if (res?.error) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">حسابك</h1>
        <p className="mt-1 text-sm opacity-70">
          {step === 'phone'
            ? 'ادخل برقمك عشان تشوف طلباتك ومفضّلاتك.'
            : `بعتنا رمزًا على ${target}`}
        </p>
      </div>

      {error && (
        <p className="rounded-[var(--sf-radius)] bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {step === 'phone' ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">رقم التليفون</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
              className={`${input} text-start`}
              placeholder="01012345678"
            />
          </label>

          {needsEmail && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">بريدك الإلكتروني</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  className={`${input} text-start`}
                  placeholder="you@example.com"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">اسمك (اختياري)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={requestCode}
            disabled={pending || phone.trim().length < 8}
            className="min-h-12 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'بنبعت…' : 'ابعت رمز الدخول'}
          </button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">الرمز</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              dir="ltr"
              placeholder="- - - - - -"
              className={`${input} text-center text-xl tracking-[0.5em]`}
            />
          </label>

          <button
            type="button"
            onClick={verify}
            disabled={pending || code.length !== 6}
            className="min-h-12 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'بنتأكد…' : 'دخول'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('phone')
              setCode('')
              setError(null)
            }}
            className="text-sm opacity-70 hover:opacity-100"
          >
            غيّر الرقم
          </button>
        </>
      )}
    </div>
  )
}
