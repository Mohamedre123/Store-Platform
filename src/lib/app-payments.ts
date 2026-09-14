import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadPaymentAttempts, loadPayments } from '@/lib/payments-data'
import { PAYMENT_PROVIDERS, paymentProvider, webhookPath } from '@/lib/providers'
import { platformOrigin } from '@/lib/domain'
import { fromMinorUnits } from '@/lib/utils'
import { providerView } from '@/lib/app-providers'

/*
  نسخة من `METHODS` في `src/app/dashboard/payments/payments-manager.tsx` — الملف ده
  'use client' وقيمه ما بتتستوردش في كود الخادم. أي تعديل هناك يتعدّل هنا.
*/
const METHODS = [
  {
    gateway: 'cod',
    title: 'الدفع عند الاستلام',
    desc: 'العميل بيدفع كاش لمّا الطلب يوصله. الأكثر استخدامًا في مصر.',
    defaultName: 'الدفع عند الاستلام',
    hasFee: true,
    hasInstructions: false,
    instructionsLabel: '',
    instructionsHint: '',
  },
  {
    gateway: 'manual',
    title: 'تحويل بنكي أو محفظة',
    desc: 'العميل بيحوّل على حسابك أو محفظتك، ويبعتلك الإيصال. من غير أي عقود.',
    defaultName: 'تحويل بنكي / فودافون كاش',
    hasFee: false,
    hasInstructions: true,
    instructionsLabel: 'تعليمات التحويل',
    instructionsHint: 'اكتب رقم حسابك أو محفظتك، والعميل هيشوفها في الشيك أوت. مثال: فودافون كاش 010xxxxxxxx باسم…',
  },
]

/* نفس `STATUS` في `payments/attempts.tsx` */
const STATUS: Record<string, { label: string; tone: 'good' | 'info' | 'muted' | 'bad' }> = {
  succeeded: { label: 'اتدفع', tone: 'good' },
  redirected: { label: 'اتحوّل للبوابة', tone: 'info' },
  created: { label: 'اتسجّلت', tone: 'muted' },
  cancelled: { label: 'اتلغت', tone: 'muted' },
  failed: { label: 'فشلت', tone: 'bad' },
}

/** شكل شاشة الدفع اللي تطبيق الموبايل بيستلمه — المبالغ اللي في الفورم بالجنيه كنص زي اللوحة */
export async function paymentsPayload(store: ActiveStore) {
  const [{ methods, providers, codEnabled }, attempts] = await Promise.all([
    loadPayments(store.id, store.country),
    loadPaymentAttempts(store.id),
  ])
  const origin = platformOrigin()
  const byGateway = new Map(methods.map((m) => [m.gateway, m]))

  return {
    currency: store.currency,
    codEnabled,
    methods: METHODS.map((def) => {
      const saved = byGateway.get(def.gateway)
      return {
        ...def,
        enabled: def.gateway === 'cod' ? codEnabled : (saved?.enabled ?? false),
        displayName: saved?.displayName ?? def.defaultName,
        instructions: saved?.instructions ?? '',
        fee: saved?.fixedFee ? String(fromMinorUnits(saved.fixedFee)) : '',
      }
    }),
    gateways: PAYMENT_PROVIDERS.map((def) =>
      providerView(def, providers[def.slug], origin + webhookPath('pay', def.slug, store.id)),
    ),
    attempts: attempts.map((a) => {
      const meta = STATUS[a.status] ?? STATUS.created
      return {
        id: a.id,
        gateway: paymentProvider(a.gateway)?.name ?? a.gateway,
        status: a.status,
        statusLabel: meta.label,
        tone: meta.tone,
        amount: a.amount,
        currency: a.currency || store.currency,
        orderId: a.orderId,
        orderNumber: a.orderNumber,
        error: a.errorMessage,
        createdAt: new Date(a.createdAt).toISOString(),
      }
    }),
  }
}
