import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { courierByToken, courierTasks } from '@/lib/couriers'
import { CourierBoard } from './board'

/**
 * صفحة المندوب — شغل يومه على موبايله.
 *
 * ## ليه دي برّه المتجر وبرّه اللوحة
 * برّه المتجر لأنها مش للعميل: فيها أرقام وعناوين عملاء تانيين.
 * وبرّه اللوحة لأن المندوب مالوش حساب ولا المفروض يشوف مبيعات
 * التاجر ولا أرباحه. مسار تالت بمفتاح واحد: الرمز اللي في الرابط.
 *
 * ## `force-dynamic` مقصود
 * كل فتحة بتقرا الحالة من القاعدة. المندوب بيفتح الصفحة عشرات
 * المرات في اليوم، وأي تخزين معناه إنه يدوس «اتسلّم» ويلاقي الطلب
 * لسه في القايمة فيدوس تاني.
 */
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'طلباتك',
  /* مش عايزين رابط مندوب يتفهرس في جوجل — فيه بيانات عملاء */
  robots: { index: false, follow: false },
}

export default async function CourierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const courier = await courierByToken(token)
  if (!courier) notFound()

  const [tasks, [store]] = await Promise.all([
    courierTasks(courier.id, courier.storeId),
    db
      .select({ name: stores.name, currency: stores.currency, phone: stores.phone })
      .from(stores)
      .where(eq(stores.id, courier.storeId))
      .limit(1),
  ])

  if (!store) notFound()

  return (
    <CourierBoard
      token={token}
      courierName={courier.name}
      storeName={store.name}
      storePhone={store.phone}
      currency={store.currency}
      feePerOrder={courier.feePerOrder}
      tasks={tasks}
    />
  )
}
