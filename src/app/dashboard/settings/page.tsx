import { Settings } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "الإعدادات" }

export default function Page() {
  return (
    <ComingSoon
      icon={Settings}
      title={"الإعدادات"}
      description={"بيانات متجرك وتفضيلاته"}
      features={[
        "معلومات المتجر والعملة والدولة",
        "النطاق المخصص",
        "الشيك أوت والحقول المطلوبة",
        "الإشعارات والفريق والصلاحيات",
      ]}
    />
  )
}
