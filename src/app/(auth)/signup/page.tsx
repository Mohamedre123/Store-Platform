'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { signupAction, type FormState } from '../actions'
import { Alert, Button, Field, Input } from '@/components/ui'
import { ROOT_DOMAIN } from '@/lib/domain'
import { slugify } from '@/lib/utils'

/** يحوّل اسم المتجر العربي إلى اقتراح رابط لاتيني صالح */
function suggestSlug(name: string) {
  const s = slugify(name).replace(/[^a-z0-9-]/g, '')
  return s.length >= 3 ? s : ''
}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signupAction, null)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

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
              if (!slugTouched) setSlug(suggestSlug(e.target.value))
            }}
          />
        </Field>

        <Field
          label="رابط المتجر"
          required
          htmlFor="storeSlug"
          hint="حروف إنجليزية صغيرة وأرقام وشرطات. تقدر تربط دومينك الخاص بعدين."
          error={state?.fieldErrors?.storeSlug}
        >
          <div className="flex items-stretch overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] focus-within:border-[var(--primary)]">
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
              className="rounded-none border-0 text-start focus-visible:outline-none"
            />
            <span
              dir="ltr"
              className="flex shrink-0 items-center border-s border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--fg-subtle)]"
            >
              .{ROOT_DOMAIN}
            </span>
          </div>
        </Field>

        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
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
