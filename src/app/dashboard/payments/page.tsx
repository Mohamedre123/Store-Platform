import { CreditCard } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "الدفع" }

export default function Page() {
  return (
    <ComingSoon
      icon={CreditCard}
      title={"الدفع"}
      description={"طرق الدفع في متجرك"}
      features={[
        "الدفع عند الاستلام برسوم أو خصم",
        "بوابات الدفع الإلكتروني",
        "التحويل البنكي والمحافظ",
        "التقسيط والشراء الآجل",
      ]}
    />
  )
}
