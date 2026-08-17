import { BarChart3 } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "التحليلات" }

export default function Page() {
  return (
    <ComingSoon
      icon={BarChart3}
      title={"التحليلات"}
      description={"أرقام متجرك وربحك الحقيقي"}
      features={[
        "المبيعات والزيارات ومعدل التحويل",
        "الربح بعد التكلفة والشحن والمرتجع والخصومات",
        "أفضل المنتجات وأكثرها ربحًا",
        "مصادر الزيارات وأداء الحملات",
      ]}
    />
  )
}
