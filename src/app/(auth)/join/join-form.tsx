'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { joinSignupAction, type JoinState } from './actions'
import { Alert, Button, Field, Input } from '@/components/ui'

/** حساب جديد من الدعوة: الاسم وكلمة السر — البريد هو بريد الدعوة */
export function JoinSignupForm({ token, email, storeName }: { token: string; email: string; storeName: string }) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(joinSignupAction, null)

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="t" value={token} />
      {state?.error && <Alert>{state.error}</Alert>}

      <Field label="البريد الإلكتروني" htmlFor="join-email" hint="الدعوة مربوطة بالبريد ده، وهتدخل بيه بعد كده.">
        <Input id="join-email" value={email} readOnly autoComplete="username" dir="ltr" className="text-start opacity-80" />
      </Field>

      <Field label="اسمك" required htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required placeholder="محمد أحمد" />
      </Field>

      <Field label="اختار كلمة مرور" required htmlFor="password" hint="8 حروف على الأقل" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>

      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        اعمل حسابك وانضم لـ{storeName}
      </Button>
    </form>
  )
}

/** زرار نموذج بفعل خادم — بيبان بيحمّل لحد ما التحويل يحصل */
export function SubmitButton({ children, variant }: { children: React.ReactNode; variant?: 'secondary' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" variant={variant} loading={pending} className="w-full">
      {children}
    </Button>
  )
}
