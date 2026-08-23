import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ResetForm } from './reset-form'

export const metadata = { title: 'استعادة كلمة السر' }

export default async function ResetPage() {
  // اللي داخل أصلًا مش محتاج يستعيد — تغيير كلمة السر من الإعدادات
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return <ResetForm />
}
