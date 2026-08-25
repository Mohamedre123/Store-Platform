import { PageHeader } from '@/components/dashboard/page-shell'
import { after } from 'next/server'
import { autoVerifyEmailDomain } from '@/lib/store-email-domain'
import { getDashboardContext } from '@/lib/store-context'
import { emailDiagnosticsAction } from './actions'
import { EmailPanel } from './email-panel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بريد المتجر' }

/**
 * صفحة بريد المتجر.
 *
 * **«الرسايل بتروح السبام» أصعب شكوى تتشخّص** — لأن كل حاجة فيها
 * مخفية: الترويسة اللي بتخرج، سجلات النطاق، ونتيجة الفلتر. التاجر
 * بيغيّر إعدادات على أمل إن حاجة تتحسّن، ومحدّش شايف حاجة.
 *
 * الصفحة دي بتوري اللي بيحصل فعلًا وبتخلّي التاجر يجرّب بنفسه.
 */
export default async function EmailSettingsPage() {
  const { store } = await getDashboardContext()

  /*
    التحقق بيحصل لوحده في الخلفية: التاجر ضاف السجلات خلاص، وإحنا
    اللي المفروض نشوف امتى انتشرت — مش هو اللي يقعد يدوس «تحقّق».
  */
  after(autoVerifyEmailDomain(store.id))

  const diagnostics = await emailDiagnosticsAction()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="بريد المتجر"
        description="من فين بتخرج رسايلك، وإزاي تخلّيها توصل الوارد مش السبام."
      />
      <EmailPanel initial={diagnostics} />
    </div>
  )
}
