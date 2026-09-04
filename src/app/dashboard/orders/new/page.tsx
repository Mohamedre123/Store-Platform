import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ArrowRight } from 'lucide-react'
import { db } from '@/db'
import { shippingRates, shippingZones } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { getOrderQuota } from '@/lib/entitlements'
import { regionsFor } from '@/lib/regions'
import { getCheckoutSettings } from '@/lib/checkout'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Alert } from '@/components/ui'
import { Reveal } from '@/components/motion'
import { ManualOrderForm } from './manual-order-form'

export const metadata = { title: 'طلب جديد' }

/**
 * صفحة تسجيل طلب يدوي.
 *
 * القفل هنا 404 لا رسالة: التاجر اللي قافل الطلبات اليدوية من
 * إعداداته ما ينفعش يوصل للشاشة أصلًا، وصفحة بتقول «مقفول» بتخلّيه
 * يفتكر إن فيه عطل.
 */
export default async function NewOrderPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.manage')
  if (!store.manualOrdersEnabled) notFound()

  const [quota, settings, zone] = await Promise.all([
    getOrderQuota(store),
    getCheckoutSettings(store.id),
    db
      .select({ id: shippingZones.id })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
      .limit(1)
      .then((r) => r[0] ?? null),
  ])

  /**
   * المدن اللي ليها سعر شحن مفعّل.
   *
   * بتتعرض جنب اسم المحافظة في القايمة: التاجر اللي بيختار محافظة
   * مش مسعّرة بيشوف «بلا سعر شحن» قبل ما يحفظ، بدل ما يكتشف الصفر
   * في الفاتورة بعد ما بعت البضاعة.
   */
  const cities = zone
    ? await db
        .select({ city: shippingRates.city })
        .from(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.enabled, true)))
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="طلب جديد"
        description="سجّل طلبًا جالك على واتساب أو انستجرام أو في المحل — المخزون والتقارير بتتحدّث زي أي طلب."
        action={
          <Link
            href="/dashboard/orders"
            className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            رجوع للطلبات
          </Link>
        }
      />

      {quota.blocked && (
        <Alert tone="warning">
          وصلت لحد الباقة المجانية ({quota.limit} طلبات). اشترك عشان تكمّل تسجيل الطلبات.
        </Alert>
      )}

      <Reveal>
        <ManualOrderForm
          config={{
            currency: store.currency,
            allowOversell: store.manualOversell,
            allowCustomPrice: store.manualCustomPricing,
            allowDeposit: store.manualDepositEnabled,
            regions: regionsFor(store.country).map((r) => ({ code: r.code, name: r.name })),
            shippingCities: cities.map((c) => c.city),
            pickupAllowed: settings.deliveryMode !== 'delivery',
          }}
        />
      </Reveal>
    </div>
  )
}
