'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'

/**
 * تأكيد الحفظ.
 *
 * المشكلة اللي بيحلّها: التاجر بيدوس «حفظ»، الزرار بيلفّ، وبعدين
 * بيسكت. **هو مش عارف اتحفظ ولا لأ** — فبيدوس تاني، أو بيسيب
 * الصفحة وهو مش مطمّن ويرجع يتأكد.
 *
 * طريقتان للتشغيل، والاتنين محتاجين لأسباب مختلفة:
 *
 * ١. **`?saved=…` في الرابط** — للحفظ اللي بعده تحويل لصفحة تانية.
 *    حالة المتصفح بتموت مع التحويل، فالرسالة لازم تعدّي في الرابط
 *    نفسه. وبعد ما تتعرض بنشيلها من الرابط عشان التحديث ما يعيدهاش.
 * ٢. **حدث `zw:toast`** — للحفظ اللي بيفضل في نفس الصفحة.
 *
 * والرسالة بتقول **إيه اللي اتحفظ** لا «تم» وخلاص: التاجر اللي
 * حفظ حاجتين ورا بعض محتاج يعرف الرسالة دي بتاعة أنهي واحدة.
 */

export type ToastKind = 'success' | 'error'

/** ينده رسالة من أي مكان في المتصفح */
export function toast(text: string, kind: ToastKind = 'success') {
  window.dispatchEvent(new CustomEvent('zw:toast', { detail: { text, kind } }))
}

type Item = { id: number; text: string; kind: ToastKind }

export function Toaster() {
  const [items, setItems] = useState<Item[]>([])
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const push = (text: string, kind: ToastKind) => {
    const id = Date.now() + Math.random()
    setItems((v) => [...v, { id, text, kind }])
    window.setTimeout(() => setItems((v) => v.filter((i) => i.id !== id)), 3200)
  }

  /* الرسالة الجاية مع التحويل */
  useEffect(() => {
    const saved = params.get('saved')
    if (!saved) return

    push(saved === '1' ? 'اتحفظ' : decodeURIComponent(saved), 'success')

    /*
      بنشيلها من الرابط بعد ما تتعرض.
      من غير كده أي تحديث للصفحة بيعيد نفس الرسالة، والتاجر يفتكر
      إنه حفظ تاني.
    */
    const next = new URLSearchParams(params.toString())
    next.delete('saved')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [params, pathname, router])

  /* الرسالة من نفس الصفحة */
  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail
      push(d.text, d.kind ?? 'success')
    }
    window.addEventListener('zw:toast', onToast)
    return () => window.removeEventListener('zw:toast', onToast)
  }, [])

  if (items.length === 0) return null

  return (
    <div
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {items.map((i) => (
        <div
          key={i.id}
          className="zw-toast pointer-events-auto flex max-w-[min(28rem,92vw)] items-center gap-2.5 rounded-full py-2.5 ps-3 pe-2 shadow-xl"
          style={{
            background: i.kind === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
            color: '#fff',
          }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25">
            {i.kind === 'error' ? (
              <X className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Check className="h-3 w-3" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium">{i.text}</span>
          <button
            type="button"
            onClick={() => setItems((v) => v.filter((x) => x.id !== i.id))}
            aria-label="إغلاق"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
