import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { readTemplates, readWhatsapp } from '@/lib/whatsapp'
import { platformToken } from '@/lib/whatsapp-onboard'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { WhatsappForm } from './whatsapp-form'
import { TemplatesEditor } from './templates-editor'

export const metadata = { title: 'واتساب' }

export default async function WhatsappPage() {
  const { store, user, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')
  const settings = await readWhatsapp(store.id)
  const templates = await readTemplates(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="واتساب"
        description="اربط رقم متجرك عشان رموز الدخول وتأكيد الطلبات توصل لعملاءك على واتساب."
      />

      <Reveal>
        <WhatsappForm
          initial={settings}
          easyLink
          storePhone={store.whatsapp ?? store.phone ?? null}
          hasPlatformToken={Boolean(platformToken())}
          /*
            نفس بيانات التسجيل اللي في صفحة الإضافات.

            الشاشة واحدة والتاجر بيوصلها من الاتنين، فلو الصفحة دي
            ما مرّرتش البيانات بيلاقي زر إنشاء الحساب من غير اللي
            يلزقه — ويفتكر إن الميزة ناقصة، وهي موجودة في الطريق
            التاني بس.
          */
          account={{ name: user.name, email: user.email }}
        />
      </Reveal>

      <Reveal delay={80}>
        <TemplatesEditor initial={templates} />
      </Reveal>
    </div>
  )
}
