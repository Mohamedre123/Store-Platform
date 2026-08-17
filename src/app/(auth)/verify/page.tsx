import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { CodeForm } from './code-form'

export const metadata = { title: 'تأكيد البريد' }
export const dynamic = 'force-dynamic'

export default async function VerifyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.emailVerifiedAt) redirect('/dashboard')

  return <CodeForm email={user.email} />
}
