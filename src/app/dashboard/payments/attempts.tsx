import { desc, eq } from 'drizzle-orm'
import { CircleAlert, CircleCheck, CircleDot, Receipt } from 'lucide-react'
import { db } from '@/db'
import { orders, paymentAttempts } from '@/db/schema'
import { paymentProvider } from '@/lib/providers'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { Card } from '@/components/ui'
import Link from 'next/link'

/**
 * سجل محاولات الدفع.
 *
 * ده أول مكان التاجر بيبص فيه لما يقوله عميل «أنا دفعت» والطلب
 * ظاهر مش مدفوع. من غيره الإجابة الوحيدة «مش عارفين»، والتاجر
 * بيشحن على ثقة أو يخسر البيعة.
 *
 * بيعرض **سبب الرفض بالعربي زي ما البوابة قالته** — «Integration ID
 * غلط» بتتصلّح في دقيقة، و«فشل الدفع» بتتحوّل لرسالة للدعم.
 */

const STATUS: Record<
  string,
  { label: string; icon: typeof CircleCheck; bg: string; fg: string }
> = {
  succeeded: {
    label: 'اتدفع',
    icon: CircleCheck,
    bg: 'var(--color-success-soft)',
    fg: 'var(--color-success)',
  },
  redirected: {
    label: 'اتحوّل للبوابة',
    icon: CircleDot,
    bg: 'var(--color-info-soft)',
    fg: 'var(--color-info)',
  },
  created: {
    label: 'اتسجّلت',
    icon: CircleDot,
    bg: 'var(--surface-2)',
    fg: 'var(--fg-muted)',
  },
  cancelled: {
    label: 'اتلغت',
    icon: CircleAlert,
    bg: 'var(--surface-2)',
    fg: 'var(--fg-muted)',
  },
  failed: {
    label: 'فشلت',
    icon: CircleAlert,
    bg: 'var(--color-danger-soft)',
    fg: 'var(--color-danger)',
  },
}

export async function PaymentAttempts({
  storeId,
  currency,
}: {
  storeId: string
  currency: string
}) {
  const rows = await db
    .select({
      id: paymentAttempts.id,
      gateway: paymentAttempts.gateway,
      status: paymentAttempts.status,
      amount: paymentAttempts.amount,
      currency: paymentAttempts.currency,
      reference: paymentAttempts.reference,
      errorMessage: paymentAttempts.errorMessage,
      createdAt: paymentAttempts.createdAt,
      orderId: paymentAttempts.orderId,
      orderNumber: orders.orderNumber,
    })
    .from(paymentAttempts)
    .leftJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(eq(paymentAttempts.storeId, storeId))
    .orderBy(desc(paymentAttempts.createdAt))
    .limit(40)

  if (rows.length === 0) return null

  const failed = rows.filter((r) => r.status === 'failed').length

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <Receipt className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">محاولات الدفع</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            آخر {rows.length} محاولة على متجرك.
            {failed > 0 && (
              <>
                {' '}
                <strong className="text-[var(--color-danger)]">{failed} منها فشلت</strong> — السبب
                مكتوب جنب كل واحدة.
              </>
            )}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="scroll-x">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="p-3 text-start font-medium">التاريخ</th>
                <th className="p-3 text-start font-medium">البوابة</th>
                <th className="p-3 text-start font-medium">الطلب</th>
                <th className="p-3 text-start font-medium">المبلغ</th>
                <th className="p-3 text-start font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = STATUS[r.status] ?? STATUS.created
                const Icon = meta.icon
                const name = paymentProvider(r.gateway)?.name ?? r.gateway

                return (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="whitespace-nowrap p-3 text-xs text-[var(--fg-muted)]">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="p-3">{name}</td>
                    <td className="p-3">
                      {r.orderNumber ? (
                        <Link
                          href={`/dashboard/orders/${r.orderId}`}
                          className="tabular font-medium text-[var(--primary)] hover:underline"
                        >
                          #{r.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-[var(--fg-subtle)]">—</span>
                      )}
                    </td>
                    <td className="tabular whitespace-nowrap p-3">
                      {r.amount > 0 ? formatMoney(r.amount, r.currency || currency) : '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {meta.label}
                      </span>
                      {r.errorMessage && (
                        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--fg-muted)]">
                          {r.errorMessage}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
