'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { issueEmailOtp, verifyEmailOtp } from '@/lib/otp'

export type VerifyState = { error?: string; notice?: string; devCode?: string } | null

function emailSendErrorMessage(error: string): string {
  if (error === 'not_configured') {
    return 'خدمة البريد غير مضبوطة حاليًا. راجع إعدادات البريد ثم اطلب رمزًا جديدًا.'
  }
  if (error === 'provider_401' || error === 'provider_403') {
    return 'مفتاح خدمة البريد غير صالح أو لا يملك صلاحية الإرسال. راجع BREVO_API_KEY.'
  }
  if (error === 'provider_400' || error === 'provider_422') {
    return 'خدمة البريد رفضت عنوان المرسل. تأكد أن info@zawyaeg.site موثّق في Brevo وأن EMAIL_FROM مطابق له.'
  }
  if (error === 'provider_429') {
    return 'تم الوصول لحد الإرسال المؤقت لخدمة البريد. جرّب بعد قليل.'
  }
  return 'تعذّر إرسال الرمز الآن. جرّب مرة أخرى بعد قليل.'
}

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
    return { error: emailSendErrorMessage(result.sendError) }
  }

  if (result.autoVerified) redirect('/dashboard')

  return { notice: 'بعتنا رمز جديد على بريدك.', devCode: result.devCode }
}
