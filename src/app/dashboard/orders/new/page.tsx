import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadManualOrderSetup } from '@/lib/manual-order-data'
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

  /* الإعدادات مشتركة مع تطبيق الموبايل (`/api/app/manual-order`) */
  const { quota, config } = await loadManualOrderSetup(store)

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
        <ManualOrderForm config={config} />
      </Reveal>
    </div>
  )
}
