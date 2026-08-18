'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toggleWishlistAction } from '@/app/s/[store]/account/actions'
import { useStoreHref } from './store-link'

/**
 * زرار حفظ المنتج في المفضّلة.
 *
 * لو العميل مش مسجّل، بنوديه لصفحة الحساب بدل ما نطلع رسالة خطأ —
 * الرسالة بتوقّفه، والتحويل بيكمّل معاه.
 */
export function WishlistButton({
  storeIdentifier,
  productId,
  initialSaved = false,
}: {
  storeIdentifier: string
  productId: string
  initialSaved?: boolean
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, start] = useTransition()
  const router = useRouter()
  const href = useStoreHref()

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          const res = await toggleWishlistAction({ storeIdentifier, productId })
          if (res.needsLogin) {
            router.push(href('/account'))
            return
          }
          if (res.ok) setSaved(Boolean(res.saved))
        })
      }
      disabled={pending}
      aria-label={saved ? 'شيل من المفضّلة' : 'احفظ في المفضّلة'}
      aria-pressed={saved}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 transition-colors hover:bg-[var(--sf-text)]/6 disabled:opacity-50"
    >
      <Heart
        className={`h-5 w-5 transition-colors ${saved ? 'fill-current text-red-500' : 'opacity-60'}`}
        aria-hidden="true"
      />
    </button>
  )
}
