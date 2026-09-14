'use server'

import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { createSession, destroySession, getCurrentUser, hashPassword } from '@/lib/auth'
import { issueEmailOtp } from '@/lib/otp'
import { uniqueAccountId } from '@/lib/account-id'
import { isAdminEmail } from '@/lib/admin'
import { acceptInvite, findInvite } from '@/lib/team-invites'
import { clearAfterVerify, rememberAfterVerify } from '@/lib/after-verify'

export type JoinState = { error?: string; fieldErrors?: Record<string, string> } | null

const ACTIVE_STORE_COOKIE = 'zawya_store'

const tokenFrom = (formData: FormData) => String(formData.get('t') ?? '').slice(0, 200)
const joinPath = (token: string) => `/join?t=${encodeURIComponent(token)}`

const signupSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسمك').max(80),
  password: z.string().min(8, 'كلمة المرور لازم تكون 8 حروف على الأقل').max(200),
})

/**
 * حساب جديد من دعوة فريق — من غير متجر.
 *
 * كان الموظف اللي معندوش حساب بيتحوّل على «تسجيل الدخول» ومعندوش كلمة سر أصلًا،
 * و«افتح متجرك» بتعمل له متجر هو مش عايزه. هنا بيكتب اسمه وكلمة سرّه بس، والبريد
 * هو بريد الدعوة. البريد لسه لازم يتأكّد بالرمز (الرابط ممكن يكون اتبعت على واتساب
 * لحد تاني) — وبعد التأكيد بيرجع للدعوة يكمّل الانضمام.
 */
export async function joinSignupAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = tokenFrom(formData)
  const invite = await findInvite(token)
  if (!invite) return { error: 'الدعوة انتهت أو اتلغت — اطلب من صاحب المتجر يبعتلك واحدة جديدة.' }

  const parsed = signupSchema.safeParse({ name: formData.get('name'), password: formData.get('password') })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message
    return { fieldErrors }
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${invite.email}`)
    .limit(1)
  if (existing) return { error: 'البريد ده عنده حساب بالفعل — سجّل دخول بكلمة سرّك وهتنضم على طول.' }

  const publicId = await uniqueAccountId()
  const [user] = await db
    .insert(users)
    .values({
      email: invite.email,
      passwordHash: await hashPassword(parsed.data.password),
      name: parsed.data.name,
      publicId,
      isPlatformAdmin: isAdminEmail(invite.email),
    })
    .returning({ id: users.id })

  const h = await headers()
  await createSession(user.id, {
    userAgent: h.get('user-agent') ?? undefined,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  })

  await rememberAfterVerify(joinPath(token))
  const otp = await issueEmailOtp(user.id, invite.email, parsed.data.name)
  if (otp.ok && otp.autoVerified) redirect(joinPath(token))
  redirect('/verify')
}

/**
 * «انضم للفريق» — بدوسة، مش لحظة فتح الرابط.
 *
 * واتساب وأي تطبيق بيعرض معاينة للرابط بيفتحه لوحده؛ الانضمام وقت فتح الصفحة كان
 * ممكن يستهلك الدعوة من غير ما الموظف يشوفها. وكمان الصفحات ما بتكتبش كوكيز —
 * واختيار المتجر اللي انضم له محتاج كوكي.
 */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = tokenFrom(formData)
  const user = await getCurrentUser()
  if (!user) redirect(joinPath(token))

  const invite = await findInvite(token)
  if (!invite || invite.email !== user.email.toLowerCase()) redirect(joinPath(token))

  if (!user.emailVerifiedAt) {
    await rememberAfterVerify(joinPath(token))
    const otp = await issueEmailOtp(user.id, user.email, user.name)
    if (!(otp.ok && otp.autoVerified)) redirect('/verify')
  }

  await acceptInvite(invite, user.id)

  /* بيفتح على المتجر اللي انضم له لا على أول متجر في قايمته */
  const jar = await cookies()
  jar.set(ACTIVE_STORE_COOKIE, invite.storeId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  await clearAfterVerify()

  redirect('/dashboard')
}

/** داخل بحساب تاني غير بريد الدعوة — بيخرج ويرجع لنفس الدعوة يختار يدخل أو يعمل حساب */
export async function switchAccountAction(formData: FormData): Promise<void> {
  const token = tokenFrom(formData)
  await destroySession()
  redirect(joinPath(token))
}
