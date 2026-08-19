'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Copy, Gift, Lock } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import { redeemRewardAction } from '@/app/s/[store]/account/rewards-actions'

export type CatalogReward = {
  id: string
  name: string
  description: string | null
  type: string
  value: number
  pointsCost: number
  minTier: string | null
  stock: number | null
  /** محسوبة على الخادم — المستوى والرصيد */
  locked: boolean
  lockReason: string | null
}

/**
 * متجر المكافآت في حساب العميل.
 *
 * المكافأة اللي مش مؤهّل ليها بتتعرض مقفولة مش مخفية: «فاضلك ٥٠ نقطة»
 * بتخلّيه يطلب تاني عشان يوصلها. لو خفيناها، النقاط تفضل رقمًا مالوش
 * هدف واضح.
 */
export function RewardsCatalog({
  storeIdentifier,
  rewards,
  balance,
  currency,
}: {
  storeIdentifier: string
  rewards: CatalogReward[]
  balance: number
  currency: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [issued, setIssued] = useState<{ code: string; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (rewards.length === 0) return null

  const worth = (r: CatalogReward) =>
    r.type === 'coupon_percent'
      ? `خصم ${r.value / 100}٪`
      : r.type === 'coupon_fixed'
        ? `خصم ${formatMoney(r.value, currency)}`
        : r.type === 'free_shipping'
          ? 'شحن مجاني'
          : 'منتج مجاني'

  return (
    <section className="mb-10">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <Gift className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
        اصرف نقاطك
      </h2>
      <p className="mb-4 text-sm opacity-65">
        رصيدك <span className="tabular font-bold text-[var(--sf-primary)]">{balance}</span> نقطة.
      </p>

      {issued && (
        <div className="mb-4 rounded-[var(--sf-radius)] border border-[var(--sf-primary)]/30 bg-[var(--sf-primary)]/6 p-4">
          <p className="text-sm font-medium">تمام! استردّيت «{issued.label}»</p>
          <p className="mt-1 text-sm opacity-70">استخدم الكود ده في الشيك أوت:</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="tabular rounded-lg bg-[var(--sf-surface)] px-3 py-2 text-lg font-bold tracking-widest">
              {issued.code}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(issued.code)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--sf-text)]/20 px-3 text-sm"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? 'اتنسخ' : 'انسخ'}
            </button>
          </div>
          <p className="mt-2 text-xs opacity-60">
            الكود باسمك إنت بس، وصالح ٩٠ يوم.
          </p>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg bg-[var(--sf-text)]/6 px-3 py-2 text-sm">{error}</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {rewards.map((r) => {
          const short = balance < r.pointsCost
          const blocked = r.locked || short

          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-4"
              style={blocked ? { opacity: 0.65 } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="tabular shrink-0 text-sm font-bold text-[var(--sf-primary)]">
                  {r.pointsCost} نقطة
                </span>
              </div>

              <span className="text-sm opacity-70">{r.description || worth(r)}</span>

              {r.stock !== null && r.stock <= 5 && (
                <span className="tabular text-xs text-[var(--sf-primary)]">
                  باقي {r.stock} بس
                </span>
              )}

              <button
                type="button"
                disabled={blocked || pending}
                onClick={() =>
                  start(async () => {
                    setError(null)
                    const res = await redeemRewardAction(storeIdentifier, r.id)
                    if (res?.error) setError(res.error)
                    else if (res?.ok) {
                      setIssued({ code: res.code!, label: res.label! })
                      /*
                        الصفحة force-dynamic فمالهاش نسخة مخبّأة يبطّلها
                        revalidatePath — والرصيد بيتعرض من الخادم. من غير
                        التحديث ده العميل يشوف رصيده القديم بعد الاسترداد
                        ويفتكر إنها ما اتخصمتش، فيسترد تاني.
                      */
                      router.refresh()
                    }
                  })
                }
                className="mt-auto flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[var(--sf-text)]/12 disabled:text-[var(--sf-text)]"
              >
                {r.locked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    {r.lockReason}
                  </>
                ) : short ? (
                  `فاضلك ${r.pointsCost - balance} نقطة`
                ) : (
                  'استرد'
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
