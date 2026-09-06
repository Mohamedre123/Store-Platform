'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound, User } from 'lucide-react'
import { changePasswordAction, saveProfileAction } from './actions'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'

/**
 * بيانات الحساب وكلمة السر — فورمين منفصلين.
 *
 * الدمج كان هيخلّي التاجر اللي بيصلّح اسمه يلاقي خانتين كلمة سر
 * فاضيتين قدامه، واللي بيغيّر كلمة سرّه يبعت اسمه معاها من غير
 * سبب. كل فورم بيحفظ حاجته وحدها.
 */
export function AccountForms({
  name,
  email,
  phone,
  publicId,
}: {
  name: string
  email: string
  phone: string
  publicId: string | null
}) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileForm name={name} email={email} phone={phone} publicId={publicId} />
      <PasswordForm />
    </div>
  )
}

function ProfileForm({
  name,
  email,
  phone,
  publicId,
}: {
  name: string
  email: string
  phone: string
  publicId: string | null
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <User className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
        بياناتك
      </h2>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const fd = new FormData(e.currentTarget)
          start(async () => {
            const res = await saveProfileAction({ name: fd.get('name'), phone: fd.get('phone') })
            if (res?.error) setError(res.error)
            else toast('بياناتك اتحفظت')
          })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسمك" required htmlFor="ac-name">
            <Input id="ac-name" name="name" defaultValue={name} required maxLength={80} />
          </Field>

          <Field label="موبايلك" htmlFor="ac-phone" hint="بنستعمله لو احتجنا نوصلك">
            <Input id="ac-phone" name="phone" type="tel" dir="ltr" defaultValue={phone} maxLength={24} />
          </Field>
        </div>

        {/*
          البريد بيتعرض ولا بيتغيّر من هنا.

          تغييره معناه إعادة توثيق ونقل ملكية حساب — ولو خلّيناه
          خانة عادية، غلطة كتابة واحدة بتقفل الحساب على صاحبه.
        */}
        <Field label="البريد" hint="مربوط بحسابك — كلّم الدعم لو محتاج تغيّره">
          <Input value={email} dir="ltr" disabled readOnly />
        </Field>

        {publicId && (
          <Field label="معرّف حسابك" hint="ابعته للدعم بدل ما تشرح — بيه بنلاقي حسابك على طول">
            <div className="flex gap-2">
              <Input value={publicId} dir="ltr" readOnly className="font-mono" />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(publicId).then(
                    () => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    },
                    () => toast('المتصفح رفض النسخ', 'error'),
                  )
                }}
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                انسخ
              </Button>
            </div>
          </Field>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" loading={pending} className="self-start">
          احفظ
        </Button>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
        كلمة السر
      </h2>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          setDone(false)
          const form = e.currentTarget
          const fd = new FormData(form)

          if (fd.get('next') !== fd.get('confirm')) {
            setError('الكلمتين الجديدتين مش زي بعض')
            return
          }

          start(async () => {
            const res = await changePasswordAction({ current: fd.get('current'), next: fd.get('next') })
            if (res?.error) setError(res.error)
            else {
              setDone(true)
              form.reset()
              toast('كلمة السر اتغيّرت')
            }
          })
        }}
      >
        <Field label="كلمة السر الحالية" required htmlFor="ac-cur">
          <Input id="ac-cur" name="current" type="password" autoComplete="current-password" required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="كلمة السر الجديدة" required htmlFor="ac-new" hint="٨ حروف على الأقل">
            <Input
              id="ac-new"
              name="next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>

          <Field label="اكتبها تاني" required htmlFor="ac-conf">
            <Input
              id="ac-conf"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
        {done && <Alert tone="success">اتغيّرت. أجهزتك التانية لسه مفتوحة — اقفلها من صفحة الأجهزة لو محتاج.</Alert>}

        <Button type="submit" loading={pending} className="self-start">
          غيّر كلمة السر
        </Button>
      </form>
    </Card>
  )
}
