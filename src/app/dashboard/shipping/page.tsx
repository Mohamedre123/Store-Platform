import { Truck } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "الشحن" }

export default function Page() {
  return (
    <ComingSoon
      icon={Truck}
      title={"الشحن"}
      description={"مناطق التوصيل وأسعارها"}
      features={[
        "سعر شحن لكل محافظة",
        "شحن مجاني فوق مبلغ تحدده",
        "ربط شركات الشحن وإنشاء البوالص تلقائيًا",
        "تتبّع الشحنات وتسوية الدفع عند الاستلام",
      ]}
    />
  )
}
