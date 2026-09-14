import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { afterVerifyPath } from '@/lib/after-verify'
import { CodeForm } from './code-form'

export const metadata = { title: 'تأكيد البريد' }
export const dynamic = 'force-dynamic'

export default async function VerifyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  /* دعوة فريق مستنية؟ بترجع لها بدل اللوحة */
  if (user.emailVerifiedAt) redirect((await afterVerifyPath()) ?? '/dashboard')

  return <CodeForm email={user.email} />
}
