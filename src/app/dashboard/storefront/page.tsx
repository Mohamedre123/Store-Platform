import { Store } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "المتجر" }

export default function Page() {
  return (
    <ComingSoon
      icon={Store}
      title={"المتجر"}
      description={"شكل متجرك وصفحاته"}
      features={[
        "محرر الثيم بمعاينة حيّة",
        "أقسام الصفحة الرئيسية بترتيب تسحبه بنفسك",
        "الشعار والألوان والخطوط",
        "الصفحات الثابتة والمدوّنة وصفحات البيع",
      ]}
    />
  )
}
