import { Megaphone } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "التسويق" }

export default function Page() {
  return (
    <ComingSoon
      icon={Megaphone}
      title={"التسويق"}
      description={"كوبونات وعروض وأدوات نمو"}
      features={[
        "كوبونات بشروط: حد أدنى، أول طلب، منتجات محددة",
        "عروض الكمية والباقات",
        "برنامج الإحالة والمسوّقين بالعمولة",
        "اختبار A/B على الأسعار والصور",
      ]}
    />
  )
}
