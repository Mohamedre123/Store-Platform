import { getDashboardContext } from '@/lib/store-context'
import { readWhatsapp } from '@/lib/whatsapp'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { WhatsappForm } from './whatsapp-form'

export const metadata = { title: 'واتساب' }

export default async function WhatsappPage() {
  const { store } = await getDashboardContext()
  const settings = await readWhatsapp(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="واتساب"
        description="اربط رقم متجرك عشان رموز الدخول وتأكيد الطلبات توصل لعملاءك على واتساب."
      />

      <Reveal>
        <WhatsappForm initial={settings} />
      </Reveal>
    </div>
  )
}
