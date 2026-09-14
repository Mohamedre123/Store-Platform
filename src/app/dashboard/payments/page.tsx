import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { PaymentsManager, type PaymentRow } from './payments-manager'
import { loadPayments } from '@/lib/payments-data'
import { platformOrigin } from '@/lib/domain'
import { PaymentAttempts } from './attempts'

export const metadata = { title: 'الدفع' }

export default async function PaymentsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  /* البيانات مشتركة مع تطبيق الموبايل (`/api/app/payments`) */
  const { methods: rows, providers, codEnabled } = await loadPayments(store.id, store.country)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الدفع"
        description="فعّل طرق الدفع اللي تناسبك. اللي تفعّله بيظهر للعميل في الشيك أوت فورًا."
      />

      <Reveal>
        <PaymentsManager
          methods={rows as PaymentRow[]}
          providers={providers}
          origin={platformOrigin()}
          storeId={store.id}
          codEnabled={codEnabled}
        />
      </Reveal>

      {/*
        سجل المحاولات تحت الإعدادات لا فوقها: التاجر بيدخل الصفحة
        دي عشان يربط، ويرجعلها عشان يشوف ليه محاولة فشلت.
      */}
      <Reveal delay={60}>
        <PaymentAttempts storeId={store.id} currency={store.currency} />
      </Reveal>
    </div>
  )
}
