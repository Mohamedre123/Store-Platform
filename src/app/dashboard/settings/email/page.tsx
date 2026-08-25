import { PageHeader } from '@/components/dashboard/page-shell'
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
