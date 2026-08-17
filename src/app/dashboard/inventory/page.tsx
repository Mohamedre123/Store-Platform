import { Boxes } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "المخزون" }

export default function Page() {
  return (
    <ComingSoon
      icon={Boxes}
      title={"المخزون"}
      description={"كميات منتجاتك وحركتها"}
      features={[
        "المخزون الحالي لكل منتج ومتغيّر",
        "تنبيه المخزون المنخفض",
        "سجل الحركة: إيه اللي نقص وليه",
        "مستودعات متعددة",
      ]}
    />
  )
}
