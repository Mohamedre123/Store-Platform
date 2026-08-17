import { ShoppingBag } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "الطلبات" }

export default function Page() {
  return (
    <ComingSoon
      icon={ShoppingBag}
      title={"الطلبات"}
      description={"متابعة طلبات متجرك من أول ما تيجي لحد ما توصل"}
      features={[
        "قائمة الطلبات بفلاتر الحالة والتاريخ، وبحث بالرقم أو الاسم أو التليفون",
        "الطلبات غير المكتملة — اللي العميل كتب رقمه وما كمّلش",
        "تفاصيل الطلب: البنود والعميل والعنوان والمسار الزمني",
        "تغيير الحالة، إنشاء شحنة، وطباعة الفاتورة",
        "إنشاء طلب يدوي للطلبات اللي بتيجي على واتساب",
      ]}
    />
  )
}
