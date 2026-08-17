'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, X } from 'lucide-react'
import { signupAction, type FormState } from '../actions'
import { Alert, Button, Field, Input } from '@/components/ui'
import { ROOT_DOMAIN } from '@/lib/domain'
import { suggestStoreSlug } from '@/lib/utils'

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signupAction, null)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [status, setStatus] = useState<SlugStatus>('idle')

  /** فحص التوفّر بعد ما التاجر يبطّل كتابة — لا نرهق الخادم بكل ضغطة */
  useEffect(() => {
    if (!slug) {
      setStatus('idle')
      return
    }
    setStatus('checking')
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stores/check-slug?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })
        const data: { available: boolean; reason: string | null } = await res.json()
        setStatus(data.available ? 'available' : data.reason === 'taken' ? 'taken' : 'invalid')
      } catch {
        // إلغاء الطلب عند الكتابة من جديد ليس خطأً
      }
    }, 450)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [slug])

  const slugMessage: Record<SlugStatus, string> = {
    idle: 'حروف إنجليزية صغيرة وأرقام وشرطات. تقدر تربط دومينك الخاص بعدين.',
    checking: 'بنشوف الرابط متاح ولا لأ…',
    available: 'الرابط ده متاح ✓',
    taken: 'الرابط ده محجوز — جرّب واحد تاني',
    invalid: 'الرابط لازم يكون 3 حروف على الأقل، إنجليزية صغيرة وأرقام وشرطات',
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">افتح متجرك</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          دقيقة واحدة ويكون عندك متجر شغّال. من غير بطاقة ائتمان.
        </p>
      </div>

      {state?.error && <Alert>{state.error}</Alert>}

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <Field label="اسمك" required htmlFor="name" error={state?.fieldErrors?.name}>
          <Input id="name" name="name" autoComplete="name" required placeholder="محمد أحمد" />
        </Field>

        <Field label="البريد الإلكتروني" required htmlFor="email" error={state?.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            className="text-start"
            required
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="كلمة المرور"
          required
          htmlFor="password"
          hint="8 حروف على الأقل"
          error={state?.fieldErrors?.password}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>

        <hr className="border-[var(--border)]" />

        <Field label="اسم المتجر" required htmlFor="storeName" error={state?.fieldErrors?.storeName}>
          <Input
            id="storeName"
            name="storeName"
            required
            placeholder="متجر الأناقة"
            onChange={(e) => {
              // الاسم بالعربي يتحوّل تلقائيًا لرابط لاتيني مقروء
              if (!slugTouched) setSlug(suggestStoreSlug(e.target.value))
            }}
          />
        </Field>

        <Field
          label="رابط المتجر"
          required
          htmlFor="storeSlug"
          hint={state?.fieldErrors?.storeSlug ? undefined : slugMessage[status]}
          error={state?.fieldErrors?.storeSlug}
        >
          <div
            className={`flex items-stretch overflow-hidden rounded-lg border bg-[var(--surface)] transition-colors ${
              status === 'available'
                ? 'border-[var(--color-success)]'
                : status === 'taken' || status === 'invalid'
                  ? 'border-[var(--color-danger)]'
                  : 'border-[var(--border-strong)] focus-within:border-[var(--primary)]'
            }`}
          >
            <span className="flex shrink-0 items-center ps-3" aria-hidden="true">
              {status === 'checking' && (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-subtle)]" />
              )}
              {status === 'available' && <Check className="h-4 w-4 text-[var(--color-success)]" />}
              {(status === 'taken' || status === 'invalid') && (
                <X className="h-4 w-4 text-[var(--color-danger)]" />
              )}
            </span>
            <Input
              id="storeSlug"
              name="storeSlug"
              dir="ltr"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }}
              placeholder="my-store"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="slug-status"
              className="rounded-none border-0 text-start focus-visible:outline-none"
            />
            <span
              dir="ltr"
              className="flex shrink-0 items-center border-s border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--fg-subtle)]"
            >
              .{ROOT_DOMAIN}
            </span>
          </div>
          <span id="slug-status" className="sr-only" aria-live="polite">
            {slugMessage[status]}
          </span>
        </Field>

        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={status === 'taken' || status === 'invalid'}
          className="mt-1 w-full"
        >
          إنشاء المتجر
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--fg-muted)]">
        عندك حساب؟{' '}
        <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
          سجّل دخول
        </Link>
      </p>
    </div>
  )
}
