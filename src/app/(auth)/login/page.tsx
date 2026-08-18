import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata = { title: 'تسجيل الدخول' }

export default async function LoginPage() {
  // لو مسجّل دخول أصلًا، وديه للوحة على طول بدل ما يعيد الدخول.
  // الجلسة على كوكي، فالزيارة التانية للموقع مش محتاجة تسجيل تاني.
  const user = await getCurrentUser()
  if (user) redirect(user.emailVerifiedAt ? '/dashboard' : '/verify')

  return <LoginForm />
}
