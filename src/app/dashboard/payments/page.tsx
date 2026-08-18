import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { paymentMethods } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { PaymentsManager, type PaymentRow } from './payments-manager'

export const metadata = { title: 'الدفع' }

export default async function PaymentsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      gateway: paymentMethods.gateway,
      enabled: paymentMethods.enabled,
      displayName: paymentMethods.displayName,
      instructions: paymentMethods.instructions,
      fixedFee: paymentMethods.fixedFee,
    })
    .from(paymentMethods)
    .where(eq(paymentMethods.storeId, store.id))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الدفع"
        description="فعّل طرق الدفع اللي تناسبك. اللي تفعّله بيظهر للعميل في الشيك أوت فورًا."
      />

      <Reveal>
        <PaymentsManager methods={rows as PaymentRow[]} />
      </Reveal>
    </div>
  )
}
