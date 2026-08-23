'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { completeResetAction, requestResetAction, verifyResetCodeAction } from './actions'

type Step = 'email' | 'code' | 'password' | 'done'

/**
 * استعادة كلمة السر على تلات خطوات في صفحة واحدة.
 *
 * صفحة لكل خطوة كانت هتحتاج تمرير البريد والرمز في الرابط — والرمز
 * في الرابط بيتسجّل في تاريخ المتصفح وفي سجلات أي وكيل في النص.
 * الحالة هنا في الذاكرة، وبتموت مع الصفحة.
 *
 * والرجوع للخطوة اللي فاتت متاح: اللي كتب بريده غلط لازم يقدر
 * يصلّحه من غير ما يبدأ من الأول.
 */
export function ResetForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const sendCode = () =>
    start(async () => {
      setError(null)
      setNote(null)
      const res = await requestResetAction(email)
      if (res?.error) {
        setError(res.error)
        return
      }
      setNote(res?.note ?? null)
      setStep('code')
    })

  const checkCode = () =>
    start(async () => {
      setError(null)
      const res = await verifyResetCodeAction({ email, code })
      if (res?.error) {
        setError(res.error)
        return
      }
      setNote(null)
      setStep('password')
    })

  const finish = () =>
    start(async () => {
      setError(null)
      if (password !== confirm) {
        setError('كلمتا السر مش متطابقتين')
        return
      }
      const res = await completeResetAction({ email, code, password })
      if (res?.error) {
        setError(res.error)
        return
      }
      setStep('done')
    })

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-soft)]">
          <CheckCircle2 className="h-7 w-7 text-[var(--color-success)]" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">كلمة السر اتغيّرت</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            قفلنا كل الجلسات المفتوحة على حسابك — لو كان حد داخل عليه، خرج دلوقتي.
            سجّل دخول بكلمة السر الجديدة.
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={() => router.push('/login')}>
          روح لتسجيل الدخول
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">نسيت كلمة السر؟</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          {step === 'email' && 'اكتب بريدك وهنبعتلك رمزًا تغيّر بيه كلمة السر.'}
          {step === 'code' && (
            <>
              اكتب الرمز اللي وصل على{' '}
              <bdi dir="ltr" className="font-medium">
                {email}
              </bdi>
            </>
          )}
          {step === 'password' && 'اختار كلمة سر جديدة لحسابك.'}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {note && step === 'code' && <Alert tone="info">{note}</Alert>}

      {step === 'email' && (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            sendCode()
          }}
        >
          <Field label="البريد الإلكتروني" required htmlFor="email">
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              className="text-start"
              required
              placeholder="you@example.com"
            />
          </Field>

          <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
            ابعت الرمز
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            checkCode()
          }}
        >
          <Field label="رمز الاستعادة" required htmlFor="code">
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              required
              placeholder="- - - - - -"
              className="text-center text-lg tracking-[0.4em]"
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            loading={pending}
            className="mt-1 w-full"
            disabled={code.length < 4}
          >
            تأكيد الرمز
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setError(null)
                setNote(null)
              }}
              className="inline-flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              غيّر البريد
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={pending}
              className="font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              ابعت الرمز تاني
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            finish()
          }}
        >
          <Field
            label="كلمة السر الجديدة"
            required
            htmlFor="password"
            hint="٨ حروف على الأقل. اختار حاجة مش بتستخدمها في مكان تاني."
          >
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field label="أكّد كلمة السر" required htmlFor="confirm">
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            loading={pending}
            className="mt-1 w-full"
            disabled={password.length < 8}
          >
            غيّر كلمة السر
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-[var(--fg-muted)]">
        فكرتها؟{' '}
        <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
          ارجع لتسجيل الدخول
        </Link>
      </p>
    </div>
  )
}
