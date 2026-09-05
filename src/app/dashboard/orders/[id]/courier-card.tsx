'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Bike, Check, Phone } from 'lucide-react'
import { assignCourierAction } from '@/app/dashboard/couriers/actions'
import { Button, Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { formatMoney } from '@/lib/utils'

export type CourierOption = { id: string; name: string; phone: string; zones: string[] }

/**
 * إسناد الطلب لمندوب — من صفحة الطلب نفسها.
 *
 * ## ليه هنا كمان مش في صفحة المندوبين بس
 * التاجر بيفتح الطلب عشان يراجعه قبل ما يبعته. لو الإسناد في شاشة
 * تانية، بيقفل الطلب ويروح يدوّر على رقمه في قايمة تانية — وده
 * اللي بيخلّي الطلب المراجَع يفضل غير مسنود.
 *
 * ## والكارت بيختفي لو مفيش مندوبين
 * التاجر اللي بيشحن بشركة مالوش دعوة بقسم فاضي في كل طلب.
 */
export function CourierCard({
  orderId,
  couriers,
  assigned,
  city,
  codAmount,
  currency,
}: {
  orderId: string
  couriers: CourierOption[]
  assigned: { name: string; phone: string } | null
  city: string | null
  codAmount: number
  currency: string
}) {
  const [pending, start] = useTransition()
  const [choice, setChoice] = useState('')

  if (couriers.length === 0 && !assigned) return null

  /* بيغطّي منطقة الطلب؟ — بيتعلّم بعلامة، والباقي بيفضل مختار */
  const covers = (c: CourierOption) => !city || c.zones.length === 0 || c.zones.includes(city)

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">المندوب</h2>
        <Link
          href="/dashboard/couriers"
          className="text-xs text-[var(--fg-muted)] hover:underline"
        >
          كل المندوبين
        </Link>
      </div>

      {assigned ? (
        <div className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <Bike className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{assigned.name}</span>
            <span dir="ltr" className="block truncate text-start text-xs text-[var(--fg-subtle)]">
              {assigned.phone}
            </span>
          </span>
          <a
            href={`tel:${assigned.phone}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)]"
            aria-label={`اتصل بـ${assigned.name}`}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
          {codAmount > 0
            ? `هيحصّل ${formatMoney(codAmount, currency)} من العميل.`
            : 'الطلب مدفوع — المندوب مش هياخد فلوس.'}
        </p>
      )}

      {couriers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select
            className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
            value={choice}
            disabled={pending}
            onChange={(e) => setChoice(e.target.value)}
            aria-label="اختار مندوب"
          >
            <option value="">{assigned ? 'حوّله لمندوب تاني…' : 'اختار مندوب…'}</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {covers(c) && city ? ' ✓' : ''}
              </option>
            ))}
          </select>

          <Button
            loading={pending}
            disabled={!choice}
            onClick={() =>
              start(async () => {
                const res = await assignCourierAction(orderId, choice)
                if (res?.error) toast(res.error, 'error')
                else {
                  toast('الطلب اتسند للمندوب')
                  setChoice('')
                }
              })
            }
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            اسند
          </Button>
        </div>
      )}
    </Card>
  )
}
