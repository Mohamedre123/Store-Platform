import { Crown } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "الاشتراك" }

export default function Page() {
  return (
    <ComingSoon
      icon={Crown}
      title={"الاشتراك"}
      description={"خطتك وفواتيرك"}
      features={[
        "حالة الاشتراك وتاريخ التجديد",
        "الفواتير السابقة",
        "تغيير الخطة",
      ]}
    />
  )
}
