'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { resendCodeAction, verifyCodeAction, type VerifyState } from './actions'
import { Alert, Button, Spinner } from '@/components/ui'
import { config } from '@/lib/config'

/**
 * إدخال رمز التحقق.
 *
 * ست خانات منفصلة بدل حقل واحد — أوضح بصريًا، والانتقال بينها تلقائي.
 * اللصق بيوزّع الأرقام على الخانات، والحذف بيرجّع للخانة السابقة،
 * والنموذج بيتبعت لوحده لما الرمز يكتمل.
 */
export function CodeForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(verifyCodeAction, null)
  const LENGTH = config.otp.length
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [resendState, setResendState] = useState<VerifyState>(null)
  const [resending, setResending] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const formRef = useRef<HTMLFormElement>(null)

  const code = digits.join('')

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  // الإرسال التلقائي بمجرد اكتمال الأرقام الستة
  useEffect(() => {
    if (code.length === LENGTH && !pending) formRef.current?.requestSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  function setDigit(index: number, value: string) {
    const clean = value.replace(/[^\d]/g, '')
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? '' : v)))
      return
    }
    setDigits((d) => {
      const next = [...d]
      // اللصق: وزّع الأرقام على الخانات من موضع الكتابة
      for (let i = 0; i < clean.length && index + i < LENGTH; i++) next[index + i] = clean[i]
      return next
    })
    const jump = Math.min(index + clean.length, LENGTH - 1)
    inputs.current[jump]?.focus()
  }

  async function onResend() {
    setResending(true)
    setResendState(await resendCodeAction())
    setResending(false)
    setDigits(Array(LENGTH).fill(''))
    inputs.current[0]?.focus()
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <MailCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">أكّد بريدك</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          بعتنا رمز من ٦ أرقام على
          <br />
          <bdi dir="ltr" className="font-medium text-[var(--fg)]">
            {email}
          </bdi>
        </p>
      </div>

      {state?.error && <Alert>{state.error}</Alert>}
      {resendState?.error && <Alert>{resendState.error}</Alert>}
      {resendState?.notice && <Alert tone="success">{resendState.notice}</Alert>}
      {resendState?.devCode && (
        <Alert tone="info">
          رمز التطوير: <span className="num font-bold">{resendState.devCode}</span>
        </Alert>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="code" value={code} />

        <div dir="ltr" className="flex justify-center gap-2">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el
              }}
              value={digit}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
                if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
                if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs.current[i + 1]?.focus()
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={LENGTH}
              aria-label={`الرقم ${i + 1}`}
              className="h-14 w-11 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] text-center text-xl font-bold tabular-nums transition-colors focus:border-[var(--primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)] sm:w-12"
            />
          ))}
        </div>

        <Button type="submit" size="lg" loading={pending} disabled={code.length !== LENGTH}>
          تأكيد
        </Button>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm text-[var(--fg-muted)]">
        <p>ما وصلكش الرمز؟ بصّ في مجلد السبام كمان.</p>
        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="inline-flex items-center gap-2 font-semibold text-[var(--primary)] hover:underline disabled:opacity-60"
        >
          {resending && <Spinner className="h-4 w-4" />}
          ابعت الرمز تاني
        </button>
      </div>
    </div>
  )
}
