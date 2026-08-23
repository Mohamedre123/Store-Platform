'use server'

import { z } from 'zod'
import {
  checkResetCode,
  completePasswordReset,
  requestPasswordReset,
} from '@/lib/password-reset'

/**
 * استعادة كلمة السر — تلات أفعال لتلات خطوات.
 *
 * كل خطوة فعل لوحدها عشان الواجهة تقدر تقف عند اللي فشل بدل ما
 * ترجّع التاجر لأول الطريق: رمز غلط ما يصحّش يخلّيه يعيد كتابة
 * بريده، وكلمة سر ضعيفة ما يصحّش تخلّيه يطلب رمزًا جديدًا.
 */

export type ResetState = { ok?: boolean; error?: string; note?: string } | null

const emailSchema = z.string().trim().toLowerCase().email('اكتب بريدًا صحيحًا')

/** نفس الرسالة سواء البريد له حساب أو لأ — التفرقة بتكشف مين مسجّل عندنا */
const SENT_NOTE = 'لو البريد ده عنده حساب، هيوصله رمز خلال دقيقة. بصّ في الوارد والـSpam.'

export async function requestResetAction(rawEmail: string): Promise<ResetState> {
  const parsed = emailSchema.safeParse(rawEmail)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بريد غير صحيح' }

  const res = await requestPasswordReset(parsed.data)

  if (!res.ok) {
    if (res.reason === 'cooldown') {
      return { error: `استنّى ${res.secondsLeft} ثانية قبل ما تطلب رمزًا جديد` }
    }
    return {
      error:
        'خدمة البريد مش مضبوطة على المنصة دلوقتي، فالاستعادة موقوفة. كلّم الدعم عشان يرجّعوا لك حسابك.',
    }
  }

  return {
    ok: true,
    note: res.devCode ? `${SENT_NOTE} (رمز التطوير: ${res.devCode})` : SENT_NOTE,
  }
}

const codeSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{4,8}$/, 'الرمز أرقام بس'),
})

export async function verifyResetCodeAction(input: {
  email: string
  code: string
}): Promise<ResetState> {
  const parsed = codeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'رمز غير صحيح' }

  const res = await checkResetCode(parsed.data.email, parsed.data.code)
  if (res.ok) return { ok: true }

  return { error: reasonText(res.reason) }
}

const finishSchema = codeSchema.extend({
  password: z.string().min(8, 'كلمة السر لازم تكون ٨ حروف على الأقل').max(200),
})

export async function completeResetAction(input: {
  email: string
  code: string
  password: string
}): Promise<ResetState> {
  const parsed = finishSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const res = await completePasswordReset(parsed.data.email, parsed.data.code, parsed.data.password)
  if (res.ok) return { ok: true }

  return { error: reasonText(res.reason) }
}

function reasonText(reason: 'invalid' | 'expired' | 'too_many_attempts'): string {
  if (reason === 'invalid') return 'الرمز غلط. راجعه وجرّب تاني.'
  if (reason === 'too_many_attempts') return 'جرّبت كتير. اطلب رمزًا جديدًا.'
  return 'الرمز انتهت صلاحيته. اطلب رمزًا جديدًا.'
}
