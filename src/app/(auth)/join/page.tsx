import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/permissions'
import { accountExists, findInvite } from '@/lib/team-invites'
import { acceptInviteAction, switchAccountAction } from './actions'
import { JoinSignupForm, SubmitButton } from './join-form'

export const metadata = { title: 'انضمام لفريق' }
export const dynamic = 'force-dynamic'

/**
 * صفحة دعوة الانضمام لفريق متجر — نفس الصفحة على المتصفح والكمبيوتر والتطبيق.
 *
 * ## كانت بتعمل إيه غلط
 * اللي مش داخل بحسابه كان بيتحوّل على «تسجيل الدخول» على طول. الموظف الجديد
 * معندوش حساب ولا كلمة سر، و«افتح متجرك» بتعمل له متجر هو مش عايزه — فكان بيقف.
 *
 * ## دلوقتي
 * الصفحة بتقول مين دعاك ولأي متجر وبأي دور، وبعدها:
 * - مش داخل ومعندوش حساب ← يعمل حساب بالاسم وكلمة السر (البريد بريد الدعوة)
 * - مش داخل وعنده حساب ← «سجّل دخول» وبيرجع هنا
 * - داخل بنفس البريد ← «انضم للفريق»
 * - داخل ببريد تاني ← «سجّل خروج وكمّل»
 *
 * **بريده لازم يكون بريد الدعوة** — ده اللي بيمنع رابط اتسرّب في مجموعة واتساب
 * من إنه يدخّل أي حد لوحة التاجر.
 */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  if (!t) return <Problem title="الرابط ناقص" body="الرابط اللي معاك مش كامل. اطلب من صاحب المتجر يبعتلك واحدًا جديدًا." />

  const invite = await findInvite(t)
  if (!invite) {
    return (
      <Problem
        title="الدعوة مش شغّالة"
        body="الرابط انتهت صلاحيته أو اتلغى أو اتستخدم قبل كده. اطلب من صاحب المتجر يبعتلك واحدًا جديدًا."
      />
    )
  }

  const role = ROLE_LABELS[invite.role] ?? 'موظف'
  const joinPath = `/join?t=${encodeURIComponent(t)}`
  const loginHref = `/login?next=${encodeURIComponent(joinPath)}&email=${encodeURIComponent(invite.email)}`
  const head = <InviteHead storeName={invite.storeName} inviterName={invite.inviterName} role={role} email={invite.email} />
  const user = await getCurrentUser()

  if (user && user.email.toLowerCase() !== invite.email) {
    return (
      <div className="flex flex-col gap-6">
        {head}
        <p className="rounded-lg bg-[var(--color-warning-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--color-warning)]">
          الدعوة دي متبعوتة لـ<bdi dir="ltr">{invite.email}</bdi>، وإنت داخل دلوقتي بـ<bdi dir="ltr">{user.email}</bdi>.
        </p>
        <form action={switchAccountAction}>
          <input type="hidden" name="t" value={t} />
          <SubmitButton>سجّل خروج وكمّل بالبريد الصح</SubmitButton>
        </form>
        <Link href="/dashboard" className="text-center text-sm font-medium text-[var(--primary)] hover:underline">
          لأ، رجّعني للوحة
        </Link>
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex flex-col gap-6">
        {head}
        <form action={acceptInviteAction}>
          <input type="hidden" name="t" value={t} />
          <SubmitButton>انضم لفريق {invite.storeName}</SubmitButton>
        </form>
        <p className="text-center text-xs text-[var(--fg-subtle)]">
          داخل بـ<bdi dir="ltr">{user.email}</bdi>
        </p>
      </div>
    )
  }

  if (await accountExists(invite.email)) {
    return (
      <div className="flex flex-col gap-6">
        {head}
        <p className="text-center text-sm leading-relaxed text-[var(--fg-muted)]">
          عندك حساب على المنصة بالبريد ده. سجّل دخول بكلمة سرّك وهترجع هنا تنضم على طول.
        </p>
        <Link
          href={loginHref}
          className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-base font-semibold text-[var(--primary-fg)]"
        >
          سجّل دخول وانضم
        </Link>
        <Link href="/reset" className="text-center text-sm font-medium text-[var(--primary)] hover:underline">
          نسيت كلمة السر؟
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      {head}
      <JoinSignupForm token={t} email={invite.email} storeName={invite.storeName} />
      <p className="text-center text-sm text-[var(--fg-muted)]">
        عندك حساب بالبريد ده؟{' '}
        <Link href={loginHref} className="font-semibold text-[var(--primary)] hover:underline">
          سجّل دخول
        </Link>
      </p>
    </div>
  )
}

function InviteHead({ storeName, inviterName, role, email }: { storeName: string; inviterName: string | null; role: string; email: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <UserPlus className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">اتدعيت لفريق {storeName}</h1>
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
        {inviterName ? `${inviterName} دعاك` : 'صاحب المتجر دعاك'} تنضم لفريق المتجر كـ<strong className="text-[var(--fg)]">{role}</strong>،
        وهتدخل لوحة المتجر بالصلاحيات اللي اختارها لك.
      </p>
      <span dir="ltr" className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--fg-muted)]">
        {email}
      </span>
    </div>
  )
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <UserPlus className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{body}</p>
      <Link
        href="/dashboard"
        className="inline-flex h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
      >
        روح للوحة
      </Link>
    </div>
  )
}
