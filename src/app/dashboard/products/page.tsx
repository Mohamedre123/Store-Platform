import { Package } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "المنتجات" }

export default function Page() {
  return (
    <ComingSoon
      icon={Package}
      title={"المنتجات"}
      description={"كتالوج متجرك — منتجات وأقسام ومتغيّرات"}
      features={[
        "إضافة منتج بصور ووصف وسعر وتكلفة",
        "متغيّرات بألوان ومقاسات، لكل واحد سعره ومخزونه",
        "أقسام متداخلة وترتيب يدوي",
        "استيراد وتصدير ملفات للكميات الكبيرة",
        "منتجات رقمية وخدمات وحجوزات",
      ]}
    />
  )
}
