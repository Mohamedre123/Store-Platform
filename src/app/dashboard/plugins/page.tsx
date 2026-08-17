import { Plug } from 'lucide-react'
import { ComingSoon } from '@/components/dashboard/page-shell'

export const metadata = { title: "الإضافات" }

export default function Page() {
  return (
    <ComingSoon
      icon={Plug}
      title={"الإضافات"}
      description={"أدوات تربطها بمتجرك"}
      features={[
        "بكسل فيسبوك وتيك توك وسناب وجوجل",
        "تتبّع من الخادم لدقة أعلى في قياس الإعلانات",
        "زر واتساب وتذكير السلات المتروكة",
        "ربط شركات الشحن والأنظمة الخارجية",
      ]}
    />
  )
}
