import { Users } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "العملاء" }

export default function Page() {
  return (
    <ComingSoon
      icon={Users}
      title={"العملاء"}
      description={"قاعدة عملائك وسجل شرائهم"}
      features={[
        "ملف كل عميل: طلباته وإجمالي إنفاقه وعناوينه",
        "مستويات الولاء والنقاط",
        "وسوم وملاحظات لتقسيم العملاء",
        "تصدير ملف CSV",
      ]}
    />
  )
}
