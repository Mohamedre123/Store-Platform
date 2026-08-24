'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, Loader2, Mail, MessageCircle } from 'lucide-react'
import { useStoreHref } from '@/components/storefront/store-link'
import {
  loginWithPasswordAction,
  sendCodeAction,
  startLoginAction,
  verifyCodeAction,
} from './auth-actions'

type Step = 'identify' | 'code' | 'password'

/**
 * دخول العميل.
 *
 * **خانة واحدة للرقم والبريد.** الخانتين بتفرضوا على العميل اختيارًا
 * قبل ما يعرف يعني إيه، والاختيار عند أول احتكاك أغلى خطوة في
 * المتجر. الخادم بيقرا اللي كتبه ويعرف ده رقم ولا بريد.
 *
 * والرمز بيروح على **نفس الوسيلة**: اللي كتب رقمه بيستنّاه على
 * واتساب، واللي كتب بريده في بريده. الرمز اللي بيروح مكان تاني
 * بيخلّي العميل يقعد يستنّى حاجة عمرها ما هتيجي.
 */
export function CustomerLoginForm({
  storeIdentifier,
  /** بعد الدخول: يرجع للشيك أوت لو كان بيطلب */
  redirectTo,
  compact,
}: {
  storeIdentifier: string
  redirectTo?: string
  compact?: boolean
}) {
  const router = useRouter()
  /*
    الروابط جوّه المتجر محتاجة بادئة المسار.

    المتجر ممكن يتفتح على نطاق فرعي (`متجري.zawyaeg.site/checkout`)
    أو بالمسار (`zawyaeg.site/s/متجري/checkout`). التحويل لـ`/checkout`
    وحده كان بيطلّع العميل برّه متجره في الحالة التانية.
  */
  const href = useStoreHref()
  const [step, setStep] = useState<Step>('identify')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('email')
  const [masked, setMasked] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const done = () => {
    /*
      من غير وجهة، بنكتفي بإعادة التحميل: الصفحة نفسها هي اللي
      بتعرض النموذج، فأول ما الجلسة تتفتح بتعرض المحتوى.
      `router.replace('')` مكانش بيعمل حاجة خالص.
    */
    if (redirectTo) router.replace(href(redirectTo))
    router.refresh()
  }

  const apply = (res: Awaited<ReturnType<typeof startLoginAction>>) => {
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (res.step === 'done') {
      done()
      return
    }
    if (res.step === 'password') {
      setMasked(res.masked)
      setStep('password')
      return
    }
    setChannel(res.channel)
    setMasked(res.masked)
    setNote(res.note ?? null)
    setStep('code')
  }

  const identify = () =>
    start(async () => {
      setError(null)
      apply(await startLoginAction({ storeIdentifier, identifier }))
    })

  const sendCode = () =>
    start(async () => {
      setError(null)
      apply(await sendCodeAction({ storeIdentifier, identifier }))
    })

  const verify = () =>
    start(async () => {
      setError(null)
      apply(await verifyCodeAction({ storeIdentifier, identifier, code, name: name || undefined }))
    })

  const withPassword = () =>
    start(async () => {
      setError(null)
      apply(await loginWithPasswordAction({ storeIdentifier, identifier, password }))
    })

  const input =
    'h-12 w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-base outline-none transition-colors focus:border-[var(--sf-primary)]'
  const button =
    'flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60'

  const ChannelIcon = channel === 'email' ? Mail : MessageCircle

  return (
    <div className={compact ? 'flex flex-col gap-4' : 'mx-auto flex w-full max-w-sm flex-col gap-5'}>
      {!compact && (
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {step === 'identify' ? 'دخول أو إنشاء حساب' : 'أكّد إنه إنت'}
          </h1>
          <p className="text-sm opacity-65">
            {step === 'identify'
              ? 'برقمك أو بريدك — واحد منهم كفاية.'
              : step === 'password'
                ? 'اكتب كلمة السر، أو ادخل برمز.'
                : 'بعتنالك رمزًا دلوقتي.'}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-[var(--sf-radius)] bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {step === 'identify' && (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            identify()
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">رقم التليفون أو البريد</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              dir="ltr"
              inputMode="email"
              autoComplete="username"
              placeholder="01012345678  أو  you@example.com"
              className={`${input} text-start`}
            />
          </label>

          <button type="submit" disabled={pending || identifier.trim().length < 5} className={button}>
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            كمّل
          </button>
        </form>
      )}

      {step === 'password' && (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            withPassword()
          }}
        >
          <p className="text-sm opacity-65">
            <bdi dir="ltr" className="font-medium">
              {masked}
            </bdi>
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">كلمة السر</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className={input}
            />
          </label>

          <button type="submit" disabled={pending || password.length < 4} className={button}>
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            دخول
          </button>

          {/*
            «نسيت كلمة السر» بترجّعه للرمز لا لصفحة تانية.
            الرمز بيوصل على نفس الوسيلة اللي كتبها، فهو أصلًا إثبات
            ملكية — ومفيش لزوم لمسار استعادة منفصل للعميل.
          */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('identify')
                setError(null)
              }}
              className="inline-flex items-center gap-1 opacity-65 hover:opacity-100"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              غيّر البيانات
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={pending}
              className="font-medium text-[var(--sf-primary)] hover:underline disabled:opacity-50"
            >
              نسيت كلمة السر — ابعتلي رمز
            </button>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
        >
          <p className="flex items-center gap-1.5 text-sm opacity-70">
            <ChannelIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              الرمز راح على{' '}
              <bdi dir="ltr" className="font-medium">
                {masked}
              </bdi>
            </span>
          </p>

          {note && (
            <p className="rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/8 px-3 py-2 text-xs">
              {note}
            </p>
          )}

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            placeholder="- - - - - -"
            aria-label="رمز التأكيد"
            className={`${input} text-center text-lg tracking-[0.4em]`}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">اسمك (اختياري)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="عشان نعرف نناديك"
              className={input}
            />
          </label>

          <button type="submit" disabled={pending || code.length < 4} className={button}>
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            تأكيد ودخول
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('identify')
                setError(null)
              }}
              className="inline-flex items-center gap-1 opacity-65 hover:opacity-100"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              غيّر البيانات
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={pending}
              className="font-medium text-[var(--sf-primary)] hover:underline disabled:opacity-50"
            >
              ابعت الرمز تاني
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
