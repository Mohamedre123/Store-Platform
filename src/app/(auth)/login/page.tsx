import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata = { title: 'تسجيل الدخول' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  // لو مسجّل دخول أصلًا، وديه للوحة على طول بدل ما يعيد الدخول.
  // الجلسة على كوكي، فالزيارة التانية للموقع مش محتاجة تسجيل تاني.
  const user = await getCurrentUser()
  if (user) {
    if (!user.emailVerifiedAt) redirect('/verify')
    /*
      الوجهة المطلوبة بتغلب اللوحة — اللي فتح دعوة انضمام وهو مسجّل
      أصلًا لازم يكمّل انضمامه لا يتحوّل للوحة ويسيب الرابط وراه.
    */
    redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
  }

  return <LoginForm next={next ?? null} />
}
