'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction, type FormState } from '../actions'
import { Alert, Button, Field, Input } from '@/components/ui'

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null)

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">أهلًا بيك تاني</h1>
        <p className="text-sm text-[var(--fg-muted)]">سجّل دخول عشان تدير متجرك.</p>
      </div>

      {state?.error && <Alert>{state.error}</Alert>}

      <form action={formAction} className="flex flex-col gap-5" noValidate>
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

        {/*
          «نسيت كلمة السر؟» جنب الحقل نفسه لا تحت الفورم.
          اللي بينسى بيلاقيها وهو بيبص على الخانة اللي وقّفته — مش
          بعد ما يجرّب كلمة سر غلط ويستنّى الخطأ.
        */}
        <Field
          label="كلمة المرور"
          required
          htmlFor="password"
          error={state?.fieldErrors?.password}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <div className="-mt-2 text-start">
          <Link
            href="/reset"
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            نسيت كلمة السر؟
          </Link>
        </div>

        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          دخول
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--fg-muted)]">
        لسه ماعندكش متجر؟{' '}
        <Link href="/signup" className="font-semibold text-[var(--primary)] hover:underline">
          افتح متجرك
        </Link>
      </p>
    </div>
  )
}
