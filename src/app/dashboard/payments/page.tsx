import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { paymentMethods, shippingZones } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { PaymentsManager, type PaymentRow } from './payments-manager'
import { readPaymentProviders } from '@/lib/provider-store'
import { PAYMENT_PROVIDERS } from '@/lib/providers'
import { platformOrigin } from '@/lib/domain'

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

  /*
    حالة البوابات بتتقرا لوحدها عشان المفاتيح تفضل على الخادم.
    اللي بيرجع للمتصفح: مفعّلة ولا لأ، وأسماء المفاتيح المحفوظة —
    من غير أي قيمة.
  */
  const providers = await readPaymentProviders(store.id, PAYMENT_PROVIDERS)

  /*
    حالة الدفع عند الاستلام بتتقرا من منطقة الشحن لا من طرق الدفع:
    مفتاحه هناك، وعرضه هنا بقيمة تانية كان هيخلّي التاجر يفتكر إنه
    قافله وهو مفتوح.
  */
  const [zone] = await db
    .select({ codEnabled: shippingZones.codEnabled })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
    .limit(1)

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
          codEnabled={zone?.codEnabled ?? true}
        />
      </Reveal>
    </div>
  )
}
