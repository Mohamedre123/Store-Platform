'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { issueEmailOtp, verifyEmailOtp } from '@/lib/otp'

export type VerifyState = { error?: string; notice?: string; devCode?: string } | null

export async function verifyCodeAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.emailVerifiedAt) redirect('/dashboard')

  const code = String(formData.get('code') ?? '').replace(/[^\d]/g, '')
  if (code.length !== 6) return { error: 'اكتب الرمز المكوّن من ٦ أرقام' }

  const result = await verifyEmailOtp(user.email, code)

  if (!result.ok) {
    const messages = {
      invalid: 'الرمز غلط. راجعه وجرّب تاني.',
      expired: 'الرمز انتهت صلاحيته. اطلب رمز جديد.',
      too_many_attempts: 'حاولت كتير. اطلب رمز جديد.',
    }
    return { error: messages[result.reason] }
  }

  redirect('/dashboard')
}

export async function resendCodeAction(): Promise<VerifyState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.emailVerifiedAt) redirect('/dashboard')

  const result = await issueEmailOtp(user.id, user.email, user.name)

  if (!result.ok) {
    if (result.reason === 'cooldown') {
      return { error: `استنى ${result.secondsLeft} ثانية قبل ما تطلب رمز جديد.` }
    }
    return { error: 'مقدرناش نبعت الرمز دلوقتي. جرّب كمان شوية.' }
  }

  if (result.autoVerified) redirect('/dashboard')

  return { notice: 'بعتنا رمز جديد على بريدك.', devCode: result.devCode }
}
